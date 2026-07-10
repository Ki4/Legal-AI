# PoC: MCP document service + Agent Skills (аліменти + розлучення)

> **Статус:** ✅ одобрен Сергеем 2026-07-10 (сессия Fable 5, план-режим).
> **Исполнитель:** Opus, свежая сессия, ветка `feat/mcp-document-service` (уже создана; этот файл — её первый коммит).
> **Kickoff-промпт для исполнителя — в конце файла.**

## Контекст

Дядя (входящий Tech Lead) предложил архитектуру: **LLM ведёт диалог и собирает параметры, но документ генерирует детерминированный сервер по шаблону** — MCP-сервер с одним tool на документ, валидацией каждого параметра («400 с пояснением» → LLM переспрашивает) и Skills с деревом решений по пакетам документов. Этот план — PoC этой архитектуры на живых услугах репо, чтобы говорить с дядей предметно.

Ключ: **всё детерминированное ядро уже существует** (`n8n/templates/render-document.js` — чистый CJS без зависимостей, шаблоны в БД+git, валидаторы в клиенте). Новое — конвертер form_config→JSON Schema, серверная валидация, MCP-обвязка и скилы.

**Решения по скоупу (приняты Сергеем):** услуги = alimony + divorce (обе `generation_mode='template'`; divorce сейчас `needs_review` — демо kill-switch); артефакт = текст документа + файл с водяным знаком «ЧЕРНЕТКА» (без PDF); чат = фаза 1 Claude Code/Desktop через `.mcp.json` (ноль кода чата), фаза 2 (stretch) — мини веб-чат.

## Первые действия исполнителя (до кода)

1. Прочитать план целиком. Загрузить скил **`anthropic-skills:mcp-builder`** — он авторитетен по актуальному API `@modelcontextprotocol/sdk` (имена импортов/классов); архитектура ниже (raw JSON Schema tools, low-level handlers, транспорт-агностичный registry) — фиксирована.
2. `gh issue create` — «PoC: MCP document service + agent skills (alimony + divorce)», чеклист T0–T9 из этого плана. Работать на ветке **`feat/mcp-document-service`**. Коммит на каждую задачу (чекпойнт-протокол).
3. Создать рядом с этим файлом `requirements.md` (краткие требования, дистиллят) и `validation.md` (заготовка под результаты демо/тестов) — `plan.md` уже закоммичен (T0).

## Что строим

```
Пользователь ⇄ Claude (Code/Desktop)
                ├─ Skills (.claude/skills/): legal-intake (роутер+дерево), alimony-claim, divorce-claim
                └─ MCP tools (stdio): list_services · validate_params · generate_alimony_document · generate_divorce_document
                        │ параметры = сырые ответы формы (те же id/форматы, что в TWA)
                        ▼
        apps/mcp-server (Node 20+, TS, @modelcontextprotocol/sdk)
                ├─ каталог из Supabase (form_config, document_template, status, required_checklist)
                ├─ валидация: required/format/show_if/enum → структурная ошибка UA → LLM переспрашивает
                ├─ деклензия ПІБ: Groq (как в n8n), при любом сбое → називний відмінок ({} fallback)
                └─ render-document.js (детерминированный рендер) → чеклист (fail-closed) → водяной знак → out/*.txt
```

LLM не пишет ни слова юридического текста. Divorce (`needs_review`) на generate возвращает структурный отказ — живое демо kill-switch.

## Проверенные факты (ground truth — не передоказывать)

