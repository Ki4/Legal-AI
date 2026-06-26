# Anti-hallucination: мировые паттерны и где мы на их фоне

**Дата:** 2026-06-24
**Автор:** research по запросу Сергея (как строят AI-харнесс вокруг генерации документов, чтобы уменьшить галлюцинации; оценка идеи «маленькие per-service деревья знаний + агент-роутер»).
**Вход:** deep-research (веб-первоисточники: Stanford RegLab studies, arXiv по constrained decoding / routing / GraphRAG / NLI-верификации, Qdrant/Pinecone/LlamaIndex docs, vendor-блоги Harvey/Thomson Reuters), фактчек двух самых нагруженных числовых утверждений. Сверка со стеком: `groundedness.js` (L4a), `prepare-l4b.js`, `route-alimony-change.js` (L0.5), `law_chunks`/`law_relations`, per-service `*.citations.json`/`*.checklist.json`.
**Цель:** разложить anti-hallucination как **именованные мировые паттерны**, честно оценить идею «деревьев + роутер», и наложить лестницу зрелости на то, что у нас уже есть.

> 🔗 Не дублирует, а **дополняет** существующие доки:
> - `docs/research/service-tiers-and-ai-harness.md` — наш 6-слойный харнесс Tier-2 (L0→L5), дискриминаторы уровней. **WHAT/HOW нашего харнесса — там.**
> - `docs/research/document-tiers-tz.md` — канон уровней документов + обзор мирового legaltech.
> - `docs/architecture/DECISIONS.md` §«RAG vs GraphRAG vs Hybrid», §«GraphRAG-стек: три яруси довіри», §«Нуль галюцинацій — конструкцією».
> - `docs/architecture/GRAPHRAG-GUIDE.md` — наш `law_relations`-подход.
>
> **Этот документ** = внешняя валидация тех решений + карта именованных мировых паттернов + лестница зрелости с конкретными следующими шагами.

---

## 1. Карта мировых anti-hallucination паттернов (по силе гарантии)

```
                    ANTI-HALLUCINATION PATTERNS (сильнее → слабее)
  СИЛЬНЕЕ ▲
          │  ┌─ Zero-by-construction ── template + enum-слоты (нет генерации)      ◄ Tier0/1 — ЕСТЬ
          │  ├─ Constrained decoding ── grammar/JSON-schema маскирует токены        ◄ RUNG 1 — GAP
          │  ├─ Extract-don't-generate ─ значение КОПИРУЕТСЯ из источника           ◄ принцип — ЕСТЬ
          │  ├─ Whitelist citations ──── cite ONLY allowed IDs                       ◄ ЕСТЬ (L3)
          │  ├─ Deterministic critic ─── regex grounding каждой цифры/цитаты         ◄ L4a — ЕСТЬ
          │  ├─ Entailment / NLI verify ─ претензия ⊨ источник? (multilingual)       ◄ RUNG 2 — GAP
          │  ├─ Abstention gate ──────── не уверен → выкинуть текст, эскалация        ◄ L4c — ЕСТЬ
          │  └─ LLM-as-judge critic ──── второй проход, совещательный                ◄ L4b — ЕСТЬ
  СЛАБЕЕ  ▼
   RETRIEVAL-слой:  metadata-partitioned RAG  │  routing (logical→semantic→LLM)  │  curated-KG vs GraphRAG
```

Главный вывод карты: **наш L0→L5 уже покрывает бóльшую часть верхней (сильной) половины.** Мы не в начале. Два чистых gap-а — `constrained decoding` (RUNG 1) и `entailment/NLI` (RUNG 2).

---

## 2. Идея «маленькие деревья + агент-роутер» — разрезать пополам

Идею надо разделить: **одна половина — best-practice (и уже сделана), другая — over-engineering** в нашем контексте.

**✅ Верно (best-practice, уже реализовано):** малая, сфокусированная, swappable per-service knowledge со своими метаданными. Это учебниковый паттерн **metadata-partitioned retrieval**:

```sql
-- search_law_chunks (есть):
WHERE service_slugs @> ARRAY[target_service] AND is_stale = false
```

Это **один индекс, логически партиционированный тегом сервиса** (GIN-индекс) — ровно то, что рекомендуют вендоры:
- **Qdrant:** «single collection + payload-based partitioning»; отдельные коллекции только для жёсткой изоляции; «hundreds/thousands of collections … unsustainably» (Qdrant Cloud кап = 1000).
- **Pinecone:** namespaces внутри одного индекса.

