# Legal AI — AI Harness: поточний стан + роадмап
> Локальний файл, не комітити. Останнє оновлення: 2026-06-17 (session 28)

---

## 0. Стек — вид зверху

```
                    ┌──────────────┐
    Telegram Bot ←→ │   n8n        │ ←→ Supabase (PostgreSQL + pgvector)
                    │  form-submit │       ├─ services (form_config, template)
    Vercel TWA ──→  │  37 нодів    │       ├─ cases (AES-256 encrypted)
                    │  localhost   │       ├─ law_relations (граф норм)
                    │  → VPS soon  │       └─ law_change_log (аудит)
                    └──────┬───────┘
                           │
              ┌────────────┼─────────────────┐
              ▼            ▼                  ▼
         Google Docs     Groq API      GitHub Actions
         (Copy+Style)   (L3 reason.    CRON law-monitor
                         + declension) → zakon.rada.gov.ua
```

Дивись #32 в IMPROVEMENTS для повної архітектурної діаграми.

---

## 1. n8n flow — ключові кроки (з 37 нодів)

```
Telegram Bot / Vercel TWA
        │ POST /webhook/form-submit
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n  form-submit  (localhost:5678 → ngrok → VPS soon)              │
│                                                                     │
│  ── Валідація + охорона ─────────────────────────────────────────── │
│  Validate Input                                                     │
│  Check Service Status ─── status ≠ active → 503 Respond Unavailable │
│  Get Service (Supabase)                                             │
│  Check Profile ─────────── no profile → 422 Respond No Profile     │
│                                                                     │
│  ── Запис кейсу + склонення ─────────────────────────────────────── │
│  Insert Case (AES-256 encrypt PII)                                  │
│  AI Declension (Groq → ПІБ у родовому відмінку)                   │
│                                                                     │
│  ── Dispatch по generation_mode ─────────────────────────────────── │
│  Is Hybrid? ─── NO ──────────────→ Build Document                  │
│      │                               ├─ template → DSL engine       │
│     YES (alimony-change ⏳ disabled) └─ js → legacy builders ①     │
│      │                                                              │
│  L2 Get Norms (law_relations, Supabase)                            │
│  Prepare Reasoning (→ Groq JSON body)                              │
│  L3 Reasoning (Groq llama-3.3-70b)                                 │
│  L4 Critics (groundedness.js)                                      │
│      │                                                              │
│      ├─ has_red=true  → ai.reasoning='' (ABSTAIN)                  │
│      │                   Build Document: template path ②            │
│      └─ has_red=false → ai.reasoning=<text>                        │
│                          Build Document: hybrid path                │
│                                                                     │
│  ── Google Docs ─────────────────────────────────────────────────── │
│  Copy Template                                                      │
│  Replace Placeholders                                               │
│  Get Document (отримати docBody для styleHints)                    │
│  Build Typography Request (apply-typography.js)                    │
│  Apply Typography (Google Docs batchUpdate)                        │
│  Share Document (anyone/reader — 🔴 #57 до першого клієнта!)      │
│  Send Doc Link (Telegram → юзер)                                   │
│  [Send Review Card (Telegram → Ольга) — тільки hybrid]            │
│                                                                     │
│  ✦ Error Trigger (глобальний catch для всього workflow)            │
│    → Format Error → Send Admin Alert (Telegram адміну)             │
└─────────────────────────────────────────────────────────────────────┘
```

① Legacy JS-builders (`buildDivorceDocument`, `buildAlimonyDocument`) живуть всередині Build Document
  як fallback. Технічний борг #52 — винести їх, але не критично поки обидві послуги на template.

② При ABSTAIN шаблон рендерить fallback-параграф (рядки 90–92 `alimony-change.document.txt`):
  generic абзац про ст.182–184 СК — юзер отримує коректний документ, а review card сигналізує
  Ользі що AI утримався.

---

## 2. AI Harness — шари (тільки для hybrid послуг)

