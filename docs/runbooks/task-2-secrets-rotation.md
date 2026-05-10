# Task #2 — Runbook: ротация секретов и очистка Git-истории

**Подготовлено:** 2026-04-08 (вечерняя сессия)
**Для исполнения:** завтра утром
**Ожидаемое время:** 60-90 минут плотной работы
**Блокер для:** показа репозитория Ольге, любого внешнего партнёра

---

## 🎯 Цель

Удалить все утечки секретов из:
1. **Текущих файлов** репозитория (рабочее дерево)
2. **Git-истории** (все старые коммиты)
3. **GitHub remote** (force push после очистки)

И заменить их на безопасное хранилище через **n8n Credentials**.

---

## 📋 Найденные утечки (scan от 2026-04-08)

### ❌ Секрет №1 — SUPABASE_SERVICE_KEY (JWT)

- **Значение (первые 30 символов):** `eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...`
- **Длина:** 219 символов
- **Что это:** Supabase service_role key — даёт полный доступ ко всей БД мимо RLS. **Срок жизни до 2088 года.** Любой, у кого этот ключ, может читать/писать/удалять ВСЕ данные клиентов.
- **Впервые появился в коммитах:**
  - `8122e8c` — feat: restructure divorce form (53 fields) + update AI prompt
  - `18c5ff0` — feat: hybrid document template + local test infrastructure
- **Сейчас находится в файлах:**
  - `n8n-workflows/legal-ai-form-submit-v5-rag.json` (строки 149-150)
  - `n8n-workflows/legal-ai-form-submit-v6-hybrid.json` (строка 23, Global Config node)

### ❌ Секрет №2 — ENCRYPTION_KEY (AES-256 hex)

- **Значение (первые 20 символов):** `6f4f4f78939579244cf5...`
- **Длина:** 64 hex-символа (32 байта)
- **Что это:** ключ симметричного шифрования AES-256-GCM для PII-полей в таблице `cases`. **Если потеряем без миграции — все зашифрованные данные становятся нечитаемыми.**
- **Впервые появился в коммите:**
  - `17ab834` — Session 6: AES-256-GCM encryption for cases + deployment fixes
- **Сейчас находится в файлах:**
  - `n8n-workflows/legal-ai-form-submit-v6-hybrid.json` (строка 23, Global Config node)

### ❌ Секрет №3 — GEMINI_API_KEY (Google AI Studio)

- **Значение (первые 30 символов):** `AIzaSyDMed-xcOjJnbWxlF9o0EPtn0...`
- **Длина:** 39 символов
- **Что это:** ключ Google Generative AI API (Gemini). Использовался в старом v5-rag workflow для эмбеддингов. Сейчас **не используется** в v6, но всё ещё лежит в v5 файле.
- **Впервые появился в коммите:**
  - `8122e8c` — feat: restructure divorce form (53 fields) + update AI prompt
- **Сейчас находится в файле:**
  - `n8n-workflows/legal-ai-form-submit-v5-rag.json` (строка 124)

### ℹ️ НЕ утечка (для справки)

- **SUPABASE_URL** `https://nexkairsedqtczievxpa.supabase.co` — не секрет, но идентифицирует проект. Можно оставить.
- **GROQ_API_KEY** — хранится в n8n Credentials, не в JSON ✅
- **TELEGRAM_BOT_TOKEN** — хранится в n8n Credentials ✅
- **Google Service Account (для Google Docs)** — хранится в n8n Credentials (`googleServiceAccountApi` credential type) ✅
- **ANTHROPIC_API_KEY** — не используется, Groq заменил

---

## ⚠️ Критические предупреждения

### 1. ENCRYPTION_KEY — осторожно!

Если в БД **уже есть зашифрованные данные** в таблице `cases`, то ротация этого ключа **сделает их нечитаемыми**. В Phase 0 у нас скорее всего только тестовые данные, которые можно удалить — но **проверь перед ротацией**:

```sql
-- В Supabase SQL Editor
SELECT COUNT(*) as encrypted_cases FROM cases WHERE encrypted_data IS NOT NULL;
```

**Если > 0:** три варианта:
- **A)** Удалить тестовые записи перед ротацией: `DELETE FROM cases WHERE created_at > '...';`
- **B)** Расшифровать → перешифровать новым ключом (миграция)
- **C)** Экспортировать для backup, потом удалить, потом ротировать ключ

