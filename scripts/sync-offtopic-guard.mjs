// sync-offtopic-guard.mjs — idempotent patcher: off-topic guard for main-bot (#78)
//
// Classifier now returns `topic` (clear | legal_unclear | off_topic), validated
// offline at 93% / 100%-on-abuse (scripts/eval/). The guard:
//   - legal_unclear → WARM clarify, counter reset (never penalise a confused
//     legitimate user — the whole point);
//   - off_topic → counter++ with a tiered, non-toxic reply
//       1: gentle redirect · 2: warning · 3: nudge · 4+: pause (~15 min);
//   - during a pause the AI is NOT called (token saving) — a short static reply
//     + menu buttons; tapping a service (callback) bypasses it; pause auto-expires;
//   - clear → existing service flow, counter reset.
//
// State lives in n8n WORKFLOW STATIC DATA keyed by user id — NO Supabase migration
// (transient rate-limit state; survives restarts, resets only if the workflow is
// re-created, which deploy-in-place does not do). See IMPROVEMENTS #78.
//
// Run, then: node scripts/deploy-workflow.mjs main-bot --check && ... main-bot

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WF_FILE = resolve(__dirname, '..', 'n8n/workflows/current/main-bot.json');
const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));

const TG_CRED = wf.nodes.find((n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi)?.credentials?.telegramApi
  || { id: 'YPiMlLjRRAznPhvZ', name: 'Telegram account' };

let changed = 0;
const getNode = (n) => wf.nodes.find((x) => x.name === n);
function ensureNode(node) {
  if (wf.nodes.some((n) => n.name === node.name)) { console.log(`· "${node.name}" present (skip)`); return false; }
  wf.nodes.push(node); console.log(`✓ added "${node.name}"`); changed++; return true;
}
function setConn(from, conns) {
  if (JSON.stringify(wf.connections[from]) !== JSON.stringify(conns)) {
    wf.connections[from] = conns; changed++; console.log(`✓ rewired "${from}"`);
  } else console.log(`· "${from}" wiring unchanged (skip)`);
}
const SVC_BUTTONS = {
  rows: [
    { row: { buttons: [{ text: '📋 Розлучення та поділ майна', additionalFields: { callback_data: 'confirm_service_1' } }] } },
    { row: { buttons: [{ text: '💰 Стягнення аліментів', additionalFields: { callback_data: 'confirm_service_2' } }] } },
  ],
};
const tgReply = (id, name, pos, text) => ({
  id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: pos,
  parameters: {
    chatId: "={{ $('Normalize').item.json._chatId }}", text,
    replyMarkup: 'inlineKeyboard', inlineKeyboard: SVC_BUTTONS,
    additionalFields: { appendAttribution: false, parse_mode: 'Markdown' },
  },
  credentials: { telegramApi: TG_CRED },
});

// ── 1. classifier prompt → add `topic` (validated, scripts/eval) ──────────────
const SYSTEM_PROMPT = `Ти — професійний юридичний диспетчер українського сервісу, що готує документи до суду.

Доступні послуги:
ID 1: divorce (розлучення, розірвання шлюбу, поділ майна подружжя)
ID 2: alimony (аліменти, утримання дитини)

Класифікуй повідомлення користувача. Поверни ТІЛЬКИ чистий JSON без пояснень:
{"service_id": <1|2|null>, "confidence": <0..1>, "topic": "clear|legal_unclear|off_topic"}

topic:
- "clear" — чіткий запит саме на divorce або alimony (confidence ≥ 0.7).
- "legal_unclear" — стосується ПРАВА / сімейних спорів / суду / юридичних документів, але неясно якої послуги, АБО людина розгублено описує ситуацію, АБО це інша юридична тема (спадщина, опіка, договір, спір з ТЦК тощо). Легітимний користувач.
- "off_topic" — НЕ юридична тема (погода, розваги, спам, образи, мат, безглуздя, балачки).

Правила:
- topic="clear" → service_id = 1 або 2; інакше service_id = null.
- Образи / мат / спам → завжди off_topic.`;
const ai = getNode('AI Agent');
if (ai && ai.parameters.options.systemMessage !== SYSTEM_PROMPT) {
  ai.parameters.options.systemMessage = SYSTEM_PROMPT;
  console.log('✓ AI Agent system prompt → topic-aware'); changed++;
} else console.log('· AI Agent prompt already updated (skip)');

// ── 2. Edit Fields → also parse `topic` ───────────────────────────────────────
const ef = getNode('Edit Fields');
const topicAssign = {
  id: 'topic-001', name: 'topic',
  value: "={{ (() => { try { return JSON.parse($json.output).topic } catch(e) { return 'off_topic' } })() }}",
  type: 'string',
};
if (ef && !ef.parameters.assignments.assignments.some((a) => a.name === 'topic')) {
  ef.parameters.assignments.assignments.push(topicAssign);
  console.log('✓ Edit Fields parses topic'); changed++;
} else console.log('· Edit Fields already parses topic (skip)');

// ── 3. cooldown gate (BEFORE the AI) ──────────────────────────────────────────
ensureNode({
  id: 'guard-cooldown', name: 'Cooldown Check', type: 'n8n-nodes-base.code', typeVersion: 2,
  position: [-700, 2240],
  parameters: { jsCode:
`// Skip the AI entirely while a user is in an off-topic pause (token saving).
const userId = $('Normalize').item.json._userId;
const sd = $getWorkflowStaticData('global');
const rec = (sd.offtopic && sd.offtopic[userId]) || { pausedUntil: 0 };
const paused = (rec.pausedUntil || 0) > Date.now();
return [{ json: { ...$json, _paused: paused } }];` },
});
ensureNode({
  id: 'guard-paused-if', name: 'Paused?', type: 'n8n-nodes-base.if', typeVersion: 2.2,
  position: [-480, 2240],
  parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
    conditions: [{ id: 'paused-c', leftValue: "={{ $json._paused ? 'yes' : 'no' }}", rightValue: 'yes', operator: { type: 'string', operation: 'equals' } }],
    combinator: 'and' }, options: {} },
});
ensureNode(tgReply('guard-pause-reply', 'Pause Reply', [-260, 2120],
  '=Я зробив невелику паузу 🙏\nПовертайтесь трохи згодом — або одразу оберіть послугу нижче 👇'));

