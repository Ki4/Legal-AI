/**
 * upload-document-checklist.mjs — push a service's required-clause checklist to Supabase.
 *
 * SSoT is the git file n8n/templates/services/<slug>.checklist.json; the DB column
 * services.required_checklist is the runtime copy read by the n8n Build Document
 * node (checklist-validator, issue #4 / IMPROVEMENTS #39). Mirrors
 * upload-document-template.mjs — generic for any service, no per-service script.
 *
 * Usage:
 *   node scripts/upload-document-checklist.mjs <slug> [--dry-run]
 *
 * Idempotent: re-running with an unchanged file is a no-op (deep-equal compare
 * against the stored value before writing).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slug = args.find((a) => !a.startsWith('--'));

if (!slug) {
  console.error('Usage: node scripts/upload-document-checklist.mjs <slug> [--dry-run]');
  process.exit(1);
}

loadEnv(resolve(repoRoot, 'apps/client/.env.local'));
const { sbGet, sbPatch } = createSupabaseClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const checklistPath = resolve(repoRoot, `n8n/templates/services/${slug}.checklist.json`);
let checklist;
try {
  checklist = JSON.parse(readFileSync(checklistPath, 'utf8'));
} catch (e) {
  console.error(`Checklist file not found or invalid JSON: ${checklistPath} (${e.message})`);
  process.exit(1);
}

const rows = await sbGet('services', `slug=eq.${encodeURIComponent(slug)}&select=slug,generation_mode,required_checklist`);
if (!rows.length) {
  console.error(`Service "${slug}" not found in Supabase`);
  process.exit(1);
}
const svc = rows[0];

console.log(`Service: ${svc.slug} (generation_mode=${svc.generation_mode})`);
console.log(`Checklist file: ${checklistPath} (${checklist.items.length} items)`);

const same = JSON.stringify(svc.required_checklist) === JSON.stringify(checklist);
if (same) {
  console.log('DB already has this exact checklist — nothing to do.');
  process.exit(0);
}

console.log(svc.required_checklist && Object.keys(svc.required_checklist).length
  ? `DB checklist differs (${(svc.required_checklist.items || []).length} items stored) — will update.`
  : 'DB has no checklist yet — will set.');

if (dryRun) {
  console.log('[dry-run] no write performed.');
  process.exit(0);
}

await sbPatch('services', `slug=eq.${encodeURIComponent(slug)}`, { required_checklist: checklist });

// verify round-trip
const after = await sbGet('services', `slug=eq.${encodeURIComponent(slug)}&select=required_checklist`);
if (JSON.stringify(after[0].required_checklist) === JSON.stringify(checklist)) {
  console.log('✅ Uploaded and verified (DB === file).');
} else {
  console.error('❌ Verification failed: DB content differs from file after upload.');
  process.exit(1);
}
