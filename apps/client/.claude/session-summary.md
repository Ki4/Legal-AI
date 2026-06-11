# Legal AI — Master Context Document
> Updated: 2026-06-12 (session 21 — divorce на шаблоні + GraphRAG-дослідження)
> Прочитай эту секцию первой — она самая свежая.

---

## 🆕 Session 21 (2026-06-11/12) — divorce-порт на шаблон (#35) + GraphRAG-стек: дослідження і рішення

### Головне — стан ЗАРАЗ
- **Фіча `divorce-template-port` ЗАВЕРШЕНА, змержена в `main` (`2830470`), Issue #35 CLOSED.** ОБИДВІ послуги live на `generation_mode='template'` — hardcoded JS-білдерів у serving-шляху більше немає (лишаються в ноді як шлях миттєвого rollback, винос → IMPROVEMENTS #52).
- **GraphRAG: зовнішнє дослідження проведено, рішення зафіксовано** (`docs/research/graphrag-stack.md` + DECISIONS «GraphRAG-стек», merge `15e7fb1` + addendum цієї сесії). main чистий.

### Частина 1 — divorce-порт (та сама parity-методика, що alimony в s20)
- **Шаблон:** `n8n/templates/services/divorce.document.txt`. Рішення зі спеки #34 закрито: сервіс-специфічні словники (REASONS_MAP — причини розлучення, EXEMPT_REASONS — звільнення від збору) і динамічна нумерація пунктів «ПРОШУ» (5–8) живуть У САМОМУ шаблоні if-ланцюжками — движок лишився сервіс-агностичним, юрист може правити формулювання.
- **Движок розширено тільки generic-механізмами** (легасі-семантика divorce відрізнялась у 4 точках): аліас `spouse_*`→computed `defendant_*`; шар `answers.*` (сирі відповіді — `has_children` у divorce це чекбокс форми, computed його затіняв); шар `ai_raw.*` + `child.raw` (нумерований fallback `children_genitive`); хелпер `ensurePeriod`.
- **Доказ:** 263 parity-тести байт-у-байт (матриця нумерації 180 комбінацій + AI-fallback матриця + toggles + 4 голдени) — зелені з ПЕРШОГО прогону. Root vitest **655/655** (було 385).
- **Live:** деплой 28 нод → js-регресія exec 40 → флип template: exec 41–42 (live `_content` === движок === legacy байт-у-байт на реальних AI-склоненнях) → rollback-флип js exec 43 ✓ → назад template → alimony-регресія exec 44 ✓.
- **NEW інструмент:** `scripts/set-generation-mode.mjs <slug> <js|template>` — rollback одною командою (guard: не вмикає template без шаблону в БД). Runbook `document-template-editing.md` оновлено під обидві послуги.

### Частина 2 — GraphRAG-дослідження (запит Сергія: «як це роблять у світі, чи можна без юриста»)
- **Розглянуто і ВІДХИЛЕНО як фреймворки:** MS GraphRAG (перебудова на кожне оновлення, для хаотичних корпусів), LightRAG-сервіс, PageIndex (LLM-навігація в serving, а наші статті відомі з law_deps), NornicDB (нова СУБД), Weaviate (pgvector+fts вже є). **Запозичено патерни:** інкрементальний граф; чанк=стаття; valid_from/to на звʼязках + as-of; метадані-спершу + eval-набір retrieval; regex-шар цитувань; enum-констрейнт + abstention.
- **Ключові факти:** Lexis+ AI галюцинує ~17%, Westlaw ~33% (Stanford) — «hallucination-free генерація» не існує ні в кого; на українських судових даних regex-екстракція посилань = precision 1.00; сімейне право — найгірший домен у вимірах (наша поляна → ров «перевірено юристом» підтверджено).
- **ТРИ ЯРУСИ довіри звʼязків:** (1) явні посилання — regex, авто без ревʼю; (2) типізація для retrieval-збагачення — LLM+критик, авто-аккепт; (3) звʼязки, що керують ЛОГІКОЮ документа (exception_if) — ЗАВЖДИ Ольга (~10–30 на послугу).
- **Модель витрат:** побудова графа = dev-сесії за підпискою (API-ключ не потрібен; extraction-промпт фіксується в репо, результат = дані через diff→ревʼю→коміт); платний API лише в runtime hybrid-секції (~$0.01–0.03/док), старт можливий на безкоштовному Groq → постійних AI-витрат на пілоті може не бути.
- **Пілот hybrid:** «зміна розміру аліментів» (FastDoc валідував попит, та сама СК-база, тепла аудиторія alimony-клієнтів).

