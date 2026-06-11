/**
 * upload-document-template.mjs — push a service's document template to Supabase.
 *
 * SSoT is the git file n8n/templates/services/<slug>.document.txt; the DB column
 * services.document_template is the runtime copy read by the n8n Build Document
 * node (doc-engine, #34). Generic for any service — no per-service one-off
 * scripts (lesson from upload-alimony-config.mjs).
 *
 * Usage:
 *   node scripts/upload-document-template.mjs <slug> [--dry-run]
 *
 * Idempotent: re-running with an unchanged file is a no-op (verified by
 * comparing the stored template before writing). Does NOT touch
 * generation_mode — flipping a service to 'template' is a deliberate separate
 * action (see docs/runbooks/).
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
  console.error('Usage: node scripts/upload-document-template.mjs <slug> [--dry-run]');
  process.exit(1);
}

loadEnv(resolve(repoRoot, 'apps/client/.env.local'));
const { sbGet, sbPatch } = createSupabaseClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const templatePath = resolve(repoRoot, `n8n/templates/services/${slug}.document.txt`);
let template;
try {
  // normalize CRLF defensively — goldens/engine are LF; a CRLF checkout must not
  // poison the DB copy
  template = readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n');
} catch {
  console.error(`Template file not found: ${templatePath}`);
  process.exit(1);
}

const rows = await sbGet('services', `slug=eq.${encodeURIComponent(slug)}&select=slug,generation_mode,document_template`);
if (!rows.length) {
  console.error(`Service "${slug}" not found in Supabase`);
  process.exit(1);
}
const svc = rows[0];

console.log(`Service: ${svc.slug} (generation_mode=${svc.generation_mode})`);
console.log(`Template file: ${templatePath} (${template.length} chars)`);

if (svc.document_template === template) {
  console.log('DB already has this exact template — nothing to do.');
  process.exit(0);
}

console.log(svc.document_template
  ? `DB template differs (${svc.document_template.length} chars stored) — will update.`
  : 'DB has no template yet — will set.');

if (dryRun) {
  console.log('[dry-run] no write performed.');
  process.exit(0);
}

await sbPatch('services', `slug=eq.${encodeURIComponent(slug)}`, { document_template: template });

// verify round-trip
const after = await sbGet('services', `slug=eq.${encodeURIComponent(slug)}&select=document_template`);
if (after[0].document_template === template) {
  console.log('✅ Uploaded and verified (DB === file).');
} else {
  console.error('❌ Verification failed: DB content differs from file after upload.');
  process.exit(1);
}