Для Phase 0 рекомендую **вариант A** — это тестовые данные, не жалко.

### 2. Force push в main

После `git filter-repo` история изменится — хэши всех коммитов, которые трогали n8n workflows, будут другими. Это значит:
- Локальные клоны других разработчиков (если есть) станут рассинхронизированы
- Нужен **force push**: `git push origin main --force-with-lease`
- **Никто кроме тебя** сейчас в репо не коммитит, поэтому это безопасно. Но дважды подтверди перед выполнением.

### 3. GitHub кэширует старые коммиты

Даже после force push GitHub может показывать старые коммиты по прямой ссылке ещё несколько дней (кэш). **Секреты нужно ротировать обязательно**, нельзя полагаться только на чистку истории.

---

## 🛠 План выполнения (9 шагов)

### Шаг 0 — Проверка перед стартом (5 минут)

```bash
cd /c/Users/serge/Legal-AI/legal-twa

# 1. Рабочее дерево чистое?
git status

# 2. Никто не коммитил последние изменения извне?
git fetch
git log HEAD..origin/main --oneline  # должно быть пусто

# 3. Backup текущего состояния на всякий случай
git branch backup-before-secrets-cleanup
git log --oneline -5
```

**Также проверь в Supabase SQL Editor:**
```sql
SELECT COUNT(*) FROM cases WHERE encrypted_data IS NOT NULL;
-- Если 0 → можно спокойно ротировать ENCRYPTION_KEY
-- Если > 0 → сначала удали тестовые данные или реши что с ними делать
```

---

### Шаг 1 — Ротация SUPABASE_SERVICE_KEY (10 минут)

**Где:** Supabase Dashboard

1. Открой https://supabase.com/dashboard → проект `nexkairsedqtczievxpa` → **Settings → API**
2. Найди секцию **"service_role key"** (та, что secret, НЕ anon)
3. Нажми **"Reset"** или **"Generate new key"** (точное название зависит от версии Dashboard)
4. Подтверди
5. **Скопируй новый ключ** в безопасное место (password manager, локальный .env — НЕ в git!)
6. Старый ключ автоматически становится невалидным ✅

**Проверка:**
```bash
# Старый ключ теперь должен возвращать 401
curl -H "apikey: <СТАРЫЙ_КЛЮЧ>" \
     -H "Authorization: Bearer <СТАРЫЙ_КЛЮЧ>" \
     "https://nexkairsedqtczievxpa.supabase.co/rest/v1/services?select=count"
# Expected: {"message":"Invalid API key"}
```

---

### Шаг 2 — Ротация ENCRYPTION_KEY (15 минут)

**⚠️ Только после того как ты удалил тестовые `cases` из Шага 0!**

1. **Сгенерируй новый ключ** (в терминале):
   ```bash
   openssl rand -hex 32
   ```
   Пример вывода: `abc123...` (64 hex-символа)

2. **Сохрани в password manager** под именем `LEGAL_AI_ENCRYPTION_KEY_v2`

3. **Запиши дату ротации** где-то (чтобы потом помнить: "всё до этой даты зашифровано старым ключом")

---

### Шаг 3 — Ротация GEMINI_API_KEY (5 минут)

**Где:** https://aistudio.google.com/app/apikey

1. Открой AI Studio → API keys
2. Найди ключ начинающийся на `AIzaSyDMed-xcOjJnbWx...`
3. Нажми **"Delete"** (корзина)
4. Нажми **"Create API key"**
5. **Скопируй новый ключ** в password manager

*(Примечание: этот ключ сейчас не используется в v6, но всё равно ротируем — он утечка.)*

---

### Шаг 4 — Перенос секретов в n8n Credentials (15 минут)

**Где:** твой n8n instance

**4.1. Создать credential для Supabase:**

1. n8n → **Credentials → New Credential**
2. Тип: **"Supabase API"** (если есть) или **"HTTP Header Auth"** (fallback)
3. Name: `Supabase Service Role`
4. Для Supabase API type:
   - Host: `nexkairsedqtczievxpa.supabase.co`
   - Service Role Secret: `<НОВЫЙ_SUPABASE_SERVICE_KEY>`
