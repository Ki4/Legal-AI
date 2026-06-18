// sync-main-bot-fixes.mjs — idempotent patcher for n8n/workflows/current/main-bot.json
//
// Applies the issue #55 fixes to the Telegram dispatcher workflow:
//   G1 — Error Trigger → Format Error → Send Admin Alert (mirror of form-submit;
//        main-bot had NO error visibility, so failures like the web_app button
//        bug below were silent for both user and admin).
//   G2 — Fix "Send TWA Button": the inline-keyboard button used `webAppUrl`,
//        a field name from an OLDER n8n Telegram node. n8n 2.20.6 expects a
//        `web_app: { url }` collection (verified in the node source). The stale
//        field was dropped → Telegram 400 "Text buttons are unallowed".
//
// Idempotent: safe to run repeatedly. Run, then:
//   node scripts/deploy-workflow.mjs main-bot --check   # review node diff
//   node scripts/deploy-workflow.mjs main-bot           # deploy + activate

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WF_FILE = resolve(ROOT, 'n8n/workflows/current/main-bot.json');

const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));

// Telegram credential id used by every other Telegram node in this workflow.
// (deploy-workflow.mjs rebinds by node name / type-fallback from live anyway.)
const TG_CRED = wf.nodes.find(
  (n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi,
)?.credentials?.telegramApi || { id: 'YPiMlLjRRAznPhvZ', name: 'Telegram account' };

const ADMIN_CHAT_ID = '236581343';

// Canonical TWA production domain. Vercel auto-assigned `legal-twa-xi` (the bare
// `legal-twa.vercel.app` 404s — base name taken). Keep the launch URL in ONE
// place so a future domain change is a one-line edit. See IMPROVEMENTS (TWA base
// URL should ideally come from config, not be hardcoded in the workflow).
const TWA_BASE_URL = 'https://legal-twa-xi.vercel.app';
const TWA_LAUNCH_URL =
  `=${TWA_BASE_URL}/?service={{ $json.slug }}&uid={{ $('Normalize').item.json._userId }}`;

let changed = 0;

// ── G2: fix Send TWA Button web_app field + canonical launch URL ─────────────
const twa = wf.nodes.find((n) => n.name === 'Send TWA Button');
if (twa) {
  const btn = twa.parameters?.inlineKeyboard?.rows?.[0]?.row?.buttons?.[0];
  if (btn) {
    // Migrate stale `webAppUrl` (old n8n field name) → `web_app: { url }`, and
    // always reset the URL to the canonical domain (idempotent).
    const before = JSON.stringify(btn.additionalFields);
    btn.additionalFields = { web_app: { url: TWA_LAUNCH_URL } };
    if (JSON.stringify(btn.additionalFields) !== before) {
      console.log('✓ G2: Send TWA Button → web_app.url =', TWA_BASE_URL);
      changed++;
    } else {
      console.log('· G2: Send TWA Button already canonical (skip)');
    }
  } else {
    console.log('⚠ G2: Send TWA Button button shape unexpected — inspect manually');
  }
}

// ── G1: Error Trigger → Format Error → Send Admin Alert ──────────────────────
function ensureNode(node) {
  if (wf.nodes.some((n) => n.name === node.name)) {
    console.log(`· G1: node "${node.name}" already present (skip)`);
    return false;
  }
  wf.nodes.push(node);
  console.log(`✓ G1: added node "${node.name}"`);
  changed++;
  return true;
}

ensureNode({
  id: 'main-bot-error-trigger',
  name: 'Error Trigger',
  type: 'n8n-nodes-base.errorTrigger',
  typeVersion: 1,
  position: [-2000, 2480],
  parameters: {},
});

ensureNode({
  id: 'main-bot-format-error',
  name: 'Format Error',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-1780, 2480],
  parameters: {
    jsCode:
      "// Build an admin alert from the Error Trigger payload (main-bot dispatcher).\n" +
      "// Mirror of n8n/templates/format-error.js.\n" +
      "function formatError(payload) {\n" +
      "  const p = payload || {};\n" +
      "  const exec = p.execution || {};\n" +
      "  const wf = p.workflow || {};\n" +
      "  const err = exec.error || p.error || {};\n" +
      "  const lines = [\n" +
      "    '⚠️ Bot error: ' + (wf.name || 'Legal AI Bot'),\n" +
      "    'Node: ' + (exec.lastNodeExecuted || 'unknown'),\n" +
      "    'Error: ' + (err.message || 'unknown error'),\n" +
      "    'Exec: ' + (exec.id || '—'),\n" +
      "    'Time: ' + new Date().toISOString(),\n" +
      "  ];\n" +
      "  if (exec.url) lines.push(exec.url);\n" +
      "  return lines.join('\\n');\n" +
      "}\n" +
      "return [{ json: { text: formatError($json) } }];",
  },
});

ensureNode({
  id: 'main-bot-send-admin-alert',
  name: 'Send Admin Alert',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [-1560, 2480],
  parameters: {
    chatId: ADMIN_CHAT_ID,
    text: '={{ $json.text }}',
    additionalFields: { appendAttribution: false },
  },
  credentials: { telegramApi: TG_CRED },
});

// connections for the error chain (idempotent assignment)
wf.connections['Error Trigger'] = {
  main: [[{ node: 'Format Error', type: 'main', index: 0 }]],
};
wf.connections['Format Error'] = {
  main: [[{ node: 'Send Admin Alert', type: 'main', index: 0 }]],
};

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs main-bot --check');