И наши `<slug>.document.txt` / `<slug>.checklist.json` (required-clause regex) / `<slug>.citations.json` (golden цитат) / `services.watched_laws` — **это и есть** «дерево на сервис со своими метаданными». Идея, к которой тянется интуиция, **уже живёт** как per-service файловая конвенция.

**🔴 Over-engineering: «агент, который роутит в нужное дерево».** Потому что **услуга детерминированно известна из формы.** По таксономии роутеров (logical/structured → semantic → LLM) это случай (1) — однострочный map `service_slug → {target_service, document.txt, checklist.json, citations.json}`. Наш `route-alimony-change.js` (L0.5) — ровно эта модель: чистая функция над известными полями. Semantic/LLM-роутер добавит только латентность, токены и **ненулевой misroute-риск** к решению, которое slug даёт со 100% точностью.

> ⚠️ **Поправка фактчека (важная честность).** Я хотел подкрепить это цифрой «роутеры мисроутят 28–36%» — **фактчек её опроверг (refuted).** 64.46% из arXiv 2505.23052 — это downstream QA-task accuracy маршрутизированной системы (она там *обгоняет* лучшую одиночную модель 60.85%), а не доля верно-смаршрутизированных запросов. Цифры «28–36% misroute» / «72%» **не следуют** — выкинуты. Аргумент стоит на первопринципе: детерминированный slug-map = 100% корректен на известном сервисе, поэтому любой вероятностный роутер добавляет избегаемую ошибку за нулевую выгоду. (Единственная подтверждённая цифра латентности — vLLM Semantic Router 4918 мс → 127 мс; прочие «+500–1500 мс» — иллюстративная оценка.)

**🔴 И физически отдельные N индексов («N деревьев») — анти-паттерн** collection-per-tenant: N ANN-структур хостить/мониторить/бэкапить на одной embedding-модели = дублированная инфра без выигрыша в precision над metadata-фильтром. **Не дробить `law_chunks`.**

**Когда роутер реально понадобится** — только при **free-text входе** (Telegram-чатбот, где юзер печатает проблему вместо выбора сервиса). Тогда — не-LLM селектор: `EmbeddingSingleSelector` (LlamaIndex, cosine) или Aurelio `semantic-router` (route = имя + примеры реплик; `fit()/evaluate()` тюнят `score_threshold` на размеченных украинских репликах), **перед** детерминированным map, с порогом уверенности, ниже которого — «спросить, какой сервис». LLM-селектор — последнее средство. Метаданные для такого селектора уже лежат в `services` и per-service файлах — добавить дёшево *потом*, не строить заранее.

### Таксономия роутеров (когда что)

| Уровень | Механизм | Точность | Стоимость | Когда у нас |
|---|---|---|---|---|
| (1) Logical / structured | `service_slug → {...}` map | 100% | ~0 | **сейчас** (вход = форма) |
| (2) Semantic | embedding-классификатор + порог | высокая | мс + 1 embedding | free-text чатбот |
| (3) LLM-router | LLM выбирает индекс | переменная | токены + латентность + misroute | крайний случай |

---

## 3. GraphRAG: когда граф реально помогает vs наш `law_relations`

Под «GraphRAG» прячут две очень разные вещи:

| | (A) Microsoft community-GraphRAG | (B) Наш `law_relations` |
|---|---|---|
| Как строится | LLM-извлечение сущностей + Leiden communities + summaries | вручную, **lawyer-verified** рёбра |
| Рёбра | авто, шумные | `requires/exception_if/overrides/clarifies/references` + condition + confidence |
| Обход | local/global query routing | детерминированный seed → verified соседи, single-hop, без LLM |
| Стоимость | «тысячи $» на индексацию, пересчёт summaries при каждом изменении | ~0, аудируемо |
| Риск | OSS-извлечение триплетов **срезало multi-hop accuracy на 30–40%** в одном legal-бенчмарке | низкий |

**Что граф даёт у нас реально:** upstream **precision retrieval** — «какая статья перебивает/исключает какую» вектор ловит плохо (тексты статей стилистически разные: ст.109 СК ↔ ст.57 ЦПК), а это самые ценные юридические multi-hop-запросы. Меньше «правдоподобно-неверных» чанков → косвенно меньше grounding-on-wrong-evidence → меньше галлюцинаций. Наш `exception_if`, проверяемый против ответов формы (GRAPHRAG-GUIDE шаг 3), — точечная митигация: сосед подтягивается только если его условие совпало с кейсом. Бонус — **аудируемость** (reasoning trail), что прямо ложится в юридическое требование цитирования.

⚠️ Одно предупреждение **применимо к нам:** для узкого «найди статью про X» graph traversal **увеличивает латентность и может ухудшить precision**, добавляя тангенциальный контекст (vector RAG обогнал GraphRAG 54% vs 35% на specific-document search в одном бенчмарке). Поэтому — кап раскрытия соседей (уже в гайде).

