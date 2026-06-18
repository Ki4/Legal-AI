#!/usr/bin/env node
/**
 * service-lifecycle.mjs — manual lifecycle tooling for services (feature: service-lifecycle, G4).
 *
 * A service is a managed unit with a `status` kill-switch (active | needs_review | disabled).
 * ONLY `active` is served (write-path guard in n8n is authoritative). This script lets a
 * human (Olga / Sergey) drive the lifecycle WITHOUT a deploy:
 *   - flip a service status by slug;
 *   - record a watched-law change in `law_change_log` and flip every dependent service to
 *     `needs_review` (reverse index by canonical law URL — see scripts/law-registry.mjs).
 *
 * Identity of a law = its zakon.rada URL (registry), NOT its free-text slug — so slug drift
 * across services cannot break the reverse index.
 *
 * Usage:
 *   node scripts/service-lifecycle.mjs status
 *   node scripts/service-lifecycle.mjs validate
 *   node scripts/service-lifecycle.mjs normalize [--dry-run]
 *   node scripts/service-lifecycle.mjs set-status <slug> <active|needs_review|disabled> [--dry-run]
 *   node scripts/service-lifecycle.mjs log-law-change <law> <new_date> [--old=YYYY-MM-DD]
 *                                       [--notes="..."] [--detected-by=manual|cron] [--dry-run]
 *     <law>      canonical slug | full URL | rada id fragment (e.g. 2947-14)
 *     <new_date> new revision date, YYYY-MM-DD
 *
 * Env (apps/client/.env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (service_role — bypasses RLS).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWS, resolveLaw, lawByUrl, lawCode } from './law-registry.mjs';
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs';
import { applyLawChange } from './lib/law-change.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, 'apps/client/.env.local');

const STATUSES = ['active', 'needs_review', 'disabled'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── env + supabase client ──────────────────────────────────────────────────

loadEnv(ENV_FILE);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (apps/client/.env.local)');
  process.exit(1);
}

const client = createSupabaseClient(SUPABASE_URL, SERVICE_KEY);
const { sbGet, sbPatch } = client;

// ─── flag parsing ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = {};
const positionals = [];
for (const a of argv) {
  if (a.startsWith('--')) {
    const [k, v] = a.slice(2).split('=');
    flags[k] = v === undefined ? true : v;
  } else {
    positionals.push(a);
  }
}
const DRY = !!flags['dry-run'];

// ─── commands ─────────────────────────────────────────────────────────────────

async function cmdStatus() {
  const rows = await sbGet('services', 'select=slug,title,status,needs_law_review&order=slug');
  console.log('\n  Services lifecycle status:\n');
  for (const s of rows) {
    const icon = s.status === 'active' ? '🟢' : s.status === 'needs_review' ? '🟡' : '⚪';
    const nlr = s.needs_law_review ? ' (needs_law_review)' : '';
    console.log(`  ${icon} ${s.slug.padEnd(14)} ${String(s.status).padEnd(13)} ${s.title || ''}${nlr}`);
  }
  console.log('');
}

/** Compare every watched_laws entry against the registry; report drift. */
async function cmdValidate() {
  const rows = await sbGet('services', 'select=slug,watched_laws&order=slug');
  let problems = 0;
  console.log('\n  Validating watched_laws against the canonical registry:\n');
  for (const s of rows) {
    const laws = s.watched_laws || [];
    if (!laws.length) continue;
    for (const law of laws) {
      const canon = lawByUrl(law.url);
      if (!canon) {
        problems++;
        console.log(`  ❌ ${s.slug}: unknown law url "${law.url}" (slug="${law.slug}") — not in registry`);
      } else if (law.slug !== canon.slug || law.title !== canon.title) {
        problems++;
        console.log(`  ⚠️  ${s.slug}: drift on ${canon.url}`);
        if (law.slug !== canon.slug) console.log(`        slug:  "${law.slug}" → "${canon.slug}"`);
        if (law.title !== canon.title) console.log(`        title: "${law.title}" → "${canon.title}"`);
      }
    }
  }
  if (problems === 0) {
    console.log('  ✅ All watched_laws match the registry (canonical slug + title).\n');
  } else {
    console.log(`\n  ${problems} mismatch(es). Run "normalize" to fix slug/title drift.\n`);
    process.exitCode = 1;
  }
}

/** Rewrite slug + title of each watched_laws entry to the registry canonical (matched by url). */
async function cmdNormalize() {
  const rows = await sbGet('services', 'select=id,slug,watched_laws&order=slug');
  let changed = 0;
  console.log(`\n  Normalizing watched_laws to canonical registry${DRY ? ' (DRY RUN)' : ''}:\n`);
  for (const s of rows) {
    const laws = s.watched_laws || [];
    if (!laws.length) continue;
    let dirty = false;
    const next = laws.map((law) => {
      const canon = lawByUrl(law.url);
      if (!canon) {
        console.log(`  ❌ ${s.slug}: url "${law.url}" not in registry — left untouched`);
        return law;
      }
      if (law.slug !== canon.slug || law.title !== canon.title) {
        dirty = true;
        console.log(`  • ${s.slug}: "${law.slug}" → "${canon.slug}"`);
        return { ...law, slug: canon.slug, title: canon.title };
      }
      return law;
    });
    if (dirty) {
      changed++;
      if (!DRY) await sbPatch('services', `id=eq.${s.id}`, { watched_laws: next });
    }
  }
  if (changed === 0) console.log('  ✅ Nothing to normalize — already canonical.\n');
  else console.log(`\n  ${DRY ? 'Would update' : 'Updated'} ${changed} service(s).\n`);
}