### 🔴 Наступний фокус (НОВА сесія — кандидати)
1. **Фаза 2 типографіки (#50)** 🟡 — прямий запит Сергія («красиві відступи»), конкурентна якість документа.
2. **GraphRAG кроки 0–1** (без Ольги): досів `law_chunks` статтями з watched_laws (чанк=стаття) + migration `law_relations` + regex-шар + LLM-екстракція в pending. План: DECISIONS «GraphRAG-стек» + `docs/research/graphrag-stack.md`.
3. **VPS-деплой** (Hetzner) 🟡 / n8n v7 hardening хвости 🟡.
4. ⏰ **~2026-06-25 (Ольга повертається):** розкоментувати `schedule:` у law-monitor.yml + рішення по 2 змінах законів (СК/ЦПК) — `project_cron_schedule_pending.md`; далі — панель ревʼю звʼязків (ярус 3) і hybrid-пілот.

---

## Session 20 (2026-06-11) — doc-engine: сервіс-агностична генерація документа (Tier 2, #34)

### Головне — стан ЗАРАЗ
- **Фіча `doc-engine` ЗАВЕРШЕНА, змержена в `main` (`662e846`), Issue #34 CLOSED.** main чистий, активних feature-гілок немає.
- **Остання розірвана петля фундаменту закрита:** контент документа = декларативний шаблон у БД (`services.document_template`), рендерить ОДИН спільний движок. Нова проста послуга = form_config + текст шаблону, 0 рядків коду; правка формулювання = правка тексту + upload, БЕЗ передеплою n8n.
- **Стан проду:** alimony на `generation_mode='template'` (live-перевірено), divorce на legacy `'js'` (порт — наступна сесія). Rollback = флип колонки назад на `'js'` (миттєво, патерн status kill-switch).

### Архітектура (Tier 2 спека: `specs/features/doc-engine/`)
- **DSL-контракт (§3 requirements):** `{{поле}}` (порожнє→`________`), `{{поле|raw}}`, `{{#if}}/{{else if}}/{{else}}` (==/!=/>/</>=/<=, and/or/not), `{{#each}}` (`@index1`/`@first`/`@last`), standalone-теги поглинають свій рядок (byte-exact), `{{! коментар }}`, **зарезервовано `{{!style: right|center|bold|indent|keep-with-next|keep-together|page-break-before}}`** — фаза 1 ігнорує, фаза 2 → Google Docs стилі. Розриви сторінок = ПРАВИЛА, не позиції.
- **Контекст 3 шари:** answers + `ai.*` (склонения з fallback) + computed (plaintiff/defendant_name, гендери за по батькові, children[] розпарсені, n_children, has_children).
- **Хелпери (юридично-критичне, тестується раз):** formatDate, formatDateQuoted, gender, plural (2/3 укр. форми), alimonyFraction (ст. 183 СК), concat.
- **Dispatch у Build Document:** `generation_mode='template'` + template → движок; інакше legacy JS builders. Нода ГЕНЕРОВАНА `scripts/sync-build-document-node.mjs` з дзеркал — інлайн НЕ правити.

### Файли (ключове)
- `n8n/templates/render-document.js` — движок (парсер без eval) + 56 тестів
- `n8n/templates/services/alimony.document.txt` — шаблон (SSoT git; БД = runtime-копія)
- `n8n/templates/__tests__/alimony-template-parity.test.js` — 117 parity-тестів
- `supabase/migrations/014_doc_engine.sql` — **застосовано+верифіковано** (generation_mode js|template CHECK, document_template)
- `scripts/upload-document-template.mjs <slug>` — заливка шаблону (--dry-run, ідемпотентний)
- `docs/runbooks/document-template-editing.md` — як міняти текст документа (для оператора/юриста)

### Тести + live-перевірка
- **Root vitest 385/385 ✅** (було 213, +172). Паритет: матриця 72 комбінації + 40+ гілок + 3/3 голдени **байт-у-байт** зі старим `buildAlimonyDocument`.
- **Live:** деплой 28 нод (creds збережені) → e2e до флипу exec 35 ✓ → флип template: exec 36 (a1 percent) + 37 (a2 fixed) `success` до Send Doc Link, live `_content` === движок === legacy builder байт-у-байт (входи витягнуті з exec через n8n API) → rollback-флип exec 38 ✓ → divorce регресія exec 39 ✓.

### Рішення сесії (DECISIONS «Doc-engine»)
- Шаблон-дані замість JS-коду (дзеркало form_config); НЕ AI-генерація як основа (court-ready без ревʼюера = ні; hybrid/ai_generate — майбутнє розширення dispatch); байт-паритет як доказ міграції (типографіка = окремий крок зі свідомою перегенерацією голденів).
- **Запит Сергія «красиві відступи»** → IMPROVEMENTS **#50** (фаза 2): директиви вже стоять у шаблоні, рендер у styled batchUpdate — окрема фіча. + #49 (declension-конвенція полів), #51 (admin-редактор шаблону для Ольги).

### 🔴 Наступний фокус (НОВА сесія — кандидати)
1. **Порт divorce на шаблон** 🟡 — DSL обкатано, той самий parity-процес; після нього legacy builders можна виносити з ноди.
2. **Фаза 2 типографіки (#50)** 🟡 — прямий запит користувача, конкурентна якість документа.
3. VPS-деплой (Hetzner) 🟡 / n8n v7 hardening хвости 🟡.
4. ⏰ **~2026-06-25 (Ольга повертається):** розкоментувати `schedule:` у law-monitor.yml + рішення по 2 змінах законів (СК/ЦПК) — `project_cron_schedule_pending.md`.

---

## Session 19 (2026-06-11) — CRON-моніторинг змін законів (фокус: автоматизація lifecycle)

### Головне — стан ЗАРАЗ
- **Фіча `cron-law-monitor` ЗАВЕРШЕНА, змержена в `main`, запушена, перевірена живцем у хмарі.** Issue **#33** (лишається відкритою як трекер 2 відкладених пунктів). main чистий, активних feature-гілок немає.
- **Lifecycle-петля ЗАМКНЕНА end-to-end:** автодетект зміни закону (CRON) → `law_change_log` (`detected_by='cron'`) → флип залежних послуг у `needs_review` → панель ревʼю Ольги (s18). Виробник записів, якого бракувало, тепер є.

### Що зроблено — детектор + планувальник
- **`scripts/lib/` (NEW shared layer):**
  - `supabase-rest.mjs` — спільний REST-клієнт + `loadEnv` (прибрав дубль між 2 скриптами).
  - `rada.mjs` — `extractRevisionDate` (чистий парсер дат) + `fetchWithRetry` (backoff+jitter+`Retry-After` на 429/5xx/мережеві) + `fetchRevisionDate`. Виправлено баг референса (`printUrl` ReferenceError).
  - `law-change.mjs` — **канонічний `applyLawChange`** (reverse-index по URL → `law_change_log` `action=flagged` → флип услуг у `needs_review` + bump `last_known_date`). Anti-drift: тепер ОДИН producer для ручного CLI і CRON.
- **`scripts/check-law-updates.mjs`** — REWRITE: ітерує реєстр (дедуп спільних законів по URL — СК фетчиться раз на divorce+alimony), детект → `applyLawChange(detected_by='cron')` → Telegram-алерт. Ідемпотентний.
- **`scripts/service-lifecycle.mjs`** — `log-law-change` тепер кличе спільний `applyLawChange` (без інлайн-дублю).
- **`.github/workflows/law-monitor.yml`** — GitHub Actions: `workflow_dispatch` (кнопка + опц. dry_run) + `schedule` (пн 06:00 UTC) **закоментований** поки Ольга недоступна. Без `npm install` (лише Node built-ins+fetch). actions@v5 + Node 22.

### Тести
- **root vitest 213/213 ✅** (було 162, +51: rada + law-change + ін.). 27 нових тестів у `scripts/lib/__tests__/` (парсер дат + ловушка adoption-date; retry/Retry-After/exhaustion/404-no-retry; reverse-index крізь slug-drift; dry/live applyLawChange).
- **Live перевірка (хмара + локально):** dry-run проти zakon.rada коректний — судовий збір збігся з відомою датою (`2026-03-10` ✅), СК і ЦПК розійшлися (🔴). GitHub Actions прогін: Success, БД не тронута.

### 🔴 Архітектурні рішення сесії (узгоджено в чаті)
- **Хост = GitHub Actions** (не n8n, не Vercel): працює незалежно від ноута/n8n/VPS — надійність важливіша за «все в стеку». + ручна кнопка + локальний запуск.
- **Будували одразу під ріст каталогу:** дедуп спільних законів, retry/backoff. Закон пропускається лише після вичерпання ретраїв, не на першому блипі.
- **Розклад свідомо вимкнено** поки немає ревʼюера (авто-флип нікому ревʼюити).

### ⏰ Відкладено з датою (записано в память `project_cron_schedule_pending.md`)
**~2026-06-25, коли Ольга повернеться:**
1. Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки) → увімкнути авто-CRON.
2. **2 РЕАЛЬНІ зміни, знайдені dry-run** — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24` — вирішити релевантність нашим шаблонам (ст. 109 СК, 180-184 аліменти, ст. 175 ЦПК) → флипати чи ні. Живий флип НЕ робився (зняв би divorce+alimony з продажу).

### 🔴 Наступний фокус (НОВА сесія — кандидати)
- **Сервіс-агностична генерація документа** 🟡 — *остання розірвана петля фундаменту*, прямий розблокувальник «юрист додає послугу сам». Зараз dispatch захардкоджено (divorce/alimony JS-файли), `ai_prompt` декоративний. **Рекомендація.**
- **VPS-деплой** (Hetzner) 🟡 — прибрати ngrok, прод перестане залежати від ноута.
- n8n v7 hardening хвости (items 3–7 `workflow-improvements.md`) 🟡.
- Повний backlog: `specs/roadmap.md` (v2 GraphRAG, v3 UX) + `project_phase_foundation.md`.

---

## Session 18 (2026-06-10/11) — Панель ревʼю law_change_log + власність послуг (фокус: lifecycle UI)

### Головне — стан ЗАРАЗ
- **Фіча `law-change-log-review` ЗАВЕРШЕНА, змержена в `main`, перевірена живцем.** Гілка `feature/law-change-log-review` (commit `d7684bb`) → merge `0a62a74`, **Issue #32 closed**. main чистий, активних feature-гілок немає.
- **Lifecycle для Ольги тепер видимий end-to-end:** статус-флип (s17) + панель ревʼю змін законів (s18). Лишився **виробник** записів — CRON-моніторинг (наступна сесія).

### Що зроблено — панель ревʼю
- **migration 013** (`supabase/migrations/013_law_change_log_review.sql`, **застосовано**) — RLS на `law_change_log`: `SELECT`+`UPDATE` для `authenticated` (юрист читає+позначає ревʼю); `INSERT`/`DELETE` лишаються service_role-only (append-only з UI — рядки створює лише скрипт/CRON).
- **`apps/client/src/lib/lawChangeLog.ts`** — SSoT (типи, `ACTION_META` UA, `reviewActions` переходи, `isPending`/`pendingCount`/`formatRevision`) + **14 тестів**.
- **`apps/client/src/admin/pages/LawChangeLogPage.tsx`** — список (нові зверху) + фільтр «лише очікують» (лічильник) + дії Переглянуто/Відхилити/Повернути + нотатки + чипи зачеплених послуг + штамп хто/коли. Роут `law-changes` + nav-лінк «📋 Зміни законів».
- **Тести:** client vitest **92/92** ✅ (було 78) · tsc clean. **Playwright live (вхід Олги):** строка видна, ревʼю-цикл працює, persistence у БД підтверджено service_role-запитом.

### Власність послуг — полагоджено розірвану петлю
- **Симптом:** «Мої послуги» в адмінці порожні, хоча divorce/alimony живі. **Корінь:** `DashboardPage` фільтрує `lawyer_id = user.id`, а сіяні міграціями послуги мали `lawyer_id = null` (бесхозні). Несоответствие моделі: мультитенантний дашборд проти спільного каталогу.
- **Фікс (варіант B):** `UPDATE services SET lawyer_id='2909df04-…' WHERE slug IN ('divorce','alimony')` (live, service_role; env-specific uid → НЕ міграція). Обидві тепер у списку. Плейсхолдери (military/business/court_search) лишаються прихованими.
- **Lawyer auth uid:** `2909df04-0977-400d-9c44-ee60e3633c9c` (sergeykichukki4@gmail.com — поки єдиний акаунт; `disable_signup=true`).
- **Майбутнє:** довгостроковий відповідь — 2-tier ролі (`project_admin_lawyer_roles.md`).

### Security-review (push sweep) — acknowledged, не блокує
3 знахідки на migration 013 (broad `USING(true)` UPDATE; bare-`authenticated` gate; client-stamped `reviewed_by`) = свідомо відкладений компроміс **IMPROVEMENTS #47**. **Мітигація:** `disable_signup=true` (invite-only) → `authenticated` = команда (1 акаунт). **Тригер хардингу** (у #47): RPC/тригер для штампу `reviewed_by` + role-gate ПЕРЕД self-signup / 2-м юристом.

### 🔴 Наступний фокус (НОВА сесія — узгоджено)
**CRON-моніторинг zakon.rada.gov.ua** — виробник записів у `law_change_log` (`detected_by='cron'`), який панель s18 вже вміє показувати. Референс: `scripts/check-law-updates.mjs`. Замикає lifecycle-петлю: автодетект зміни закону → запис у лог + флип залежних послуг у `needs_review` → юрист ревʼю в панелі. Інші кандидати: сервіс-агностична генерація документа (остання розірвана петля) 🟡; n8n v7 hardening хвости 🟡.

### Cosmetic (out of scope, відмічено)
Dashboard показує «0 полів» для tabs-based послуг (лічильник читає `form_config.steps`, alimony на `tabs`).

---

## Session 17 (2026-06-10) — admin lifecycle: is_published → status (single source) — #31

- **Фіча `status-single-source` змержена в `main`** (`b169458`), Issue #31. Розірвана петля: адмінка писала декоративний `is_published`, а serving-шлях (n8n + TWA) читає `status`. Зведено на `status` як єдине джерело; `is_published` = deprecated-дзеркало.
- **migration 012** (`012_status_single_source.sql`, **застосовано**) — реконсиляція `is_published := (status='active')` + COMMENT deprecated.
- **`apps/client/src/lib/serviceStatus.ts`** (NEW) — SSoT статусу: `STATUS_META` (UA), `statusActions` (переходи), `toServiceStatus`/`isPublishedFor` + 10 тестів.
- **DashboardPage** — бейдж 3 станів + дії (Активувати/Вимкнути/Підтвердити). **ServiceEditPage** — toggle Опубліковано → status-дропдаун (3 стани); нова послуга → `disabled`.
- `docs/architecture/ARCHITECTURE.md` — `status` авторитетний, `is_published` deprecated.

## Session 16 (2026-06-10) — trim SDD ceremony to tiers (effort ∝ risk)

- Для соло-команди повний spec-триплет на КОЖНУ фічу = overhead. Узгоджено: церемонія ∝ ризик.
- **`docs/architecture/SDD-GUIDE.md`** — рівні **Tier 0/1/2** + тригери Tier 2; Feature Loop = Tier-2-only.
- **`CLAUDE.md` (root)** — default Tier 1 (issue only); `specs/features/` лише Tier 2.
- **`apps/client/CLAUDE.md` + changelog** — Change Documentation Rule полегшено (прибрано pending-staging ритуал; why-log, лише non-trivial).

---

## Session 15 (2026-06-10) — Надійність n8n v7 + локальна інфра (фокус: reliability)

### Головне — стан ЗАРАЗ
- **Стратегічний розворот:** нові сервіси НА ПАУЗІ. Будуємо фундамент НАВКОЛО сервісів, щоб юрист додавав їх легко. Деталі + бэклог: пам'ять `project_phase_foundation.md`. **3 розірвані петлі self-service:** (1) документ НЕ генерується з налаштувань адмінки (захардкоджений dispatch divorce/alimony, `ai_prompt` декоративний); (2) `is_published` (адмінка) ≠ `status` (kill-switch) — рознесені; (3) `watched_laws` без UI.
- **Фіча `workflow-hardening` ЗАВЕРШЕНА, задеплоєна, перевірена живцем.** Гілка `feature/workflow-hardening` (комміти `a487a01`, `5ce0093`), Issue #30 → змержено в main наприкінці сесії.

### Reliability v7 (form-submit: 22→28 нод)
- **Error Trigger → Format Error → Send Admin Alert** (Telegram адміну `236581343`): будь-який unhandled-збій після валідації шле алерт. Раніше — тихо.
- **Get Profile guard** (`Check Profile`→`Has Profile?`→`Respond No Profile` 422 + `alwaysOutputData`): юзер без профілю → дружнє повідомлення, не краш на Insert Case. (Get Service «not found» вже покривав Check Service Status.)
- **try/catch** навколо диспатчу Build Document (re-throw з service+case); **структурний Respond Error** (`code/message`); `App.tsx` показує серверний `message`.
- **Видалено** застарілий `scripts/build-n8n-workflow.mjs` (старі шляхи, divorce-only, захардкожені ротовані секрети).
- Нові зеркала+тести: `format-error.js` (5), `check-profile.js` (4). **Тести: root 162/162 ✅, client 68/68 ✅, tsc ✅.**

### 🔥 Error Trigger одразу окупився
Перший деплой виявив РЕАЛЬНИЙ тихий збій: **Copy Template** падала з Google-OAuth `invalid/expired/revoked` → документи не генерувались (юзер бачив лише «готується»). Раніше невидимо.

### Локальна інфра — полагоджено НАЗАВЖДИ
- Корінь токена: OAuth consent був Testing → Google вбиває refresh-токен за 7 днів. **Опубліковано в Production** → не протухає.
- Google OAuth **переавторизовано** (через ngrok-origin — cross-origin куки). Пароль n8n забутий → `user-management:reset` (+бекап БД) → новий власник.
- `docker update --restart unless-stopped n8n`.
- **NEW:** `scripts/dev-up.ps1` (одна команда: n8n+ngrok) + `docs/runbooks/local-dev-startup.md` (чеклист + усі gotchas).
- **Перевірено end-to-end:** сабмит exec 34 `success`, lastNode `Send Doc Link` ✅. ngrok-домен статичний `rosy-caution-progeny.ngrok-free.dev`; для звичайної роботи ngrok НЕ потрібен (лише Telegram-бот + OAuth).

### 🔴 Наступний фокус (НОВА сесія — `/session-start`)
**`is_published` → `status` + admin-UI lifecycle:** звести два статуси в один kill-switch + UI (бейдж + кнопка флипу + панель ревʼю `law_change_log`). Бекенд (`status`, `law_change_log`, migration 011) вже є. Файли: `apps/client/src/admin/pages/{DashboardPage,ServiceEditPage}.tsx`, `supabase/`. Чинить реальний рассинхрон + завершує lifecycle видимою кнопкою для Ольги. Інші кандидати: сервіс-агностична генерація (модель-розвилка), watched_laws UI + превʼю документа, VPS/безпека, CRON законів — `project_phase_foundation.md`.

---

## Session 14 (2026-06-10) — service-lifecycle G4+G5 ЗАВЕРШЕНО → merge в main

### Головне — стан ЗАРАЗ
- **Фіча `service-lifecycle` ПОВНІСТЮ завершена і ЗМЕРЖЕНА в `main`** (merge `a357bfb`, запушено). **Issue #29 закрито.**
- **main = trunk, чистий.** Гілку `feature/service-lifecycle` прибрано (local + remote). Активних feature-гілок немає.
- Лишились 2 старі remote-гілки з сесії 11 (`claude/fervent-pascal-VUvi3`, `claude/spec-driven-development-iLSvy`) — давно змержені, опційно видалити.

### Що зроблено
- **G4 — ручні lifecycle-інструменти** (`4b708ba`):
  - `scripts/service-lifecycle.mjs` — CLI: `status` / `validate` / `normalize` / `set-status <slug> <status>` / `log-law-change <law> <date>` (усі з `--dry-run`). Env з `apps/client/.env.local`, Supabase REST через service_role.
  - `scripts/law-registry.mjs` — **канонічний реєстр законів** (single source of truth: slug↔title↔url). **Ідентичність закону = URL, НЕ slug.**
  - **Знайдено й виправлено баг даних:** один закон мав РІЗНІ slug'и в divorce vs alimony (`simejnyj-kodeks`↔`simeinyi-kodeks`, `cpk`↔`tsyvilnyi-protsesualnyi-kodeks`, `pro-sudovyj-zbir`↔`pro-sudovyi-zbir`) → зворотний індекс по slug пропускав би послуги (юридична діра). `normalize` уніфікував дані наживо; зіставлення тепер по URL.
  - **Live-перевірка повна:** reverse index знаходить divorce+alimony (по slug і rada-id); `log-law-change` → лог-рядок + обидві→`needs_review` + оновлення дати; `set-status` повертає в active. Тестовий стан повністю відкочено (БД чиста).
- **G5 — доки** (`977f28d`): DECISIONS.md (новий розділ «status kill-switch + ідентичність закону по URL»), IMPROVEMENTS #46, roadmap (watched_laws → частково закрито), validation scorecard повністю зелений + DoD.
- **Housekeeping** (`bdaa54a`): розведено ID-колізії IMPROVEMENTS — «RLS policies» → #44, «changelog skill» → #45.
- **Permission fix:** правило `node -e` у `.claude/settings.local.json` узагальнено з `node -e ' *` (тільки одинарні лапки) до `node -e *`. Рішення: лишити на проєктному рівні (не глобально — `node -e` = довільний код).

### Тести (регресія, усі зелені)
divorce 4/4 · alimony 3/3 · root vitest 153/153 · client vitest 68/68.

### Як користуватись lifecycle-інструментами (пам'ятка)
```bash
node scripts/service-lifecycle.mjs status                          # стан усіх послуг
node scripts/service-lifecycle.mjs validate                        # сверка watched_laws з реєстром
node scripts/service-lifecycle.mjs set-status <slug> disabled      # зняти послугу з продажу (kill-switch)
node scripts/service-lifecycle.mjs log-law-change <slug|rada-id> <YYYY-MM-DD>   # зафіксувати зміну закону → флип залежних
```
Новий закон додаєш у `watched_laws` → спершу додай у `scripts/law-registry.mjs`, потім `validate`.

### 🔴 Наступні кроки (вибір фокусу для нової сесії)
Фіча service-lifecycle закрита. Кандидати на наступний фокус (1 сесія = 1 фокус):
1. **Admin-UI для lifecycle** (прямий наступник): кнопка флипу `status` у списку послуг + бейдж статусу + панель ревʼю `law_change_log`. Бекенд уже є. (IMPROVEMENTS #43 read-path + Service Builder #18/#20.)
2. **n8n v7 hardening** (надійність, ВАЖЛИВО — послуги «живі»): Error Trigger (admin alert) + ensure-profile wiring + guard IF-ноди + try/catch у Build Document. План: `docs/architecture/workflow-improvements.md` items 3–7. Зараз workflow падає ТИХО при помилці після валідації.
3. **CRON моніторинг законів** — автоматизувати те, що G4 зробив ручним (`scripts/check-law-updates.mjs` — референс; писати n8n CRON або окремий скрипт за розкладом).
4. **Військові спори** (новий сервіс) — найвищий попит, АЛЕ потрібен юрист-партнёр + модель «триаж+ескалація» (не продаж документа). Блоковано до партнерства.
5. **Хвости інфри:** VPS-деплой (прибрати ngrok), dev/prod розділення, GDPR pre-launch (consent, retention).

**Рекомендація:** #2 (n8n hardening) — найвищий ризик зараз (тихе падіння на живих послугах), або #1 (admin-UI) якщо хочеться завершити lifecycle-історію видимою кнопкою для Ольги.

---

## 🆕 Session 13 (2026-06-09) — service-lifecycle G3 + live deploy + інфраструктура

### Головне — стан ЗАРАЗ
- **Гілка `feature/service-lifecycle` ЗАПУШЕНА в origin** (`d221475`), **НЕ змержена** в main. 7 нових комітів сесії 13.
- **service-lifecycle: G1+G2+G3 готові й ЗАДЕПЛОЄНІ наживо.** Лишилось **G4** (ручні lifecycle-скрипти) + **G5** (доки) → потім merge.
- **Deploy-gap ЗАКРИТО:** обидва воркфлоу (form-submit + main-bot) оновлені в live n8n з guard-нодами.

### Що зроблено
- **G3 — read-path guards** (`c6b2d15`, деплой `f5ca036`):
  - `apps/client/src/App.tsx` — `UnavailableScreen` коли `status != 'active'`; на сабміті 503/`service_unavailable` показує message сервера. Константа `SERVICE_UNAVAILABLE_MSG`.
  - `main-bot.json` — після `Get Service` додано `Is Active?` IF (×2) → active віддає кнопку TWA/підтвердження, інакше нова нода `Service Unavailable (bot)`. 20→23 ноди, active.
  - **Перевірено Playwright** (dev TWA): `?service=divorce`→форма, `?service=military`→«недоступна» ✅. Telegram-флоу бота автотестом НЕ ганявся (потребує TG-сесії).
- **`scripts/deploy-workflow.mjs`** (NEW, `3c282da`+`f5ca036`) — деплой workflow через n8n REST API. **Використання:** `node scripts/deploy-workflow.mjs <form-submit|main-bot> [--check] [--creds-from=<file>]`. Робить: бекап live (gitignored `.backups/`) → diff нод → ін'єкція ключів з `.env.local` у Global Config (в пам'яті) → **збереження env-specific credential-ID** (by name, type-fallback для нових нод) → PUT → activate (retry на rate-limit). **Прибирає стару пастку** «відновити ключі руками».
- **GitHub Issues:** `gh` CLI встановлено+авторизовано (акаунт **Ki4**, SSH). **Issue #29** = статус-борд service-lifecycle (G1-G3 ✅, G4-G5 відкриті).
- **Docs nav** (`939360a`): 📇 індекс за номером у `IMPROVEMENTS.md` (ID не чіпані; виявлено колізії **#12, #20** + відсутній #1 — чекає рішення) + 📇 TOC у `DECISIONS.md`.
- **Permissions** (`3afc439`): `.claude/settings.json` — read-only allowlist (context7, playwright screenshots, npm ls, findstr).

### 🔴 Наступні кроки (продовження фічі)
1. **G4 — ручні lifecycle-скрипти:** флип `status` за slug + запис у `law_change_log` + флип залежних послуг у `needs_review` (зворотний індекс по `watched_laws`). Новий focus із Supabase-скриптами.
2. **G5 — доки:** DECISIONS.md (status kill-switch + needs_review=blocking + law_deps у watched_laws) + roadmap.md (watched_laws моніторинг → частково закрито).
3. Після G4+G5 — **merge `feature/service-lifecycle` → main** + закрити Issue #29 (`Closes #29`).
4. (опц.) розвести ID-колізії #12/#20 → #44/#45.

### Як деплоїти n8n тепер (важливо)
- Docker/n8n має бути піднятий (`docker start n8n`). Деплой: `node scripts/deploy-workflow.mjs <ціль>`. Ключі й credential-прив'язки скрипт відновлює сам — **руками в Global Config більше лазити не треба**.

---

## Session 12 (2026-06-08) — service-lifecycle: spec + G1 + G2 (бекенд kill-switch)

### Головне — стан ЗАРАЗ
- **Активна гілка: `feature/service-lifecycle`** (НЕ змержена в main). 3 коміти: `a2add92` (spec), `fffd813` (G1), `5826cea` (G2).
- **Фіча `service-lifecycle`** (Етап B) — backend-фундамент. Послуга = керований юніт зі `status`-kill-switch. Обсяг узгоджено: БЕЗ admin-UI, БЕЗ CRON. Спека: `specs/features/service-lifecycle/{plan,requirements,validation}.md`.

### Що зроблено
- **Spec (`a2add92`)** — 3 файли спеки + компроміси в IMPROVEMENTS #41-43 (needs_law_review дублює status; law_deps у watched_laws JSONB; read-path у боті неповний).
- **G1 (`fffd813`)** — migration 011 **застосовано + верифіковано через REST**:
  - `services.status` (`active|needs_review|disabled`, CHECK, DEFAULT `disabled`).
  - Backfill: `divorce`,`alimony` → `active`; `military`/`business`/`court_search` → `disabled` (placeholder'и); `divorce.needs_law_review` скинуто в false (стале leftover).
  - `law_change_log` — аудит-таблиця змін законів (RLS service_role only; anon заблоковано — перевірено).
- **G2 (`5826cea`)** — write-path kill-switch у `form-submit.json`:
  - Нові ноди: `Check Service Status` (Code) → `Is Service Active?` (IF) → `Respond Unavailable` (HTTP 503). Тільки `status='active'` йде далі; needs_review/disabled/not_found блокуються ДО створення case і генерації.
  - Тестована логіка: `n8n/templates/check-service-status.js` + 6 тестів.
  - Workflow JSON ресеріалізовано в 2-space, BOM прибрано (були PowerShell-артефакти).
  - **Тести зелені:** vitest 153/153, divorce 4/4, alimony 3/3.

### ⚠️ Незакритий deploy-gap (G2 НЕ в live n8n)
Локальний n8n лежить (Docker Desktop не запущений). Guard у репо-JSON, але не задеплоєний. Щоб запрацював наживо:
1. `docker start n8n`
2. Запушити `n8n/workflows/current/form-submit.json` через n8n API (**Node.js, не PowerShell** — кирилиця). Workflow ID `D2ab06X3pVUWk1py`, `N8N_API_KEY` в `.env.local`.
3. **Відновити реальні ключі в Global Config** (у JSON — плейсхолдери `YOUR_...`).

### 🔴 Наступні кроки (продовження фічі)
1. **G3 — read-path guards:** `apps/client/src/App.tsx` (додати `status` у select form_config; неактивна → екран «недоступно», читати `message` з 503-відповіді) + `main-bot.json` (Get Service → якщо не active, не віддавати кнопку TWA).
2. **G4 — ручні lifecycle-скрипти:** флип `status` за slug + фіксація зміни закону в `law_change_log` + флип залежних послуг у `needs_review` (зворотний індекс по `watched_laws`).
3. **G5 — доки:** DECISIONS.md (status kill-switch + needs_review=blocking + law_deps у watched_laws), roadmap.md (`watched_laws` моніторинг → частково закрито).
4. Деплой G2 в n8n (див. deploy-gap вище) — бажано ПЕРЕД G3, щоб перевірити kill-switch наживо.
5. Після всіх G — merge `feature/service-lifecycle` → main.

### Інше
- **Supabase був на паузі** (free-tier авто-фриз через тиждень простою) — відновлено цією сесією.
- Перевірка стану БД робиться anon-ключем для `services` (публічний read-policy, migration 005).

---

## Session 11 (2026-06-08) — SDD-фундамент змержено + стратегія/research + консолідація гілок

### Головне — стан проекту ЗАРАЗ
- **main = єдине джерело правди.** Усі гілки зведені в main (злито `fervent-pascal-VUvi3` + `spec-driven-development-iLSvy`). Правило: **одна feature-гілка за раз** — саме через паралельні гілки втрачався контекст.
- **SDD впроваджено (brownfield).** Конституція `specs/{mission,tech-stack,roadmap}.md`; команди `.claude/commands/` (`/session-start`, `/feature-spec`, `/validate`, `/update-changelog`); гайди `docs/architecture/{SDD,PROMPTING,GRAPHRAG}-GUIDE.md`. `IMPROVEMENTS.md` розширено до #20-40 (GraphRAG, AI tech debt, Advanced RAG, MCP, portfolio).
- **Продукт:** 2 послуги (divorce, alimony), обидві Tier 1, golden-тести зелені. RAG засіяно, але в проді НЕ використовується — гібридний шаблон з вшитими посиланнями на статті (`law_chunks` = мертві дані до v2).

### Стратегічні рішення (service-demand research, ця сесія)
- **Блок 0 (Україна)** → `docs/research/service-demand/00-ukraine.md`. Ядро (розлучення/аліменти) — стійкий попит (суд. розлучення −9%, не −23%). Диференціація НЕ «суд vs не-суд» (FastDoc робить позови з 2018), а **валідація юристом + умовна логіка + чесна ескалація + Telegram UX**.
- **Конкуренти:** Дія / Legal Mind — договори/розписки (НЕ позови); FastDoc — прямий конкурент по розлученню/аліментах; DocEasyCraft — B2B.
- **Кандидат №1 (in-scope):** військові спори (ТЦК) → `docs/research/service-demand/01-candidate-military-disputes.md`. Найвищий попит + порожня ніша, АЛЕ high-stakes → людина платить адвокату → модель = **досудовий триаж + ескалація до військового юриста** (не продаж документа), потрібен юрист-партнёр (не Ольга).
- **ЄС — відкладено.** Тимчасовий захист авто-продовжено до 03.2027; держави оцифровують просте (Польща CUKR); важке зарегульовано (EU AI Act high-risk, присяжний переклад людиною); RAG дорогий і волатильний; поза scope `mission.md`. → фокус на українському ядрі.

### Архітектурний курс (узгоджено в чаті)
- **Шаблони замість авто-трекінгу закону до v2.** Дороге в RAG — не вектори (перечанкувати = хвилини), а **юрист-інтерпретація + ре-валідація** при зміні закону; масштабується як `юрисдикції × послуги` → ОДНА юрисдикція = контроль вартості.
- **Наступна фіча (Етап B): `service-lifecycle` + law-aware kill-switch.** Послуга = самодостатній юніт (config + шаблон + `law_deps` + `status` + tests). `status: active|needs_review|disabled` = kill-switch (флип колонки, не деплой). `law_deps` (розширення `watched_laws`, міграція 007 вже є) = карта впливу «закон→послуги» + майбутній scope для RAG. `law_change_log` = аудит. HITL-флоу юриста = той самий, що потрібен GraphRAG для зв'язків.
- **Повторюваність:** рушій (стабільний) / визначення послуги (дані) / тести (golden) → нова послуга = дані+тести, не новий код. Ворог — drift.

### Як працювати далі (контроль над контекстом)
- **Старт сесії:** `/session-start` (тепер працює як Skill — читає specs/ + цей файл + changelog + git, дає briefing).
- **Кінець сесії:** фраза «закінчуємо» / «на сьогодні все» → Claude оновлює session-summary + changelog.
- **Одна feature-гілка за раз.** main = trunk.

### 🔴 Наступні кроки
1. (Етап B) `/feature-spec service-lifecycle` — kill-switch + `law_deps` + `status` + `law_change_log`.
2. Roadmap: `watched_laws` моніторинг 🟡 лягає в цю ж фічу.
3. (опц.) Прибрати злиті гілки `fervent-pascal` / `spec-driven`.
4. **n8n v7 hardening — committed-but-unfinished (НЕ внедрено):** ensure-profile wiring + Error Trigger (admin alert) + guard IF-ноди + try/catch у Build Document. План: `docs/architecture/workflow-improvements.md` items 3–7. Без цього workflow падає тихо при помилці після валідації.
5. Хвости з session 10: dev/prod розділення, аудит Supabase/services, документація `form_config`.

---

## Session 10 (2026-05-13) — Новий сервіс "Аліменти" + фікс якості документів

### Що зроблено

#### 1. Діагноз проблеми з `?????` в документах (сесія 9)
- **Причина**: Playwright на Windows емулює клавіатуру — кирилиця (символи > ASCII 127) стає `?`
- **Продакшн не зачіпає**: реальні користувачі вводять з телефону в Telegram → OK
- **Рішення для тестування**: `node scripts/test-webhook.mjs` — відправляє дані напряму, без браузера
- **Задокументовано** в `scripts/test-scenarios.md` розділ "⚠️ Відомі обмеження тестування"

#### 2. Сервіс "Стягнення аліментів" — реалізований end-to-end ✅
**Юридична база**: окремий позов (ст. 150, 180-184 СК України + ст. 175 ЦПК). **Не** в рамках розлучення.

**Ключові відмінності від розлучення:**
- 3 статуси шлюбу: `married` / `divorced` / `never_married` → різний вступ
- Судовий збір: позивач **автоматично звільнений** (п.3 ч.1 ст.5 ЗУ "Про судовий збір")
- Потрібні: свідоцтво про народження + довідка про склад сім'ї (не свідоцтво про шлюб)
- Доходи відповідача: роботодавець, посада, зарплата — впливають на текст

**Файли створені:**
- `n8n/templates/alimony-document.js` — повний JS шаблон (3 гілки шлюбу, 1-N дітей, % / фікс)
- `apps/client/src/data/alimonyFormConfig.ts` — 4 вкладки, 44 поля
- `supabase/migrations/010_alimony_service.sql` — ✅ виконано в Supabase
- `scripts/upload-alimony-config.mjs` — завантажено form_config в Supabase
- `test-data/alimony/fixtures/scenario-{1,2,3}.mjs` — 3 тест-сценарії
- Тести: 17/17 assertions × 3 сценарії ✅

**Формат children_details для аліментів** (відрізняється від розлучення!):
```
Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018
Іванова Марія Іванівна, 20.08.2020, свідоцтво № І-КВ 234567 від 21.08.2020
```
(ПІБ, дата нар., свідоцтво — один рядок на дитину)

#### 3. n8n workflow оновлено — тепер обидва сервіси ✅
- **Prepare Declension**: уніфікований під divorce + alimony (поля `defendant_*` замість `spouse_*`)
- **Build Document**: dispatch по `service_slug` → `buildDivorceDocument` або `buildAlimonyDocument`
- Обидва шаблони вбудовані в одну Code ноду (~45K chars)
- Оновлено через n8n REST API (ключ `N8N_API_KEY` збережено в `.env.local`)

#### 4. Інструменти для роботи з n8n API
- `N8N_API_KEY` в `.env.local` — ключ "Claude-legal-ai", ніколи не закінчується
- Workflow ID: `D2ab06X3pVUWk1py`
- **Важливо після API-оновлення**: Global Config ноді завжди потрібно відновлювати реальні ключі (в JSON — плейсхолдери)
- **Ніколи не оновлювати workflow через PowerShell** `ConvertTo-Json` — псує кирилицю. Тільки Node.js.

#### 5. Виправлення шляхів монорепо
- `scripts/scaffold-service.mjs` — шляхи `n8n-templates/` → `n8n/templates/`, `prompts/` → `n8n/prompts/`
- `scripts/test-document.mjs` — шлях `n8n-templates/` → `n8n/templates/`
- `test-data/divorce/` — скопійовано з `apps/client/test-data/` в корінь монорепо
- `docs/templates/alimony-reference.docx` — Word-файл збережено як референс

#### 6. test-webhook.mjs розширено
```bash
node scripts/test-webhook.mjs 1    # divorce: просте розлучення
node scripts/test-webhook.mjs 2    # divorce: з дітьми + аліменти
node scripts/test-webhook.mjs 3    # divorce: складний
node scripts/test-webhook.mjs 4    # divorce: мінімальний
node scripts/test-webhook.mjs a1   # alimony: 1 дитина, розлучені, %
node scripts/test-webhook.mjs a2   # alimony: 2 дитини, у шлюбі, фіксована сума
```

#### 7. E2E тест: обидва сервіси ✅
- `divorce` (scenario 2): документ отримано в Telegram, кирилиця коректна ✅
- `alimony` (a1, a2): документи отримано в Telegram ✅

---

### 🔴 НАСТУПНА СЕСІЯ — план

#### Пріоритет 1: Dev/Prod розділення
**Задача**: зробити нормальну dev-середу щоб розробляти без ngrok і без ризику зламати прод.

**Поточна архітектура (все змішано):**
- Vercel Production → ngrok → локальний n8n (погано!)
- Немає окремого webhook URL для локальної розробки

**Цільова архітектура:**
```
DEV (локально):
  Vite localhost:5173 → n8n localhost:5678/webhook/form-submit
  Telegram тест → ngrok → localhost:5678 (тільки для тесту бота)

PROD (після VPS):
  Vercel Production → n8n.domain.com/webhook/form-submit
```

**Що робити:**
1. В `.env.local` → `VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/form-submit`
2. В Vercel Production → `VITE_N8N_WEBHOOK_URL=https://n8n.domain.com/webhook/form-submit`
3. VPS: Hetzner CX22 + Docker + nginx + SSL → `n8n.domain.com`

#### Пріоритет 2: Аналіз структури БД і сервісів
**Задача**: зрозуміти поточний стан Supabase — які сервіси є, які form_config заповнені, які ні.

**Що перевірити:**
- `services` table: які slug є, у яких є form_config, у яких є title
- Стара `alimonyConfig.ts` vs нова `alimonyFormConfig.ts` — де яка використовується
- `update-form-configs.ts` — скрипт застарів (старі шляхи, стара структура `steps`)
- Навести порядок: або видалити старі конфіги, або мігрувати

#### Пріоритет 3: Як заповнювати form_config (документація)
Є 3 способи завантажити form_config в Supabase:
1. **Admin Panel** (Service Builder) → `/services/:id` → Edit → лайв-превью → Save
2. **SQL** → `UPDATE services SET form_config = '...' WHERE slug = 'alimony'`
3. **Скрипт** → `node scripts/upload-alimony-config.mjs` (одноразовий) або `npx tsx scripts/update-form-configs.ts` (для всіх)

Поточний стан: `update-form-configs.ts` орієнтований на стару структуру `steps[]` (плоский список), а форма очікує `tabs[]` з вкладеними `fields[]`. Треба або оновити скрипт, або зафіксувати що Admin Panel = єдиний правильний спосіб.

---

### Локальний запуск (памятка)
```bash
# 1. n8n
docker start n8n

# 2. ngrok (тільки для тесту Telegram-бота)
ngrok http 5678

# 3. Dev сервер
cd apps/client && npm run dev

# 4. Тест без браузера (завжди через цей скрипт!)
node scripts/test-webhook.mjs 2      # divorce
node scripts/test-webhook.mjs a1     # alimony
```

---

## 🆕 Session 9 (2026-05-12) — Ротация ключей + n8n локально + полный флоу протестирован

### Что сделано

#### 1. Ротация ключей (все скомпрометированные заменены)
- `SUPABASE_SERVICE_KEY` — новый `sb_secret_...` (старый удалён из Supabase)
- `VITE_SUPABASE_ANON_KEY` — скопирован (не менялся)
- `GEMINI_API_KEY` — новый (старый удалён из Google AI Studio)
- `ENCRYPTION_KEY` — новый 64-hex, вставлен в `.env.local` и n8n Global Config
- Все 4 ключа в `apps/client/.env.local` (gitignored)

#### 2. GitHub + Vercel
- `Ki4/Legal-AI` — запушен (private), старый `Ki4/legal-twa` — архивирован
- Vercel: оба проекта (`legal-twa`, `legal-ai-admin`) переподключены к `Ki4/Legal-AI`, Root Dir = `apps/client`
- `VITE_N8N_WEBHOOK_URL` в Vercel Production = ngrok URL (временно, до VPS)

#### 3. n8n локально (Docker)
- Запуск: `docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n -e NODE_FUNCTION_ALLOW_BUILTIN=crypto -e WEBHOOK_URL=https://rosy-caution-progeny.ngrok-free.dev docker.n8n.io/n8nio/n8n`
- **Важно**: флаг `NODE_FUNCTION_ALLOW_BUILTIN=crypto` обязателен — без него Encrypt Data нода падает
- **Важно**: `WEBHOOK_URL` нужен чтобы Telegram webhook зарегистрировался правильно
- Оба воркфлоу импортированы и активированы: `form-submit` и `main-bot`
- Credentials созданы: Supabase, Telegram, Groq (Header Auth: `Authorization: Bearer gsk_...`), Google OAuth2
- Исправлено: Groq credential — header name должен быть `Authorization`, не отображаемое имя

#### 4. ngrok
- Установлен: `winget install ngrok.ngrok` → `ngrok update` → `ngrok config add-authtoken ...`
- Статичный домен (FREE): `https://rosy-caution-progeny.ngrok-free.dev`
- Запуск: `ngrok http 5678` (нужен новый терминал, блокирует)
- Authtoken сохранён в `C:\Users\serge\AppData\Local\ngrok\ngrok.yml`

#### 5. Полный флоу — ПРОТЕСТИРОВАН ✅
- Telegram `/start` → бот отвечает меню
- "Розлучення" → бот отправляет кнопку с формой (Vercel URL)
- Форма заполняется → отправляет на ngrok → n8n обрабатывает
- Supabase: кейс создан, данные зашифрованы AES-256
- Groq: отмена ФИО (6 полей)
- JS шаблон: документ сгенерирован
- Google Docs: документ создан и расшарен
- Telegram: "✅ Дані отримано" + "📄 Ваша позовна заява готова!" + ссылка на Google Doc

#### 6. Тестовый пользователь в Supabase
- `identities.external_id = '236581343'` (реальный Telegram ID Сергея)
- `profiles.id = 0b0bedd2-caab-4a90-b14a-931a86883f41`

---

### 🔴 СЛЕДУЮЩАЯ СЕССИЯ — план

#### Приоритет 1: VPS деплой
У Сергея есть домен, на котором уже 1 сервер. Нужно разместить n8n на VPS.

**Задачи:**
1. Hetzner CX22 (~€5/мес) — заказать новый сервер (или поддомен на существующем)
2. Docker + nginx + SSL (Let's Encrypt) на VPS
3. n8n на `n8n.yourdomain.com` с переменными:
   - `NODE_FUNCTION_ALLOW_BUILTIN=crypto`
   - `WEBHOOK_URL=https://n8n.yourdomain.com`
4. Перенести credentials из локального n8n на VPS (экспорт/импорт)
5. Vercel `VITE_N8N_WEBHOOK_URL` → VPS URL (убрать зависимость от ngrok навсегда)

**Environments после VPS:**
- **prod**: Vercel production → VPS n8n
- **dev**: локальный Vite → локальный n8n (localhost:5678), ngrok только при тесте Telegram

#### Dev/Prod разделение — архитектура

**Схема:**
```
DEV                              PROD
──────────────────────           ──────────────────────
Vercel Preview (авто)            Vercel Production (main)
  ↓                                ↓
n8n локальный (Docker)           n8n на VPS (n8n.domain.com)
  ↓                                ↓
Supabase (один проект, dev-данные) Supabase (один проект, prod-данные)
```

**Ключевая переменная** — `VITE_N8N_WEBHOOK_URL`:
| Среда | Значение |
|-------|----------|
| Local (`.env.local`) | `http://localhost:5678/webhook/form-submit` |
| Vercel Preview | `https://n8n.domain.com/webhook/form-submit` (или ngrok) |
| Vercel Production | `https://n8n.domain.com/webhook/form-submit` |

**Workflow разработки после VPS:**
1. Новая фича → пишешь локально → тестируешь на `localhost:5173` + локальный n8n
2. Пушишь в GitHub → Vercel делает Preview URL автоматически
3. Проверил на Preview → мёрджишь в `main` → Vercel автодеплоит в Production
4. n8n воркфлоу обновляешь вручную: экспорт JSON → импорт на VPS

**Vercel env vars** задаются раздельно для каждой среды (Preview / Production) — это и есть механизм разделения.

#### Приоритет 2: Новый сервис — Аліменти
После VPS (чтобы сразу идти в прод):
- `alimonyConfig.ts` уже есть в `apps/client/src/data/`
- Нужен: `alimony-document.js` шаблон (аналог divorce)
- Нужен: запись в Supabase `services` (slug='alimony')
- Тест end-to-end

---

### Локальный запуск (памятка)
```
# 1. n8n
docker start n8n   # если контейнер уже есть
# ИЛИ docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n \
#   -e NODE_FUNCTION_ALLOW_BUILTIN=crypto \
#   -e WEBHOOK_URL=https://rosy-caution-progeny.ngrok-free.dev \
#   docker.n8n.io/n8nio/n8n

# 2. ngrok (новый терминал)
ngrok http 5678

# 3. dev сервер
cd apps/client && npm run dev
```

---

## Session 8 (2026-05-10) — Монорепо реструктуризация + защита секретов

### Что сделано и почему

#### 1. Монорепо структура (`C:/Users/serge/Legal-AI/`)
Проект был нечитаем: n8n, суpabase, скрипты, доки — всё вперемешку внутри `legal-twa/`.
Реструктурировано в монорепо:

```
Legal-AI/                 ← git root (новый, чистая история)
├── apps/client/          ← был legal-twa/ (React TWA + admin)
├── n8n/
│   ├── workflows/
│   │   ├── current/      ← form-submit.json, main-bot.json (АКТИВНЫЕ)
│   │   └── archive/      ← v1-v5 (старые версии)
│   ├── templates/        ← JS Code node скрипты + тесты
│   └── prompts/          ← AI промпты
├── supabase/migrations/  ← SQL миграции
├── docs/
│   ├── strategy/         ← notebooklm, product-vision, презентация юристу
│   ├── research/         ← маркетинг-ресёрч
│   ├── architecture/     ← ARCHITECTURE, DECISIONS, IMPROVEMENTS
│   └── runbooks/         ← операционные гайды
├── scripts/              ← scaffold, check-law-updates, decrypt-case, etc.
├── CLAUDE.md             ← правила структуры монорепо (Claude читает каждую сессию)
├── .gitignore
└── .gitattributes
```

**Git**: новый `git init` в `Legal-AI/`, начальный коммит сделан. Старый `.git` из `legal-twa/` удалён.
**Vercel**: ещё НЕ переподключён (ждём ротации ключей и создания GitHub репо).

#### 2. Секреты — найдено и исправлено
В старом `Ki4/legal-twa` (публичный GitHub) были захардкожены в JSON воркфлоу:
- `SUPABASE_SERVICE_KEY` (legacy JWT)
- `ENCRYPTION_KEY` (64-char hex)
- `GEMINI_API_KEY`

Исправлено:
- В `n8n/workflows/current/form-submit.json` и `archive/v5-rag.json` — заменены на плейсхолдеры
- `apps/client/.env.local` — очищен от старых ключей, структура с плейсхолдерами
- Pre-commit hook установлен: блокирует JWT/Google/Anthropic ключи при коммите
- `scripts/hooks/pre-commit` — committed copy хука
- `scripts/setup-hooks.sh` — установка хуков после git clone
- `docs/runbooks/secrets-management.md` — инструкция где брать каждый ключ

---

### 🔴 ЧТО ОСТАЛОСЬ — нужны действия Сергея

#### Срочно (безопасность):
1. **Supabase Secret key** — скопировать `sb_secret_...` (вкладка "Publishable and secret API keys")
   → вставить в `apps/client/.env.local` → `SUPABASE_SERVICE_KEY`
2. **Gemini API key** — зайти на `aistudio.google.com` → удалить старый → создать новый
   → вставить в `apps/client/.env.local` → `GEMINI_API_KEY`
3. **Encryption key** — сгенерировать новый:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   → вставить в `apps/client/.env.local` → `ENCRYPTION_KEY`
   → тот же ключ вставить в `n8n/workflows/current/form-submit.json` → Global Config node
4. **Legacy anon key** — скопировать с Supabase Legacy tab
   → вставить в `apps/client/.env.local` → `VITE_SUPABASE_ANON_KEY`

#### GitHub (после ротации ключей):
5. Создать GitHub репо `Legal-AI` (можно приватный)
6. В терминале: `! git -C "C:/Users/serge/Legal-AI" remote add origin https://github.com/Ki4/Legal-AI.git`
7. `! git -C "C:/Users/serge/Legal-AI" push -u origin main`
8. Архивировать старый `Ki4/legal-twa` (GitHub → Settings → Archive repository)

#### Vercel (после пуша):
9. Vercel Dashboard → оба проекта (client + admin) → Settings → Git → отключить старый репо → подключить `Legal-AI` → Root Directory: `apps/client`

#### n8n (следующая сессия):
10. Установить n8n локально через Docker:
    `! docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n`
11. Для Telegram вебхуков локально — нужен ngrok или cloudflared tunnel

---

### Как начать следующую сессию
Скажи Клоду: **"Прочитай apps/client/.claude/session-summary.md — верхняя секция Session 8."**

---

## 🆕 Session 7 (2026-04-08) — Strategy, commits, secrets audit

### What happened in this session
1. **Strategy canonicalized** — created `memory/project_strategy_v2.md` (canonical) + 5 Russian markdown files in `docs/notebooklm/` for upcoming Olga meeting. Covers: team (Sergey+Olga+Uncle as founders, vesting), 5-phase GTM, 3-tier product philosophy, 20-question risk FAQ, 16-week tech roadmap.
2. **Established Change Documentation Rule** — `CLAUDE.md` now requires Claude to log every file change with "why" in `.claude/changelog.md`. Goal: Sergey can pick up context between sessions without re-reading everything.
3. **3 logical commits made** from previously uncommitted work tree:
   - `1d5aafc` — Fix 13 Telegram UX issues (draft persist, back button, swipe, haptics)
   - `6e41cee` — Prep for auto-create user flow (user_first_name in webhook payload)
   - `795f342` — Add strategy docs and change-documentation rules
4. **Embedding mismatch investigated — FALSE ALARM:**
   - Seed script (`scripts/seed-divorce-laws.ts`) actually uses `gemini-embedding-001` with `outputDimensionality: 768`. The comment in file header saying `text-embedding-004` is outdated.
   - DB `law_chunks`: 21 rows, 768-dim vectors (matches seed script ✅)
   - OLD v5-rag.json workflow used `gemini-embedding-exp-03-07` (3072-dim) — this is where mismatch existed
   - **CURRENT v6-hybrid.json workflow does NOT use embeddings at all** — RAG was removed when hybrid template approach was adopted. The Global Config node comment says "GEMINI_API_KEY видалено — RAG не потрібен для hybrid підходу"
   - **Conclusion:** 21 chunks in `law_chunks` are dead data. No mismatch, no urgent fix. Decision: leave as-is, revisit in Week 6 when Tier 2 design starts.
5. **Secrets audit in Git history — REAL leaks found:**
   - `SUPABASE_SERVICE_KEY` (JWT, 219 chars) in commits `8122e8c`, `18c5ff0`, and current v5-rag.json + v6-hybrid.json
   - `ENCRYPTION_KEY` (hex64) in commit `17ab834` and current v6-hybrid.json
   - `GEMINI_API_KEY` (AIza...) in commit `8122e8c` and current v5-rag.json
   - NOT leaked: Groq, Telegram Bot Token, Google Service Account (all in n8n Credentials ✅)

### 🔴 NEXT SESSION (tomorrow morning) — Task #2 execution
**Runbook ready:** `docs/runbooks/task-2-secrets-rotation.md`

Follow it step-by-step. It's self-contained — all context, commands, rollback plan, and gotchas are in the runbook. Sergey can open it and execute without re-loading context.

**Key gotcha for tomorrow:** BEFORE rotating `ENCRYPTION_KEY`, check `SELECT COUNT(*) FROM cases WHERE encrypted_data IS NOT NULL` in Supabase. If > 0, delete test data first or migration will be needed.

**Estimated time:** 60-90 minutes.
**Blocks:** showing repo to Olga, any external partner.

### Priority changes made this session
| Task | Old | New | Reason |
|---|---|---|---|
| Task #1 auto-create user | Critical | P2 | Only blocks forwarded-link scenario; not needed for PoC |
| Embedding re-seed | High | P4 (low) | No mismatch exists — current workflow doesn't use embeddings |
| Task #2 secrets rotation | Critical | **Critical, runbook ready** | Next session morning execution |

### Session 7 files created/modified
- **Committed (`1d5aafc`, `6e41cee`, `795f342`):** see `git log` or `.claude/changelog.md`
- **Uncommitted from this session end:**
  - `docs/runbooks/task-2-secrets-rotation.md` (NEW) — tomorrow's execution plan
  - `.claude/session-summary.md` (this update)
  - `.claude/changelog.md` (session 7 entry)

---

## 🏗 What EXISTS and WORKS

### TWA (Telegram Web App) — React + Vite + TypeScript
- **Form engine**: `DynamicLegalFormBuilder.tsx` renders any form from JSON config
- **53-field divorce form**: 4 tabs (Позивач, Відповідач, Шлюб і сімʼя, Провадження)
- **form_config loaded from Supabase** `services` table (NOT from local TS file)
- **Deployed**: Vercel, branch `header/floating-tabs`
- **Dev server**: port 5173, `.claude/launch.json` configured

### n8n Pipeline v6 HYBRID (active, tested end-to-end ✅)
```
Webhook → Global Config → Validate → Is Valid?
  → Get Service → Get Profile → Encrypt Data (AES-256-GCM) → Insert Case
  → Prepare Declension → AI Declension (Groq, ~200 tokens, 6 fields)
  → Build Document (Code Node: divorce-document.js)
  → Respond OK → Copy Template → Build Replace Request
  → Replace in Google Docs → Set Permissions
  → Send Doc Link (Telegram) → Respond Success
  → [false branch] Respond Error
```
**Workflow file**: `n8n-workflows/legal-ai-form-submit-v6-hybrid.json`

### Key n8n fixes made (2026-03-23)
- Validate: `$('Webhook').first().json.body` (was `.item.` → broke in "Run Once for All Items" mode)
- Insert Case `user_id`: `$('Get Profile').first().json.user_id` (UUID) not Telegram int
- All `$('X').item.json.Y` → `$('X').first().json.Y` everywhere in v6

### Supabase
- `services` table: slug, title, form_config (JSON), ai_prompt (ONLY — system_prompt DROPPED ✅)
- `cases` table: user_id (UUID → auth.users FK), service_id, encrypted_data (TEXT, AES-256-GCM encrypted), status
- `identities` table: external_id (Telegram int), user_id (UUID), provider
- `law_chunks` table: halfvec(3072), article_num, law_title, full_content, FTS index, HNSW cosine index
  - ⚠️ **EMBEDDING MISMATCH**: seed script uses `text-embedding-004`, n8n search uses `gemini-embedding-exp-03-07` — NEED to re-embed with single model
  - ⚠️ User says actual model may be even older (v001) — verify before re-seeding
- `law_documents` table: full law text storage
- RPCs: `search_law_chunks_hybrid(vector, text, weights)`
- **RLS ENABLED** on all tables (migration 005 executed 2026-03-23)
  - `cases`, `identities`: blocked for anon, only service_role
  - `law_chunks`, `law_documents`, `services`, `courts`, `lawyers`: SELECT public
- **Supabase URL**: `https://nexkairsedqtczievxpa.supabase.co`
- **Service key**: in `.env.local` as `SUPABASE_SERVICE_KEY`

### Hybrid Template Architecture (IMPLEMENTED ✅)
```
Step 1 — AI Declension (Groq, llama-3.3-70b-versatile, ~200 tokens, temp=0):
  Input: plaintiff ПІБ, spouse ПІБ, marriage_place, children_details
  Output: 6 JSON fields:
    plaintiff_instrumental, plaintiff_genitive,
    spouse_instrumental, spouse_genitive,
    marriage_place_locative, children_genitive

Step 2 — Build Document (n8n Code Node = divorce-document.js):
  Input: answers (from form) + ai (6 declension fields)
  Output: _content (full document text, ~3000 chars)
  Zero hallucinations — all dates, addresses, ІПН from form directly
```

### Test Infrastructure
- `scripts/test-document.mjs` — local test runner (golden files + 17 structural assertions)
- `test-data/divorce/fixtures/scenario-1..4.mjs` — test fixtures (answers + mockAi)
- `test-data/divorce/expected/scenario-1..4.txt` — golden files
- Commands: `npm run test:docs` (verify), `npm run test:docs:update` (regenerate)
- `test-data/divorce/manual-test-scenario-3.txt` — cheat sheet for manual form filling
- `scripts/test-scenarios.md` — manual test scenarios (children_details: ONLY "ПІБ, дата" format!)

---

## 📊 Test Results (2026-03-23)

| # | Scenario | Structural | Golden | Notes |
|---|----------|-----------|--------|-------|
| 1 | Simple: no kids, mutual consent | 17/17 ✅ | 100% ✅ | |
| 2 | Children + alimony (2 kids, %) | 17/17 ✅ | 100% ✅ | |
| 3 | Complex: property + debt + exempt | 17/17 ✅ | 100% ✅ | |
| 4 | Minimal (required fields only) | 17/17 ✅ | 100% ✅ | |

**Live e2e test (2026-03-23)**: v6 hybrid deployed, form → Google Doc generated ✅
- AI declension worked: "Шевченком Олександром Миколайовичем", "Центральному РАЦСі м. Харкова" ✅
- JS template: no hallucinations, exact dates from form ✅

**Live e2e test (2026-03-27)**: v6 + Encrypt Data → form → encrypted case → Google Doc ✅
- Encrypt Data node: AES-256-GCM, `v1:...` format stored in Supabase ✅
- Validate fix: `$('Webhook').first().json.body` works in production webhook ✅
- Insert Case: UUID from Get Profile (not Telegram int) ✅

---

## 🎯 AI Declension Contract (6 fields)
```json
{
  "plaintiff_instrumental": "ПІБ позивача (орудний — між мною)",
  "plaintiff_genitive":     "ПІБ позивача (родовий — кого?)",
  "spouse_instrumental":    "ПІБ відповідача (орудний — із ким?)",
  "spouse_genitive":        "ПІБ відповідача (родовий — стягнути з кого?)",
  "marriage_place_locative":"Назва установи (місцевий — де зареєстрував?)",
  "children_genitive":      "ПІБ дітей (родовий) з датами р.н., або null"
}
```
Prompt file: `prompts/divorce-declension-prompt.txt`

---

## 📋 NEXT SESSIONS (Priority Order)

### Session 3: TWA Form Validation + Input Cleanup ✅ DONE (2026-03-25)
**Completed**:
1. ✅ IPN field order fixed: `has_no_ipn` → `tax_number` (show_if: != true) → `passport_series` — обидва таби
2. ✅ Tab checkmark = required fields only (optional не блокують галочку)
3. ✅ Auto-scroll: умовні поля scrollIntoView після анімації (FormField.tsx)
4. ✅ DatePicker: враховує bottom bar (100px), відкривається вгору якщо мало місця
5. ✅ Tooltip: не виходить за екран (clamp), стрілка вказує на іконку, `text-wrap: balance`
6. ✅ Property text: без `________` коли `property_dispute: 'separate'`
7. ✅ IMPROVEMENTS.md: шаблони Google Docs + Service Builder architecture notes
8. ✅ Supabase form_config оновлено для всіх 5 сервісів
**Key decisions**:
- `show_if: { operator: '!=' , value: true }` показує поле якщо parent = undefined/null/false
- Tab done = `countRequired === countRequiredAnswered` (не всі поля, тільки required)
- Tooltip: `width: fit-content` + `maxWidth: 220` + `text-wrap: balance`

### Session 4: Admin Panel Separation ✅ DONE (2026-03-25)
**Completed** (Variant A — same repo, separate Vite builds):
1. ✅ `admin.html` — окремий HTML entry (без Telegram SDK)
2. ✅ `src/admin/main.tsx` — окремий React entry point
3. ✅ `vite.config.admin.ts` — окремий Vite config → `dist-admin/`
4. ✅ `vercel.admin.json` — конфіг для окремого Vercel project
5. ✅ Видалено `/admin` prefix з усіх роутів (тепер `/login`, `/services`, etc.)
6. ✅ Видалено admin lazy-load з TWA `main.tsx`
7. ✅ Скрипти: `dev:admin` (port 5174), `build:admin`, `preview:admin`
8. ✅ `.claude/launch.json` — додано `legal-admin` server config
**Key decisions**:
- Admin роути без `/admin` prefix — буде на окремому домені
- SPA fallback через Vite plugin `adminSpaFallback()` (dev mode rewrite to `admin.html`)
- Shared код (`lib/supabase.ts`, `types/form.ts`, `DynamicLegalFormBuilder`) — залишається на місці
- Auth: вже є через Supabase Auth (`useAuth` hook) — додатковий auth не потрібен
**Vercel deploy**: створити project `legal-ai-admin`, build cmd = `npm run build:admin`, output = `dist-admin`

### Session 4.5: Admin Auth + Service Builder UX + Responsive ✅ DONE (2026-03-25)
**Completed**:
1. ✅ Auth: `ForgotPasswordPage` (надсилає recovery email), `ResetPasswordPage` (нова форма пароля)
2. ✅ `useAuth.ts`: додано `resetPassword(email)` + `updatePassword(password)` методи
3. ✅ `AdminApp.tsx`: глобальний `PASSWORD_RECOVERY` listener → `navigate('/reset-password')`
4. ✅ `LoginPage.tsx`: видалено реєстрацію, тільки login + "Забули пароль?" лінк
5. ✅ Supabase "Enable sign ups" вимкнено → invite-only (юристів додає адмін вручну)
6. ✅ Supabase Site URL → `https://legal-ai-admin.vercel.app` (recovery link вже не йде на localhost)
7. ✅ `FormBuilder.tsx`: транслітерація (UA→Latin), auto-slug, auto-field-ID, clone field (📋), move-to-tab, show_if `!=` оператор, onboarding hints
8. ✅ `ServiceEditPage.tsx`: live preview (no manual refresh), `isDirty` + "● Незбережено", `beforeunload` warning, preview modal (👁 кнопка), responsive top bar, короткі таб-лейбли на мобілці
9. ✅ `AdminLayout.tsx`: mobile sidebar drawer (гамбургер + overlay backdrop), mobile top bar
10. ✅ `DashboardPage.tsx`: compact responsive header
11. ✅ `index.css`: кастомні scrollbars (5px, slate-700, `scrollbar-width: thin` для Firefox)
12. ✅ Horizontal scroll fix: `overflow-x-hidden` на main + `break-all` на URL елементі
**Known issues / TODO**:
1. ⚠️ Supabase email rate limit (3/год на free plan) — для тестів: SQL Editor `UPDATE auth.users SET encrypted_password = crypt('pass', gen_salt('bf')) WHERE email = '...'`
2. ⚠️ `build:admin` script uses `require('fs')` (CJS) but package.json has `"type": "module"` — може зламатись на деяких Node версіях. Fix: замінити на `import { renameSync } from 'fs'`
3. 💡 Supabase Email Templates — локалізувати на українську (Authentication → Email → Templates)
**Key technical note**: Recovery link від Supabase Dashboard редиректить на Site URL. `AdminApp.tsx` глобально слухає `PASSWORD_RECOVERY` event → `navigate('/reset-password')`. Supabase free plan — 3 recovery email/год, workaround — SQL crypt.

### Session 5: Інфраструктура під нові послуги ✅ DONE (2026-03-26/27)
**Goal**: Підготувати базу для швидкого додавання нових послуг після зустрічі з юристом
**Що зробили:**

#### 1. Migration 007 — watched_laws (supabase/migrations/007_watched_laws.sql)
**Чому:** Потрібно зберігати які закони використовує кожна послуга, щоб потім CRON міг моніторити зміни на zakon.rada.gov.ua. Юридична відповідальність — якщо ст.183 СК зміниться, а шаблон ні → клієнт отримає неправильний документ.
- `services.watched_laws JSONB DEFAULT '[]'` — масив законів з артиклями
- `services.needs_law_review BOOLEAN DEFAULT false` — CRON ставить true коли знайшов зміну
- `law_documents.source_url TEXT` — URL на zakon.rada.gov.ua для кожного закону
- Заповнено `watched_laws` для divorce з **реальними датами редакцій** (перевірено на zakon.rada.gov.ua 2026-03-26):
  - СК України: остання редакція 2026-03-04 (закон 4779-IX)
  - ЦПК України: остання редакція 2025-07-17
  - Про судовий збір: остання редакція 2026-03-10
- Структура кожного закону: `{ slug, title, url, last_known_date, articles: [{number, title}] }`
- **Статус**: SQL готовий, потрібно виконати в Supabase SQL Editor

#### 2. Shared utilities (n8n-templates/shared/utils.js)
**Чому:** При додаванні нових послуг (аліменти, опіка, борг) кожен шаблон буде дублювати одні й ті ж helper-функції. Краще мати одне місце.
- `MONTHS[]` — масив місяців в родовому відмінку (для formatDate)
- `formatDate(iso)` → "20 червня 2015"
- `formatDateQuoted(iso)` → "«20» червня 2015" (для офіційних документів)
- `val(answers, field, fallback)` — значення або прочерк
- `has(answers, field)` — чи заповнено поле
- `formatIPNorPassport(answers, prefix)` — ІПН або серія+номер паспорту
- `formatAddress(answers, prefix)` — повна адреса з компонентів
- **Важливо**: n8n Code Node = vanilla JS без import/require. `shared/utils.js` — reference. `scaffold-service.mjs` копіює функції **inline** в новий шаблон при генерації.

#### 3. Generic test runner (scripts/test-document.mjs)
**Чому:** Раніше test-document.mjs був захардкоджений під divorce. Щоб тестувати нові послуги (alimony, custody) без дублювання коду.
- Автовизначення сервісу з аргументів (`npm run test:docs -- alimony`)
- Fixtures: `test-data/{service}/fixtures/scenario-N.mjs`
- Golden files: `test-data/{service}/expected/scenario-N.txt`
- `ASSERTIONS` map — per-service перевірки (divorce: ПОЗОВНА ЗАЯВА, СК, ЦПК тощо)
- Default: `divorce` (зворотна сумісність)

#### 4. Scaffold script (scripts/scaffold-service.mjs)
**Чому:** Нова послуга вимагає створення 6+ файлів за шаблоном. Scaffold автоматизує це.
- `node scripts/scaffold-service.mjs alimony "Аліменти"` → генерує:
  - `n8n-templates/alimony-document.js` з inline utils
  - `test-data/alimony/fixtures/scenario-1.mjs`
  - `test-data/alimony/expected/scenario-1.txt`
  - Нагадування: додати в ASSERTIONS map

### Session 6: Encryption + Deployment Fixes ✅ DONE (2026-03-27)
**Goal**: Шифрування PII в cases.encrypted_data + фікс деплоя після розділення адмін/форма
**Що зробили:**

#### 1. AES-256-GCM шифрування PII
- Новий "Encrypt Data" Code Node в n8n workflow (між Get Profile і Insert Case)
- Формат: `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>` — версіонований для ротації ключів
- `ENCRYPTION_KEY` в Global Config (64-char hex)
- Insert Case тепер пише зашифрований рядок замість plain JSON
- Міграція 008: `encrypted_data` JSONB → TEXT
- `scripts/decrypt-case.mjs` — утиліта для GDPR-запитів

#### 2. Deployment fixes (після розділення admin/form)
- Vercel `VITE_N8N_WEBHOOK_URL`: `webhook-test` → `webhook` (production mode)
- App.tsx: додано перевірку `!res.ok` + показ помилки через `tg.showAlert`

#### 3. n8n Validate + Insert Case fixes
- Validate: `$('Webhook').first().json.body` (production webhook кладе body інакше ніж test)
- Insert Case `user_id`: `$('Get Profile').first().json.user_id` (UUID, не Telegram int)
- ⚠️ Ці фікси зроблені вручну в n8n ТА в build-скрипті

**Файли змінені:**
- `scripts/build-n8n-workflow.mjs` — Encrypt Data node, connections, Validate fix, Insert Case fix, ENCRYPTION_KEY
- `src/App.tsx` — !res.ok error handling
- `.env.example` — ENCRYPTION_KEY placeholder
- `supabase/migrations/008_encrypt_cases_data.sql` — NEW
- `scripts/decrypt-case.mjs` — NEW

**Live e2e test**: форма → Encrypt Data → Insert Case → Google Doc ✅

### Session 6.5: Re-embed law_chunks (fix model mismatch) ⭐ BEFORE NEXT SERVICE
**Problem**: Seed script used `text-embedding-004` (or possibly even older v001), but n8n search query uses `gemini-embedding-exp-03-07`. Different models = incompatible vector spaces = broken similarity search. Hybrid search partially masks this (FTS keyword leg works fine, but 70% weight is on broken vectors).
**Steps**:
1. Verify which model actually created current embeddings (check seed script / Supabase)
2. Decide on target model (align seed + n8n to same model, preferably latest stable Gemini)
3. Re-run seed script with correct model → re-embed all law_chunks
4. Update n8n workflow if needed to match
5. Test: run hybrid search, verify top-5 results are relevant for divorce queries
**Also**: clean up law texts while re-seeding (user mentioned laws may not reflect actual legal texts well — "learning phase" data)

### Session 7: Зустріч з юристом → Нова послуга ⭐ NEXT (поточний пріоритет)
**Goal**: Зібрати вимоги від юриста і додати другу послугу (аліменти або опіка)
**Підготовка:**
- `docs/service-builder-checklist.md` — юрист заповнює перед зустріччю
- `IMPROVEMENTS.md п.11б` — показати юристу чому watched_laws важливо (ст.183 СК = 80+ редакцій)
- Migration 007 треба виконати перед зустріччю (SQL Editor в Supabase)
**На зустрічі:**
1. Юрист перевіряє документ розлучення (якість тексту)
2. Юрист заповнює чеклист для нової послуги
3. Юрист називає 2-3 статті для нової послуги → вписати в watched_laws
**Після зустрічі (1 сесія розробки):**
1. `node scripts/scaffold-service.mjs {slug} "{назва}"` — генерує каркас
2. Заповнити form_config через Service Builder в адмін-панелі
3. Написати `{service}-document.js` по шаблону scaffold
4. Додати тест-fixtures і golden files
5. Тест end-to-end

### Session 8: GDPR completion + Pre-launch
**Goal**: Готовність до публічного запуску
**Steps** (шифрування вже ✅ done session 6):
1. Consent checkbox у TWA перед submit
2. Retention policy (auto-delete cases after 90 days)
3. Privacy Policy сторінка
4. RLS policies для user-owned data

### Session 9: Monitoring + Quality
1. n8n CRON: weekly law change monitor (watched_laws → zakon.rada.gov.ua) — `scripts/check-law-updates.mjs` вже є як референс
2. Агент-критик після генерації документу (другий LLM-виклик)
3. Error handling: fallback якщо Groq не відповів

### Session 10+: CI/CD + Docker Isolation (коли масштабуємось)
**Тригери — коли БУДЬ-ЯКИЙ з цих пунктів стане реальністю:**
1. Найм розробника → дати йому Claude з автономним режимом → Docker обовʼязковий
2. CI/CD де Claude автоматично фіксить баги → GitHub Actions + container ізоляція
3. Робота з реальними даними клієнтів (не тестовими) → sandbox для безпеки
**До цього моменту**: Permissions + Git + Worktree = достатньо

---

## ⚙️ Key Technical Details (for context recovery)

### n8n Specifics
- **Webhook URL**: `https://legal-ai-assistant.app.n8n.cloud/webhook/form-submit`
- **Mode**: "Run Once for All Items" → ЗАВЖДИ `.first()`, НІКОЛИ `.item`
- **Global Config**: Sequential chain: Webhook → Global Config → Validate (NOT parallel)
- **Validate** expects: `{service_slug, user_id, answers}` from webhook body
- **Insert Case user_id**: `$('Get Profile').first().json.user_id` (UUID) — not Telegram int
- **Send Doc Link**: Parse Mode = HTML (Markdown breaks URLs with underscores)
- **Groq model**: `llama-3.3-70b-versatile`, temp=0 for declension, max_tokens=300
- **Anthropic credential**: broken in n8n (known bug), use HTTP Request node instead
- **Starter plan**: немає Variables → ключі хардкоджені в Global Config Code Node

### Supabase Specifics
- **anon key** = публічний (в frontend коді) → через RLS не має доступу до cases/identities
- **service_role key** = в `.env.local` і в n8n Global Config → обходить RLS
- `identities` table: `id` = identities UUID, `user_id` = auth.users UUID, `external_id` = Telegram int
- `cases.user_id` → foreign key → `auth.users.id` (не `identities.id`, не Telegram int!)
- Divorce service: `slug = 'divorce'`, `id = 1`

### TWA / Form Specifics
- form_config loaded from Supabase, `divorceFormConfig.ts` = fallback only
- `children_details` field: format "ПІБ, дата" per line (НЕ вік, НЕ школа — це піде в документ verbatim)
- `spouse_tax_number: "-"` — форма відправляє буквальний дефіс якщо юзер ввів — треба очищати
- TypeScript strict: `import type { }` required (verbatimModuleSyntax)
- **IPN logic (session 3)**: `show_if: { field: 'has_no_ipn', operator: '!=', value: true }` — показує ІПН поле коли has_no_ipn = undefined/null/false. Stale cleanup у handleChange вже чистить приховані поля автоматично.
- **Tab checkmark**: `countRequired === countRequiredAnswered` — тільки required поля, optional не блокують ✓
- **Tooltip**: `width: fit-content` + `maxWidth: 220px` + `text-wrap: balance` — рівномірний текст при переносі
- **Admin panel**: окремий Vite build (`vite.config.admin.ts`), entry = `admin.html` → `src/admin/main.tsx`, dev port 5175, output `dist-admin/`. Роути без `/admin` prefix — окремий домен. Auth: invite-only (Supabase "Enable sign ups" OFF). Recovery email → Site URL → `AdminApp.tsx` PASSWORD_RECOVERY → `/reset-password`.
- **Транслітерація (UA→Latin)**: функція `transliterate()` в `FormBuilder.tsx` — для auto-slug і auto-field-ID. "Морський юрист" → "morskyi_yuryst".

### Google Docs Specifics
- Template doc ID in Global Config
- Flow: Copy template → Replace {{DOCUMENT_CONTENT}} placeholder → Set permissions → Send link
- Font: Arial (default) — форматування базове, без стилів

---

## 📁 Repo Structure (current)
```
legal-twa/
├── .claude/
│   ├── launch.json                  — Dev server config (port 5173)
│   └── session-summary.md           — THIS FILE
├── docs/
│   └── service-builder-checklist.md — Шаблон для юриста (NEW session 3)
├── prompts/
│   ├── divorce-declension-prompt.txt — 6-field declension prompt (v6)
│   └── divorce-ai-prompt.txt         — OLD full-AI prompt (superseded)
├── n8n-templates/
│   ├── divorce-document.js           — JS template: buildDivorceDocument(answers, ai)
│   └── shared/
│       └── utils.js                  — Shared helpers (MONTHS, formatDate, val, has, ...) (NEW session 5)
├── n8n-workflows/
│   ├── legal-ai-form-submit-v5-rag.json  — OLD (deprecated)
│   └── legal-ai-form-submit-v6-hybrid.json — ACTIVE (hybrid template, deployed)
├── scripts/
│   ├── test-document.mjs             — Generic multi-service doc test runner (refactored session 5)
│   ├── scaffold-service.mjs          — Generates new service skeleton (NEW session 5)
│   ├── check-law-updates.mjs         — Reference impl for CRON law monitoring (NEW session 5)
│   ├── decrypt-case.mjs              — Decrypt case PII for GDPR requests (NEW session 6)
│   ├── test-webhook.mjs              — Sends test to n8n webhook
│   ├── test-scenarios.md             — Manual test data
│   ├── seed-divorce-laws.ts          — Seeds law_chunks
│   └── update-form-configs.ts        — Uploads form_config to Supabase (всі 5 сервісів)
├── test-data/
│   └── divorce/
│       ├── fixtures/scenario-1..4.mjs  — Test inputs
│       ├── expected/scenario-1..4.txt  — Golden files (updated session 3)
│       └── manual-test-scenario-3.txt  — Cheat sheet
├── supabase/migrations/
│   ├── 002..006_*.sql               — All executed ✅
│   ├── 007_watched_laws.sql         — watched_laws + needs_law_review + source_url (NEW session 5, ✅ executed 2026-03-27)
│   └── 008_encrypt_cases_data.sql   — encrypted_data JSONB → TEXT (NEW session 6, ⬜ execute in SQL Editor)
├── src/
│   ├── data/
│   │   ├── divorceFormConfig.ts     — Local fallback (53 fields, IPN order fixed session 3)
│   │   └── [alimony/military/etc]FormConfig.ts — Інші сервіси (у Supabase актуальні)
│   ├── types/form.ts                — FormConfig, FormField types
│   ├── components/
│   │   ├── DynamicLegalFormBuilder.tsx — Main form engine (tab checkmark fixed session 3)
│   │   └── form/
│   │       ├── FormField.tsx        — Auto-scroll on conditional appear (session 3)
│   │       ├── Tooltip.tsx          — Clamp + text-wrap:balance (session 3)
│   │       └── fields/
│   │           └── DatePickerField.tsx — Bottom bar offset fix (session 3)
│   ├── admin/                       — Адмін-панель (окремий Vite build, session 4)
│   │   ├── main.tsx                — Admin entry point (session 4)
│   │   ├── AdminApp.tsx            — Routes + PASSWORD_RECOVERY listener (session 4.5)
│   │   ├── hooks/useAuth.ts        — resetPassword + updatePassword (session 4.5)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       — Login only, no registration (session 4.5)
│   │   │   ├── ForgotPasswordPage.tsx — Sends recovery email (session 4.5)
│   │   │   ├── ResetPasswordPage.tsx  — New password form from token (session 4.5)
│   │   │   ├── DashboardPage.tsx   — Responsive compact header (session 4.5)
│   │   │   └── ServiceEditPage.tsx — Live preview, isDirty, beforeunload, modal (session 4.5)
│   │   └── components/
│   │       ├── AdminLayout.tsx     — Mobile sidebar drawer + hamburger (session 4.5)
│   │       └── FormBuilder.tsx     — Auto-slug, auto-ID, clone, move-tab, hints (session 4.5)
│   └── App.tsx                      — Telegram WebApp init
├── admin.html                       — Admin HTML entry (no Telegram SDK, session 4)
├── vite.config.admin.ts             — Admin Vite config → dist-admin/ (session 4)
├── vercel.admin.json                — Admin Vercel project config (session 4)
├── IMPROVEMENTS.md                  — Backlog (п.2а law monitoring, п.17-20 архітектура)
└── package.json
```

---

## 💡 How to Start a New Session

Paste this at the start of a new chat:
```
Прочитай .claude/session-summary.md — це повний контекст проєкту Legal AI TWA.
Задача цієї сесії: [ОДНА задача з NEXT SESSIONS вище]
```

### Rules for Productive Sessions
1. **1 сесія = 1 фокус** — не змішувати форму + n8n + БД
2. **Скажи що НЕ робити** — "Поки не чіпай n8n, тільки TWA код"
3. **Скріншоти n8n** — Claude не має доступу до n8n UI
4. **children_details** — завжди тільки "ПІБ, дата народження" без віку/школи/зайвого тексту
5. **`.item` vs `.first()`** — в n8n "Run Once for All Items" завжди `.first()`
6. **Закінчення сесії** — попроси "оновити session-summary.md" + закомітити

### What Claude Can vs Cannot Do
| ✅ Can | ❌ Cannot |
|--------|----------|
| Write/edit code in repo | Access n8n UI (need screenshots) |
| Run scripts locally | Push to production n8n |
| Read/write Supabase via REST API | Access Telegram bot directly |
| Generate test data | Run tests without Execute Workflow |
| Execute SQL via Supabase REST | DDL via REST (use SQL Editor) |
