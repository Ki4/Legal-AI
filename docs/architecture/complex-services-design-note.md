# Design-note: сложные услуги — авторская система + Tier-3 песочница

**Дата:** 2026-06-24
**Статус:** 🧪 **design exploration, НЕ ратифицированное решение.** Это консолидация рабочего
обсуждения (детерминизм-первый при росте генеративной части; как дать юристу удобно авторить;
безопасный R&D-трек с тяжёлой генерацией). Когда что-то из этого станем строить — выносим решение
в `DECISIONS.md` и Tier-2 спеку.
**Автор:** обсуждение Сергей × research.
**Вход:** `docs/research/service-tiers-and-ai-harness.md` (харнесс L0→L5, дискриминаторы),
`docs/research/anti-hallucination-world-patterns.md` (RUNG-лестница, document-assembly gold-standard),
`docs/research/document-tiers-tz.md` (канон уровней), `docs/architecture/DECISIONS.md`,
`docs/architecture/GRAPHRAG-GUIDE.md`. Текущие компоненты: `services.generation_mode` + `status`
kill-switch, `n8n/templates/render-document.js`, `n8n/templates/route-alimony-change.js`,
`law_relations` (condition), `apps/client/src/lib/serviceAnatomy.ts`, `ServiceViewPage`.

> 🎯 Зачем: каталог будет двигаться к **более сложным услугам**, где «генеративная часть» документа
> растёт. Этот документ фиксирует, **как** при этом сохранить принцип «нуль галюцинацій конструкцією»
> и **как** сделать так, чтобы юрист мог удобно вносить контент.

---

## 1. Принцип при росте сложности: декомпозиция по-секционно, не «по документу»

«Рост генеративной части» — это **не отдельный режим**, а движение вверх по той же RUNG-лестнице
(`anti-hallucination-world-patterns.md` §4). Детерминизм меряется и толкается **по каждой
секции/полю**, а не «на весь документ». Процедура для любой услуги:

```
для каждой секции/поля документа:
  значение есть в форме/registry?              → КОПИРОВАТЬ            (Tier 0)  ── детерминизм
  выбор из verified-библиотеки блоков по логике?→ ENUM / decision-table (Tier 1)  ── детерминизм
  retrieval готового юр-блока под ситуацию?     → select               (Tier 1.5)── почти детерминизм
  реально нужна свободная проза под факты?      → constrained-gen + critic + abstain (Tier 2) ── harness
  свободная проза доминирует И ставки высоки?   → эскалация юристу      (Tier 3)  ── не авто-генерация
```

**Ключевой разворот:** «большая часть генерации» — это часто **выбор декомпозиции, а не свойство
услуги**. Document-assembly gold-standard (HotDocs / Documate / Contract Express) собирает даже
сложные документы на 80–90% из **библиотеки заранее написанных юристом verified-блоков**,
выбираемых решающей логикой; свободной генерации почти нет. Поэтому прежде чем принять «здесь
генерация большая», секцию надо пере-разложить и толкнуть максимум обратно в «сборку из блоков»
(Tier 1) — это и держит сложные услуги вне зоны 17–33% галлюцинаций (Stanford, см. research-док).

**Водоразделы (из `service-tiers-and-ai-harness.md`):** D2 = «нужна ли проза, которую нельзя
зашаблонить» (граница Tier 0/1 ↔ Tier 2); D7 = «выход уже не документ, а совет» (граница Tier 2 ↔ 3).

**Дефолт для сложных услуг = БЛЕНД:** скелет + библиотека блоков где можно, свободная генерация
только на истинно-уникальном остатке под харнессом. По мере роста остатка харнесс **усиливается**
(constrained decoding из «опции» в «обязательно»; NLI на каждую претензию; provenance-раскраска
🟢🟡🔴 — главный UX юриста; abstention-rate как SLA; возможно сильнее модель на генеративных секциях).

---

## 2. Авторская система для юриста (для блок-библиотеки / бленда)

**Цель:** юрист вносит контент **без кода и без свободной генерации в рантайме**. Вместо «AI пишет»
— **«логика/AI ВЫБИРАЕТ из написанного юристом»**. Это та же философия, что ярус-3 `law_relations`
(«всё, что управляет логикой документа — ревью юриста»).

Юрист авторит три вещи — и две из них **уже есть** в стеке:

| Что авторит юрист | Мировой паттерн | Статус в Legal-AI |
|---|---|---|
| 1. Интервью (вопросы) | guided interview | ✅ `form_config` + `DynamicLegalFormBuilder` |
| 2. Скелет с условными регионами | template + variables | ✅ `services.document_template` DSL (`render-document.js`) |
| 3. **Библиотека блоков с «include if»** | clause library + decision table | 🔴 как **структуры** ещё нет |

### Предлагаемая модель (расширение существующего, не с нуля)

- **Блок = строка библиотеки:**
  ```jsonc
  {
    "id": "alimony_grounds_income_up",
    "text": "…юридическая формулировка абзаца…",
    "applies_if": "facts_changed.includes('payer_income_up')",  // язык условий — см. ниже
    "citations": ["ст.192 СК", "ст.182 СК"],
    "law_version": "2026-05-25",
    "verified_by": "olga@…", "verified_at": "…",
    "tags": ["alimony-change", "increase"]
  }
  ```
  Версионируется как `law_chunks`; `verified_by` → тот же **kill-switch**, что у `law_relations`
  (неподтверждённый блок не отдаётся). Это выносит наружу if-цепочки, что сейчас живут **внутри**
  `*.document.txt` (REASONS_MAP / EXEMPT_REASONS — см. `DECISIONS.md` divorce-порт).
