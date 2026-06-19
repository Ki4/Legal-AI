// sync-form-submit-ux.mjs — idempotent patcher for n8n/workflows/current/form-submit.json
//
// "Bot UX polish" bundle (feature/bot-ux-polish) — chat-facing part of form-submit.
//
// Design (revised after live UX review with Sergey + Gemini notes):
//   - ONE message that morphs in place (no second trailing message, no progress
//     bar — both read as abrupt/ugly). The initial ⏳ "Notify User" message is
//     edited through a single light working step and then into a final result
//     CARD with inline buttons. End state = exactly one clean message.
//       Notify User : "⏳ Готую ваш документ…"   (sendMessage)
//       Progress    : "📝 Формую документ…"       (editMessageText, fan-out leaf)
//       Send Doc Link: ✅ result card + buttons    (editMessageText of the SAME msg)
//   - Working states share a 2-line shape (status line + constant 📋 title) so the
//     bubble keeps its height — no vertical "jump". The final card is a deliberate
//     reshape (the payoff), which is expected, not a mid-progress snap.
//   - Final card: [📄 Відкрити документ](url) + [➕ Новий документ](callback show_menu,
//     handled by main-bot). Case ID de-emphasised (small italic at the bottom).
//   - No PDF button yet — doc is a Google Doc, user saves as they like. Revisit
//     with document styling + export formats: IMPROVEMENTS #77.
//
// Telegram has NO fade/animation on edits (instant content swap) — minimising the
// number and size of swaps is the only lever, hence one light step + final morph.
//
// Run, then:
//   node scripts/deploy-workflow.mjs form-submit --check
//   node scripts/deploy-workflow.mjs form-submit

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WF_FILE = resolve(ROOT, 'n8n/workflows/current/form-submit.json');

const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));

const TG_CRED = wf.nodes.find(
  (n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi,
)?.credentials?.telegramApi || { id: 'YPiMlLjRRAznPhvZ', name: 'Telegram account' };

const USER_ID_REF = "={{ $('Validate').item.json._user_id }}";
const MSG_ID_REF = "={{ $('Notify User').item.json.result.message_id }}";
const DOC_URL_REF = "={{ $('Build Replace Request').item.json._new_doc_url }}";
const TITLE_EXPR = "{{ $('Get Service').item.json.title }}";
const CASE_ID_EXPR = "{{ $('Insert Case').item.json.id }}";

let changed = 0;
const getNode = (name) => wf.nodes.find((n) => n.name === name);

// Working-state message: status line + constant 📋 title → constant 2-line height.
const working = (statusLine) => '=' + statusLine + '\n📋 ' + TITLE_EXPR;

// ── L3: single working-step edit leaf (idempotent — reconciles text + format) ─
function editLeaf(id, name, position, text) {
  let node = getNode(name);
  if (!node) {
    node = {
      id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position,
      onError: 'continueRegularOutput',
      parameters: {
        resource: 'message', operation: 'editMessageText', messageType: 'message',
        chatId: USER_ID_REF, messageId: MSG_ID_REF, text: '', additionalFields: {},
      },
      credentials: { telegramApi: TG_CRED },
    };
    wf.nodes.push(node);
    console.log(`✓ added progress leaf "${name}"`);
    changed++;
  }
  const desiredAF = { appendAttribution: false, parse_mode: 'HTML' };
  const p = node.parameters;
  if (p.text !== text || JSON.stringify(p.additionalFields) !== JSON.stringify(desiredAF)) {
    p.text = text;
    p.additionalFields = desiredAF;
    node.onError = 'continueRegularOutput';
    console.log(`✓ progress leaf "${name}" text/format reconciled`);
    changed++;
  } else {
    console.log(`· progress leaf "${name}" up to date (skip)`);
  }
}

// Fan-out a leaf off a node's SUCCESS output (out0), preserving out1 (#59 error).
function fanOut(fromNode, leafName) {
  const c = wf.connections[fromNode];
  if (!c?.main?.[0]) { console.log(`⚠ ${fromNode}: unexpected shape`); return; }
  if (c.main[0].some((x) => x.node === leafName)) {
    console.log(`· ${fromNode} → ${leafName} already fanned (skip)`);
    return;
  }
  c.main[0].push({ node: leafName, type: 'main', index: 0 });
  console.log(`✓ fan-out ${fromNode} → ${leafName}`);
  changed++;
}

// Remove a node + any fan-out edges pointing at it (used to retire the old
// multi-step progress bar — replaced by the single step + final card morph).
function removeNode(name, fanFrom) {
  const idx = wf.nodes.findIndex((n) => n.name === name);
  if (idx >= 0) { wf.nodes.splice(idx, 1); changed++; console.log(`✓ removed node "${name}"`); }
  for (const f of fanFrom) {
    const c = wf.connections[f];
    if (c?.main?.[0]) {
      const before = c.main[0].length;
      c.main[0] = c.main[0].filter((x) => x.node !== name);
      if (c.main[0].length !== before) { changed++; console.log(`✓ un-fanned ${f} → ${name}`); }
    }
  }
  if (wf.connections[name]) { delete wf.connections[name]; changed++; }
}

// ── single working step ───────────────────────────────────────────────────────
editLeaf('fs-progress-1', 'Progress: Building', [3040, 1340], working('📝 Формую документ…'));
fanOut('Copy Template', 'Progress: Building');

// retire the old 2nd/3rd progress-bar steps (now a single step + final card)
removeNode('Progress: Finalizing', ['Apply Typography']);
removeNode('Progress: Ready', ['Share Document']);

// ── initial "Notify User" — first working state (same 2-line shape) ───────────
const notify = getNode('Notify User');
if (notify) {
  const desiredText = working('⏳ Готую ваш документ…');
  if (notify.parameters.text !== desiredText || notify.parameters.additionalFields?.parse_mode !== 'HTML') {
    notify.parameters.text = desiredText;
    notify.parameters.additionalFields = { ...(notify.parameters.additionalFields || {}), parse_mode: 'HTML' };
    console.log('✓ Notify User → clean ⏳ working state (HTML)');
    changed++;
  } else {
    console.log('· Notify User already updated (skip)');
  }
}

// ── final "Send Doc Link" — MORPH the same message into the result card ───────
const docLink = getNode('Send Doc Link');
if (docLink) {
  // No case ID on the happy path — when everything worked the UUID is just
  // noise; support can find the case by the user's Telegram id. The ID is shown
  // (prominent + copyable) only on the failure card, where it's actually needed.
  const finalText =
    '=✅ <b>Документ готовий!</b>\n' +
    '📋 ' + TITLE_EXPR + '\n\n' +
    'Відкрийте, перевірте та збережіть у зручному форматі (Файл → Завантажити).';
  const desired = {
    resource: 'message',
    operation: 'editMessageText',
    messageType: 'message',
    chatId: USER_ID_REF,
    messageId: MSG_ID_REF,
    text: finalText,
    replyMarkup: 'inlineKeyboard',
    inlineKeyboard: {
      rows: [
        { row: { buttons: [{ text: '📄 Відкрити документ', additionalFields: { url: DOC_URL_REF } }] } },
        { row: { buttons: [{ text: '➕ Новий документ', additionalFields: { callback_data: 'show_menu' } }] } },
      ],
    },
    additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true },
  };
  if (JSON.stringify(docLink.parameters) !== JSON.stringify(desired)) {
    docLink.parameters = desired;
    console.log('✓ Send Doc Link → morph into final card + inline buttons');
    changed++;
  } else {
    console.log('· Send Doc Link already a final card (skip)');
  }
}

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} form-submit.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs form-submit --check');
