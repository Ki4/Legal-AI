# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤61) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟢 SESSION 66 (2026-07-03) — TEMPLATE-EDITOR СЕСІЯ 3 ✅ + ЗМЕРЖЕНО В MAIN (merge `d1a98a6`, Vercel-деплой тригернувся). Конвеєр template-editor (Сесії 1-3, IMPROVEMENTS #51) ЗАКРИТО. UI 439 ✅.**
- **Сесія 3 (спека §5), усе live-верифіковано в Chrome проти живої БД (дет. нижче в секції Session 66):**
  мітки 8 блоків у превʼю чернетки (гаснуть при парс-помилці) · «Створити з каркаса» (скелет позову,
  тест на реальному рушії; ⚠️ **текст каркаса → sign-off Олі ДО першої публікації**, список Олі п.5) ·
  «Історія змін» + «Відновити» (той самий гейт, снапшот `reason='restore'`) · «Скинути зміни»
  (прохання Сергія — замість нескінченного Ctrl+Z).
- **Live-прогін:** restore round-trip SHA до/після/з-БД = `7fcf607e…` (прод байт-у-байт цілий), у історії
  3-тя чесна ревізія «Відновлення версії». **AirCareer розібрано** (питання Сергія): JSON-профіль +
  contentEditable-«листя» 1:1 до полів, НЕ round-trip WYSIWYG — підтверджує наш вибір DSL+read-only
  превʼю; звіт `reports/2026-07-03-aicareer-editor-analysis.md`.
- **Хвости s66:** 10-й патерн локалізації гейта (`Unexpected "{{!" in expression` пройшов сирим) ·
  вигрузити текст каркаса Олі окремим повідомленням.

**🟢 SESSION 65 (2026-07-03, локальна) — TEMPLATE-EDITOR: приймання 7/7 ✅ + фікси каретки/гейта/e2e + fullscreen-превʼю. UI 416 ✅.**
- **Приймання пройдено** (нічний автономний прогін + рецензія критика-субагента + живий тест Сергія):
  всі 7 пунктів чеклиста ✅, прод-шаблон divorce після прогону = байт-оригінал (SHA `7fcf607e…`), у
  `service_revisions` лишились 2 чесні аудит-ревізії `publish_template` (дані для «Історії змін» Сесії 3).
  Звіти: `apps/client/.claude/reports/2026-07-03-{template-editor-acceptance,acceptance-review,editor-ux-analysis,editor-architecture-research}.md`.
- **Фікси s65 (коміт `d3a079a`):** каретка (preventDefault на mousedown кнопок + restore через
  `useLayoutEffect` замість rAF + guard «вставка-в-0»: тулбар/палітра disabled до першого фокуса textarea —
  живий баг Сергія: три злиплі `{{!style:}}` на початку шаблону) · локалізація помилок гейта
  (`localizeEngineError`, 9 патернів, рушій не чіпали) · e2e-restore (`afterEach` повертає живий шаблон —
  раніше прогін з кредами перетер би прод).
- **UX s65 (коміт `593bbdc`):** fullscreen-превʼю (⤢ або клік по превʼю → оверлей на весь екран,
  Esc/✕; патерн `if(!open) return null`) · палітра «Змінні форми» згорнута за замовчуванням.
- **Вердикт ресёрчу редактора (веб-субагент):** еволюція = **S2: CodeMirror 6 + styleHints v2 («runs»
  як у Word/OOXML)**. DSL лишається SSoT (нульовий ризик для рендера), юрист отримує чипи замість тегів
  і ІНЛАЙН-жирний (кейс Сергія «Позивач: **{{plaintiff_name}}**» — зараз стилі лише попараграфні).
  Повний WYSIWYG (ProseMirror) відхилено повторно: round-trip тихо псує шаблони.