// ── 4. off-topic guard (AFTER classification) ─────────────────────────────────
ensureNode({
  id: 'guard-decide', name: 'Off-topic Guard', type: 'n8n-nodes-base.code', typeVersion: 2,
  position: [-140, 2060],
  parameters: { jsCode:
`// Update the per-user off-topic counter by topic and decide the response.
// State in workflow static data (no DB). Tiers (Sergey's policy, no toxicity):
//   off_topic 1: gentle · 2: warning · 3: nudge · 4+: pause ~15 min.
// Any legal topic (clear/legal_unclear) RESETS the counter (good faith).
const userId = $('Normalize').item.json._userId;
const topic = $json.topic;
const sd = $getWorkflowStaticData('global');
sd.offtopic = sd.offtopic || {};
let rec = sd.offtopic[userId] || { count: 0, pausedUntil: 0 };

if (topic === 'clear' || topic === 'legal_unclear') {
  rec.count = 0; rec.pausedUntil = 0; sd.offtopic[userId] = rec;
  return [{ json: { ...$json, _guard_action: topic === 'clear' ? 'proceed' : 'clarify' } }];
}

// off_topic
rec.count = (rec.count || 0) + 1;
let text;
if (rec.count === 1) {
  text = 'Я тут допомагаю з юридичними документами ✍️\\nПоки це розлучення та аліменти. Якщо ваше питання про це — напишіть, і я допоможу.';
} else if (rec.count === 2) {
  text = 'Здається, це не зовсім по темі 🙂\\nЯ — юридичний помічник: розлучення та аліменти. Якщо й далі писатимете не по суті — зроблю невелику паузу 🙏';
} else if (rec.count === 3) {
  text = 'Я все ще тут для юридичних питань 👇\\nОберіть послугу або опишіть свою ситуацію.';
} else {
  rec.pausedUntil = Date.now() + 15 * 60 * 1000;
  text = 'Роблю невелику паузу 🙏\\nПовертайтесь трохи згодом — або одразу оберіть послугу нижче 👇';
}
sd.offtopic[userId] = rec;
return [{ json: { ...$json, _guard_action: 'offtopic', _guard_text: text } }];` },
});
ensureNode({
  id: 'guard-switch', name: 'Guard Switch', type: 'n8n-nodes-base.switch', typeVersion: 3.4,
  position: [80, 2060],
  parameters: { rules: { values: [
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g0', leftValue: '={{ $json._guard_action }}', rightValue: 'proceed', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g1', leftValue: '={{ $json._guard_action }}', rightValue: 'clarify', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g2', leftValue: '={{ $json._guard_action }}', rightValue: 'offtopic', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
  ] }, options: {} },
});
ensureNode(tgReply('guard-clarify', 'Clarify Reply', [320, 2240],
  '=Бачу, що питання юридичне 🤝\nПоки я готую саме розлучення та аліменти. Опишіть свою ситуацію кількома словами або оберіть нижче 👇'));
ensureNode(tgReply('guard-offtopic-reply', 'Off-topic Reply', [320, 2060],
  '={{ $json._guard_text }}'));

// ── 5. rewire ─────────────────────────────────────────────────────────────────
// Skip AI?(FALSE) → Cooldown Check → Paused? {TRUE: Pause Reply | FALSE: Send Typing}
const skipAi = getNode('Skip AI?');
if (skipAi) {
  setConn('Skip AI?', { main: [
    [{ node: 'Greeting: is new?', type: 'main', index: 0 }],
    [{ node: 'Cooldown Check', type: 'main', index: 0 }],
  ] });
}
setConn('Cooldown Check', { main: [[{ node: 'Paused?', type: 'main', index: 0 }]] });
setConn('Paused?', { main: [
  [{ node: 'Pause Reply', type: 'main', index: 0 }],
  [{ node: 'Send Typing', type: 'main', index: 0 }],
] });
// Edit Fields → Off-topic Guard → Guard Switch {proceed→Switch | clarify | offtopic}
setConn('Edit Fields', { main: [[{ node: 'Off-topic Guard', type: 'main', index: 0 }]] });
setConn('Off-topic Guard', { main: [[{ node: 'Guard Switch', type: 'main', index: 0 }]] });
setConn('Guard Switch', { main: [
  [{ node: 'Switch', type: 'main', index: 0 }],
  [{ node: 'Clarify Reply', type: 'main', index: 0 }],
  [{ node: 'Off-topic Reply', type: 'main', index: 0 }],
] });

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
