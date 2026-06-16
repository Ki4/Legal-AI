# Project Changelog

> **Purpose:** track every change made to the codebase — what was changed, why, and whether it's committed.
> This is the "why" log. For "what" look at `git log`. For "how to build" look at README.
>
> **Who updates this:** Claude (the AI assistant) must append an entry every time it modifies or creates files.
> Sergey can also add manual entries for changes made outside of Claude sessions.
>
> **Format rule:** newest entries at the top. Each entry dated + session number + commit status.

---

## 📋 Pending commits (uncommitted work)

### 2026-06-16 (session 27) — typography phase 2: {{!style:}} → Google Docs styling (#50)
**Status:** COMMITTED · `main` (`06019a7`) · PR#43 merged · задеплоєно
**Why:** Документи генерувались як plain text без жодного форматування — «ПОЗОВНА ЗАЯВА» йшла звичайним текстом. Директиви `{{!style:}}` вже були в усіх шаблонах (зарезервовано в doc-engine #34), але рендерер їх ігнорував. Тепер: `renderDocumentWithStyles()` відстежує styleHints → 3 нові ноди в workflow → Google Docs batchUpdate застосовує реальне форматування. +IMPROVEMENTS #72 (multi-template architecture note).
**Files:**
- `n8n/templates/render-document.js` — `classifyTag` розрізняє `style`/`comment`; `renderNodesInto()` shared builder; `renderDocumentWithStyles()` → `{text, styleHints}`
- `n8n/templates/apply-typography.js` — **NEW** — `buildTypographyRequests(styleHints, docBody)` → Google Docs batchUpdate requests
- `n8n/templates/__tests__/apply-typography.test.js` — **NEW** — 16 тестів
- `n8n/templates/__tests__/render-document.test.js` — +9 тестів для `renderDocumentWithStyles`
- `scripts/sync-typography-nodes.mjs` — **NEW** — ідемпотентний патчер (Get Document + Build Typography Request + Apply Typography)
- `scripts/sync-build-document-node.mjs` — template/hybrid → `renderDocumentWithStyles` + `_style_hints`
- `n8n/workflows/current/form-submit.json` — 34→37 нодів
- `docs/architecture/IMPROVEMENTS.md` — #72 (multi-template)

### 2026-06-16 (session 26) — model-agnostic: GROQ_MODEL у Global Config (#40)
**Status:** COMMITTED · `main` (`988373c`) · PR#41 merged · задеплоєно
**Why:** `model: 'llama-3.3-70b-versatile'` був захардкоджений у `prepare-reasoning.js:150` — невидимий для n8n конфігу. Тепер модель = 1 поле у Global Config; зміна провайдера/моделі без редагування коду. Groq key залишається як n8n credential (достатньо для пілоту); `GROQ_API_KEY` placeholder у Global Config — для майбутнього Code node fallback перед VPS.
**Files:**
- `n8n/templates/prepare-reasoning.js` — optional `modelName` param
- `scripts/sync-hybrid-nodes.mjs` — entry point reads GROQ_MODEL from Global Config
- `n8n/workflows/current/form-submit.json` — Global Config: GROQ_MODEL + GROQ_MODEL_FALLBACK + GROQ_API_KEY
- `scripts/deploy-workflow.mjs` — KEY_MAP: YOUR_GROQ_API_KEY → GROQ_API_KEY
- `docs/architecture/DECISIONS.md` — нова секція «Model-agnostic AI harness»
- `docs/architecture/IMPROVEMENTS.md` — #71 оновлено

> Optional scratch area (simplified session 16) — git tracks uncommitted state, so this is usually empty.
> The session-15 entries below are already committed + merged (kept as the why-log; hashes noted).

### 2026-06-16 (session 25, final) — IMPROVEMENTS #71: model-agnostic ecosystem
**Status:** COMMITTED · `main` (`b7d2d70`) · PR#39 merged
**Why:** Зафіксовано 4 паттерни захисту від vendor lock-in (LiteLLM router / fallback chain / model в конфізі / Ollama self-hosted). Контекст: Fable 5 інцидент доводить, що ШІ-моделі — регульована інфраструктура, яку можуть відключити в будь-яку хвилину.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — #71 в індекс + тіло (4 паттерни, таблиця кроків, пріоритет 🟠)

### 2026-06-16 (session 25, cont.) — alimony-change G5: docs + close #37 + merge (#37)
**Status:** COMMITTED · `main` (`2cedcf8`, `ae3ac80`) · PR#38 merged
**Why:** G5 фіналізує Tier 2-пілот: архітектурні рішення G4 задокументовані в DECISIONS.md,
два відкладені поліпшення (#69 L4b, #70 Google Docs spans) зафіксовані в IMPROVEMENTS.md.
Issue #37 закрито. Сесія 25 завершена, гілка готова до merge.
**Files:**
- `docs/architecture/DECISIONS.md` — новий розділ «Hybrid pipeline (G4)» (no Merge node / injectable checkGroundedness / court fee §3.4 / idempotent sync-hybrid-nodes)
- `docs/architecture/IMPROVEMENTS.md` — #69 (L4b LLM critic) + #70 (Google Docs batch-comments) додані в індекс і тіло

### 2026-06-16 (session 25) — alimony-change G4: handoff + n8n integration (#37)
**Status:** committed · branch `feature/alimony-change-g3` · `a945b10`, `a397866`
**Why:** G4 розширює Build Document dispatch для `generation_mode='hybrid'`, додає 6 нових нодів у form-submit workflow (Is Hybrid? / Skip Hybrid / L2 Get Norms / Prepare Reasoning / L3 Reasoning / L4 Critics) і збирає review-card для юриста. Логіка детермінована: Groq llama-3.3-70b-versatile → L4a critic (groundedness.js) → abstention (RED→fallback) → `ai.reasoning` → шаблон. Деплой потребує запущеного n8n (localhost:5678 не відповідав).
**Files:**
- `n8n/templates/prepare-reasoning.js` — **NEW** — pure fn `prepareReasoning()`: L0 answers + L2 rows → Groq request body + `_l2_article_ids` + `_answers_snapshot`
- `n8n/templates/build-hybrid-context.js` — **NEW** — pure fns: `parseL3Response`, `buildCourtFeeSummary` (§3.4, PM=3328), `buildQuestionsForLawyer`, `buildHybridContext` (L4c abstention + review-card)
- `n8n/templates/__tests__/prepare-reasoning.test.js` — **NEW** — 20 тестів (createRequire, без new Function())
- `n8n/templates/__tests__/build-hybrid-context.test.js` — **NEW** — 40 тестів (vi.fn() mocks, abstention, court fee, questions)
- `supabase/migrations/019_generation_mode_hybrid.sql` — **NEW** — widened CHECK + UPDATE alimony-change to 'hybrid'
- `scripts/sync-hybrid-nodes.mjs` — **NEW** — генерує 6 нових n8n нодів, зсуває 8 downstream нодів +1200px, перемикає з'єднання AI Declension → Is Hybrid?; ідемпотентний
- `scripts/sync-build-document-node.mjs` — MODIFIED — додано гілка `hybrid` у dispatch (читає `$json._ai_reasoning`, `$json._review_card`), `_review_card` у return value
- `n8n/workflows/current/form-submit.json` — MODIFIED — 6 нових нодів + shifted positions + нові з'єднання (deploys pending n8n start)

### 2026-06-16 (session 24, cont.2) — alimony-change G2+G3: граф норм + critics (#37)
**Status:** COMMITTED · `feature/alimony-change-g2` (`8de4e4f`) + `feature/alimony-change-g3` (`0ee2d9b`, `ca776a9`) — не змержені в main
**Why:** G2 будує граф юридичних зв'язків для alimony-change: нова таблиця `law_relations` з двома SECURITY DEFINER RPC (non-destructive upsert_law_chunk + upsert_law_relation), 8 ребрами ст.192→{182,183,184,ст.4/5 ЗСЗ,ст.176/28/27 ЦПК}, RLS (public read only). G3 реалізує критичний рівень (L3/L4): prompt для Groq JSON-mode з enum-обмеженими цитатами, детермінований critic (L4a) для перевірки чисел/дат/ПІБ/справ проти L0, LLM-critic (L4b) для per-sentence статусу GREEN/AMBER/RED + abstention-правило. Знайдено та виправлено: SQL-синтаксис ORDER BY перед FROM у migration 017 (скрін від Сергія) — ORDER BY перенесено після FROM. RLS додав сам Сергій в Supabase → скаптуровано у міграцію 018.
**Files:**
- `supabase/migrations/017_law_relations.sql` — **NEW** — таблиця law_relations + upsert_law_chunk + upsert_law_relation (SECURITY DEFINER, SET search_path, REVOKE PUBLIC, GRANT service_role)
- `supabase/migrations/018_law_relations_rls.sql` — **NEW** — RLS для law_relations (public read, no write policy)
- `scripts/seed-alimony-change-laws.mjs` — **NEW** — seeds 16 статей (СК/ЦПК/ЗСЗ) + 8 law_relations edges, --dry-run, embeddings=null
- `n8n/prompts/alimony-change-reasoning.txt` — **NEW** — L3 Groq JSON-mode prompt (cite only L2_ARTICLE_IDS, 100-200 words, Ukrainian legal prose)
- `n8n/templates/groundedness.js` — **NEW** — L4a critic: citations ∈ L2, amounts/fractions/dates/case_numbers/names ∈ L0 → RED/AMBER spans + has_red flag
- `n8n/prompts/alimony-change-critic.txt` — **NEW** — L4b LLM critic: per-sentence GREEN/AMBER/RED, "суд зобов'язаний" → RED
- `n8n/templates/__tests__/groundedness.test.js` — **NEW** — 16 тестів (ESM vitest, CJS-loader pattern)

### 2026-06-15/16 (session 24, продовження) — alimony-change G1: повна реалізація (#37)
**Status:** COMMITTED · branch `feature/alimony-change-g1` (`9a2cfab`, `273d069`)
**Why:** Пілотна реалізація нового сервісу «Зміна розміру аліментів (↑/↓)» у режимі `generation_mode='template'` (перший сервіс, що не має legacy JS-builder). G1 охоплює: L0.5 routing (route.js), шаблон документа (147 рядків DSL), form_config для UI (TS), 3 golden-сценарії (TC1/TC2/TC9) з очікуваними виводами байт-в-байт, 132 parity-тести (структурна матриця 96 комбо + 29 гілочних перемикачів + 3 golden-луп), citations.json (витягнутий extract-citations.mjs), SQL-міграція 016. Виявлено та виправлено: вкладений `{{ai.reasoning}}` всередині `{{! comment }}` ламав нежадібний TAG_RE-токенізатор → рендер повертав сміттєвий перший рядок.
**Files:**
- `n8n/templates/route-alimony-change.js` — **NEW** — L0.5 route() + ROUTE enum + ABSTAIN_MESSAGES; default enabled=false (G1)
- `n8n/templates/services/alimony-change.document.txt` — **NEW** — 147-рядковий шаблон DSL (юрисдикція, сторони, підстави, збір, борг, ПРОШУ, Додатки)
- `apps/client/src/data/alimonyChangeFormConfig.ts` — **NEW** — FormConfig 4 таби (Сторони/Попереднє рішення/Діти/Зміна обставин), ~38 полів із show_if і hint
- `test-data/alimony-change/fixtures/scenario-{1,2,3}.mjs` — **NEW** — golden-фікстури (TC1 збільш/%, TC2 зменш/fixed non-floor, TC9 зменш/fixed floor+existing_debt)
- `test-data/alimony-change/expected/scenario-{1,2,3}.txt` — **NEW** — байт-ідентичні очікувані виводи
- `n8n/templates/__tests__/alimony-change-template-parity.test.js` — **NEW** — 132 тести (96 структурна матриця + 29 гілочних + 3 golden)
- `n8n/templates/services/alimony-change.citations.json` — **NEW** — авто-витягнутий (СК 182-184/191/192/197, ЦПК 27/28/174/175/176, ЗСЗ 4/5)
- `supabase/migrations/016_alimony_change_service.sql` — **NEW** — INSERT alimony-change (status='disabled', generation_mode='template', watched_laws)

### 2026-06-14/15 (session 23) — Tier-каталог услуг (ТЗ) + критич. обзор legaltech + консолидация веток в main
**Status:** COMMITTED · напрямую в `main` (`35e9381`, `d54aa88`, `a3ccbf9`, + этот коммит) — сессия = свод всего в один main по просьбе Сергея; ветки удалены вручную (git-прокси окружения блокирует ref-delete 403)
**Why:** Сергей с другом-AI-инженером прорабатывали Tier 2/3 услуги: какие услуги попадают в категории, какой Input/Output, как строить AI-харнесс (что детерминировать, где критик, как подсвечивать галлюцинации, что и в каком формате отдавать юристу). Затем — взгляд критика: как это закрывали в мире. Веб-сверка: Stanford (Lexis+ 17% / Westlaw 33% галлюцинаций ДАЖЕ с RAG), DoNotPay/FTC ($193k за overpromise), HotDocs/Docassemble (document automation без LLM 30 лет), Harvey/CoCounsel (юрист в петле + citation grounding + Shepardization, ~0.2%). Вывод усиливает курс: операбельный текст детерминированный, генерация выносится из доверенного пути, abstention + «перевірено юристом» = ров. Закреплён канон Document-Tier 0/1/2/3 (≠ SDD-Tier). Это ТЗ/research — НЕ реализация.
**Files:**
- `docs/research/document-tiers-tz.md` — **NEW** — канон Tier 0/1/2/3 + критич. обзор мирового legaltech (4 эталона, 7 improvements I1–I7); Tier 0 пример (стягнення аліментів: алгоритм + нюансы), схожая Tier 2 (зміна розміру аліментів: сложности/опции/цели, augment→automate)
- `docs/research/service-tiers-and-ai-harness.md` — **NEW** — deep-dive 6-слойного харнесса + 7 дискриминаторов; T1/T2/T3 → канон Tier 0/1/2/3
- `specs/features/alimony-change/{plan,requirements,validation,example}.md` — **NEW** — полное Tier 2 ТЗ: Input/Output, юр. алгоритм (ст.192/182/183/184/191 СК; ст.28/176/175 ЦПК; ст.4/5 ЗСЗ), асимметрия суд. сбора ↑/↓ (exception_if), харнесс L0–L5 (enum-констрейнт + 2 критика + abstention + review-card), пример с подсветкой 🟢/🟡/🔴
- `specs/roadmap.md` — v2.3 указывает на новое ТЗ
- `README.md` — **NEW** — корневой README (EN), порт из ecstatic-bohr (UK-вариант не тащили)
- `docs/architecture/IMPROVEMENTS.md` — порт CI + security-аудита как #53–#68 (+5, чтобы не задеть стабильные #48–#52)
- `apps/client/.claude/{changelog,session-summary}.md` — этот журнал
**Branches:** свёл в main: adoring-dirac (доки, FF), ecstatic-bohr (README+IMPROVEMENTS); fervent-pascal и spec-driven были уже в main. Все 4 удалены — остался только `main`.
**Next:** реализация alimony-change НЕ начата. Перед Tier 2 Опцией C — стендовый eval-харнесс (I1). Рекомендованный v0 = Опция B (юрист пишет обоснование).

### 2026-06-12 (session 21, продолжение) — research GraphRAG-стека + решение в DECISIONS
**Status:** COMMITTED · branch `docs/graphrag-research` → main
**Why:** Сергей принёс кандидатов (PageIndex, LightRAG, NornicDB, Weaviate-стек из видео) и спросил: как в мире строят GraphRAG, можно ли извлекать связи без юриста, есть ли решения «малый корпус без галлюцинаций». Проведено внешнее веб-исследование (Stanford о галлюцинациях Lexis/Westlaw 17–33%, Citation Grounding на украинских судебных данных — regex-извлечение ссылок с precision 1.00, GraphJudger, LightRAG/EraRAG об инкрементальности). Вывод: фреймворки не внедряем (решают проблемы масштаба, которых у нас нет), паттерны заимствуем; связи — по трём ярусам доверия (regex авто / LLM+критик для retrieval / юрист для логико-управляющих); ноль галлюцинаций достигается конструкцией (enum-констрейнт, abstention-фолбэк), не проверкой.
**Files:**
- `docs/research/graphrag-stack.md` — **NEW** — исследование с источниками (разбор 5 кандидатов + доказательная база + ярусы + бюджет)
- `docs/architecture/DECISIONS.md` — новый раздел «GraphRAG-стек: патерни замість фреймворків + три яруси довіри звʼязків» + строка в TOC
- **Addendum (конец сессии):** в оба файла добавлена модель затрат — построение графа = dev-сессии по подписке (без API-ключа; extraction-промпт фиксируется в репо, результат = данные через ревью), платный API только в runtime hybrid-секции, старт возможен на бесплатном Groq. + session-summary: новая секция Session 21.

### 2026-06-11 (session 21) — divorce портовано на шаблон doc-engine (#35)
**Status:** COMMITTED `5760cc1` + docs commit · branch `feature/divorce-template-port`
**Why:** Друга (остання) послуга злазить з hardcoded JS-білдера: контент divorce тепер дані в БД, юрист може правити формулювання без розробника. Спірне зі спеки #34 вирішено: сервіс-специфічні словники (REASONS_MAP, EXEMPT_REASONS) і динамічна нумерація «ПРОШУ» — у самому шаблоні (if-ланцюжки), движок лишився сервіс-агностичним. Движок розширено тільки generic-механізмами, бо легасі-семантика divorce відрізнялась у 4 точках: поля `spouse_*` (аліас), `has_children` = поле форми (шар `answers.*`), нумерований fallback `children_genitive` (шар `ai_raw.*` + `child.raw`), крапка в кінці деталей майна/боргів (хелпер `ensurePeriod`).
**Files:**
- `n8n/templates/render-document.js` — generic-розширення buildContext + `ensurePeriod` (всі з тестами)
- `n8n/templates/services/divorce.document.txt` — **NEW** — шаблон, байт-у-байт еквівалент `buildDivorceDocument`
- `n8n/templates/__tests__/divorce-template-parity.test.js` — **NEW** — 263 parity-тести (матриця нумерації + AI-fallbacks + toggles + 4 голдени)
- `n8n/workflows/current/form-submit.json` — Build Document регенеровано (движок оновився)
- `scripts/set-generation-mode.mjs` — **NEW** — флип `generation_mode` (rollback-інструмент, з guard'ом)
- docs: DECISIONS (divorce-порт), IMPROVEMENTS #52, roadmap, runbook document-template-editing
**Tests:** root vitest 655/655 ✅ (було 385). **Live:** деплой 28 нод → divorce js-регресія exec 40 ✓ → флип template: exec 41 (діти+аліменти), 42 (простий) — live `_content` === движок === legacy байт-у-байт → rollback-флип js exec 43 ✓ → назад template → alimony-регресія exec 44 ✓. Обидві послуги live на `generation_mode='template'`.

### 2026-06-10 (session 15) — local dev runbook + dev-up + Google OAuth recovery
**Status:** COMMITTED `5ce0093` · merged to main via #30
**Why:** Error Trigger (щойно задеплоєний) одразу виявив РЕАЛЬНИЙ тихий збій: нода `Copy Template` падала з Google-OAuth `invalid/expired/revoked` → документи не генерувались, юзер бачив лише «готується». Корінь: OAuth consent screen у Testing → Google анулює refresh-токен за 7 днів простою; плюс ngrok гасився, плюс забутий пароль n8n без SMTP. Зафіксували весь шлях відновлення, щоб не «відкривати в моменті».
**Files:**
- `docs/runbooks/local-dev-startup.md` — **NEW** — чеклист старту (n8n+ngrok), `dev-up.ps1`, gotchas: ngrok offline, OAuth протух → durability-fix (Publish consent → Production), cross-origin login через ngrok-URL, ngrok-interstitial, скидання пароля `user-management:reset`.
- `scripts/dev-up.ps1` — **NEW** — одна команда: підіймає n8n (Docker) + ngrok (статичний домен), idempotent.
**Ops done (live, no repo change):** бекап БД n8n → `user-management:reset` (забутий пароль) → новий власник → Google OAuth переавторизовано (через ngrok-origin) → `docker update --restart unless-stopped n8n`. **Verified:** сабмит exec 34 `success`, lastNode `Send Doc Link` — документ генерується end-to-end ✅.
**Next step (за тобою):** OAuth consent screen → Publish → Production (прибрати 7-денне протухання). Не блокує — токен зараз валідний.

### 2026-06-10 (session 15) — workflow hardening v7: error visibility + guards
**Status:** PENDING COMMIT · Refs #30
**Why:** divorce+alimony — живі послуги, а workflow падав ТИХО при будь-якій помилці після валідації (БД, Groq-таймаут, Google Docs) — юзер без відповіді, оператор без сигналу. Робимо так, щоб провал було ВИДНО.
**Files:**
- `n8n/workflows/current/form-submit.json` — 22→28 нод: **Error Trigger → Format Error → Send Admin Alert** (Telegram-алерт адміну на будь-який unhandled-збій); **Get Profile guard** (`Check Profile` → `Has Profile?` → `Respond No Profile` 422; `alwaysOutputData` на Get Profile/Get Service); try/catch навколо диспатчу Build Document (re-throw з `service+case`); структурний Respond Error (`code/message`).
- `n8n/templates/format-error.js` + `__tests__/format-error.test.js` — **NEW** — формат алерта (5 тестів).
- `n8n/templates/check-profile.js` + `__tests__/check-profile.test.js` — **NEW** — guard-логіка профілю (4 тести).
- `apps/client/src/App.tsx` — на non-503 помилці показує серверний `message` (напр. no_profile) замість загального алерта.
- `docs/architecture/workflow-improvements.md` — секція «v7 applied» + оновлено implementation order.
- `scripts/build-n8n-workflow.mjs` — **DELETED** — застарілий генератор (старі шляхи, divorce-only, захардкожені ротовані секрети, порушення правила #11).
**Tests:** root vitest 162/162 ✅ · client vitest 68/68 ✅ · tsc clean ✅
**Commit:** `a487a01` (branch `feature/workflow-hardening`, pushed) · Refs #30
**Deployed + verified (live):** 22→28 нод, active. Error Trigger спрацював на 3/3 збоях (включно з РЕАЛЬНИМ Google-OAuth падінням `Copy Template` — раніше тихим); no-profile → 422; happy-path → документ end-to-end (`Send Doc Link`).
**Next step:** merge `feature/workflow-hardening` → main з `Closes #30`.

---

## 📜 Commit history (most recent first)

> Append new entries at the top (newest first).

### 2026-06-15 (session 24, продовження) — практичний бриф для друга (.NET AI engineer) + issue #37 (alimony-change Tier 2 pilot)
**Status:** COMMITTED `3d619b2`/`ecb3891`/`b029b1b` · branch `docs/alimony-change-legal-deep-dive`
**Why:** Сергій хоче віддати другу (AI engineer, практика на .NET) самодостатнє практичне ТЗ за мотивами alimony-change — WHAT (вхід/правила/вихід/тест-кейси/критерії), HOW цілком на його розсуд. Окремо: Оля ще не повернулась (~2026-06-25) — позначили 6 пунктів «proposed design» у `test-matrix.md` §6 як pending на той самий таймлайн (зв'язано з `project_cron_schedule_pending`). І заведено issue #37 з чеклістом G1–G5 (`plan.md`) для самого пілота alimony-change — фокус наступної сесії.
**Files:**
- `docs/research/tier2-practice-brief-dotnet.md` — **NEW** — самодостатній практичний бриф (укр.): вхідний JSON, база знань L2 (13 статей, з посиланнями на zakon.rada.gov.ua), L0.5 `route()`, детермінований скелет L1 (registry 2026, 50%-floor як review-card flag, не hard-валідація), L3/L4 grounding+critics, 2 worked examples (TC1/TC3), TC1–TC12, критерії успіху, «що не задано», + посилання на реальні зразки позовних заяв
- `specs/features/alimony-change/test-matrix.md` §6 — нотатка про недоступність Олі (~2026-06-25)
**Issue:** [#37](https://github.com/Ki4/Legal-AI/issues/37) — alimony-change Tier 2 pilot, чекліст G1–G5, G1 не блокується відсутністю Олі (`route()`=`PROCEED` за замовчуванням)
**Next step:** нова сесія — G1 (#37) на окремій гілці: детермінований скелет + L0.5 routing, vitest, без LLM.

### 2026-06-15 (session 24) — alimony-change: юридичний deep-dive (підсудність, індексація, новий шар L0.5)
**Status:** COMMITTED `4ac802b` · branch `docs/alimony-change-legal-deep-dive`
**Why:** Сергій помітив неузгодженість тірів (T0/T1/T2 vs T1/T2/T3) і попросив звести канон + дослідити українське законодавство для пілота Tier 2 (alimony-change), щоб переконатись, що нічого не пропущено, та написати ТЗ (вхідні варіації / тест-кейси / очікуваний вихід). Канон Tier 0/1/2/3 підтверджено (`document-tiers-tz.md`). Юридичне дослідження дало 8 знахідок: 2 КРИТИЧНІ (формулювання `child_needs_up` плутає ст.192 з ст.181/185; `cost_of_living_up` для твердої суми — це індексація ст.184, не ст.192), 2 ВИСОКІ (текст «ПРОШУ» — момент дії; підсудність асиметрична за напрямком), 3 СЕРЕДНІ (значення ПМ-2026; процедура за договором ст.189; борг ст.197) + 1 спостереження (відсутнє значення enum `recipient_income_up`).
**Files:**
- `specs/features/alimony-change/requirements.md` — §0 (юр.алгоритм): нові пп.8 (`agreement_own_procedure`/ст.189), 9 (`existing_debt`/ст.197), резолюція п.7 (момент дії «ПРОШУ»); §1: розбито enum `child_needs_up` → `_general`/`_extraordinary`; нова §2.0 (таблиця маршрутизації `route()`), §2.4 (тексти абстенцій); нова §3.0 псевдокод `route()`; §3.4 конкретні значення ПМ-2026; §4 новий рядок гарнесу `L0.5 Routing`
- `specs/features/alimony-change/test-matrix.md` — **NEW** — «ТЗ для друга»: D1–D9 вхідні вимірювання, таблиця `route()` (R1–R5), детерміновані гілки (підсудність/збір/«ПРОШУ»), L3/review-card специфікація, TC1–TC12 тест-кейси, таблиця «pending Оля» (6 пунктів)
- `specs/features/alimony-change/example.md` — Case A (enum `child_needs_up_general`, текст «ПРОШУ» з моментом дії), Case B (підсудність ст.27 ЦПК, збір 1 331,20 = 0.4×3328)
- `specs/features/alimony-change/plan.md` — G1: новий пункт L0.5-маршрутизації (pending Оля, до підтвердження = завжди PROCEED); шаблон абстенцій
- `specs/features/alimony-change/validation.md` — G1/G2: тести підсудності, «ПРОШУ»-момент, L0.5-маршрутизація, citation-coverage для ABSTAIN_*; нові edge-cases
- `docs/research/document-tiers-tz.md` §6, `docs/research/service-tiers-and-ai-harness.md` §7 — пп.2–4 ✅ RESOLVED (момент дії, ПМ-2026, підсудність); нові пп. для child_needs_up split / cost_of_living_up+fixed / agreement_own_procedure / existing_debt / recipient_income_up — всі «pending Оля»
**Note:** Новий шар L0.5 (`ABSTAIN_EXTRAORDINARY`/`ABSTAIN_INDEXATION`) і нові питання форми (`agreement_own_procedure`, `existing_debt`) — **проєктна пропозиція, не реалізація**; до підтвердження Олею маршрутизація завжди `PROCEED`.
**Next step:** Олі на ревью — таблиця 6 пунктів у `test-matrix.md` §6.

### 2026-06-12 (session 22, продовження) — citation-coverage: regex-екстрактор + golden-страж + закриття дрейфу (#36)
**Status:** PENDING COMMIT · branch `feature/citation-coverage` · Refs #36
**Why:** Шаг 0 GraphRAG (ярус 1 — явні посилання на статті законів: regex, авто-приймається, без ревʼю юриста). Карта каталогу (сесія 22) знайшла дрейф між тим, що цитують шаблони документів, і тим, що відстежує CRON law-monitor через `watched_laws` (cited-but-not-watched = слабка точка: зміна закону може пройти непоміченою). Побудовано regex-екстрактор цитат → golden SSoT (`<slug>.citations.json`) + vitest-страж дрейфу шаблон↔golden → CLI `report`/`sync --dry-run` звіряє golden↔`watched_laws`. Знайдено 2 реальних дрейфи (ст.27 ЦПК divorce, ст.174 ЦПК alimony) і 1 false positive (ст.181 СК alimony — екстрактор коректно розгорнув діапазон «180–184» через en-dash, watched_laws вже коректний). Migration 015 закриває обидва дрейфи + проактивно додає ст.113 СК (divorce, `surname_after_divorce` — готуємо watched_laws заздалегідь під правку шаблону ~2026-06-25).
**Files:**
- `scripts/lib/citations.mjs` — **NEW** — regex-екстрактор (two-pass: citation-перед-законом / закон-перед-дужкою), `expandArticleList` (діапазони через `-`/`–`), нормалізація через `law-registry`
- `scripts/lib/__tests__/citations.test.mjs` — **NEW** — 16 тестів (діапазони, `ст.ст.`, edge case if-ланцюжка, реальні шаблони)
- `n8n/templates/services/{divorce,alimony}.citations.json` — **NEW** — golden SSoT (згенеровано через `--write`)
- `n8n/templates/__tests__/citations-drift.test.js` — **NEW** — страж: `golden === extract(template)`
- `scripts/extract-citations.mjs` — **NEW** — CLI: `--write` / `report` / `sync --dry-run`
- `supabase/migrations/015_citation_coverage.sql` — **NEW** — закриває ст.27 ЦПК (divorce), ст.174 ЦПК (alimony) + додає ст.113 СК (divorce, проактивно). `$json$...$json$::jsonb` dollar-quoting (як migration 010) — без екранування апострофів в українському тексті.
- `docs/architecture/DECISIONS.md` — новий розділ «Citations as data: regex-екстрактор + golden-страж (GraphRAG крок 0)» + TOC
- `specs/roadmap.md` — нова підсекція «2.0 Citation coverage (крок 0, regex-шар) ✅»
**Tests:** root vitest 674/674 ✅ (було 655)
**Live:** migration 015 застосована через Supabase REST (`sbPatch`, без SQL — апострофи в JSON не проблема); `node scripts/extract-citations.mjs report` → «✅ All cited articles are watched» (exit 0). SQL-файл міграції — відтворювана фіксація цієї зміни (ідемпотентний при повторному запуску).
**Note:** перша спроба прогнати SQL-файл вручну в Supabase SQL Editor дала синтаксичну помилку (неекрановані апострофи в `'[...]'::jsonb`, напр. «пред'явлення»). Виправлено переходом на `$json$...$json$::jsonb` (як migration 010) — усуває проблему екранування повністю, без зміни даних (live вже коректний).
**Next step:** merge `feature/citation-coverage` → main з `Closes #36`.

### 2026-06-12 (session 22) — правило model-routing: модель на сессию по тиру задачи
**Status:** COMMITTED · branch `chore/session-22-summary` → main
**Why:** Сергей спросил, стоит ли использовать топ-модель (Fable) для рутинных задач. Решение: модель выбирается раз на сессию по SDD-тиру следующей задачи (1 сессия = 1 фокус → выбор в момент `/session-start`): Tier 0/1 по готовому issue → Sonnet; Tier 2 / архитектура / research / юр-критичное → Opus+. Skill-роутер не пишем — субагенты стартуют с холодным контекстом, совещательной строки в briefing достаточно. Переключение `/model` сохраняет контекст разговора.
**Files:**
- `CLAUDE.md` (root) — пункт «Model per session (routing by tier)» в Session protocol
- `.claude/commands/session-start.md` — briefing завершается строкой **Recommended model** + критерии выбора

### 2026-06-12 (session 22) — карта каталога услуг + ветвлений → вход для GraphRAG шага 0
**Status:** COMMITTED · branch `docs/service-catalog-branching-map` → main
**Why:** Сергей попросил понять полный желаемый каталог услуг (не только live) и от чего зависят ветвления документов — как вход для retrieval-архитектуры (intent detection, FAQ-индексация, clarifying questions из доклада о RAG-маршрутизации). Анализ live-данных (watched_laws + form_config из Supabase + regex по шаблонам) показал: (1) весь семейный кластер сидит на 3 законах — граф один на кластер; (2) ветвления делятся на юр-значимые (≈ готовые рёбра яруса 3 «факт → норма», уже покрыты parity-тестами) и реквизитные; (3) ядро уже реализует детерминированную версию паттернов доклада — техники применимы к трём будущим слоям, не к ядру; (4) найден drift шаблоны↔watched_laws (ст.27, ст.174 ЦПК не watched; ст.113 СК не цитируется) — ровно класс ошибок под regex-слой s21.
**Files:**
- `docs/research/service-catalog-branching-map.md` — **NEW** — каталог 10 услуг, таксономия драйверов ветвлений, правовая база live-услуг, drift-находки, маппинг 7 техник, план шага 0
**Next step:** GraphRAG шаг 0 — regex-экстрактор цитат + sync watched_laws + тест-страж от дрейфа (предложение следующей задачи).

### 2026-06-11 (session 20) — doc-engine: сервіс-агностична генерація документа (Tier 2, #34)
**Status:** COMMITTED on `feature/doc-engine` (spec `6089cb2`, G1 `c8de138`, G2 `91ec5ca`, G3 `285c5c5`, G4 `3c68ba8`, G5 — цей коміт) · merge → main `Closes #34`
**Why:** остання розірвана петля фундаменту — контент документа жив у захардкоджених JS-білдерах усередині ноди Build Document (45K chars, dispatch по slug), `ai_prompt` декоративний → нова послуга/правка формулювання = сесія розробки. Розділено КОД (один движок, тестується раз) і КОНТЕНТ (декларативний шаблон на послугу в БД) — дзеркало доведеної пари DynamicLegalFormBuilder+form_config. Режим = властивість послуги (`generation_mode`), майбутні hybrid/ai_generate — розширення того ж dispatch. Доказ: alimony портовано **байт-у-байт** (117 parity-тестів: матриця 72 комбінації + гілки + 3 голдени) + live-звірка n8n exec'ів. Розриви сторінок/типографіка — зарезервовані `{{!style:}}` директиви (правила-не-позиції), фаза 2 = IMPROVEMENTS #50.
**Files:**
- `specs/features/doc-engine/{plan,requirements,validation}.md` — **NEW** — Tier 2 спека; контракт DSL (§3) = довгоживучий формат, ревʼю Сергієм до коду
- `n8n/templates/render-document.js` — **NEW** — движок: парсер DSL (без eval) + рендерер + хелпери + `buildContext` (computed-шар: імена, гендери, діти)
- `n8n/templates/__tests__/render-document.test.js` — **NEW** — 56 юніт-тестів (кожна конструкція DSL + помилки з номером рядка + скан сирців на eval)
- `n8n/templates/services/alimony.document.txt` — **NEW** — шаблон alimony (SSoT у git; у БД — runtime-копія)
- `n8n/templates/__tests__/alimony-template-parity.test.js` — **NEW** — 117 parity-тестів проти legacy builder + голдени
- `supabase/migrations/014_doc_engine.sql` — **NEW** — `generation_mode` (js|template, CHECK, default js) + `document_template`; **застосовано + верифіковано REST**
- `scripts/upload-document-template.mjs` — **NEW** — generic заливка шаблону (`--dry-run`, ідемпотентний, round-trip звірка)
- `scripts/sync-build-document-node.mjs` — **NEW** — анти-дрейф: нода Build Document ГЕНЕРУЄТЬСЯ з дзеркал (движок + 2 legacy builders + dispatch); інлайн-правка заборонена
- `n8n/workflows/current/form-submit.json` — Build Document 45K→64K chars: + движок + dispatch по `generation_mode` (fallback на legacy js)
- `docs/architecture/DECISIONS.md` — розділ «Doc-engine» (чому шаблон-дані, чому не AI, байт-паритет, правила-не-позиції, анти-дрейф)
- `docs/architecture/IMPROVEMENTS.md` — #49 declension-конвенція, #50 фаза 2 типографіки, #51 admin-редактор; #17 → вирішено інакше
- `docs/runbooks/document-template-editing.md` — **NEW** — як юрист/оператор міняє текст документа (без передеплою)
- `specs/roadmap.md` — техборг «сервіс-агностична генерація» закрито + 3 хвости (divorce-порт, фаза 2, admin-редактор)
- `.gitattributes` — LF-фіксація для шаблонів і test-data (байт-у-байт на будь-якому checkout)
**Tests:** root vitest **385/385** ✅ (було 213, +172). **Live:** деплой 28 нод ✓; e2e до флипу exec 35 ✓; флип alimony→template: exec 36/37 `success`, live-вихід === движок === legacy builder байт-у-байт ✓; rollback-флип ✓ (exec 38); divorce регресія exec 39 ✓. **Стан проду:** alimony на `template`, divorce на `js`.
**Next step:** merge → main (`Closes #34`). Наступні сесії: divorce-порт; фаза 2 типографіки (#50 — запит Сергія «красиві відступи»); admin-редактор (#51).

### 2026-06-11 (session 19) — cron-law-monitor: автоматичний моніторинг змін законів
**Status:** PENDING COMMIT · branch `feature/cron-law-monitor`
**Why:** замикаємо lifecycle-петлю «виробником» записів. Панель ревʼю (s18) вже вміла показувати зміни законів, але їх ніхто не створював автоматично — лише ручний `service-lifecycle.mjs log-law-change`. Тепер CRON сам відстежує zakon.rada → детектує зміну редакції → канонічний flow (`law_change_log` + флип залежних послуг у `needs_review`) → панель Ольги. Хост — GitHub Actions: працює незалежно від ноута/n8n/VPS (надійність важливіша за «все в стеку»), + ручна кнопка, + локальний запуск. Будували одразу під ріст каталогу послуг (дедуп спільних законів, retry/backoff).
**Architecture (anti-drift):** детектор НЕ дублює логіку — переніс канонічний `applyLawChange` у спільний модуль, який тепер кличуть і ручний CLI, і CRON (single producer of `law_change_log`). Ідентичність закону = URL (реєстр), тому спільний закон (СК у divorce+alimony) фетчиться **раз**, не per-service.
**Files:**
- `scripts/lib/supabase-rest.mjs` — **NEW** — спільний REST-клієнт + `loadEnv` (прибрав дубль між 2 скриптами).
- `scripts/lib/rada.mjs` — **NEW** — `extractRevisionDate` (чистий парсер) + `fetchWithRetry` (backoff+jitter+`Retry-After` на 429/5xx/мережеві) + `fetchRevisionDate`. Виправлено баг референса (`printUrl` ReferenceError).
- `scripts/lib/law-change.mjs` — **NEW** — канонічний `applyLawChange` (reverse-index по URL → `law_change_log` `action=flagged` → флип услуг у `needs_review` + bump `last_known_date`). Чисті дані, без console.
- `scripts/check-law-updates.mjs` — **REWRITE** — детектор: ітерує реєстр → детект → `applyLawChange(detected_by='cron')` → Telegram-алерт. Дедуп спільних законів, ідемпотентний (bump дати → наступний прогон бачить «без змін»).
- `scripts/service-lifecycle.mjs` — рефактор: `log-law-change` тепер кличе спільний `applyLawChange` (без інлайн-дублю); спільний supabase-клієнт.
- `.github/workflows/law-monitor.yml` — **NEW** — `workflow_dispatch` (кнопка, з опц. dry-run) + `schedule` (пн 06:00 UTC) **тимчасово закоментований** поки Ольга недоступна (авто-флип нікому ревʼюити; розкоментувати = 2 рядки). Без `npm install` (лише Node built-ins + fetch).
- `scripts/lib/__tests__/rada.test.mjs` + `law-change.test.mjs` — **NEW** — 27 тестів (парс дат + ловушка adoption-date; retry/Retry-After/exhaustion/404-no-retry; reverse-index по URL крізь slug-drift; dry/live applyLawChange).
- `docs/runbooks/law-monitor-cron.md` — **NEW** — налаштування 4 GH-секретів (за Сергієм), ручний запуск, lawyer-review loop, надійність, масштаб.
- `docs/architecture/IMPROVEMENTS.md` — #48 (умовні запити If-Modified-Since/ETag при рості реєстру — відкладено).
- `specs/roadmap.md` — моніторинг змін законів → петля замкнена ✅.
**Tests:** root vitest **213/213** ✅ (було 162 +51 — рада/law-change + інше). Live dry-run проти zakon.rada: парсер коректний (судовий збір збігся з відомою датою).
**🔴 Live finding (рішення за Сергієм):** dry-run виявив 2 РЕАЛЬНІ зміни — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24`. Живий флип НЕ робився (зняв би divorce+alimony з продажу). Ольга недоступна ~2 тижні → ревʼю немає кому робити.
**Next step:** Сергій додає 4 секрети в GitHub (runbook); рішення по живому флипу 2 змін (з урахуванням відсутності Ольги); merge гілки.

### 2026-06-11 (session 18) — services ownership: assign core services to lawyer + security-ack
**Status:** PENDING COMMIT · branch `chore/security-ack-and-ownership-note`
**Why:** після merge #32 виявлено: «Мої послуги» в адмінці порожні, хоча divorce/alimony живі. Корінь — модель власності: `DashboardPage` фільтрує `lawyer_id = user.id`, а сіяні міграціями послуги мали `lawyer_id = null` (бесхозні). Рішення (узгоджено з Сергієм, варіант B): призначити живі core-послуги акаунту юриста — менший blast radius, ближче до майбутньої моделі ролей (`project_admin_lawyer_roles.md`), плейсхолдери лишаються прихованими.
**Ops done (live Supabase, no schema change):** `UPDATE services SET lawyer_id = '2909df04-…' WHERE slug IN ('divorce','alimony')` (service_role). Env-specific (uid з `auth.users`), тому НЕ міграція. **Verified (Playwright, dev admin):** обидві послуги тепер у списку — Активна, з діями статусу + edit/view/delete.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — #47 розширено: acknowledgement security-review migration 013 (3 знахідки) + головна мітигація `disable_signup=true` (invite-only → `authenticated` = команда, 1 акаунт) + чіткий тригер хардингу (RPC/тригер для штампу `reviewed_by` + role-gate ПЕРЕД self-signup / 2-м юристом).
**Security-review (push sweep) — acknowledged, not blocking:** broad `USING(true)` UPDATE, bare-`authenticated` gate, client-stamped `reviewed_by` — усі = свідомо відкладений компроміс #47; мітиговано вимкненою реєстрацією. Деталі + тригер хардингу в #47.
**Note (cosmetic, out of scope):** dashboard показує «0 полів» для tabs-based послуг (лічильник читає `form_config.steps`, alimony на `tabs`).

### 2026-06-10 (session 18) — admin: law_change_log review panel + RLS for authenticated
**Status:** PENDING COMMIT · branch `feature/law-change-log-review` · Refs #32
**Why:** `law_change_log` (migration 011) фіксує зміни відстежуваних законів і флипає залежні послуги в `needs_review`, але юрист (Ольга) не мав, де це побачити — таблиця була RLS-закрита (service_role only). Робимо аудит видимим: панель ревʼю в адмінці, де юрист підтверджує/відхиляє зміну. Прямий наступник #31 — завершує lifecycle-петлю видимою для людини дією.
**Files:**
- `supabase/migrations/013_law_change_log_review.sql` — **NEW** — RLS на `law_change_log`: `SELECT`+`UPDATE` для `authenticated` (юрист читає+позначає ревʼю); `INSERT`/`DELETE` лишаються service_role-only (append-only з UI). **Потребує застосування через Supabase SQL Editor.**
- `apps/client/src/lib/lawChangeLog.ts` — **NEW** — SSoT: типи (`LawChangeAction`/`Row`), `ACTION_META` (UA), `reviewActions` (переходи), `isPending`/`pendingCount`/`formatRevision`, `toLawChangeAction`.
- `apps/client/src/lib/__tests__/lawChangeLog.test.ts` — **NEW** — 14 тестів (guard, переходи, pending-count, формат).
- `apps/client/src/admin/pages/LawChangeLogPage.tsx` — **NEW** — список (нові зверху) + фільтр «лише очікують» (+лічильник) + дії Переглянуто/Відхилити/Повернути + нотатки + чипи зачеплених послуг + хто/коли ревʼю.
- `apps/client/src/admin/AdminApp.tsx` — роут `law-changes` (під AdminGuard).
- `apps/client/src/admin/components/AdminLayout.tsx` — nav-лінк «📋 Зміни законів».
- `docs/architecture/IMPROVEMENTS.md` — #47 (blanket-authenticated RLS без per-tenant scoping — свідомий компроміс соло-фази; як краще: tenant-фільтр / security-definer review RPC).
- `specs/roadmap.md` — пункт «Admin-UI: панель ревʼю law_change_log» закрито.
**Tests:** client vitest 92/92 ✅ (було 78 +14) · tsc -b clean ✅
**Next step:** застосувати migration 013 у Supabase; жива перевірка в адмінці; merge `Closes #32`. Виробник логу (CRON моніторинг zakon.rada) — окрема наступна фіча.

### 2026-06-10 (session 17) — admin lifecycle: is_published → status (single source)
**Status:** PENDING COMMIT · branch `feature/status-single-source` · Refs #31
**Why:** розірвана петля self-service — адмінка писала декоративний `is_published`, а весь serving-шлях (n8n form-submit/main-bot + TWA `App.tsx`) читає `status` (active|needs_review|disabled, migration 011). «Опублікувати» в адмінці нічого не публікувало. Зводимо на `status` як єдине авторитетне джерело; `is_published` лишаємо deprecated-дзеркалом (зворотно, дроп — окрема міграція пізніше).
**Files:**
- `supabase/migrations/012_status_single_source.sql` — **NEW** — реконсиляція `is_published := (status='active')` + COMMENT deprecated. **Потребує застосування через Supabase SQL Editor** (як попередні; не критично для поведінки — `status` вже коректний з 011).
- `apps/client/src/lib/serviceStatus.ts` — **NEW** — SSoT для статусу: тип `ServiceStatus`, `STATUS_META` (лейбли/кольори UA), `statusActions` (дозволені переходи), `toServiceStatus`/`isPublishedFor`.
- `apps/client/src/lib/__tests__/serviceStatus.test.ts` — **NEW** — 10 тестів (guard, переходи, дзеркало).
- `apps/client/src/admin/pages/DashboardPage.tsx` — бейдж 3 станів + дії (Активувати / Вимкнути / Підтвердити для needs_review). Читає+пише `status` (+ дзеркало `is_published`).
- `apps/client/src/admin/pages/ServiceEditPage.tsx` — toggle Опубліковано/Чернетка → status-дропдаун (3 стани). Нова послуга → `disabled`.
- `docs/architecture/ARCHITECTURE.md` — схема `services`: додано `status` (авторитетний), `is_published` позначено deprecated.
**Tests:** client vitest 78/78 ✅ (було 68 +10) · tsc -b clean ✅
**Next step:** застосувати migration 012 у Supabase; (опц.) жива перевірка в адмінці; merge `Closes #31`. Окрема фіча: панель ревʼю `law_change_log` (+ RLS для authenticated).

### 2026-06-10 (session 16) — trim SDD ceremony to tiers (effort ∝ risk)
**Commit:** branch `chore/sdd-trim`
**Why:** для соло-команди повний spec-триплет на КОЖНУ фічу + pending-staging ритуал = overhead, що конкурує зі стройкою (ця сесія — приклад: синхронізував 4 доки руками). Узгоджено: спека потрібна рівно настільки, щоб відпустити агента в автономку і перевірити результат — тобто церемонія ∝ ризик, не звичка.
**Files:**
- `docs/architecture/SDD-GUIDE.md` — рівні **Tier 0/1/2** + тригери Tier 2; Feature Loop позначено як Tier-2-only.
- `CLAUDE.md` (root) — правило tiers у «Issue tracking» (default Tier 1 = issue only; `specs/features/` лише Tier 2).
- `apps/client/CLAUDE.md` — Change Documentation Rule полегшено (прибрано pending-staging; why-log, лише non-trivial).
- `apps/client/.claude/changelog.md` — правила спрощено; «Pending commits» → опціональний scratch; «n8n Error Handler» → ✅ resolved (#30).

### 2026-06-10 (session 14) — IMPROVEMENTS: розведено ID-колізії #12/#20
**Commit:** (this commit)
**Why:** `#N` в IMPROVEMENTS — стабільні ID, але два номери дублювались (#12 = Admin Dashboard + RLS policies; #20 = Service Builder + changelog-skill) → биті anchor-лінки. Розведено за раніше зафіксованою пропозицією.
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — другі входження: «RLS policies» → **#44**, «Skill для changelog» → **#45** (тіла + індекс + anchor'и); ⚠️-маркери прибрано; warning-note → resolved. #1 лишається відсутнім історично (свідомо).
**Note:** перші входження #12/#20 і зовнішнє посилання `(#18/#20)` (= Service Builder, лишається #20) не змінені. Згадки в історії changelog/session-summary не переписувались.

### 2026-06-10 (session 14) — service-lifecycle G5: docs (DECISIONS + roadmap + IMPROVEMENTS)
**Commit:** (this commit) · Refs #29
**Why:** зафіксувати рішення фічі для майбутніх учасників: чому `status`-kill-switch (флип колонки, не деплій), чому `needs_review` блокує як `disabled`, і чому ідентичність закону = URL (не slug). Закрити scorecard.
**Files:**
- `docs/architecture/DECISIONS.md` — новий розділ «Service lifecycle: status kill-switch + ідентичність закону по URL» (+ пункт у зміст)
- `docs/architecture/IMPROVEMENTS.md` — #46 (реєстр-файл → v2 таблиця `laws`) + оновлено «Як краще» в #42 + індекс
- `specs/roadmap.md` — `watched_laws` моніторинг → частково закрито (підпункти: фундамент ✅, CRON/admin-UI — окремо)
- `specs/features/service-lifecycle/validation.md` — scorecard повністю зелений + DoD
**Tests (regression):** divorce 4/4 ✅ · alimony 3/3 ✅ · root vitest 153/153 ✅ · client vitest 68/68 ✅

### 2026-06-10 (session 14) — service-lifecycle G4: manual lifecycle tooling + canonical law registry
**Commit:** `4b708ba` · Refs #29
**Why:** дати людині (Ольга/Сергій) керувати життєвим циклом послуги без деплою: флип `status` за slug + фіксація зміни закону в `law_change_log` з автоматичним флипом залежних послуг у `needs_review`. Виявлено й усунуто баг даних: один і той же закон мав РІЗНІ slug'и у `watched_laws` divorce vs alimony (`simejnyj-kodeks` vs `simeinyi-kodeks`, `cpk` vs `tsyvilnyi-protsesualnyi-kodeks`) → зворотний індекс по slug пропускав би послуги (юридична діра). Рішення: канонічний реєстр законів + матч по URL.
**Files:**
- `scripts/law-registry.mjs` — **NEW** — канонічний реєстр законів (SSoT: slug↔title↔url) + `resolveLaw`/`lawByUrl`/`normalizeUrl`. Інтерим-«справочник»; нормалізована таблиця `laws` відкладена в v2/GraphRAG.
- `scripts/service-lifecycle.mjs` — **NEW** — CLI: `status`, `validate`, `normalize`, `set-status <slug> <status>`, `log-law-change <law> <date>` (зворотний індекс по URL). `--dry-run` скрізь.
**Data fix (live, через `normalize`):** alimony watched_laws slug'и приведені до канону; divorce title «Про судовий збір» уніфіковано. `normalize` ідемпотентний.
**Verification (live Supabase):** reverse index знаходить divorce+alimony (по slug і rada-id 2947-14); live `log-law-change` → log-рядок + обидві→`needs_review` + дата оновлена; `set-status` повертає. Тестовий стан повністю відкочено.

### 2026-06-09 (session 13) — deploy-workflow rate-limit retry + main-bot G3 live deploy
**Commit:** `f5ca036` · Refs #29
**Why:** `activate` після PUT падав на n8n rate-limit. `api()` тепер ретраїть transient «too many requests» (backoff). Зафіксовано live-деплой main-bot (після явного дозволу — деплой блокувався класифікатором).
**Files:**
- `scripts/deploy-workflow.mjs` — retry на rate-limit у `api()`
**Live (main-bot `Ns5VXWiG8Myg3O6S`):** 20→23 ноди, `active: true`; нова `Service Unavailable (bot)` ← правильний live telegram-cred через type-fallback ✅
**Verification (Playwright, dev TWA):** `?service=divorce`→форма; `?service=military`→«тимчасово недоступна» ✅. Telegram-флоу не автотестився (потребує TG-сесії).

### 2026-06-09 (session 13) — service-lifecycle G3: read-path guards (App.tsx + main-bot)
**Commit:** `c6b2d15` · Refs #29
**Why:** доповнити write-path kill-switch (G2) на read-path — неактивну послугу не можна навіть відкрити. (1) TWA не рендерить форму неактивної; (2) бот не віддає кнопку TWA. Write-path 503 лишається авторитетним backstop.
**Files:**
- `apps/client/src/App.tsx` — select `status`; `UnavailableScreen` коли `!= 'active'`; 503/`service_unavailable` показує `message` сервера; BackButton ховається. Константа `SERVICE_UNAVAILABLE_MSG`.
- `n8n/workflows/current/main-bot.json` — +3 ноди (`Is Active? (high|medium)` IF + `Service Unavailable (bot)`), 20→23; false-гілка покриває і «не знайдено».
- `scripts/deploy-workflow.mjs` — ціль `form-submit|main-bot`; credential-fallback за типом (нові ноди); опціональна Global Config-ін'єкція; ім'я бекапу за ціллю.
**Verification:** `tsc -b` ✅ · client vitest 68/68 ✅ · main-bot dry-run 20→23, 0 live-only ✅. (Live-деплой main-bot + Playwright-перевірка зроблені окремо після дозволу — див. наступний запис.)

### 2026-06-09 (session 13) — read-only permission allowlist
**Commit:** `3afc439`
**Why:** зменшити кількість permission-промптів для частих read-only інструментів (через /fewer-permission-prompts: скан транскриптів). Додано лише немутуючі, не-arbitrary-execution патерни; project-scoped.
**Files:**
- `.claude/settings.json` — **NEW** — `permissions.allow`: context7 (docs), playwright/preview screenshots+snapshot, `npm ls *`, `findstr *`

### 2026-06-09 (session 13) — Docs navigation: index in IMPROVEMENTS + TOC in DECISIONS
**Commit:** `939360a`
**Why:** IMPROVEMENTS згруповано по темах, але `#N` — стабільні ID у порядку появи → в тілі не послідовні, незручно читати. Додано відсортований індекс зверху (ID не чіпано — на них посилаються issues/changelog). Виявлено **ID-колізії #12 і #20** + відсутній #1 — позначено в індексі як «чекає рішення».
**Files:**
- `docs/architecture/IMPROVEMENTS.md` — 📇 Індекс (за номером) з anchor-лінками + ⚠️ на колізіях
- `docs/architecture/DECISIONS.md` — 📇 Зміст (логічний TOC)
**Next step:** (опц., чекає дозволу) розвести #12/#20 → #44/#45 з оновленням зовнішніх посилань

### 2026-06-09 (session 13) — service-lifecycle: deploy script + G2 live deploy (deploy-gap closed)
**Commit:** `3c282da` · Refs #29
**Why:** деплой workflow у live n8n був ручною рутиною з пасткою (плейсхолдери ключів у репо-JSON). Скрипт робить це безпечно: бекап live → diff нод → ін'єкція ключів у пам'яті → **збереження env-specific credential-ID** (не з репо) → PUT → activate. G2-guard задеплоєно й перевірено.
**Files:**
- `scripts/deploy-workflow.mjs` — **NEW** — деплой через n8n REST API (`--check` dry-run, `--creds-from=<file>` відновлення прив'язок); бекапи в gitignored `.backups/`
- `.gitignore` — `n8n/workflows/.backups/`
**Verification (live `D2ab06X3pVUWk1py`):** deploy 19→22 ноди, 0 live-only втрачено, 9 cred-прив'язок збережено ✅ · kill-switch disabled `military` → HTTP **503**, `Insert Case` НЕ виконано ✅
**Урок:** перший PUT зламав Supabase-ноди (репо ніс старі cred-ID) → виправлено `--creds-from`. Правило: credential-ID специфічні для середовища, репо ними не керує.

### 2026-06-08 (session 12) — Rule: GitHub Issue tracking
**Commit:** `79f5a6d`
**Why:** Сергій почав використовувати GitHub Issues. Щоб не плодити 5-те дубльоване джерело правди (drift), зафіксували розподіл ролей: issues = статус-борд, що ПОСИЛАЄТЬСЯ на specs/changelog/IMPROVEMENTS. 1 issue/фіча + чекліст G1-G5; Claude рухає статуси через `gh` (довга авторизація); коміти лінкують `Refs/Closes #N`.
**Files:**
- `CLAUDE.md` — нова секція «Issue tracking (GitHub)» + інтеграція в Session protocol

### 2026-06-08 (session 12) — service-lifecycle G2: write-path kill-switch guard
**Commit:** `5826cea`
**Why:** авторитетне enforcement kill-switch на write-path. Після «Get Service» нода-guard блокує генерацію, якщо `status != 'active'` (needs_review/disabled/not_found) — case не створюється, документ не генерується. Захищає навіть пересланий/кешований лінк форми. (Деплой у live n8n зроблено окремо — див. pending «deploy script».)
**Files:**
- `n8n/templates/check-service-status.js` — **NEW** — тестована guard-логіка (дзеркало inline Code-ноди)
- `n8n/templates/__tests__/check-service-status.test.js` — **NEW** — 6 тестів
- `n8n/workflows/current/form-submit.json` — +3 ноди (Check Service Status → Is Service Active? → Respond Unavailable HTTP 503) + rewire
**Tests:** vitest 153/153 ✅ | divorce 4/4 ✅ | alimony 3/3 ✅

### 2026-06-08 (session 12) — service-lifecycle G1: status kill-switch + law_change_log
**Commit:** `fffd813`
**Why:** реалізація G1 спеки. `services.status` (active|needs_review|disabled) = авторитетний kill-switch; `law_change_log` = аудит змін законів. Backfill: divorce+alimony → active (решта disabled). divorce.needs_law_review скинуто (рішення: прапорець був стале leftover, послуга жива). Застосовано + верифіковано через REST.
**Files:**
- `supabase/migrations/011_service_lifecycle.sql` — **NEW** — status + CHECK + backfill + law_change_log (RLS service_role)

### 2026-06-08 (session 12) — service-lifecycle feature spec + deferred compromises
**Commit:** `a2add92`
**Why:** планування Етапу B (service-lifecycle, backend-фундамент) через SDD. Послуга = керований юніт зі `status`-kill-switch + аудит `law_change_log`. Свідомо прийняті тимчасові компроміси винесені в IMPROVEMENTS, щоб не загубити.
**Files:**
- `specs/features/service-lifecycle/{plan,requirements,validation}.md` — **NEW** — спека (scope, guards, scorecard)
- `docs/architecture/IMPROVEMENTS.md` — #41 (needs_law_review дублює status), #42 (law_deps у JSONB), #43 (read-path kill-switch у боті неповний)

### 2026-06-08 (session 11) — Decisions doc (RAG/GraphRAG) + portfolio-value + untrack local settings
**Commit:** `209a8d1`
**Why:** зафіксувати рішення RAG/GraphRAG/Hybrid у DECISIONS.md; зберегти portfolio-value як стратегічний «why»-док; прибрати `.claude/settings.local.json` з git (персональний файл — шум між машинами/сесіями).
**Files:**
- `docs/architecture/DECISIONS.md` — розділ «RAG vs GraphRAG vs Hybrid Template»
- `docs/strategy/portfolio-value.md` — **NEW** — цінність проекту як портфоліо AI Engineer
- `.gitignore` — додано `.claude/settings.local.json`
- `.claude/settings.local.json` — `git rm --cached` (перестали трекати)

### 2026-06-08 (session 11) — Consolidate branches + refresh master context
**Commit:** `e9a2f77` (merges `3c56925`, `d73be82`)
**Why:** робота була розмазана по 3 гілках і session-summary застарів на 2 сесії → втрачався контекст. Звели все в main, оновили master-context. main = єдине джерело правди.
**Files:**
- merge `fervent-pascal-VUvi3` (Блок 0 research) + `spec-driven-development-iLSvy` (IMPROVEMENTS #32-40) → main
- `apps/client/.claude/session-summary.md` — секція Session 11
- `apps/client/.claude/changelog.md` — прибрано історичний «pending», звірено статуси

### 2026-06-01 (session 11) — Service-demand research Блок 0 (Україна)
**Commit:** `d73be82`
**Why:** свіжий проход по реальних джерелах замість старого JTBD (Gemini). Ранг кандидатів + конкурентний teardown + кандидат «військові спори».
**Files:**
- `docs/research/service-demand/00-ukraine.md` — **NEW**
- `docs/research/service-demand/01-candidate-military-disputes.md` — **NEW**
- `specs/roadmap.md` — аліменти готові + секція «Досліджені кандидати»

### 2026-06-01 — SDD constitution + architecture guides (PR #1)
**Commit:** `c4ec281` (merge `claude/spec-driven-development-iLSvy`); follow-ups `56c0323`, `3bf6634` (#32-40)
**Why:** впровадження Spec-Driven Development (brownfield): конституція, agent-команди, гайди.
**Files:**
- `specs/{mission,tech-stack,roadmap}.md` — **NEW**
- `.claude/commands/{session-start,feature-spec,validate,update-changelog}.md` — **NEW**
- `docs/architecture/{SDD,PROMPTING,GRAPHRAG}-GUIDE.md` — **NEW**
- `docs/architecture/IMPROVEMENTS.md` / `DECISIONS.md` — #20-40 (GraphRAG, AI tech debt, Advanced RAG, MCP, portfolio)

### 2026-05-13 (session 10) — Alimony service + monorepo test infra (колишня Group 6)
**Commit:** `492e1be`
**Why:** нова послуга «Стягнення аліментів» end-to-end (3 статуси шлюбу, 1-N дітей, % / фікс); фікс шляхів монорепо в скриптах; нотатка про Playwright+кирилицю.
**Files:**
- `n8n/templates/alimony-document.js` — **NEW** — JS шаблон позову про аліменти
- `n8n/workflows/current/form-submit.json` — Prepare Declension (`defendant_*`) + Build Document (dispatch по service_slug)
- `apps/client/src/data/alimonyFormConfig.ts` — **NEW** — 4-вкладкова форма
- `supabase/migrations/010_alimony_service.sql` — **NEW** — INSERT alimony + watched_laws (СК 180-184)
- `test-data/alimony/*` — **NEW** — 3 сценарії + 17 assertions + golden
- `scripts/{test-document,scaffold-service,test-webhook}.mjs` — фікс шляхів
- **Tests:** divorce 4/4 ✅ | alimony 3/3 ✅ | 17/17 assertions

### 2026-05 (monorepo restructure) — n8n Code Node tests + task-2 runbook (колишні Groups 4 та 5)
**Commit:** `b3c9013` (шляхи `n8n-templates/` → `n8n/templates/`)
**Why:** винесено n8n Code-ноди в тестований JS (79 тестів: validate, shared utils, divorce document); план покращення workflow v7; runbook ротації секретів для Task #2.
**Files:**
- `n8n/templates/validate.js` + `n8n/templates/__tests__/*` — тести Code-нод
- `docs/architecture/workflow-improvements.md` — план v7
- `docs/runbooks/task-2-secrets-rotation.md` — **NEW** — 9-крокова інструкція ротації

### 2026-04-08 — Add strategy docs and change-documentation rules
**Commit:** `795f342`
**Why:** operational hygiene + strategic documents for upcoming Olga meeting. Establishes the Change Documentation Rule so future sessions always log why changes were made.

**Files:**
- `CLAUDE.md` — **NEW FILE** — project-specific instructions with Change Documentation Rule and session protocol
- `.claude/changelog.md` — **NEW FILE** — this file (project-wide "why" log)
- `.claude/session-summary.md` — updated with embedding mismatch note
- `docs/notebooklm/README.md` — **NEW FILE** — upload instructions and use cases
- `docs/notebooklm/01_Strategy_and_Vision.md` — **NEW FILE** — canonical strategy (team, GTM phases, philosophy)
- `docs/notebooklm/02_Product_Philosophy_Escalation.md` — **NEW FILE** — 3 tiers + escalation logic
- `docs/notebooklm/03_Risk_Management_FAQ.md` — **NEW FILE** — 20 Q&A on risks
- `docs/notebooklm/04_Tech_Roadmap_Phase_0_1.md` — **NEW FILE** — 16-week detailed plan
- `.gitignore` — exclude `supabase/.temp/`

**Related task:** Phase 0 preparation, partner alignment, operational hygiene

---

### 2026-04-08 — Prep for auto-create user flow (Task #1)
**Commit:** `6e41cee`
**Why:** the current n8n workflow assumes the user already exists in `profiles` table (created via `/start` in the bot). This breaks when a user opens a forwarded form link without ever going through `/start`. Code-side preparation done, n8n UI wiring deferred until Task #6 (rate limit + initData verification).

**Files:**
- `src/App.tsx` — added `user_first_name` field to webhook payload (resolved from `tg.initDataUnsafe.user.first_name`, fallback `'Клієнт'`)
- `n8n-templates/ensure-profile.js` — **NEW FILE** — full Code Node JavaScript for n8n with idempotent profile lookup/create logic and application-level rollback

**Priority:** deprioritized from Critical → P2 because it only blocks forwarded-link scenario which is not needed for PoC (Phase 0 has only Sergey + Olga as users).

**Related task:** Task #1 — auto-create user on forwarded-link scenario

---

### 2026-04-08 — Fix 13 Telegram UX issues
**Commit:** `1d5aafc`
**Why:** 13-issue Telegram UX audit revealed gaps in swipe handling, draft persistence, back button, haptics and viewport handling on mobile devices. All issues fixed.

**Files:**
- `src/components/DynamicLegalFormBuilder.tsx` — draft persist via localStorage `draft_{slug}`, Telegram BackButton, `h-dvh`, improved swipe, haptic feedback. New required prop `serviceSlug`.
- `src/components/form/FormField.tsx` — extracted `evalCondition` into `lib/conditions.ts`, added phone input mask
- `src/lib/conditions.ts` — **NEW FILE** — single source of truth for `evalCondition`
- `src/lib/telegram.ts` — **NEW FILE** — Telegram WebApp helpers

**Related task:** Telegram UX audit

---

### 2026-04-08 — pre-existing (everything before changelog was introduced)
**Commit:** `b6796a1` and earlier. See `git log` for history before this changelog. Notable:
- `b6796a1` — product presentation for lawyer meeting
- `651e1bf` — GDPR consent screen, privacy policy, retention policy
- `17ab834` — Session 6: AES-256-GCM encryption for cases + deployment fixes
- `2b830e3` — Session 5: infrastructure for multi-service support

---

## 🛑 Known issues and technical debt

Things we know about but haven't fixed yet. Review at the start of each session.

### Security — ✅ RESOLVED (session 9, 2026-05-12)

- **Secrets in n8n workflow JSON + Git history** — ✅ **ROTATED in session 9:** all keys rotated (`SUPABASE_SERVICE_KEY`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`, `VITE_SUPABASE_ANON_KEY`); old keys revoked at source. Leaked values in git history are now invalid. Runbook: `docs/runbooks/task-2-secrets-rotation.md`. Live secrets now in `.env.local` (gitignored) / n8n Credentials.

### Data quality

- **🟢 LOW PRIORITY — `law_chunks` table is UNUSED (dead data, 21 chunks).** Current workflow `form-submit` uses the hybrid template approach (law citations baked into the JS template), no embeddings. Decision (2026-04-08): leave as-is; revisit at Tier 2 / GraphRAG design (v2), where we pick ONE embedding model, re-seed, re-enable retrieval. Action when revisited: fix outdated comment in `scripts/seed-divorce-laws.ts` (says `text-embedding-004`, actual `gemini-embedding-001`).

### User flow
- **Auto-create user flow (Task #1)** — broken for forwarded-link scenario. Code prep done, n8n wiring deferred (not needed for PoC).

### UX
- **Error UX** — on AbortError (timeout), App.tsx incorrectly shows SuccessScreen even if data didn't reach n8n. Fix before Phase 1.
- **n8n Error Handler** — ✅ RESOLVED (session 15, #30): Error Trigger → admin Telegram alert in `form-submit`. Caught a real silent Google-OAuth failure on first deploy.

### Future (post-PoC)
- Rate limiting + Telegram initData signature verification (before first external demo)
- Lawyer invitation system + admin role (before Phase 1)

### Architectural debt — 🟢 LOW PRIORITY
- **Admin panel shares one build with TWA** inside `apps/client/`. Target (when Uncle joins): split into `apps/twa` + `apps/admin` + `packages/shared`. Interim rule: keep shared code in `src/lib/` / `src/types/`, no new tight coupling between TWA and admin. Do NOT refactor before PoC validated.

---

## 📝 Changelog rules (how to add entries)

This is a **why-log**, not a staging area (simplified session 16). `git log` answers "what"; entries here answer "why".

1. Log only **non-trivial** changes — skip typos / formatting / pure renames whose "why" is obvious from the diff.
2. After a logical unit of work, append ONE dated entry to **"Commit history"** (newest on top) with **Why** + **Files** (+ commit hash once known).
3. **No "Pending commits" staging ritual** — git already tracks uncommitted state. The section at the top is kept only as an optional scratch note; leave it empty if unused.

**Format for a new entry:**

```markdown
### Group N — Short descriptive title
**Status:** PENDING COMMIT | COMMITTED: <hash>
**Why:** 1-3 sentences explaining the motivation and context.

**Files:**
- `path/to/file.ts` — one-line description of the change

**Related task:** link or name
**Next step:** what happens next
```