- **Выбор блока = decision-table (DMN-стиль):** таблица «условия → блок», которую юрист читает/правит
  как электронную таблицу. DMN продаётся ровно за «business-readable» — юрист понимает без программиста.
- **Единый язык условий** через всю систему: тот же, что уже в `render-document.js`
  (`{{#if and/or/== …}}`), `law_relations.condition`, `route-alimony-change.js`. Юрист задаёт условие
  через **condition-builder** (поле = значение из дропдаунов, не свободный код); UI эмитит эту
  грамматику, движок её **детерминированно** вычисляет. Одна evaluable-грамматика на: роутинг формы,
  graph-exceptions и выбор блоков — меньше системы, проще обучение юриста.
- **Сборка:** скелет ссылается на блоки по `id`; движок (`render-document.js` dispatch) собирает выбранные.
- **Замкнутый цикл preview:** юрист задаёт пример ответов → видит собранный документ + **какие блоки
  сработали** + цитаты + health. Фундамент уже есть: `serviceAnatomy.ts` + `ServiceViewPage` (зеркало
  услуги) + спроектированный «Test Query» в `GRAPHRAG-GUIDE.md`.

**Связь с roadmap:** это и есть Phase 3→4 «service-builder» из стратегии — но сведённый к
расширению уже доказанной пары `form_config` + `document_template`, плюс новый слой «clause library +
decision table». Открытый issue #51 (admin-редактор шаблона, заблокирован на RLS/ролях) — естественная
точка входа.

---

## 3. Tier-3 песочница: безопасный R&D-трек с тяжёлой генерацией

**Цель:** исследовать «большую генерацию» (Tier-3-территория), не рискуя судебными документами.
Отдельной инфраструктуры не нужно — изоляция уже встроена в стек.

- **Изоляция двумя флагами:** экспериментальная услуга = `status ≠ active` (клиенту **никогда** не
  отдаётся — авторитетный write-path guard в `form-submit`) + новый `generation_mode='ai_generate'`
  (расширение существующего dispatch `js | template | hybrid | …`).
- **Вывод — только на review-surface юриста:** review-card + provenance-раскраска 🟢🟡🔴
  (`build-hybrid-context.js`-паттерн), **не** в Telegram `sendDocument`.
- **Полный харнесс + измерение:** прогон через constrained decoding + multilingual NLI + L4-критик +
  abstention; **сбор eval-set** (ungrounded-rate, abstention-rate, retrieval-recall — RUNG 4). Это и
  есть «исследовать сферу» с числами, а не на ощупь.
- Это буквально **Tier-3 из `service-tiers-and-ai-harness.md`**: «не генератор → подготовка дела +
  тёплая эскалация», только адресат R&D-выхода — команда, не клиент.

---

## 4. Рекомендация по последовательности: experiment-first

1. **Сначала Tier-3 песочница** — дешёвая (флаги уже есть), даёт данные/интуицию + eval-set о том,
   **где** генерация реально нужна и **насколько** она надёжна на украинских юр-текстах.
2. **Потом авторская система** (clause library + decision-table + condition-builder + preview) —
   строится уже под знание из эксперимента, а не под гипотезу. Иначе риск построить no-code builder
   под сценарий, который эксперимент опровергнет.
3. Параллельно — узкие RUNG-слои из `anti-hallucination-world-patterns.md` (constrained decoding, NLI),
   которые нужны **обоим** трекам.

---

## 5. Открытые вопросы (вынести при переходе к стройке)

- **Decision-table vs DSL-в-шаблоне:** насколько далеко в «no-code» идти сейчас (структурированная
  таблица блоков) vs оставить юристу редактируемый `{{#if}}`-шаблон с подсказками. Зависит от данных
  Phase-3 (5–10 реальных заявок).
- **Хранение блоков:** новая таблица `clause_blocks` (как `law_chunks`/`law_relations`) vs per-service
  файлы `<slug>.blocks.json` (как `citations.json`). Вероятно — файлы на старте (git-ревью, golden),
  БД-таблица при росте + admin-UI.
- **Модель для генеративного остатка:** Groq `llama-3.3-70b` достаточно (Vectara HHEM ~4.1%) vs
  Claude API на истинно-генеративных секциях. Решать по eval-set из песочницы.
- **Groq grammar-support** для constrained decoding склонения — технический риск-чек до RUNG 1.

---

## Связанные документы (без дублирования)
- `docs/research/service-tiers-and-ai-harness.md` — харнесс L0→L5, 7 дискриминаторов, формат для юриста.
- `docs/research/anti-hallucination-world-patterns.md` — RUNG-лестница, document-assembly/DMN, Stanford.
- `docs/research/document-tiers-tz.md` — канон уровней документов + мировой legaltech.
- `docs/research/document-typography-and-toolchain.md` — вёрстка/тулчейн (ортогонально этому).
- `docs/architecture/DECISIONS.md` — «нуль галюцинацій конструкцією», doc-engine, GraphRAG-стек.
- `docs/architecture/GRAPHRAG-GUIDE.md` — `law_relations`, Law Graph Editor, Test Query.