**🔴 ПОРЯДОК НАСТУПНИХ СЕСІЙ (узгоджено 2026-07-03; Сергій дає фідбек ПО ФАКТУ, після виконання наміченого):**
1. **Сесії 67+ — S2-конвеєр (2–4 сесії, Tier 2 спека-доповнення до template-editor):**
   (A) CodeMirror 6 swap: підсвітка DSL, чипи-декорації над `{{поле}}`, іконки замість `{{!style:}}`,
   fold умовних блоків · (B) styleHints v2 «runs» у рушії — інлайн-стилі (ЄДИНЕ місце де не поспішати:
   legally-critical, parity-тести; синтаксис `{{#bold}}…{{/bold}}`, Google Docs `updateTextStyle` ranges)
   · (C) полірування + sync-підсвітка «каретка ↔ абзац превʼю» (на CodeMirror — безкоштовна).
   База: `reports/2026-07-03-editor-{ux-analysis,architecture-research}.md`.
   **👁 UX-СПОСТЕРЕЖЕННЯ СЕРГІЯ (s67, скріншоти 03.07 16:24) — розібрати у слайсі C, рішення «як
   правильно» відкладено до завершеного S2 (Сергій оцінює плюси/мінуси ПО ФАКТУ):**
   - **Темна тема ламає редактор:** CM-редактор і чипи задизайнені лише під Legal Light
     (`templateEditorTheme` — хардкод світлих кольорів, `backgroundColor: transparent` бере темний
     фон сторінки) → основний текст шаблону НЕВИДИМИЙ (темне-по-темному), видно лише чипи/пілюлі/
     коментарі/логіку. Кандидати: власна світла «паперова» підкладка редактора незалежно від теми
     АБО повноцінна темна палітра декорацій.
   - **«Історія змін» накладається на редактор:** панель напівпрозора І перекриває текст CM
     (у згорнутому стані заголовок «Історія змін (3)» наїжджає на редактор, у розгорнутому — записи
     та кнопки «Відновити» плавають ПОВЕРХ шаблону, нечитабельно). Схоже на layout/overflow-колізію
     (CM `h-full`/flex переростає контейнер? відсутній непрозорий фон панелі?) — діагностувати в C.
2. **Далі з беклогу s64:** «застаріло»-петля (мін. фікс відомий: реактивація послуг у
   `LawChangeLogPage.review()`) · медвертикаль (чекає Олю по M1–M18, категорія `medical` готова) ·
   реальний платіж (Telegram Payments замість заглушки) · #100/#101 розкладка.

**🟢 SESSION 64 — issue #86: «хибна тривога» health виявилась РЕАЛЬНИМ прод-багом → дата-фікс live + чесний health, ЗМЕРЖЕНО в main (merge `b2b5a7d`, Closes #86) + main ЗАПУШЕНО (Vercel-деплой тригернувся). Дошка: відкритий лише #24 (secrets, не пріоритет).**
- **Суть (3 розвороти, claim≠fact double):** health увесь час казав ПРАВДУ. Живий alimony `form_config` =
  24 legacy-поля (`respondent_*`), а `generation_mode='template'` рендерив новоконвенційний шаблон →
  реальний сабміт давав документ з **16 дірами `________`** («Відповідач: ________», «Стягнути з ________»).
  Усі зелені smoke ішли `test-webhook.mjs` з ключами `defendant_*` — **повз живу форму**. Divorce: бракувало
  4 полів #87 (ЦПК ст.175 ч.7) → `________` у блоці реквізитів. Гіпотези «аналізатор не розуміє derived» і
  «js-режим, шаблон спить» — обидві спростовані (жива БД: обидві послуги `template`).
