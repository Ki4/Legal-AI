# law-change-impact — Plan

> **SDD-Tier 2** спека. Агент «що змінилось»: коли CRON-монітор виявляє зміну редакції
> відстежуваного закону, агент **попередньо** описує юристу *що саме змінилось у тексті* і
> *як це ймовірно впливає на кожну послугу* — чернетка, яку Оля підтверджує/править у панелі
> «Зміни законів». Контракт — `requirements.md`; перевірка — `validation.md`.
> Tier 2, бо зачіпає **юридичну коректність** (хибний висновок про зміну закону → юрист
> віддасть клієнту документ за застарілою нормою) і додає **LLM-крок у раніше детермінований
> моніторинг** — підхід треба затвердити ДО автономного проходу.

## Проблема (чому фіча №1)

Сьогодні петля моніторингу замкнена, але **сліпа**: `scripts/check-law-updates.mjs` бачить лише
що *дата редакції зсунулась* → переводить залежні послуги в `needs_review` → пише рядок у
`law_change_log`. Юрист отримує сигнал **«щось у СК змінилось — перевір 3 послуги вручну»**, але
не *що саме* і *де болить*. Це найдорожча ручна робота у всьому циклі і єдиний реальний
юридичний ризик: зміну легко проґавити або недооцінити.

Агент перетворює це на: **«ст. 182 СК — змінено формулу мінімального розміру (текст diff
нижче); ймовірно зачеплено `alimony` (поле `requested_alimony_value`, абзац "ПРОШУ") і
`alimony-change` (розрахунок courtFee); впевненість 0.7; джерело — редакція rada. Підтвердьте.»**

> Це **не** автоматизація рішення юриста — це підготовка дельти-ризику до його підпису.
> Ескалаційна філософія проєкту (`docs/notebooklm/02_Product_Philosophy_Escalation.md`):
> **AI робить чернетку → юрист підписує**. Quality bar: жодна послуга не виходить із
> `needs_review` без sign-off Олі.

## Підхід

**Розширюємо наявний моніторинг, а не будуємо паралельний.** Чернетка — це **add-on до того
самого рядка `law_change_log`**. Якщо агент падає/утримується — поведінка деградує **рівно до
сьогоднішньої** (флип у `needs_review` + детермінований diff), ніколи не гірше і ніколи в
галюцинацію.

**Дзеркало харнесса Tier-2-послуг (L0–L5, `docs/research/service-tiers-and-ai-harness.md`):**

| Слой | Що робить тут | Детермінізм | Де живе |
|---|---|---|---|
| **L0 Detect** | дата редакції зсунулась (вже є) | 100% | `scripts/check-law-updates.mjs` |
| **L1 Diff** | стара версія статей (`law_documents.full_text`/`law_chunks.content`, ще стара в мить детекту) vs свіжий текст з rada → детермінований diff, **знімок** у рядок аудиту | 100% (без LLM) | Node-монітор + `scripts/lib/law-text.mjs` |
| **L2 Scope** | змінені статті → `law_chunks.service_slugs` + обхід `law_relations` (хто `requires`/`references` змінену норму) → набір послуг + норм | детерм. обхід графа | n8n (Supabase RPC) |
| **L3 Reason** | Groq пише «що змінилось» + гіпотезу впливу по кожній послузі; **enum-констрейнт**: лише статті ∈ diff, послуги ∈ L2; цитує лише реальні фрагменти diff; жодних вигаданих чисел/дат | ❌ єдиний недетерм. | n8n + `n8n/prompts/law-change-digest.txt` |
| **L4 Critics** | (a) детерм. groundedness: кожен цитований фрагмент ∈ diff, стаття ∈ diff-set, slug ∈ L2 → інакше RED; (b) LLM-критик → AMBER; **abstention** | 100% (a) / ❌ (b) | n8n + `n8n/templates/law-change-groundedness.js` |
| **L5 Handoff** | запис `ai_summary`/`ai_impact`/`ai_confidence` у рядок; картка «AI-чернетка» в панелі «Зміни законів» з джерелом + впевненістю + кнопкою «Вставити в нотатку» | 100% | migration 027 + `LawChangeLogPage.tsx` |