- **Форматы значений** (`apps/client/src/types/form.ts:64`, `Answers = Record<string, boolean|string|string[]|null>`): date = ISO `'YYYY-MM-DD'` (проверено в DatePickerField.tsx и sampleAnswers.ts); денежные number-поля = строки (`'25000'`, parseMoney движка ест `"6 000"`, `"6000,50"`); choice = value-строка; multicheck = string[].
- **Движок** `n8n/templates/render-document.js`: `module.exports` (строка 830+) = `renderDocument, renderDocumentWithStyles, parseTemplate, buildContext, HELPERS, FALLBACK, parseExpr, evalExpr, detectGender, parseChildrenDetails, REGISTRY, parseMoney, …` (+ stem-guard экспорты в хвосте — сверить точные имена на месте). `buildContext(answers, ai)` при `ai={}` сам откатывает все деклензии в називний (guard внутри) — **интеграция = один вызов**.
- **Чеклист** `n8n/templates/validate-checklist.js`: `validateChecklist(text, context, checklist)`, но требует `parseExpr/evalExpr` в scope — паттерн загрузки скопировать из `n8n/templates/__tests__/validate-checklist.test.js` (`loadInlinedWithRenderDocument()`: конкатенация исходников в `new Function`). Excerpt: `preview-excerpt.js` → `deriveExcerpt`.
- **Деклензия**: промпт и параметры портировать ДОСЛОВНО из ноды `Prepare Declension` в `n8n/workflows/current/form-submit.json` (Groq `llama-3.3-70b-versatile`, temp 0, max_tokens 400, JSON с 6 полями `plaintiff/defendant_instrumental|genitive, marriage_place_locative, children_genitive`). Ключ `GROQ_API_KEY`. Любой сбой/нет ключа/таймаут 10с → `ai={}`.
- **Supabase**: `scripts/lib/supabase-rest.mjs` → `loadEnv(path)`, `createSupabaseClient(url,key)` → `{sbGet,sbPatch,sbInsert}` (проверено). Env: `apps/client/.env.local` → `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GROQ_API_KEY`.
- **Валидаторы клиента** (чистые, копируемые): `apps/client/src/lib/validators.ts` (6 format-правил, ІПН-чексумма, IBAN mod-97, `resolveValidationRule`, `validateValue`; единственный импорт — `import type {FormField}`), `conditions.ts` (show_if, 22 строки), `form-utils.ts` (`isAnswered`, `clearStaleAnswers`, required-только-для-видимых). Семантика: format-валидаторы пропускают пустые; required проверяется только у видимых; скрытые поля обнуляются; enum choice клиент НЕ проверяет (UI ограничивает) — сервер обязан добавить.
- **Alimony form_config**: 48 полей, 4 таба (plaintiff/defendant/family/alimony); 16 безусловно-required id: `last_name, first_name, middle_name, birth_date, registered_address, defendant_last_name, defendant_first_name, defendant_middle_name, defendant_registered_address, marital_status, children_details, family_cert_date, abandonment_date, alimony_type, alimony_start_date, defendant_employed`. Git SSoT: `apps/client/src/data/alimonyConfig.ts` / `divorceFormConfig.ts`; runtime-истина = БД (`services.form_config`).
- **Сэмплы для тестов/демо**: `apps/client/src/admin/lib/sampleAnswers.ts` → `SAMPLE_ANSWERS` (Record по slug), `sampleAnswersFor(slug)` (проверено).
- **Параметры tools = сырые ответы формы**, НЕ производные (`plaintiff_name`, `children[]`, гендер, деклензии считает `buildContext`; см. DERIVED_SOURCES в `apps/client/src/lib/serviceAnatomy.ts:262-284`).
- **Монорепо**: folder-convention, БЕЗ workspaces и root package.json; npm; секреты только в `apps/client/.env.local`; CI `.github/workflows/test.yml` (Node 22). Юр. цитаты для скилов: `n8n/templates/services/{alimony,divorce}.citations.json` (+ `.checklist.json`, `.document.txt`).

## Дизайн-решения

### D1. `apps/mcp-server/` — standalone strict TS, запуск через tsx, без build-шага

