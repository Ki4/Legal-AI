// sync-offtopic-guard.mjs — idempotent patcher: off-topic guard for main-bot (#78)
//
// Classifier returns `topic` (clear | legal_unclear | off_topic), validated
// offline (scripts/eval, 93% / 100%-on-abuse). The guard:
//   - legal_unclear → WARM clarify, counter reset (never penalise a confused user);
//   - off_topic → counter++ tiered (1 gentle/2 warning/3 nudge/4+ pause ~15min);
//   - during a pause the AI is NOT called (token saving) + menu buttons escape;
//   - clear → existing service flow, counter reset.
//
// STATE in Supabase table `bot_rate_limit` (migration 024), keyed by Telegram id.
// Read/written via Supabase NODES (bound credential — no key plumbing, no upsert
// needed): the row is created at onboarding (Init Rate Limit, in
// sync-bot-ux-polish.mjs), so the guard only ever UPDATEs. Earlier prototype used
// n8n static data — replaced for admin visibility (ties to #79). See #78 spec.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WF_FILE = resolve(__dirname, '..', 'n8n/workflows/current/main-bot.json');
const wf = JSON.parse(readFileSync(WF_FILE, 'utf8'));

const TG_CRED = wf.nodes.find((n) => n.type === 'n8n-nodes-base.telegram' && n.credentials?.telegramApi)?.credentials?.telegramApi
  || { id: 'YPiMlLjRRAznPhvZ', name: 'Telegram account' };
const SB_CRED = wf.nodes.find((n) => n.type === 'n8n-nodes-base.supabase' && n.credentials?.supabaseApi)?.credentials?.supabaseApi
  || { id: 'UpDcJgOGQzIc8axI', name: 'Supabase account' };

let changed = 0;
const getNode = (n) => wf.nodes.find((x) => x.name === n);
function ensureNode(node) {
  if (wf.nodes.some((n) => n.name === node.name)) return false;
  wf.nodes.push(node); console.log(`✓ added "${node.name}"`); changed++; return true;
}
function setCode(name, jsCode) {
  const n = getNode(name);
  if (n && n.parameters.jsCode !== jsCode) { n.parameters.jsCode = jsCode; console.log(`✓ code "${name}"`); changed++; }
}
function setConn(from, conns) {
  if (JSON.stringify(wf.connections[from]) !== JSON.stringify(conns)) {
    wf.connections[from] = conns; changed++; console.log(`✓ rewired "${from}"`);
  }
}
const UID = "={{ $('Normalize').item.json._userId }}";
const SVC_BUTTONS = { rows: [
  { row: { buttons: [{ text: '📋 Розлучення та поділ майна', additionalFields: { callback_data: 'confirm_service_1' } }] } },
  { row: { buttons: [{ text: '💰 Стягнення аліментів', additionalFields: { callback_data: 'confirm_service_2' } }] } },
] };
const tgReply = (id, name, pos, text) => ({
  id, name, type: 'n8n-nodes-base.telegram', typeVersion: 1.2, position: pos,
  parameters: { chatId: "={{ $('Normalize').item.json._chatId }}", text, replyMarkup: 'inlineKeyboard', inlineKeyboard: SVC_BUTTONS,
    additionalFields: { appendAttribution: false, parse_mode: 'Markdown' } },
  credentials: { telegramApi: TG_CRED },
});

// ── 1. classifier prompt → topic (validated) ──────────────────────────────────
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
if (ai && ai.parameters.options.systemMessage !== SYSTEM_PROMPT) { ai.parameters.options.systemMessage = SYSTEM_PROMPT; console.log('✓ AI prompt → topic'); changed++; }

// ── 2. Edit Fields → parse topic ──────────────────────────────────────────────
const ef = getNode('Edit Fields');
if (ef && !ef.parameters.assignments.assignments.some((a) => a.name === 'topic')) {
  ef.parameters.assignments.assignments.push({ id: 'topic-001', name: 'topic',
    value: "={{ (() => { try { return JSON.parse($json.output).topic } catch(e) { return 'off_topic' } })() }}", type: 'string' });
  console.log('✓ Edit Fields parses topic'); changed++;
}

// ── 3. Supabase read/write nodes ──────────────────────────────────────────────
const sbFilter = { conditions: [{ keyName: 'external_id', condition: 'eq', keyValue: UID }] };
ensureNode({
  id: 'guard-read', name: 'Cooldown Read', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-820, 2240],
  alwaysOutputData: true,
  parameters: { operation: 'getAll', tableId: 'bot_rate_limit', returnAll: true, filters: sbFilter },
  credentials: { supabaseApi: SB_CRED },
});
ensureNode({
  id: 'guard-update', name: 'Update Rate Limit', type: 'n8n-nodes-base.supabase', typeVersion: 1, position: [-20, 1900],
  onError: 'continueRegularOutput',
  parameters: { operation: 'update', tableId: 'bot_rate_limit', filterType: 'manual', matchType: 'allFilters',
    filters: sbFilter,
    fieldsUi: { fieldValues: [
      { fieldId: 'off_topic_count', fieldValue: "={{ $('Off-topic Guard').item.json._new_count }}" },
      { fieldId: 'paused_until', fieldValue: "={{ $('Off-topic Guard').item.json._new_paused }}" },
      { fieldId: 'updated_at', fieldValue: "={{ new Date().toISOString() }}" },
    ] } },
  credentials: { supabaseApi: SB_CRED },
});

