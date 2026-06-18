/**
 * sync-main-bot-honest-catalog.mjs — rewrite the bot's service-catalog copy so it
 * stops advertising services that don't exist yet (issue #61, IMPROVEMENTS #43/#75).
 *
 * Before: Welcome New User / Show Menu / Send Help all listed ТЦК/ВЛК, ФОП, Пошук
 * суду — all `disabled` (and military is strategically blocked: needs a lawyer
 * partner). Only divorce + alimony are `active`. Service Unavailable read like a
 * generic outage ("спробуйте пізніше").
 *
 * After (static honest copy): available = Розлучення + Аліменти (✅); everything
 * else under "🔜 Скоро"; military framed as "разом із юристом"; Service Unavailable
 * offers the working alternatives instead of a dead "try later".
 *
 * Deliberately NOT dynamic (no per-message Supabase fetch of services.status) —
 * that stays in the backlog (IMPROVEMENTS #43), better delivered later as
 * admin-editable bot copy. The active set changes ~monthly and the operator
 * updates this copy when launching a service anyway.
 *
 * The `_is_new` greeting prefixes (session 36, #55 G3) are preserved verbatim.
 *
 * Idempotent: sets each node's text to the canonical value; re-running is a no-op.
 *   node scripts/sync-main-bot-honest-catalog.mjs [--check]
 * Then: node scripts/deploy-workflow.mjs main-bot
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wfPath = resolve(__dirname, '..', 'n8n/workflows/current/main-bot.json');
const checkOnly = process.argv.includes('--check');

// Preserved greeting-prefix expressions (session 36 / #55 G3) — do not change.
const SHOW_MENU_PREFIX = "={{ $json._is_new ? '🙏 Дякую, що написали!\\n\\n' : '' }}";
const SEND_HELP_PREFIX = "={{ (() => { try { return $('Pre-filter').item.json._is_new === true } catch(e) { return false } })() ? '🙏 Дякую, що написали!\\n\\n' : '' }}";

const NEW_TEXTS = {
  'Welcome New User':
    "=Вітаю, {{ $('Normalize').item.json._firstName }}! ⚖️\n\n" +
    "Я твій персональний AI-юрист. Зараз готую документи для:\n" +
    "✅ Розлучення та поділ майна\n" +
    "✅ Аліменти\n\n" +
    "🔜 Скоро: реєстрація ФОП, пошук суду, спори з ТЦК/ВЛК (складні справи ведемо разом із юристом).\n\n" +
    "Просто напиши своє питання або опиши ситуацію ✍️",

  'Show Menu':
    SHOW_MENU_PREFIX +
    "🏛️ *Юридична допомога*\n\n" +
    "Зараз я готую документи для:\n" +
    "✅ Розлучення та поділ майна\n" +
    "✅ Аліменти\n\n" +
    "🔜 Скоро:\n" +
    "• Реєстрація ФОП\n" +
    "• Пошук суду за адресою\n" +
    "• Спори з ТЦК/ВЛК (складні справи — разом із юристом)\n\n" +
    "Опишіть свою ситуацію — я підкажу ✍️",

  'Send Help':
    SEND_HELP_PREFIX +
    "🏛️ *Не зовсім зрозумів ваше питання*\n\n" +
    "Зараз я готую документи для:\n" +
    "✅ Розлучення та поділ майна\n" +
    "✅ Аліменти\n\n" +
    "🔜 Скоро: реєстрація ФОП, пошук суду, спори з ТЦК/ВЛК.\n\n" +
    "Спробуйте переформулювати або опишіть ситуацію детальніше ✍️",

  'Service Unavailable (bot)':
    "=🛠️ Послуга *{{ $json.title || \"—\" }}* зараз на оновленні — приводимо її у відповідність до змін у законодавстві.\n\n" +
    "Щойно буде готово, повідомимо. А зараз можу допомогти з розлученням та аліментами — просто напишіть ✍️",
};

const wf = JSON.parse(readFileSync(wfPath, 'utf8'));

const missing = Object.keys(NEW_TEXTS).filter(name => !wf.nodes.some(n => n.name === name));
if (missing.length) {
  console.error('❌ Missing nodes: ' + missing.join(', '));
  process.exit(1);
}

const diffs = [];
for (const [name, text] of Object.entries(NEW_TEXTS)) {
  const node = wf.nodes.find(n => n.name === name);
  if (node.parameters.text !== text) diffs.push(name);
}

if (diffs.length === 0) {
  console.log('✅ Honest catalog already in sync (4 nodes).');
  process.exit(0);
}
if (checkOnly) {
  console.error('❌ Out of sync: ' + diffs.join(', ') + '. Run: node scripts/sync-main-bot-honest-catalog.mjs');
  process.exit(1);
}

for (const name of diffs) {
  wf.nodes.find(n => n.name === name).parameters.text = NEW_TEXTS[name];
}
writeFileSync(wfPath, JSON.stringify(wf, null, 2) + '\n', 'utf8');
console.log('✅ Honest catalog applied to: ' + diffs.join(', '));
console.log('Next: node scripts/deploy-workflow.mjs main-bot');
