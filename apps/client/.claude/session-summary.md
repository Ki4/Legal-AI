# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤48) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🔴 АКТИВНА ФІЧА: preview-module (issue #83) — гілка `feat/preview-module` (НЕ змержено).**
Превʼю(HTML-витяг)→оплата(заглушка)→документ(signed URL). Спека: `specs/features/preview-module/`.
Зроблено й **верифіковано наживо** (session 54): **G1** (міграція 029) + **G2** (екстрактор) + **G3-core**
(form-submit задеплоєно). Лишилось: **G4** (preview-pay workflow), **G5** (TWA-UI)+бот-UX, **G6** (докі),
**G3b** (rate-limit). ⚠️ **Наскрізний потік НЕПОВНИЙ до G4+G5** — юзер бачить «📝 Формую…» у боті й
**не отримує документ** (бот-доставку знято). Фаза витрини, трафік контролює Сергій. Rollback form-submit:
редеплой `.backups/form-submit.live-2026-06-29T23-56-37*.json`.

**🔒 G4 РІШЕННЯ ЗАФІКСОВАНІ (інтервʼю session 55) — кодити без здогадок:**
- **A4/GDPR (інваріант 7):** документ у Telegram-чат **за замовч. НЕ йде** (Telegram Cloud=GDPR-ризик);
  основний канал = signed URL у TWA; бот-доставка PDF = лише opt-in за згодою юзера (param default off).
