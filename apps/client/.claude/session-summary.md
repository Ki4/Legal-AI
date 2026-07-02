# Legal AI — Master Context Document

> **Як читати:** спершу блок «📌 Стан зараз» (нижче) — це жива витримка. Далі — останні 3 сесії
> повністю. Старіші сесії (≤48) перенесено в `archive/session-log-2026-H1.md` (git-історія, читати
> за потреби — `grep`). Архівувати, коли живий файл переростає ~3 сесії / ~200 рядків.

---

## 📌 Стан зараз (оновлювати щосесії — це і є контекст, що читається на старті)

**🟢 ДОШКА ЧИСТА (session 61) — #84 змержено, беклог-issues розчищено, admin-brief заархівовано.**
- **#84 document-layout-preview ЗМЕРЖЕНО в main** (merge-коміт `97e3231`, гілку `feat/document-layout-preview`
  видалено, issue #84 закрито). Read-only page-aware прев'ю розкладки → вкладка «Розкладка» service-mirror.
  UI **331 ✅** на main, tsc/lint clean. Presentation-only редизайн вигляду — окрема гілка за потреби (#100/#101 беклог).
- **Issue-board гігієна:** закрито **10 bulk-імпортованих беклог-issues** (усі ідеї → `IMPROVEMENTS #N`, reopenable;
  #5 signup-bug — obsolete під solo-архітектуру). Рішення в `DECISIONS.md` («Issue-board = лише активна робота»).
  **Відкрито лише #24** (n8n secrets у Variables — НЕ пріоритет за рішенням Сергія).
- **admin-ux design-brief ЗААРХІВОВАНО** в main (шапка ⚠️ SUPERSEDED — редизайн, що brief пропонував, main уже
  реалізував: світла тема default/Lucide/токени/`admin/ui`-кіт). Обидві docs-гілки видалено.
- **Стан репо:** лише `main`, робоче дерево чисте, `origin/main == local`. Solo-закриваних хвостів не лишилось.

**Preview-module (#83) — по-старому live в проді** (деталі — «Що live» нижче + «Теплі факти»); наскрізний
монетизаційний потік TWA→витяг→PreviewPage→оплата(заглушка)→signed URL працює end-to-end (sessions 54-57).

**📦 Теплі факти (виправлено) — для роботи з preview-flow:**
- **🪤 ВИПРАВЛЕНО факт:** `cases.user_id` = **profile UUID** (НЕ telegram id!). Telegram id → profile через
  `identities.external_id` → `identities.user_id`. form-submit резолвить через ноду `Get Profile`; preview-pay —
  через `Get Identity`. Owner-check і rate-limit рахуються по цьому UUID.
- **Storage:** приватний bucket `generated-documents` (PDF-only, service-role). Шлях `cases/{case_id}.pdf`.
  Sign: `POST /storage/v1/object/sign/generated-documents/{path}` + `?download=<імʼя>` (для Content-Disposition).
  Чистка файлів: Storage API `DELETE /storage/v1/object/generated-documents` body `{prefixes:[...]}` (тригер
  `protect_delete` блокує SQL DELETE на `storage.objects`, але НЕ на бакет через API).
- **🪤 ВИПРАВЛЕНО факт (session 57):** `protect_delete` тригер — лише на `storage.objects`, **НЕ на таблиці
  `cases`**. Тестові `cases` ВИДАЛЯЮТЬСЯ звичайним SQL DELETE під service-role (Supabase SQL Editor):
  `DELETE FROM cases WHERE user_id IN (SELECT user_id FROM identities WHERE external_id='236581343')`.
  Старі заметки «protect_delete блокує cases» були помилкові.
- **Скрипти:** `build-preview-pay.mjs` (генерує preview-pay, 0-cred) + `sync-preview-module-form-submit.mjs`
  (патчер form-submit: витяг+Storage+rate-limit; `PREVIEW_RATE_LIMIT` env-override) + `test-preview-pay.mjs`
  (e2e smoke). Деплой: `deploy-workflow.mjs preview-pay|form-submit`.
- **🪤 IDE перемикає гілку (повторилось session 56!):** WebStorm зробив `checkout main` посеред роботи → файли
  «зникли», form-submit виглядав застарілим. Звіряти `git branch --show-current` ПЕРЕД кожним комітом.

**Що live у проді (form-submit `D2ab06X3pVUWk1py`, 52 ноди, active):**
- **2 послуги** — divorce + alimony. Документ НЕ йде в бот до оплати (повний PDF у приватний Storage, витяг у
  ранній відповіді). Бот-повідомлення: «✅ Заявку прийнято! … Перегляд — у застосунку» (більше НЕ «Формую…»).
  Per-profile rate-limit 20/24год. Склонення ПІБ = Groq + stem-guard. #67/#76 live.
- **Агент «що змінилось» (law-change-impact)** — живий end-to-end (n8n `qTOIqllA4CQvBJs5`). issue #73 закрито.

**🟢 SESSION 59 (2026-07-01) — ринкове дослідження + стратегія + корективи плану (docs-only, ЗМЕРЖЕНО в main):**
3 deep-research прогони + синтез 5 інсайтів → roadmap **v1.2**. Ключове:
монополія адвокатури **вузька** (продукт легальний by design, червона лінія = представництво в суді);
держава (Дія e-Розлучення) забирає простий розвід → наша ніша = **«де починається суд»** (аліменти/діти/спірне);
медицина = вертикаль **шаблонних** позицій (1–4), не окремий продукт; human-review зашита в дизайн.
**Верифікований попит 1–4:** аліменти (33k справ/208k боргів) + судовий розвід (≈75% усіх) = валідоване ядро;
M1 (медкартка) = 1-й медкандидат; **M5 (НСЗУ) понижено** (держава допомагає оформити); інвалідність (ЕКОПФО) → hand-off;
Дія.AI поки вузький (~3 функції). Доки: `global-legal-doc-automation-market-2026.md`,
`ukraine-eu-regulatory-and-competitors-2026.md`, `service-demand-validation-1-4-2026.md`,
`strategy/market-strategy-synthesis-2026.md`, roadmap v1.2.
**⚠️ Поза main (потрібен Olga sign-off + #BLOCKER-5):** гілка `claude/medical-vertical-complexity-scoring`
(скоринг 18 медпозицій M1–M18).

**🟢 ФІЧА #84 document-layout-preview — G1→G5 ЗАВЕРШЕНО + ЗМЕРЖЕНО в main (session 61), issue #84 закрито.**
Read-only page-aware прев'ю розкладки в адмінці (вкладка «Розкладка» service-mirror). 5 груп: G1 реєстр
блоків+зв'язків (SSoT `blockRegistry.ts`) · G2 `detectBlocks.ts` (детерм. якорі, fail-closed) · G3 `paginate.ts`
(рушій пагінації, honorить engine keep-with-next) · G4 `DocumentLayoutPreview.tsx`+`LayoutGuide.tsx` (A4-симуляція,
підсвічування, overflow-warn, caveat «наближено») · G5 вмонтування + докі. UI **331 ✅** (+47), tsc/lint clean,
admin build OK. Верифіковано наживо (Playwright-скріншоти: 5 сторінок, Додатки+підпис їдуть разом = keep-together
працює; легенда з 8 блоків + 2 зв'язки). Скріншоти на Робочому столі (`layout-preview-pages.png` / `-legend.png`).

**✅ SESSION 62 (2026-07-02) — ДЕМО-ПРОГІН зроблено + беклог покращень зафіксовано + наступний фокус = issue #85.**
Пройдено всі екрани адмінки наживо (DOM-обхід, бо Chrome-розширення не скриншотить localhost). Тріаж Сергія:
граф/анатомія/шапка/зміни-законів/заявки/коментарі = ок; розкладка+редактор-форми = переробка (пізніше).
**Записано в IMPROVEMENTS: #102 (ConfirmModal, єдиний дизайн) + #103 (категорії послуг + фільтр)** → зведено в
**issue #85** (старт наступної сесії через `/interview`, з опорою на frontend-design skill + наявний `admin/ui`-кіт + `/design`).
**Комент-збереження перевірено наживо** (`service_notes`: INSERT/SELECT/UPDATE ✅; DELETE заблокований RLS = by design).
🪤 **ХВІСТ:** тестовий round-trip лишив рядок `service_notes id=1` (клієнтом не видаляється, RLS) — прибрати SQL:
`DELETE FROM service_notes WHERE id = 1;` (SQL Editor, service-role).
**Головні знахідки демо (в issue-беклог не завели — обговорити):** (1) 🔴 health дає ХИБНІ тривоги на робочих
послугах (alimony «37 бракує» хоча в проді ок — аналізатор не розуміє derived-поля движка); (2) 🔴 «застаріло»
не знімається після ревʼю законів; (3) 🟡 колізія слів «Потребує уваги»(health)/«Потребує ревʼю»(status).

**🔴 НАСТУПНА СЕСІЯ — запуск issue #85 (категорії #103 + модалка #102):** `/interview` → Tier-1 по групах G1-G4.
Деталі + що вже є для переюзу — в тілі issue #85. Модель: Opus (архітектура + дизайн).

**📦 Раніший план (session 61) — демо + перший шар покращень:** Claude піднімає адмінку, проводить Сергія
наживо → разом визначаємо перший шар (цілісний UX / редактор розкладки #101 / редизайн вигляду) → `/interview` → спека.
- **(A) ДЕМО-ПРОГІН «Консоль послуг»** (пріоритет Сергія): Claude піднімає адмінку (`npm run dev:admin` + браузер)
  і проводить Сергія по наявному, що вже реалізує його бачення: `DashboardPage` (каталог послуг + тумблер статусу
  active/needs_review/disabled) → `ServiceViewPage` вкладки (Документ / **Розкладка** #84 / Анатомія / Граф / Форма) →
  health 🟢🟡🔴 + цитати. Сергій дивиться наживо. **Бачення зафіксовано:** `docs/strategy/service-builder-vision.md`
  (консоль послуг → Service Builder → RAG/GraphRAG + preflight-панель довіри; §2 таблиця «що вже живе», §7 наступний крок).
  Після демо — `/interview` → визначити перший шар (зібрати наявні екрани в цілісний UX АБО #101 редактор розкладки) → Tier-2 спека.
- **(B) РЕДИЗАЙН #84** (окремо, presentation-only): `/interview` — ЩО не влаштовує у вигляді розкладки (пробіли/масштаб A4/
  кольори/легенда/side-by-side). Реф: скріншоти на Робочому столі + `DocumentLayoutPreview.tsx`. Логіка G1-G3 не чіпається.
- Беклог: реальний платіж (заглушка ок поки) · **#NEXT-4 медвертикаль** (блок #BLOCKER-5) · git-worktree демо · #100 · #101.
  **stale-issues ✅ закрито session 61** (лишилось лише #24 secrets — не пріоритет за рішенням Сергія).

**📦 admin-ux design-brief — ЗААРХІВОВАНО в main** (session 61) як design-history (шапка ⚠️ SUPERSEDED): редизайн,
що brief пропонував (світла тема/Lucide/токени/`admin/ui`-кіт), main **уже реалізував**. Обидві гілки видалено.
Артефакт: `docs/design/admin-ux-brief.md` + 8 скрінів «до» (`docs/assets/admin-ux/`).

**📋 Список Олі (sign-off):** (1) формулювання превʼю-витягу (точка обрізки) + блоку ст.175 ч.7; (2) #67 divorce
wording «спір… відсутній» → «не є предметом цього позову». **✅ #33/#76 закрито.**

**Модель (червень):** Opus + ultra-code (memory `feedback_model_opus_ultracode_june2026`; переглянути ~липень).

**Запуск середовища:** n8n live (Docker) + ngrok (`rosy-caution-progeny.ngrok-free.dev → :5678`).
Деплой form-submit: `node scripts/deploy-workflow.mjs form-submit`. Деплой дайджесту:
`node scripts/build-law-change-digest.mjs && node scripts/deploy-workflow.mjs law-change-digest`.
Тести: `cd apps/client && npx vitest run --root ../.. scripts n8n` (+ `npm test` для UI). CI-гейт: `.github/workflows/test.yml`.

**⚠️ Інфра:** WebStorm-термінал (JediTerm) не скролить Claude Code TUI → великі звіти писати у `.md`
(memory `feedback_reports_to_file`).

---
## 🆕 Session 61 (2026-07-02) — гігієна дошки + merge #84 + архів admin-brief (закриття хвостів)

### Головне — стан ЗАРАЗ
- **Дошка чиста** (деталі — блок «📌 Стан зараз» вгорі). Закрито мелкі хвости solo: #84 змержено, 10 беклог-issues
  розчищено, design-brief заархівовано. Відкрито лише **#24** (secrets — не пріоритет). Робоче дерево чисте.

### Що зроблено
1. **admin-ux design-brief → архів у main.** Гілка `docs/admin-ux-design-brief` відстала від main на багато сесій
   (повний merge відкотив би роботу) → забрано лише унікальні артефакти (brief + 8 скрінів «до»). Перевірка
   актуальності: brief пропонував редизайн, який main **уже реалізував** (світла тема/Lucide/токени/`admin/ui`) →
   додано шапку **⚠️ SUPERSEDED**, збережено як design-history. Обидві гілки видалено. (merge `c976b4f`)
2. **Гігієна issue-дошки.** Закрито **10 bulk-імпортованих (2026-06-07) беклог-issues** (анти-паттерн CLAUDE.md
   «IMPROVEMENTS ≠ GitHub Issues») з коментарем-посиланням на `IMPROVEMENTS #N`: #10/#13/#15/#16/#21/#26/#19/#20 →
   backlog; **#22 портфоліо** → особиста задача Сергія (в репо помилково); **#5 signup-bug** → obsolete (`lawyers`
   не використовується в коді, revenue-share ≠ solo-модель). Рішення в **DECISIONS.md**. **#24 не чіпали.**
3. **Merge #84 document-layout-preview → main** (merge `97e3231`, гілку видалено, issue #84 закрито). Верифіковано
   перед і після merge: UI **331 ✅**. 3 docs-конфлікти (changelog/session-summary/DECISIONS) розв'язано, порядок
   записей виправлено, устарілий блок «Гілка про запас» прибрано.

### 🪤 Уроки
- **«Перевір актуальність перед пушем стухлого доку»** спрацював: brief виглядав «готовим», але main його вже обігнав
  → не пушити наосліп, а звірити з кодом і позначити SUPERSEDED. (claim ≠ fact)
- **Merge старої гілки в main = docs-конфлікти session-файлів** — розв'язувати скриптом (порядок записей), не наосліп «theirs».

### 🔴 Наступний крок
- **ЗАВТРА (session 62): демо-прогін «Консоль послуг» + визначити покращення** → `/interview` → Tier-2 спека. Деталі — «📌 Стан зараз».

---
## 🆕 Session 60 (2026-07-01) — #84 document-layout-preview G1→G5 (фіча ЗАВЕРШЕНА на гілці, НЕ змержено)

### Головне — стан ЗАРАЗ
- **Уся фіча #84 жива на гілці `feat/document-layout-preview`** (5 комітів G1→G5, НЕ змержено). Read-only
  page-aware прев'ю розкладки → вкладка «Розкладка» у service-mirror. Деталі + наступний крок (РЕДИЗАЙН через
  `/interview`) — блок «📌 Стан зараз» вгорі. UI **331 ✅** (+47), tsc/lint clean, admin build OK.
- **Верифіковано наживо** (тимч. демо-сторінка + Playwright headless): 5 A4-сторінок, блок «Додатки→підпис»
  їде **разом** (keep-together працює — підпис не осиротів), легенда з 8 блоків + 2 зв'язки, caveat «наближено».
  2 скріншоти на Робочому столі (`layout-preview-pages.png`, `layout-preview-legend.png`). Демо-файли прибрано.

### Що зроблено (знизу вгору, тести першими)
- **G1** `blockRegistry.ts` (SSoT: 8 блоків + 2 зв'язки `{id,label,primitives,help_text,color,parent?}`,
  `relationOf`) +14 тестів. **G2** `detectBlocks.ts` (детерм. якорі — заголовки/ПРОШУ/Додатки/перша цитата,
  реюз `preview-excerpt`; fail-closed→`unknown`; тести рендерять РЕАЛЬНІ divorce/alimony через node-require) +18.
  **G3** `paginate.ts` (рушій: honorить engine keep-with-next, page-break, overflow[]; висоти інжектовані) +9.
  **G4** `DocumentLayoutPreview.tsx`+`LayoutGuide.tsx` (A4-симуляція, вимір висот через callback-ref, підсвічування
  блок+зв'язок, overflow-warn, caveat) +6 RTL. **G5** вкладка в `ServiceAnatomy` + докі (DECISIONS/IMPROVEMENTS
  #100/#101/roadmap).
- **Інфра:** додано dev-only RTL (`@testing-library/react`+`jsdom`) — перший компонент-тест у проєкті, per-file
  `// @vitest-environment jsdom`; engine мокнуто в RTL (нема `@doc-engine` під vitest), реальну структуру покриває G2.

### 🪤 Уроки
- **#97/#98/#99 існували як тіла, але не в індексі IMPROVEMENTS** (claim≠fact) → бекфілив індекс + додав #100/#101.
- **`@doc-engine` alias лише в `vite.config.admin.ts`, НЕ під `vitest run`** → тести, що потребують рушій, вантажать
  його через node `createRequire` (G2), а компонент-тести мокають `documentPreview` (G4).
- **Робочий стіл = `C:\Users\serge\OneDrive\Рабочий стол`** (OneDrive-редирект, не `~/Desktop`).

### 🔴 Наступний крок
- **РЕДИЗАЙН #84 через `/interview`** (див. «Стан зараз» вгорі) → потім merge гілки в main. Presentation-only.

---
## 🆕 Session 59 (2026-07-01) — гігієна гілок + узгодження наступного фокусу (#84)

### Головне — стан ЗАРАЗ
- **Розчистка гілок** (ручна гігієна борда): видалено **18 змержених** гілок (10 локальних + 8 remote) — усі
  перевірені `--merged main`/`--merged origin/main`, коміти збережені. Лишились: локально `main` +
  `docs/admin-ux-design-brief`, remote `origin/main`.
- **`docs/admin-ux-design-brief` СВІДОМО лишена локально** (НЕ змержена, НЕ видалена) — унікальний design-brief
  адмінки + 8 скрінів; повний merge притягнув би стухлі правки session-файлів (вет. з ~22.06). Деталі — блок
  «📦 Гілка про запас» вгорі.
- **Наступний фокус узгоджено: issue #84** (document-layout-preview, Tier 2), старт з G1. НЕ кодили цю сесію.

### Що зроблено
- `git branch -d ×10` (всі merged) + `git push origin --delete ×8` (всі merged у origin/main) + `git remote prune`.
- Видалені remote: chore/ci-test-gate, claude/funny-gates, claude/inspiring-gauss, claude/wizardly-dirac,
  docs/divorce-with-children-spec, docs/session-32-wrapup, docs/session-47-wrap, fix/rada-403-user-agent.
- Прочитано вміст brief'а (`git show`) — рішення Сергія: лишити локально, нічого не мержити.

### 🔴 Наступний крок
- **#84 G1** (реєстр блоків, код-SSoT) — свіжий чат. ТЗ: `specs/features/document-layout-preview/`. Модель: Opus
  (Tier 2). Перед UI-групами (G4) можливо знадобиться brief адмінки (гілка про запас).

---
## 🆕 Session 57 (2026-06-30) — MERGE preview-module → main + повний e2e UX-verify + чистка

### Головне — стан ЗАРАЗ
- **preview-module ЗАВЕРШЕНА:** merge `feat/preview-module → main` (`032981e` `--no-ff`, Closes #83), гілка
  видалена, дрейф form-submit усунено (`--check` = `✓ in sync`). Changelog s57 на main (`b1888ec`). issue #83 закрито.
- **Повний e2e верифіковано наживо** (Docker n8n + ngrok up, 4 active workflows). Тести перед merge: n8n+scripts
  1104 ✅, UI 284 ✅, tsc clean. main чистий + запушено.

### Що зроблено
1. **Merge + push:** 17 комітів гілки в main, issue #83 закрито з фінальним коментарем, гілка видалена.
   Дрейф підтверджено усунутим (committed form-submit == live n8n).
2. **E2e backend** `test-preview-pay.mjs` — **12/12**: not-ready→422 (paid не флипається), wrong-owner→422,
   happy→200 + signed_url (24год) качає 68KB PDF, re-mint ідемпотентний (paid_at незмінний).
3. **UX-контент verify** (ручний прогін divorce з реальними ключами полів через `sampleAnswers.ts`):
   витяг = шапка+сторони+завязка, **0 leak** (нема ПРОШУ/цитат статей/дір `________`), склонення коректне;
   фінальний PDF повністю заповнений, усі відмінки вірні; **opt-in бот-доставка** (`deliver_to_bot=true`) →
   `Send PDF` message_id 443, імʼя «Позовна заява.pdf».
4. **Візуальний UX PreviewPage** (DOM-верифікація в реальному браузері, prod-build): A4 440px/serif/justify,
   watermark «ЗРАЗОК» −45°/5%, blur-fade + lock-текст, opt-in toggle default-OFF→клік вмикає, GDPR-тултип
   present, «Сплатити» #2563EB. ⚠️ Пиксельний скриншот НЕ вийшов — розширення Chrome не досягає `document_idle`
   на localhost (dev+prod, свіжа вкладка, window.stop() — баг окружения, не апки). Verify через DOM/JS.
5. **Чистка тест-сміття:** 13 PDF з Storage `generated-documents/cases/` видалено через API (бакет порожній);
   тестові `cases` (identity 236581343) видалив Сергій через SQL Editor (DELETE спрацював — `protect_delete`
   НЕ на cases). Telegram-повідомлення з PDF — лишаються (не відкликаються).

### 🪤 Уроки сесії
- **`protect_delete` тригер — лише на `storage.objects`, НЕ на `cases`.** Тестові cases видаляються звичайним
  SQL DELETE під service-role. Старі заметки були помилкові (виправлено в «Теплих фактах» + memory).
- **Тест-харнес з вигаданими ключами полів** дав хибну тривогу (`________` замість імен) → НЕ баг продукту.
  SSoT для форм-ключів = `apps/client/src/admin/lib/sampleAnswers.ts`. «claim ≠ fact» спрацював.
- **Chrome-розширення не скриншотить localhost** (`document_idle` не настає) → для візуального verify юзати
  `javascript_tool` (DOM/computed-styles) замість screenshot, або відкрити URL вручну.

### 🔴 Наступний крок (нова сесія, вибір Сергія)
- Реальний платіж (Telegram Payments замість заглушки) — найлогічніше · розчистка stale-issues · git-worktree демо · #77 типографіка.

---
## 🆕 Session 56 (2026-06-30) — preview-module G4+G5+G6+G3b: ВСЯ ФІЧА LIVE (наскрізний потік працює)

### Головне — стан ЗАРАЗ
- **Уся preview-module фіча жива й верифікована** (деталі — блок «📌 Стан зараз» вгорі). Гілка
  `feat/preview-module` (НЕ змержено). Тести: n8n+scripts **1104 ✅**, UI **284 ✅**, tsc clean.
- 🔴 Головне рішення наступної сесії: **merge у main** (усуває main↔live дрейф form-submit.json).

### Що зроблено (усе верифіковано наживо)
1. **G4 preview-pay** (новий workflow `snm45SKeVo5X2AqU`, 16 нод, 0-cred): Webhook→Verify initData→**Get
   Identity** (telegram→profile UUID)→Get Case→Assert(owner+ready)→Set Paid→Mint Signed URL(24год)→Send to
   bot?→Respond. Live smoke **12/12**: not-ready→422 (paid=false), wrong-owner→422, happy→200+signed_url качає
   68KB PDF, re-mint→paid_at незмінний.
2. **G5 TWA**: `PreviewPage.tsx` (A4-витяг+blur+ЗРАЗОК watermark, state-machine preview→paying(авто-ретрай
   not_ready)→paid→download/error) + `lib/previewPay.ts` (10 тестів) + вшивка в App.tsx (case_id+excerpt з
   webhook-відповіді, БЕЗ Supabase-polling — узгоджено з s54). **+ opt-in toggle «Надіслати у Telegram» + GDPR-тултип.**
3. **Дружнє імʼя файлу**: 🪤 Telegram ІГНОРУЄ Content-Disposition по URL → preview-pay тепер завантажує PDF
   бінарником (Download PDF) + multipart (Send PDF) → «Позовна заява.pdf» (verified message_id 437).
4. **Бот-повідомлення** form-submit: «📝 Формую документ…» (зависало) → «✅ Заявку прийнято! … у застосунку».
5. **G3b rate-limit**: гейт на Has Profile?=true — count(cases per profile/24год) ≥ PREVIEW_RATE_LIMIT(20) →
   429, case не вставляється. Fail-open. Live: під лімітом(12<20)→200, над(forced 2,13)→429, count лишився 13.
6. **G6 докі**: DECISIONS (вже s54), IMPROVEMENTS #77 Gotenberg (вже), roadmap v3.2 +shipped-нотатка.

### 🪤 Уроки сесії
- **IDE знову зробив `checkout main`** посеред роботи → файли «зникли», form-submit виглядав «застарілим»
  (читав версію main). Спіймав через `git branch --show-current`, повернувся, коміти цілі. ЗВІРЯТИ ГІЛКУ.
- `cases.user_id` = **profile UUID**, не telegram id (резолв через `identities`). Старий теплий факт був оманливий — виправлено.
- Telegram sendDocument по URL ігнорує Content-Disposition → для імені файлу потрібен бінарний multipart.

### 🔴 Наступний крок
- **Merge feat/preview-module → main** (рекомендовано, усуває дрейф). Потім: реальний платіж / stale-issues / worktree-демо.

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
