/**
 * sync-abstention-node.mjs — patch form-submit.json with the abstention tracking step.
 *
 * What this script does (idempotent):
 *   Adds "Update Case Abstention" Supabase node wired in parallel off Build Document.
 *   The node PATCHes cases.abstained for every processed case:
 *     NULL  = non-hybrid (template / js mode)
 *     false = hybrid, AI reasoning accepted
 *     true  = hybrid, pipeline abstained (RED span or L3 parse error)
 *
 *   Build Document → Update Case Abstention (parallel branch, no downstream)
 *   Build Document → Notify User (main flow, unchanged)
 *
 * Prerequisite: Build Document node must return _case_id and _abstained
 *   (see FOOTER in scripts/sync-build-document-node.mjs).
 *
 * Usage:
 *   node scripts/sync-abstention-node.mjs [--check]
 *     --check   exit 1 if node is missing; exit 0 if in sync
 *
 * Run order:
 *   node scripts/sync-hybrid-nodes.mjs
 *   node scripts/sync-l4b-nodes.mjs
 *   node scripts/sync-build-document-node.mjs
 *   node scripts/sync-abstention-node.mjs       ← this script
 *   node scripts/sync-typography-nodes.mjs
 *   node scripts/deploy-workflow.mjs form-submit
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const wfPath    = resolve(repoRoot, 'n8n/workflows/current/form-submit.json');
const checkOnly = process.argv.includes('--check');

const NODE_NAME = 'Update Case Abstention';

const wfRaw = readFileSync(wfPath, 'utf8');
const wf    = JSON.parse(wfRaw);

// Guard: Build Document must be present.
const buildDocNode = wf.nodes.find(n => n.name === 'Build Document');
if (!buildDocNode) {
  console.error('❌ Build Document node not found. Run sync-build-document-node.mjs first.');
  process.exit(1);
}

// Idempotency check.
const alreadyPatched = wf.nodes.some(n => n.name === NODE_NAME);

if (alreadyPatched) {
  if (checkOnly) {
    console.log(`✅ "${NODE_NAME}" already present — workflow is in sync.`);
    process.exit(0);
  }
  console.log(`✅ "${NODE_NAME}" already present — nothing to do.`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`❌ "${NODE_NAME}" NOT in form-submit.json. Run: node scripts/sync-abstention-node.mjs`);
  process.exit(1);
}

// Reuse Supabase credentials from Insert Case node.
const insertCaseNode = wf.nodes.find(n => n.name === 'Insert Case');
if (!insertCaseNode?.credentials?.supabaseApi) {
  console.error('❌ Cannot find Supabase credentials from Insert Case node.');
  process.exit(1);
}
const supabaseCreds = insertCaseNode.credentials.supabaseApi;

// Place below Build Document (+240 y offset).
const [bx, by] = buildDocNode.position;

const NEW_NODE = {
  id:          'update-case-abstention-001',
  name:        NODE_NAME,
  type:        'n8n-nodes-base.supabase',
  typeVersion: 1,
  position:    [bx, by + 240],
  parameters: {
    operation: 'update',
    tableId:   'cases',
    // Supabase node matches rows via filters.conditions (not a flat `id` field) —
    // see "Get Profile" node for the same pattern. A flat `id` param is silently
    // dropped by n8n's current Supabase node version, leaving filters empty and
    // the update failing with "At least one select condition must be defined".
    filters: {
      conditions: [
        { keyName: 'id', condition: 'eq', keyValue: '={{ $json._case_id }}' },
      ],
    },
    fieldsUi:  {
      fieldValues: [
        { fieldId: 'abstained', fieldValue: '={{ $json._abstained }}' },
      ],
    },
  },
  credentials: { supabaseApi: supabaseCreds },
};

// Add node.
wf.nodes.push(NEW_NODE);

// Wire Build Document → Update Case Abstention (parallel branch alongside Notify User).
const buildConns = wf.connections['Build Document'];
if (!buildConns) {
  wf.connections['Build Document'] = { main: [[{ node: NODE_NAME, type: 'main', index: 0 }]] };
} else {
  // main[0] already has Notify User; push the abstention node alongside it.
  buildConns.main[0].push({ node: NODE_NAME, type: 'main', index: 0 });
}

writeFileSync(wfPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');

console.log(`✅ "${NODE_NAME}" added to form-submit.json:`);
console.log(`   Position: [${NEW_NODE.position}]`);
console.log('   Wired as: Build Document → Update Case Abstention (parallel branch)');
console.log('');
console.log('Next: node scripts/deploy-workflow.mjs form-submit');