**Дві стадії — свідомо (поважаємо конвенцію «LLM лише в n8n»):**
1. **Монітор (Node, наявний CRON):** L0 + **L1 знімок diff** у рядок (`ai_status='pending'`). Чистий, тестований Node — там, де вже відбувається детект і фетч; знімок беремо **до** будь-якого re-seed (поки `law_chunks`/`law_documents` ще тримають стару редакцію).
2. **Дайджест (n8n workflow `law-change-digest`):** підхоплює рядки `ai_status='pending'` із заповненим `article_diffs` → L2→L3→L4→L5. Уся LLM-робота — в n8n (Groq-креди, промпти, критики вже там; жодного LLM-виклику в `scripts/`).

> **Чому не все в Node і не все в n8n.** Diff треба зняти в мить детекту (інакше re-seed
> перепише стару редакцію) — а детект+фетч уже в Node-моніторі, отже L1 там. LLM-конвенція
> проєкту — n8n (єдине місце Groq-кредів/промптів/критиків), отже L3/L4 там. Зв'язка —
> append-only рядок `law_change_log` як черга: монітор кладе `pending+diff`, дайджест добирає.
> Деградація: n8n/Groq лежить → рядок усе одно має детермінований diff + флип = «сьогодні + diff».

**Робастність L1 (крихка частина — скрейпінг rada):** первинний diff — проти
`law_documents.full_text` (повний текст закону вже зберігається, ми й так тягнемо сторінку) —
грубіше, але **надійно**. Поартикульне уточнення (розбивка за заголовками статей) — вторинна
зручність за тими ж парсер-тестами; якщо поартикульна екстракція ненадійна, лишаємось на
law-level diff із якорями-заголовками. Краще показати юристу надійний сирий diff, ніж крихку
поартикульну вгадайку.

## Групи задач

### G1 — Схема + детермінований diff (L0/L1, без LLM)
- **Migration 027** (`law_change_impact_fields`): додати в `law_change_log` колонки
  `article_diffs jsonb`, `ai_summary text`, `ai_impact jsonb`, `ai_confidence real`,
  `ai_status text CHECK (...) DEFAULT 'pending'`, `ai_model text`, `ai_generated_at timestamptz`
  (контракт — requirements §4). Backfill: наявні рядки → `ai_status='pending'`, решта NULL.
  `notes` лишається **людським SSoT** — AI ніколи в нього не пише.
- `scripts/lib/law-text.mjs` — новий шар над `rada.mjs`: `fetchLawText(url)` (повний текст
  сторінки) + `extractArticles(text)` (розбивка за заголовками «Стаття N»). Та сама
  retry/backoff-обв'язка, що в `rada.mjs`. Чистий парсер + I/O окремо (тестується як `rada.mjs`).
- `scripts/lib/law-diff.mjs` — `diffLaw(oldText, newText)` → структурований diff (hunks:
  added/removed-рядки + контекст). Чиста функція, без I/O, без LLM (npm `diff` або власний LCS).
- Розширити `scripts/lib/law-change.mjs::applyLawChange`: у мить флипу зняти стару редакцію
  (з `law_documents.full_text` за `law_code`, поки не `is_stale`), дофетчити нову, порахувати
  `diffLaw`, записати `article_diffs` у новий рядок `law_change_log` (`ai_status='pending'`).
  Diff — **до** позначки `is_stale=true`.
- Vitest: парсер `extractArticles` (фікстури HTML rada), `diffLaw` (golden old/new → очікуваний
  diff), і що `applyLawChange` пише `article_diffs` (мок Supabase, як наявні тести).

### G2 — Scope (L2, детермінований обхід графа)
- Supabase RPC / запит у n8n: `changed_article_nums → law_chunks (law_code, article_num) →
  service_slugs` ∪ обхід `law_relations` (рёбра, що вказують на змінені статті: `requires`,
  `overrides`, `clarifies`, `references`; лише `verified_by IS NOT NULL`) → набір
  {послуги, норми}. Перевикористати патерн traversal із `GRAPHRAG-GUIDE.md`.
- **Severity = юридична, не попит** (закриває зауваження сесії 45): шлях зв'язку
  `requires`/`overrides` → `high`, `clarifies` → `medium`, `references` → `low`; модулюється
  детерм. евристикою «чи зачіпає hunk числа/дати/строки» (regex). LLM пропонує severity,
  евристика його **обмежує згори**.

### G3 — Reasoning + критики (L3/L4, в n8n)
- `n8n/prompts/law-change-digest.txt` — промпт: вхід = hunks diff (L1) + scope (L2);
  **strict JSON output** (requirements §3); дозволені `article_num` лише з diff-set, `slug`
  лише з L2; **заборона** вводити числа/дати/назви статей поза входом; «не впевнений → коротше».
