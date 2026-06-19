// run-classification-eval.mjs — measure the proposed intent classifier (IMPROVEMENTS #78)
// OFFLINE against Groq, without touching the live bot. Calls the model with the
// updated system prompt (adds a `topic` field) for every case in
// bot-classification.cases.json, then reports accuracy + a confusion matrix.
//
//   node scripts/eval/run-classification-eval.mjs
//
// This is the "how do we test the classifier" answer: a labelled corpus + a
// deterministic (temperature 0) run + measurable accuracy, BEFORE going live.
// Grow the corpus as edge cases appear — it doubles as a regression net.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const env = readFileSync(resolve(ROOT, 'apps/client/.env.local'), 'utf8');
const GROQ_KEY = env.match(/GROQ_API_KEY=(\S+)/)?.[1];
const MODEL = env.match(/GROQ_MODEL=(\S+)/)?.[1] || 'llama-3.3-70b-versatile';
if (!GROQ_KEY) throw new Error('GROQ_API_KEY missing in apps/client/.env.local');

const corpus = JSON.parse(readFileSync(resolve(__dirname, 'bot-classification.cases.json'), 'utf8'));

// Proposed system prompt — adds `topic`. Only divorce/alimony are "clear" services;
// every other legal matter (спадщина/опіка/договір/ТЦК) is legal_unclear, NOT off_topic.
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

function classify(msg) {
  const body = JSON.stringify({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: msg },
    ],
  });
  return new Promise((res, rej) => {
    const req = https.request(
      { hostname: 'api.groq.com', path: '/openai/v1/chat/completions', method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY, 'Content-Length': Buffer.byteLength(body) } },
      (r) => { let s = ''; r.on('data', (c) => (s += c)); r.on('end', () => {
        try {
          const j = JSON.parse(s);
          const txt = j.choices?.[0]?.message?.content || '';
          const m = txt.match(/\{[\s\S]*\}/);
          res(m ? JSON.parse(m[0]) : { _raw: txt, _err: 'no json' });
        } catch (e) { res({ _err: e.message, _raw: s.slice(0, 200) }); }
      }); });
    req.on('error', rej);
    req.write(body); req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOPICS = ['clear', 'legal_unclear', 'off_topic'];
const confusion = {}; // expected -> { got -> count }
TOPICS.forEach((t) => (confusion[t] = { clear: 0, legal_unclear: 0, off_topic: 0, '?': 0 }));

let topicOK = 0, svcOK = 0, svcTotal = 0;
const misses = [];

console.log(`Model: ${MODEL} · cases: ${corpus.cases.length}\n`);
for (const c of corpus.cases) {
  const out = await classify(c.msg);
  const gotTopic = TOPICS.includes(out.topic) ? out.topic : '?';
  confusion[c.topic][gotTopic]++;
  const tOK = gotTopic === c.topic;
  if (tOK) topicOK++;
  let sNote = '';
  if (c.topic === 'clear') {
    svcTotal++;
    const sOK = Number(out.service_id) === c.service_id;
    if (sOK) svcOK++;
    sNote = ` svc=${out.service_id}${sOK ? '' : '✗(exp ' + c.service_id + ')'}`;
  }
  const mark = tOK ? '✓' : '✗';
  if (!tOK) misses.push({ msg: c.msg, exp: c.topic, got: gotTopic, conf: out.confidence });
  console.log(`${mark} [${c.topic.padEnd(13)}→ ${gotTopic.padEnd(13)}] conf=${out.confidence ?? '?'}${sNote}  "${c.msg}"`);
  await sleep(250); // gentle on rate limits
}

console.log(`\n── Topic accuracy: ${topicOK}/${corpus.cases.length} (${(100 * topicOK / corpus.cases.length).toFixed(0)}%)`);
console.log(`── Service accuracy (on 'clear'): ${svcOK}/${svcTotal}`);
console.log('\nConfusion matrix (rows=expected, cols=got):');
console.log('expected'.padEnd(15), TOPICS.map((t) => t.slice(0, 9).padStart(10)).join(''), '   ?');
for (const e of TOPICS) {
  console.log(e.padEnd(15), TOPICS.map((g) => String(confusion[e][g]).padStart(10)).join(''), String(confusion[e]['?']).padStart(5));
}
if (misses.length) {
  console.log('\nMisses:');
  misses.forEach((m) => console.log(`  "${m.msg}" — expected ${m.exp}, got ${m.got} (conf ${m.conf})`));
}