```
apps/mcp-server/
├── package.json / package-lock.json / tsconfig.json / vitest.config.ts / .gitignore(out/) / README.md
└── src/
    ├── index.ts        # entry: env → catalog → registry → stdio transport
    ├── server.ts       # MCP: ListTools/CallTool handlers поверх registry
    ├── env.ts          # repoRoot из import.meta.url; loadEnv(apps/client/.env.local); НИКОГДА process.cwd()
    ├── catalog.ts      # Supabase loader + re-fetch статуса на каждый generate
    ├── form-schema.ts  # form_config → JSON Schema (D2)
    ├── validate.ts     # движок валидации strict/partial (D3)
    ├── validators.ts   # ДОСЛОВНАЯ копия client validators.ts (parity-тест)
    ├── conditions.ts   # ДОСЛОВНАЯ копия client conditions.ts (parity-тест)
    ├── types.ts        # FormConfig/FormField/Answers (копия) + ServiceRow, ValidationIssue
    ├── doc-engine.ts   # createRequire → render-document.js; Function-concat validate-checklist.js; deriveExcerpt
    ├── declension.ts   # Groq, промпт из n8n-ноды, {} fallback
    ├── generate.ts     # статус → валидация → деклензия → buildContext → render → чеклист(fail-closed) → водяной знак → save
    ├── save.ts         # out/DRAFT-<slug>-<timestamp>.txt (UTF-8, без PII в имени)
    ├── registry.ts     # транспорт-агностичный RegisteredTool[] — шов для фазы 2
    └── __tests__/      # parity / form-schema / validate / generate / registry
```

- package.json: deps `@modelcontextprotocol/sdk` (последняя 1.x на момент реализации — сверить через mcp-builder), devDeps `tsx, typescript ~5.9, vitest, @types/node`. Scripts: `start/dev` (tsx), `test`, `typecheck` (`tsc --noEmit`), `inspect` (`npx @modelcontextprotocol/inspector tsx src/index.ts`).
- tsconfig: ES2022, NodeNext, strict, `verbatimModuleSyntax`, noEmit; `include:["src"]`, `exclude:["src/__tests__"]` (тесты гоняет vitest, они импортируют клиентский TS кросс-фолдерно).
- **MCP-обвязка: low-level `Server` + `setRequestHandler(ListTools/CallToolRequestSchema)`** — схемы у нас динамические raw JSON Schema из БД, и SDK-валидацию аргументов надо обойти: структурные украинские ошибки должен выдавать НАШ движок. **Жёсткое правило stdio: ни одного `console.log` — только `console.error`** (stdout = канал протокола).
- Типы для reuse: новый файл `scripts/lib/supabase-rest.d.mts` (loadEnv/createSupabaseClient декларации) — mcp-server импортирует `.mjs` напрямую.
- `RegisteredTool = { name, description, inputSchema, execute(args) → {isError, content:[{type:'text',text}]} }`.

### D2. Конвертер form_config → JSON Schema (`form-schema.ts`)

inputSchema услуги = `{type:'object', properties, required, additionalProperties:false}`. Маппинг типов: text/textarea/phone → string (+maxLength); date → string + `pattern:'^\d{4}-\d{2}-\d{2}$'` + в description «користувач зазвичай каже ДД.ММ.РРРР — переконвертуй»; boolean → boolean; choice → `enum` из option values (value↔label в description); multicheck → array+items.enum+uniqueItems; number → **string** + `pattern:'^\d+([.,]\d+)?$'` (в Answers нет number, parseMoney ест строки).

Description (украинский — язык интервью): `label` + hint + explanation + маппинг опций + формат-правило (из `resolveValidationRule`: ІПН «10 цифр з контрольною», IBAN «UA + 27 цифр») + **show_if как человекочитаемое предусловие** через `describeCondition()` (`all`→« І », `any`→« АБО »). `required[]` — ТОЛЬКО поля с `required:true` без `show_if` (для alimony — ровно 16 id из ground truth; условные — серверно, D3). Контракт (snapshot-тест):

```json
{
  "marital_status": { "type": "string", "enum": ["married", "divorced", "never_married"],
    "description": "Сімейний стан. Варіанти: married — У шлюбі (не розірвано); divorced — Шлюб розірвано; never_married — Офіційного шлюбу не було." },
  "divorce_date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
    "description": "Дата розірвання шлюбу. Формат: YYYY-MM-DD (користувач зазвичай називає ДД.ММ.РРРР — переконвертуйте). Питати ЛИШЕ якщо: marital_status == \"divorced\"." },
  "plaintiff_account_iban": { "type": "string",
    "description": "IBAN рахунку. Формат: UA + 27 цифр (перевіряється контрольна сума). Питати ЛИШЕ якщо: plaintiff_has_account == true." }
}
```

