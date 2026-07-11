# legal-docs-mcp-server (PoC)

Детерминированная генерация судебных документов через MCP. **LLM ведёт интервью и собирает сырые ответы формы; сервер валидирует каждый параметр и рендерит документ существующим движком (`n8n/templates/render-document.js`). LLM не пишет ни слова юридического текста.**

Spec: `specs/features/mcp-document-service/` · Issue: #96 · Skills: `.claude/skills/{legal-intake,alimony-claim,divorce-claim}`

## Архитектура

```
Claude (Code/Desktop) + Skills
  └─ MCP tools (stdio): list_services · validate_params · generate_<slug>_document
        │ параметры = сырые ответы формы (те же id/форматы, что у Telegram Mini App)
        ▼
  apps/mcp-server
  ├─ catalog.ts   каталог из Supabase (generation_mode=template, status active|needs_review);
  │               статус re-fetch на КАЖДЫЙ generate → флип в админке действует сразу
  ├─ form-schema  form_config → JSON Schema (описания полей = материал интервью)
  ├─ validate     strict/partial: required-только-видимых, show_if, чексуммы ІПН/IBAN,
  │               enum, unknown_field → структурная украинская ошибка → LLM переспрашивает
  ├─ declension   Groq (как в n8n form-submit); любой сбой → називний відмінок ({} fallback)
  └─ generate     buildContext → render → чеклист (fail-closed) → водяной знак «ЧЕРНЕТКА» → out/*.txt
```

## Tools

| Tool | Что делает |
|---|---|
| `list_services` | Каталог: slug, статус (+объяснение), цена, имя generate-инструмента. Вызывается первым. |
| `validate_params` | Частичная проверка `{service, params}` без генерации — для проверки после каждого блока вопросов. Всегда `isError:false`. |
| `generate_alimony_document` | Позовна заява про стягнення аліментів. Схема сгенерирована из form_config услуги. |
| `generate_divorce_document` | Позовна заява про розірвання шлюбу. Сейчас `needs_review` → структурный отказ (kill-switch). |

Контракты успеха/ошибок — `specs/features/mcp-document-service/plan.md` (D3–D5).

## Запуск

Секреты — только `apps/client/.env.local` (env-переменные окружения выигрывают): `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` обязательны; `GROQ_API_KEY` опционален (без него — називний відмінок, генерация не блокируется).

```bash
npm install
npm run typecheck && npm test     # 76 тестов, офлайн
npx tsx e2e/stdio-e2e.mts         # E2E по stdio против живой Supabase
npm run inspect                   # MCP Inspector (интерактивно)
```

**Claude Code:** корневой `.mcp.json` уже подключает сервер (имя `legal-docs`, stdio, запуск через локальный tsx: `node apps/mcp-server/node_modules/tsx/dist/cli.mjs …`). Нужна **новая сессия** — MCP-серверы поднимаются на старте; проверка: `/mcp`. Если tsx-путь сломается (например, после чистки node_modules) — `cd apps/mcp-server && npm install`; альтернатива в `.mcp.json`: `"command":"cmd","args":["/c","npx","-y","tsx","apps/mcp-server/src/index.ts"]`.

## Демо-сценарий (приёмка PoC, план D7)

1. «Хочу подати на аліменти, ми розлучені» → скил `legal-intake` → `list_services` → интервью по табам.
2. Назвать битый ІПН (напр. `1234567890`) → структурная ошибка → Claude переспрашивает ровно это поле.
3. Дату назвать как «15.03.1990» → Claude сам конвертирует в `1990-03-15`.
4. Сводная таблица всех полей → подтверждение → `generate_alimony_document` → черновик с водяным знаком + путь к файлу + зелёный чеклист.
5. «А ещё разлучення» → `generate_divorce_document` → структурный отказ (needs_review) → честное объяснение.
6. (Опц.) live-флип: `node scripts/service-lifecycle.mjs set-status divorce active` → повторный вызов проходит; вернуть обратно.

## Гарантии и ограничения

- **Детерминизм:** одинаковые параметры + `ai={}` → байт-в-байт одинаковый документ (тест render-parity). Единственный AI — склонение ПІБ, защищено stem-guard'ом движка и fallback'ом.
- **Fail-closed:** провал `required_checklist` → документ НЕ выдаётся (это дефект шаблона, не данных).
- **Kill-switch:** `status !== 'active'` (проверяется на каждом вызове) → отказ с объяснением.
- **PII:** `out/` в .gitignore; в stderr — только id полей, значения не логируются; имена файлов без PII.
- **stdout = протокол:** вся диагностика в stderr; `console.log` в этом пакете запрещён.
- **Источник данных:** runtime-истина — БД (`services.form_config`/`document_template`); git SSoT (`apps/client/src/data/*Config.ts`, `n8n/templates/services/*.document.txt`) используется snapshot-тестами; синхронизация — существующими `scripts/upload-*.mjs`.
- **Копии валидаторов:** `src/validators.ts`/`src/conditions.ts` — дословные копии клиентских; дрейф ловит `parity.test.ts`. Вынос в shared — follow-up в #96.
- Смена form_config в БД требует рестарта сервера (схемы tools строятся на старте); `tools/list_changed` — future work.

## Почему low-level Server, а не `registerTool` + Zod

Схемы инструментов генерируются в рантайме из form_config (raw JSON Schema), а валидацию обязан выполнять НАШ движок — чтобы LLM получала структурные украинские ошибки и переспрашивала пользователя. SDK-валидация аргументов (Zod) перехватывала бы их раньше. Осознанное отступление от дефолта mcp-builder; зафиксировано в plan.md D1.
