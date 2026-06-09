// deploy-workflow.mjs — push a repo workflow JSON to the live n8n via REST API.
//
// WHY: the repo JSON keeps placeholders in the Global Config node (never commit
// secrets). This script injects the real keys from apps/client/.env.local
// IN MEMORY and PUTs the workflow, so the "restore keys by hand" trap disappears.
//
// SAFETY:
//   1. GET the current live workflow first and write a backup to a gitignored dir
//      (the live Global Config holds real keys, so the backup must stay untracked).
//   2. Diff node names (live vs repo) and print, so we never silently clobber
//      live-only nodes.
//   3. Only then PUT. Pass --check to stop after the diff (no write).
//
// Usage:
//   node scripts/deploy-workflow.mjs            # backup + diff + deploy + activate
//   node scripts/deploy-workflow.mjs --check    # backup + diff only (no write)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const WORKFLOW_ID = 'D2ab06X3pVUWk1py';
const WORKFLOW_FILE = resolve(ROOT, 'n8n/workflows/current/form-submit.json');
const ENV_FILE = resolve(ROOT, 'apps/client/.env.local');
const N8N_BASE = process.env.N8N_BASE_URL || 'http://localhost:5678';
const BACKUP_DIR = resolve(ROOT, 'n8n/workflows/.backups');

const CHECK_ONLY = process.argv.includes('--check');
// Credential IDs are environment-specific and must NOT come from the repo JSON.
// By default we preserve the live workflow's credential bindings (mapped by node
// name). --creds-from=<file> overrides the source (used for recovery when the
// live workflow's bindings were already clobbered — point it at a good backup).
const CREDS_FROM = (process.argv.find((a) => a.startsWith('--creds-from=')) || '').split('=')[1];

// --- minimal .env parser (KEY=VALUE, ignores comments/blank) -----------------
function loadEnv(path) {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

// Placeholders in the repo Global Config node -> env var holding the real value.
const KEY_MAP = {
  YOUR_SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_KEY',
  YOUR_ENCRYPTION_KEY_64_HEX: 'ENCRYPTION_KEY',
};

async function api(method, path, body) {
  const res = await fetch(`${N8N_BASE}/api/v1${path}`, {
    method,
    headers: {
      'X-N8N-API-KEY': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// --- load secrets ------------------------------------------------------------
const env = loadEnv(ENV_FILE);
const API_KEY = env.N8N_API_KEY;
if (!API_KEY) {
  console.error('✗ N8N_API_KEY not found in', ENV_FILE);
  process.exit(1);
}

console.log(`→ n8n: ${N8N_BASE}  workflow: ${WORKFLOW_ID}`);

// --- 1. backup live ----------------------------------------------------------
const live = await api('GET', `/workflows/${WORKFLOW_ID}`);
mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = resolve(BACKUP_DIR, `form-submit.live-${stamp}.json`);
writeFileSync(backupPath, JSON.stringify(live, null, 2), 'utf8');
console.log(`✓ live backup -> ${backupPath} (gitignored)`);

// --- 2. diff node names ------------------------------------------------------
const repo = JSON.parse(readFileSync(WORKFLOW_FILE, 'utf8'));
const liveNames = new Set(live.nodes.map((n) => n.name));
const repoNames = new Set(repo.nodes.map((n) => n.name));
const added = [...repoNames].filter((n) => !liveNames.has(n));
const removed = [...liveNames].filter((n) => !repoNames.has(n));

console.log(`\nNodes: live=${live.nodes.length}  repo=${repo.nodes.length}`);
console.log('  + added by deploy :', added.length ? added.join(', ') : '(none)');
console.log('  - removed (live-only!):', removed.length ? removed.join(', ') : '(none)');
if (removed.length) {
  console.log('\n⚠️  Live has nodes NOT in repo — they would be LOST. Review backup before deploying.');
}

if (CHECK_ONLY) {
  console.log('\n--check: stopping before write. Backup + diff done.');
  process.exit(0);
}

// --- 3. preserve credential bindings (env-specific, never from repo JSON) ----
const credSource = CREDS_FROM
  ? JSON.parse(readFileSync(resolve(ROOT, CREDS_FROM), 'utf8'))
  : live;
const liveCreds = new Map(
  credSource.nodes.filter((n) => n.credentials).map((n) => [n.name, n.credentials]),
);
for (const n of repo.nodes) {
  if (liveCreds.has(n.name)) n.credentials = liveCreds.get(n.name);
}
console.log(`✓ preserved credentials from ${CREDS_FROM || 'live'} for ${liveCreds.size} nodes`);

// --- 4. inject real keys into Global Config (in memory only) -----------------
const gc = repo.nodes.find((n) => n.name === 'Global Config');
if (!gc) throw new Error('Global Config node not found in repo JSON');
let code = gc.parameters.jsCode;
for (const [placeholder, envKey] of Object.entries(KEY_MAP)) {
  if (!code.includes(placeholder)) continue;
  const val = env[envKey];
  if (!val) throw new Error(`Env ${envKey} missing for placeholder ${placeholder}`);
  code = code.split(placeholder).join(val);
}
if (code.includes('YOUR_')) throw new Error('A YOUR_ placeholder remains unresolved in Global Config');
gc.parameters.jsCode = code;

// --- 4. PUT (public API accepts name/nodes/connections/settings only) --------
const payload = {
  name: repo.name,
  nodes: repo.nodes,
  connections: repo.connections,
  settings: repo.settings ?? {},
};
await api('PUT', `/workflows/${WORKFLOW_ID}`, payload);
console.log('✓ workflow updated (G2 guard nodes deployed)');

// --- 5. ensure active --------------------------------------------------------
await api('POST', `/workflows/${WORKFLOW_ID}/activate`);
console.log('✓ workflow active');
console.log('\nDone. Verify: node scripts/test-webhook.mjs 2');
