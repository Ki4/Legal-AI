# Legal AI — Architecture

> Документ для швидкого онбордингу: нового розробника, партнера або нової сесії Claude.
> Оновлювати при зміні стеку або ключових рішень.

---

## Що це за продукт

**Legal AI** — Telegram Mini App (TWA) для автоматичної генерації юридичних документів.

Користувач відкриває бота → обирає послугу (розлучення, аліменти, військові спори...) →
заповнює форму → отримує готовий документ у Google Docs за посиланням у Telegram.

Паралельно існує **адмін-панель** для юристів: реєстрація, конструктор форми,
налаштування AI промпту, публікація послуги.

---

## Стек

| Шар | Інструмент | Роль |
|-----|-----------|------|
| UI / TWA | React 19 + Vite 7 + TypeScript | Telegram Mini App + Admin Panel |
| Стилі | TailwindCSS 3 + Framer Motion | UI, анімації |
| БД + Auth | Supabase (PostgreSQL) | Дані, авторизація юристів, вектори (pgvector) |
| Orchestration | n8n cloud | Workflow: форма → AI → Google Doc → Telegram |
| LLM | Groq (llama/mixtral) | Генерація тексту документу |
| Документи | Google Docs API + Drive | Формат і зберігання документів |
| Хостинг | Vercel | SPA деплой, автодеплой з GitHub |
| Месенджер | Telegram Bot API + @twa-dev/sdk | Доставка і інтерфейс |

---

## Data Flow — повний шлях

```
Telegram Bot
    │
    │  Inline кнопка з URL:
    │  https://legal-twa.vercel.app/?service=divorce&uid=123
    ▼
Telegram Mini App (TWA)
    │
    │  1. Читає ?service=divorce з URL
    │  2. GET supabase: services WHERE slug='divorce'
    │     → повертає form_config (JSON з полями і табами)
    │  3. DynamicLegalFormBuilder рендерить форму
    │  4. Юзер заповнює → Submit
    ▼
n8n Webhook (VITE_N8N_WEBHOOK_URL)
    │
    │  Payload: { service_slug, user_id, answers }
    │
    ├─► Supabase: INSERT cases (зберегти відповіді)
    │
    ├─► Groq: генерація тексту документу
    │     System prompt: services.ai_prompt (по service_slug)
    │     User prompt: відповіді з форми як JSON
    │
    ├─► Google Drive: скопіювати шаблон документу
    │     POST /drive/v3/files/{templateId}/copy
    │
    ├─► Google Docs: замінити {{DOCUMENT_CONTENT}}
    │     POST /docs/v1/documents/{docId}/batchUpdate
    │
    ├─► Google Drive: відкрити доступ (anyone with link)
    │
    └─► Telegram Bot: надіслати повідомлення з посиланням
```

---

## База даних (Supabase)

### Таблиці

```
auth.users          ← Supabase built-in auth
    │
    ├── lawyers     ← профіль юриста-партнера
    │     id (= auth.users.id)
    │     name, email, specialization
    │
    ├── profiles    ← профіль кінцевого юзера
    │     phone, full_name, data_retention_consent
    │
    └── identities  ← Supabase built-in

services            ← послуги (наші + від юристів)
    id (int4)
    slug            ← унікальний ідентифікатор ('divorce', 'alimony'...)
    title           ← назва для відображення
    form_config     ← JSONB, весь опис форми
    system_prompt   ← legacy (не використовується)
    ai_prompt       ← промпт юриста для генерації документу
    lawyer_id       ← FK → auth.users (NULL = наша послуга)
    status          ← kill-switch (active|needs_review|disabled). АВТОРИТЕТНИЙ: лише active обслуговується (migration 011)
    is_published    ← DEPRECATED (migration 012) — дзеркало (status='active'), serving-шлях не читає
    icon            ← emoji
    price           ← ціна в гривнях
    description
    created_at

cases               ← заявки від юзерів
    id (uuid)
    user_id         ← Telegram user ID
    service_id      ← FK → services
    status          ← 'pending' | 'done' | 'error'
    encrypted_data  ← відповіді форми (JSONB)
    expires_at, created_at, updated_at

courts              ← довідник судів
    id, name, region, address, iban, okpo

```

