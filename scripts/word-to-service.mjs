#!/usr/bin/env node
/**
 * word-to-service — the Word→service bridge (PoC, issue: Word-as-authoring-core).
 *
 * Turns ONE lawyer-authored Word template (+ its metadata blob) into a `services` row.
 * The MCP tool then appears BY ITSELF on the next server start — registry.ts synthesizes
 * `generate_<slug>_document` from the row and derives its input schema from form_config.
 * Nothing about the tool is hand-written; that is the whole point the PoC proves.
 *
 * Usage (from monorepo root):
 *   node scripts/word-to-service.mjs alimony-poc            # run gates + upsert
 *   node scripts/word-to-service.mjs alimony-poc --check    # gates only, no write
 *
 * Reads VITE_SUPABASE_URL / SUPABASE_SERVICE_KEY from apps/client/.env.local.
 *
 * Deliberate PoC boundaries:
 * - The row lands as status='needs_review' → the tool is LISTED (bridge proven) but generate
 *   returns the existing structured refusal instead of engine A trying to parse a .docx it
 *   cannot read. Rendering is proven separately by engine B (see verify-render.py).
 * - document_template stays NULL: the .docx lives in git, not the DB. Engine A never touches
 *   it (status gate short-circuits first), and engine B renders from disk.
 *
 * Reuse note (why the template half of serviceAnatomy is NOT used):
 *   analyzeTemplate/diffFormVsTemplate model engine A — Handlebars syntax plus engine A's
 *   computed layer (PROVIDED_CONTEXT/DERIVED_SOURCES, e.g. `ai.plaintiff_genitive`). A docxtpl
 *   template has different syntax AND a different computed layer (`birth_date_words`,
 *   `plaintiff_genitive`), so feeding those refs through engine A's checks would mark every
 *   engine-B computed key dead. We therefore reuse the two functions that ARE engine-agnostic —
 *   collectDeadRefs (bare-field-ref class) and collectBrokenShowIf — and derive engine B's
 *   computed layer in doc_engine/extract.py, which is its real owner.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createSupabaseClient, loadEnv } from './lib/supabase-rest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE_DIR = join(ROOT, 'apps', 'doc-engine', 'templates');
const DOC_ENGINE_SRC = join(ROOT, 'apps', 'doc-engine', 'src');

/** Guards drive document branching, so the interview must be able to ask them outright. */
const GUARD_TYPES = new Set(['boolean', 'choice']);

const name = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!name) {
  console.error('Usage: node scripts/word-to-service.mjs <template-name> [--check]');
  console.error('  e.g. node scripts/word-to-service.mjs alimony-poc');
  process.exit(1);
}

const templatePath = join(TEMPLATE_DIR, `${name}.docx`);
if (!existsSync(templatePath)) {
  console.error(`❌ Template not found: ${templatePath}`);
  process.exit(1);
}

const fail = (msg, detail) => {
  console.error(`\n❌ ${msg}`);
  if (detail) console.error(detail);
  process.exit(1);
};

// ── 1. extract: Word template + metadata blob → raw material ─────────────────
let extracted;
try {
  const stdout = execFileSync('python', ['-m', 'doc_engine.extract', templatePath], {
    env: { ...process.env, PYTHONPATH: DOC_ENGINE_SRC, PYTHONIOENCODING: 'utf-8' },
    encoding: 'utf-8',
    cwd: ROOT,
  });
  extracted = JSON.parse(stdout);
} catch (err) {
  fail('extract failed — is python + docxtpl available?', err.stderr || err.message);
}

const { variables, guards, derived, metadata } = extracted;
const { service, tabs, fields } = metadata;
const slug = service.slug;

// ── 2. assemble the FormConfig (apps/client/src/types/form.ts) ───────────────
const form = {
  service_id: slug,
  title: service.title,
  ...(service.subtitle ? { subtitle: service.subtitle } : {}),
  tabs,
  steps: fields,
};

// ── load the TS gates (esbuild resolves the .js-style imports to .ts) ────────
const require = createRequire(join(ROOT, 'apps', 'client', 'package.json'));
const esbuild = require('esbuild');
const outdir = mkdtempSync(join(tmpdir(), 'word-to-service-'));

async function loadTs(entry, outname) {
  const outfile = join(outdir, outname);
  await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile, logLevel: 'silent' });
  return import(pathToFileURL(outfile).href);
}

const { formConfigToJsonSchema } = await loadTs(
  join(ROOT, 'apps', 'mcp-server', 'src', 'form-schema.ts'), 'form-schema.mjs',
);
const { collectDeadRefs, collectBrokenShowIf } = await loadTs(
  join(ROOT, 'apps', 'client', 'src', 'lib', 'serviceAnatomy.ts'), 'service-anatomy.mjs',
);

console.log(`\nTemplate: ${extracted.template}  →  service '${slug}'`);

// ── Gate 1/4: shape (same guards upload-form-config.mjs enforces) ────────────
if (!Array.isArray(form.steps) || form.steps.length === 0 || !Array.isArray(form.tabs) || form.tabs.length === 0) {
  fail('Gate 1 shape: expected { service_id, title, tabs[], steps[] } with non-empty steps and tabs.');
}
const dupes = form.steps.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dupes.length) fail(`Gate 1 shape: duplicate field ids: ${[...new Set(dupes)].join(', ')}`);
const tabIds = new Set(form.tabs.map((t) => t.id));
const orphanTabs = form.steps.filter((s) => !tabIds.has(s.tab)).map((s) => `${s.id}→${s.tab}`);
if (orphanTabs.length) fail(`Gate 1 shape: fields point at unknown tabs: ${orphanTabs.join(', ')}`);
console.log(`Gate 1/4  shape ......... OK (${form.steps.length} fields, ${form.tabs.length} tabs)`);