### D3. Валидация: копия + parity-тесты

`validators.ts`/`conditions.ts` копируются дословно (заголовок `// Copied verbatim from apps/client/src/lib/<file> — drift guarded by parity.test.ts`); нужные ~15 строк form-utils (`isAnswered`, логика `clearStaleAnswers`) — в `validate.ts`. Кросс-фолдерный import в tsc-программу не тянем (разные компилер-настройки, хрупко на Windows); извлечение в shared — follow-up в issue. Дрейф ловит `parity.test.ts`: импортирует ОБЕ копии и оригиналы (vitest транспилирует), сравнивает на батарее: ІПН валидный/битая чексумма, IBAN валидный/битый, телефоны, имена с латиницей, `isVisible`/`clearStaleAnswers` на реальном show_if-графе alimony.

Движок, два режима над `(config, input)`:
- **strict** (generate): `unknown_field` → ошибка (может быть опечаткой реального id — молча не выбрасывать); `invalid_type`/`invalid_option` (enum choice/multicheck — обязан сервер)/`invalid_format` (validateValue, только видимые непустые)/`maxLength` + cap 4000 chars/поле, 100 эл./массив; значения скрытых полей → warning `hidden_by_condition` + обнулить; после очистки — `missing_required` для required-видимых-незаполненных; спец-warning: строка `children_details` без даты `DD.MM.YYYY`.
- **partial** (validate_params): те же проверки заполненного, missing_required — информационно, никогда не error.

**Контракт ошибки** (tool-level: `{isError:true, content:[{type:'text', text: JSON}]}` — НЕ JSON-RPC error, чтобы LLM видел и самокорректировался):

```json
{ "ok": false, "service": "alimony", "error_type": "validation",
  "errors": [{ "field": "tax_number", "label": "ІПН (РНОКПП)", "problem": "invalid_format",
    "message": "Некоректний ІПН (не сходиться контрольна цифра)",
    "expected": "10 цифр РНОКПП з коректною контрольною цифрою",
    "hint": "Перепитайте користувача точне значення поля «ІПН (РНОКПП)» і викличте інструмент повторно." }],
  "warnings": [{ "field": "actual_address", "problem": "hidden_by_condition",
    "message": "Поле приховане умовою (same_actual_address == true) — значення проігноровано." }],
  "next_action": "Виправте перелічені поля і викличте інструмент ще раз. НЕ вигадуйте значення — перепитайте користувача." }
```

`problem` enum: `missing_required | invalid_format | invalid_option | invalid_type | unknown_field | hidden_by_condition | service_unavailable | checklist_failed | internal_error`. `message` — дословно существующие украинские строки валидаторов.

### D4. Каталог: Supabase на старте, статус — на каждый вызов

Старт: `sbGet('services','select=slug,title,description,status,generation_mode,form_config,document_template,required_checklist,price&generation_mode=eq.template&status=in.(active,needs_review)&order=slug')`. Регистрируем tools и для `active`, и для `needs_review` (схема видна, интервью возможно; отказ — при вызове, это и есть демо kill-switch); `disabled`/не-template — не регистрируем. Нет env → `console.error` + exit 1.

Каждый `generate_*`: re-fetch `status,document_template,required_checklist` по slug — флип статуса в админке действует немедленно (демо-бит: перевести divorce → отказ live). `status !== 'active'` → отказ `service_unavailable` («Послуга тимчасово недоступна: шаблон на перевірці юриста… НЕ намагайтеся скласти документ самостійно»). Валидация — по стартовому form_config (совпадает с зарегистрированной схемой; смена формы = рестарт; `tools/list_changed` — future work). `--offline` git-режим — отложен (kill-switch всё равно требует БД); шов оставлен: `loadCatalog()` возвращает `ServiceRow[]`.

### D5. Tools: 2 фиксированных + N динамических

