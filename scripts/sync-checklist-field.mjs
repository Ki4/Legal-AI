/**
 * sync-checklist-field.mjs — patch form-submit.json to persist checklist results.
 *
 * What this script does (idempotent):
 *   Adds a `checklist_failed` field to the EXISTING "Update Case Abstention"
 *   Supabase node (scripts/sync-abstention-node.mjs) instead of adding a new
 *   node — that node already PATCHes `cases` for every processed case
 *   (parallel branch off Build Document), one more boolean field doesn't
 *   earn a whole new Supabase node.
 *     NULL  = no checklist configured for this service (required_checklist empty)
 *     false = checklist configured, all applicable items satisfied
 *     true  = checklist configured, at least one applicable item missing (#39)
 *
 * Prerequisite: "Update Case Abstention" node must exist (sync-abstention-node.mjs)
 *   and Build Document must return _checklist_result (sync-build-document-node.mjs).
 *
 * Usage:
 *   node scripts/sync-checklist-field.mjs [--check]
 *     --check   exit 1 if the field is missing; exit 0 if in sync
 *
 * Run order:
 *   node scripts/sync-build-document-node.mjs
 *   node scripts/sync-abstention-node.mjs
 *   node scripts/sync-checklist-field.mjs       ← this script
 *   node scripts/deploy-workflow.mjs form-submit
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const wfPath    = resolve(repoRoot, 'n8n/workflows/current/form-submit.json');
const checkOnly = process.argv.includes('--check');

const NODE_NAME  = 'Update Case Abstention';
const FIELD_ID   = 'checklist_failed';

const wfRaw = readFileSync(wfPath, 'utf8');
const wf    = JSON.parse(wfRaw);

const node = wf.nodes.find(n => n.name === NODE_NAME);
if (!node) {
  console.error(`❌ "${NODE_NAME}" node not found. Run sync-abstention-node.mjs first.`);
  process.exit(1);
}

const fieldValues = node.parameters?.fieldsUi?.fieldValues;
if (!Array.isArray(fieldValues)) {
  console.error(`❌ "${NODE_NAME}" has no fieldsUi.fieldValues array — unexpected node shape.`);
  process.exit(1);
}

const alreadyPatched = fieldValues.some(f => f.fieldId === FIELD_ID);

if (alreadyPatched) {
  console.log(`✅ "${FIELD_ID}" field already present on "${NODE_NAME}" — nothing to do.`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`❌ "${FIELD_ID}" field NOT on "${NODE_NAME}". Run: node scripts/sync-checklist-field.mjs`);
  process.exit(1);
}

fieldValues.push({ fieldId: FIELD_ID, fieldValue: '={{ $json._checklist_result?.ok === false }}' });

writeFileSync(wfPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');

console.log(`✅ "${FIELD_ID}" field added to "${NODE_NAME}".`);
console.log('Next: node scripts/deploy-workflow.mjs form-submit');