```
┌────────┬───────────────────────────────────────────────────────────────┐
│  L0    │ Сирі відповіді форми (answers JSON)                           │
├────────┼───────────────────────────────────────────────────────────────┤
│  L0.5  │ Routing: route() → PROCEED | ABSTAIN_EXTRAORDINARY |          │
│        │ ABSTAIN_INDEXATION  (поки завжди PROCEED — pending Ольга)    │
├────────┼───────────────────────────────────────────────────────────────┤
│  L1    │ Детермінований скелет → DSL шаблон                           │
│        │ суд. збір, сторони, ПРОШУ, Додатки — все жорстко             │
│        │ ← ЗАВЖДИ виконується; при ABSTAIN = фінальний документ       │
├────────┼───────────────────────────────────────────────────────────────┤
│  L2    │ Граф норм (law_relations): ст.192 СК →                       │
│        │ {182, 183, 184 СК; ст.4/5 ЗСЗ; ст.27/28/176 ЦПК}          │
│        │ Supabase query → L2_ARTICLE_IDS                              │
├────────┼───────────────────────────────────────────────────────────────┤
│  L3    │ Groq JSON-mode reasoning (GROQ_MODEL з Global Config)        │
│        │ cite only L2_ARTICLE_IDS; 100-200 words; Ukrainian prose      │
├────────┼───────────────────────────────────────────────────────────────┤
│  L4a   │ ✅ ACTIVE — Groundedness critic (без LLM):                   │
│        │ citations ∈ L2? amounts/fractions/dates/names ∈ L0?          │
│        │ → RED/AMBER spans + has_red flag                             │
├────────┼───────────────────────────────────────────────────────────────┤
│  L4b   │ ⚠️ STUB — prompt готовий, нода НЕ в workflow (#69)          │
│        │ per-sentence GREEN/AMBER/RED LLM critic                      │
│        │ Не бере участі в pipeline до явного підключення              │
├────────┼───────────────────────────────────────────────────────────────┤
│  L4c   │ Abstention gate:                                             │
│        │ has_red=true  → ai.reasoning='' → L1 fallback paragraph      │
│        │ has_red=false → ai.reasoning=<text> → вставляється в шаблон │
├────────┼───────────────────────────────────────────────────────────────┤
│  L5    │ Review card → Telegram (Ольга):                              │
│        │ route / direction / court_fee / norms_used /                 │
│        │ spans[{text, status, issue}] / questions_for_lawyer /        │
│        │ abstained: true|false                                        │
└────────┴───────────────────────────────────────────────────────────────┘

ABSTAIN path детально:
  L3 output → L4a critic → has_red=true
      → ai.reasoning='' → Build Document (hybrid)
      → {{#if ai.reasoning}} ПУСТО {{else}} [generic paragraph] {{/if}}
      → юзер отримує документ з детермінованим текстом (не порожнім!)
      → review card: abstained=true, questions_for_lawyer=[...]
      → Ольга бачить в Telegram що AI утримався + чому
```

---

## 3. Поточний стан послуг

```
┌──────────────────┬──────────────┬────────────────────┬──────────────────────────────────┐
│  Послуга         │  Mode        │  Статус            │  Що генерує                      │
├──────────────────┼──────────────┼────────────────────┼──────────────────────────────────┤
│  divorce         │  template ✅ │  ACTIVE — live     │  Позовна заява про розлучення    │
│                  │  (+ legacy①) │                    │                                  │
│  alimony         │  template ✅ │  ACTIVE — live     │  Позовна заява про аліменти      │
│                  │  (+ legacy①) │                    │                                  │
│  alimony-change  │  hybrid  ✅  │  DISABLED ⏳ Ольга │  Позовна заява + AI обґрунт. L3  │
│  military        │  —           │  DISABLED          │  placeholder (без шаблону)       │
│  business        │  —           │  DISABLED          │  placeholder (без шаблону)       │
└──────────────────┴──────────────┴────────────────────┴──────────────────────────────────┘
① legacy JS-builders всередині Build Document (борг #52) — не заважають, але займають місце
```