// ── 4. guard Code nodes (DB-backed) ───────────────────────────────────────────
ensureNode({ id: 'guard-cooldown', name: 'Cooldown Check', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-600, 2240], parameters: { jsCode: '' } });
setCode('Cooldown Check',
`// Read the user's rate-limit row (from Cooldown Read) — pause skips the AI.
const norm = $('Pre-filter').item.json;
const rec = $('Cooldown Read').item.json || {};
const pausedUntil = rec.paused_until ? new Date(rec.paused_until).getTime() : 0;
return [{ json: { ...norm, _paused: pausedUntil > Date.now() } }];`);

ensureNode({ id: 'guard-decide', name: 'Off-topic Guard', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-240, 2060], parameters: { jsCode: '' } });
setCode('Off-topic Guard',
`// Decide response by topic + bump/reset the off-topic counter (written by
// Update Rate Limit next). Tiers (no toxicity): 1 gentle/2 warning/3 nudge/4+ pause.
const topic = $json.topic;
const rec = $('Cooldown Read').item.json || {};
let count = rec.off_topic_count || 0;

if (topic === 'clear' || topic === 'legal_unclear') {
  return [{ json: { ...$json, _guard_action: topic === 'clear' ? 'proceed' : 'clarify', _new_count: 0, _new_paused: null } }];
}
count = count + 1;
let text, paused = null;
if (count === 1) text = 'Я тут допомагаю з юридичними документами ✍️\\nПоки це розлучення та аліменти. Якщо ваше питання про це — напишіть, і я допоможу.';
else if (count === 2) text = 'Здається, це не зовсім по темі 🙂\\nЯ — юридичний помічник: розлучення та аліменти. Якщо й далі писатимете не по суті — зроблю невелику паузу 🙏';
else if (count === 3) text = 'Я все ще тут для юридичних питань 👇\\nОберіть послугу або опишіть свою ситуацію.';
else { paused = new Date(Date.now() + 15 * 60 * 1000).toISOString(); text = 'Роблю невелику паузу 🙏\\nПовертайтесь трохи згодом — або одразу оберіть послугу нижче 👇'; }
return [{ json: { ...$json, _guard_action: 'offtopic', _guard_text: text, _new_count: count, _new_paused: paused } }];`);

// ── 5. routing nodes + replies ────────────────────────────────────────────────
ensureNode({ id: 'guard-paused-if', name: 'Paused?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [-400, 2240],
  parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
    conditions: [{ id: 'paused-c', leftValue: "={{ $json._paused ? 'yes' : 'no' }}", rightValue: 'yes', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} } });
ensureNode(tgReply('guard-pause-reply', 'Pause Reply', [-180, 2120], '=Я зробив невелику паузу 🙏\nПовертайтесь трохи згодом — або одразу оберіть послугу нижче 👇'));
ensureNode({ id: 'guard-switch', name: 'Guard Switch', type: 'n8n-nodes-base.switch', typeVersion: 3.4, position: [200, 2060],
  parameters: { rules: { values: [
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g0', leftValue: '={{ $json._guard_action }}', rightValue: 'proceed', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g1', leftValue: '={{ $json._guard_action }}', rightValue: 'clarify', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
    { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 }, conditions: [{ id: 'g2', leftValue: '={{ $json._guard_action }}', rightValue: 'offtopic', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
  ] }, options: {} } });
ensureNode(tgReply('guard-clarify', 'Clarify Reply', [440, 2240], '=Бачу, що питання юридичне 🤝\nПоки я готую саме розлучення та аліменти. Опишіть свою ситуацію кількома словами або оберіть нижче 👇'));
ensureNode(tgReply('guard-offtopic-reply', 'Off-topic Reply', [440, 2060], '={{ $json._guard_text }}'));

// ── 6. wiring ─────────────────────────────────────────────────────────────────
setConn('Skip AI?', { main: [
  [{ node: 'Greeting: is new?', type: 'main', index: 0 }],
  [{ node: 'Cooldown Read', type: 'main', index: 0 }],
] });
setConn('Cooldown Read', { main: [[{ node: 'Cooldown Check', type: 'main', index: 0 }]] });
setConn('Cooldown Check', { main: [[{ node: 'Paused?', type: 'main', index: 0 }]] });
setConn('Paused?', { main: [
  [{ node: 'Pause Reply', type: 'main', index: 0 }],
  [{ node: 'Send Typing', type: 'main', index: 0 }],
] });
setConn('Edit Fields', { main: [[{ node: 'Off-topic Guard', type: 'main', index: 0 }]] });
// Off-topic Guard fans out: Guard Switch (routing, reads $json directly) + Update
// Rate Limit as a parallel LEAF (DB write side-effect). Earlier the Supabase node
// sat BETWEEN them and broke item-pairing → Guard Switch matched no rule → silence.
setConn('Off-topic Guard', { main: [[
  { node: 'Guard Switch', type: 'main', index: 0 },
  { node: 'Update Rate Limit', type: 'main', index: 0 },
]] });
setConn('Update Rate Limit', { main: [[]] });
setConn('Guard Switch', { main: [
  [{ node: 'Switch', type: 'main', index: 0 }],
  [{ node: 'Clarify Reply', type: 'main', index: 0 }],
  [{ node: 'Off-topic Reply', type: 'main', index: 0 }],
] });

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
