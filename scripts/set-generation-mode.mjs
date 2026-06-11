// TEMP (#35): flip services.generation_mode for a slug. Delete after session.
// Usage: node scripts/tmp-flip-mode.mjs <slug> <js|template>
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, createSupabaseClient } from './lib/supabase-rest.mjs';

const [slug, mode] = process.argv.slice(2);
if (!slug || !['js', 'template'].includes(mode)) {
  console.error('Usage: node scripts/tmp-flip-mode.mjs <slug> <js|template>');
  process.exit(1);
}
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(resolve(repoRoot, 'apps/client/.env.local'));
const { sbGet, sbPatch } = createSupabaseClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const before = await sbGet('services', `slug=eq.${slug}&select=slug,generation_mode,document_template`);
if (!before.length) { console.error(`Service "${slug}" not found`); process.exit(1); }
if (mode === 'template' && !before[0].document_template) {
  console.error('Refusing: no document_template stored — upload it first.');
  process.exit(1);
}
await sbPatch('services', `slug=eq.${slug}`, { generation_mode: mode });
const after = await sbGet('services', `slug=eq.${slug}&select=slug,generation_mode`);
console.log(`${slug}: generation_mode ${before[0].generation_mode} → ${after[0].generation_mode}`);