1. **`list_services`** () → `[{slug, title, description, status, status_explanation_ua, price, tool_name}]` — роутер-скил зовёт первым.
2. **`validate_params`** `{service: enum-of-slugs, params: object}` → partial-отчёт `{ok, errors, warnings, missing_required:[{field,label}], …}`, всегда `isError:false` (проверка по ходу интервью, после каждого таба).
3. **`generate_<slug>_document`** (slug: `-`→`_`) — по tool на документ (схема = контракт интервью; убирает failure-mode «generic tool + чужие поля»). Description: title + price + «Параметри — сирі відповіді форми. Дати — YYYY-MM-DD. Перед викликом підтвердіть зібрані дані з користувачем.» + для needs_review — «⚠️ Наразі на перевірці юриста — виклик поверне відмову». Отдельный get_service_requirements НЕ нужен — схема tool'а уже несёт требования.

**Контракт успеха**: `content[0]` = JSON-метаданные, `content[1]` = полный текст документа с водяным знаком:

```json
{ "ok": true, "service": "alimony",
  "saved_to": "<repo>\\apps\\mcp-server\\out\\DRAFT-alimony-20260710-143012.txt",
  "excerpt": "«безпечний» початок документа…",
  "checklist": { "ok": true, "missing": [], "satisfied": [ … ] },
  "declension": { "used_ai": true, "note": "відмінки ПІБ через Groq; при відмові — називний" },
  "watermark": "ЧЕРНЕТКА — потребує перевірки юриста, не є юридичною консультацією",
  "next_action": "Покажіть користувачеві документ, нагадайте що це чернетка для перевірки юристом." }
```

Водяной знак: баннер-строка сверху И снизу текста; файл с префиксом `DRAFT-`. **Чеклист провален → fail-closed**: `isError:true`, `checklist_failed`, текст документа НЕ отдаём (провал чеклиста = баг целостности шаблона). `out/` в .gitignore; в именах файлов и stderr-логах — только id полей, никогда значения (PII).

### D6. Skills: 3 продуктовых скила в `.claude/skills/`, с draft-баннерами

Формат — как у существующего `interview` (YAML frontmatter name+description). Каждый начинается: `> ⚠️ ПРОДУКТОВИЙ скіл (PoC, user-facing). Юридичний зміст — ЧЕРНЕТКА до підтвердження Olga. Після PoC переїде до skills/ (top-level).` Юр. утверждения — ТОЛЬКО из файлов репо (`*.document.txt`, `*.citations.json`, `*.checklist.json`, hints form_config). Ничего не выдумывать: ни статей, ни сборов, ни сроков.

1. **`legal-intake/SKILL.md`** — роутер. Дерево: расторжение брака → divorce-claim (уточнить детей/споры); алименты → alimony-claim (`marital_status` покрывает married/divorced/never_married); «и то и то» → divorce с опцией `alimony_claim=true` внутри пакета; изменение размера алиментов → вне скоупа PoC (сказать честно); поділ майна/опіка/прочее → отказ + рекомендация юриста. Правила интервью: сначала `list_services` (уважать status); по одному вопросу, порядок табов; labels/hints дословно; даты конвертировать в ISO; неизвестные optional — пропускать, НЕ выдумывать; `validate_params` после каждого таба; **перед `generate_*` ВСЕГДА сводная таблица всех полей (label + значение) и явное подтверждение пользователя** (preflight/trust); по ошибке — переспрашивать ТОЛЬКО перечисленные поля; на `service_unavailable` — честно объяснить kill-switch; ІПН/паспорт лишний раз не эхоить; после генерации — путь к файлу + напоминание «чернетка».
2. **`alimony-claim/SKILL.md`** — пакет: что входит в позовну заяву (основания из alimony.citations.json: СК 141, 150, 180–184; ЦПК 174–175); куда подаётся (из шапки шаблона); что подготовить (свидетельства, довідка о составе семьи — из hints); percent vs fixed (из hint поля); формат `children_details`: `ПІБ, дата народження, свідоцтво № ... від ...`; порядок = табы Позивач → Відповідач → Шлюб і діти → Аліменти.
3. **`divorce-claim/SKILL.md`** — то же из divorce.document.txt + citations; явно: сейчас needs_review → ожидаемый отказ; конвенция `spouse_*`-полей, опции `divorce_reasons`, `alimony_claim`, `surname_after_divorce`.