- **Дата-фікс live:** `alimonyConfig.ts` переписано як SSoT нової конвенції (24→**48 полів**, #87 IBAN-блок);
  новий **`scripts/upload-form-config.mjs <slug> [--check]`** (esbuild з TS SSoT, shape-guard, дифф-прев'ю);
  залито: **alimony 24→48, divorce 55→59**. `upload-alimony-config.mjs` видалено (формат tabs[]-без-steps[]
  TWA не рендерить). Тест-інваріант «alimony: zero unmatched» закриває діру, що пропустила баг.
- **Код-хардненінг:** `isTemplateAuthoritative()` — для js-режиму дифф проти неактивного шаблону = одна
  amber-нотатка «Чернетка шаблону… на генерацію не впливає» (не per-field red), stat-тріо `muted` + caveat.
- **Verify (повний ланцюг):** UI **357 ✅** (+10), root **1114 ✅**, tsc clean · health проти живої БД:
  **alimony 🟢 green (0/0), divorce 🟡 amber** (2 чесних unused — движок перераховує) · прод-TWA (Vercel)
  рендерить нову 48-полеву форму (4 таби, #87, show_if) · рендер-доказ 0 дір (було 16) · **e2e живий n8n
  exec 228 success**: 1 легітимна діра (опціональні поля рахунку в сценарії порожні). GOTCHAS: «Зелений
  smoke ≠ робочий прод, якщо smoke обходить живу форму».
- **🧹 Хвости:** smoke лишив тест-case (identity 236581343) + PDF у Storage — прибрати звичним патерном ·
  «застаріло»-петля ПІДТВЕРДЖЕНА незамкненою (review() пише лише в `law_change_log`; `needs_review` знімається
  вручну на «Мої послуги», `is_stale` — лише re-seed; мінімальний фікс: реактивація послуг у
  `LawChangeLogPage.review()` — кандидат у беклог) · **таблиця медпозицій M1–M18 надіслана Олі** (чат s64,
  гілка `claude/medical-vertical-complexity-scoring` чекає sign-off + #BLOCKER-5).

**📋 Список Олі (sign-off):** (1) формулювання превʼю-витягу (точка обрізки) + блоку ст.175 ч.7;
(2) #67 divorce wording «спір… відсутній» → «не є предметом цього позову»; (3) **НОВЕ s64:** формулювання
«бажаний спосіб отримання коштів» ст.175 ч.7 + чи робити поле обовʼязковим, коли рахунку нема (зараз
опціональне → у документі легальний, але негарний `________`); (4) валідація таблиці медпозицій M1–M18;
(5) **s65/s66:** текст каркаса позову (8 блоків, `templateSkeleton.ts` — уже live в адмінці) — sign-off
потрібен ДО того, як хтось уперше ОПУБЛІКУЄ послугу, створену з каркаса.

**Що live у проді (form-submit `D2ab06X3pVUWk1py`, active):**
- **2 послуги** — divorce + alimony, обидві `generation_mode='template'`, **form_config ↔ template вирівняні
  (s64)**. Документ НЕ йде в бот до оплати (PDF у приватний Storage, витяг у ранній відповіді). Per-profile
  rate-limit 20/24год. Склонення ПІБ = Groq + stem-guard. #67/#76 live.
- **Агент «що змінилось» (law-change-impact)** — живий end-to-end (n8n `qTOIqllA4CQvBJs5`).
- Preview-module (#83): наскрізний потік TWA→витяг→PreviewPage→оплата(заглушка)→signed URL (sessions 54-57).

**📦 Теплі факти — для роботи з preview-flow:**
- `cases.user_id` = **profile UUID** (НЕ telegram id!). Telegram id → profile через `identities.external_id`
  → `identities.user_id`. Owner-check і rate-limit — по цьому UUID.
- **Storage:** приватний bucket `generated-documents` (PDF-only, service-role), шлях `cases/{case_id}.pdf`.
  Чистка файлів: Storage API DELETE (тригер `protect_delete` блокує SQL DELETE на `storage.objects`, але НЕ
  на таблицю `cases` — тестові cases видаляються звичайним SQL DELETE під service-role).
- **Скрипти:** `build-preview-pay.mjs` + `sync-preview-module-form-submit.mjs` + `test-preview-pay.mjs` (e2e) ·
  **`upload-form-config.mjs <slug> [--check]` (s64)** + `upload-document-template.mjs` — **форма і шаблон =
  одна одиниця деплою, заливати разом**. Деплой workflow: `deploy-workflow.mjs preview-pay|form-submit`.
- **🪤 IDE перемикає гілку:** WebStorm робив `checkout main` посеред роботи. Звіряти
  `git branch --show-current` ПЕРЕД кожним комітом.

**🔴 НАСТУПНА СЕСІЯ:** Сесія 67 = S2-конвеєр, частина (A) CodeMirror 6 (за планом вище; Сергій
коментує по факту).

**Модель:** з 02.07 Сергій переключив default на **Fable 5** (червневий мемо «Opus + ultra-code» закрито).

**Запуск середовища:** n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`).
Деплой form-submit: `node scripts/deploy-workflow.mjs form-submit`. Деплой дайджесту:
`node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`.
Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n` (+ `npm test` для UI). CI-гейт: `.github/workflows/test.yml`.

**⚠️ Інфра:** WebStorm-термінал (JediTerm) не скролить Claude Code TUI → великі звіти писати у `.md`
(memory `feedback_reports_to_file`).

---
## 🆕 Session 66 (2026-07-03) — template-editor Сесія 3 + merge в main + AirCareer-розбір

### Головне — стан ЗАРАЗ
- **Конвеєр template-editor ЗАКРИТО і ЗМЕРЖЕНО в main** (merge `d1a98a6`; фіча-коміти `910a498`,
  `58e2bf9`, roadmap `51da2b1`). Vercel-деплой тригернувся. UI **439 ✅** (+23 за сесію), tsc clean,
  змінені файли eslint-clean, build:admin OK. Роадмап: IMPROVEMENTS #51 → done.

### Що зроблено (спека §5 + фідбек Сергія по ходу)
1. **Мітки блоків:** `renderPreview`/`renderAnnotatedPreview` повертають також `text`+`styleHints`
   (рядки↔параграфи 1:1); `DocumentPreview` +проп `showBlocks` → `detectBlocks` по відрендереній
   чернетці → кольорова мітка (крапка+label з `blockRegistry`) над стартом кожного канонічного блока;
   `unknown` без мітки (fail-closed). Увімкнено лише в `TemplateDraftPreview` — дзеркала без змін.
2. **«Створити з каркаса»:** `lib/templateSkeleton.ts` (CLAIM_SKELETON: 8 блоків, стилі, keep-block
   Додатки+підпис, структура = живий divorce; коменти-інструкції вирізаються рендером) + кнопка в
   порожньому стані панелі. Тест на РЕАЛЬНОМУ рушії: гейт ok, 8 блоків у порядку, keep-together.
3. **«Історія змін»:** `serviceTemplate.ts` → спільний `gateSnapshotAndSet` (публічний API publishTemplate
   без змін) + `listRevisions` (30, newest-first) + `restoreTemplate` (шаблон зі снапшота → ТОЙ САМИЙ
   гейт → снапшот поточного рядка `reason='restore'` → публікація). `TemplateRevisionHistory`
   (collapsed details, ConfirmModal warn «Так, відновити»), оновлюється по `revisionsBump`.
4. **«Скинути зміни»** (прохання Сергія посеред сесії): чернетка → копія опублікованої, ConfirmModal
   warn; hidden без published, disabled коли draft==published. Локальний стейт — «Зберегти чернетку»
   персистить.

### Live verify (Chrome + жива Supabase, divorce, dev:admin :5175)
- Історія: 2 чесні ревізії s65 (02:51/02:52) → restore найстарішої → SHA до/після/з-БД-після-reload =
  `7fcf607e5176bcfe` (байт-оригінал прод-шаблону) → у історії (3) + «Відновлення версії». Прод цілий.
- Мітки: всі 8; зламаний `{{#if` → мітки гаснуть, alert рушія; після «Скинути зміни» — повертаються.
- Скидання: modal → confirm → байт-точний відкат (14939), статус «✓ збігається», оверлеїв 0.
- Каркас на divorce прихований (шаблон є) — очікувано; вміст покритий unit-тестом на рушії.

### AirCareer (питання Сергія, звіт `reports/2026-07-03-aicareer-editor-analysis.md`)
- Next.js/Vercel + Supabase + API на Railway; редактор БЕЗ бібліотек: JSON `candidateProfile` +
  `docStyle`, кожне текстове поле = `<span contentEditable>` 1:1 до JSON-поля (Enter перехоплено,
  plain-paste), autosave PATCH цілого профілю, undo/redo — власний reducer, PDF на сервері.
- Висновок: правка ІНСТАНСА, не round-trip шаблону → підтверджує наш DSL+read-only превʼю. Переносний
  патерн на майбутнє: inline-правка *значень змінних* у превʼю готового документа.

### 🪤 Нюанси s66
- Розширення Chrome на Vite dev: `screenshot`/`find` падають по document_idle (HMR websocket), а
  `javascript_tool` працює — живий прогін вести через JS-канал.
- `git checkout` між гілками інвалідовує Read-стан файлів у Claude Code — перечитувати перед Edit.

---
## 🆕 Session 65 (2026-07-03) — template-editor: приймання + фікси + fullscreen + ресёрч еволюції

### Головне — стан ЗАРАЗ
- Гілка `claude/document-constructor-styling-a3zkky` @ `593bbdc` (запушено, НЕ змержено). UI **416 ✅**,
  tsc clean, змінені файли eslint-clean. Наступний крок — **Сесія 3** (потім merge), далі S2-конвеєр.

### Що зроблено (нічний автономний прогін + денна робота за фідбеком Сергія)
1. **Демо-приймання 7/7 ✅** без Сергія (Chrome authed + жива Supabase): стилі/палітра/чипи/розкладка/
   публікація/негатив-гейт. Публікація перевірена **двічі рендер-нейтрально** (оригінал+`{{! }}`-коммент →
   чистий оригінал): прод не змінився (SHA до/після), 2 аудит-ревізії лишились навмисно.
2. **Критик-субагент** незалежно підтвердив 100% фактів + знайшов: e2e публікує в живу БД без відкату
   (полагоджено в `d3a079a`), lint має 7 передіснуючих помилок (НЕ з цієї гілки), toast 4с.
3. **Живий тест Сергія зловив реальний баг каретки** (директиви злипались на початку шаблону) →
   фікс `d3a079a`: preventDefault + useLayoutEffect-restore + guard вставки-в-0 (+7 тестів, верифіковано
   наживо: каретка рівно на місці). Там само: локалізація гейта укр. мовою, e2e-restore.
4. **UX за фідбеком** (`593bbdc`): fullscreen-превʼю (⤢/клік, Esc) + палітра згорнута (+3 тести).
5. **Ресёрч еволюції редактора** (веб-субагент): вердикт S2 = CodeMirror 6 + styleHints v2 runs.
   4 звіти в `apps/client/.claude/reports/2026-07-03-*.md`.

### 🪤 Уроки s65
- **Синтетичний ввід ≠ живий клік**: розширення на localhost не рухає каретку/не емітить focus у фонових
  вкладках — «баг каретки» довів лише живий клік Сергія. Автоматизаційні знахідки UI-поведінки маркувати
  «needs human click» до підтвердження.
- **Рендер-нейтральна публікація** (`{{! }}`-коммент → оригінал) — безпечний спосіб тестувати publish-шлях
  на живій послузі; аудит-ревізії при цьому чесно документують прогін.
- У DOM редактора ДВА екземпляри превʼю (desktop+mobile) — вимірювати/клікати видимий (rect > 0).

---
## 🆕 Session 64 (2026-07-02) — issue #86: health-«хибна тривога» = реальний прод-баг; форми вирівняно live

### Головне — стан ЗАРАЗ
- **Змержено в main (`b2b5a7d`, Closes #86) + запушено.** Живі form_config вирівняні з шаблонами,
  health-панель чесна: alimony 🟢 / divorce 🟡. Робоче дерево чисте, гілку видалено.

### Хід розслідування (3 розвороти — урок verify-протоколу)
1. Гіпотеза демо s62 «аналізатор не розуміє derived-поля» — ❌ (він коректно моделює computed-шар,
   `PROVIDED_CONTEXT`/`DERIVED_SOURCES`).
2. Гіпотеза Explore-агента «generation_mode='js', шаблон спить, тривога хибна» — ❌ (агент вивів режим із
   міграцій; жива БД: обидві послуги `'template'`, n8n Build Document рендерить САМЕ цей шаблон).
3. Доказ (реальний рушій + живий шаблон + ключі живої форми): **16 дір `________`** у документі alimony,
   включно з «Відповідач: ________» і «Стягнути з ________». Зелені smoke обходили живу форму
   (`test-webhook.mjs` шле `defendant_*`, жива форма збирала `respondent_*`).

### Що зроблено
- **Дата-фікс live (за «да» Сергія):** `alimonyConfig.ts` → SSoT нової конвенції (48 полів; конверсія
  інлайн-конфіга з `upload-alimony-config.mjs`, tooltip→hint, +animation за ідіомою divorce). Новий
  `scripts/upload-form-config.mjs <slug> [--check]` (esbuild-транспіляція TS SSoT → PATCH, shape-guard,
  дифф added/removed). Залито: alimony 24→48, divorce 55→59 (+4 поля #87). Старий скрипт видалено.
- **Чесний health (код):** `isTemplateAuthoritative()` у `serviceAnatomy.ts`; js-режим → одна amber-нотатка
  замість per-field red/amber; `ServiceViewPage` summary, `ServiceAnatomy` stat-тріо muted+caveat,
  `vizData.templateAuthoritative`, гейти в `ServiceDetail`/`CatalogGraph`.
- **Тести:** інваріант «alimony: zero unmatched» + «alimony real×real → green» + js-drift (синтетика) +
  `isTemplateAuthoritative` + 2 viz. UI 357 ✅, root 1114 ✅, tsc clean.
- **GOTCHAS:** «Зелений smoke ≠ робочий прод, якщо smoke обходить живу форму» (4 правила).

### Verify (повний ланцюг, наживо)
- Health проти свіжих рядків БД: alimony green (0/0), divorce amber (2 unused — движок перераховує).
- Дашборд наживо: «Готова» (bg-ok) / «Є зауваження» (bg-warn).
- Прод-TWA `legal-twa-xi.vercel.app/?service=alimony`: нова форма рендериться (4 таби, #87-поля, show_if).
- Рендер-доказ рушієм: 0 дір (було 16).
- **E2e живий n8n: exec 228 success** — витяг ідеальний, повний документ 5391 симв., 1 легітимна діра
  (опціональні поля рахунку порожні в сценарії; формулювання — список Олі).

### 🪤 Уроки
- **Зелений smoke ≠ прод**: smoke-ключі мають походити з живого form_config. Форма+шаблон = одна одиниця деплою.
- **Стан прод-рядка звіряти по живій БД**, не по міграціях (Explore-агент дав хибний режим).
- **Червоний health на «робочій» послузі = розслідувати до кінця**, не списувати на аналізатор.

### 🔴 Наступний крок
- Вибір Сергія: «застаріло»-петля · медвертикаль (після Олі) · реальний платіж · #100/#101.

---
