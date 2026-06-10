# Legal AI — Architectural Decisions

> Чому саме ці інструменти, а не альтернативи.
> Допомагає не повертатись до вже прийнятих рішень і пояснює контекст новим учасникам.

---

## 📇 Зміст

> Рішення йдуть у логічному порядку (стек → дані → AI → борг). Без номерів — це не беклог, а журнал «чому так».

- [n8n vs Custom Backend (Node.js/Python)](#n8n-vs-custom-backend-nodejspython)
- [Supabase vs Firebase vs PlanetScale](#supabase-vs-firebase-vs-planetscale)
- [Groq vs OpenAI vs Google Gemini (генерація документів)](#groq-vs-openai-vs-google-gemini-генерація-документів)
- [Google Docs vs PDF генерація vs DOCX](#google-docs-vs-pdf-генерація-vs-docx)
- [Gemini Embedding 2 vs OpenAI text-embedding-3 vs Titan V2 (для RAG)](#gemini-embedding-2-vs-openai-text-embedding-3-vs-titan-v2-для-rag)
- [Supabase pgvector vs AWS Bedrock Knowledgebase (зберігання векторів)](#supabase-pgvector-vs-aws-bedrock-knowledgebase-зберігання-векторів)
- [Один Vercel app (TWA + Admin) vs Окремі деплої](#один-vercel-app-twa-admin-vs-окремі-деплої)
- [Telegram TWA vs Web App vs Mobile App](#telegram-twa-vs-web-app-vs-mobile-app)
- [React vs Next.js vs SvelteKit](#react-vs-nextjs-vs-sveltekit)
- [AI Technical Debt — стратегія профілактики](#ai-technical-debt-стратегія-профілактики)
- [RAG vs GraphRAG vs Hybrid Template (генерація документів)](#rag-vs-graphrag-vs-hybrid-template-генерація-документів)
- [Service lifecycle: status kill-switch + ідентичність закону по URL](#service-lifecycle-status-kill-switch--ідентичність-закону-по-url)

---

## n8n vs Custom Backend (Node.js/Python)

**Обрали: n8n cloud**

| | n8n | Custom backend |
|--|-----|----------------|
| Час до першого workflow | Годинами | Дні/тижні |
| Зміна логіки | Drag & drop | Deploy нового коду |
| Моніторинг виконань | Вбудований UI | Потрібен окремий |
| Вартість | ~$20/міс | VPS ~$10 + час розробки |
| Обмеження | Менш гнучкий для складної логіки | Повна свобода |

**Висновок:** для MVP і команди без бекенд-розробника — n8n ідеальний. Складну логіку
(агент-критик, RAG пошук) можна додавати як HTTP Request вузли до зовнішніх сервісів.
При масштабуванні — можна перенести критичні вузли в Supabase Edge Functions.

---

## Supabase vs Firebase vs PlanetScale

**Обрали: Supabase**

**Причини:**
- **PostgreSQL** — SQL, JOIN-и, повноцінні транзакції (Firebase = NoSQL)
- **pgvector** — векторна БД для RAG вбудована, не потрібен окремий сервіс
- **Row Level Security** — безпека на рівні БД, не в коді
- **Auth вбудований** — реєстрація юристів без додаткового сервісу
- **Безкоштовний tier** — достатній для MVP
- **Supabase JS SDK** — простий клієнт для React

**Vs Firebase:** Firebase дешевший і простіший для realtime, але NoSQL ускладнює
складні запити і немає pgvector для RAG.
**Vs PlanetScale:** тільки MySQL, немає pgvector, немає auth.

---

## Groq vs OpenAI vs Google Gemini (генерація документів)

**Обрали: Groq**

| | Groq | OpenAI GPT-4 | Gemini Pro |
|--|------|-------------|-----------|
| Швидкість | ⚡ Найшвидший (LPU) | Середня | Середня |
| Ціна | Безкоштовно (до ліміту) | $10–30/1M tokens | $7/1M tokens |
| Якість (укр.) | Хороша | Відмінна | Відмінна |
| Ліміти безкоштовно | ~30 req/хв | Немає безкоштовно | $300 кредити |

**Висновок:** Groq дозволив запустити MVP без витрат. При зростанні кількості заявок —
перейти на Gemini Pro (краще розуміє українську, Google ecosystem).

**Майбутнє:** Можливо hybrid — Groq для простих послуг (швидко/дешево),
Gemini Pro для складних (якість).

---

## Google Docs vs PDF генерація vs DOCX

**Обрали: Google Docs**

**Причини:**
- Юрист може відредагувати документ перед підписом (PDF = read-only)
- Клієнт бачить документ в браузері без завантаження
- Google Drive зберігає версії автоматично
- Простий API для заміни тексту (batchUpdate)
- Безкоштовно (в межах Google Drive квоти)

**Vs PDF:** PDF виглядає більш "офіційно", але потрібна бібліотека (PDFKit, Puppeteer)
і клієнт не може редагувати. Планується як додатковий формат пізніше.
**Vs DOCX:** потрібно завантажувати файл, менш зручно на мобільному.

**Важливо:** Google Docs використовує **OAuth2** (не Service Account) — документи
зберігаються в Drive користувача, не в Service Account (у нього 0 байт сховища).

---

## Gemini Embedding 2 vs OpenAI text-embedding-3 vs Titan V2 (для RAG)

**Планується: Gemini Embedding 2**

| | Gemini Embedding 2 | OpenAI 3-large | AWS Titan V2 |
|--|-------------------|----------------|-------------|
| Укр. мова | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Контекст | 8192 токенів | 8191 токенів | 8192 токенів |
| Ціна | Безкоштовно (ліміт) | $0.13/1M tokens | Pay per use |
| Managed RAG | Ні | Ні | ✅ Bedrock KB |
| Інфраструктура | Google AI API | OpenAI API | AWS (складно) |

**Висновок:** Gemini Embedding 2 — найкраща якість для українських юридичних текстів,
безкоштовний на старті, не потребує нової інфраструктури.
AWS Bedrock Knowledgebase — managed і зручний, але потребує AWS акаунту, IAM,
S3 і гірше розуміє українську (Titan V2). Доцільний якщо є готова AWS інфраструктура.

---

## Supabase pgvector vs AWS Bedrock Knowledgebase (зберігання векторів)

**Обрали: Supabase pgvector (план)**

**Причини:**
- pgvector вже є в Supabase — нульова додаткова інфраструктура
- Один сервіс замість двох (Supabase + AWS)
- RLS на вектори — автоматично
- Потрібно написати chunking + embedding логіку самим (але це ~100 рядків коду)

**Vs Bedrock KB:** повністю managed (chunking, embedding, indexing автоматично),
але потребує AWS акаунту, IAM roles, S3 bucket, Lambda. Більший overhead для малої команди.

---

## Один Vercel app (TWA + Admin) vs Окремі деплої

**Обрали: один Vercel app**

**Структура:**
```
legal-twa.vercel.app/       → TWA (Telegram users)
legal-twa.vercel.app/admin/ → Admin Panel (lawyers)
```

**Причини:**
- Один деплой, одне місце для env vars
- Спільні TypeScript типи (FormConfig та ін.) без дублювання
- Admin lazy-loaded — не впливає на розмір TWA бандлу
- Простіше підтримувати на MVP стадії

**Коли розділяти:** коли адмін-панель стане суттєво важчою (drag & drop бібліотеки,
rich text editor, аналітика) або коли потрібні різні команди/права доступу до деплою.

---

## Telegram TWA vs Web App vs Mobile App

**Обрали: Telegram Mini App (TWA)**

**Причини:**
- Цільова аудиторія вже в Telegram — нульовий фрикшн (не треба завантажувати app)
- Telegram надає user_id автоматично — не потрібна реєстрація
- Push-повідомлення через бота безкоштовно
- TWA = звичайний React app — знайомий стек

**Обмеження:**
- Дизайн обмежений мобільним viewport
- Немає доступу до файлової системи (для майбутнього підпису документів)
- Залежність від Telegram платформи

---

## React vs Next.js vs SvelteKit

**Обрали: React + Vite (SPA)**

**Причини:**
- TWA не потребує SSR — всі дані завантажуються клієнтом після відкриття
- Vite 7 — найшвидший dev server і build
- Простіше ніж Next.js для такого типу додатку
- Менша кількість абстракцій = легше підтримувати

**Vs Next.js:** SSR/SSG не дає переваг для TWA (Telegram iframe не індексується Google).
Edge Functions в Next.js можна замінити Supabase Edge Functions при потребі.

---

## AI Technical Debt — стратегія профілактики

**Рішення прийнято:** впроваджувати захист від чотирьох видів AI-боргу з першої ж реальної послуги.

### Prompt Debt → версіонування промптів
**Правило:** кожен промпт має версію. При зміні — нова версія, стара не видаляється.
```
n8n/prompts/divorce_v1.md   ← архів
n8n/prompts/divorce_v2.md   ← поточний
services.prompt_version = 'v2'
cases.prompt_version        ← записується при генерації
```
**Чому:** якщо документ виявився неправильним — знаємо яким промптом він був згенерований.

### Model Debt → конфіг-нода в n8n
**Правило:** назви моделей тільки в одному місці — `00_config` нода на початку workflow.
```javascript
// 00_config (перша нода в кожному workflow)
return [{ json: {
  model_generation: 'llama-3.3-70b-versatile',
  model_fallback:   'mixtral-8x7b-32768',
  model_embedding:  'gemini-embedding-001',
}}]
```
**Чому:** міграція на нову модель = зміна в одному місці, не в 10 нодах.

### Retrieval Debt → моніторинг актуальності законів
**Правило:** `law_chunks` має поле `is_outdated`. CRON в n8n перевіряє `watched_laws` щотижня.
При зміні закону → алерт адміну → переіндексація → `is_outdated = false`.
**Чому:** юридичний документ зі старою нормою = відповідальність продукту.

### Control Debt → якість як метрика
**Правило:** кожен згенерований документ має `quality_score` (👍/👎 від користувача) і `generation_ms`.
Дашборд в адмін-панелі показує тренд якості по кожній послузі.
**Чому:** без метрики деградація якості непомітна до першої скарги.

---

## RAG vs GraphRAG vs Hybrid Template (генерація документів)

**Обрали: Hybrid Template (поточний MVP). RAG — Tier 2. GraphRAG — не потрібен.**

### Чому НЕ GraphRAG

GraphRAG (Microsoft) — для великих корпусів з перехресними посиланнями:
закон A відміняє статтю в законі B, який посилається на закон C.
Для 2-3 послуг і 5 законів це надлишок. Додає:
- Entity extraction pipeline
- Relationship graph побудова
- Community detection
- Local vs global query routing

Виправданий коли: каталог 50+ послуг, сотні законів з перехресними посиланнями.

### Чому НЕ повний RAG на MVP

RAG потрібен коли AI має "придумати" контент із корпусу знань.
В нашому випадку форма вже збирає всі необхідні дані детерміновано.
Додавати RAG для заповнення шаблону — це як використовувати пошук щоб знайти
те, що вже лежить у тебе в руці.

**Ризик повного AI-генерації для юридичних документів:**
- Галюцинації в датах, ІПН, адресах → неприйнятно для судових документів
- AI не "знає" актуальні реквізити судів
- Перевірити точність складніше ніж перевірити шаблон

### Поточна архітектура (правильна)

```
Форма (детерміновано) → n8n → Groq (~200 токенів, тільки відміна ФИО)
                                    ↓
                             JS-шаблон (95% документу, нуль галюцинацій)
                                    ↓
                              Google Docs
```

Видалено з v6: RAG-пошук по `law_chunks` (закоментовано в Global Config:
"GEMINI_API_KEY видалено — RAG не потрібен для hybrid підходу").

### Коли додавати RAG (Tier 2)

- Користувач питає "чому в заявлені така формулювання?" → цитата статті
- Розділ "обґрунтування" генерується з контексту конкретної ситуації
- Агент-критик перевіряє документ проти актуальних редакцій законів

**Правило**: RAG — коли треба пояснити або збагатити. Не для генерації основного тексту.

| Рівень | Підхід | Коли |
|--------|--------|------|
| MVP (зараз) | Hybrid template | 2 послуги, якість = #1 |
| Tier 2 | RAG для пояснень | 5+ послуг, є юрист-ревʼюер |
| Tier 3 | GraphRAG | 50+ послуг, складні перехресні закони |

---

## Service lifecycle: status kill-switch + ідентичність закону по URL

**Обрали:** колонка-`status` як авторитетний kill-switch; `needs_review` блокує як `disabled`;
зв'язки «закон↔послуга» лишаються в `services.watched_laws` (JSONB), ідентичність закону = **URL**.
(Фіча `service-lifecycle`, міграція 011 + G4-інструменти.)

### `status` як kill-switch (флип колонки, не деплой)

Послуга = керований юніт зі станом `active | needs_review | disabled`. **Тільки `active`
обслуговується.** Зняти послугу з продажу — це `UPDATE` одної колонки, без редеплою n8n/Vercel.

**Чому колонка, а не видалення/коментування:** юридичний запобіжник має спрацьовувати миттєво
і оборотно. Коли закон змінився, а шаблон ще не пере-валідований юристом — краще ввічливо
відмовити, ніж видати потенційно застарілий документ (quality bar = court-ready).

**Авторитетний enforcement — write-path у n8n** (`form-submit`, guard після «Get Service»):
навіть пересланий/кешований лінк форми не згенерує документ для не-`active`. Read-шляхи
(форма в TWA, меню бота) — захист у глибину + UX, не єдина лінія оборони.

### `needs_review` блокує так само, як `disabled`

Третій стан окремо від `disabled`, бо несе інший *сенс* («жива послуга, але закон під підозрою»
проти «вимкнено вручну») — це потрібно для майбутньої панелі ревʼю юриста. Але **поводиться як
блок**: ми ніколи не торгуємо документом із непідтвердженим правовим підґрунтям.
`status` — авторитетне джерело; стара `needs_law_review` (міграція 007) лишається довідковим
прапорцем (див. IMPROVEMENTS #41).

### Ідентичність закону = URL, а не slug (рішення G4)

Зв'язки «закон → послуги» зберігаються в `services.watched_laws` JSONB, зворотний індекс
будується запитом (нормалізована таблиця `law_relations` — це v2/GraphRAG, IMPROVEMENTS #42/#46).

**Знайдений баг:** один і той самий закон мав РІЗНІ slug'и в різних послугах
(`simejnyj-kodeks` в alimony vs `simeinyi-kodeks` в divorce, `cpk` vs
`tsyvilnyi-protsesualnyi-kodeks`). Зворотний індекс по slug пропустив би частину послуг —
закон змінився, одну послугу заблокували, інша торгує по застарілій нормі. **Юридична діра.**

**Рішення:** справжня ідентичність закону = його канонічний zakon.rada **URL**
(`.../laws/show/2947-14`), не вільний slug. Канон зафіксовано в реєстрі
`scripts/law-registry.mjs` (один `{slug,title,url}` на закон). Інструменти (`service-lifecycle.mjs`)
матчать по URL; `validate` ловить дрейф slug/title, `normalize` приводить до канону.
slug лишається людиночитним ярликом, але вже не є ключем зіставлення.

**Чому файл-реєстр, а не таблиця:** n8n у рантаймі `watched_laws` не читає (посилання на статті
вшиті в JS-шаблон), тож файл достатній як single source of truth для ідентичності + валідації.
Нормалізована таблиця `laws` приходить у v2 разом із вузлами законів GraphRAG.

### Свідомо поза scope (backend-фундамент)

Admin-UI (кнопка флипу, бейдж статусу, панель ревʼю `law_change_log`), CRON-моніторинг
zakon.rada.gov.ua (`scripts/check-law-updates.mjs` — референс), нормалізована `law_relations`.
