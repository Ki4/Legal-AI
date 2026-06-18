// sync-main-bot-onboarding.mjs — idempotent patcher for n8n/workflows/current/main-bot.json
//
// Applies the issue #55 G3 fixes (onboarding) on top of G1+G2 (sync-main-bot-fixes.mjs):
//   1. Welcome New User dead-end (§4.2) — a brand-new user's first message never
//      reached Pre-filter/AI Agent, so asking a real question on message #1 got
//      only the generic intro and silence. Welcome New User now flows into a new
//      "Mark New User" node (tags `_is_new: true`) and on into Pre-filter, so the
//      same message is also routed for real.
//   2. callback_query routed before Pre-filter (§4.3) — `Ask Confirm`'s Так/Ні
//      taps (and the new 🔄 Інша послуга button) were landing in Pre-filter as
//      plain text and getting misclassified by the AI Agent. A new
//      "Is Callback?" branch intercepts `_type === 'callback_query'` right after
//      the existing-user check and routes by `_callback_action`
//      (confirm_service_<id> | show_menu), reusing the existing
//      Get Service (high) / Is Active? (high) / Send TWA Button / Show Menu nodes.
//   3. Greeting prefix by `_is_new` — Show Menu / Send Help / Ask Confirm /
//      Send TWA Button prepend a short acknowledgement on a user's first routed
//      reply. Send TWA Button is reachable both via the AI Agent path (Pre-filter
//      always ran) and via the callback path (Pre-filter never ran), so its check
//      uses the same try/catch expression pattern already used in "Edit Fields"
//      to read `_is_new` without erroring when the referenced node didn't execute.
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
const byName = (name) => wf.nodes.find((n) => n.name === name);

let changed = 0;
const note = (msg) => {
  console.log(msg);
};

// Short, neutral acknowledgement — doesn't repeat "nice to meet you" (Welcome New
// User already covers that), just signals the bot is responding to the message
// that triggered onboarding, not ignoring it.
const GREETING_PREFIX = '🙏 Дякую, що написали!\\n\\n';
const IS_NEW_SAFE_EXPR =
  "(() => { try { return $('Pre-filter').item.json._is_new === true } catch(e) { return false } })()";

// ── 1. Welcome New User: dead-end → Mark New User → Pre-filter ───────────────
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

ensureNode({
  id: 'main-bot-mark-new-user',
  name: 'Mark New User',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-400, 1520],
  parameters: {
    jsCode:
      "// Telegram send-message nodes replace $json with their own API response,\n" +
      "// so re-derive Normalize's fields here and tag _is_new for the rest of the\n" +
      "// pipeline (this message is the user's very first contact).\n" +
      "const norm = $('Normalize').item.json;\n" +
      "return [{ json: { ...norm, _is_new: true } }];",
  },
});