**Рекомендация:** держать `law_relations` **малым, verified, condition-gated, single-hop** (`verified_by NOT NULL`). **НЕ** растить в community-GraphRAG/Leiden, пока сервисов мало. Граф — инструмент retrieval-precision + governance, а не замена верификации сгенерированного текста. (Это ровно то, что записано в `DECISIONS.md` — ресёрч подтверждает наше решение.)

> ⚠️ **Флаги фактчека по Q2b-числам (использовать осторожно):** Stanford 17%/33% и украинский regex-precision-1.00 — **solidly supported**. Но: LightRAG «~70–90% качества за ~1/100 стоимости» — из блогов, не из статьи (arXiv 2410.05779); multi-hop «32–75% → 85%+» — endpoint vendor-reported (baseline не подтверждён); PageIndex 98.7% FinanceBench — это система **Mafin 2.5** на PageIndex, не PageIndex в одиночку; «family law 0.46 — худший домен» — **не подтверждён** (источник отдал 403). Подавать как иллюстративные, не как контролируемые бенчмарки.

---

## 4. Лестница зрелости anti-hallucination, наложенная на наш стек

Текущая позиция — **на уровне или выше индустриального best-practice**: детерминированный L4a regex-критик (каждая цитата/сумма/дата/имя против данных формы и allow-list), whitelist цитат (`cite ONLY L2_ARTICLE_IDS`), JSON-mode, L4c abstention-гейт. Это структурно атакует самый опасный юридический режим галлюцинации — «закон описан верно, но процитирован источник, который его не подтверждает».

| RUNG | Что | Статус | ROI | Заметка |
|---|---|---|---|---|
| **0** | zero-by-construction (Tier0/1 enum+template), L4a, whitelist, abstention | ✅ **есть, не регрессировать** | — | best-practice |
| **1** | **Constrained decoding** на 2 LLM-полях (склонение + Tier-2-абзац) | 🔴 GAP | **highest, ~часы** | см. ниже |
| **2** | **Один multilingual NLI/entailment-чек** Tier-2-абзаца против L2-чанков → в L4c | 🔴 GAP | высокий, ~дни | см. ниже |
| **3** | **Evidence-sufficiency** в abstention | 🟡 частично | средний | низкий retrieval-relevance → abstain даже при regex-GREEN |
| **4** | **Формализовать eval** в CI | 🟡 есть drift-тест | средний | см. ниже |
| **5** | per-service scoping через `law_relations`; Leiden — отложить | 🟡 | ниже на текущем масштабе | |

**RUNG 1 — constrained decoding (делать первым).** Маскирование next-token делает вывод гарантированно валидным. Наши слоты — **плоские строки/enum**, то есть в зоне JSONSchemaBench >86% coverage, где работают все фреймворки; коллапс coverage (Outlines 3%, XGrammar 28% на GitHub-Hard) — только на глубоко-вложенных схемах, нас **не** касается. Для **склонения** — grammar/strict-JSON, ограничивающая вывод морфологическим вариантом входа (общий стем через regex-валидацию), чтобы имя физически не «дрейфануло» в другое. Убирает целый класс format/value-ошибок за ~ноль стоимости, обычно **быстрее** свободной генерации.
> ⚠️ Технический риск-чек до планирования: подтвердить, что **Groq** даёт именно *grammar-constrained* декодинг (а не только JSON-mode). Если нет — RUNG 1 для склонения частично упирается в провайдера (вариант: Outlines/llama.cpp GBNF на своей стороне, либо ограничиться strict-JSON-enum).

**RUNG 2 — multilingual NLI (закрывает единственный остаточный пробел).** L4a regex-критик **не видит** один режим: whitelisted-но-нерелевантная цитата (верный ID статьи, но она не подтверждает *именно это* предложение) — «коварный» режим из Stanford. Лечится entailment-чеком абзаца против его L2-чанков, с порогом в L4c. Использовать **mDeBERTa-v3-xnli** или **MiniCheck-FT5** (770M, ~уровень GPT-4 за ~400× дешевле, калибруемый порог). ⚠️ Текст украинский → **НЕ** английский DeBERTa-mnli; покрытие украинского валидировать эмпирически (golden-набор «факт → допустимое/недопустимое обоснование» из спеки alimony-change). Бонус: наша `llama-3.3-70b` на Vectara-leaderboard ~4.1% grounded-галлюцинаций (лучше GPT-4o ~9.6%) — модель выбрана хорошо.

