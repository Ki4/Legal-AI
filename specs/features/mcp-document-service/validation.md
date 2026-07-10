# Validation: MCP document service + Agent Skills (PoC)

Issue: #96 · Требования: [requirements.md](requirements.md) · План: [plan.md](plan.md)

Статусы: ✅ подтверждено (с указанием как) · ⚠️ выполнено частично · 📋 заявлено · ❌ не выполнено · ⏳ ожидает

## Автоматические проверки

| Проверка | Покрывает | Статус |
|---|---|---|
| `parity.test.ts` — копии validators/conditions == оригиналы клиента | NFR-5, FR-5 | ⏳ |
| `form-schema.test.ts` — 8 типов + snapshot alimony + required=16 id | FR-2 | ⏳ |
| `validate.test.ts` — матрица strict/partial, контракт payload | FR-3, FR-5 | ⏳ |
| `generate.test.ts` — байтовый render-parity, fail-closed чеклист, needs_review | FR-1, FR-4, FR-6, FR-7 | ⏳ |
| `registry.test.ts` — фильтрация каталога, нейминг, контракты list/validate | FR-2 | ⏳ |
| `npm run typecheck` (strict) | — | ⏳ |
| CI job `mcp-server` зелёная | NFR-4 | ⏳ |

## Ручной E2E (stdio JSON-RPC против живой Supabase)

| Бит | Ожидание | Статус |
|---|---|---|
| initialize + tools/list | 4 tools: list_services, validate_params, generate_alimony_document, generate_divorce_document | ⏳ |
| generate_alimony с битым ІПН | isError + `invalid_format` payload по контракту D3 | ⏳ |
| validate_params (частичные данные) | partial-отчёт, isError:false | ⏳ |
| generate_alimony с SAMPLE_ANSWERS | ok:true, watermark, saved_to, checklist ok | ⏳ |
| generate_divorce (status=needs_review) | isError + `service_unavailable`, текст не выдан | ⏳ |
| Запуск без GROQ_API_KEY | генерация успешна, називний відмінок | ⏳ |

## Живое демо в Claude Code (приёмка PoC — сценарий D7)

⏳ Требует новой сессии Claude Code (сервер из `.mcp.json` подключается на старте). Шесть битов: интервью → битый ІПН → переспрос → конверсия даты → сводка+подтверждение → генерация alimony → отказ divorce → (опц.) live-флип статуса.

## Sign-off

- [ ] Автотесты + typecheck зелёные (локально и CI)
- [ ] Ручной E2E задокументирован выше
- [ ] Живое демо у Сергея пройдено
- [ ] Юр. контент скилов — на ревью Olga (блокер user-facing использования, НЕ блокер merge PoC)