5. Save

**4.2. Создать credential для ENCRYPTION_KEY:**

Это симметричный ключ, не API. n8n не имеет для него встроенного credential type. Варианты:
- **Вариант A** (проще): n8n Environment Variables в `.env` файле на сервере n8n:
  ```
  ENCRYPTION_KEY=<НОВЫЙ_HEX64>
  ```
  Тогда в Code Node: `const key = $env.ENCRYPTION_KEY`
- **Вариант B** (если используешь n8n Cloud): создай credential типа "HTTP Header Auth" с именем `Legal AI Encryption Key` и положи туда значение. Читается через `$credentials['Legal AI Encryption Key'].password`

Выбери **A** если self-hosted n8n, **B** если n8n Cloud. Для обоих вариантов мы потом обновим Code Node в workflow.

---

### Шаг 5 — Удалить Global Config node и переписать workflow (20 минут)

**Где:** n8n UI, workflow **"Legal AI — Form Submit v6 (Hybrid Template)"**

**5.1. Найти все ноды, которые читают из Global Config:**

Ищи паттерны:
- `$('Global Config').item.json.SUPABASE_URL`
- `$('Global Config').item.json.SUPABASE_SERVICE_KEY`
- `$('Global Config').item.json.ENCRYPTION_KEY`

**5.2. Заменить на безопасные источники:**

- `SUPABASE_URL` — оставить как hardcoded (это не секрет) или вынести в `$env.SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` — заменить на credential reference или удалить Code Node HTTP calls и использовать встроенные n8n Supabase nodes с привязанным credential
- `ENCRYPTION_KEY` — заменить на `$env.ENCRYPTION_KEY` (Вариант A) или credential reference (Вариант B)

**5.3. Удалить Global Config node** (Code Node с секретами внутри)

**5.4. Сохранить workflow и протестировать** одну form submission end-to-end через TWA

---

### Шаг 6 — Экспортировать очищенный workflow в JSON (5 минут)

1. n8n → workflow → **"Download"** (или Menu → Export)
2. Сохранить как `n8n-workflows/legal-ai-form-submit-v6-hybrid.json` (перезаписать)
3. **Ручная проверка перед коммитом:**
   ```bash
   grep -c "eyJ" n8n-workflows/legal-ai-form-submit-v6-hybrid.json
   # Ожидаемо: 0
   grep -c "6f4f4f78" n8n-workflows/legal-ai-form-submit-v6-hybrid.json
   # Ожидаемо: 0
   ```

4. Также удалить или экспортировать заново v5-rag.json (где GEMINI_API_KEY) — можно просто удалить файл, он не используется:
   ```bash
   git rm n8n-workflows/legal-ai-form-submit-v5-rag.json
   ```

---

### Шаг 7 — Коммит очищенных файлов (2 минуты)

```bash
git add n8n-workflows/
git commit -m "Security: remove hardcoded secrets from n8n workflows

- Rotate SUPABASE_SERVICE_KEY, ENCRYPTION_KEY, GEMINI_API_KEY
- Move secrets to n8n Credentials / environment variables
- Remove Global Config node that held secrets
- Delete v5-rag.json (deprecated, contained leaked GEMINI_API_KEY)

Note: old secrets still exist in git history — next commit runs
git filter-repo to purge them from all historical commits."
```

---

### Шаг 8 — Очистка Git-истории через git filter-repo (15 минут)

**Инструмент:** `git filter-repo` (современная замена `git filter-branch`)

**8.1. Установка (если ещё нет):**

```bash
# Проверить есть ли
git filter-repo --version

# Если "command not found":
pip install git-filter-repo
# или на Windows через chocolatey:
choco install git-filter-repo
# или скачать .py файл напрямую:
# https://github.com/newren/git-filter-repo
```

