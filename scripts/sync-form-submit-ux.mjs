// sync-form-submit-ux.mjs — idempotent patcher for n8n/workflows/current/form-submit.json
//
// "Bot UX polish" bundle (feature/bot-ux-polish) — chat-facing part of form-submit.
//
//   L3 — generation progress ("loading with steps") in the Telegram chat:
//     After Respond OK closes the TWA, the chat went: "Документ готується… ⏳"
//     → ~1-2 min SILENCE → the finished doc. Add three editMessageText nodes that
//     rewrite that one ⏳ message through the real generation checkpoints:
//       Copy Template   → "📝 Формую документ…"
//       Apply Typography → "✍️ Майже готово…"
//       Share Document   → "✅ Документ готовий ⤵️"
//     Each is a FAN-OUT LEAF off the existing node's success output (out0) — it
//     does NOT sit in the data path, so it can't break the freshly-hardened
//     chain (#56/#59), and onError:continueRegularOutput means a failed edit
//     (e.g. Telegram "message is not modified") never aborts generation.
//
//   L2/L3 formatting:
//     - "Notify User" (initial ⏳): HTML + click-to-copy case № via <code>.
//     - "Send Doc Link" (final): masked link + no preview tail + follow-up CTA.
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

let changed = 0;
const getNode = (name) => wf.nodes.find((n) => n.name === name);

// ── L3: progress-edit leaf factory ────────────────────────────────────────────
function editLeaf(id, name, position, text) {
  if (wf.nodes.some((n) => n.name === name)) {
    console.log(`· node "${name}" already present (skip)`);
    return;
  }
  wf.nodes.push({
    id,
    name,
    type: 'n8n-nodes-base.telegram',
    typeVersion: 1.2,
    position,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'editMessageText',
      messageType: 'message',
      chatId: USER_ID_REF,
      messageId: MSG_ID_REF,
      text,
      additionalFields: { appendAttribution: false },
    },
    credentials: { telegramApi: TG_CRED },
  });
  console.log(`✓ added progress leaf "${name}"`);
  changed++;
}

// Fan-out a leaf off a node's SUCCESS output (out0) without disturbing out1
// (the #59 error-output → Format Gen Failure) or the existing main-chain target.
function fanOut(fromNode, leafName) {
  const c = wf.connections[fromNode];
  if (!c || !c.main || !c.main[0]) {
    console.log(`⚠ ${fromNode}: unexpected connection shape — inspect manually`);
    return;
  }
  if (c.main[0].some((x) => x.node === leafName)) {
    console.log(`· ${fromNode} → ${leafName} already fanned (skip)`);
    return;
  }
  c.main[0].push({ node: leafName, type: 'main', index: 0 });
  console.log(`✓ fan-out ${fromNode} → ${leafName}`);
  changed++;
}

editLeaf('fs-progress-1', 'Progress: Building', [3040, 1340], '📝 Аналізую дані та формую документ…');
editLeaf('fs-progress-2', 'Progress: Finalizing', [4240, 1340], '✍️ Майже готово — оформлюю документ…');
editLeaf('fs-progress-3', 'Progress: Ready', [4480, 1340], '✅ Документ готовий — дивіться нижче ⤵️');

fanOut('Copy Template', 'Progress: Building');
fanOut('Apply Typography', 'Progress: Finalizing');
fanOut('Share Document', 'Progress: Ready');

// ── L2/L3: nicer initial "Notify User" (HTML + click-to-copy case №) ──────────
const notify = getNode('Notify User');
if (notify) {
  const desiredText =
    "=✅ <b>Дякуємо! Дані отримано.</b>\n\n" +
    "📋 Послуга: {{ $('Get Service').item.json.title }}\n" +
    "🔢 Ваш кейс: <code>{{ $('Insert Case').item.json.id }}</code>  <i>(торкніться, щоб скопіювати)</i>\n\n" +
    "⏳ Готую документ — зазвичай 1–2 хвилини. Повідомлю, щойно буде готово.";
  if (notify.parameters.text !== desiredText || notify.parameters.additionalFields?.parse_mode !== 'HTML') {
    notify.parameters.text = desiredText;
    notify.parameters.additionalFields = { ...(notify.parameters.additionalFields || {}), parse_mode: 'HTML' };
    console.log('✓ Notify User → HTML + click-to-copy case №');
    changed++;
  } else {
    console.log('· Notify User already updated (skip)');
  }
}

// ── L3: nicer final "Send Doc Link" (masked link, no preview tail, CTA) ───────
const docLink = getNode('Send Doc Link');
if (docLink) {
  const desiredText =
    "=📄 <b>Готово! Ваша позовна заява сформована.</b>\n\n" +
    "👉 <a href=\"{{ $('Build Replace Request').item.json._new_doc_url }}\">Відкрити документ</a>\n\n" +
    "💡 У документі: <i>Файл → Завантажити → PDF</i> — і можна подавати до суду.\n\n" +
    "Потрібен ще один документ? Просто напишіть мені ✍️";
  const af = docLink.parameters.additionalFields || {};
  if (docLink.parameters.text !== desiredText || af.disable_web_page_preview !== true) {
    docLink.parameters.text = desiredText;
    docLink.parameters.additionalFields = { ...af, parse_mode: 'HTML', disable_web_page_preview: true };
    console.log('✓ Send Doc Link → masked link + no preview tail + CTA');
    changed++;
  } else {
    console.log('· Send Doc Link already updated (skip)');
  }
}

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} form-submit.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs form-submit --check');