// ── Gate 2/4: coverage — every template ref must be fillable ─────────────────
const fieldIds = new Set(form.steps.map((s) => s.id));
const usedDerived = variables.filter((v) => derived[v]);
const bareRefs = variables.filter((v) => !derived[v]);

// class 1 (bare ref with no form field) — reused verbatim from the publish gate
const deadRefs = collectDeadRefs(form, {
  referencedPaths: variables,
  fieldRefs: bareRefs,
  eachPaths: [],
  computedRefs: [], // engine A's computed layer does not apply to a docxtpl template
  citations: [],
  hasTemplate: true,
});
if (deadRefs.length) {
  fail(
    'Gate 2 coverage: the template references data the form never asks — every generated document would print «________» there.',
    deadRefs.map((d) => `   • {{ ${d.ref} }} — ${d.kind}`).join('\n'),
  );
}

// engine-B computed keys must have their source fields on THIS form
const missingSources = usedDerived
  .map((key) => ({ key, missing: derived[key].filter((s) => !fieldIds.has(s)) }))
  .filter((x) => x.missing.length);
if (missingSources.length) {
  fail(
    'Gate 2 coverage: computed values have no source fields on the form.',
    missingSources.map((x) => `   • {{ ${x.key} }} needs ${x.missing.join(', ')}`).join('\n'),
  );
}

const brokenShowIf = collectBrokenShowIf(form);
if (brokenShowIf.length) {
  fail(`Gate 2 coverage: show_if points at fields that do not exist: ${brokenShowIf.join(', ')}`);
}

// warn-only: fields the document never uses (directly or as a computed source)
const usedIds = new Set(bareRefs.filter((r) => fieldIds.has(r)));
for (const key of usedDerived) for (const s of derived[key]) usedIds.add(s);
const unused = [...fieldIds].filter((id) => !usedIds.has(id));
console.log(
  `Gate 2/4  coverage ...... OK (${variables.length} refs: ${bareRefs.length} fields + ${usedDerived.length} computed)`,
);
if (unused.length) console.log(`          ⚠ fields the document never uses: ${unused.join(', ')}`);

// ── Gate 3/4: every {% if %} guard must be an askable field ──────────────────
const byId = new Map(form.steps.map((s) => [s.id, s]));
const badGuards = guards
  .filter((g) => !derived[g])
  .map((g) => ({ g, f: byId.get(g) }))
  .filter(({ f }) => !f || !GUARD_TYPES.has(f.type));
if (badGuards.length) {
  fail(
    'Gate 3 guards: {% if %} branches on data the interview cannot ask as a plain question.',
    badGuards
      .map(({ g, f }) => `   • {% if ${g} %} — ${f ? `type '${f.type}', expected boolean|choice` : 'no such form field'}`)
      .join('\n'),
  );
}
console.log(
  `Gate 3/4  guards ........ OK (${guards.map((g) => `${g}:${byId.get(g)?.type}`).join(', ') || 'none'})`,
);

// ── Gate 4/4: the MCP tool schema must build ────────────────────────────────
let schema;
try {
  schema = formConfigToJsonSchema(form);
} catch (err) {
  fail('Gate 4 schema: form_config cannot become an MCP tool inputSchema.', `   ${err.message}`);
}
const toolName = `generate_${slug.replace(/-/g, '_')}_document`;
console.log(
  `Gate 4/4  schema ........ OK (tool: ${toolName}, ${Object.keys(schema.properties).length} params, ${schema.required.length} required)`,
);

if (checkOnly) {
  console.log('\n--check: all gates passed, no write performed.');
  process.exit(0);
}

// ── upsert the services row ─────────────────────────────────────────────────
loadEnv(join(ROOT, 'apps', 'client', '.env.local'));
const { sbGet, sbInsert, sbPatch } = createSupabaseClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const existing = await sbGet('services', `slug=eq.${encodeURIComponent(slug)}&select=id,slug,status`);
const row = {
  slug,
  title: service.title,
  description: service.description,
  form_config: form,
  category: service.category,
  icon: service.icon,
  price: service.price ?? 0,
  generation_mode: 'template',
  // PoC stays behind the kill-switch: the tool is listed, generation refuses (engine A
  // cannot render a .docx). Flipping to 'active' is a deliberate separate step.
  status: 'needs_review',
  document_template: null,
};

if (existing.length) {
  await sbPatch('services', `slug=eq.${encodeURIComponent(slug)}`, row);
  console.log(`\n✅ updated service '${slug}' (id=${existing[0].id}, status=${row.status})`);
} else {
  // lawyer_id is NOT NULL on the live table — inherit it from an existing service row.
  const [donor] = await sbGet('services', 'select=lawyer_id&lawyer_id=not.is.null&limit=1');
  if (donor?.lawyer_id) row.lawyer_id = donor.lawyer_id;
  const [created] = await sbInsert('services', row);
  console.log(`\n✅ created service '${slug}' (id=${created.id}, status=${row.status})`);
}
console.log(`   Restart the MCP server → '${toolName}' appears in list_services.`);
