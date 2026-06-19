// sync-bot-ux-polish.mjs — idempotent patcher for n8n/workflows/current/main-bot.json
//
// "Bot UX polish" bundle (feature/bot-ux-polish). Makes the Telegram dispatcher
// feel like a smooth app instead of a request/response form. Built in layers;
// this file accumulates all main-bot changes for the feature. Each step is
// idempotent (safe to re-run) and additive where possible.
//
//   LAYER 1 — "alive":
//     1a. answerCallbackQuery on every inline-button tap. Today NOTHING answers
//         the callback query, so Telegram shows a spinning clock on the button
//         until it times out (~the button looks stuck). A native Telegram
//         `callback → answerQuery` node, fired first thing on the callback path,
//         clears the spinner instantly and shows a soft toast (show_alert=false).
//     1b. `sendChatAction: typing` before the AI dispatcher runs, so the user
//         sees "печатает…" during the 1-3s Groq classification instead of silence.
//
// Native Telegram-node operations only (callback/answerQuery, chat/sendChatAction)
// → reuse the existing Telegram credential, no bot-token plumbing, no new secret.
//
// Run, then:
//   node scripts/deploy-workflow.mjs main-bot --check   # review node diff
//   node scripts/deploy-workflow.mjs main-bot           # deploy + activate

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WF_FILE = resolve(ROOT, 'n8n/workflows/current/main-bot.json');

const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));

const TG_CRED = wf.nodes.find(
  (n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi,
)?.credentials?.telegramApi || { id: 'YPiMlLjRRAznPhvZ', name: 'Telegram account' };

let changed = 0;

function getNode(name) {
  return wf.nodes.find((n) => n.name === name);
}
function ensureNode(node) {
  if (wf.nodes.some((n) => n.name === node.name)) {
    console.log(`· node "${node.name}" already present (skip)`);
    return false;
  }
  wf.nodes.push(node);
  console.log(`✓ added node "${node.name}"`);
  changed++;
  return true;
}
function setConn(from, conns) {
  const before = JSON.stringify(wf.connections[from]);
  if (before !== JSON.stringify(conns)) {
    wf.connections[from] = conns;
    changed++;
    console.log(`✓ rewired "${from}"`);
  } else {
    console.log(`· "${from}" wiring unchanged (skip)`);
  }
}
const to = (node) => [[{ node, type: 'main', index: 0 }]];

// ── 1a-prep: Normalize must expose the callback_query id for answerQuery ──────
const normalize = getNode('Normalize');
if (normalize && !normalize.parameters.jsCode.includes('_callbackId')) {
  normalize.parameters.jsCode = normalize.parameters.jsCode.replace(
    "_type:       cb ? 'callback_query'           : 'message'",
    "_type:       cb ? 'callback_query'           : 'message',\n    _callbackId: cb ? cb.id                      : null",
  );
  console.log('✓ Normalize now exposes _callbackId');
  changed++;
} else {
  console.log('· Normalize already exposes _callbackId (skip)');
}

// ── 1a: Answer Callback (clears spinner + soft toast) ─────────────────────────
// Placed at the very start of the callback branch: Is Callback?(TRUE) → Answer
// Callback → Route Callback. Route Callback reads $('Normalize') directly, so it
// doesn't matter that the Telegram node replaces $json with the API response.
ensureNode({
  id: 'main-bot-answer-callback',
  name: 'Answer Callback',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [-980, 1560],
  parameters: {
    resource: 'callback',
    operation: 'answerQuery',
    queryId: "={{ $('Normalize').item.json._callbackId }}",
    additionalFields: { text: 'Гаразд ✍️' },
  },
  credentials: { telegramApi: TG_CRED },
});

// ── 1b: Send Typing (chat action during AI dispatch) ──────────────────────────
// The AI Agent reads `$json._text` today, which breaks if a Telegram node sits
// in front of it (its API response replaces $json). Repoint the agent at the
// stable Pre-filter reference first, then we can safely chain Typing → AI Agent.
const aiAgent = getNode('AI Agent');
if (aiAgent && aiAgent.parameters.text !== "={{ $('Pre-filter').item.json._text }}") {
  aiAgent.parameters.text = "={{ $('Pre-filter').item.json._text }}";
  console.log('✓ AI Agent text → stable $(\'Pre-filter\') reference');
  changed++;
} else {
  console.log('· AI Agent text already stable (skip)');
}

ensureNode({
  id: 'main-bot-send-typing',
  name: 'Send Typing',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [-700, 2060],
  parameters: {
    resource: 'chat',
    operation: 'sendChatAction',
    chatId: "={{ $('Normalize').item.json._chatId }}",
    action: 'typing',
  },
  credentials: { telegramApi: TG_CRED },
});

// ── rewire: insert the two new nodes into their paths ─────────────────────────
// Callback path: Is Callback?(TRUE) → Answer Callback → Route Callback
setConn('Is Callback?', {
  main: [
    [{ node: 'Answer Callback', type: 'main', index: 0 }],
    [{ node: 'Pre-filter', type: 'main', index: 0 }],
  ],
});
setConn('Answer Callback', { main: to('Route Callback') });

// AI path: Skip AI?(FALSE) → Send Typing → AI Agent
setConn('Skip AI?', {
  main: [
    [{ node: 'Show Menu', type: 'main', index: 0 }],
    [{ node: 'Send Typing', type: 'main', index: 0 }],
  ],
});
setConn('Send Typing', { main: to('AI Agent') });

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs main-bot --check');
