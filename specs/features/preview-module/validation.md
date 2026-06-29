# preview-module — Validation

> Як доводимо, що працює. Контракт — `requirements.md`. Підхід — `plan.md`.
> Definition of Done = всі чеки нижче зелені + live-smoke + sign-off Олі (пост-фактум).

---

## 1. Детермінований витяг (#86-критичний) — `preview-excerpt.test.js`

- ✅ `deriveExcerpt(fullDoc, 'divorce')` містить шапку суду + сторони + ≥1 абзац обставин.
- ✅ **НЕГАТИВНІ (рів #86):** результат НЕ містить підрядка «ПРОШУ», НЕ містить нумерованих вимог,
  НЕ містить жодної цитати статті (regex `ст\.?\s*\d+`), для **усіх** наявних сценаріїв divorce+alimony
  (реюз `test-data/<service>/fixtures/*`).
- ✅ Порожній/короткий документ → безпечний фолбек (не кидає, не протікає суть).
- ✅ Маркер обрізки знайдено в кожному golden-документі (страж від дрейфу шаблону: якщо хтось
  перейменує секцію «правове обґрунтування», тест червоніє).

## 2. preview-pay guard — `preview-pay-workflow.test.js`

- ✅ Без валідного initData → відмова (paid НЕ виставляється) — реюз/дзеркало #56-тестів.
- ✅ initData валідний, але `telegram_id != case.telegram_id` → відмова (чужий case).
- ✅ Signed URL мінтиться ЛИШЕ коли `status ∈ {preview_ready, paid}`; на `generating`/`failed` → відмова.
- ✅ Ідемпотентність: повторний виклик на `paid` case → re-mint, без подвійного флипу.
- ✅ Workflow JSON: 0 секретів у комміті (лише `YOUR_*`), 0 n8n-credentials (guard як law-change-digest).

## 3. form-submit зміни — parity + rate-limit

- ✅ **Parity не зламано:** наявні divorce/alimony parity-тести (engine===builder) лишаються зелені
  (`npx vitest run --root ../.. scripts n8n`). Реструктуризація доставки НЕ міняє текст документа.
- ✅ Rate-limit: профіль із ≥ `PREVIEW_RATE_LIMIT` case за 24h → reject; під лімітом → проходить.
- ✅ Повний файл лягає в **приватний** bucket (public=false); анонімний GET шляху → 403/denied.

## 4. RLS / безпека

- ✅ Клієнт (anon/authenticated токен TWA) НЕ може виставити `cases.paid`/`status` напряму (RLS deny).
- ✅ Клієнт читає лише власні `cases` (за telegram_id/profile), не чужі.
- ✅ `preview_excerpt`, що йде на клієнт, не містить суті (перетин із §1 — той самий екстрактор).

## 5. TWA — компонентні тести (`PreviewPage`)

- ✅ Стани: `generating` (спінер) → `preview_ready` (рендер витягу + blur + watermark + «Оплатити») →
  `paid` («Завантажити документ») → `failed` (зрозуміла помилка). UI 274+ зелені, tsc clean.
- ✅ `import type` для типів (verbatimModuleSyntax), 0 `any`.

## 6. Live-smoke (обовʼязковий, як кожна form-submit-зміна)

1. n8n live (Docker) + ngrok підняті.
2. `deploy-workflow.mjs form-submit` + `--create`/deploy `preview-pay` (backup у `.backups/`).
3. Реальний сабміт із TWA (тест-identity) → case `status=preview_ready`, `preview_excerpt` без суті,
   повний PDF у приватному Storage (executions API + Storage-перевірка).
4. «Оплатити» → preview-pay exec: `paid=true`, signed URL валідний (відкривається, віддає PDF),
   (A4) файл у бот.
5. **Негатив наживо:** виклик preview-pay із підробленим/чужим initData → відмова.
6. Rate-limit: N+1-й сабміт тим самим профілем за добу → reject.

## Команди

```bash
cd apps/client && npx vitest run --root ../.. scripts n8n   # excerpt + parity + preview-pay guard
npm test                                                     # UI (PreviewPage)
npx tsc --noEmit                                             # types
# деплой + smoke — розділ 6
```

## Definition of Done
Усі §1–§5 зелені · live-smoke §6 пройдено (preview→pay→download + 2 негативи) · IMPROVEMENTS #77
дописано (production image-шлях) · changelog/session-summary оновлено · юр-точка обрізки витягу —
на список Олі (пост-фактум, фаза витрини).
