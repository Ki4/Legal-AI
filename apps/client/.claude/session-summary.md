# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤61) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟢 SESSION 78 (2026-07-05, remote/Fable) — Аудит roadmap/issues/IMPROVEMENTS → план медвертикалі + критика GDPR/мед-даних. Лише docs, гілка `claude/healthcare-service-package-i7xl5p` (запушено, НЕ змержено — Сергій ревʼюїть і мержить).**
- **Зафіксовано план:** `docs/architecture/med-vertical-plan-2026-07.md` — задачі T1–T6 (GDPR-ресёрч → категорії → шкала шаблонності → M1 → блоки → review-картка юриста) + §3 = ТЗ ресёрчу медданих.
- **Відкрито issues:** **#91** (🔴 BLOCKER-5: GDPR/мед-дані go/no-go, Tier 2) · **#92** (категорії послуг = IMPROVEMENTS #103 + per-category політика доставки) · **#93** (хвиля 1: шкала шаблонності списку Олі → M1, blocked by #91+#92+пн-зустріч).
- **Ключове з критики GDPR:** «основне GDPR зроблено» (#16) НЕ покриває special-category (ст.7/9 ЗУ №2297-VI: повідомлення Омбудсмана + відповідальна особа + однозначна згода-артефакт `consents`); M1 проектувати БЕЗ діагнозів (мінімізація by design); мед хвиля 1 = template-only (нуль LLM на медданих) + доставка = захищене посилання (не чат); **#64 (видалення за запитом) стає блокуючим** до першого мед-клієнта; гео-скоуп (юзери в ЄС → GDPR ст.3(2) + DPIA) вирішити явно в #91.
- **Аудит борду:** відкритий лише #24 (n8n секрети → чекає VPS, ок). Roadmap v1.2 актуальний: M1=P1, M5 понижено (НСЗУ контестує), ЕКОПФО=hand-off.

**🟢 SESSION 77 (2026-07-05) — Fast-follow #90 (задеплоєно) + чистка Supabase + eslint-гігієна + матеріали до Олі. Усе код ЗМЕРЖЕНО+ЗАПУШЕНО в main.**
- **Fast-follow #90 (гілка `fix/90-fast-follow` → merged + n8n ЗАДЕПЛОЄНО):** (a) `Notify User` у form-submit → `onError=continueRegularOutput` (заблокований бот більше не роняє генерацію); деплой `deploy-workflow.mjs form-submit` (52=52 ноди, креди×20 збережено) + **API-звірка живого WF: `Notify User.onError` присутній, `active:true`**. (b) fallback-копія paid-екрану «натисніть Почати» → «**переконайтесь, що бота не заблоковано**, і натисніть Почати». (c) `delivery_error` enum — відкладено (Tier-2). PreviewPage 8✅ · workflow-тести 25✅. **Живий 403-прогін (реальний блок бота через TWA) — опційно за Сергієм (config-рівень підтверджено).**
- **Чистка Supabase (за явним «да»):** 3 тест-кейси (`a98495f5`,`1f491bc5`,`0bfa096c` — усі `service_id=1`, paid, ОДИН OWNER-профіль `60e7666d`) видалено (Storage DELETE PDF + SQL DELETE cases). Лишилось **4 cases** (було 7), 0 leftover.
- **Eslint (гілка `fix/eslint-react-hooks` → merged):** 9 pre-existing помилок (react-hooks плагін-дрейф) усунено. `only-export-components`→винесено date-хелпери в новий `dateInput.ts`; `set-state-in-effect`×6 + `refs`×1 → justified `eslint-disable-next-line`. **`eslint .`=0**, UI **555✅**.
- **Матеріали до Олі (гілка `docs/olga-demo-2026-07-06` → merged, лише docs):** демо-сценарій (5 актів) + **системна карта «поетапно + що за що відповідає»** (схвалено Сергієм — основа його презентації) + NotebookLM-snapshot `05_Current_State`. Слайд-дек (Artifact `3832782a-…`) — ⚠️ **Сергію не сподобався, переробляє сам**. Заземлено на живій БД (Explore-агент): 2 live template-послуги, оплата-заглушка, hybrid/RAG built-not-live, медвертикаль=гіпотеза під GDPR+sign-off.
- **🪤 Гочас:** у Bash-тулі (POSIX sh) НЕ використовувати PowerShell here-string `@'...'@` для `git commit -m` — інжектить літеральний `@` у subject; heredoc `git commit -F - <<'EOF'`.

**🟢 SESSION 76 (2026-07-05) — #90 ЗАДЕПЛОЄНО в живий n8n + ВЕРИФІКОВАНО НАСКРІЗЬ → ЗМЕРЖЕНО в main (Closes #90). Обидві гілки delivered_to_bot доведено на живому n8n.**
- **Деплой:** `deploy-workflow.mjs preview-pay` — нода `Finalize Delivery` додана (0 нод затерто), ключі Global Config відновлено, workflow active. Живий WF звірено через API: 2 respondToWebhook (opt-in-гейт цілий), обидві гілки → Finalize → єдиний Respond OK.
- **Живий HAPPY (opt-in зі стартом):** `delivered_to_bot=true`; форма `Send PDF` = **flat** `{ok:true, result:{message_id}}`; реальний PDF у чат (підтверджено).
- **Живий FAIL (opt-in при ЗАБЛОКОВАНОМУ боті):** `delivered_to_bot=false`, `signed_url` повернувся (док за лінком). **Запінено реальну 403-форму:** n8n віддає **`{error:{status:403, name:AxiosError}}`** — НЕ `{ok:false}`, НЕ під `.body`. `Finalize` дефолтить у `false` (ключ на `ok===true`). **Робастність за побудовою підтверджена емпірично.**
- **🪤 Гочас закрито:** форму провалу `Send PDF` тепер запінено вживу (`{error:{…}}`), а не тільки «робастно за побудовою».
- **Fast-follow (окремі мікрозадачі):** (1) `Notify User` у form-submit шле в бот ДО оплати без `onError=continue` → заблокований юзер валить генерацію; (2) копірайт #90 fallback «натисніть Почати» → точніше «переконайтесь, що бота не заблоковано» (реальна причина `false`=блок); (3) чистка тест-кейсів у Supabase.

**🟢 SESSION 75 (2026-07-05) — #89 ЗМЕРЖЕНО в main (Vercel-деплой) + deferred #90: чесний серверний сигнал `delivered_to_bot`. Гілка `feat/delivered-to-bot-signal` (`12586a9` фіча + `a6969fe` ревʼю), UI 555 ✅, scripts+n8n 1146 ✅, tsc/eslint(changed) clean. ✅ ЗМЕРЖЕНО в s76 (Closes #90) — задеплоєно + верифіковано наскрізь.**
- **#89 merge:** `feat/twa-delivery-ux` → main (`67623de`, Closes #89, гілку видалено), Vercel prod-деплой тригернувся, коментар у #89. UX-пакет TWA тепер live у проді.
- **#90 знахідка (understand-workflow, 4 читачі + синтез, чистий прогін):** n8n **вже** робить `sendDocument` синхронно (Send PDF inline перед Respond OK), результат (`{ok:true}`/403) є в процесі, але **скидається** (Respond OK читає лише Build Response; Send PDF `onError=continue`). → правда доступна за НУЛЬ додаткової латентності, «зробити синхронним = +латентність» = хибна розвилка. Фікс локальний у preview-pay.
- **#90 дизайн (обрав Сергій):** boolean `delivered_to_bot` + Start-aware honest fallback. **n8n:** нова Code-нода `Finalize Delivery` (між Send PDF→Respond OK) читає `$('Send PDF')` → ключ на `Telegram ok===true` (message_id НЕ вимагаємо; defensive `.body`-unwrap), honest-by-default. Обидві гілки `Send to bot?` сходяться → **єдиний** Respond OK (2 respondToWebhook, opt-in-гейт цілий). **Клієнт:** parse `delivered_to_bot` (missing→false, backward-compat), стейт `deliveryConfirmed` (окремий від intent `deliverToBot`), paid-копія `true`→«Копію надіслано у ваш чат» / `false`→«Доставку копії в чат не підтверджено» + хінт «Почати» (future-enabling, не re-send).
- **#90 adversarial-ревью (4 лінзи → верифікація, чистий прогін 12 агентів, 5 підтверджено, 0 блокерів, усі застосовані):** behavioral-тест Finalize (компілює jsCode + стаб `$`, а не string-match) · fallback «press Start» over-promise → future-enabling · amber/green 11px WCAG AA fail → -700 · застарілі доки «ok+message_id» → «ok===true».
- **🪤 Гочас:** live-форма провалу Send PDF (`{ok:true,message_id}` flat чи під `.body`?) статично НЕ пінингована — код робастний за побудовою (ключ на `ok===true`), але живий 403-прогін ОБОВʼЯЗКОВИЙ до shipping.

**🟢 SESSIONS 64–74 — перенесено в `archive/session-log-2026-H1.md`** (s71: фікс створення послуги + міграція 032; s72: publish-gate; s73: #88 закрито; s74: UX-пакет доставки #89; s64: #86 — 16 дір «________» у
проді, дата-фікс + `upload-form-config.mjs`; s66: template-editor конвеєр #51; s67: S2 слайси A+B,
методика клік-тестів `reference_browser_automation_cm`; s68: слайс C; s70: слайс D — фокус-режим +
іконкова рейка, #87). Живі хвости з них — у «Списку Олі» та «ПОРЯДКУ СЕСІЙ» нижче.

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
- **UX-пакет доставки TWA (#89, s74→ЗМЕРЖЕНО s75 `67623de`):** 2-карткова розвилка доставки + ErrorBoundary +
  delivery-aware стани + a11y. Vercel prod-деплой тригернувся (⚠️ не верифіковано вживу цієї сесії).
- **✅ #90 `delivered_to_bot` — LIVE (s76 deploy preview-pay + s77 fast-follow):** сервер віддає факт доставки в чат;
  form-submit `Notify User onError=continue` задеплоєно (s77). Заблокований бот не роняє генерацію.

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

**🔴 НАСТУПНА СЕСІЯ (79) — інструкції для Opus (детально, писав Fable s78):**
0. **Спершу:** прочитати `docs/architecture/med-vertical-plan-2026-07.md` ЦІЛКОМ (план T1–T6 + §3 = ТЗ) — це головний контекст сесії. Гілка s78 `claude/healthcare-service-package-i7xl5p` — якщо ще не змержена, нагадати Сергію змержити (docs-only, безпечно).
1. **Головна задача = issue #91 (BLOCKER-5, Tier 2): GDPR/мед-дані ресёрч → go/no-go.** Порядок G1→G5 в issue. Правила: (а) web-research з першоджерелами (закон №2297-VI ст.7/9/24, порядок Омбудсмана про «дані особливого ризику», статус проєкту 8153, GDPR ст.3(2)/9/35) — НЕ з памʼяті, кожне твердження з цитатою/лінком; (б) невідоме = «не знайшов», не вигадувати; (в) результат = doc у `docs/research/med-data-legal-requirements.md` + рішення go/no-go у `DECISIONS.md` + коментар в #91; (г) технічні наслідки звіряти з реальним стеком (Supabase-регіон перевірити ФАКТИЧНО, n8n execution-retention подивитись у конфігу, Groq DPA/retention — з їх актуальних terms).
2. **Паралельно/після (Tier 1, можна Sonnet): issue #92** — категорії послуг (міграція 030 вже є, довести до UI адмінки + фільтр TWA + per-category політика доставки).
3. **Після зустрічі з Олею (пн 06.07):** її медсписок → G1 issue #93 (шкала шаблонності 1–10); фідбек на живий документ → задачі/wording; sign-off «Список Олі» (пп.1–5 вище).
4. **НЕ чіпати:** жодного мед-коду до go/no-go з #91; оплатна діра і `delivery_error` enum — окремі сесії.
**Модель:** #91 = Opus/Tier 2 (легально-критичний ресёрч). #92 = Sonnet достатньо. Зустріч/фідбек — розмовне.

**Модель:** з 02.07 Сергій переключив default на **Fable 5** (червневий мемо «Opus + ultra-code» закрито).

**Запуск середовища:** n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`).
**Dev-адмінка: `npm run dev:admin` → :5174** (s67: порт-аргумент через npm НЕ пробрасывается; старий
процес на :5175 убито). ⚠️ Правка рушія `render-document.js` НЕ підхоплюється Vite HMR (optimizeDeps) —
чистити `node_modules/.vite` + рестарт (симптом: `{{#bold}}` рендериться як `________`).
Деплой form-submit: `node scripts/deploy-workflow.mjs form-submit`. Деплой дайджесту:
`node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`.
Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n` (+ `npm test` для UI). CI-гейт: `.github/workflows/test.yml`.

**⚠️ Інфра:** WebStorm-термінал (JediTerm) не скролить Claude Code TUI → великі звіти писати у `.md`
(memory `feedback_reports_to_file`).

