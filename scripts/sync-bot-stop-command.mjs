// sync-bot-stop-command.mjs — idempotent patcher for n8n/workflows/current/main-bot.json
//
// IMPROVEMENTS #82: /stop had no handler. It isn't caught by Pre-filter
// (5 chars, not a greeting, not an off-topic keyword) so it flowed to the AI
// Agent and landed on "Send Help" — a confusing reply for a stop intent, plus a
// wasted Groq call.
//
// We have no subscriptions/notifications yet, so /stop is purely an
// acknowledgement: "ok, I'm here whenever you need me". This patcher intercepts
// /stop BEFORE Pre-filter (so it never touches the AI), independent of
// Pre-filter's own classification logic (owned by sync-main-bot-onboarding.mjs /
// sync-offtopic-guard.mjs — left untouched here to avoid a cross-script fight).
//
//   Is Callback?(FALSE) ──▶ Is Stop? ──TRUE──▶ Stop Reply
//                                    └─FALSE──▶ Pre-filter   (unchanged path)
//
// Run AFTER the onboarding patcher (it owns the Is Callback? wiring), then:
//   node scripts/deploy-workflow.mjs main-bot --check
//   node scripts/deploy-workflow.mjs main-bot
//   node scripts/set-bot-commands.mjs            # register /stop in the «/» menu

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WF_FILE = resolve(ROOT, 'n8n/workflows/current/main-bot.json');

const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));
const byName = (name) => wf.nodes.find((n) => n.name === name);

let changed = 0;
const note = (msg) => console.log(msg);

function ensureNode(node) {
  if (byName(node.name)) {
    note(`· node "${node.name}" already present (skip)`);
    return false;
  }
  wf.nodes.push(node);
  note(`✓ added node "${node.name}"`);
  changed++;
  return true;
}

function setConnection(nodeName, def) {
  const before = JSON.stringify(wf.connections[nodeName] ?? null);
  const after = JSON.stringify(def);
  if (before === after) {
    note(`· connections["${nodeName}"] already correct (skip)`);
    return;
  }
  wf.connections[nodeName] = def;
  note(`✓ connections["${nodeName}"] rewired`);
  changed++;
}

// Reuse the bot's Telegram credential from any existing Telegram node.
const tgCred = byName('Pause Reply')?.credentials
  ?? byName('Show Menu')?.credentials
  ?? byName('Send Help')?.credentials;
if (!tgCred) throw new Error('No Telegram node found to copy credentials from');

// ── 1. Is Stop? — match /stop (and /стоп) on a plain message ──────────────────
ensureNode({
  id: 'main-bot-is-stop',
  name: 'Is Stop?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-980, 1860],
  parameters: {
    conditions: {
      options: { caseSensitive: false, typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'is-stop-cond',
          // Normalize._text is the raw message text; /stop@bot is possible in
          // groups, so use startsWith rather than equals.
          leftValue: "={{ ($('Normalize').item.json._text || '').toLowerCase().trim() }}",
          rightValue: '/stop',
          operator: { type: 'string', operation: 'startsWith' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

// ── 2. Stop Reply — polite acknowledgement + the same service shortcuts ────────
ensureNode({
  id: 'main-bot-stop-reply',
  name: 'Stop Reply',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [-760, 1960],
  parameters: {
    chatId: "={{ $('Normalize').item.json._chatId }}",
    text: '=Гаразд 👌 Я завжди тут.\nКоли знадобиться юридичний документ — просто напишіть мені або оберіть послугу нижче 👇',
    replyMarkup: 'inlineKeyboard',
    inlineKeyboard: {
      rows: [
        { row: { buttons: [{ text: '📋 Розлучення та поділ майна', additionalFields: { callback_data: 'confirm_service_1' } }] } },
        { row: { buttons: [{ text: '💰 Стягнення аліментів', additionalFields: { callback_data: 'confirm_service_2' } }] } },
      ],
    },
    additionalFields: { appendAttribution: false, parse_mode: 'Markdown' },
  },
  credentials: tgCred,
});

// ── 3. Rewire: Is Callback?(FALSE) → Is Stop? → {Stop Reply | Pre-filter} ──────
const isCallback = byName('Is Callback?');
if (!isCallback) throw new Error('Is Callback? not found — run sync-main-bot-onboarding.mjs first');

// Preserve Is Callback?'s TRUE branch (Route Callback); redirect FALSE to Is Stop?.
const isCbConn = wf.connections['Is Callback?'];
const trueBranch = isCbConn?.main?.[0] ?? [{ node: 'Route Callback', type: 'main', index: 0 }];
setConnection('Is Callback?', {
  main: [trueBranch, [{ node: 'Is Stop?', type: 'main', index: 0 }]],
});
setConnection('Is Stop?', {
  main: [
    [{ node: 'Stop Reply', type: 'main', index: 0 }],
    [{ node: 'Pre-filter', type: 'main', index: 0 }],
  ],
});
setConnection('Stop Reply', { main: [[]] });

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs main-bot --check');
