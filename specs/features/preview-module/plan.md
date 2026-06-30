# preview-module — Plan

> Як будуємо. Контракт — `requirements.md`. Перевірка — `validation.md`.
> Архітектурні «чому» зафіксовані в `DECISIONS.md` → «Превью-модуль…» (читати перед стартом).

---

## Поточна база (verified session 53/54)

- **form-submit** (n8n `D2ab06X3pVUWk1py`, 48 нод): Webhook → Validate → Get Service → Encrypt →
  Insert Case → AI Declension → **Build Document** (doc-engine текст) → Copy Template → Replace →
  Apply Typography → **Export PDF** (Google Drive `files.export`) → **Send PDF** (Telegram) →
  Export DOCX → Send DOCX → **Delete Doc** (PII). Деплой: `node scripts/deploy-workflow.mjs form-submit`.
- **initData HMAC fail-closed** уже в form-submit (#56) — реюзаємо код у preview-pay.
- **TWA** (React/Vite, `apps/client/`) сабмітить форму на form-submit webhook; зараз закривається,
  результат у бот-чат. Читає Supabase для form_config.
- Рендер PDF — Google Docs/Drive (тимчасовий; стратегічний #77 = docx+Gotenberg, ще не стоїть).

## Групи задач (G1…G6)

### G1 — Міграція + Storage
- `supabase/migrations/0NN_preview_module.sql`: поля `cases` (status/paid/paid_at/preview_excerpt/
  doc_storage_path/preview_meta) + приватний bucket `generated-documents` + RLS (клієнт читає власні,
  пише лише service-role).
- Перевірити наявні RLS `cases` — не дати `authenticated`/anon виставити `paid`/`status`.
- Apply: `supabase db push` (узгодити нумерацію — наступний вільний 3-значний префікс).

### G2 — Безпечний витяг (pure-функція, #86-критична)
- `n8n/templates/preview-excerpt.js` (новий) — `deriveExcerpt(fullDocText, serviceSlug)`:
  детермінований split тексту doc-engine до маркера правового обґрунтування / «ПРОШУ»; повертає
  шапку+сторони+1 абзац обставин. **Гарантія:** результат НЕ містить «ПРОШУ», нумерованих вимог,
  цитат статей. Тести в `n8n/templates/__tests__/preview-excerpt.test.js` (+негативні: жоден сценарій
  не протікає ПРОШУ/цитатою).
- Інлайнити у Build Document ноду тим самим `sync-*`-патерном (анти-дрейф), якщо потрібно в workflow.

### G3 — form-submit: rate-limit + Storage upload + status
- **Validate нода:** rate-limit — `count(cases) WHERE profile_id=? AND created_at>now()-24h ≥
  PREVIEW_RATE_LIMIT` → reject (зрозуміле повідомлення). Конфіг ліміту в ноді.
- Після Export PDF: **Upload до приватного Storage** (Supabase Storage REST, service-role) →
  `doc_storage_path`. (DOCX — за A5: лишити бот-файлом після оплати.)
- **Derive excerpt** із Build-Document-тексту (G2) → `preview_excerpt`.
- **UPDATE case:** `status='preview_ready'`, `preview_excerpt`, `doc_storage_path`, `preview_meta`.
- **Зняти** пряму бот-доставку PDF/DOCX ДО оплати (Send PDF/Send DOCX → перенести в preview-pay або
  лишити вимкненими). Webhook-відповідь повертає `{ case_id }` для TWA-polling.
- Деплой: `deploy-workflow.mjs form-submit` + backup (як завжди).

### G4 — НОВИЙ workflow `preview-pay`

> **Locked на інтервʼю session 55** (medium-depth). Рішення A1-A5 + edge — у `requirements.md §5`.
> Скоуп цієї сесії: **лише PDF**, бот-доставка default-OFF (GDPR), повний цикл до live-smoke.

- `n8n/workflows/current/preview-pay.json` (генерувати/деплоїти патерном `deploy-workflow.mjs`,
  `--create` для першого POST, потім id у `deploy-workflow.mjs` target-мапу як law-change-digest).
- Ноди: Webhook → **Verify initData** (реюз HMAC-логіки #56 з form-submit) → Get Case (Supabase) →
  **Assert owner** (telegram_id == case.telegram_id) → **Assert ready**: `status ∈ {preview_ready, paid}`
  І `doc_storage_path` НЕ null; інакше **відмова 4xx + `{error}`** (НЕ флінати `paid`!) →
  **Set Paid** (UPDATE `paid=true, paid_at, status='paid'`) → **Mint Signed URL** (Storage
  `createSignedUrl` на `cases/{id}.pdf`, service-role, **TTL=24год**) → **(опц.) Send PDF у бот —
  ТІЛЬКИ якщо request-параметр згоди `true`** (default off, GDPR) → Respond `{signed_url, expires_at}`.
- Self-contained: 0 n8n-credentials, секрети через Global Config-expression (як form-submit/digest).
  Bot token (для опц. доставки) = `Global Config.TELEGRAM_BOT_TOKEN`.
- **Ідемпотентність:** повторний виклик на `paid` case → re-mint URL (status вже `paid` проходить assert),
  не подвійний флип/платіж.
- **Анти-abuse:** окремого rate-limit на preview-pay НЕ додаємо — initData HMAC + upstream form-submit
  rate-limit обмежують потік до оплати.
- **Verify (повний цикл, як form-submit):** guard-тести (sync/secrets/connections/assert-not-ready/
  idempotent-remint/bot-default-off) + deploy `--create` у живий n8n + **реальний webhook-smoke**:
  (1) pay на `preview_ready` → `paid=true` + валідний signed URL, що качає PDF; (2) повторний pay →
  re-mint без 2-го флипу; (3) pay на `generating`/без doc → 4xx, `paid` лишається false.
  ⚠️ Потрібні підняті Docker n8n + ngrok.

### G5 — TWA (React)
- Після сабміту: НЕ закривати; перейти у стан `generating`. Зберегти `case_id` з webhook-відповіді.
- **Polling:** Supabase-клієнт читає власний case (RLS) кожні ~2с до `status ∈ {preview_ready, failed}`
  (timeout-захист + «failed» UI). Реюз наявного Supabase-клієнта TWA.
- **`PreviewPage`** (`apps/client/src/...`): контейнер у пропорціях A4 (serif, justify, поля) рендерить
  `preview_excerpt` як «сторінку документа»; CSS-gradient blur унизу + watermark-оверлей (вітрина).
  Кнопка «Оплатити» (заглушка-ціна, cosmetic).
- **Оплата:** POST `{case_id, initData}` на preview-pay webhook → отримати `signed_url` → стан `paid`
  → кнопка «Завантажити документ» (відкрити URL). Обробити помилки/expired.
- Стилі — наявна «Legal Light» тема; A4-верстка не ламає мобільний TWA-layout.

### G6 — Документація + production-шлях
- `DECISIONS.md` — вже записано (session 54).
- IMPROVEMENTS `#77`: дописати **production image-превʼю через Gotenberg `/screenshot`** при міграції
  рендеру (поточний HTML-витяг лишається fallback/мобільний; image — для «фото якості»).
- `changelog.md` + `session-summary.md` (кінець сесії).
- roadmap v3.2 — відмітити превʼю-частину #77.

## Послідовність / ризик
- G1→G2→G3 (бекенд-ядро, найризиковіше — реструктуризація живого form-submit) → G4 (новий, ізольований)
  → G5 (UI) → G6 (докі). G2 (екстрактор) — окремо тестується першим (детермінований, #86-критичний).
- **Гілка:** `feat/preview-module` (вже створена session 54). Деплой form-submit — лише після зелених
  parity/excerpt-тестів + backup; live-smoke обовʼязковий (як кожна form-submit-зміна).

## Шви для майбутнього (тримати чистими)
- **Реальний платіж:** замінити заглушку-крок у preview-pay на Telegram-Payments-вузол; контракт
  «paid → mint URL» незмінний.
- **Generate-after-pay** (анти-abuse fallback): якщо спам полізе — рознести генерацію на пост-оплатний
  прохід; `doc_storage_path` стає nullable до оплати, mint тригерить генерацію.
- **Image-превʼю:** при Gotenberg-міграції — `preview_excerpt` доповнюється/замінюється image-path.
