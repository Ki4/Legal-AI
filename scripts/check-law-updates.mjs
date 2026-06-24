#!/usr/bin/env node
/**
 * check-law-updates.mjs — automated watched-law monitor.
 *
 * Iterates the canonical law registry (scripts/law-registry.mjs), reads each law's current
 * revision date from zakon.rada.gov.ua, and — on a change — runs the SAME canonical flow as
 * the manual `service-lifecycle.mjs log-law-change` command: append a law_change_log row
 * (detected_by='cron') and flip every dependent service to status='needs_review'. The admin
 * review panel (📋 Зміни законів) then shows the change for lawyer sign-off.
 *
 * Identity of a law = its rada URL (registry), never the free-text slug — so slug drift
 * across services cannot make the monitor miss a service.
 *
 * Idempotent: after flagging, watched_laws.last_known_date is bumped to the new date, so a
 * subsequent run sees "no change" and does not create duplicate rows.
 *
 * Usage:
 *   node scripts/check-law-updates.mjs              # check & update DB
 *   node scripts/check-law-updates.mjs --dry-run    # check only, no DB writes
 *   node scripts/check-law-updates.mjs --notify     # also send a Telegram admin alert
 *
 * Env (apps/client/.env.local, or CI secrets — CI wins):
 *   VITE_SUPABASE_URL       — Supabase project URL
 *   SUPABASE_SERVICE_KEY    — service_role key (bypasses RLS; required to write law_change_log)
 *   TELEGRAM_BOT_TOKEN      — (optional) for --notify
 *   TELEGRAM_ADMIN_CHAT_ID  — (optional) for --notify
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWS, normalizeUrl, lawCode } from './law-registry.mjs';
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs';
import { fetchRevisionDate } from './lib/rada.mjs';
import { affectedServices, applyLawChange } from './lib/law-change.mjs';
import { captureLawDiff } from './lib/law-impact.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, 'apps/client/.env.local');

const DRY_RUN = process.argv.includes('--dry-run');
const NOTIFY = process.argv.includes('--notify');
// Be gentle to zakon.rada.gov.ua between requests. Base + jitter so that, as the registry
// grows, requests don't fall into a fixed cadence the server could pattern-match / throttle.
const POLITE_BASE_MS = 1000;
const POLITE_JITTER_MS = 500;

loadEnv(ENV_FILE);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (apps/client/.env.local or CI secrets)');
  process.exit(1);
}

const client = createSupabaseClient(SUPABASE_URL, SERVICE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const politeDelay = () => sleep(POLITE_BASE_MS + Math.round(Math.random() * POLITE_JITTER_MS));

// ─── Telegram notification ────────────────────────────────────────────────────

async function sendTelegramAlert(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('  ⚠️  Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID) — skipping alert');
    return;
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    console.log(resp.ok ? '  📤 Telegram alert sent' : `  ⚠️  Telegram API error: ${resp.status}`);
  } catch (e) {
    console.warn(`  ⚠️  Telegram send failed: ${e.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Legal AI — Law Change Monitor');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE (will update DB)'}   Notify: ${NOTIFY ? 'YES' : 'NO'}\n`);

  // Fetch services once; reuse for the reverse index across all laws.
  const services = await client.sbGet('services', 'select=id,slug,status,watched_laws');

  const changes = [];

  for (const law of LAWS) {
    const deps = affectedServices(services, law);
    if (deps.length === 0) {
      console.log(`  ── ${law.slug} — no service watches this law, skipping`);
      continue;
    }

    // Baseline = the revision dates the dependent services currently acknowledge. Normalized
    // data has one value; if they ever disagree, any value not equal to "current" = change.
    const key = normalizeUrl(law.url);
    const knownDates = new Set(
      deps
        .flatMap((s) => (s.watched_laws || []).filter((l) => normalizeUrl(l.url) === key))
        .map((l) => l.last_known_date)
        .filter(Boolean),
    );

    process.stdout.write(`  ── ${law.slug} (${deps.map((s) => s.slug).join(', ')})... `);

    let current;
    try {
      current = await fetchRevisionDate(law.url, {
        onRetry: ({ attempt, reason, waitMs }) =>
          console.log(`\n     ↻ retry ${attempt + 1} after ${reason} — waiting ${Math.round(waitMs)}ms`),
      });
    } catch (e) {
      // Only reached after retries are exhausted → genuinely unreachable this run.
      console.log(`❌ fetch error (after retries): ${e.message}`);
      await politeDelay();
      continue;
    }

    if (!current) {
      console.log('⚠️  could not parse revision date');
      await politeDelay();
      continue;
    }

    if (knownDates.has(current)) {
      console.log(`✅ OK (${current})`);
      await politeDelay();
      continue;
    }

    // Changed. Most-recent known date is the best "old" for the audit row.
    const oldDate = [...knownDates].sort().pop() || null;
    console.log(`🔴 CHANGED: ${oldDate || '?'} → ${current}`);

    // L1: snapshot the deterministic diff BEFORE applyLawChange flags content is_stale (the
    // stored old text is still the old revision now). Fail-soft: null → behaves exactly as
    // before (flip without a diff). Skipped on dry runs (no writes, save a fetch).
    const articleDiffs = DRY_RUN ? null : await captureLawDiff(client, law);

    const res = await applyLawChange(client, {
      law,
      newDate: current,
      oldDate,
      detectedBy: 'cron',
      notes: 'Автоматично виявлено CRON-моніторингом',
      articleDiffs,
      services,
      dry: DRY_RUN,
    });

    changes.push({ law, oldDate, newDate: current, affected: res.affected.map((s) => s.slug) });
    if (!DRY_RUN) {
      console.log(`     📝 law_change_log #${res.logRow.id} · 🟡 flipped: ${res.affected.map((s) => s.slug).join(', ') || '— none —'}`);
      console.log(`     🟡 law_chunks/law_documents (law_code=${lawCode(law)}) marked is_stale=true`);
    }
    await politeDelay();
  }

  // Summary.
  console.log('\n' + '═'.repeat(60));
  if (changes.length === 0) {
    console.log('  ✅ All watched laws are up to date. No changes detected.');
  } else {
    console.log(`  🔴 ${changes.length} law change(s) detected:`);
    for (const c of changes) {
      console.log(`     • ${c.law.slug}: ${c.oldDate || '?'} → ${c.newDate}  [${c.affected.join(', ') || 'no deps'}]`);
    }
    if (DRY_RUN) console.log('\n  ℹ️  DRY RUN — no DB changes made. Remove --dry-run to apply.');

    if (NOTIFY && !DRY_RUN) {
      const lines = changes.map(
        (c) => `• <b>${c.law.title}</b>: ${c.oldDate || '?'} → ${c.newDate}\n  послуги: ${c.affected.join(', ') || '—'}`,
      );
      await sendTelegramAlert(
        `⚠️ <b>Зміна закону виявлена</b>\n\n${lines.join('\n')}\n\nПослуги переведено в <b>needs_review</b>. Перевірте панель «📋 Зміни законів» в адмінці.`,
      );
    }
  }
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});
