# Validation: MCP document service + Agent Skills (PoC)

Issue: #96 · Требования: [requirements.md](requirements.md) · План: [plan.md](plan.md)

Статусы: ✅ подтверждено (с указанием как) · ⚠️ выполнено частично · 📋 заявлено · ❌ не выполнено · ⏳ ожидает

## Автоматические проверки (2026-07-11, локально)

| Проверка | Покрывает | Статус |
|---|---|---|
| `parity.test.ts` — копии validators/conditions == оригиналы клиента (батарея: чексуммы ІПН/IBAN, телефоны, имена, show_if-граф alimony) | NFR-5, FR-5 | ✅ 14 тестов |
| `form-schema.test.ts` — 8 типов + snapshot alimony + required=16 id | FR-2 | ✅ 20 тестов |
| `validate.test.ts` — матрица strict/partial, контракт payload, hidden_by_condition, unknown_field+typo-подсказки | FR-3, FR-5 | ✅ 24 теста |
| `generate.test.ts` — **байтовый render-parity**, fail-closed чеклист (текст не выдан), needs_review, водяной знак сверху+снизу, guard отбрасывает мусорную деклензию | FR-1, FR-4, FR-6, FR-7, FR-8 | ✅ 7 тестов |
| `registry.test.ts` — фильтры каталога (query), нейминг `-`→`_`, контракты list/validate, live re-fetch статуса побеждает startup-снапшот, сетевые сбои → internal_error | FR-2, FR-4 | ✅ 9 тестов |
| `smoke.test.ts` — cwd-независимые пути | — | ✅ 2 теста |
| `npm run typecheck` (tsc strict, NodeNext) | — | ✅ чисто |
| CI job `mcp-server` зелёная | NFR-4 | ✅ PR #97: mcp-server 17s + test 46s pass (run 29135843457) |

**Итого: 76 тестов, 6 файлов — все зелёные, офлайн (без сети/секретов).**

## Ручной E2E — `npx tsx e2e/stdio-e2e.mts` (живая Supabase, 2026-07-11)

| Бит | Ожидание | Статус |
|---|---|---|
| initialize + tools/list | 4 tools: list_services, validate_params, generate_alimony_document, generate_divorce_document | ✅ ровно 4, имена совпали |
| list_services | alimony=active, divorce=needs_review + status_explanation_ua + tool_name | ✅ статусы из живой БД |
| validate_params (last_name + битая дата '15.03.1990') | partial-отчёт: 1 ошибка birth_date + 14 missing_required, isError:false | ✅ |
| generate_alimony (битый ІПН '1234567890') | isError + error_type validation + field tax_number «Некоректний ІПН (не сходиться контрольна цифра)» | ✅ «структурный 400» работает |
| generate_alimony (валидные SAMPLE_ANSWERS) | ok:true, checklist ok, watermark сверху+снизу, файл в out/, declension.used_ai=true (живой Groq) | ✅ `out/DRAFT-alimony-20260711-040307.txt` |
| generate_divorce ({}) | isError + service_unavailable (статус проверяется ДО валидации) | ✅ kill-switch live |
| Прогон с нерабочим GROQ_API_KEY | Groq 401 → `{}` fallback → документ генерируется, used_ai=false | ✅ stderr: «falling back to nominative case» |

## Живое демо в Claude Code (приёмка PoC — сценарий D7)

⏳ Требует новой сессии Claude Code (сервер из `.mcp.json` подключается на старте сессии). Шесть битов: интервью → битый ІПН → переспрос → конверсия даты → сводка+подтверждение → генерация alimony → отказ divorce → (опц.) live-флип статуса через админку/`scripts/service-lifecycle.mjs`.

Примечание: skills legal-intake / alimony-claim / divorce-claim уже подхвачены харнессом текущей сессии (видны в списке доступных скилов) — формат корректен.

## Sign-off

- [x] Автотесты + typecheck зелёные локально (76 тестов)
- [x] Ручной stdio E2E задокументирован выше (все биты ✅, включая Groq-fallback)
- [x] CI зелёная (PR #97, обе джобы + Vercel-превью)
- [ ] Живое демо у Сергея пройдено (новая сессия с .mcp.json)
- [ ] Юр. контент скилов — на ревью Olga (блокер user-facing использования, НЕ блокер merge PoC)

## Известные находки

- `apps/client/src/admin/lib/sampleAnswers.ts`: `defendant_tax_number='2845678901'` не проходит чексумму ІПН собственного валидатора клиента — E2E/тесты используют патч `'2845678905'`. Отдельная фоновая задача заведена.
