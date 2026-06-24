# Legal AI — Master Context Document
> Updated: 2026-06-23 (session 45 — admin design-system (світла Claude-Design канва + темна тема) + law-change-impact агент (Tier-2, G1-G4, migration 027 застосована) + viz-lab пісочниця; ⚠️ **УСЕ на гілці `claude/wizardly-dirac-qxqw5u`, НЕ змержено в main**, деталі нижче. | session 44 — issue-гігієна: закрито #3/#8/#23 як superseded, решта backlog лишена; деталі нижче. ⚠️ session 43 (divorce #67) тримається held на гілці `fix/divorce-property-debt-variant-b` — її лог приїде в main при мерджі. | session 42 — service-mirror ЗАВЕРШЕНО: слайси 2+3 ЗМЕРЖЕНО в main, migration 025+026 застосовані, слайс 3 e2e-верифіковано наживо (upload→інбокс→signed URL→PDF), **issue #66 ЗАКРИТО**. Знайдено+виправлено передіснуючу поломку `tsc -b` на main.)
> Прочитай эту секцію першою — вона найсвіжіша.

---

## 🆕 Session 45 (2026-06-23) — design-system + law-change-impact агент + viz-lab (велика, 3 теми, ВСЕ на гілці)

### ⚠️ Стан гілки — читати першим
- **УСЕ на `claude/wizardly-dirac-qxqw5u`, НЕ змержено в main** (~14 комітів). `main` чистий, не чіпали.
- Свідомо порушено «1 сесія = 1 фокус»: дослідницько-дизайнерська сесія за бажанням Сергія, 3 паралельні напрями (A/B/C нижче).
- **Migration 027 ЗАСТОСОВАНА Сергієм** (Supabase SQL Editor, Success) — `law_change_log` має `article_diffs`+`ai_*` колонки.
- Тести: UI `npm test` **191 ✅**; Node `npx vitest run --root <repo> scripts n8n` **958 ✅**; tsc/build clean. Один **pre-existing** eslint `react-hooks/set-state-in-effect` у `ServiceRequestsPage:52` (не від цієї сесії).

### A. viz-lab — пісочниця візуалізації послуг (route `/viz-lab`, demo-data, БЕЗ auth)
- 5 видів: **Каталог** (layered-граф закон→стаття→послуга→документ + тумблер Структура/Бізнес-оверлей + панель «Зміни законів» з виручкою під ризиком), **Послуга детально** (3 макети), **Технічна** (пайплайн форма→n8n→Supabase→PDF), **Алгоритм форми** (decision-tree з `show_if`), **Пріоритизація** (bubble попит×health×виручка).
- **#87 focus-граф:** клік по послузі → підграф ЛИШЕ її (auto-layout, не ручні координати). Код: `src/admin/viz/`.
- Demo-дані у формі реальних типів (FormField/show_if, Service, law_chunks) → свап на живий Supabase тривіальний. Backlog: IMPROVEMENTS #87-90.

### B. law-change-impact — агент «що змінилось» (Tier-2: спека + G1-G4 коду; n8n digest лишився)
- **Навіщо:** при зміні закону агент ПОПЕРЕДНЬО описує юристу *що саме змінилось* і *вплив по послугах* — закриває єдиний юр-ризик (проґавлена зміна). AI чернетка → підпис Олі.
- **Архітектура (2 стадії):** монітор (Node, наявний CRON) — L0 детект + L1 **детермінований diff** редакцій (знімок у рядок до `is_stale`); n8n `law-change-digest` — L2 scope + L3 Groq + L4 критик + abstention → пише `ai_*`. Severity **юридична**, не попит. Advisory-only, деградація ≥ сьогодні.
- **Спека:** `specs/features/law-change-impact/{plan,requirements,validation}.md` (+ rows у roadmap).
- **G1** (Node, без LLM): `scripts/lib/{law-text,law-diff,law-impact}.mjs`; `applyLawChange`+`check-law-updates.mjs` пишуть `article_diffs`+`ai_status='pending'`. **Migration 027 застосована.**
- **G2:** `n8n/templates/law-change-scope.js` (computeImpactScope + diffTouchesNumbers).
- **G3:** `n8n/templates/law-change-groundedness.js` (детерм. критик) + `n8n/prompts/law-change-{digest,critic}.txt`.
- **G4 (UI):** картка «AI-чернетка» в `admin/pages/LawChangeLogPage.tsx` + типи `lib/lawChangeLog.ts` (graceful pre-migration).
- **ЛИШИЛОСЯ:** зібрати **n8n workflow `law-change-digest`** (Schedule → добір `ai_status='pending' AND article_diffs IS NOT NULL` → L2 RPC → L3 Groq HTTP → L4 Code → запис ai_*) з готових `n8n/templates/law-change-*` + `n8n/prompts/law-change-*`. Тоді агент живий.
- Демо-рядок для перегляду картки: INSERT у `law_change_log` (Сергій робив, прибрав).

### C. Admin design-system — світла канва Claude Design + темна тема (фокус-вектор сесії)
- **Джерело:** Claude Design експорт (`.dc.html` «Legal AI - Дизайн-система» + chat1.md інтент + admin-ux-brief.md). Інтент 1-в-1 з реалізацією. **DesignSync MCP НЕ авторизується в Claude Code Web** (`/design-login` потребує інтерактивного терміналу) → працюємо з файлів.
- **Токени** — CSS-змінні `--c-*` (`index.css`) + Tailwind семантичні (`canvas/paper/paperAlt/line/ink/inkSoft/inkMute/brand/ok/warn/danger`) у 2 палітрах; перемикач ☀/☾ (`src/admin/theme/`, default світла, localStorage, `<html data-theme>`). **Вся адмінка (14 файлів) переведена** зі slate на токени (4 паралельні агенти).
- **Geist** self-hosted (`@fontsource/geist-sans`+`geist-mono`, latin+cyrillic, bundled). Canva-тінь (`shadow-card`), **soft-blue active nav** (не важка заливка — як каже бриф).
- **Бібліотека `src/admin/ui/`:** `Button/IconButton/Badge/Chip/Field(Label/Input/Textarea)/Card/SectionLabel/ReviewItem` + `components/ServiceCard`. Вітрина **`/design`** (без auth) — жива «Бібліотека» канви у світлій/тёмній.
- **Сторінки складаються з бібліотеки:** Login ✅ (токени+перемикач), Dashboard «Мої послуги» ✅ (ServiceCard+Lucide), сайдбар `AdminLayout` ✅ (Lucide: Briefcase/MessageSquare/FileText/ClipboardList + Landmark-лого + LogOut).

### 🔴 Наступний крок (за пріоритетом брифа §5 — йдемо по порядку)
1. **Скласти решту сторінок із `ui/`** (кожна — окремий коміт + скрін де можу):
   - **3 інбокси** (NotesInbox / ServiceRequests / LawChangeLog) на `ReviewItem` (+ фікс «✓ Вирішено» = явна кнопка).
   - **ServiceView** «дзеркало» — анатомія на `Chip` + секції, сховати жаргон під «технічні деталі».
   - **ServiceEdit** — таб-бар, прибрати «чеклист-пустушку».
   - Lucide-іконки в тілі сторінок (де ще емодзі: 🔬🔗🧩👁✏️🗑💾).
2. **n8n `law-change-digest`** workflow (B) — зібрати в редакторі.
3. **viz-lab** → живі дані Supabase.
4. **Merge:** гілка велика й багатотемна → ймовірно розбити на кілька PR при мерджі в main (viz-lab / agent / design-system).

### Запуск середовища
- Адмінка: `cd apps/client && npm run dev:admin` → `:5174` (логін Supabase з `.env.local`).
- **Нові no-auth роути:** `/viz-lab` (пісочниця) і `/design` (бібліотека) — відкриваються БЕЗ логіну, зручно дивитись.
- Тести: UI `npm test`; Node `npx vitest run --root /home/user/Legal-AI scripts n8n`. Білд: `npm run build:admin`.

---

## 🆕 Session 44 (2026-06-22) — issue-гігієна: чистка backlog-issues (bulk-import 2026-06-07)

### Головне — стан ЗАРАЗ
- **Фокус:** прибрати з GitHub Issues ідеї-бэклог, що порушують політику CLAUDE.md (IMPROVEMENTS = бэклог ідей never-closed, Issues = work-units). Закривали content-driven — ТІЛЬКИ superseded (переписані/перекриті пізнішим пунктом IMPROVEMENTS або вже зробленою роботою), не за датою.
- **Закрито 3 issue:** **#3** [#36] valid_from/valid_to (перекрито `is_stale` #29/#11, s.34) · **#8** [#27] prompt-versioning (застаріло після doc-engine #34; LLM-крок → #54) · **#23** [#5] монетизація lawyer_type/revenue_share (рішення Сергія: тримати лише як ідею в IMPROVEMENTS #5, не як issue).
- **Лишено відкритими 12:** #5,#10,#13,#15,#16,#19,#20,#21,#22,#24,#26 — актуальні + окремі, нічим не перекриті. **#22 (портфоліо)** лишено свідомо — це матеріал для LinkedIn/пошуку роботи Сергія, не продукт.
- **IMPROVEMENTS #36/#27/#5 розмічені** статус-пометками, щоб ідеї не загубились після закриття issue.
- **Гілка `chore/issue-hygiene-session-44`** змержена в main + запушено (doc-only, нуль ризику).
- **Доска тепер:** #67 (held під Olga) · #33 (Olga-трекер) · + 11 backlog-ідей.
- ⚠️ Гілка #67 `fix/divorce-property-debt-variant-b` (лог session 43) — без змін, далі held під wording sign-off Ольги; її лог приїде в main при мерджі.

### 🔴 Наступний крок
1. **Завтра (Сергій):** косметика адмінки — прийде з ідеями + дизайном. Нова сесія, новий фокус (1 сесія = 1 фокус).
2. **#67** — чекає фідбек Ольги по формулюваннях → merge + deploy (`upload-document-template.mjs divorce` + live smoke).
3. ⏰ Backlog Ольги (~2026-06-25): флип alimony-change, 2 зміни законів (СК/ЦПК), CRON `schedule:`, exception_if sign-off.

---

## 🆕 Session 42 (2026-06-21) — service-mirror слайс 3: заявка на послугу (`service_requests` + Storage) — ЗАВЕРШЕНО, #66 закрито

### Головне — стан ЗАРАЗ
- **main чистий + запушено** (`a0ce654`). Слайси 2 (`36ce66f`) і 3 (`a0ce654`) ЗМЕРЖЕНО, обидві гілки видалено. **Issue #66 ЗАКРИТО** — service-mirror готовий по всіх 3 слайсах.
- **Migration 025 + 026 застосовані** Сергієм (Success). Bucket `service-examples` живий.
- **Слайс 3 e2e-верифіковано наживо:** форма → upload у приватний bucket → insert+рендер в інбоксі → автор/дата → **signed URL відкрив PDF у новому табі** ✅. Тестовий запис «йцу» прибрано (рядок DELETE у SQL Editor; файл — через Storage UI, бо `DELETE FROM storage.objects` блокує тригер `protect_delete` — див. memory `reference-supabase-storage`).
- **Тести: client 186/186 ✅** (+11). `tsc -b` clean, `npm run build` + `build:admin` зелені.

### Що зроблено
1. **Merge слайсу 2** (коментарі `service_notes`) в main, push, видалення гілки.
2. **Слайс 3** (гілка `feature/service-mirror-requests`, змержена):
   - `supabase/migrations/026_service_requests.sql` — таблиця + RLS (authenticated S/I/U, DELETE→service_role) + приватний bucket `service-examples` (10 МБ, PDF/DOC/DOCX) + 2 storage RLS-політики.
   - `src/lib/serviceRequestFile.ts` — чисті `validateExampleFile` + `buildExamplePath` (11 тестів).
   - `src/admin/pages/ServiceRequestsPage.tsx` — composer (назва/опис/закони/файл) + інбокс + signed URL (60s).
   - роут `/requests` + нав «📝 Заявки».
3. **Фікс білду:** `tsconfig.app.json` `"types": [..., "node"]` — `tsc -b` падав (exit 2) зі слайсу 1 (тест імпортує `node:*`); session 41 проскочила бо vitest/`vite build` не типчекають.

### 🔴 Наступний крок (нова сесія)
1. **service-mirror завершено й закрито** — нагальних завдань по ньому немає. Далі по north-star: збирати реальні заявки/фідбек юриста → з закономірностей проєктувати білдер (IMPROVEMENTS #84).
2. **UX-борг (дрібний, не блокує):** кнопка-дія «✓ Вирішено» в інбоксах заявок/коментарів читається як статус-бейдж — за бажанням ясніший підпис (торкнеться слайсу 2 теж).
3. **#67** — фікс divorce-шаблону (Variant B) з Ольгою (Tier-2, 263 parity-тести).
4. ⏰ Backlog Ольги (~2026-06-25): флип alimony-change, 2 зміни законів, CRON schedule, exception_if sign-off.

### Запуск середовища
- Адмінка: `cd apps/client && npm run dev:admin` → `http://localhost:5174` (логін Supabase з `.env.local`). Тести: `npx vitest run`. Білд: `npm run build` + `npm run build:admin`.
- **Storage:** видаляти файли з bucket лише через Dashboard/Storage API (не SQL — тригер `protect_delete`).

---

## 🆕 Session 41 (2026-06-20) — адмінка-дзеркало: розворот «білдер → огляд», service-mirror (#66)

### Головне — стан ЗАРАЗ
- **Слайс 1 ЗМЕРЖЕНО в main + запушено** (`ebc2389`) — Vercel задеплоїть адмінку сам. main чистий.
- **Слайс 2 (коментарі) — на гілці `feature/service-mirror-comments`** (`eed233c`), НЕ змержено: **чекає застосування migration 025** Сергієм (застосовував у кінці сесії — звірити Results). Після цього merge.
- **Тести: client 175/175 ✅** (+28 анатомія), tsc + обидва білди (TWA + admin) чисті.
- **Issue #66** відкрита (слайси 1-2 ✅ в коментарях, слайс 3 лишився). **Issue #67** заведено (divorce property_details, Variant B).
- **Адмінка-дев** піднімалась на `http://localhost:5174` (`npm run dev:admin`; помирає із закриттям сесії).

### Контекст/рішення (важливо для наступної сесії)
- **Розворот:** замість будувати/чинити білдер форм — спершу зробити адмінку **дзеркалом** (read-only огляд: форма як є + анатомія документа + health + закони). Юрист дивиться → дає фідбек (коментарі) → замовляє послугу з прикладом документа → ми бачимо закономірності → ЛИШЕ потім білдер. Деталі: `specs/features/service-mirror/`, DECISIONS («Адмінка-дзеркало»).
- **Ролі:** вирішили — 2 ролі (owner/lawyer), «developer» НЕ роль застосунку (розробник через код/Supabase/n8n). Тригер на ролі+RLS — окремий логін Ольги. Відкладено → IMPROVEMENTS #84.
- **Архітектура адмінки** (відповідь на питання Сергія): НЕ окремий пакет — живе в `apps/client`, але окрема **збірка/деплой** (entry `admin.html`→`src/admin/main.tsx`, `vite.config.admin.ts`, `npm run dev:admin` :5174, `dist-admin/`). Спільний `src/` з TWA. CLAUDE.md згадує майбутній `apps/admin/` — ще не винесено.

### Що зроблено
1. **Спека** `specs/features/service-mirror/{plan,requirements,validation}.md` (Tier-2).
2. **Слайс 1 (G1-G4, змержено):**
   - `apps/client/src/lib/serviceAnatomy.ts` — чисті функції: `analyzeTemplate` (lean tag-екстрактор, БЕЗ імпорту CJS render-document; порт regex цитат), `diffFormVsTemplate` (used/unused/unmatched з **вычисляемым слоем** `PROVIDED_CONTEXT`/`DERIVED_SOURCES` — дзеркало buildContext), `serviceHealth` 🟢/🟡/🔴, `describeShowIf`/`analyzeService`. **28 тестів** (паритет цитат проти golden + інваріант unmatched===[] на реальних шаблонах).
   - `ServiceViewPage.tsx` — read-only: header+health, анатомія, цитати (zakon.rada), форма як є. Роути: `services/:id`→view, `/edit`→редактор.
   - `DashboardPage` — health-badge на картці; цитати збагачено stale (`law_chunks.is_stale`) + changed (`law_change_log`).
3. **Слайс 2 (на гілці):** migration 025 `service_notes` + `ServiceNotes` панель + `NotesInboxPage` («💬 Коментарі» нав).

### 🔎 Знахідки дзеркала (само випало)
- **divorce** друкує `property_details`/`debt_details`, форма не питає → `________` у проді. **Issue #67** (рішення Сергія — Variant B: фікс шаблону, окремою гілкою з Ольгою).
- **`has_children` shadowing** у doc-engine (форма питає, движок пере-обчислює з children_details) → IMPROVEMENTS #84.

### 🔴 Наступний крок
1. **Сергій застосовує migration 025** (звірити Results; якщо FK на slug дав помилку — або `ALTER TABLE services ADD CONSTRAINT services_slug_key UNIQUE(slug)`, або прибрати FK) → потім **merge `feature/service-mirror-comments`** в main.
2. **Слайс 3** — заявка на послугу (`service_requests`) + завантаження прикладу документа (Supabase Storage). Окрема гілка.
3. (Сергій планує точкові правки вигляду адмінки за запитом.)
4. **#67** — фікс divorce-шаблону (Variant B) з Ольгою (Tier-2, зачіпає 263 parity-тести).
5. ⏰ Backlog Ольги (~2026-06-25): флип alimony-change, 2 зміни законів, CRON schedule, exception_if sign-off.

### Запуск середовища
- Адмінка: `cd apps/client && npm run dev:admin` → `http://localhost:5174` (логін Supabase з `.env.local`). TWA: `npm run dev` (:5173).
- Тести: `cd apps/client && npx vitest run`. Білд: `npx vite build` + `npx vite build --config vite.config.admin.ts`.

---

## 🆕 Session 40 (2026-06-20) — загартування форми й бота: валідація #81 + /stop #82 + дедуп webhook #83

### Головне — стан ЗАРАЗ
- **Усе змержено в main + запушено в origin** (`21cf4de`). main чистий.
- **Клієнт задеплоєний на Vercel** (`legal-twa-xi.vercel.app`, бандл `index-BrmC-de1.js` містить рядки валідації) — **Сергій підтвердив наживо**.
- **main-bot 44 → 47 нод**, active, задеплоєний + live-verified.
- **Тести:** root vitest 1056/1056 ✅ (+7 dedup) · client 147/147 ✅ (+39 валідатори).
- Фокус сесії = 3 пункти з backlog session 39 (фідбек друга-тестувальника). Усі ✅.

### Що зроблено
1. **#81 — валідація полів форми (TWA)** [DONE, live]: `apps/client/src/lib/validators.ts` (NEW) — email, телефон +380, ІПН (10 цифр + контрольна), **імена** (лише кирилиця/апостроф/дефіс — ловить `ыуйцу"`), **паспорт** (АА123456 / 9 цифр), **max-length** (text 200 / textarea 2000). Правило з `field.validation` або виводиться з id/типу (без міграції Supabase). Inline-помилка на blur + блокування сабміту + банер «Перевірте формат полів». Реалізовано у 2 заходи (базові 3 типи → потім імена/паспорт/довжина за фідбеком Сергія на live-формі). 39 unit-тестів.
2. **#82 — /stop** [DONE, live exec 148/151]: нова `Is Stop?` IF перехоплює `/stop` ДО Pre-filter (existing-user гілка) → `Stop Reply` (ввічливе «Гаразд 👌 я завжди тут» + кнопки). Не чіпає Pre-filter (щоб не конфліктувати з іншими патчерами). `/stop` у «/» меню. Патчер `scripts/sync-bot-stop-command.mjs`.
3. **#83 — дедуп webhook за update_id** [DONE, live exec 150]: нода `Dedup Update` (перша: `Telegram Trigger → Dedup Update → Normalize`) дропає повторний update_id через n8n global static data (TTL 5хв); дубль → `return []` → стоп. Pure-ядро `n8n/templates/dedup-update.js` (7 тестів), jsCode GENERATED з шаблону. Fail-open на відсутній update_id. Патчер `scripts/sync-webhook-dedup.mjs`.

### Як перевіряв
- **Форма:** 147 unit-тестів + curl продакшн-бандла (рядки валідації присутні) + Сергій бачить помилку на live-формі.
- **Бот:** прямий webhook POST у локальний n8n + executions API з тимчасовим тестовим identity (прибраний після). exec 148 `…→ Is Stop? → Stop Reply` (впав лише на синтетичному чаті → 2 очікувані admin-алерти «chat not found»), exec 150 дубль → стоп без side-effects, exec 151 новий id → обробляється. Connection-integrity guard (47 рефів валідні).

### 🔴 Наступний крок / backlog
1. **Olga backlog (~2026-06-25)** — launch-блокери: флип `alimony-change` → active, 2 зміни законів (СК/ЦПК), CRON `schedule:`, sign-off `exception_if`.
2. **#78 future** — escalation-лесенка off-topic (timeout→тиждень→3міс→бан, `pause_level`, migration 025) + hybrid-кеш.
3. **#79** AI-вартість в адмінці · **#80** opt-in «повідомити коли зʼявиться послуга» (GDPR) · **#77** PDF/DOCX export.
4. Стратегічне: **GraphRAG** (v2.1), кастомний домен (#76).

### Запуск середовища
- n8n live (Docker, up 46+ год) + ngrok (`rosy-caution-progeny.ngrok-free.dev`, помирає із закриттям сесії).
- Деплой бота: `node scripts/sync-bot-stop-command.mjs && node scripts/sync-webhook-dedup.mjs && node scripts/deploy-workflow.mjs main-bot` (+ `node scripts/set-bot-commands.mjs` для меню). **ПРАВИЛО:** після кожного деплою main-bot — реальний webhook-тест.
- Клієнт: деплоїться автоматично на Vercel при пуші в `origin/main`.

---

## 🆕 Session 39 (2026-06-19) — велика Telegram-сесія: UX polish + off-topic guard

### Головне — стан ЗАРАЗ
- **Усе змержено в main + запушено в origin.** main-bot **44 ноди**, form-submit 43 — обидва задеплоєні живо. Issue **#65 closed**.
- **БД ПОЧИЩЕНА** (profiles/identities/cases = 0) на прохання Сергія для тестів нового юзера. Нова таблиця **`bot_rate_limit`** (migration 024, застосована Сергієм).
- Тестували **двоє реальних людей** (друг + Станіслав uid 557550357) — кожен виявив реальні баги, усі полагоджені.

### Що зроблено (хронологічно, всі через ідемпотентні патчери + live deploy + webhook-тест)

**A. UX polish bundle #65** (`sync-bot-ux-polish.mjs` / `sync-form-submit-ux.mjs` / `sync-user-error-feedback.mjs`):
- `answerCallbackQuery` (тост, прибрав вічне крутіння годинника на тапі — реальний баг) + `sendChatAction: typing`. Live-баг: sendChatAction = resource `message`, не `chat`.
- Кнопки-послуги в Show Menu + Welcome.
- form-submit: прогрес-генерації **морфить в одну картку** (⏳→📝→✅ + inline [Відкрити]/[Нова послуга]); картка СБОЮ піднята до рівня успіху; № кейса лише на сбої (копіюваний `<code>`).
- **👀-реакція** на перше повідомлення нового юзера (`setMessageReaction`, raw HTTP, токен через `Global Config`-ноду; 🙏→👀 як нейтральне). 
- **Copy polish** (LAYER 5): 6 текстів переписані, прибрано старий `_is_new` 🙏-префікс; кнопки в Send Help; Service Unavailable — без апсейлу, лише «← До меню».
- `scripts/test-webhook.mjs` полагоджено (форжить підписаний `init_data` після #56). `scripts/set-bot-commands.mjs` — **slash-меню** `/start /menu /help`.

**B. Onboarding-фікси** (з тесту друга):
- **Двійне привітання нового юзера** — діагноз через `exec 105` (ОДНЕ виконання Welcome+Show Menu = onboarding-флоу, НЕ дубль Telegram). Фікс: `Greeting: is new?` IF — новий юзер на /start отримує лише Welcome.

**C. Off-topic guard #78** (`sync-offtopic-guard.mjs` + `scripts/eval/` + `docs/architecture/bot-offtopic-guard.md`):
- Класифікатор тепер віддає `topic` (clear/legal_unclear/off_topic). **Eval-набір** (`scripts/eval/bot-classification.cases.json` + `run-classification-eval.mjs`, оффлайн Groq): **93% / 100% на абьюзі**, 0 ложних штрафів.
- Лесенка (тільки off_topic; юридичне → reset): 1 м'яко / 2 попередження / 3 натяк / **4+ пауза ~15хв** (AI не зовемо). legal_unclear → тепле уточнення.
- **Стан у Supabase `bot_rate_limit`** (ключ = Telegram id): `Cooldown Read` → `Off-topic Guard` → `Update Rate Limit` (fan-out ЛИСТ) + `Guard Switch`. Рядок сідається при онбордингу (`Init Rate Limit`). Перейшли зі static-data на БД на прохання Сергія (видно в адмінці, #79).
- **2 баги полагоджені**: (1) `setConn('X', to(Y))` без обгортки `{main:}` → malformed connection → **500 на всі апдейти** (Global Config wiring); (2) **Станіслав: текст → тиша** — `Update Rate Limit` стояв МІЖ Off-topic Guard і Guard Switch → ламав item-pairing → Switch не матчив правило (DB-запис проходив, reply — ні). Фікс: Update Rate Limit як паралельний лист, Switch читає `$json`.

### 🔴 Наступний крок / відкладено (нові IMPROVEMENTS цієї сесії)
1. **#77** формати документа (PDF/DOCX export) + стилістика — коли візьмемось за збереження.
2. **#78 (future)** — **escalation-лесенка** (Сергій): timeout зараз → тиждень → 3 міс → бан (додати `pause_level`, migration 025). + **hybrid-кеш** (static-data + БД) як оптимізація. Деталі в спеці. **+ нюанс:** Pre-filter ловить off-topic КЛЮЧОВІ слова (погода/рецепт) ДО AI → вони НЕ рахуються в лічильник (абьюз — рахується).
3. **#79** видимість вартості AI в адмінці · **#80** opt-in «повідомити коли зʼявиться послуга» (GDPR) · **#81** валідація полів форм (email/телефон/ІПН) · **#82** /stop + команди · **#83** дедуп webhook за update_id.
4. **⏰ Backlog Ольги (~2026-06-25):** CRON `schedule:`, 2 зміни законів, `exception_if` sign-off, флип `alimony-change`.

### Запуск середовища
- n8n live (Docker) + **ngrok** (`rosy-caution-progeny.ngrok-free.dev → :5678`) — піднятий цю сесію у фоні (помре із закриттям сесії; для своїх тестів тримати в своєму терміналі). **Чекліст: Docker + ngrok + `getWebhookInfo`.**
- Деплой бота: `node scripts/sync-bot-ux-polish.mjs && node scripts/sync-offtopic-guard.mjs && node scripts/deploy-workflow.mjs main-bot` (порядок важливий: guard володіє `Skip AI?`).
- **ПРАВИЛО:** після кожного деплою main-bot — гнати реальне webhook-повідомлення (не лише API/DB-чек), бо обидва баги цієї сесії проскочили саме так. + валідувати connections.
- Live-тест генерації без форми: `node scripts/test-webhook.mjs 4`.

---

## 🆕 Session 38 (2026-06-18/19) — Telegram stage: надійність + чесність + cleanup

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — `b174803`. 4 PR змержено цю сесію (#60, #62, #63 + issue-hygiene), усі гілки видалені.
- **Обидва workflow живі:** `form-submit` (42 ноди — +error-feedback), `main-bot` (29 нод — honest catalog, без Wait).
- **1019 root vitest ✅ (+9)** · client без змін.
- **Фокус сесії = «довести до ума стадію Telegram».** Зроблено 4 одиниці.

### Що зроблено
1. **Stale-issue hygiene:** #5 (lawyer-on-signup) понижено 🔴critical→🔵strategic + коментар (немає self-service signup UI, revenue-share відкладено) — лишив відкритим. #33 (CRON) підтверджено як валідний Olga-трекер — **лишив відкритим**, 2 його пункти змірорено в Backlog Ольги нижче.
2. **#59 — клієнт дізнається про збій генерації** (PR #60, live-verified). `onError:continueErrorOutput` на 7 нодах генерації (Copy Template…Share Document) → `Format Gen Failure` → фан-аут у `Notify User Failed` (клієнт) + `Send Admin Alert`. Працює в ОСНОВНОму execution. Live-тест (штучний збій Copy Template): клієнт+адмін сповіщені, без подвійного алерта. Файли: `n8n/templates/format-gen-failure.js`(+9 тестів), `scripts/sync-user-error-feedback.mjs`.
3. **#61 — чесний каталог послуг** (PR #62, deployed). 4 тексти main-bot (Welcome/Show Menu/Send Help/Service Unavailable) більше не рекламують disabled-послуги: active=Розлучення+Аліменти, решта «🔜 Скоро», ТЦК «разом із юристом». `_is_new` префікси збережені. Патчер `scripts/sync-main-bot-honest-catalog.mjs`. **Рішення Сергія:** статика зараз; динаміка за `status` → пізніше як **admin-editable bot-copy** (IMPROVEMENTS #43, done partially).
4. **Cleanup §4.1+§4.7** (PR #63). Прибрано мертву ноду `Wait(1s)` (Telegram Trigger→Normalize напряму, 30→29). #4a (старі form-посилання) — перевірено, **вже покрито** read-path guard у `App.tsx:250-269` (TWA тягне свіжий config за slug + екран «недоступна» при status≠active); коду не треба, #4a закрито.

### 🔴 Наступний крок (нова сесія)
1. **Vercel:** кастомний домен — IMPROVEMENTS #76.
2. **⏰ Backlog Ольги (~2026-06-25, єдиний ревʼюер повертається) — нічого не торкались:**
   - **(#33) Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml`** — 2 рядки (`schedule:` / `- cron: '0 6 * * 1'`). Зараз закоментовано, бо щотижневий авто-флип нікому ревʼюити.
   - **(#33) Вирішити 2 РЕАЛЬНІ зміни законів** — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24`. Runbook `docs/runbooks/law-monitor-cron.md`.
   - **Sign-off `exception_if` edges** у `law_relations` (`verified_by` = email юриста).
   - **Прод-флип `alimony-change`** `status='disabled' → 'active'`.
3. **§4.5 (відкладено):** AI-диспетчер main-bot не знає про `alimony-change` — стане потрібно одразу ПІСЛЯ флипу alimony-change (зараз disabled, тож не блокує).

### Запуск середовища
- n8n live (Docker): `form-submit` 42 ноди active, `main-bot` 29 нод active.
- Деплой: `node scripts/sync-*.mjs && node scripts/deploy-workflow.mjs <form-submit|main-bot>`.
- Для live-тесту form-submit потрібен валідний підписаний `init_data` (#56) — форжиться bot-токеном за алгоритмом Telegram Mini App (див. `verify-init-data.js`).

---

## 🆕 Session 37 (2026-06-18) — initData HMAC-верифікація (#56) — задеплоєно живо, змержено в main

### Головне — стан ЗАРАЗ
- **PR #58 (`fix/initdata-hmac-verification` → main) змержено** (merge commit `a9f8a72`), гілка видалена. Реалізовано, задеплоєно живо в n8n, верифіковано живими тестами (двічі — основний фікс + hardening).
- **Issue #56 закрито** (auto-close через `Closes #56` при мерджі) — усі 3 пункти чекліста виконані.
- **Security review (commit-review + push-sweep) знайшов і виправлено CRITICAL/HIGH дірку того ж дня:** перша версія fail-open на відсутність `init_data` (фолбек на голий `uid`) була точно тим самим вектором атаки #56 без потреби підробляти підпис. Закрито: тепер відсутність `init_data` теж hard reject за замовчуванням; dev/web-fallback лишився тільки за явним server-side прапорцем `Global Config.ALLOW_UNVERIFIED_UID` (`'false'` за замовчуванням).
- **907 root vitest ✅ (+16) · 103 client vitest ✅ · tsc clean.**

### Що зроблено
1. `n8n/templates/verify-init-data.js` (NEW) — `verifyInitData()`: офіційний алгоритм Telegram **Mini App** (HMAC_SHA256 key="WebAppData" → secret_key → HMAC_SHA256(data_check_string) → hex hash), timing-safe compare, 24г anti-replay вікно на `auth_date`. Плюс `resolveSubmission(initData, userId, botToken, { allowUnverified })` — тестована функція, що приймає рішення accept/reject (винесена з generated entry-point коду саме через раунд 2 нижче). 16 unit-тестів разом.
2. `apps/client/src/App.tsx` — шле сирий підписаний `tg.initData` як `init_data` поряд з існуючим `user_id`.
3. `scripts/sync-init-data-verification.mjs` (NEW) — ідемпотентний патчер: `TELEGRAM_BOT_TOKEN` + `ALLOW_UNVERIFIED_UID` у Global Config, регенерує `Validate` (GENERATED-конвенція, тепер викликає `resolveSubmission()`), додає `uid_verified` у `Insert Case`.
4. `supabase/migrations/023_uid_verified.sql` — `cases.uid_verified` (NULL/true/false) + audit-індекс. **Застосована живо Сергієм** напряму в Supabase SQL editor.
5. `scripts/deploy-workflow.mjs` — KEY_MAP: `YOUR_TELEGRAM_BOT_TOKEN → TELEGRAM_BOT_TOKEN`.
6. **Живий баг #1, знайдений лише смоук-тестом:** `URLSearchParams` не глобальний у сендбоксі n8n Code-ноди (хоч `require('crypto')`/`Buffer` — доступні). Виправлено: ручний парсинг query-string.
7. **Раунд 2 (security scanner):** перша версія приймала запит без `init_data` взагалі (fail-open), що = той самий #56-бейпас без підробки підпису. Виправлено через `resolveSubmission()` + `ALLOW_UNVERIFIED_UID`-прапорець. Перевірено живо двічі (відомий test-профіль `identities.external_id=236581343`): valid→200+verified=true, tampered→400, **missing init_data→400 (раніше було 200 — це і є фікс)**. Підтверджено прямим SELECT `cases.uid_verified` з Supabase.
**Файли:** `n8n/templates/verify-init-data.js`, `__tests__/verify-init-data.test.js`, `scripts/sync-init-data-verification.mjs`, `scripts/deploy-workflow.mjs`, `supabase/migrations/023_uid_verified.sql`, `apps/client/src/App.tsx`, `n8n/workflows/current/form-submit.json` (задеплоєно), `TELEGRAM-BOT-GUIDE.md` §8, `DECISIONS.md`.

### 🔴 Наступний крок (нова сесія)
1. **Vercel:** кастомний домен — IMPROVEMENTS #76.
2. **⏰ Backlog Ольги (~2026-06-25, єдиний ревʼюер повертається) — нічого не торкались:**
   - **(#33) Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml`** — 2 рядки (`schedule:` / `- cron: '0 6 * * 1'`). Зараз закоментовано, бо щотижневий авто-флип нікому ревʼюити. До того: ручна кнопка (Actions → Law change monitor → Run) + локальний `node scripts/check-law-updates.mjs`.
   - **(#33) Вирішити 2 РЕАЛЬНІ зміни законів, знайдені dry-run** — СК `2026-03-04→2026-05-25`, ЦПК `2025-07-17→2026-04-24`: релевантні нашим шаблонам? флипати залежні послуги чи ні? Деталі: runbook `docs/runbooks/law-monitor-cron.md`.
   - **Sign-off `exception_if` edges** у `law_relations` (`verified_by` = email юриста).
   - **Прод-флип `alimony-change`** `status='disabled' → 'active'`.
   - (Issue **#33** лишається відкритою як GitHub-трекер перших двох пунктів; цей блок — дзеркало в session-summary + канонічна памʼять `project_cron_schedule_pending`.)

### Запуск середовища
- n8n live (Docker, 40 нод form-submit active) — деплоєно через `node scripts/sync-init-data-verification.mjs && node scripts/deploy-workflow.mjs form-submit`.

---

## 🆕 Session 36 (2026-06-18) — Telegram bot онбординг (#55 G3) — PR#57 змержено, issue #55 закрито

### Головне — стан ЗАРАЗ
- **PR#57 змержено в `main`** (`0123510`), гілка `feature/bot-onboarding-g3` видалена на GitHub після merge.
- **Issue #55 CLOSED** — усі 3 групи (G1+G2+G3) ✅, чекліст затиканий, коментар з деталями верифікації доданий.
- Продовження сесії 35: залишались 2 функціональні баги з аудиту (`TELEGRAM-BOT-GUIDE.md` §4.2/§4.3) — обидва виправлені цієй сесії.

### Що зроблено (session 36)
1. **`scripts/sync-main-bot-onboarding.mjs`** (NEW) — ідемпотентний патчер у стилі `sync-main-bot-fixes.mjs`:
   - §4.2 фікс: `Welcome New User` (був тупик) → нова нода `Mark New User` (тегує `_is_new: true`, ре-читає `Normalize` напряму) → `Pre-filter`.
   - §4.3 фікс: нова гілка `Is Callback?` (за `_type==='callback_query'`) між `User Exists?`(FALSE) і `Pre-filter` → `Route Callback` парсить `confirm_service_{id}`/`show_menu` → `Callback: Confirm Service?` фан-інить у вже існуючі `Get Service (high)`/`Show Menu` (нуль дублювання логіки).
   - Привітання-префікс за `_is_new` на 4 термінальних нодах (`Show Menu`/`Send Help`/`Ask Confirm`/`Send TWA Button`), кнопка `🔄 Інша послуга` на `Send TWA Button`.
   - **Самоперевірка знайшла й виправила баг до деплою:** префікс-інжектор подвоював текст при повторному запуску скрипта (немає чеку "вже є префікс?") — додано маркер-підрядок, підтверджено ідемпотентність (0 змін на 2-му прогоні).
2. **Задеплоєно** (`scripts/deploy-workflow.mjs main-bot`): 26→30 нод, усі 4 нові — без credentials (нуль ризику ребайндингу).
3. **Верифіковано live** через реальний n8n webhook (знадобилось дізнатись секрет-токен Telegram Trigger — формула `${workflowId}_${nodeId}`, знайдена в сорсі ноди всередині контейнера). 3 сценарії на реальному chat_id адміна:
   - текст від існуючого юзера → `Is Callback?`(FALSE)→`Pre-filter`→AI Agent→`Send TWA Button` (нова кнопка 🔄, без префіксу — `_is_new=false` коректно) — **підтверджено скріном з реального Telegram**;
   - `callback_query: show_menu` → `Route Callback`→`Callback: Confirm Service?`(FALSE)→`Show Menu`, AI Agent НЕ викликався;
   - `callback_query: confirm_service_1` → `Get Service (high)`→`Is Active?`→`Send TWA Button` (правильний сервіс).
   - Побічно: тест із фейковим chat_id підтвердив, що G1 Error Trigger досі коректно перехоплює "chat not found" і шле адмін-алерт. Тестові profile/identity рядки видалено з Supabase після перевірки.
4. Оновлено `docs/architecture/TELEGRAM-BOT-GUIDE.md` (§4.2/§4.3 позначені виправленими, §5 таблиця, §9 план).
5. Issue #55: усі 3 чекбокси затикано, доданий деталізований коментар з верифікацією.

### Ключові файли
- `scripts/sync-main-bot-onboarding.mjs` — **NEW** ідемпотентний патчер G3
- `n8n/workflows/current/main-bot.json` — +4 ноди, перепрокладені connections, оновлений Pre-filter, 4 префікси, нова кнопка (задеплоєно)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — §4.2/§4.3/§5/§9 оновлено

### 🔴 Наступний крок (нова сесія)
1. **#56** — серверна верифікація initData (#6) у form-submit.
2. **Vercel:** кастомний домен — IMPROVEMENTS #76.
3. **~2026-06-25 (Ольга):** CRON schedule, law changes, exception_if sign-off, flip alimony-change — не торкались.

### Запуск середовища
- n8n live (Docker, 30 нод main-bot active) + ngrok (`rosy-caution-progeny.ngrok-free.dev`).
- Для прямого тесту webhook без реального Telegram-клієнта: потрібен заголовок `X-Telegram-Bot-Api-Secret-Token: <workflowId>_<telegramTriggerNodeId>` (інакше n8n відповість `403 Provided secret is not valid`), і шлях `/webhook/<webhookId>/webhook` (НЕ просто `/webhook/<webhookId>` — підтверджено через `getWebhookInfo` Telegram Bot API).

---

## 🆕 Session 35 (2026-06-18) — Telegram bot: надійність + робоча web_app кнопка (#55 G1+G2)

### Головне — стан ЗАРАЗ
- **Гілка `feature/bot-reliability-onboarding`** змержена в `main` (G1+G2). **Issue #55 лишається ВІДКРИТОЮ** на G3 (онбординг). **Issue #56** заведено (initData security, #6) — ще не починали.
- **Основний CTA бота полагоджено й ЗАДЕПЛОЄНО live** — `main-bot` тепер 26 нод, active.
- Доба почалась як `/session-start` → обговорення GraphRAG/галюцинацій → перейшли на «довести до ума взаємодію в Telegram» → знайшли й полагодили реальний live-баг.

### Що зроблено (session 35)
1. **Аудит-док** `docs/architecture/TELEGRAM-BOT-GUIDE.md` — карта живого бота (знято з n8n API, не з файлу) + сценарії + знайдені баги. Issues #55 (bot reliability/onboarding/button) + #56 (initData #6) заведені. IMPROVEMENTS #75 (loading + чесний каталог), #76 (TWA URL — кастомний домен).
2. **Діагностика «тиші на Алименти»** через n8n executions API (exec 54): весь pipeline ОК → `Send TWA Button` падав з Telegram `400: Text buttons are unallowed`. Корінь — поле `webAppUrl` (старе імʼя n8n-ноди); n8n 2.20.6 чекає `web_app: { url }` (підтверджено в сорсі ноди в контейнері). + у `main-bot` НЕ БУЛО Error Trigger → збій німий.
3. **G2** — виправлено `webAppUrl`→`web_app.url`. Live-тест виявив ДРУГИЙ баг: форма відкривалась, але Vercel `404` — бот вів на `legal-twa.vercel.app`, а прод-деплой живе на **`legal-twa-xi.vercel.app`** (Vercel авто-суфікс). Перенаправлено (централізовано в `TWA_BASE_URL`). **Верифіковано live: послуга → web_app кнопка → форма відкривається в Telegram з новим доменом.**
4. **G1** — додано Error Trigger → Format Error → Send Admin Alert у `main-bot` (дзеркало form-submit).
5. **Drift killed** — репо `main-bot.json` звірено з live (були ідентичні крім cred-id; deploy перепривʼязує creds з live). `settings` мінімізовано під публічний PUT API.
6. Мігровано мертвий домен у `ServiceEditPage.tsx` + `ARCHITECTURE.md`/`DECISIONS.md`.

### Ключові файли
- `scripts/sync-main-bot-fixes.mjs` — **NEW** ідемпотентний патчер (G1+G2, `TWA_BASE_URL` константа)
- `n8n/workflows/current/main-bot.json` — звірено з live + G1+G2 (задеплоєно)
- `docs/architecture/TELEGRAM-BOT-GUIDE.md` — **NEW** карта/аудит бота

### 🔴 Наступний крок (нова сесія, Sonnet — Tier-1)
1. **#55 G3 — онбординг** (свіжа гілка від main): (а) фікс тупика `Welcome New User` — нового юзера пропускати в Pre-filter pipeline з `_is_new`; (б) обробка `callback_query` ДО Pre-filter (зараз Так/Ні з «Ask Confirm» летять у AI Agent як текст → не працюють); (в) кнопка 🔄 Інша послуга в Send TWA Button; (г) привітання-префікс за `_is_new`. План: `TELEGRAM-BOT-GUIDE.md §9`.
2. **#56** — серверна верифікація initData (#6) у form-submit. Після G3.
3. **Vercel:** прод-деплой форми живий на `legal-twa-xi.vercel.app` (старий `legal-twa` 404). Кастомний домен — IMPROVEMENTS #76.
4. **~2026-06-25 (Ольга):** CRON schedule, law changes, exception_if sign-off, flip alimony-change — не торкались.

### Запуск середовища
- n8n live (Docker, 26 нод main-bot active) + ngrok піднято цю сесію (`rosy-caution-progeny.ngrok-free.dev`). Google OAuth переавторизовано Сергієм (Copy Template у form-submit знову робочий).
- Деплой бота: `node scripts/sync-main-bot-fixes.mjs && node scripts/deploy-workflow.mjs main-bot`. Тест: написати боту «аліменти» (НОВЕ повідомлення — кнопки вшиті в старі повідомлення).

---

## 🆕 Session 34 (2026-06-18) — #18 mobile verification + #11 Retrieval Debt (is_stale flagging)

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — `6705b98` (PR#54 merged, fast-forward), branch `feature/retrieval-debt-is-stale` deleted.
- **Issues #18 і #11 ОБИДВА closed.**
- (Примітка: session 33's master-doc section was never written — only `changelog.md` got it, per that session's "low token budget" note. Not backfilled here; see changelog.md 2026-06-17 entries for session 33's actual work — DatePickerField #27 + admin toast #18 implementation.)

### Що зроблено

#### Issue #18 — admin toast, mobile verification (no code change)
- Session 33 shipped the toast (PR#53) but left #18 open pending the one remaining DoD box: mobile-overlap check, blocked on no admin test login.
- Minted a one-time Supabase magic-link (`generate_link`, service-role key, local script only) for the lawyer test account — no password reset/exposure. Loaded the real admin app at 375×667, intercepted `window.fetch` on the Supabase `PATCH /services` call (mocked 403 then 200) to trigger both error and success toasts live without writing to production.
- Confirmed: `Toast` (`fixed bottom-4 ... z-[60]`) renders centered, fully in-viewport, never overlaps — `AdminLayout`'s mobile layout has only a top bar, no bottom nav. Signed out, deleted all temp artifacts.
- **Issue #18 closed.**

#### Issue #11 — Retrieval Debt (`is_outdated` flag)
- Investigation found 3 of 4 Definition-of-Done items already existed under a different name: `is_stale BOOLEAN` on `law_chunks`/`law_documents` (migration 002/003), already filtered in every read RPC, Telegram alert already shipped (session 19). Real gap: nothing ever set the flag `true`.
- `scripts/law-registry.mjs` — new `lawCode(law)` (canonical URL → rada doc-id, e.g. `2947-14`).
- `scripts/lib/law-change.mjs` — the single canonical `applyLawChange()` (shared by CRON + manual CLI) now also PATCHes `law_chunks`/`law_documents` to `is_stale=true` by `law_code`, independent of service dependents.
- `scripts/service-lifecycle.mjs`, `scripts/check-law-updates.mjs` — one console line each reporting the flip.
- Verified live (read-only): dry-run against real Supabase resolved divorce+alimony as dependents; a real PATCH against a non-existent `law_code` proved schema/permissions without touching real rows.
- Full test suite green; PR#54 opened and merged (fast-forward).
- **Issue #11 closed**, automated re-indexing (scrape+re-embed) explicitly deferred — manual `seed-divorce-laws.ts --force` already clears the flag as a side effect.

#### Misc
- Replaced the `[console]::Beep` notification/stop sound hooks (fixed volume, no amplitude control) with a WAV-tone generator (`C:\Users\serge\.claude\scripts\play-tone.ps1` + `notify-sound.ps1`/`stop-sound.ps1`) played via `System.Media.SoundPlayer`, same frequencies/durations, volume scaled to 75% (~25% quieter). Not part of this repo — lives in the global `~/.claude` config.

### 🔴 Наступний крок
1. (нема нагальних завдань — обидва issue цієї сесії закриті, змержено)
2. **~2026-06-25 (Ольга):** CRON schedule, law changes review (тепер включно з RAG-стале маркуванням), sign-off `exception_if`, flip alimony-change — нічого з цього списку не торкались.

---

## 🆕 Session 32 (2026-06-17) — divorce-with-children G1-G3 (#28): графік побачень ст.157 СК, live deploy

### Головне — стан ЗАРАЗ
- **PR#50 змерджено в main** (`58ef2d2`), гілку `docs/divorce-with-children-spec` видалено на GitHub після merge. **Issue #28 автоматично закрито** (`Closes #28`).
- **Roadmap v2.3 «Розлучення з дітьми» → ✅** (звужений скоуп після планування — деталі нижче).
- **Скоуп звужено під час планування:** оригінальний issue #28 (bulk-import, session 11) називав 3 залежності (#19 GraphRAG, #17 hybrid-шаблони, стабільна alimony) — усі вже закриті інфраструктурою alimony-change (sessions 20-29). «Опіка» в укр. праві для живих батьків = не окремий інститут, а право участі у вихованні (ст.157 СК). Реальна дельта: опція `children_live_with='court'` + графік побачень — обидва чисто детерміновані (підтверджено з Сергієм: без hybrid/AI-обґрунтування).
- **981 root vitest ✅ (було 972, +9) · 92 client vitest ✅ · tsc clean.** Існуючі 263 parity-тести divorce — без жодної зміни.
- **Live перевірено:** шаблон + form_config залиті в Supabase; smoke-тест через реальний n8n execution (`test-webhook.mjs 5`) — `Build Document` відрендерив новий абзац+пункт коректно, `_checklist_result.ok===true`.

### Що зроблено
- Tier-2 спека `specs/features/divorce-with-children/{plan,requirements,validation}.md` (за зразком alimony-change, але вужча — без hybrid).
- `divorceFormConfig.ts` — `children_live_with`+`court`; нові `visitation_dispute`/`visitation_schedule_text`.
- `divorce.document.txt` — гілка `court`, абзац участі у вихованні, новий пункт «ПРОШУ».
- **Найризикованіша частина:** новий пункт нумерації вставлено ОСТАННІМ (а не одразу після місця проживання, де логічно належить) — щоб НЕ переписувати 3 вже протестовані combinatorial if-ланцюжки (residence/alimony/property/debt). Формула для нового пункту (рахує всі 4 існуючі) верифікована програмно на 16 булевих комбінаціях перед вставкою в шаблон. Деталі — DECISIONS.md.
- **2 реальні баги знайдено й виправлено:**
  1. `children_live_with='court'` лишав «...з ________.» — нісенітниця (суд не може визначити «з ________»). Виправлено: для `court` пункт 5 закінчується без «з ...».
  2. `scripts/update-form-configs.ts` — биті import-шляхи з епохи до монорепо-рефакторингу + залежність на `@supabase/supabase-js`, недоступну з кореня репо. Переписано на спільний `lib/supabase-rest.mjs`, перейменовано → `.mjs`.
- Citation-coverage guard (session 22) автоматично відловив нову цитату ст.157 СК — заголовок статті перевірено через веб-пошук (3 незалежних джерела), migration 022 застосована живо.
- Live: `upload-document-template.mjs divorce` + `update-form-configs.mjs` + новий smoke-сценарій `test-webhook.mjs 5`.

### 🔴 Наступний крок
1. (нема нагальних завдань — divorce-with-children #28 повністю завершено: змерджено, задеплоєно живо, issue закрито)
2. **Непов'язана знахідка:** `Copy Template` падає на Google OAuth (`invalid/expired/revoked`) — той самий клас інциденту, що в session 15 (Testing-режим консенту протухає за 7 днів). Потребує переавторизації (через ngrok-origin) — за Сергієм, не блокує цю фічу.
3. **~2026-06-25 (Ольга):** CRON schedule, law changes review, sign-off exception_if, flip alimony-change — нічого з цього списку не торкались.

---

## Session 31 (2026-06-17) — live deploy: checklist-validator + hybrid hardening, 2 production bugs found+fixed

### Головне — стан ЗАРАЗ
- **Виконано автономно** — Sergey відійшов і дав явний дозвіл діяти без підтвердження кожної команди, з погодженими наперед стоп-умовами (регрес тестів / live-only конфлікт нод / провал smoke-test) та виключеннями (alimony-change флип, CRON schedule, пункти Ольги ~2026-06-25 — не торкались)
- **main:** змерджено `fix/checklist-deploy-and-abstention-filter` (ця сесія) — branch видалено після merge
- **Live n8n деплой завершено** — form-submit: 37→40 нод одним прогоном `deploy-workflow.mjs`. Виявилось, що PR#45 (сесія 29, hybrid hardening) НІКОЛИ не був задеплоєний живо, хоч і був злитий в main кілька сесій тому — цю сесію задеплоєно разом з checklist-хуком сесії 30
- **Чекліст-валідатор живий** — `services.required_checklist` завантажено: divorce (5 пунктів), alimony (4 пункти)
- **2 production-баги знайдено й виправлено під час деплою:**
  1. `scripts/upload-document-checklist.mjs` хибно репортував "differs after upload" — причина: Postgres `jsonb` переупорядковує ключі об'єкта при зберіганні (за довжиною ключа, потім лексикографічно), а скрипт порівнював `JSON.stringify` напряму. Виправлено канонізацією (рекурсивне сортування ключів) перед порівнянням
  2. Нода **Update Case Abstention** (додана сесія 29, але вперше виконалась живо тільки тут) валилась на КОЖНОМУ кейсі: `"At least one select condition must be defined"`. Причина: застарілий формат параметра Supabase-ноди (`id: <expr>` напряму) — поточна версія ноди мовчки відкидає це поле. Виправлено на `filters.conditions` (як вже працює в "Get Profile"), і в живому workflow, і в генерувальному скрипті `sync-abstention-node.mjs`
- **Smoke test зелений:** execution #50 — `_checklist_result.ok===true`, `cases.checklist_failed=false`, `cases.abstained=null`, усе записано без помилок
- **972 root / 92 client тестів без регресій** (код застосунку не змінювався — лише workflow JSON, 2 скрипти, доки)
- `specs/features/checklist-validator/validation.md` — усі G1–G4 пункти закриті; `specs/roadmap.md` — checklist-validator: 🔴→🟢

### 🔴 Наступний крок
1. (нема нагальних завдань — production-цикл checklist-validator повністю завершено)
2. **~2026-06-25 (Ольга):** CRON schedule, law changes review, sign-off exception_if, flip alimony-change — нічого з цього списку не торкались

---

## 🆕 Session 30 (2026-06-17) — merge PR#45 + stale-issue cleanup + checklist-validator (#4/#39)

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — `c1b2dc9` (PR#48 merged, checklist-validator)
- **PR#45 merged** (`97598fe`) — session 29's hybrid integration test + L4b wiring + abstention monitoring
- **Stale issues closed:** #7, #14, #25 (PR#47) + **#4 closed via PR#48** (`Closes #4`)
- **972 root vitest ✅** (was 957, +15) · **92 client vitest ✅** · tsc clean
- **Checklist validator live in repo** — deterministic regex-presence check for legally-mandatory clauses (divorce 5 items, alimony 4 items), reuses render-document.js's `{{#if}}` condition parser, hooked into existing Build Document footer + existing abstention Supabase node. Full design: `specs/features/checklist-validator/`
- **Infra unblocked** — Sergey applied migrations 020 + 021, started Docker, authenticated n8n. Live deploy was deliberately deferred to next session (not done this session).

### 🔴 Наступний крок (first thing next session)
1. `node scripts/deploy-workflow.mjs form-submit` — push regenerated Build Document node (checklist hook + `checklist_failed` field) to live n8n
2. `node scripts/upload-document-checklist.mjs divorce` + `... alimony` — populate `services.required_checklist`
3. Smoke test: one divorce case with `has_children=true` → confirm `_checklist_result.ok === true` in n8n execution log
4. Tick remaining box in `specs/features/checklist-validator/validation.md` (G3 live-deploy items)
5. **~2026-06-25 (Ольга):** CRON schedule, law changes review, sign-off exception_if, flip alimony-change

---

## 🆕 Session 29 (2026-06-17) — #74 integration test + #69 L4b wiring + #73 abstention monitoring

### Головне — стан ЗАРАЗ
- **Гілка `feature/hybrid-integration-test`** — 3 коміти попереду main, PR#45 відкрито й оновлено
- **957 vitest тестів ✅** (було 928, +29: 8 integration + 21 prepare-l4b)
- **40 нодів у workflow** (було 37: +Prepare L4b, +L4b LLM Critic, +Update Case Abstention)
- **GitHub Issues #2, #6 закрито** (стейл); **Issue #46 CLOSED** (IMPROVEMENTS #73 done)
- **PR#45** оновлено: includes #74 + #69 + #73

### Що зроблено

#### IMPROVEMENTS #74 — e2e integration test (6e4c6f0)
- `n8n/templates/__tests__/hybrid-pipeline-integration.test.js` — **NEW** — 8 тестів: fixture L3 → buildHybridContext (real checkGroundedness) → renderDocumentWithStyles, без реального Groq

#### IMPROVEMENTS #69 — L4b LLM Critic wired (b39d13e)
- `n8n/templates/prepare-l4b.js` — **NEW** — `prepareL4b()`: L3 reasoning → Groq request body
- `n8n/templates/build-hybrid-context.js` — `parseL4bResponse()` + 5th param; L4b RED → abstain; AMBER → review_card
- `n8n/templates/__tests__/prepare-l4b.test.js` — **NEW** — 21 тест
- `scripts/sync-l4b-nodes.mjs` — **NEW** — ідемпотентний патчер: Prepare L4b + L4b LLM Critic + updated L4 Critics entry

#### IMPROVEMENTS #73 — Abstention rate monitoring (81ffcd0)
- `supabase/migrations/020_abstention_tracking.sql` — `cases.abstained BOOLEAN DEFAULT NULL` + index
- `scripts/sync-build-document-node.mjs` — FOOTER: `abstained` у return value (null/true/false)
- `scripts/sync-abstention-node.mjs` — **NEW** — `Update Case Abstention` Supabase PATCH нода
- `apps/client/src/admin/pages/DashboardPage.tsx` — «Abstention rate: X%» badge (amber при >20%)

### 🔴 Наступний крок
1. **Злити PR#45** → main (diff перевірено, 957 тестів зелені)
2. **Після злиття:** `supabase db push` (migration 020) + deploy workflow (коли n8n запущений)
3. **~2026-06-25 (Ольга):** CRON schedule, law changes, sign-off exception_if, flip alimony-change

---

## 🆕 Session 28 (2026-06-17) — harness-visual + process hygiene (stale issues)

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — `2e6c7db` pushed
- **Ольги ще немає** (~2026-06-25) — blocked: CRON schedule, alimony-change flip, law changes review
- **928 vitest тестів ✅** (без змін)
- **GitHub Issues:** #17 і #9 закрито (стейл, вирішено інакше в s20/s26)

### Що зроблено
- `apps/client/.claude/harness-visual.md` — **NEW** локальний файл-візуалізація: bird's eye стека, n8n flow (ключові кроки), AI harness L0–L5 з ABSTAIN path, таблиця послуг, law lifecycle, задачі з залежностями, карта файлів, тести + пробіли. Не комітити.
- `docs/architecture/IMPROVEMENTS.md` — **#73** (моніторинг частоти abstention) + **#74** (e2e integration тест hybrid pipeline)
- `.claude/commands/session-start.md` — новий крок 4: `gh issue list --state open`, флаг стейл-issue (>30д або вирішено інакше), вивід у брифінгу як `⚠️ stale?`
- `CLAUDE.md` — 2 нових правила в Issue tracking: **stale issue rule** (закривати при вирішенні будь-яким способом) + **IMPROVEMENTS ≠ GitHub Issues** (не bulk-import)

### 🔴 Наступний фокус (~2026-06-25, Ольга)
1. Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки)
2. Вирішити 2 зміни законів: СК `2026-05-25`, ЦПК `2026-04-24`
3. Sign-off `exception_if` edges у `law_relations` (`verified_by` = email юриста)
4. Прод-флип `alimony-change` `disabled → active`
5. Перевірити якість форматування документів у Google Docs (після typography)

### Без Ольги (наступні кандидати — розробка, не запуск)
- **#74** E2e integration тест hybrid pipeline — перед flip alimony-change
- **#69** L4b LLM critic — підключити ноду в n8n (prompt готовий)
- **#73** Abstention rate monitoring — після flip + перших кейсів

---

## 🆕 Session 27 (2026-06-16) — typography phase 2: {{!style:}} → Google Docs styling (#50)

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — PR#43 merged, задеплоєно у live n8n
- **Issue #42 CLOSED** ✅ — typography phase 2 повністю реалізована
- **928 vitest тестів ✅** (+25: 9 renderDocumentWithStyles + 16 buildTypographyRequests)
- **Документи тепер форматовані** — «ПОЗОВНА ЗАЯВА» по центру жирним, keep-with-next/keep-together активні
- **IMPROVEMENTS #72** — архітектурна нотатка multi-template (кілька шаблонів на послугу)
- **Ольги ще немає** (~2026-06-25) — blocked: CRON schedule, alimony-change flip, law changes review

### Що зроблено
- `render-document.js` — `classifyTag` розрізняє `'style'` від `'comment'`; `renderNodesInto()` shared builder; `renderDocumentWithStyles()` → `{text, styleHints: {paraIdx: keywords[]}}`
- `apply-typography.js` — NEW — `buildTypographyRequests(styleHints, docBody)` → Google Docs batchUpdate requests (center, right, bold, keep-with-next, keep-together, page-break-before, indent)
- `sync-typography-nodes.mjs` — NEW — ідемпотентний патчер: додає Get Document + Build Typography Request + Apply Typography між Replace Placeholder і Share Document
- `sync-build-document-node.mjs` — template/hybrid paths → `renderDocumentWithStyles`, повертає `_style_hints`; legacy JS path → `{}` (no-op)
- `docs/architecture/IMPROVEMENTS.md` — #72 (multi-template architecture note)

### Live-верифікація (divorce scenario-2)
- 4 styled paragraphs у `_style_hints` → 6 batchUpdate requests → Google Docs API ✅
- Workflow: 37 нодів (було 34), ланцюжок Get Document → Build Typography Request → Apply Typography ✅

### 🔴 Перед VPS (записано в IMPROVEMENTS #71)
- Додати `GROQ_API_KEY=gsk_...` в `.env.local` і VPS env — для майбутнього Code node fallback

### 🔴 Наступний фокус (~2026-06-25, Ольга)
1. Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки)
2. Вирішити 2 зміни законів: СК `2026-05-25`, ЦПК `2026-04-24`
3. Sign-off `exception_if` edges у `law_relations` (`verified_by` = email юриста)
4. Прод-флип `alimony-change` `disabled → active`
5. Перевірити якість форматування документів у Google Docs (після typography)

### Без Ольги (доступно)
- VPS-деплой (Hetzner) — прибрати ngrok-залежність
- Issue #40 G2 (Code node fallback) — після перших реальних запитів
- #51 Admin-UI редактор шаблону (залежить від ролей)

---

## 🆕 Session 26 (2026-06-16) — model-agnostic harness: GROQ_MODEL у Global Config (#40)

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — PR#41 merged, задеплоєно у live n8n
- **Issue #40 G1 DONE** ✅ — GROQ_MODEL вийшов з hardcode у Global Config
- **903 vitest тестів ✅** (+1 тест для modelName параметра)
- **form-submit задеплоєно** — Global Config оновлено: GROQ_MODEL + GROQ_MODEL_FALLBACK + GROQ_API_KEY placeholder
- **Ольги ще немає** (~2026-06-25) — blocked: CRON schedule, alimony-change flip, law changes review

### Що зроблено
- `prepare-reasoning.js` — `modelName` опційний параметр (default залишається як fallback)
- `sync-hybrid-nodes.mjs` — entry point читає `GROQ_MODEL` з Global Config
- `form-submit.json` — Global Config: `GROQ_MODEL`, `GROQ_MODEL_FALLBACK`, `GROQ_API_KEY`
- `deploy-workflow.mjs` — KEY_MAP: `YOUR_GROQ_API_KEY → GROQ_API_KEY`
- `DECISIONS.md` — нова секція «Model-agnostic AI harness»
- `IMPROVEMENTS.md` — #71 оновлено: G1 ✅, перед VPS нотатка

### 🔴 Перед VPS (записано в IMPROVEMENTS #71)
- Додати `GROQ_API_KEY=gsk_...` в `.env.local` і VPS env — для майбутнього Code node fallback

### 🔴 Наступний фокус (~2026-06-25, Ольга)
1. Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки)
2. Вирішити 2 зміни законів: СК `2026-05-25`, ЦПК `2026-04-24`
3. Sign-off `exception_if` edges у `law_relations` (`verified_by` = email юриста)
4. Прод-флип `alimony-change` `disabled → active`
5. Додати `GROQ_API_KEY` в `.env.local` + VPS env (перед деплоєм)

### Без Ольги (доступно)
- #50 Фаза 2 типографіки ({{!style:}} директиви → styled Google Docs batchUpdate)
- VPS-деплой (Hetzner) — прибрати ngrok-залежність
- Issue #40 G2 (Code node fallback) — після перших реальних запитів

---

## 🆕 Session 25 (2026-06-16) — alimony-change G1–G5 DONE + IMPROVEMENTS #71, main чистий

### Головне — стан ЗАРАЗ
- **main чистий** ✅ — PR#38 (alimony-change G1–G5) + PR#39 (IMPROVEMENTS #71) змержені
- **Issue #37 CLOSED** ✅ — всі чекбокси G1–G5 відтикані
- **902 vitest тестів ✅** (60 нових G4: 20 prepare-reasoning + 40 build-hybrid-context)
- **form-submit.json задеплоєний** — 6 нових нодів, smoke-тест ✅ (divorce + alimony в Telegram)
- **Міграції 016–019 застосовані** в Supabase ✅
- **alimony-change `status='disabled'`** — послуга готова, флип після Ольги (~2026-06-25)
- **IMPROVEMENTS.md #71** — Model-Agnostic Ecosystem (LiteLLM/fallback chain / model в конфізі / Ollama), пріоритет 🟠

### Що зроблено в сесії 25

#### G4 (hybrid pipeline)
- **`n8n/templates/prepare-reasoning.js`** — `prepareReasoning(answers, l2Rows, promptTemplate)`: L2 rows → `buildArticleId()`, `formatNormEntry()`, fills prompt → `{ _groq_body, _l2_article_ids, _l2_norms_text, _answers_snapshot }`; fallback при порожніх L2
- **`n8n/templates/build-hybrid-context.js`** — `parseL3Response`, `buildCourtFeeSummary` (§3.4, PM=3328), `buildQuestionsForLawyer` (4 triggers), `buildHybridContext` (L4c abstention + review-card)
- **`supabase/migrations/019_generation_mode_hybrid.sql`** — widened CHECK + UPDATE alimony-change→'hybrid'
- **`scripts/sync-hybrid-nodes.mjs`** — ідемпотентний патчер: 6 нових нодів + зсув 8 downstream +1200px
- **`scripts/sync-build-document-node.mjs`** — гілка `hybrid` у dispatch
- **`n8n/workflows/current/form-submit.json`** — Is Hybrid? → {L2→Prepare→L3→L4 | Skip} → Build Document

#### G5 (docs) + extras
- `docs/architecture/DECISIONS.md` — розділ «Hybrid pipeline (G4)»: no Merge node / injectable checkGroundedness / court fee §3.4 / idempotent sync
- `docs/architecture/IMPROVEMENTS.md` — #69 (L4b wiring) + #70 (Google Docs spans) + #71 (Model-Agnostic)
- `.claude/settings.json` — `Edit/Write` для session-summary + changelog (без підтвердження)

### 🔴 Наступний фокус (~2026-06-25, Ольга)
1. Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки)
2. Вирішити 2 зміни законів: СК `2026-05-25`, ЦПК `2026-04-24` → relevant до наших статей?
3. Sign-off `exception_if` edges у `law_relations` (`verified_by` = email юриста)
4. Прод-флип `alimony-change` `disabled → active`
5. 🟠 LiteLLM/fallback wiring (IMPROVEMENTS #71) — до флипу

### Що зроблено в G4
- **`n8n/templates/prepare-reasoning.js`** — `prepareReasoning(answers, l2Rows, promptTemplate)`: 
  - L2 rows → `buildArticleId()` (law_code `2947-14` → `ст.N СК`), `formatNormEntry()`
  - fills prompt template `{{DIRECTION/CHANGED_FACTS_JSON/L2_NORMS/L2_ARTICLE_IDS/...}}`
  - returns `{ _groq_body, _l2_article_ids, _l2_norms_text, _answers_snapshot }`
  - fallback: якщо l2Rows пусті → stub `ст.192 СК + ст.182 СК`
- **`n8n/templates/build-hybrid-context.js`** — L4 Critics + review-card:
  - `parseL3Response(l3Response)` — strip ```json fences, parse, validate `reasoning_text`
  - `buildCourtFeeSummary(answers)` — §3.4: increase→exempt(п.3 ч.1 ст.5 ЗСЗ); decrease+fixed→max(price×0.01, 0.4×3328); percent→manual
  - `buildQuestionsForLawyer(answers, groundedness, abstained)` — 4 тригери: agreement_procedure, existing_debt, reasoning_abstained, amber_spans
  - `buildHybridContext(l3Response, l2ArticleIds, answers, checkGroundednessImpl)` — L4c: parseError||has_red → abstain, `_ai_reasoning=''`; builds review-card
- **`supabase/migrations/019_generation_mode_hybrid.sql`** — widened CHECK + UPDATE alimony-change→'hybrid'
- **`scripts/sync-hybrid-nodes.mjs`** — патчить form-submit.json: 6 нових нодів + зсув 8 downstream +1200px + з'єднання (ідемпотентний)
- **`scripts/sync-build-document-node.mjs`** — MODIFIED: додана гілка `hybrid` у dispatch (читає `$json._ai_reasoning` → `ai.reasoning`; `_review_card` у return)
- **`n8n/workflows/current/form-submit.json`** — 6 нових нодів: Is Hybrid? [1120,1580] → {L2 Get Norms [1360,1820]→…→L4 Critics [2080,1820], Skip Hybrid [1120,1340]} → Build Document [2320,1580]

### G4 верифікований ✅ (2026-06-16)
- `node scripts/deploy-workflow.mjs form-submit` — задеплоїлось, +6 нодів, credentials збережені
- `supabase db push` (міграція 019) — вже застосована раніше
- Smoke-тест: divorce + alimony документи прилетіли в Telegram ✅
- GitHub issue #37: G4 прокоментований (a945b10)

### Що зроблено в G5 (session 25 cont.)
- `docs/architecture/DECISIONS.md` — новий розділ «Hybrid pipeline (G4)»: no Merge node, injectable checkGroundedness, court fee §3.4 (PM=3328), idempotent sync-hybrid-nodes
- `docs/architecture/IMPROVEMENTS.md` — #69 (L4b LLM critic wiring) + #70 (Google Docs batch-comments on RED/AMBER spans) в індекс і тіло
- GitHub issue #37: G3+G4+G5 відтикані, фінальний коментар, `gh issue close 37`

### 🔴 Наступний фокус — merge + ⏰ Оля (~2026-06-25)
1. **Merge `feature/alimony-change-g3` → `main`** — зробити PR або fast-forward після review
2. ⏰ **~2026-06-25 (Оля):**
   - Розкоментувати `schedule:` у `.github/workflows/law-monitor.yml` (2 рядки)
   - Вирішити 2 зміни законів: СК `2026-05-25`, ЦПК `2026-04-24` → relevant до наших статей?
   - Sign-off `exception_if` edges у `law_relations` (`verified_by` = юрист)
   - Прод-флип `alimony-change` `disabled → active`

---

## Session 24 (cont.2, 2026-06-16) — alimony-change G1+G2+G3: повна реалізація (#37)

### Головне — стан ЗАРАЗ (на кінець session 24)
- **G1 DONE** — `9a2cfab` на `feature/alimony-change-g1`
- **G2 DONE** — `8de4e4f` на `feature/alimony-change-g2` (поверх g1)
- **G3 DONE** — `0ee2d9b`+`ca776a9` на `feature/alimony-change-g3` (поверх g2)
- **Issue #37:** G1 ✅ G2 ✅ відтикані, G3–G5 відкриті
- **Міграції 017 + 018 застосовані в Supabase** ✅ (017 — SQL-баг виправлено після скриншоту; 018 — RLS додав сам Сергій, скаптуровано в файл)
- **707 n8n тестів ✅, 92 vitest ✅** (включаючи 16 нових groundedness-тестів)
- **Гілки НЕ змержені в main** — мерж після G4+G5

### Що зроблено в G2
- `supabase/migrations/017_law_relations.sql` — таблиця `law_relations` + 2 RPC:
  - `upsert_law_chunk` (non-destructive, merges service_slugs, SET search_path, REVOKE PUBLIC)
  - `upsert_law_relation` (upsert by natural key, SET search_path, REVOKE PUBLIC)
- `supabase/migrations/018_law_relations_rls.sql` — RLS (public read, no write policy)
- `scripts/seed-alimony-change-laws.mjs` — seeds 16 статей (СК 141/150/180/182/183/184/191/192, ЦПК 27/28/174/175/176/177, ЗСЗ 4/5) + 8 edges:
  - `192→182 (requires)`, `192→183 (clarifies)`, `192→184 (clarifies)`
  - `192→ст.4 ЗСЗ (exception_if: decrease)`, `192→ст.5 ЗСЗ (exception_if: increase)`
  - `192→ст.176 ЦПК (requires)`, `192→ст.28 ЦПК (exception_if: increase)`, `192→ст.27 ЦПК (exception_if: decrease)`
- Embeddings=null (заповнюються пізніше через `seed-divorce-laws.ts --force`)
- **verified_by='auto' на exception_if edges** — Оля має поставити email ~2026-06-25

### Що зроблено в G3
- `n8n/prompts/alimony-change-reasoning.txt` — Groq JSON-mode prompt: cite only L2_ARTICLE_IDS, no invented numbers/dates/names, 100–200 words Ukrainian official prose
- `n8n/templates/groundedness.js` — L4a critic (no LLM): citations ∈ L2, amounts/fractions/dates/case_numbers/names ∈ L0 → RED/AMBER spans; `has_red` → abstention trigger
- `n8n/prompts/alimony-change-critic.txt` — L4b critic (LLM, independent pass): per-sentence GREEN/AMBER/RED; RED for guaranteed-result claims ("суд зобов'язаний")
- `n8n/templates/__tests__/groundedness.test.js` — 16 тестів (ESM vitest, CJS-loader pattern)

### Що зроблено в G1 (попередня підсесія)
- `n8n/templates/route-alimony-change.js` — L0.5 `route()` + тести
- `n8n/templates/services/alimony-change.document.txt` — 147-рядковий DSL-шаблон
- `apps/client/src/data/alimonyChangeFormConfig.ts` — FormConfig 4 таби, ~38 полів
- `test-data/alimony-change/` — 3 golden-сценарії
- `n8n/templates/__tests__/alimony-change-template-parity.test.js` — 132 тести
- `render-document.js` — REGISTRY (ПМ-2026: 3328/2817/3512)
- `supabase/migrations/016_alimony_change_service.sql` — реєстрація (disabled)

### 🔴 Наступний фокус — G4 (НОВА сесія, Sonnet)
1. **#37, G4 — handoff + n8n dispatch:**
   - `hybrid` mode в Build Document: L1 шаблон + вставлена (або abstained) L3-секція
   - Граф-запит law_relations → L2 норми → reasoning prompt
   - review-card JSON (route, direction, court_fee, norms_used, reasoning_section.spans, questions_for_lawyer, abstention)
   - 🟡 коменти в Google Docs (`batchUpdate`) на RED/AMBER spans
   - e2e деплой form-submit; послуга лишається `disabled`
2. G5 — Docs (після G4): DECISIONS.md, IMPROVEMENTS.md, changelog, closes #37
3. ⏰ **~2026-06-25 (Оля):** law-monitor CRON (#33) + 2 зміни СК/ЦПК + ярус-3 sign-off (verified_by=юрист на exception_if edges) + прод-флип `disabled→active`

### Де запускати тести n8n
```bash
# n8n template tests (з папки __tests__, бінарник з apps/client):
"C:/Users/serge/Legal-AI/apps/client/node_modules/.bin/vitest" run
# client vitest:
cd apps/client && npx vitest run
```

---

## Session 23 (2026-06-14/15) — Tier-каталог услуг (ТЗ) + критич. обзор legaltech + консолидация в один main

### Головне — стан ЗАРАЗ
- **main = єдина гілка.** Усі 4 `claude/*` гілки зведені в main і видалені (Сергієм — git-прокси оточення блокує ref-delete 403). Коміти сесії: `35e9381`, `d54aa88`, `a3ccbf9` (+ журнал). Комітили **прямо в main** свідомо: мета = один main + housekeeping; гілку не створювали, бо видалити її не можу (403). Надалі — branch-always.
- **Це ТЗ + research, НЕ реалізація.** У проді нічого не змінилось.

### Що зроблено
- **Канон рівнів:** `docs/research/document-tiers-tz.md` — Document-Tier 0/1/2/3 (≠ SDD-Tier!): Tier 0 детермінований (live: стягнення аліментів, розлучення без дітей), Tier 1 комбінаторний/вибір блоків (0% генерації), Tier 2 гібридний (1 секція генерованої прози + харнесс), Tier 3 триаж/ескалація (військові спори). Межі: 0/1→2 = поява генерованої прози; 2→3 = вихід не документ.
- **Критичний огляд legaltech** (веб): Stanford (RAG не лікує — Lexis 17%/Westlaw 33%), DoNotPay/FTC ($193k overpromise), HotDocs/Docassemble (без LLM), Harvey/CoCounsel (юрист у петлі + citation grounding + Shepardization, ~0.2%) → 7 покращень I1–I7 (eval-гейт, runtime good-law, citations користувачу, augment→automate, product-guardrail, outcome-петля, critic-1 первинний).
- **Перша Tier 2-послуга — ТЗ:** `specs/features/alimony-change/` (plan/requirements/validation/example). «Зміна розміру аліментів (↑/↓)»: Input/Output, юр. алгоритм (ст.192/182/183/184/191 СК; ст.28/176/175 ЦПК; ст.4/5 ЗСЗ), детерм. гілка суд. збору (↑ звільнення / ↓ платить — exception_if), харнесс L0–L5, приклад з 🟢/🟡/🔴.
- **Deep-dive харнесса:** `docs/research/service-tiers-and-ai-harness.md`. **README.md (EN)** в корінь. **IMPROVEMENTS #53–#68** (security/CI аудит, +5).

### Ключові рішення
- **Tier 2 стадійно (augment → automate):** v0 = Опція B (юрист пише обґрунтування, revenue-share, gold-датасет); v1/v2 = Опція C (AI + критики + abstention) лише після зеленого eval. Abstention = «не гірше за валідний Tier-0». Повна AI-генерація (D) відхилена.
- **Найнебезпечніше — не вигадані статті (enum-констрейнт прибиває), а вигадані оцінки** (ловить groundedness-критик, 🟡).

### Наступний фокус (виконано в Session 24)
1. alimony-change: юридичний deep-dive → спека ✅. Реалізація (G1) — поза скоупом, окреме issue #37.
2. Далі: GraphRAG крок 1 (`law_relations`), фаза 2 типографіки (#50), VPS. #36 вже в main.
3. Open questions Ользі: поріг ст.192, момент дії ст.191, ПМ працездатних 2026 — RESOLVED у Session 24.
4. ⏰ ~2026-06-25 (Ольга) — law-monitor schedule + ревʼю змін законів.

---

## Session 22 (2026-06-12) — карта каталогу услуг + розгалужень → issue #36 (citation-coverage) + model-routing правило

### Головне — стан ЗАРАЗ
- **main чистий**, активних feature-гілок немає. Дві docs/chore-гілки змержені й прибрані.
- **Issue #36 (`citation-coverage`) СТВОРЕНО = фокус НАСТУПНОЇ сесії.** GraphRAG шаг 0: regex-екстрактор цитат (`scripts/lib/citations.mjs`) → голдени `<slug>.citations.json` (SSoT «послуга → статті» в git) → vitest тест-страж від дрейфу → CLI sync з `watched_laws`. Чекліст G1–G5 + out-of-scope в самому issue. **Рекомендована модель: Sonnet** (Tier 1, добре специфіковано, існуючі патерни).
- **Дока `docs/research/service-catalog-branching-map.md`** (merge `4c7010b`) — повний каталог 10 послуг, таксономія драйверів розгалужень, маппінг 7 retrieval-технік (intent detection / FAQ-індексація / clarifying questions тощо) на нашу 3-шарову архітектуру.

### Ключові висновки доки (для майбутніх сесій)
- Весь сімейний кластер (divorce, alimony, зміна аліментів, розлучення з дітьми, поділ майна, аліменти на повнолітніх) сидить на **3 законах** (СК/ЦПК/ЗСЗ) → граф будується раз на кластер.
- Розгалуження = 2 класи: **юридично-значущі** (факт → норма → блок документа; ~10–15 на послугу; вже формалізовані в `show_if`+`{{#if}}` і покриті parity-тестами = готові ребра ярусу 3) та **реквізитні** (ІПН/адреси — право не змінюють).
- **Знайдено drift шаблони↔watched_laws:** ст.27 ЦПК (divorce) і ст.174 ЦПК (alimony) цитуються, але НЕ watched; ст.113 СК (гілка surname_after_divorce) не цитується взагалі. Закривається в #36 (G4); вписати цитату ст.113 у текст шаблону = юр. правка → Ольга.
- Ядро (форма→шаблон) вже детерміновано реалізує патерни «intent → SME-відповідь» — техніки з доповіді застосовні до 3 шарів: (а) ядро — не чіпаємо; (б) retrieval для hybrid («зміна аліментів»: FAQ-індексація статей, metadata-first); (в) вільний вхід/чат v3 + військовий тріаж (intent detection, clarifying, fluctuating properties).
- Судова практика (ВС) не використовується ніде — кандидат на ярус 2 збагачення, не ярус 3.

### NEW правило процесу — модель на сесію за тиром
- CLAUDE.md (Session protocol) + `/session-start` (briefing тепер закінчується рядком **Recommended model**): Tier 0/1 імплементація за готовим issue → **Sonnet**; Tier 2 / архітектура / research / юридично-критичне → **Opus+**. Перемикання `/model` після briefing; контекст розмови при зміні моделі ЗБЕРІГАЄТЬСЯ.

### 🔴 Наступний фокус (НОВА сесія)
1. **#36 citation-coverage** (Sonnet) — G1–G5 за чеклістом issue.
2. Далі за пріоритетом: фаза 2 типографіки (#50) 🟡 / GraphRAG крок 1 (law_chunks чанк=стаття + migration law_relations) / VPS.
3. ⏰ **~2026-06-25 (Ольга):** розкоментувати `schedule:` law-monitor.yml + рішення по 2 змінах законів (СК/ЦПК — #36 дасть точну відповідь, чи зачеплені САМЕ наші статті) + панель ревʼю звʼязків ярусу 3.

---

## Session 21 (2026-06-11/12) — divorce-порт на шаблон (#35) + GraphRAG-стек: дослідження і рішення

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

### Гігієна + уроки (session 11, доповнення 2026-06-15)
- **changelog почищено:** усі старі «pending» групи звірено по git і перенесено в Commit history; секція Pending тепер порожня. Урок зашито: **«закоммічено ≠ закрито»** — звіряй задачу/чек-ліст, не лише git.
- **DECISIONS.md** доповнено розділом «RAG vs GraphRAG vs Hybrid Template» (`209a8d1`).
- **`docs/strategy/portfolio-value.md`** — **NEW** — цінність проекту як портфоліо AI Engineer.
- **`.claude/settings.local.json`** знято з git і додано в `.gitignore` (персональний файл — не комітимо).
- **Урок «дві копії»:** локальне і хмарне редагування одночасно → merge-конфлікт (portfolio-value.md). Правило: у момент часу авторитетна ОДНА копія; `git pull` перед/після передачі роботи між машиною і хмарою.

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