**RUNG 3 — evidence-sufficiency.** Если relevance L2-retrieval для claim ниже порога — abstain, даже когда regex GREEN (ловит «ничего релевантного не нашли → модель импровизировала»). Гейтить abstention на verdict-верификатора + retrieval-sufficiency, **никогда** на raw token log-probs (слабо коррелируют с корректностью в генерации).

**RUNG 4 — формализовать eval.** `DeepEval` как CI-гейт над golden `citations.json` + `checklist.json` на каждое изменение сервиса — **reference-based** (ловит wrong-article регрессии, которые reference-free faithfulness оценит как «идеально»). `RAGAS` faithfulness — вторичный сигнал на Tier-2-абзаце. Расширить drift-тест `citations.json`, чтобы утверждать: **ни одна цитата не выходит за `service_slugs`** запрашивающего сервиса.

**Чего НЕ делать:** не добавлять SelfCheckGPT N-sampling self-consistency — дорого и **пропускает confident-but-wrong** (а это и есть опасный юридический режим); не полагаться на reference-free RAGAS/TruLens как *первичный* гейт (доказывает grounding-to-chunk, не legal correctness); не гейтить abstention на log-probs.

---

## 5. Юридическая доменная очевидность

- **Stanford RegLab «Hallucination-Free?» (JELS 2025, arXiv 2405.20362; подтверждено фактчеком):** Lexis+ AI **~17%**, Westlaw AI-Assisted **~33%**, GPT-4 ~43% галлюцинаций — у RAG-тулов, маркетировавших «hallucination-free». Два режима: (1) закон изложен неверно; (2) **коварный** — закон верен, но источник не подтверждает. Наш L4a — структурная защита именно от режима (2).
  - ⚠️ scope-оговорка: Stanford мерил legal-**research** Q&A (открытые вопросы), а не template-bounded генерацию. 17/33% реальны, но это **не** ожидаемая ставка для нашего шаблонного пайплайна (у нас должно быть кратно ниже).
- **General LLM на юр-вопросах галлюцинируют 58–88%** (Stanford «Large Legal Fictions», arXiv 2401.01301; подтверждено) — «просто спросить GPT» для суда неприемлемо; наш enum+template-дефолт оправдан.
- **Украинский citation-граф** (100.8M судебных решений): явные ссылки извлекаются **regex с precision 1.00** — LLM для эксплицитных ссылок не нужен. Наш детерминированный extractor (`scripts/lib/citations.mjs`, golden `citations.json`) — правильный инструмент.
- **Document-assembly / DMN как gold-standard:** для процедурных решений (какие статьи/пункты применимы при данных ответах формы) детерминированная decision-логика (HotDocs / Gavel / Contract Express — guided interview + conditional templates, **без генеративного AI**) — золотой стандарт против вероятностной генерации. По мере движения от extractive («маркер-выделитель») к abstractive («редактор») citation coverage падает >50%. **Принцип:** любое поле, чьё значение **существует** в форме/чанке, должно **копироваться**, не сочиняться — что наш 95%-шаблон уже делает. Исключение — Tier-2-абзац (истинно abstractive) — ему и нужен NLI/критик (RUNG 2).
- **Vendor-практика (Harvey, Thomson Reuters CoCounsel, Luminance):** citation-required answers, retrieval над курируемым корпусом, human-in-the-loop — совпадает с нашим направлением.

---

## 6. Конкретная рекомендация: куда вкладывать, куда НЕТ

**Вкладывать:**
1. RUNG 1 — constrained decoding на склонении и Tier-2-абзаце (часы, убирает целый класс). Сначала risk-чек Groq grammar-support.
2. RUNG 2 — multilingual NLI (mDeBERTa-xnli/MiniCheck) на Tier-2 → в L4c (закрывает «верный ID, неверная поддержка»). С валидацией украинского.
3. RUNG 3 — evidence-sufficiency в abstention.
4. RUNG 4 — DeepEval CI над golden-файлами + drift-тест «цитата ∈ service_slugs».
5. Роутить Tier-2-абзац **только** на `llama-3.3-70b`, никогда на `3.1-8b` fallback; не ослаблять пороги критика/abstention при активном fallback (пусть 8b обслуживает только constrained-decoding-склонение, где грамматика делает качество модели почти нерелевантным).

**НЕ вкладывать:** агентный «which-tree» роутер на form-пути; физически отдельные N векторных индексов; Microsoft community-GraphRAG/Leiden на 3 сервисах; SelfCheckGPT self-consistency; reference-free faithfulness как первичный гейт; гейтинг abstention на log-probs.

