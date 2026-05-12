# Legal AI — Master Context Document
> Updated: 2026-05-12 (session 9 end)
> Прочитай эту секцию первой — она самая свежая.

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