### D7. Фаза 1: `.mcp.json` + демо-сценарий

`.mcp.json` (корень репо, Windows-safe): `{"mcpServers": {"legal-docs": {"command": "cmd", "args": ["/c","npx","-y","tsx","apps/mcp-server/src/index.ts"]}}}`. Fallback при капризах npx: `"command":"node","args":["apps/mcp-server/node_modules/tsx/dist/cli.mjs","apps/mcp-server/src/index.ts"]`. env-блок не нужен — сервер сам читает `apps/client/.env.local`.

Демо для дяди (в README + validation.md): (1) «Хочу подати на аліменти, ми розлучені» → legal-intake → list_services → интервью (персона из `SAMPLE_ANSWERS.alimony`); (2) намеренно битый ІПН → структурная ошибка → Claude переспрашивает ровно это поле («400-цикл»); (3) дата «15.03.1990» → тихо конвертируется в ISO; (4) сводная таблица → подтверждение → `generate_alimony_document` → документ с водяным знаком + путь + зелёный чеклист; (5) «А ещё развод» → `generate_divorce_document` → структурный отказ needs_review → честное объяснение; (6, опц.) флип статуса через админку/`scripts/service-lifecycle.mjs` live.

### D8. Фаза 2 (stretch, после sign-off демо): свой веб-чат

Без публичного MCP, без ngrok, без MCP-connector: `src/web/http.ts` (node:http, порт 8787, bind **127.0.0.1**): `POST /api/chat {sessionId, message}` → SSE; `GET /files/<name>` из `out/`. `src/web/agent.ts`: `@anthropic-ai/sdk`, system prompt = тела трёх SKILL.md (без frontmatter), `tools` = тот же in-process `RegisteredTool[]` → Anthropic-формат, цикл `while stop_reason === 'tool_use'` против registry напрямую. `ANTHROPIC_API_KEY` → `apps/client/.env.local` (БЕЗ `VITE_` — не должен попасть в браузерный бандл). Model id — сверить через скил `claude-api` на момент реализации, не из памяти. UI: **`apps/chat/`** (новая папка = правило репо) — минимальный Vite React: message list + input + stream-reader + ссылка на файл при `saved_to`. Отдельные коммиты (можно ветка `feat/mcp-web-chat`).

## Задачи (T = коммит-чекпойнт на `feat/mcp-document-service`)

| # | Размер | Что сделать / как проверить |
|---|---|---|
| T0 | S | mcp-builder скил; issue с чеклистом; `requirements.md` + `validation.md` (заготовка) рядом с этим plan.md. Commit. |
| T1 | S | Scaffold `apps/mcp-server` (package.json+lock, tsconfig, vitest.config, .gitignore c `out/`, README-заглушка) + `scripts/lib/supabase-rest.d.mts` + `src/env.ts`. Проверка: `npm run typecheck` + smoke-тест. Commit. |
| T2 | M | `types.ts` + копии `validators.ts`/`conditions.ts` + `parity.test.ts`. vitest зелёный. Commit. |
| T3 | M | `form-schema.ts` + юнит-тесты всех 8 типов (multicheck — на `divorce_reasons`) + snapshot полного вывода по `alimonyConfig` + ассерт required == 16 id. Commit. |
| T4 | M | `validate.ts` (strict/partial) + матрица тестов (required видимый/скрытый, show_if `!=`/all/any, обнуление скрытых+warning, invalid_option/type, unknown_field, чексуммы ІПН/IBAN → точная форма payload, partial без ошибок на missing). Commit. |
| T5 | L | `doc-engine.ts` (createRequire-мост + Function-concat чеклиста + deriveExcerpt), `declension.ts`, `generate.ts`, `save.ts` + `generate.test.ts`: **render parity** — вывод пайплайна с `SAMPLE_ANSWERS.alimony`, `ai={}` == `watermark(renderDocument(template, buildContext(answers,{})))` байт-в-байт; чеклист зелёный; порченый чеклист → fail-closed без текста; needs_review → service_unavailable; файл пишется во временную папку. Commit. |
| T6 | L | `catalog.ts`, `registry.ts`, `server.ts`, `index.ts` + `registry.test.ts` (фильтрация disabled/не-template, нейминг, контракты list/validate; fetch замокан). Ручной прогон `npm run inspect` (MCP Inspector) на живой БД: 4 tools, битые параметры → payload, alimony генерит, divorce отказывает. Commit. |
| T7 | M | `.mcp.json` + 3 SKILL.md + полный README + живое демо D7 в Claude Code; результаты в `validation.md`. Commit. |
| T8 | S | CI-job `mcp-server` в `.github/workflows/test.yml` (Node 22, working-directory, cache по lock-файлу, `npm ci` → typecheck → test); root-suite `npx vitest run --root ../.. scripts n8n` не сломан. Обновить `.claude/changelog.md` + session-summary. Commit → PR → merge `Closes #N`. |
| T9 | L | **Stretch (после sign-off демо):** фаза 2 — `src/web/*` + `apps/chat/` (D8). |