- **A3 TTL = 24год**, ре-мінт дозволено поки case живий. **A5 = лише PDF** цю ітерацію (DOCX-через-URL →
  окрема група IMPROVEMENTS #99: перевідкриває bucket-MIME 029 + DOCX-export form-submit).
- **Edge не-готового case:** preview-pay відмовляє 4xx, **НІКОЛИ не флінає `paid` без готового документа**;
  TWA — доброзичливе «технічні труднощі, спробуйте пізніше» (не сирий 500). Ідемпотентність: pay на `paid`
  → re-mint без 2-го флипу. Окремий rate-limit на preview-pay НЕ треба (initData+upstream limit).
- **Verify-рівень:** повний цикл (guard-тести + deploy `--create` + webhook-smoke). Потрібні Docker n8n+ngrok.
- Деталі — `specs/features/preview-module/` (requirements §5 + plan G4 = locked). Беклог-наслідки: #97
  (failure-UX retry+email), #98 (failure stats+evals), #99 (DOCX-група).

**📦 Теплі факти для G4 (preview-pay) — щоб стартувати зі свіжого вікна:**
- **Схема `cases`** (міграція 029 жива): owner = **`user_id`** (НЕ profile_id); `status` — **free-text**
  (БЕЗ CHECK, legacy='submitted'); lifecycle `generating→preview_ready→paid→delivered|failed`; нові поля
  `paid/paid_at/preview_excerpt/doc_storage_path/preview_meta`. `service_id` (НЕ slug) на рядку.
- **Storage:** приватний bucket **`generated-documents`** (public=false, PDF-only, service-role-only).
  Шлях = **`cases/{case_id}.pdf`** (== `doc_storage_path`). Підпис: `POST /storage/v1/object/sign/generated-documents/{path}` (service key) → signed URL. **Жоден anon-доступ** (RLS deny — перевірено).
- **Секрети:** `Global Config` нода дає `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (deploy інжектить реальні,
  у JSON лише `YOUR_*`). Supabase n8n-cred id `2hBYjVwFlJbTj7AK`.
- **initData verify (#56):** реюз `n8n/templates/verify-init-data.js` (`resolveSubmission`/`verifyInitData`)
  — точно як у form-submit. Bot token = `Global Config.TELEGRAM_BOT_TOKEN`.
- **Деплой нового workflow:** `deploy-workflow.mjs <target> --create` (POST, друкує id) — як law-change-digest.
  Self-contained, 0 n8n-creds, секрети через Global Config-expression. Guard-тест за стилем
  `law-change-digest-workflow.test.js`. Ідемпотентний sync/build-скрипт + `--check`.
- **preview-pay контракт:** Webhook → Verify initData → Get Case (`user_id==telegram_id`, assert
  `doc_storage_path` set / status∈{preview_ready,paid}) → Set Paid (`paid=true,paid_at,status='paid'`)
  → Mint Signed URL (TTL 24год) → (A4) опц. Send PDF у бот → Respond `{signed_url, expires_at}`.
  Ідемпотентність: повторний виклик на paid → re-mint, без подвійного флипу.
- **🪤 n8n depth-first clobber** (GOTCHAS): sibling-нода fan-out виконується ОСТАННЬОЮ → не давати їй
  писати спільну колонку (status). Перевіряти рядок БД наживо.
- **🪤 IDE перемикає гілку** (session 54 інцидент): WebStorm/Git-tool зробив `checkout main` між комітами
  → коміт ліг на main. Тримати активну гілку `feat/preview-module`; перед кожним комітом звіряти
  `git branch --show-current`.

**Що live у проді (form-submit `D2ab06X3pVUWk1py`):**
- **2 послуги** — divorce + alimony. **⚠️ змінено session 54:** документ більше НЕ йде файлом у бот до
  оплати — повний PDF паркується в приватний Storage, витяг повертається в ранній webhook-відповіді.
  Склонення ПІБ = живий LLM-крок Groq + детермінований **stem-guard**. #67 divorce: майно/борги → окреме
  провадження (Variant B). #76: ст.175 ч.7 реквізити рахунку — live в обох послугах.
- **Агент «що змінилось» (law-change-impact) — живий end-to-end:** монітор rada → `law_change_log`
  `pending` → workflow `law-change-digest` (n8n id `qTOIqllA4CQvBJs5`) робить L2→L5 → юрист бачить
  `AiDraftCard` у панелі «Зміни законів». G4 (PR#74) + G5 докі (PR#75) змержено, issue #73 закрито.

**✅ issue #76 ЗАКРИТО (ст.175 ч.7 реквізити рахунку):** блок live в ОБОХ послугах — alimony (безумовно)
+ divorce (під `alimony_claim`). Шаблони залиті в Supabase (DB===file), form-submit задеплоєно (48 нод,
active), live smoke зелений (exec 169 divorce-без-аліментів=відсутній, 170 divorce+аліменти=payout,
171 alimony=payout). Sign-off формулювання Олею — пост-фактум 1 липня (фаза витрини).

**🔴 Наступна задача (СВІЖИЙ чат):** **імплементувати G4 preview-pay** — рішення зафіксовані інтервʼю
session 55 (блок «🔒 G4 РІШЕННЯ» вгорі). Підняти Docker n8n + ngrok перед стартом. Потім G5 (TWA-UI), G6.
Інші кандидати (на потім): розчистка stale-issues (#26/#24/#22/#21/#20/#19/#16/#15/#13/#10 + #5 🔴),
демо git-worktree.

**Гілки:** `main` чистий — divorce ст.175 ч.7 змержено+задеплоєно (`e708f83`, Closes #76).

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
## 🆕 Session 55 (2026-06-30) — preview-module G4: інтервʼю-локдаун (spec-only, перед кодингом)

### Головне — стан ЗАРАЗ
- Гілка `feat/preview-module` (НЕ змержено). `/interview` (medium) перед G4 (preview-pay) — зафіксував
  відкриті A3/A4/A5 + edge-кейси в Tier 2-спеку, щоб свіжий чат кодив без здогадок. **Код не чіпали** —
  лише spec/docs. Наступне: `/clear` → імплементувати G4.

### Рішення (locked) — деталі в блоці «🔒 G4 РІШЕННЯ» вгорі + `specs/features/preview-module/`
- **GDPR:** бот-доставка default-OFF (Telegram Cloud=ризик), основний канал signed URL; бот = opt-in згода.
- **TTL 24год** (ре-мінт ок) · **лише PDF** цю ітерацію (DOCX → окрема група #99) · edge не-готового case =
  4xx без флипу `paid` · повний verify-цикл (deploy+smoke) · окремий rate-limit не треба.
- **Виплило (важливе):** PDF+DOCX другопорядково перевідкривав G1(bucket MIME)+G3(DOCX-export зняті s54) →
  тому PDF-now, DOCX-later. GDPR-нюанс бот-доставки (звірено з DECISIONS).

### Files (spec/docs-only)
- `specs/features/preview-module/requirements.md` (інваріант 7 GDPR + §5 A3/A4/A5 resolved + edge + abuse).
- `specs/features/preview-module/plan.md` (G4 locked-блок: ноди, assert-ready, TTL, consent, verify).
- `docs/architecture/IMPROVEMENTS.md` (#97 failure-UX, #98 failure-stats/evals, #99 DOCX-група).
- `changelog.md` (session 55 запис).

### 🔴 Наступний крок (СВІЖИЙ чат)
- **Імплементувати G4 preview-pay** за locked-спекою. Перед стартом підняти **Docker n8n + ngrok**.
  Контракт + теплі факти — блоки «🔒 G4 РІШЕННЯ» + «📦 Теплі факти» вгорі. Модель: Opus.

---
## 🆕 Session 54 (2026-06-30) — preview-module G1+G2+G3-core ЖИВІ (issue #83, гілка не змержена)

### Головне — стан ЗАРАЗ
- Гілка `feat/preview-module`: `spec→G2→G1→G3-core→fix→GOTCHA` (6 комітів). main чистий (повернуто на
  `e06ca7c` після інциденту). Тести **1091 ✅**. G3-core **задеплоєно в живий form-submit + smoke зелений**.
- 🔴 Наскрізний потік НЕПОВНИЙ до G4+G5 (бот завис на «Формую…», документ не доставляється). Деталі +
  теплі факти для G4 — у блоці «📌 Стан зараз» вгорі.

### Що зроблено (усе верифіковано наживо, не лише тести)
1. **G1 — міграція 029** (застосована, «Success»): `cases` +5 полів + приватний bucket
   `generated-documents` (PDF-only, service-role) + індекс rate-limit `(user_id,created_at)`. 🪤 НЕ додавати
   CHECK на `status` (legacy='submitted' → впав 23514); owner = `user_id`, НЕ profile_id. Клієнтського RLS
   НЕ додавали — рішення: `cases` лишається service-role-only, статус+витяг їдуть синхронною відповіддю.
2. **G2 — `n8n/templates/preview-excerpt.js`** (`deriveExcerpt`) + **61 тест**: ріже відрендерений документ
   рівно перед першою цитатою статті (`/ст\.?\s*\d/i`) / ПРОШУ → лишає шапку+сторони+обставини. Протікання
   суті неможливе за побудовою. Fail-closed на дрейф. Рів #86 = ВІДСУТНІСТЬ суті, не watermark.
3. **G3-core — `scripts/sync-preview-module-form-submit.mjs`** (ідемпотентний патчер + `--check`) + 11 guard-
   тестів: нова `Derive Excerpt` нода (інлайн G2) → рання відповідь `{case_id,status,preview_excerpt}`;
   хвіст `Export PDF→Upload PDF до Storage→Set Preview Ready→Delete Doc`; знято `Send PDF/Export DOCX/Send DOCX`.
   Insert status `submitted→generating`. **Live smoke (4 кейси):** відповідь = витяг без суті (998/1237 симв.);
   case `status=preview_ready`, `doc_storage_path=cases/{id}.pdf`, PDF у приватному bucket (73665/79684 байти);
   anon SELECT cases → 0 рядків (privacy ✅).
4. **🪤 Баг знайдено й полагоджено наживо:** `Update Case Abstention` писала `status='generating'` і через
   n8n depth-first виконувалась ПІСЛЯ `Set Preview Ready` → затирала `preview_ready`. Прибрано status звідти
   (веде лише Insert→Set Preview Ready). GOTCHAS оновлено.

### 🪤 Уроки сесії
- n8n depth-first: sibling fan-out виконується останнім → не давати йому писати спільну колонку стану.
- IDE (WebStorm/Git-tool) може зробити `checkout main` між комітами → коміт ляже на main. Звіряти
  `git branch --show-current` перед кожним комітом; тримати активною `feat/preview-module`.
- ⚠️ Smoke створив 4 тест-кейси (identity 236581343) + 4 PDF у Storage `cases/*.pdf` — прибрати за потреби
  (через Storage API/Dashboard; `protect_delete` тригер блокує SQL DELETE).

### 🔴 Наступний крок (нова сесія, рекомендовано зі свіжим контекстом)
- **G4 — preview-pay workflow** (новий, ізольований, НЕ чіпає form-submit). Повний контракт + теплі факти
  (схема, секрети, deploy `--create`, initData-reuse) — у блоці «📌 Стан зараз». Потім G5 (TWA+бот-UX, task #8),
  G6 (докі), G3b (rate-limit).

---
## 🆕 Session 53 (2026-06-30) — #87 divorce ст.175 ч.7 + ДЕПЛОЙ обох послуг (issue #76 закрито)

### Головне — стан ЗАРАЗ
- **main чистий + запушено** (`e708f83`, Closes #76). Блок ст.175 ч.7 (реквізити рахунку) тепер live в
  ОБОХ послугах: alimony (безумовно, session 52) + divorce (під `alimony_claim`, ця сесія).
- Одна задача = один фокус. Деплой alimony (хвіст session 52) + divorce зроблено разом.

### Що зроблено
1. **divorce ст.175 ч.7** — дзеркало alimony, блок під `{{#if alimony_claim}}` / `if (isTrue(a.alimony_claim))`
   (стягнення у розлученні = лише аліментна гілка). Шаблон + legacy-білдер СИНХРОННО (parity engine===builder,
   **269 ✅** +6 toggle), Build Document нода re-synced (`sync-build-document-node.mjs`, 78133→78938).
   Голдени: scenario-2=гілка IBAN, scenario-3=гілка payout, scenario-1/4 без аліментів=відсутній.
2. **Форма** `divorceFormConfig.ts` +4 поля (таб «Шлюб і сімʼя», під `alimony_claim==true`): has_account /
   IBAN (`validation:'iban'`) / банк / payout (каскад show_if). `sampleAnswers.ts` +приклад (фікс preview-тесту).
3. **Деплой live:** обидва шаблони → Supabase (alimony 10225→10788, divorce 14149→14945, DB===file);
   `deploy-workflow.mjs form-submit` (48 нод, active, креди збережено).
4. **Live smoke (3 webhook, executions API):** exec 169 divorce-без-аліментів=блок ВІДСУТНІЙ ✅,
   170 divorce+аліменти=гілка payout ✅, 171 alimony=гілка payout ✅ (`________` fallback бо сценарії без
   полів рахунку; IBAN-гілка — у 269 parity-тестах).

### 🪤 Урок
- Telegram: 3 документи = 3 окремі smoke-входи, НЕ баг «1 сабміт=3 доки». Один сабміт = 1 документ (PDF+DOCX).

### 🔴 Наступний крок (нова сесія, вибір Сергія)
- Превью-модуль TWA (фокус Сергія, через `/interview`) · розчистка застарілих issues · демо git-worktree.

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
