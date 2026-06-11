# GraphRAG-стек для юридических услуг — внешнее исследование

**Дата:** 2026-06-12 (сессия 21)
**Метод:** веб-исследование (индустриальные пайплайны, академические работы, open-source проекты, предложенные Сергеем) + сверка с нашим контекстом (`DECISIONS.md` «RAG vs GraphRAG vs Hybrid Template», `GRAPHRAG-GUIDE.md`, live-схема `law_chunks`).
**Вопросы:** как в мире строят GraphRAG; можно ли извлекать связи между статьями законов без юриста; существуют ли решения «малый корпус без галлюцинаций»; что из предложенных инструментов (PageIndex, LightRAG, NornicDB, Weaviate-стек) нам подходит.
**Вывод зафиксирован в:** `DECISIONS.md` → «GraphRAG-стек: патерни замість фреймворків + три яруси довіри звʼязків».

---

## 1. Как индустрия строит GraphRAG

### Microsoft GraphRAG (эталонный пайплайн)
Корпус → чанки → **LLM извлекает сущности и связи из каждого чанка** → entity resolution (слияние дубликатов) → кластеризация Лейдена в «сообщества» → LLM-резюме сообществ → на запросе local/global routing. ([Dataflow — Microsoft](https://microsoft.github.io/graphrag/index/default_dataflow/), [Implementation Guide 2026](https://blog.premai.io/graphrag-implementation-guide-entity-extraction-query-routing-when-it-beats-vector-rag-2026/))

- **Цена:** ~$50–200 и часы индексации на ~500 страниц (GPT-4-класс); запрос — сотни тысяч токенов.
- **Фатально для динамичных данных:** добавление документов = перестройка графа целиком.
- **Для кого:** неизвестный хаотичный корпус + глобальные вопросы («какие темы в 10 000 документов»). **Не наш случай** — наш корпус крошечный, структурированный, запросы локальные.

### LightRAG (EMNLP 2025) — куда движется индустрия
Плоский типизированный граф (без community detection) + **dual-level retrieval** (конкретные entity-ключи + абстрактные concept-ключи) + **инкрементальные обновления** (новые документы доливаются без перестройки). ~70–90% качества GraphRAG за ~1/100 стоимости. ([GitHub](https://github.com/hkuds/lightrag), [production-сравнение](https://www.paperclipped.de/en/blog/graph-rag-production/), [разбор](https://www.ragdollai.io/blog/lightrag-vector-rags-speed-meets-graph-reasoning-at-1-100th-the-cost))

- **Подтверждает нашу стратегию «услуга за услугой»:** инкрементальный рост графа — это state of the art, а не компромисс.
- **Берём паттерн, не фреймворк:** LightRAG — отдельный Python-сервис со своими хранилищами; для 30–300 статей это лишняя инфраструктура. Наш эквивалент: `law_chunks` + `law_relations` в Supabase + обход двумя SQL-запросами в n8n Code node.

### PageIndex (VectifyAI) — vectorless reasoning-retrieval
Документ → иерархическое дерево «оглавления» (секции, не искусственные чанки) → LLM **рассуждением навигирует** по дереву на каждом запросе. 98.7% на FinanceBench; тезис «similarity ≠ relevance». ([GitHub](https://github.com/VectifyAI/PageIndex))

- **Что подтверждает:** наш выбор «чанк = статья» (natural section, не artificial chunk) и наш же аргумент из GRAPHRAG-GUIDE — вектор может не найти ст. 57 ЦПК по тексту о разводе, потому что релевантность ≠ похожесть.
- **Почему не внедряем:** (1) структура украинских кодексов и так явная (розділ → глава → стаття) — дерево строится детерминированным парсингом, LLM для этого не нужен; (2) LLM-навигация на **каждый запрос** = затраты и latency в serving-пути, тогда как у нас статьи услуги известны заранее из `law_deps`; (3) basic PDF-парсинг в open-source версии — а наш источник и так чистый текст.
- **Когда вернуться:** поиск по судебной практике (длинные неструктурированные решения) в v2/v3.

### NornicDB canonical graph ledger — паттерн «канонической правды»
Граф-БД с паттерном: Entity / FactKey / **FactVersion** (immutable, с `valid_from`/`valid_to`, без временных перекрытий) + append-only mutation log (кто/что/когда) + **as-of запросы** («какая правда действовала на дату X»). ([docs](https://github.com/orneryd/NornicDB/blob/main/docs/user-guides/canonical-graph-ledger.md))

- **Берём паттерн, не БД:** молодая граф-СУБД = ещё одна инфраструктура (нарушает наше решение «не Neo4j, пока связей < 1000»). Но сам паттерн мы уже наполовину построили своими руками: `law_change_log` (append-only аудит), `law_version_date`/`is_stale` на чанках, `verified_by`/`verified_at` в схеме `law_relations` из гайда.
- **Что добавить из паттерна:** темпоральная версионность связей (`valid_from`/`valid_to` на `law_relations` — стыкуется с IMPROVEMENTS #36 про даты на чанках). As-of запрос «какая редакция действовала на дату подачи иска» — юридически осмысленная фича.

### Weaviate Query Agent для legal RAG (видео-референс)
Production-паттерны: **метаданные важнее семантики** (жёсткая фильтрация по датам/юрисдикции/типу до векторного поиска), hybrid search (BM25 + вектор), разделение коллекций по доменам, агент строит подзапросы по схеме, **обязательные citations** на страницу/пункт, ColPali (PDF-страницы как визуальные токены, без OCR/чанкинга). ([видео](https://www.youtube.com/watch?v=skeKcYbPT9g))

- **Главное открытие — у нас это уже есть:** live-схема `law_chunks` содержит `service_slugs` (скоуп), `law_code`/`article_num` (точная адресация), `law_version_date`/`is_stale` (темпоральность), `authority_weight` (иерархия авторитетности), `fts` + pgvector (hybrid search). То, что видео называет production-ready схемой, заложено у нас с ранних сессий.
- **Берём практику:** eval-набор 20–30 запросов с известными правильными источниками **до** деплоя retrieval (аналог наших голденов, но для поиска).
- **Не берём:** ColPali (наш источник — чистый текст законов, не сканы); Query Agent с tools — это v3 (AI-ассистент формы); Weaviate как БД (pgvector уже есть и бесплатен).
- **GDPR-замечание из выжимки нерелевантно нам:** в нашем RAG-пути нет PII — законы публичны, данные клиента шифруются (AES-256-GCM) и в retrieval не участвуют. Self-hosted LLM не требуется.

---

## 2. Можно ли извлекать связи без юриста

### Доказательная база

| Факт | Источник |
|---|---|
| Lexis+ AI галлюцинирует ~17% запросов, Westlaw ~33% — при кураторских базах и рабочем retrieval; маркетинг «hallucination-free» опровергнут | [Stanford, J. Empirical Legal Studies](https://arxiv.org/abs/2405.20362) |
| Прод-системы юр. AI на украинских запросах: 13–21% галлюцинаций ссылок; **семейное право — худший домен** (0.46–0.90) | [Citation Grounding, на 100.8 млн украинских судебных решений](https://arxiv.org/html/2606.00898) |
| **Граф цитирований извлекается regex'ом с precision 1.00** — юридические ссылки в тексте явные, LLM не нужен | там же |
| LLM-судья (GraphJudger) поднимает F1 извлечения триплетов на ~1.4–10%, но не до нуля; LLM-судьи наследуют коррелированные слепые зоны генератора | [GraphJudger](https://arxiv.org/html/2411.17388v2), [LLMs-as-Judges survey](https://arxiv.org/pdf/2412.05579) |
| Graph-enhanced retrieval поднимает multi-hop точность с 32–75% до 85%+ | [legal graph RAG обзор](https://47billion.com/blog/graph-rag-for-legal-reasoning-multi-hop-knowledge-graphs-llms/) |

### Ответ: частично — по ярусам риска

Ключевое различие, подтверждённое литературой: связь, **добавляющая контекст в промпт** (retrieval-обогащение; худший случай — лишняя статья), и связь, **управляющая содержанием документа** (exception_if → включить/исключить блок; худший случай — повернення позову), — разные классы риска.

| Ярус | Извлечение | Ревью юриста | Обоснование |
|---|---|---|---|
| 1. `references` (явные ссылки статья→статья) | regex, детерминированно | **нет** | precision 1.00 на украинских юр. текстах |
| 2. Типизация (requires/clarifies) + неявные связи, только для retrieval | LLM-экстрактор + независимый LLM-критик, авто-аккепт при согласии | **нет** | риск = лишняя статья в контексте |
| 3. `exception_if` и всё, что управляет логикой документа | LLM предлагает | **да, всегда** | 13–33% галлюцинаций даже у лидеров; «перевірено юристом» — наш ров (research 00-ukraine §5) |

Автоматический критик без LLM: проверка «статья существует / действует на дату» (паттерн CP/CT из Citation Grounding) делается против нашего реестра законов (`law-registry.mjs`) + CRON-монитора дат редакций.

---

## 3. «Малый корпус без галлюцинаций» — что реально существует

Генеративные системы нуля не достигают (см. Stanford выше). Рабочие решения убирают генерацию из доверенного пути:

1. **Сборка вместо генерации** — шаблоны/extractive QA. Наш doc-engine: 0% по построению.
2. **Закрытое пространство ответов** — structured outputs со `strict`-схемой: AI **выбирает** статьи из enum-списка проверенных ID, выдумать номер физически невозможно. ([RAG survey](https://arxiv.org/html/2506.00054v1))
3. **Groundedness check + abstention** — утверждение не подтверждено retrieved-текстом → отказ вместо «починки»; ноль ценой recall. ([Upstage](https://www.upstage.ai/blog/en/llm-rag-groundedness-check)) Наш фолбэк: AI-секция не прошла проверку → документ уходит чистым шаблоном + алерт (Error Trigger уже есть).
4. **Кураторство малого корпуса** — Shepard's/KeyCite: связи верифицируют редакторы-юристы, индустрия десятилетиями доверяет только этому. При 30–300 статьях полная однократная верификация = часы Ольги. Малый корпус — суперсила, а не ограничение.

---

## 4. Итоговые выводы для Legal-AI

1. **Фреймворки не внедряем** (MS GraphRAG, LightRAG-сервис, PageIndex, NornicDB, Weaviate) — каждый решает проблему масштаба, которой у нас нет, и добавляет инфраструктуру. Supabase-first остаётся (roadmap 2.1).
2. **Паттерны заимствуем:** инкрементальный граф (LightRAG), чанк = статья (PageIndex), темпоральная версионность фактов + as-of (NornicDB), метаданные-сначала + eval-набор retrieval (Weaviate-видео), regex-слой цитирований + CP/CR/CT-метрики (Citation Grounding), enum-констрейнт + abstention (industry zero-hallucination практика).
3. **Три яруса доверия связей** (§2) — ярусы 1–2 строятся без юриста, ярус 3 (десяток связей на услугу) — за Ольгой. Шаги «реанимация law_chunks + migration law_relations + regex-слой + LLM-extraction в pending» можно делать до её возвращения.
4. **Пилот hybrid-режима:** «зміна розміру аліментів» (обоснование — `docs/research/service-demand/00-ukraine.md` §3, §6: FastDoc валидировал спрос, та же СК-база, тёплая аудитория alimony-клиентов).
5. **Бюджет AI-части пренебрежим:** извлечение связей ~$0.07–0.40 на услугу (Haiku/Sonnet, Batch API −50%), hybrid-секция ~$0.01–0.03 на документ при цене услуги 199–349₴. Реальная стоимость масштабирования — время юриста на ярус 3, и оно ограничено сверху размером корпуса.

## Источники

- Microsoft GraphRAG: [Dataflow](https://microsoft.github.io/graphrag/index/default_dataflow/) · [Implementation Guide 2026](https://blog.premai.io/graphrag-implementation-guide-entity-extraction-query-routing-when-it-beats-vector-rag-2026/) · [Zilliz explainer](https://medium.com/@zilliz_learn/graphrag-explained-enhancing-rag-with-knowledge-graphs-3312065f99e1)
- [LightRAG (EMNLP 2025)](https://github.com/hkuds/lightrag) · [Graph RAG in Production](https://www.paperclipped.de/en/blog/graph-rag-production/) · [LightRAG cost analysis](https://www.ragdollai.io/blog/lightrag-vector-rags-speed-meets-graph-reasoning-at-1-100th-the-cost) · [EraRAG: incremental RAG](https://arxiv.org/pdf/2506.20963)
- [PageIndex — vectorless reasoning RAG](https://github.com/VectifyAI/PageIndex)
- [NornicDB canonical graph ledger](https://github.com/orneryd/NornicDB/blob/main/docs/user-guides/canonical-graph-ledger.md)
- [Weaviate legal RAG (видео)](https://www.youtube.com/watch?v=skeKcYbPT9g)
- Галлюцинации: [Stanford «Hallucination-Free?»](https://arxiv.org/abs/2405.20362) · [Citation Grounding (украинские данные)](https://arxiv.org/html/2606.00898) · [GraphJudger](https://arxiv.org/html/2411.17388v2) · [LLMs-as-Judges survey](https://arxiv.org/pdf/2412.05579) · [AI Law Librarians: what the science says](https://www.ailawlibrarians.com/2026/02/19/what-the-science-says-about-hallucinations-in-legal-research/)
- Zero-hallucination паттерны: [Upstage groundedness check](https://www.upstage.ai/blog/en/llm-rag-groundedness-check) · [RAG survey: architectures & robustness](https://arxiv.org/html/2506.00054v1) · [near-zero hallucination pipeline design](https://medium.com/codex/designing-a-rag-pipeline-for-10m-documents-with-near-zero-hallucination-3e5875a15204) · [legal graph RAG](https://47billion.com/blog/graph-rag-for-legal-reasoning-multi-hop-knowledge-graphs-llms/)
