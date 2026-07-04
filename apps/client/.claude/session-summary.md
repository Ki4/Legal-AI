# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤61) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟡 SESSION 72 (2026-07-04) — #88 п.1 publish-gate ГОТОВО на гілці `fix/admin-quick-wins` (НЕ змержено — п.2–6 лишились) + 2 стратегічні рішення. UI 520 ✅ (+17) · tsc/build:admin OK.**
- **Publish-gate проти структурних «________» (п.1 #88), коміт `7e4eaff`:** дизайн на Fable → adversarial
  red-team (3 лінзи, 3 blocker-и) → **контракт форма↔шаблон має 4 ребра, загейчено всі**: (a) публікація —
  `collectDeadRefs()` 4 класи (unmatched / missing-sources / unknown-ai-path / unknown-answers-path;
  виняток `GRACEFUL_DEFAULTS` — гендери/n_children рендерять дефолт, не діру) + confirm зі статус-залежною
  копією (для disabled не брешемо «клієнти одразу отримають»); (b) «Відновити» — dead-ref backstop у
  `gateSnapshotAndSet` (був parse-only!) + нова кнопка «У чернетку»; (c) збереження форми — симетричний
  гейт (блокує лише ВНЕСЕНІ dead refs, baseline `savedConfig`); (d) флип js→template поза UI —
  GOTCHAS-правило + IMPROVEMENTS **#104** (render-time hard-fail) / **#105** (lint опціональних полів).
  Плюс: атомарний **«Зберегти і опублікувати»** при formDirty (ordering-діра закрита конструкцією, не
  попередженням) · **formDirty ≠ draftDirty** (кейстрок шаблону ≠ «незбережені зміни») · **parity-тест
  дзеркало↔рушій** (`buildContext({},{})` === `providedContextKeys()`, 15/15 — дрейф валить CI, не юриста).
  Політика (red-teamed v2): `.claude/reports/2026-07-04-publish-gate-policy.md`.
- **Рішення (DECISIONS.md): похідний реєстр змінних; збережуваний ВІДХИЛЕНО.** Correct-by-construction =
  дисципліна поверх view (палітра вже обчислює union form_config + PROVIDED_CONTEXT); окрема таблиця =
  другий источник істини про «поле існує» → drift-клас поверхом вище. Траєкторія без роботи двічі:
  (1) гейти v2 ✅ → (2) registry-дисципліна (inline-підсвітка невідомих змінних у CM тим самим предикатом +
  reference-guard/guided-rename у FormBuilder) → (3) preflight-панель (#10 vision) ПЕРЕД заливом
  медвертикалі (**майбутнє = медицина**: M1–M11 ≈ 9 простих template-послуг; вікно = #BLOCKER-5 GDPR +
  sign-off Олі M1–M18; M8–M18 = hand-off юристу, підтверджує стратегію ескалації).
- **Fable-window аналіз** (`2026-07-04-fable-window-tasks.md`, 8 аналітиків): слам-данків нема — усе
  reasoning-важке або вже заспечено (GraphRAG-онтологія в `GRAPHRAG-GUIDE.md`!), або gated на Олю/інфру.
  Вибір Сергія = publish-gate через Fable — зроблено цієї ж сесії.
- **Плани вихідних** (`2026-07-04-weekend-plan-to-monday.md`): зустріч з Олею **пн 06.07 вечір** (покаже
  «що є + плани», дедлайн НЕ жорсткий — рішення Сергія); п.1 плану (шов generation_mode) закрито ще в s71.
- **⚠️ Знахідка:** 8 eslint-помилок **pre-existing на main** (дрейф react-hooks плагіна після s71;
  `git diff main` тих рядків порожній; `npm run lint` = ті самі 8) — кандидат окремої мікрогілки.

**🟢 SESSION 71 (2026-07-04) — FIX: створення нової послуги в адмінці було ПОВНІСТЮ зламане (2 баги) → ЗМЕРЖЕНО в main і ЗАПУШЕНО (merge `e5ff0b5`), гілку `fix/new-service-generation-mode` видалено. tsc/eslint clean.**
- **Баг #1 — `services.id` sequence відставав від MAX(id):** таблиця старша за `migrations/` (serial через дашборд); рядки 1-5 сіялися з явними id без руху owned-послідовності → `nextval` усередині зайнятого діапазону → КОЖЕН `INSERT` без id (admin «Нова послуга») падав `duplicate key services_pkey`. Юрист не міг створити ЖОДНОЇ послуги. Фікс: **міграція 032** `setval` до MAX(id) (недеструктивно) — **застосована на живій БД** (Сергій, SQL editor «Success»).
- **Баг #2 — DB-дефолт `generation_mode='js'`** (міграція 014): нова послуга роутилась би в legacy js-білдер n8n (нема хардкод-функції) і кидала помилку. Фікс: `ServiceEditPage.handleSave` insert-гілка → `generation_mode:'template'` (тільки insert; update не чіпає 'hybrid'/'js').
- **Live verify через REST** (той самий PostgREST-ендпоінт, що й браузерний `supabase.from('services').insert`): після міграції `INSERT` без id авто-присвоює id + `generation_mode='template'` персиститься; `status`-CHECK = `active|needs_review|disabled`; усі тест-рядки видалено (`DELETE 204`), БД чиста (наступний реальний id=9, розриви нешкідливі).
- **✅ Замкнута петля доведена через РЕАЛЬНИЙ admin UI (:5174):** MCP-таб успадкував живу Supabase-сесію Сергія (login не потрібен) → «Нова послуга» → title+slug → «Зберегти» (справжній React `handleSave`) → редирект `/services` + **нова строка id=9** у БД з `generation_mode='template'` (не дефолт `js`), `lawyer_id`=UUID Сергія, без duplicate-key. React-обвʼязка (єдине, що лишалось непокритим) — доведена. Тест-строку + 2 smoke-cases (a8416d68/260cd583) + їх PDF у Storage прибрано (services назад до 5).
- **Регресія n8n:** обидва live-smoke (scenario 1 divorce, scenario 2 children+alimony) → 200, витяг без дір. Unit-сюїта scripts+n8n **1145 ✅**.
- **🧹 Хвіст:** 2 стратегічні звіти в `.claude/reports/` (mvp-synthesis + transition-roadmap) закомічено окремо.
- **🪤 Гочас підтверджено знову:** IDE (WebStorm) перемкнув гілку на `main` посеред роботи — staged-файли поповзли на main; врятувало `git branch --show-current` перед комітом (звіряти ЗАВЖДИ).

**🟢 SESSION 70 (2026-07-03) — S2 слайс D (issue #87) ЗМЕРЖЕНО в main і ЗАПУШЕНО (`6769e27`, Closes #87), гілку `feat/editor-slice-d-focus-mode` видалено. Фокус-режим редактора шаблону + іконкова рейка сайдбара. UI 503 ✅ (+14) · root 1145 ✅ · tsc/eslint clean · build:admin OK.**
- **Що зроблено:** `Splitter.tsx` (новий, без бібліотек) — перетаскувана межа, ratio 0.2–0.8 персистить у
  localStorage (глобально), дабл-клік=50/50 · `AdminLayout` — іконкова рейка (224→56px, `md:`-only,
  мобільний drawer не зачеплений, стан персистить) · `TemplateEditorPanel` — кнопка «⇲ Фокус-режим»,
  у фокус-режимі заголовок+опис заміняються тонкою панеллю дій (Скинути/Зберегти/Опублікувати спільні
  з нормальним режимом + тогл превʼю + ✕) · `TemplateDraftPreview` — опційний контрольований `fullscreen`
  проп (uncontrolled за замовчуванням, старі виклики не зачеплені) · `ServiceEditPage` — фокус-режим =
  РАННІЙ `return` (не оверлей) — сайдбар/topbar/таби зникають без дубль-монтування CodeMirror; Esc
  закриває ВЕРХНІЙ шар (`focusPreviewFullscreen` у deps ефекту, не функціональний updater — інакше
  stale-closure дозволив би одному Esc закрити обидва шари); режим НЕ персистить між заходами.
- **Live verify (:5174, divorce, вікно 1536×639 — той самий тісний кейс з s69):** 0 накладок
  (elementFromPoint-сітка) · editor+preview на всю висоту 607px (було ~19px) · drag/дабл-клік/persist
  сплітера ОК · **Esc-пріоритет підтверджено**: перший Esc закриває лише fullscreen-превʼю, другий —
  фокус-режим · рейка: collapse/expand переживають reload · консоль 0 помилок · БД не торкнуто.
- **🪤 Гочас:** Vite HMR на цій сесії тимчасово тримав старий CSS для нових `md:w-14`/`md:w-56` класів
  під час live-edit (ширина рейки не змінювалась до hard-reload) — очікуваний Vite dev-гочас (той самий
  клас проблем, що optimizeDeps-кеш рушія), повний `navigate()` щоразу підтверджував коректність.
- **🧹 Хвости (незмінні з s69):** точковий фідбек Сергія по A+B+C ще не отримано · smoke-case
  `0bfa096c-…` (+PDF) — залишено за рішенням Сергія · текст каркаса Олі (п.5 списку).

**🟢 SESSIONS 64–68 — перенесено в `archive/session-log-2026-H1.md`** (s64: #86 — 16 дір «________» у
проді, дата-фікс + `upload-form-config.mjs`; s66: template-editor конвеєр #51; s67: S2 слайси A+B,
методика клік-тестів `reference_browser_automation_cm`; s68: слайс C). Живі хвости з них — у «Списку
Олі» та «ПОРЯДКУ СЕСІЙ» нижче.

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

**🔴 НАСТУПНА СЕСІЯ (73) — продовжити гілку `fix/admin-quick-wins` (checkout, НЕ нову!):**
1. **#88 п.2–6 (механічні, ~година):** #2 `/design` під `AdminGuard` (`AdminApp.tsx:54`) · #3 прибрати
   мертвий чек-лист (`ServiceEditPage.tsx:~493`) · #4 вкладка «AI-промпт» для template: сховати/банер ·
   #5 тихий збій завантаження → помилка+retry (`DashboardPage.tsx:67`) · #6 «Abstention rate» → укр.
   Спека: `.claude/reports/2026-07-04-admin-critique.md`. **П.1 УЖЕ ГОТОВИЙ** (`7e4eaff`, чекбокс ✓).
2. **Live-verify всього пакета #88 на :5174** (гейт: dead-ref баннер, confirm, «Зберегти і опублікувати»,
   «У чернетку», симетричний гейт форми) → merge у main (Closes #88).
3. **Далі план вихідних** (`.claude/reports/2026-07-04-weekend-plan-to-monday.md`): UX-пакет TWA —
   **помітний opt-in «Надіслати документ у Telegram»** (`PreviewPage.tsx:151-162`, зараз дрібний text-xs
   чекбокс — Сергій явно просив зробити явним) + стани завантаження/помилок · демо-тур для Олі (пн вечір).
4. Бонус-кандидати: 8 eslint pre-existing (окрема мікрогілка) · точковий фідбек A+B+C+D від Сергія.
**Модель для п.1–2:** Tier 1 механіка — Sonnet достатньо; Fable (дефолт Сергія) теж ок.

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