---

## 4. Law Lifecycle (автоматизований)

```
zakon.rada.gov.ua
       │
       │ GitHub Actions CRON (пн 06:00 UTC)
       │ ⚠️  ВИМКНЕНО — schedule: закоментований
       │     розкомент. коли Ольга повернеться ~2026-06-25
       │
       │ 🔴 ЗАРАЗ У ЧЕРЗІ: 2 зміни вже виявлено dry-run'ом,
       │    але НЕ застосовано (чекають Ольги):
       │    • СК    2026-03-04 → 2026-05-25
       │    • ЦПК   2025-07-17 → 2026-04-24
       ▼
check-law-updates.mjs
  - дедуп спільних законів (СК фетчиться 1 раз на divorce+alimony)
  - fetchWithRetry (backoff + jitter + Retry-After)
  - detect: revision_date changed?
       │
       ▼
applyLawChange() [lib/law-change.mjs]
  - INSERT law_change_log (detected_by='cron')
  - UPDATE services SET status='needs_review'
    WHERE url IN watched_laws (зворотний індекс по URL, не slug!)
       │
       ▼
LawChangeLogPage (Admin Panel — Ольга)
  - список змін (нові зверху) + фільтр «тільки очікують»
  - дії: Переглянуто / Відхилити / Повернути
       │
       ▼
services повертаються до active
```

---

## 5. Завдання — з залежностями

### ⏳ Чекаємо Ольгу (~2026-06-25)

```
1. Розкоментувати schedule: у .github/workflows/law-monitor.yml (2 рядки)
2. Вирішити 2 зміни законів у черзі (СК/ЦПК — чи зачіпають ст.180-184, 175?)
3. Sign-off exception_if edges у law_relations
   (verified_by='auto' → email юриста на ст.192→{ст.4/5 ЗСЗ,ст.28/27 ЦПК})
4. Флип alimony-change: status='disabled' → 'active'
5. Перевірити якість форматування в реальному Google Doc (після typography)
```

### 🟢 Можна робити зараз (без Ольги)

```
Пріоритет   Задача                                    Блокує / Залежить від
──────────────────────────────────────────────────────────────────────────────
🔴          VPS deploy (Hetzner CX22)                 Розблоковує: зняти ngrok
            Docker + nginx + SSL → n8n.domain.com     (prod більше не залежить
            Додати GROQ_API_KEY в .env.local + VPS    від ноуту)

🔴          Security: #57 Google Doc PII              Потрібно ДО першого
            private delivery замість anyone/reader    реального клієнта

🔴          Security: #58 Webhook HMAC initData       Потрібно ДО першого
            прибрати ?uid= спуфінг                    реального клієнта

🟡          #74 E2e integration тест hybrid           Потрібно ДО flip
            hybrid-pipeline-integration.test.js       alimony-change → active

🟠          #69 L4b LLM critic — підключити в n8n    Бажано ДО flip (повний
            prompt alimony-change-critic.txt готовий  харнесс)

🟡          #73 Моніторинг abstention rate            Після flip + 10-20 кейсів
            колонка cases.abstained + дашборд

🟡          #70 Google Docs коментарі RED/AMBER       Після flip + без Ольги
            batchUpdate → підсвітка в документі       немає сенсу (#70)

🟡          #40 G2 Code node fallback                 Після перших реальних
            GROQ_MODEL_FALLBACK wiring                запитів
```

### 🔮 Горизонт v2 (після перших реальних клієнтів)

```
GraphRAG expansion
  - law_chunks (чанк=стаття) для divorce/alimony
  - embeddings → pgvector retrieval
  - Розширення на інші послуги (сімейний кластер = 3 закони)

Нові послуги
  - Tier 2: розлучення з дітьми
  - Tier 3/тріаж: військові спори (потрібен юрист-партнер!)

Security решта (#59 rate-limit, #60 LLM sanitize, #64 GDPR CRON)

Multi-template (#72) — кілька шаблонів на послугу

Admin UX: #51 template editor для Ольги + 2-tier ролі
```