**8.2. Создать файл замен `.secrets-to-purge.txt`:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leGthaXJzZWRxdGN6aWV2eHBhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU2NDY0NCwiZXhwIjoyMDg4MTQwNjQ0fQ.Kz8gtwIWUvRKw-VHivkZBzf-Oz0R8WFJ6-Fpp8DA1HE==>***REMOVED_SUPABASE_SERVICE_KEY***
6f4f4f78939579244cf59ef6d026daaba703b1070ac457fde4979092fb8440bb==>***REMOVED_ENCRYPTION_KEY***
```

И ДОБАВИТЬ ТУДА полную строку `AIzaSyDMed-xcOjJnbWx...` (узнать точное значение из истории через `git show 8122e8c -- n8n-workflows/` и вставить).

Формат файла: `<старое_значение>==>***REMOVED***` построчно.

**8.3. Запустить фильтр:**

```bash
# ВАЖНО: git filter-repo требует свежего клона или флага --force
git filter-repo --replace-text .secrets-to-purge.txt --force
```

**8.4. Проверить что секреты удалены из истории:**

```bash
git log --all -p | grep -c "eyJhbGciOiJIUzI1NiIsInR5cCI6Ik"
# Ожидаемо: 0

git log --all -p | grep -c "6f4f4f78939579244cf5"
# Ожидаемо: 0
```

**8.5. Удалить файл замен перед пушем:**

```bash
rm .secrets-to-purge.txt
```

---

### Шаг 9 — Force push в GitHub (5 минут)

**⚠️ DESTRUCTIVE OPERATION — убедись ещё раз что backup есть:**

```bash
# Проверка: backup ветка существует?
git branch -a | grep backup-before-secrets-cleanup
```

**Push с force-with-lease (безопаснее чем --force):**

```bash
# filter-repo удаляет origin по умолчанию — нужно добавить обратно
git remote add origin git@github.com:<твой-user>/<твой-repo>.git
# или через HTTPS:
git remote add origin https://github.com/<твой-user>/<твой-repo>.git

git push origin main --force
```

*(Примечание: после filter-repo `--force-with-lease` не сработает, нужен просто `--force`, потому что история полностью переписана.)*

**После push:**
1. Открой GitHub в браузере → проверь что секрет больше не находится поиском по репо
2. (Опционально) Попросить GitHub Support удалить старые кэшированные коммиты: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository#fully-removing-the-data-from-github

---

## ✅ Критерии готовности

- [ ] Supabase service_role key ротирован, старый не работает
- [ ] ENCRYPTION_KEY ротирован (+ старые encrypted data очищены или мигрированы)
- [ ] GEMINI_API_KEY ротирован (или deleted в AI Studio)
- [ ] n8n workflow v6 работает с credential references / env vars, НЕ содержит hardcoded секретов
- [ ] `grep eyJ n8n-workflows/*.json` → 0 results
- [ ] `grep 6f4f4f78 n8n-workflows/*.json` → 0 results
- [ ] End-to-end тест через TWA: form submission работает, документ генерируется
- [ ] `git log --all -p | grep eyJhbGci | grep -v REMOVED` → 0 results
- [ ] GitHub: главная ветка обновлена, поиск по репо не находит секретов

---

## 🆘 Rollback (если что-то пошло не так)

```bash
# Если force push ещё не сделан:
git reset --hard backup-before-secrets-cleanup

# Если force push уже сделан и n8n сломался:
# 1. В n8n: откати изменения workflow через UI (History tab)
# 2. Или: заимпортируй backup JSON из docs/runbooks/backups/ (если сделан)
```

---

## 📌 После завершения

1. **Удалить backup ветку:**
   ```bash
   git branch -D backup-before-secrets-cleanup
   ```

2. **Обновить changelog.md:**
   - Переместить задачу из Known Issues в Commit History
   - Отметить что секреты теперь в n8n Credentials
   - Указать дату ротации ключей

3. **Обновить session-summary.md:**
   - Задача Task #2 → COMPLETED
   - Следующая задача → Tier 1 услуга "Алименты"

4. **Сообщить Ольге:**
   - "Репозиторий готов к показу, секреты очищены"
   - Дать доступ к GitHub

---

## 📚 Справочники

- **git filter-repo docs:** https://github.com/newren/git-filter-repo
- **GitHub removing sensitive data:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- **Supabase key management:** https://supabase.com/docs/guides/api/api-keys
- **n8n Credentials:** https://docs.n8n.io/credentials/
- **OpenSSL rand:** `openssl rand -hex 32` для генерации AES-256 ключа

---

**Этот runbook составлен Claude в сессии 2026-04-08. Следующий раз, когда откроешь его — можешь идти по шагам сверху вниз без необходимости перечитывать контекст.**
