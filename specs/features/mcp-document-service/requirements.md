# Requirements: MCP document service + Agent Skills (PoC)

Issue: #96 · План: [plan.md](plan.md) · Ветка: `feat/mcp-document-service`

## Функциональные требования

1. **FR-1 (детерминизм):** текст юридического документа порождается ТОЛЬКО шаблонным движком (`render-document.js`) из валидированных параметров. LLM не генерирует ни одного слова документа. Одинаковые параметры → байт-в-байт одинаковый документ (при `ai={}`).
2. **FR-2 (один tool = один документ):** для каждой услуги каталога с `generation_mode='template'` и `status ∈ {active, needs_review}` регистрируется MCP-tool `generate_<slug>_document` с inputSchema, сгенерированной из её `form_config`. Параметры = сырые ответы формы (те же id и форматы значений, что у TWA).
3. **FR-3 (протокол ошибок):** невалидный параметр → tool-level ошибка (`isError:true`) со структурным JSON-payload на украинском: `{field, label, problem, message, expected, hint}` + `next_action`. LLM обязан переспросить пользователя, не выдумывать.
4. **FR-4 (kill-switch):** `status !== 'active'` на момент вызова generate (re-fetch из БД) → отказ `service_unavailable` с честным объяснением. Divorce в `needs_review` — демо этого поведения.
5. **FR-5 (валидация):** required-только-для-видимых (show_if), формат-правила клиента (email/phone/inn/name/passport/iban с чексуммами), enum choice/multicheck, unknown_field, обнуление скрытых полей (parity с TWA-семантикой).
6. **FR-6 (артефакт):** успех → полный текст с водяным знаком «ЧЕРНЕТКА — потребує перевірки юриста, не є юридичною консультацією» (сверху и снизу) + файл `out/DRAFT-<slug>-<ts>.txt` + excerpt + результат чеклиста.
7. **FR-7 (чеклист fail-closed):** провал `required_checklist` → ошибка `checklist_failed`, текст НЕ выдаётся.
8. **FR-8 (деклензия):** відмінки ПІБ через Groq (как в n8n form-submit); любой сбой/нет ключа → називний відмінок (guard в движке). Генерация никогда не блокируется на Groq.
9. **FR-9 (skills):** 3 скила (`legal-intake` роутер с деревом решений, `alimony-claim`, `divorce-claim`); юр. содержание только из файлов репо; draft-баннер + обязательный sign-off Olga до user-facing использования; обязательная сводка-подтверждение перед вызовом generate.
10. **FR-10 (интеграция):** `.mcp.json` в корне репо подключает сервер к Claude Code (stdio).

## Нефункциональные

- **NFR-1 (PII):** значения полей не логируются (stderr — только id), имена файлов без PII, `out/` в .gitignore.
- **NFR-2 (секреты):** только из `apps/client/.env.local`; в git — ничего.
- **NFR-3 (stdio-дисциплина):** stdout — только протокол; вся диагностика в stderr.
- **NFR-4 (тесты офлайн):** CI без сетевых вызовов и секретов; живая БД — только ручной E2E.
- **NFR-5 (дрейф):** копии validators/conditions защищены parity-тестами против оригиналов apps/client.

## Вне скоупа PoC

PDF/DOCX, Telegram-интеграция, alimony-change (hybrid/GraphRAG), веб-чат (T9 stretch — отдельным решением), перезагрузка каталога без рестарта.
