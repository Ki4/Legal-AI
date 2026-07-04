# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤61) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟢 SESSION 73 (2026-07-04) — #88 ЗАКРИТО: п.2–6 + adversarial-ревью → MERGE у main (`e28a37d`, Closes #88), гілку `fix/admin-quick-wins` видалено. UI 534 ✅ (+14) · tsc/build:admin OK · live-verify повний · Vercel-деплой тригернувся.**
- **П.2–6 (коміт `5595bae`):** /design під AdminGuard · мертвий чек-лист якості видалено · вкладку
  «AI-промпт» сховано для template-driven режимів (предикат `templateDrivesGeneration`:
  template|hybrid|null; факт: `services.ai_prompt` не читає ЖОДЕН живий workflow — лише архівний v5,
  hybrid-промпти живуть у `n8n/prompts/`; для legacy js — чесний банер «промпт не впливає») +
  `visibleTab`-fallback · Dashboard: збій завантаження = укр. помилка + «Спробувати ще раз» (raw
  message дрібним моно для діагностики), НЕ фейкове «Ще немає послуг» · «Abstention rate» →
  «Складні справи (AI передав юристу)».
- **Adversarial-ревью диффа (workflow: 3 лінзи → верифікація кожної знахідки): 12 підтверджено,
  1 відбито, усі виправлені ДО merge.** Головні: (1) blocker у свіжому ж тесті — Proxy-заглушка
  сторінок = thenable (`get`-trap віддає функцію і на `then`) → async vi.mock-фабрика ніколи не
  резолвиться → vitest deadlock на collection (саме тому висіли прогони; переписано на плоскі
  `{[exportName]: stub}`); (2) регресія Dashboard: deps `[user]`→`[userId]` (supabase емить свіжий
  об'єкт user на кожен TOKEN_REFRESHED ≈ щогодини → каталог колапсував би в skeleton) +
  `cancelled`-guard проти stale-відповідей; (3) застарілий копірайт ×3 (empty-state Dashboard,
  FormBuilder «ID поля…», lead AI-вкладки) — юриста більше не шлють у сховану вкладку.
- **Live-verify :5174 (жива Supabase, divorce):** AI-вкладки нема (Форма/Шаблон/Опції) · чекбоксів 0 ·
  dead-ref банер `{{missing_field_xyz}}` блокує публікацію (кнопка disabled) · confirm публікації з
  коректною копією для active (скасовано — БД ціла) · «У чернетку» + тост · **симетричний гейт форми
  вживу заблокував save** після видалення поля `registered_address` (точний тост; після reload 15/15
  полів на місці, БД ціла) · консоль 0 помилок · драфт фінально 14939 байт-у-байт.
- **🪤 Гочас сесії:** session-limit тарифу вбиває workflow-агентів посеред прогону — «0 знахідок» від
  упалого ревью ≠ чистий дифф (дивитись `failures`/`agents_error` в результаті!); осиротілі
  vitest-процеси вбитих агентів висять — чистити перед новим прогоном.

**🟡 SESSION 72 (2026-07-04) — #88 п.1 publish-gate ГОТОВО (змержено в main у s73 разом із п.2–6) + 2 стратегічні рішення. UI 520 ✅ (+17) · tsc/build:admin OK.**
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

**🟢 SESSIONS 64–70 — перенесено в `archive/session-log-2026-H1.md`** (s64: #86 — 16 дір «________» у
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

**🔴 НАСТУПНА СЕСІЯ (74) — план вихідних (`.claude/reports/2026-07-04-weekend-plan-to-monday.md`), нова гілка:**
1. **UX-пакет TWA:** **помітний opt-in «Надіслати документ у Telegram»** (`PreviewPage.tsx:151-162`,
   зараз дрібний text-xs чекбокс — Сергій явно просив зробити явним) + стани завантаження/помилок TWA.
2. **Демо-тур для Олі** (зустріч пн 06.07 вечір): прогін «що є + плани» по живій адмінці/TWA.
3. Бонус-кандидати: 8 eslint pre-existing на main (окрема мікрогілка) · точковий фідбек A+B+C+D від
   Сергія · «застаріло»-петля / медвертикаль з беклогу s64.
**Модель для п.1:** Tier 1 механіка — Sonnet достатньо; Fable (дефолт Сергія) теж ок.

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