async function cmdSetStatus() {
  const [slug, status] = positionals.slice(1);
  if (!slug || !status) die('Usage: set-status <slug> <active|needs_review|disabled> [--dry-run]');
  if (!STATUSES.includes(status)) die(`Invalid status "${status}". Allowed: ${STATUSES.join(' | ')}`);

  const rows = await sbGet('services', `select=slug,status,needs_law_review&slug=eq.${slug}`);
  if (!rows.length) die(`Service "${slug}" not found.`);
  const cur = rows[0];

  // Keep status and needs_law_review coherent (status is authoritative — migration 011):
  //   active        → no pending review (clear flag)
  //   needs_review  → law under suspicion (set flag)
  //   disabled      → leave the flag as-is (manual off; review state unchanged)
  const patch = { status };
  if (status === 'active') patch.needs_law_review = false;
  else if (status === 'needs_review') patch.needs_law_review = true;

  console.log(`\n  ${slug}: status ${cur.status} → ${status}${DRY ? '  (DRY RUN)' : ''}`);
  if (!DRY) {
    await sbPatch('services', `slug=eq.${slug}`, patch);
    console.log('  ✅ Updated.\n');
  } else {
    console.log('  (no write)\n');
  }
}

async function cmdLogLawChange() {
  const [lawArg, newDate] = positionals.slice(1);
  if (!lawArg || !newDate) {
    die('Usage: log-law-change <law: slug|url|rada-id> <new_date YYYY-MM-DD> [--old=YYYY-MM-DD] [--notes="..."] [--detected-by=manual|cron] [--dry-run]');
  }
  if (!DATE_RE.test(newDate)) die(`new_date "${newDate}" must be YYYY-MM-DD.`);
  if (flags.old && !DATE_RE.test(flags.old)) die(`--old "${flags.old}" must be YYYY-MM-DD.`);

  const law = resolveLaw(lawArg);
  if (!law) {
    die(`Law "${lawArg}" not in registry. Known: ${LAWS.map((l) => l.slug).join(', ')}`);
  }
  const detectedBy = flags['detected-by'] || 'manual';
  if (!['manual', 'cron'].includes(detectedBy)) die(`--detected-by must be manual|cron.`);

  // Canonical flow lives in lib/law-change.mjs (shared with the CRON monitor). Run a dry
  // pass first to report the reverse index, then the real apply unless --dry-run.
  const preview = await applyLawChange(client, {
    law,
    newDate,
    oldDate: flags.old || null,
    detectedBy,
    notes: flags.notes || null,
    dry: true,
  });

  console.log(`\n  Law change: ${law.slug} (${law.title})`);
  console.log(`     ${law.url}`);
  console.log(`     revision: ${preview.derivedOld || '?'} → ${newDate}   detected_by=${detectedBy}`);
  console.log(`  Dependent services (reverse index by URL): ${preview.affected.map((s) => s.slug).join(', ') || '— none —'}`);
  if (DRY) {
    console.log('\n  DRY RUN — no writes (no log row, no status flips).\n');
    return;
  }
  if (!preview.affected.length) {
    console.log('\n  ⚠️  No dependent services — logging the change but nothing to flip.\n');
  }

  const { logRow, affected } = await applyLawChange(client, {
    law,
    newDate,
    oldDate: flags.old || null,
    detectedBy,
    notes: flags.notes || null,
  });
  console.log(`\n  📝 law_change_log #${logRow.id} created (action=flagged).`);
  for (const s of affected) {
    console.log(`  🟡 ${s.slug}: status ${s.status} → needs_review (law date → ${newDate})`);
  }
  console.log(`  🟡 law_chunks/law_documents (law_code=${lawCode(law)}) marked is_stale=true — re-seed to clear.`);
  console.log('\n  Done. Review in DB / re-activate with: set-status <slug> active\n');
}

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function usage() {
  console.log(`
  service-lifecycle — manual lifecycle tooling (feature: service-lifecycle, G4)

  Commands:
    status                                   List all services + status.
    validate                                 Check watched_laws against the law registry.
    normalize [--dry-run]                    Rewrite watched_laws slug/title to canonical.
    set-status <slug> <status> [--dry-run]   Flip kill-switch (active|needs_review|disabled).
    log-law-change <law> <new_date> [opts]   Record a law change + flip dependent services.
        opts: --old=YYYY-MM-DD --notes="..." --detected-by=manual|cron --dry-run
        <law> = canonical slug | URL | rada id (e.g. 2947-14)
`);
}

const command = positionals[0];
const run = {
  status: cmdStatus,
  validate: cmdValidate,
  normalize: cmdNormalize,
  'set-status': cmdSetStatus,
  'log-law-change': cmdLogLawChange,
};

if (!command || command === 'help' || flags.help) {
  usage();
  process.exit(command ? 0 : 1);
}
if (!run[command]) {
  console.error(`❌ Unknown command "${command}".`);
  usage();
  process.exit(1);
}

run[command]().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
