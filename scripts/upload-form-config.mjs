#!/usr/bin/env node
/**
 * Upload a service's form_config from the repo TS SSoT (apps/client/src/data/*.ts)
 * to the live Supabase `services` row. Replaces the one-off upload-alimony-config.mjs
 * (whose inline config was in a tabs[].fields[] shape the TWA cannot render — issue #86).
 *
 * Usage (from monorepo root):
 *   node scripts/upload-form-config.mjs alimony
 *   node scripts/upload-form-config.mjs divorce
 *   node scripts/upload-form-config.mjs divorce --check   # diff only, no write
 *
 * Reads VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY from apps/client/.env.local.
 * The TS config is transpiled on the fly with esbuild (already a client dev-dep).
 *
 * generation_mode is NOT touched here (same rule as upload-document-template.mjs):
 * flipping a service's renderer is a deliberate separate step.
 */

import { readFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// slug → { TS module under apps/client/src/data, named export }
const CONFIGS = {
  alimony: { file: 'alimonyConfig.ts', exportName: 'alimonyConfig' },
  divorce: { file: 'divorceFormConfig.ts', exportName: 'divorceFormConfig' },
  'alimony-change': { file: 'alimonyChangeFormConfig.ts', exportName: 'alimonyChangeFormConfig' },
};

const slug = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!slug || !CONFIGS[slug]) {
  console.error(`Usage: node scripts/upload-form-config.mjs <${Object.keys(CONFIGS).join('|')}> [--check]`);
  process.exit(1);
}

// ── env ──────────────────────────────────────────────────────────────────────
const envText = readFileSync(join(ROOT, 'apps', 'client', '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envText.split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; }),
);
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in apps/client/.env.local');
  process.exit(1);
}

// ── load the TS SSoT via esbuild ─────────────────────────────────────────────
const require = createRequire(join(ROOT, 'apps', 'client', 'package.json'));
const esbuild = require('esbuild');
const entry = join(ROOT, 'apps', 'client', 'src', 'data', CONFIGS[slug].file);
const outfile = join(mkdtempSync(join(tmpdir(), 'form-config-')), 'config.mjs');
await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile, logLevel: 'silent' });
const config = (await import(pathToFileURL(outfile).href))[CONFIGS[slug].exportName];

// ── shape guard: the TWA (App.tsx) and the admin analyzer both require steps[] ─
if (!config || !Array.isArray(config.steps) || config.steps.length === 0 || !Array.isArray(config.tabs)) {
  console.error('❌ Config shape invalid: expected { service_id, title, tabs[], steps[] } with non-empty steps.');
  process.exit(1);
}
const dupes = config.steps.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) {
  console.error(`❌ Duplicate field ids in config: ${[...new Set(dupes)].join(', ')}`);
  process.exit(1);
}

// ── diff vs live row (visibility before write) ───────────────────────────────
const headers = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};
const getRes = await fetch(
  `${SUPABASE_URL}/rest/v1/services?slug=eq.${encodeURIComponent(slug)}&select=slug,generation_mode,form_config`,
  { headers },
);
const rows = await getRes.json();
if (!getRes.ok || !rows.length) {
  console.error(`❌ Service '${slug}' not found: ${JSON.stringify(rows)}`);
  process.exit(1);
}
const liveIds = (rows[0].form_config?.steps ?? []).map((s) => s.id);
const newIds = config.steps.map((s) => s.id);
const added = newIds.filter((id) => !liveIds.includes(id));
const removed = liveIds.filter((id) => !newIds.includes(id));

console.log(`Service: ${slug} (generation_mode=${rows[0].generation_mode})`);
console.log(`Live form: ${liveIds.length} fields → new form: ${newIds.length} fields`);
if (added.length) console.log(`  + added:   ${added.join(', ')}`);
if (removed.length) console.log(`  - removed: ${removed.join(', ')}`);
if (!added.length && !removed.length) console.log('  (same field ids — labels/options/show_if may still differ)');

if (checkOnly) {
  console.log('--check: no write performed.');
  process.exit(0);
}

// ── upload ───────────────────────────────────────────────────────────────────
const res = await fetch(`${SUPABASE_URL}/rest/v1/services?slug=eq.${encodeURIComponent(slug)}`, {
  method: 'PATCH',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify({ form_config: config }),
});
const data = await res.json();
if (!res.ok) {
  console.error('❌ Error:', JSON.stringify(data));
  process.exit(1);
}
console.log(`✅ ${slug} form_config uploaded (${newIds.length} fields, tabs: ${config.tabs.map((t) => t.label).join(', ')})`);
