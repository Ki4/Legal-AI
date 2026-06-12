#!/usr/bin/env node
/**
 * extract-citations.mjs — CLI for citation-coverage (issue #36).
 *
 * Regenerates the per-service citation goldens (`<slug>.citations.json`) from the
 * doc-engine templates in `n8n/templates/services/*.document.txt`, using the
 * regex extractor in `scripts/lib/citations.mjs`. The goldens are the committed
 * SSoT for "service → cited law articles"; `n8n/templates/__tests__/citations-drift.test.js`
 * fails if a template's citations drift from its golden.
 *
 * `report` / `sync` additionally compare the goldens against each service's live
 * `watched_laws` (Supabase) — the CRON law-monitor only watches articles listed there,
 * so a cited-but-not-watched article is a legal-safety gap (a law change could go
 * undetected). `sync --dry-run` previews the watched_laws patch that would close it;
 * article *titles* are curated by a human (migration), so sync never writes.
 *
 * Usage:
 *   node scripts/extract-citations.mjs --write     Regenerate all <slug>.citations.json
 *   node scripts/extract-citations.mjs             Print extracted citations (no write)
 *   node scripts/extract-citations.mjs report      Diff goldens vs live watched_laws
 *   node scripts/extract-citations.mjs sync --dry-run   Preview watched_laws patch for drift
 *
 * Env (apps/client/.env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (report/sync only).
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractArticlesByLaw } from './lib/citations.mjs';
import { normalizeUrl } from './law-registry.mjs';
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SERVICES_DIR = resolve(ROOT, 'n8n/templates/services');
const ENV_FILE = resolve(ROOT, 'apps/client/.env.local');

const TEMPLATE_SUFFIX = '.document.txt';

/** List service slugs that have a `<slug>.document.txt` template. */
export function listTemplateSlugs(dir = SERVICES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(TEMPLATE_SUFFIX))
    .map((f) => f.slice(0, -TEMPLATE_SUFFIX.length))
    .sort();
}

/** Extract the citations golden for one service's template. */
export function extractGolden(slug, dir = SERVICES_DIR) {
  const text = readFileSync(resolve(dir, `${slug}${TEMPLATE_SUFFIX}`), 'utf8');
  return { slug, laws: extractArticlesByLaw(text) };
}

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function sbClient() {
  loadEnv(ENV_FILE);
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) die('Missing env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (apps/client/.env.local)');
  return createSupabaseClient(url, key);
}

/**
 * For each templated service, compare golden citations against live watched_laws.
 * @returns {Promise<Array<{ slug, law, cited: string[], watched: string[], missing: string[], extra: string[] }>>}
 */
async function diffAgainstWatchedLaws() {
  const { sbGet } = sbClient();
  const out = [];

  for (const slug of listTemplateSlugs()) {
    const golden = extractGolden(slug);
    const rows = await sbGet('services', `select=watched_laws&slug=eq.${slug}`);
    const watchedLaws = rows[0]?.watched_laws || [];

    for (const law of golden.laws) {
      const w = watchedLaws.find((l) => normalizeUrl(l.url) === normalizeUrl(law.url));
      const watched = (w?.articles || []).map((a) => a.number);
      const watchedSet = new Set(watched);
      const citedSet = new Set(law.articles);

      out.push({
        slug,
        law,
        cited: law.articles,
        watched,
        missing: law.articles.filter((n) => !watchedSet.has(n)),
        extra: watched.filter((n) => !citedSet.has(n)),
      });
    }
  }
  return out;
}

async function cmdReport() {
  const diffs = await diffAgainstWatchedLaws();
  let errors = 0;
  let lastSlug;

  for (const { slug, law, missing, extra } of diffs) {
    if (slug !== lastSlug) {
      console.log(`\n${slug}:`);
      lastSlug = slug;
    }
    console.log(`  ${law.title}`);
    if (missing.length) {
      errors += missing.length;
      console.log(`    🔴 cited but not watched: ст. ${missing.join(', ')}`);
    }
    if (extra.length) {
      console.log(`    🟡 watched but not cited (informational): ст. ${extra.join(', ')}`);
    }
    if (!missing.length && !extra.length) {
      console.log(`    ✅ in sync`);
    }
  }

  if (errors) {
    console.log(`\n${errors} cited article(s) missing from watched_laws — run "sync --dry-run" for a patch preview.\n`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ All cited articles are watched.\n');
  }
}

async function cmdSync() {
  if (!process.argv.includes('--dry-run')) {
    die('sync only supports --dry-run for now — article titles need a human-curated migration (G4).');
  }
  const diffs = (await diffAgainstWatchedLaws()).filter((d) => d.missing.length);

  if (!diffs.length) {
    console.log('\n✅ Nothing to sync — all cited articles are already watched.\n');
    return;
  }

  console.log('\nDRY RUN — watched_laws patch to close cited-but-not-watched drift:\n');
  for (const { slug, law, missing } of diffs) {
    console.log(`  ${slug} → ${law.title} (${law.url})`);
    const additions = missing.map((n) => ({ number: n, title: 'TODO: уточнити назву статті' }));
    console.log(`    + ${JSON.stringify(additions)}`);
  }
  console.log('\n(no writes — curate titles and apply via a numbered migration)\n');
}

function main() {
  const command = process.argv[2];
  const write = process.argv.includes('--write');

  if (command === 'report') return cmdReport();
  if (command === 'sync') return cmdSync();

  const slugs = listTemplateSlugs();
  for (const slug of slugs) {
    const golden = extractGolden(slug);
    const json = JSON.stringify(golden, null, 2) + '\n';

    if (write) {
      writeFileSync(resolve(SERVICES_DIR, `${slug}.citations.json`), json, 'utf8');
      console.log(`✅ wrote ${slug}.citations.json`);
    } else {
      console.log(`\n${slug}:`);
      for (const law of golden.laws) {
        console.log(`  ${law.title} (${law.url})`);
        console.log(`    ст. ${law.articles.join(', ')}`);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
