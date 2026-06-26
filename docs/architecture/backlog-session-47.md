# Backlog (session 47) — наполнен техниками, которые обсудили

> Источники техник: `docs/research/anti-hallucination-world-patterns.md` §4-7,
> `docs/research/service-tiers-and-ai-harness.md`, `docs/research/document-tiers-tz.md`,
> + `DECISIONS.md` (детерминизм-first A/B/C/D), `VERIFICATION-PROTOCOL.md`,
> `pressure-test-alimony-change-enumerability.md`.
>
> **ГЛАВНАЯ ПОПРАВКА (читать первой).** Research §6 рекомендует вкладываться в
> LLM-харнес (constrained decoding + NLI для Tier-2-абзаца). Но **pressure-test
> session 47** показал: единственный кандидат (alimony-change reasoning) —
> **перечислим** (ярус B + эскалация D), LLM не нужен. Поэтому LLM-харнес-инвестиции
> (RUNG 1-3 для абзаца) → **отложены до появления доказательно-неперечислимого
> сервиса.** Вкладываемся только в то, что усиливает ДЕТЕРМИНИРОВАННЫЙ путь.
> Каждый пункт ниже промаркирован: **DO-NOW** / **DEFERRED** / **GATED(юрист)**.

---

## A. Усиление детерминированного пути (DO-NOW, repo-only, безопасно)

- **A1 · CI тест-гейт** — `.github/workflows/test.yml`: гонять vitest (root n8n/scripts + apps/client) на push/PR. Закрывает находку аудита «автотестов в CI нет» (1167 тестов — вручную). _Риск: Actions не виден из облака → первый прогон сверить локально._ (Block II §4 RUNG 4)
- **A2 · DeepEval-гейт над golden** — reference-based проверка `citations.json` + `checklist.json` на каждое изменение сервиса (ловит wrong-article регрессии, которые reference-free пропускает). (Block II §4/§6 RUNG 4)
- **A3 · Drift-тест: «цитата ∈ service_slugs»** — расширить `citations-drift.test.js`: ни одна цитата документа не выходит за `service_slugs` своего сервиса. (Block II §6)
- **A4 · KB-версионирование** — предпочесть недеструктивный `upsert_law_chunk` (migration 017) деструктивному DELETE+INSERT; снимать pre-update snapshot; хранить устаревшие версии статей `is_stale=true` с диапазоном дат → документ под прошлогодним законом воспроизводим (юридически важно). (Block II §6)
- **A5 · G2 sample-data preview** — таб «Документ» рендерить с РЕАЛЬНЫМ примером (golden-fixture), не только пустой скелет → демо показывает заполненный документ. (session 47)

## B. Расширение услуг (детерминизм-first, классифицировать по тиру, GATED юристом)

- **B1 · alimony-change → live как pure-`template`** (GATED) — заменить LLM-абзац enum-блоками по `changed_facts` (+ per-fact валидность по ст.192). 3-й живой сервис без LLM. Tier-2 → sign-off Оли на формулировки. _Анлок из pressure-test._
- **B2 · Метод классификации новой услуги** — перед сборкой прогонять **7 дискриминаторов сложности** (`service-tiers-and-ai-harness.md §2`) → тир → A/B/C/D. Часть детерминируем (A/B), хвост → эскалация (D). C — только если аргумент доказательно неперечислим.
- **B3 · Медицина-пилот (scoping)** (GATED) — взять у юриста список мед-документов (его реальные клиенты) → разложить каждый по A/B/C/D worksheet → выбрать первые детерминированные. (session 47 + Block III §6)
- **B4 · #67 divorce** (GATED) — фикс property/debt уже на ветке `fix/divorce-property-debt-variant-b`; sign-off Оли на демо → merge.

## C. LLM-харнес (DEFERRED — только если появится C-кейс; pressure-test показал, что пока его нет)

- **C1 · RUNG 1 constrained decoding для Tier-2-абзаца** — DEFERRED (абзац перечислим → B).
- **C2 · RUNG 2 multilingual NLI** (mDeBERTa-xnli / MiniCheck) против «коварного» режима — DEFERRED (нет live LLM-абзаца для проверки).
- **C3 · RUNG 3 evidence-sufficiency в abstention** — DEFERRED.
- **C-EXCEPTION · RUNG 1 для СКЛОНЕНИЯ имён** — ✅ **ВЕРИФИЦИРОВАНО live (session 48)**: склонение — это живой LLM-шаг. Цепочка в `form-submit`: `Prepare Declension` (промпт `*-declension-prompt.txt`) → `AI Declension` (POST `api.groq.com/.../chat/completions`) → `Build Document` (`buildContext` читает `ai.plaintiff_genitive`/`_instrumental`/`marriage_place_locative`/`children_genitive`). Это ЕДИНСТВЕННОЕ неустранимое место LLM (укр. морфология не перечисляется). Защита сегодня = детерминированный **fallback в именительный** (`buildContext`: `q.x || nominative`) — грам. неверно, но НИКОГДА не пусто/не выдумано; LLM лишь пере-склоняет ПЕРЕДАННЫЕ имена (узкая поверхность галлюцинации), но **формально не констрейнится**.
  - ⚠️ риск-чек закрыт: **Groq даёт JSON-mode/structured-output, НЕ GBNF grammar-constrained декодинг** (как llama.cpp). → реалистичный дешёвый харнес здесь = JSON-schema + **детерминированный пост-чек** (склонённая форма должна делить стем/набор токенов с именительным; иначе LLM подменил имя → откат в именительный). Кандидат на DO-NOW, repo-only (`Build Document`/новый pure-модуль), не требует Оли. (Block II §4 RUNG 1)

## D. Вопросы юристу (pending-граф) — собрать и задать Оле

- D1 · Формулировка майно/борги для #67 (divorce).
- D2 · alimony-change: per-fact валидность `changed_facts` по ст.192 + текст enum-блоков (B1).
- D3 · Список мед-документов + какие части детерминированы / нужен ИИ / эскалация (B3).
- D4 · Открытые вопросы из `service-tiers-and-ai-harness.md §7` и `document-tiers-tz.md §6`.

## E. Прочее (из памяти/аудита)

- E1 · law-monitor.yml — re-enable schedule после возвращения Оли (связано с #33; 2 живые находки СК/ЦПК ждут решения).
- E2 · Завершить разбор research: Block II §4-7 и Block III (tiers) перечитаны — техники в этом backlog; при желании оформить как короткие architecture-заметки.

---

## Дисциплина наполнения (чтобы backlog оставался «правильным»)
1. Любой новый пункт — через A/B/C/D: можно ли детерминированно? → нельзя ИИ-харнес, пока не доказано, что аргумент неперечислим (pressure-test как образец проверки).
2. «Уже сделано» — не статус, а гипотеза: тег ✅live/⚠️built-not-live/📋claimed/❌gap, ≥2 evidence (VERIFICATION-PROTOCOL).
3. Любой court-ready текст → GATED sign-off Оли перед прод.
4. Не импортировать research-рекомендации вслепую: §6 советует LLM-харнес — pressure-test его отложил. Сверять рекомендацию с последним verified-выводом.
