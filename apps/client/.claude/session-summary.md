# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤48) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**Що live у проді (form-submit `D2ab06X3pVUWk1py`):**
- **2 послуги** — divorce + alimony. Документ приходить **приватним файлом PDF+DOCX** у Telegram
  (PII закрито, Google Doc видаляється). Склонення ПІБ = живий LLM-крок Groq + детермінований
  **stem-guard** (відкат у називний при галюцинації). #67 divorce: майно/борги → окреме провадження (Variant B).
- **Агент «що змінилось» (law-change-impact) — живий end-to-end:** монітор rada → `law_change_log`
  `pending` → workflow `law-change-digest` (n8n id `qTOIqllA4CQvBJs5`) робить L2→L5 → юрист бачить
  `AiDraftCard` у панелі «Зміни законів». G4 (PR#74) + G5 докі (PR#75) змержено, issue #73 закрито.

**🔴 Наступна задача (НОВА СЕСІЯ — issue #76, частина 2):** **#87 divorce** — той самий блок ЦПК
ст.175 ч.7 (реквізити рахунку), але під `{{#if alimony_claim}}` (лише аліментна гілка = стягнення).
**Alimony вже зроблено й змержено** (PR#81, `a8bb185`). Патерн: шаблон `divorce.document.txt` +
legacy-білдер `divorce-document.js` СИНХРОННО (parity engine===builder!) + форма `divorceFormConfig.ts`
(React, не config) + parity-голдени. План/місця: `docs/research/cpk-175-7-account-requisites.md` §3.
Поля/валідатор `validateIban` вже існують (зроблено в alimony). Потім **деплой** + sign-off Олі.

**Гілки:** `main` чистий — усе сьогоднішнє змержено (AI-процес #78, DONE-rollup #79, CRON #80, alimony #81).

**📋 Список Олі (sign-off 1 липня):** (1) **#87 alimony — done (live після деплою); divorce — наступним**;
(2) #67 divorce wording «спір… відсутній» → «не є предметом цього позову»; (3) флип `alimony-change`
`disabled→active`. **✅ #33 CRON — закрито** (schedule увімкнено, 2 находки adjudicated: СК dismissed, ЦПК→#87).

**Модель (червень):** Opus + ultra-code (memory `feedback_model_opus_ultracode_june2026`; переглянути ~липень).

**Запуск середовища:** n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`).
Деплой form-submit: `node scripts/deploy-workflow.mjs form-submit`. Деплой дайджесту:
`node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`.
Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n` (+ `npm test` для UI). CI-гейт: `.github/workflows/test.yml`.

**⚠️ Інфра:** WebStorm-термінал (JediTerm) не скролить Claude Code TUI → великі звіти писати у `.md`
(memory `feedback_reports_to_file`).

---
## 🆕 Session 52 (2026-06-29) — AI-процес + гігієна памʼяті + #33 CRON + #87 alimony (5 одиниць, усе в main)

### Головне — стан ЗАРАЗ
- **main чистий**, 4 PR змержено: #78 (AI-процес), #79 (DONE-rollup), #80 (CRON #33), #81 (alimony #87).
- Велика багатотемна сесія (свідомо роздули контекст). Наступне — **divorce #87** у НОВІЙ сесії.

### Що зроблено
1. **AI-процес (розбір `genkovich/sdd` під відео Beer::Code)** — плагін цілком НЕ ставимо (конфлікт з нашим SDD + роздуває контекст), cherry-pick: апгрейд `/interview` skill (depth-dial + probing-frames + stuck-protocol, вихід на наш `/feature-spec`), `GOTCHAS.md`, правила «Working process» у CLAUDE.md. #92/#94/#95 ✅; #93 evals ВІДКЛАДЕНО (спершу курс).
2. **Гігієна памʼяті (#94):** `session-summary` 2011→131, `changelog` 1355→89; старе → `apps/client/.claude/archive/`. Виправлено факт: авто-«8000-char хука» немає, `/session-start` читає файл цілком.
3. **IMPROVEMENTS DONE-rollup** (Explore-субагент + кросс-чек): таблиця ~27 зашипованих #N + superseded. Тіла/ID не чіпали.
4. **#33 CRON — закрито:** прогнано монітор живцем (`law_change_log #6` СК dismissed, `#7` ЦПК reviewed→#87), baselines забамплено, divorce+alimony реактивовано, `schedule:` увімкнено (пн 06:00 UTC). Секрети вже були.
5. **#87 alimony (issue #76, ч.1):** блок «частина сьома ст.175» (реквізити рахунку) синхронно в шаблон+legacy-білдер (parity engine===builder **117 ✅**), 2 гілки (є/немає рахунку), голдени регенеровано, форма +4 поля, `validateIban` (UA mod-97)+тести, sampleAnswers. UI 274 ✅ · root 1013 ✅ · tsc clean.

### 🔴 Наступний крок (нова сесія)
- **#87 divorce** — той самий патерн під `{{#if alimony_claim}}` (шаблон+legacy-білдер divorce СИНХРОННО, parity!) + `divorceFormConfig.ts` (React) + parity-голдени. validateIban/поля вже є. Деталі: `docs/research/cpk-175-7-account-requisites.md` §3. Потім деплой live (`upload-document-template.mjs alimony/divorce` + `upload-alimony-config.mjs`) + sign-off Олі.
- **Демонстрації субагентів/паралелізму** — Сергій хоче навчитись (memory `feedback_subagents_parallel_workflow`): паттерн A показано (Explore-аудит у фоні), паттерн B (git worktree) — показати на фічі.
- **Превью-модуль TWA** (Сергіїв фокус): превью→оплата(заглушка)→документ, картинка стр.1+блюр+watermark, доставка через Supabase signed URL (не Telegram Cloud). Стартувати через `/interview` під наш РЕАЛЬНИЙ стек (Gemini-промпт мав вигаданий NestJS/Next.js).

### 🪤 Урок сесії
- Parity для divorce/alimony = **engine===legacy-builder**, не лише голдени → нову юр-логіку вносити в ОБИДВА файли синхронно (інакше 117 parity червоніє). У GOTCHAS.

---
## 🆕 Session 51 (2026-06-29) — law-change-impact G4: дайджест-workflow ЗІБРАНО + ЗАДЕПЛОЄНО live

### Головне — стан ЗАРАЗ
- **Гілка `feat/law-change-digest-workflow`** (НЕ змержено). main чистий. Workflow `law-change-digest` **CREATED+active** у живому n8n (id `qTOIqllA4CQvBJs5`, 10 нод).
- **Агент «що змінилось» живий end-to-end** (фінальна група G4 фічі `law-change-impact`, Tier 2, roadmap v2.2 🔴): монітор пише `law_change_log` рядок `ai_status='pending'`+`article_diffs` (G1, на main) → workflow робить L2→L3→L4→L5 → юрист бачить `AiDraftCard` у панелі «Зміни законів» (UI вже на main, `LawChangeLogPage.tsx:208`). Закриває єдиний реальний юр-ризик (проґавлена зміна закону).

### Що зроблено
- **`scripts/build-law-change-digest.mjs` (new)** — генератор workflow JSON з SSoT (анти-дрейф, як sync-*.mjs): інлайнить `law-change-scope.js` (L2), `law-change-groundedness.js` (L4a), промпт `law-change-digest.txt` (L3). Connection-integrity guard. `--check` = CI-страж від дрейфу.
- **`n8n/workflows/current/law-change-digest.json` (new, 10 нод):** Schedule (щогодини) + Webhook (GH-Actions kick / тест) → Global Config → **Fetch Chunks → Fetch Relations → Fetch Pending** (ЛІНІЙНИЙ ланцюг — урок: n8n v1 execution depth-first **НЕ чекає** паралельні гілки, fan-out дав `Node hasn't been executed`; `executeOnce`+`alwaysOutputData` → один фетч, ланцюг переживає порожню чергу/граф) → **Compute Scopes** (per-row scope+severity-стеля+промпт; нормалізує `"Стаття N"`→`"N"` бо `changed_articles` голі номери) → **L3 Reasoning** (Groq strict-JSON per-row) → **Critique & Decide** (L4a groundedness RED→abstain + confidence-гейт + severity clamp до стелі L2) → **Write Result** (PATCH лише `ai_*`).
- **Self-contained:** 0 n8n-credentials — секрети через Global Config-expression (`Bearer {{GROQ_API_KEY}}`, Supabase apikey/Bearer). Закомічений JSON = лише `YOUR_*` плейсхолдери (deploy інжектить у памʼяті). Перевірено: 0 ключів у файлі.
- **`scripts/deploy-workflow.mjs`** — `+ target law-change-digest` + `--create` режим (POST нового workflow, друкує id) + винесено `injectKeys()`.

### Live verify (3 webhook-прогони, тестовий рядок = реальна зміна ЦПК ст.175 ч.7 #87)
- **exec 163 `drafted`:** summary + per-service (alimony/court_search/divorce), `evidence` дослівний, severity clamped→medium (diff non-substantive → softened), confidence 0.7 → `ai_*` записані коректно.
- **exec 162 `abstained`:** RED-span спрацював (LLM скопіював evidence з декоративним `+ `-префіксом → не verbatim) — **полагоджено**: diff подається без інлайн-маркерів (блоки ДОДАНО/ВИЛУЧЕНО), evidence тепер matchиться дослівно.
- **exec 164 порожня черга:** success no-op.
- Тестовий рядок прибрано (`law_change_log`=0). migration 027 застосована (підтверджено наживо), 21 active chunk, 0 verified relations (scope через direct `service_slugs`).

### 🔴 Наступний крок
0. **▶ НАСТУПНА СЕСІЯ (готово до старту): IMPROVEMENTS #87 → issue #76** — ЦПК ст.175 ч.7 реквізити рахунку позивача в alimony + divorce. Повний impact-аналіз + чернетки полів/блоку + parity-вплив + питання Олі: `docs/research/cpk-175-7-account-requisites.md`. План: G1 alimony (зразок) → G2 divorce → G3 IBAN-валідатор → G4 деплой+smoke. Tier 2 (legally-sensitive), фінальне формулювання — sign-off Олі (кодити можна з placeholder, як #67). 🪤 це **ч.7** ст.175, НЕ «п.7 ч.3» (вже в шаблоні).
1. **Merge гілки** `feat/law-change-digest-workflow` ✅ ЗМЕРЖЕНО (PR #74) + G5 докі (PR #75), issue #73 закрито. Тести 1013 ✅.
2. **G5 доки:** DECISIONS (2-стадійність Node-diff/n8n-LLM, abstention-контракт, severity юридична) + IMPROVEMENTS deferred (L4b LLM-критик — наразі лише advisory AMBER, не гейт; поартикульний diff як основний; column-scoped review RPC).
3. **Звʼязка з монітором (опц.):** GH-Actions `law-monitor.yml` може POST-ити webhook `law-change-digest` після `check-law-updates` (зараз workflow і так бере pending за Schedule щогодини).
4. **Список Олі (1 липня):** #87 (ЦПК реквізити рахунку), #67 wording, флип `alimony-change`, увімкнення CRON `schedule:`.

### Запуск середовища
- n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`). Деплой: `node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`. Тест: `curl -X POST http://localhost:5678/webhook/law-change-digest -d '{}'` (потрібен pending-рядок з `article_diffs`). Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n`.

---

## 🆕 Session 50 (2026-06-26) — Declension stem-guard ЗАДЕПЛОЄНО live + ЗМЕРЖЕНО в main

### Головне — стан ЗАРАЗ
- **main чистий + запушено.** Дві одиниці змержено+задеплоєно цю сесію: (1) declension stem-guard (`835d282`), (2) **#67 divorce майно/борги Variant B** (`d68a92b`, **issue #67 ЗАКРИТО**). Обидва у проді form-submit.
- Закрито 🔴-крок session 49 (guard) + GATED-під-Олю #67 розблоковано рішенням Сергія: **робимо по власному дослідженню, sign-off Ольги пост-фактум 1 липня** (фаза презентації, малий радіус помилки). Стратегія: `docs/strategy/where-we-are-and-scaling.md` (2 послуги = доказ пайплайна+витрина; масштаб = Service Builder + формальний sign-off, hybrid потім).

### #67 divorce — майно/борги в окреме провадження (Variant B), live
- Merge гілки session 43 + конфлікти (session-summary/IMPROVEMENTS/changelog) резолвлено вручну. Шаблон залито: `upload-document-template.mjs divorce` → Supabase (16562→14149 chars). Прод більше не друкує `________` за майно/борги.
- **Verify:** live smoke exec 160 (майно+борги+діти+аліменти) — нова формулювання, ПРОШУ 1-6 без пунктів майна/боргів; divorce-тести **302 ✅**.
- ⚠️ **Список Ольги (1 липня):** «спір… відсутній» → точніше «не є предметом цього позову».

### Guard — що зроблено
1. **Інфра звірена наживо:** локальний n8n `/healthz` 200, ngrok `/healthz` 200 (`rosy-caution-progeny.ngrok-free.dev → :5678`), Docker `n8n` Running.
2. **Деплой:** `node scripts/deploy-workflow.mjs form-submit` → live `D2ab06X3pVUWk1py` (48 нод, active, credentials збережено, бэкап у `.backups/`).
3. **3 webhook-прогони** (`test-webhook.mjs`): 157 minimal · 158 divorce (scenario 1) · 159 alimony (a1) — усі `success`.
4. **Merge + push** `--no-ff` у main (`835d282`).

### Verify (live, executions API) — guard non-destructive
- **divorce 158** `_abstained=null`: `із Петренком Андрієм Сергійовичем`, `між мною, Петренко Оксану Іванівну` — інструментал істця/відповідача коректний, без відкату.
- **alimony 159** `_abstained=null`: `Стягнути з Іванова Івана Івановича на користь Іванової Інни Петрівни` (генитив), `уклала шлюб з Івановим Іваном Івановичем`, дитина `Олега Івановича`.
- Деструктивний відкат галюцинацій — покритий 19 unit-тестами (наживо без підміни AI-виходу не форсувати).
- ⚠️ Тести створили кейси під тест-identity `236581343` + реальні `sendDocument` у цей чат (як попередні сесії).

### 🔴 Наступний крок (нова сесія)
- **GATED-під-Олю розблоковано** (Оля повернулась 25.06). Зроблено цю сесію: ✅ #67 (змержено+live), ✅ law-monitor+CRON верифіковано, ✅ 403-фікс, ✅ diff СК/ЦПК.

### 📋 Список для Олі (1 липня) — оновлено цю сесію
1. **#67 divorce wording:** «спір… відсутній» → точніше «не є предметом цього позову» (вже live, sign-off пост-фактум).
2. **🔴 ЦПК ст.175 ч.7 (Закон №4833-IX, 07.04.2026) — НОВЕ, знайдено diff'ом:** позов про стягнення грошей має містити **реквізити рахунку позивача**. Зачіпає alimony + divorce(alimony_claim); форма/шаблон не збирають → формальна неповнота. Деталі + план: **IMPROVEMENTS #87**. Питання Олі: формулювання блоку, чи IBAN обов'язковий.
3. **СК-зміна — НЕ материально** (ст.65/177/287, не наші) — до відома.
4. **CRON `schedule:` (#33):** workflow перевірено живим, але вмикати ПІСЛЯ розрулення 2 змін (інакше авто-флип divorce+alimony у needs_review).
5. **Флип `alimony-change` `disabled→active`** — hybrid, НЕ пріоритет (рішення Сергія).

- **Repo-only альтернативи:** A3 drift-тест (цитата ∈ KB) · A2 DeepEval-гейт.

### ⚠️ Інфра-зачіпка (НЕ код, перенесено з session 49)
- WebStorm-термінал (JediTerm) не скролить Claude Code TUI — великі звіти писати у `.md` (memory `feedback_reports_to_file`).

---

## 🆕 Session 49 (2026-06-26) — Declension stem-guard (DO-NOW з C-EXCEPTION) — на гілці, деплой ВІДКЛАДЕНО

### Головне — стан ЗАРАЗ
- **Гілка `feat/declension-stem-guard`** (`06365e5` код + docs-коміт закриття), **НЕ змержено**, **live n8n НЕ задеплоєно**. main чистий.
- Реалізовано детермінований stem-guard над AI-склоненням ПІБ — єдиним живим LLM-кроком пайплайну. Pure-логіка + тести готові; **прод-поведінка ПОКИ незмінна** (бо не деплоєно).

### Що зроблено
- `n8n/templates/render-document.js`: нові pure-функції `normalizeDeclensionWord/commonPrefixLen/wordStemOk/declensionStemOk/guardDeclension` (після `joinName`); 4 поля `aiSafe` (plaintiff/defendant × instrumental/genitive) обгорнуто `guardDeclension(name, ai)` — субсумує старий `|| name` empty-fallback. **LENIENT-tuning**: відхиляє лише явні mismatch (підмінене слово / інша к-сть слів), бо хибний відкат коректної форми псує якість.
- `Build Document` node регенеровано (`sync-build-document-node.mjs`, 74819→78133 chars), guard інлайнено у `form-submit.json`. **Деплой live — НІ.**
- Parity-фікс: synthetic «swap» кейси (`*-template-parity.test.js`) спаровували переставлені імена зі старим (жіночим) AI-склоненням → guard правильно це ловив і ламав parity. Зроблено фікстури самосогласованими (чоловічий істец → чоловіче склонення, як виробляв би живий AI). Engine===builder збережено.
- Тести: guard **19 ✅** · parity divorce+alimony **263 байт-у-байт ✅** · повний n8n+scripts **1008 ✅** (+19).

### 🔴 Наступний крок (нова сесія)
1. **Деплой guard у live n8n** (live-risk, свідомо відкладено): `node scripts/deploy-workflow.mjs form-submit` + **ОБОВʼЯЗКОВИЙ реальний webhook-тест** генерації divorce/alimony (потрібен Docker n8n + ngrok у терміналі Сергія). Доки не задеплоєно — guard лише в репо/тестах.
2. **Альтернативи:** A3 drift-тест (цитата ∈ KB, repo-only) · GATED-під-Олю (#67 wording, флип alimony-change, 2 зміни законів + CRON `schedule:` #33 — Оля повернулась 25.06).

### ⚠️ Інфра-зачіпка (НЕ код, не блокує роботу)
- WebStorm вбудований термінал (JediTerm, `Mouse reporting`) **не скролиться** в Claude Code TUI — не помогли ні Shift, ні PgUp/PgDn, ні зняття галки «Mouse reporting». Сергій пробує **перезапуск WebStorm** (термінал перечитує налаштування лише на новий процес). Запасний шлях: транскрипт `C:\Users\serge\.claude\projects\C--Users-serge-Legal-AI\*.jsonl`, або великі звіти писати у `.md`-файл репо (memory `feedback_reports_to_file`).

---