- `n8n/templates/law-change-groundedness.js` — **детерм. критик (без LLM):** кожен цитований
  фрагмент ∈ `article_diffs` verbatim; кожна `article_num` ∈ diff-set; кожен `slug` ∈ L2 →
  інакше span RED. Pure-ядро + unit-тести (дзеркало `groundedness.js`).
- `n8n/prompts/law-change-critic.txt` — **LLM-критик (опц., незалежний прохід):**
  groundedness per-claim → AMBER нижче порога.
- **Abstention:** критики провалені або `overall_confidence < поріг` → НЕ писати інтерпретацію:
  `ai_status='abstained'`, `ai_summary=NULL`; у рядку лишається лише детермінований
  `article_diffs`. UI показує «AI утримався — потрібен ручний аналіз». Ніколи не вгадуємо.

### G4 — Дайджест-workflow + handoff (L5)
- n8n `law-change-digest` (Schedule trigger, напр. щогодини, АБО webhook з GH Actions після
  монітора): добрати `law_change_log WHERE ai_status='pending' AND article_diffs IS NOT NULL` →
  L2 → L3 → L4 → записати `ai_summary`/`ai_impact`/`ai_confidence`/`ai_model`/`ai_generated_at`,
  `ai_status='drafted'|'abstained'`. Ідемпотентно (бере лише `pending`).
- `LawChangeLogPage.tsx` + `lawChangeLog.ts`: read-only **картка «AI-чернетка»** над `notes`:
  бейдж `AI · впевненість N%` (або «утримався»), `ai_summary`, список впливу по послугах
  (severity-крапка + гіпотеза + статті), посилання на редакцію rada, кнопка **«Вставити в
  нотатку»** (копіює `ai_summary` у `notesDraft`, далі юрист редагує). `notes`/`action` —
  без змін, лишаються людським рішенням.
- Типи `lawChangeLog.ts` оновити під нові колонки (`AiStatus`, `AiImpactItem`, хелпери бейджа).

### G5 — Доки + закриття
- `DECISIONS.md` — рішення: дві стадії (Node diff / n8n LLM); diff-знімок у момент детекту;
  abstention-контракт; severity як юридична (не попит).
- `IMPROVEMENTS.md` — оновити #2а (моніторинг) посиланням на реалізацію; внести deferred:
  поартикульний diff як основний (коли скрейпінг дозріє), email-сповіщення з дайджестом,
  column-scoped review RPC (щоб юрист не міг писати `ai_*`).
- `specs/roadmap.md` — позначити в v2.2 (HITL-панель).
- changelog + session-summary; `Closes #N` при merge.

## Послідовність і чекпоінти

```
G1 ─────────► G2 ─────► G3 ─────► G4 ─────► G5
схема+diff     scope     LLM        n8n+UI    доки
(Node, vitest) (граф)    (Groq,     (handoff)
                         abstention)
   └─ L1 доводиться як детермінований шар ДО появи будь-якого LLM (vitest на diff);
      дайджест вмикається лише коли critics+abstention зелені;
      картка лише ПОКАЗУЄ — рішення (reviewed/dismissed) завжди за Олею.
```

**Стоп-умова.** Якщо на G3 abstention-rate на eval-наборі стабільно високий (модель не може
надійно описати зміну в межах diff) — це **сигнал, не баг**: лишаємо детермінований diff +
«потрібен ручний аналіз» як кінцевий стан (юрист усе одно бачить точний текст змін), а багату
інтерпретацію виносимо в backlog. Свідомо, не патчимо промпт у нескінченність.

## Поза scope (свідомо)
- **Автозастосування** будь-чого: агент не змінює статус послуг (крім наявного флипу в
  `needs_review`), не редагує `form_config`/шаблони, не re-seed-ить `law_chunks`. Лише чернетка.
- **Конкретні правки шаблону/полів** як готовий патч — максимум *гіпотеза* «ймовірно абзац X».
  Точний маппінг норма→поле→абзац шаблону — окрема майбутня ітерація (потребує citation-графа
  глибшого за наявний `*.citations.json`).
- **Поартикульний diff як гарантований** — первинно law-level (надійніше); поартикульне — нарощуємо.
- **Нові закони/статті поза наявним registry** — монітор стежить лише за `law-registry.mjs`.