**Как «маленькие деревья» маппятся на то, что уже есть:** «дерево на сервис со своими метаданными» — это **уже** наша per-service конвенция файлов (`document.txt` / `checklist.json` / `citations.json` / `watched_laws`). Это swappable, независимо-версионируемые per-KB-метаданные. **Формализовать это как контракт service-builder'а, а не как отдельные индексы.** Cross-service вопросы (развод+алименты в одном иске) решать на **уровне формы**: детерминированный детектор → либо composite-service slug (чей `service_slugs`-membership тянет оба тела права), либо эскалация в Tier3/юрист. `SubQuestionQueryEngine`-декомпозицию зарезервировать под будущий open-ended чатбот.

**Усилить версионирование KB:** предпочесть недеструктивный `upsert_law_chunk` (миграция 017) деструктивному DELETE-then-INSERT; снимать pre-update snapshot `(law_code, article_num, version_date, embedding-present)` для selective rollback; **хранить устаревшие версии статей** как `is_stale=true` с диапазоном дат действия, чтобы документ, сгенерированный под прошлогодним законом, можно было воспроизвести и объяснить (юридически важно).

---

## 7. Сквозной вывод

| | Уже best-practice | Реальный gap |
|---|---|---|
| Конструкция | zero-by-construction Tier0/1, extract-don't-generate | — |
| Критики | L4a regex (цифры/цитаты/даты/имена), L4b LLM-судья | NLI/entailment на «коварный» режим (RUNG 2) |
| Формат вывода | whitelist цитат, JSON-mode | constrained decoding/grammar (RUNG 1) |
| Abstention | L4c гейт | evidence-sufficiency (RUNG 3) |
| Знания | metadata-партиция (`service_slugs[]`), curated `law_relations`, per-service файлы | формализовать как контракт service-builder; eval в CI (RUNG 4) |
| Идея «деревья» | **верна как логическая партиция — реализована** | «агент-роутер» и «N физических индексов» — не нужны, пока вход = форма |

**Одной фразой:** архитектура харнесса **на уровне или выше индустрии**; рычаги — узкие дешёвые детерминированные слои (constrained decoding + multilingual NLI + evidence-sufficiency), а не переплатформирование. Идея «маленьких деревьев» правильна как **метаданные** (уже есть), ошибочна только в части «роутер + отдельные индексы».

---

## Источники

**Stanford / юридические галлюцинации:**
- Hallucinating Law (Stanford Law, 2024) — https://law.stanford.edu/2024/01/11/hallucinating-law-legal-mistakes-with-large-language-models-are-pervasive/
- Large Legal Fictions (JLA, arXiv 2401.01301) — https://academic.oup.com/jla/article/16/1/64/7699227
- Hallucination-Free? (JELS 2025, redo) — https://onlinelibrary.wiley.com/doi/full/10.1111/jels.12413 , https://hai.stanford.edu/news/ai-trial-legal-models-hallucinate-1-out-6-or-more-benchmarking-queries
- reglab/legal_hallucinations — https://github.com/reglab/legal_hallucinations
- Harvey BigLaw Bench (hallucinations/retrieval) — https://www.harvey.ai/blog/biglaw-bench-hallucinations
- TR CoCounsel (responsible AI) — https://legal.thomsonreuters.com/blog/responsible-ai-in-courts-the-answer-is-cocounsel-legal/

**Routing / metadata-partitioning:**
- Qdrant multitenancy — https://qdrant.tech/documentation/manage-data/multitenancy/
- Pinecone multi-tenancy — https://www.pinecone.io/learn/series/vector-databases-in-production-for-busy-engineers/vector-database-multi-tenancy/
- LlamaIndex routers — https://developers.llamaindex.ai/python/framework/module_guides/querying/router/
- Aurelio semantic-router — https://www.aurelio.ai/semantic-router
- Routing in RAG (overview) — https://towardsdatascience.com/routing-in-rag-driven-applications-a685460a7220/
- LLM routers (arXiv 2505.23052, осторожно с числами) — https://arxiv.org/pdf/2505.23052

**Constrained decoding / NLI / grounding:**
- JSONSchemaBench (arXiv 2501.10868) — https://arxiv.org/html/2501.10868v3
- Constrained decoding (concepts) — https://zeroentropy.dev/concepts/constrained-decoding/
- Outlines — https://github.com/dottxt-ai/outlines/blob/main/llm.txt
- Anthropic structured outputs — https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI function calling — https://developers.openai.com/api/docs/guides/function-calling
- Anthropic Citations API — https://www.anthropic.com/news/introducing-citations-api
- Extractive vs abstractive summarization — https://saicharankummetha.medium.com/summarization-with-llms-extractive-vs-abstractive-a899566f29f6