Все тесты — офлайн (без секретов в CI). Секреты — только `apps/client/.env.local`.

## Верификация (сквозная)

1. `apps/mcp-server`: `npm run typecheck` + `npm test` (parity, schema-snapshot, валидация, **render parity**, registry).
2. `npm run inspect` → MCP Inspector: список tools, ошибочный вызов, успешная генерация, отказ divorce.
3. Живое демо в Claude Code по сценарию D7 (шесть битов) — это и есть приёмка PoC; зафиксировать в `validation.md`.
4. CI зелёный (обе джобы + существующие suites).

## Риски / примечания

- **Дрейф копий валидаторов** → parity-тесты + provenance-заголовки; извлечение в shared — follow-up в issue.
- **Groq-деклензия флейки** → stem-guard в движке + `{}` fallback; демо работает и БЕЗ `GROQ_API_KEY` (називний відмінок); генерацию на Groq не блокировать никогда.
- **stdio-дисциплина**: один `console.log` ломает протокол — только stderr.
- **Windows**: пути от `import.meta.url` + node:path; `cmd /c` в .mcp.json; файлы UTF-8.
- **form_config БД ≠ git** → runtime = БД (истина), snapshot-тесты = git SSoT (задокументировать в README).
- **Юр. контент скилов** — черновик, обязательный sign-off Olga до любого user-facing использования (draft-баннеры в каждом скиле).
- **PII**: `out/` в gitignore, значения полей не логировать; фаза 2 — только 127.0.0.1.
- **SDK-дрейф**: версии/импорты `@modelcontextprotocol/sdk` — по скилу mcp-builder на момент реализации.
- Статус divorce может флипнуть Olga посреди PoC — демо имеет запасной бит с ручным флипом.

---

## Kickoff-промпт для исполняющей сессии (Opus)

Скопировать в новую сессию после `/clear` (модель — Opus):

```
Выполни одобренный план PoC «MCP document service + Agent Skills».

1. Ты на ветке feat/mcp-document-service (если нет — git checkout feat/mcp-document-service).
2. Прочитай ЦЕЛИКОМ specs/features/mcp-document-service/plan.md — утверждённый план:
   ground-truth факты, дизайн-решения D1–D8, задачи T0–T9.
3. Загрузи скил anthropic-skills:mcp-builder (авторитетен по API @modelcontextprotocol/sdk).
4. Выполняй T0→T8 по порядку: каждая задача = отдельный коммит после зелёной проверки.
   T9 (веб-чат) — только после моего sign-off живого демо.
5. Правила: секреты только из apps/client/.env.local; в stdio-сервере никакого console.log
   (только stderr); тесты офлайн; юр. контент скилов — только из файлов репо, с draft-баннерами.

Начни с T0 (issue + requirements.md/validation.md рядом с plan.md).
```