### form_config структура (JSONB)

```typescript
{
  service_id: string          // slug
  title: string
  tabs: [{ id, label }]       // вкладки форми
  steps: [FormField]          // всі поля (tab_id прив'язує до вкладки)
}

FormField: {
  id: string                  // унікальний ключ
  tab_id: string
  type: 'text' | 'textarea' | 'date' | 'boolean' | 'choice' | 'multicheck' | 'number' | 'phone'
  label: string
  placeholder?: string
  hint?: string               // підказка під полем
  explanation?: string        // розгорнуте юридичне пояснення (i кнопка)
  required?: boolean
  options?: [{ value, label }]
  show_if?: { field, operator: '==' | '!=', value }
}
```

---

## Структура репозиторію

```
legal-twa/
├── src/
│   ├── admin/                    ← Панель юриста (lazy-loaded)
│   │   ├── AdminApp.tsx          ← роутинг /admin/*
│   │   ├── hooks/useAuth.ts      ← Supabase auth
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx ← список послуг
│   │   │   └── ServiceEditPage.tsx ← редактор (form + AI + settings)
│   │   └── components/
│   │       ├── AdminLayout.tsx
│   │       └── FormBuilder.tsx   ← конструктор полів
│   │
│   ├── components/
│   │   ├── DynamicLegalFormBuilder.tsx  ← головний рушій форми
│   │   ├── SkeletonLoader.tsx
│   │   └── form/                 ← поля, прогрес-бар, лейбли
│   │
│   ├── data/                     ← form_config в TypeScript (для скрипту)
│   ├── lib/supabase.ts           ← Supabase client (null guard)
│   ├── types/form.ts             ← FormConfig, FormField, Answers
│   └── App.tsx                   ← TWA entry point
│
├── scripts/
│   └── update-form-configs.ts    ← заповнити services.form_config в Supabase
│
├── n8n-workflows/                ← JSON експорти n8n workflows
├── supabase-migrations.sql       ← SQL для нових таблиць/колонок
├── ARCHITECTURE.md               ← цей файл
├── DECISIONS.md                  ← чому той чи інший інструмент
└── IMPROVEMENTS.md               ← технічний борг і backlog
```

---

## Маршрутизація (Vercel)

```
legal-twa.vercel.app/            → App.tsx (TWA форма)
legal-twa.vercel.app/?service=X  → завантажує форму послуги X
legal-twa.vercel.app/admin/      → AdminApp (панель юриста)
legal-twa.vercel.app/admin/login → реєстрація / вхід
```

`vercel.json` перенаправляє всі шляхи на `index.html` (SPA routing).
`/admin/*` lazy-loaded — не потрапляє в TWA бандл.

---

## Environment Variables

### Vercel (production)
```
VITE_SUPABASE_URL        = https://nexkairsedqtczievxpa.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJ... (anon/public key)
VITE_N8N_WEBHOOK_URL     = https://...app.n8n.cloud/webhook/...
```

### Локальна розробка
```
legal-twa/.env.local     ← копія тих самих vars (не комітити)
```

### Скрипт update-form-configs
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=eyJ... (service_role key — тільки локально!)
```

---

## Де що налаштовано

| Що | Де |
|----|-----|
| n8n workflow | app.n8n.cloud → Legal AI Assistant |
| Google OAuth2 | Google Cloud Console → OAuth clients |
| Google Doc шаблон | Google Drive → папка "Legal AI Documents" |
| Supabase RLS | Supabase → Authentication → Policies |
| Telegram Bot | @BotFather → webhooks |
| Vercel env vars | Vercel → legal-twa → Settings → Environment Variables |
| GitHub repo | github.com/Ki4/legal-twa (branch: header/floating-tabs) |