ensureNode({
  id: 'main-bot-is-callback',
  name: 'Is Callback?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-1100, 1700],
  parameters: {
    conditions: {
      options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'is-callback-cond',
          leftValue: "={{ $('Normalize').item.json._type }}",
          rightValue: 'callback_query',
          operator: { type: 'string', operation: 'equals' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

ensureNode({
  id: 'main-bot-route-callback',
  name: 'Route Callback',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-860, 1700],
  parameters: {
    jsCode:
      "// Inline-button taps (Ask Confirm Так/Ні, 🔄 Інша послуга) only ever reach a\n" +
      "// user who already exists, so this is never the user's first message.\n" +
      "const norm = $('Normalize').item.json;\n" +
      "const data = norm._text || '';\n" +
      "let action = 'show_menu';\n" +
      "let serviceId = null;\n" +
      "if (data.startsWith('confirm_service_')) {\n" +
      "  action = 'confirm_service';\n" +
      "  serviceId = Number(data.slice('confirm_service_'.length));\n" +
      "}\n" +
      "return [{ json: { ...norm, _is_new: false, _callback_action: action, service_id_parsed: serviceId } }];",
  },
});

ensureNode({
  id: 'main-bot-confirm-service-if',
  name: 'Callback: Confirm Service?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-620, 1700],
  parameters: {
    conditions: {
      options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'confirm-service-cond',
          leftValue: '={{ $json._callback_action }}',
          rightValue: 'confirm_service',
          operator: { type: 'string', operation: 'equals' },
        },
      ],
      combinator: 'and',
    },
    options: {},
  },
});

// ── 2. Rewire connections ─────────────────────────────────────────────────────
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

// Welcome New User was a dead end ("main": [[]]).
setConnection('Welcome New User', { main: [[{ node: 'Mark New User', type: 'main', index: 0 }]] });
setConnection('Mark New User', { main: [[{ node: 'Pre-filter', type: 'main', index: 0 }]] });

// User Exists? FALSE (existing user) used to go straight to Pre-filter; now it
// passes through the callback check first.
setConnection('User Exists?', {
  main: [
    [{ node: 'Create Profile', type: 'main', index: 0 }],
    [{ node: 'Is Callback?', type: 'main', index: 0 }],
  ],
});
setConnection('Is Callback?', {
  main: [
    [{ node: 'Route Callback', type: 'main', index: 0 }],
    [{ node: 'Pre-filter', type: 'main', index: 0 }],
  ],
});
setConnection('Route Callback', {
  main: [[{ node: 'Callback: Confirm Service?', type: 'main', index: 0 }]],
});
// Fan-in: reuse the existing AI-Agent-path terminal nodes.
setConnection('Callback: Confirm Service?', {
  main: [
    [{ node: 'Get Service (high)', type: 'main', index: 0 }],
    [{ node: 'Show Menu', type: 'main', index: 0 }],
  ],
});

// ── 3. Pre-filter: carry _is_new through from its immediate input ────────────
const preFilter = byName('Pre-filter');
if (preFilter) {
  const newCode =
    "// Pre-filter: catch obvious greetings and off-topic BEFORE hitting AI (saves tokens)\n" +
    "// NOTE: $json here is the Supabase identity row, or (new-user path) Mark New\n" +
    "// User's tag — must read Normalize data explicitly.\n" +
    "const norm = $('Normalize').item.json;\n" +
    "const isNew = $json._is_new === true; // set by Mark New User; false otherwise\n" +
    "const text = (norm._text || '').toLowerCase().trim();\n" +
    "\n" +
    "// Very short or empty\n" +
    "if (text.length < 3) {\n" +
    "  return [{ json: { ...norm, _is_new: isNew, _skip_ai: true, _skip_reason: 'too_short' } }];\n" +
    "}\n" +
    "\n" +
    "// Bot commands and greetings\n" +
    "const GREETINGS = ['/start', '/help', '/menu', '/services', 'привіт', 'привет', 'hello', 'hi ', 'hey', 'добрий', 'добрый', 'вітаю', 'здравствуй', 'хай', 'ку'];\n" +
    "if (GREETINGS.some(g => text.startsWith(g) || text === g.trim())) {\n" +
    "  return [{ json: { ...norm, _is_new: isNew, _skip_ai: true, _skip_reason: 'greeting' } }];\n" +
    "}\n" +
    "\n" +
    "// Obviously off-topic\n" +
    "const OFF_TOPIC = ['погода', 'weather', 'рецепт', 'recipe', 'pizza', 'піца', 'їжа', 'еда', 'музик', 'кіно', 'movie', 'спорт', 'футбол', 'ігр', 'game', 'анекдот', 'joke'];\n" +
    "if (OFF_TOPIC.some(w => text.includes(w))) {\n" +
    "  return [{ json: { ...norm, _is_new: isNew, _skip_ai: true, _skip_reason: 'off_topic' } }];\n" +
    "}\n" +
    "\n" +
    "// Looks like a legal query — pass to AI\n" +
    "return [{ json: { ...norm, _is_new: isNew, _skip_ai: false } }];";
  if (preFilter.parameters.jsCode !== newCode) {
    preFilter.parameters.jsCode = newCode;
    note('✓ Pre-filter: now carries _is_new through');
    changed++;
  } else {
    note('· Pre-filter already carries _is_new (skip)');
  }
}

// ── 4. Greeting prefix by _is_new on the 4 terminal messages ─────────────────
// Marker substring used to detect an already-applied prefix, so re-running this
// script never double-wraps the text.
const PREFIX_MARKER = "? '" + GREETING_PREFIX + "' : ''";

function prefixText(nodeName, isNewExpr) {
  const node = byName(nodeName);
  if (!node) {
    note(`⚠ node "${nodeName}" not found — skip prefix`);
    return;
  }
  const text = node.parameters.text;
  if (text.includes(PREFIX_MARKER)) {
    note(`· ${nodeName} already has _is_new prefix (skip)`);
    return;
  }
  const stripped = text.startsWith('=') ? text.slice(1) : text;
  node.parameters.text = `={{ ${isNewExpr} ${PREFIX_MARKER} }}${stripped}`;
  note(`✓ ${nodeName}: added _is_new greeting prefix`);
  changed++;
}

// Show Menu: $json._is_new resolves directly (both its sources — Skip AI? TRUE
// and Callback: Confirm Service? FALSE — carry it in their own immediate output).
prefixText('Show Menu', '$json._is_new');

// Send Help / Ask Confirm: only reachable via the AI Agent path, but Pre-filter's
// fields don't survive AI Agent + Edit Fields in $json — read via node reference.
// Send TWA Button: reachable via BOTH the AI Agent path (Pre-filter ran) and the
// callback path (Pre-filter never ran) — the try/catch expression is required
// for all three, not just stylistic.
for (const name of ['Send Help', 'Ask Confirm', 'Send TWA Button']) {
  prefixText(name, IS_NEW_SAFE_EXPR);
}

// ── 5. 🔄 Інша послуга button on Send TWA Button ──────────────────────────────
const twa = byName('Send TWA Button');
if (twa) {
  const rows = twa.parameters.inlineKeyboard.rows;
  const hasOtherServiceRow = rows.some((r) =>
    r.row.buttons.some((b) => b.additionalFields?.callback_data === 'show_menu'),
  );
  if (!hasOtherServiceRow) {
    rows.push({
      row: {
        buttons: [
          {
            text: '🔄 Інша послуга',
            additionalFields: { callback_data: 'show_menu' },
          },
        ],
      },
    });
    note('✓ Send TWA Button: added 🔄 Інша послуга row');
    changed++;
  } else {
    note('· Send TWA Button already has 🔄 Інша послуга (skip)');
  }
}

writeFileSync(WF_FILE, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log(`\n${changed ? '✓' : '·'} main-bot.json written (${changed} change${changed === 1 ? '' : 's'}).`);
console.log('Next: node scripts/deploy-workflow.mjs main-bot --check');
