# Secrets Management

## Правило №1: секреты только в .env.local

Никогда не хардкодить ключи в коде, JSON-воркфлоу или комментариях.

| Где хранить | Для чего |
|-------------|----------|
| `apps/client/.env.local` | Локальная разработка |
| Vercel Environment Variables | Продакшн (client + admin) |
| n8n Environment Variables | n8n воркфлоу (self-hosted) |

## Ключи проекта — где получить

### Supabase
- **Anon key** (публичный, безопасен при RLS): Dashboard → Project Settings → API → Legacy tab → `anon`
- **Secret key** (серверный): Dashboard → Project Settings → API → "Publishable and secret API keys" → Secret key (`sb_secret_...`)

### Gemini API
- Получить/заменить: aistudio.google.com → Get API key

### Encryption key (AES-256)
Генерация нового ключа:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Вставить: в `.env.local` → `ENCRYPTION_KEY` и в n8n → Global Config node.

### n8n webhook URL
- Локально: `http://localhost:5678/webhook/form-submit`
- VPS: `https://n8n.yourdomain.com/webhook/form-submit`

## Если ключ утёк в git

1. **Ротировать ключ** — сгенерировать новый в соответствующем сервисе
2. **Обновить** `.env.local` и Vercel env vars
3. **Старый репо** с утёкшими ключами — сохранить приватным или удалить
4. Старую историю git не чистить (это сложно и риск потери данных)

## Pre-commit hook

Хук автоматически блокирует коммиты с секретами.

Установка (после клонирования репо или на новой машине):
```bash
bash scripts/setup-hooks.sh
```

Хук срабатывает на паттерны:
- JWT токены (`eyJhbGci...`) — Supabase legacy keys
- `AIzaSy...` — Google API keys
- `sb_secret_...` — Supabase new secret keys
- `sk-ant-...` — Anthropic API keys