---

## 6. Де що живе (ключові файли)

```
── Workflow ──────────────────────────────────────────────────────────
n8n/workflows/current/form-submit.json       єдиний активний workflow (37 нодів)

── AI Harness (L2–L4) ───────────────────────────────────────────────
n8n/templates/prepare-reasoning.js           L2+answers → Groq body
n8n/templates/groundedness.js               L4a critic (no LLM)
n8n/templates/build-hybrid-context.js       L4c abstention + review-card
n8n/prompts/alimony-change-reasoning.txt    L3 prompt (Groq JSON-mode)
n8n/prompts/alimony-change-critic.txt       L4b LLM critic ⚠️ STUB

── Doc Engine (L1) ───────────────────────────────────────────────────
n8n/templates/render-document.js            DSL engine (без eval)
n8n/templates/apply-typography.js           styleHints → Google Docs batchUpdate
n8n/templates/services/*.document.txt       DSL шаблони (SSoT у git)

── Синхронізатори (анти-дрейф) ──────────────────────────────────────
scripts/sync-build-document-node.mjs        генерує Build Document ноду
scripts/sync-hybrid-nodes.mjs              генерує 6 hybrid нодів
scripts/sync-typography-nodes.mjs          генерує 3 typography нодів

── Law Lifecycle ─────────────────────────────────────────────────────
scripts/check-law-updates.mjs              CRON детектор (⚠️ schedule вимкнено)
scripts/lib/law-change.mjs                 канонічний applyLawChange
scripts/service-lifecycle.mjs              CLI: set-status / log-law-change
scripts/seed-alimony-change-laws.mjs       16 статей + 8 edges у law_relations

── Supabase DB (ключові міграції) ───────────────────────────────────
011_service_lifecycle.sql                  status kill-switch + law_change_log
014_doc_engine.sql                         generation_mode + document_template
017_law_relations.sql                      граф норм (law_relations)

── Admin UI ──────────────────────────────────────────────────────────
apps/client/src/admin/pages/LawChangeLogPage.tsx  панель ревʼю Ольги
apps/client/src/admin/pages/DashboardPage.tsx     список послуг + status дії

── CI ────────────────────────────────────────────────────────────────
.github/workflows/law-monitor.yml          CRON (schedule: ⚠️ закоментований)
scripts/deploy-workflow.mjs                деплой n8n (inject keys + creds)
```

---

## 7. Тести

```
928 vitest тестів ✅ (root: n8n templates + scripts)
 92 vitest тестів ✅ (apps/client: React + lib)
tsc -b clean ✅

Ключові файли:
  render-document.test.js               56    DSL engine + style hints
  apply-typography.test.js              16    batchUpdate requests
  alimony-template-parity.test.js      117    байт-у-байт vs legacy builder
  divorce-template-parity.test.js      263    байт-у-байт vs legacy builder
  alimony-change-template-parity.test  132    96 matrix + 29 branch + 3 golden
  prepare-reasoning.test.js             20    L2+answers → Groq body
  build-hybrid-context.test.js          40    abstention + court fee + questions
  groundedness.test.js                  16    L4a critic spans
  citations-drift.test.js               —    страж golden ↔ template (anti-drift)

Де пробіли (сліпі плями):
  ✗ Немає integration тесту для повного hybrid ланцюжка    ← #74
  ✗ Немає тесту для law-monitor CRON (mock zakon.rada)
  ✗ Немає тесту для deploy-workflow.mjs (sync скриптів)
  ✗ Немає e2e з реальним Groq (лише 1 ручний smoke test, session 25)
  ✗ abstention rate не вимірюється взагалі               ← #73
```
