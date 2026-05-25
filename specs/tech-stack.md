# Tech Stack

## Frontend

| Шар | Інструмент | Версія |
|-----|-----------|--------|
| Framework | React + Vite | 19 / 7 |
| Language | TypeScript | strict mode |
| Styles | TailwindCSS + Framer Motion | 3.x |
| Telegram SDK | @twa-dev/sdk | latest |
| Deploy | Vercel | auto-deploy з GitHub |

**Правило:** весь UI код в `apps/client/src/`. Один SPA для TWA і адмін-панелі.

## Backend / Orchestration

| Інструмент | Роль |
|-----------|------|
| n8n (self-hosted) | Workflow orchestrator: форма → AI → Google Doc → Telegram |
| n8n Code nodes | JS бізнес-логіка, трансформація даних, шифрування PII |
| Supabase (PostgreSQL) | БД: послуги, кейси, юристи, вектори законів |
| pgvector | RAG: векторний пошук по текстах законів |

**Правило:** n8n Code node скрипти зберігати в `n8n/templates/` з тестами.

## AI / LLM

| Інструмент | Роль |
|-----------|------|
| Groq (llama/mixtral) | Генерація тексту документу (швидко і дешево) |
| Google Gemini embeddings | Векторизація текстів законів (gemini-embedding-001) |
| Hybrid search | vector + FTS, топ-5 статей → в промпт |

**Засіяно в RAG:** СК України, ЦПК України.

## Документи

| Інструмент | Роль |
|-----------|------|
| Google Docs API | Шаблони документів, підстановка даних |
| Google Drive API | Зберігання і видача посилань |

## Безпека

- PII шифрується AES-256-GCM в n8n перед записом у Supabase
- Формат: `v1:<iv>:<tag>:<ct>`
- Секрети: `.env.local` (gitignored) або Vercel env vars — **ніколи в коді**

## Інфраструктура

| Середовище | Деплой |
|-----------|--------|
| Local dev | Docker (n8n) + ngrok/cloudflared (webhook tunnel) |
| Production (план) | Hetzner CX22 ~€5/міс — Docker + nginx |

## Обмеження стеку

- Не додавати Python backend поки n8n справляється з orchestration
- Не міняти Groq на OpenAI без обґрунтування (вартість)
- Нові послуги — через конструктор форм (JSON config), не новий код
