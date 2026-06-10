# Runbook — Local dev startup

Як підняти локальне середовище Legal AI. **Роби це на початку кожної робочої сесії з n8n** — інакше дізнаєшся про відсутній ngrok у момент збою (Google OAuth callback, Telegram webhook).

## TL;DR — одна команда

```powershell
pwsh scripts/dev-up.ps1     # підіймає n8n (Docker) + ngrok (статичний домен)
```
Контейнер n8n має `--restart unless-stopped` — після ребута піднімається сам. **ngrok потрібен лише для Telegram-вебхуків і Google OAuth-callback**; для правки workflow / `test-webhook.mjs` / `deploy-workflow.mjs` досить n8n на localhost.

## Що з чим говорить

```
Telegram  ──┐
            ├─→  ngrok (rosy-caution-progeny.ngrok-free.dev)  ──→  n8n (localhost:5678, Docker)  ──→  Supabase / Groq / Google Docs
Google OAuth┘                                                                                              (вихідні виклики — ngrok НЕ потрібен)
TWA (Vercel/localhost) ──→ n8n webhook (через ngrok у проді, напряму localhost у dev)
```

**ngrok потрібен лише для ВХІДНОГО трафіку в n8n** ззовні: Telegram webhook і **Google OAuth callback**. Вихідні виклики n8n (Supabase, Groq, Google Docs API) йдуть напряму — їм ngrok не треба.

---

## Чеклист старту

### 1. n8n (Docker)
```bash
docker start n8n
```
Перевірка: відкрий http://localhost:5678 — має відкритись редактор.
> Якщо контейнера немає — див. повну команду `docker run` у session-summary (потрібні `NODE_FUNCTION_ALLOW_BUILTIN=crypto` і `WEBHOOK_URL=https://rosy-caution-progeny.ngrok-free.dev`).

### 2. ngrok (статичний домен) — **окремий термінал, блокує**
```bash
ngrok http --url=rosy-caution-progeny.ngrok-free.dev 5678
```
> ngrok v3.39+. На старіших версіях замість `--url` → `--domain=`. Домен **статичний** (FREE-tier), завжди той самий.

Перевірка: рядок `Forwarding` має показувати саме `https://rosy-caution-progeny.ngrok-free.dev -> http://localhost:5678`.
Або програмно:
```bash
node -e "fetch('http://localhost:4040/api/tunnels').then(r=>r.json()).then(j=>console.log(j.tunnels.map(t=>t.public_url+' -> '+t.config.addr)))"
```
**Якщо побачиш випадковий домен замість `rosy-caution-progeny` — callback'и не співпадуть, перезапусти з `--url`.**

### 3. Dev-сервер TWA (за потреби)
```bash
cd apps/client && npm run dev      # http://localhost:5173
```

---

## Швидкі тести (без браузера)
```bash
node scripts/test-webhook.mjs 2     # divorce (children+alimony)
node scripts/test-webhook.mjs a1    # alimony
node scripts/deploy-workflow.mjs form-submit [--check]   # деплой workflow у live n8n
```
⚠️ `success:true` у відповіді означає лише «кейс збережено + надіслано "готується"». **Документ генерується АСИНХРОННО** (Copy Template → Google Docs після Respond OK). Перевіряй факт доставки документа в Telegram, а не лише `success`.

---

## Пастки (gotchas)

- **ngrok offline → `ERR_NGROK_3200`.** Telegram webhook і Google OAuth callback не працюють. Симптом OAuth: браузер на кроці згоди показує offline-сторінку ngrok. Лік: підняти ngrok (крок 2).
- **Google OAuth token протух → нода `Copy Template` падає** з `authorization grant invalid/expired/revoked` → документи НЕ генеруються (юзер бачить «готується», але документа немає). Refresh-токен Google протухає за простоєм. **Лік — переавторизувати** (нижче).
- **З сесії 15 такі тихі збої видно:** Error Trigger у `form-submit` шле адміну (`236581343`) Telegram-алерт `⚠️ Workflow error: ... Node: ...`. Якщо прилетів алерт по `Copy Template` — це Google OAuth.

### 🔑 Durability fix — щоб токен НЕ протухав
Корінь проблеми «Copy Template падає після простою»: OAuth **consent screen у режимі Testing** → Google анулює refresh-токен **через 7 днів**. **Лік (разовий):** Google Cloud Console → **OAuth consent screen → Publish app → Production**. Після цього токен живе постійно. Зробити ОДИН раз.

### Переавторизація Google OAuth2 (якщо токен таки відвалився)
Порядок важливий — кожен крок ми ловили як окрему помилку:
1. **ngrok піднятий** (`dev-up.ps1`). Інакше callback → `ERR_NGROK_3200` (ngrok offline).
2. `redirect_uri_mismatch`? → Google Cloud Console → https://console.cloud.google.com/apis/credentials → проект **My First Project** → OAuth-клієнт **«n8n Cloud»** (`29853344763-...`) → **Authorized redirect URIs** має містити точь-в-точь `https://rosy-caution-progeny.ngrok-free.dev/rest/oauth2-credential/callback` (вже доданий).
3. **Заходь у n8n через ngrok-URL**, не localhost: `https://rosy-caution-progeny.ngrok-free.dev`. Інакше callback (ngrok-origin) не бачить сесійну куку (localhost-origin) → `{"status":"error","message":"Unauthorized"}`. Проходь «Visit Site» на попередженні ngrok.
4. Залогінься в n8n на ngrok-версії → **Credentials → «Google OAuth2» → Connect my account** → `sergeykichukKI4@gmail.com` → Allow → «Account connected» → **Save**.

> **Забув пароль n8n** (email-recovery вимкнено, нема SMTP): `docker exec n8n n8n user-management:reset` → перезапуск → майстер створення нового власника. Workflows + credentials зберігаються (в томі `n8n_data`). Перед цим — бекап: `docker cp n8n:/home/node/.n8n/database.sqlite n8n/workflows/.backups/`.

> Після переїзду на VPS (`n8n.<домен>`) redirect зміниться — додати новий URI в той самий OAuth-клієнт і прибрати залежність від ngrok.
