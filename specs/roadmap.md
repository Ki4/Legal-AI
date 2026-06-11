# Roadmap

> Живий документ. Оновлювати після кожного фічера і replanning.
> Пріоритети: 🔴 критично → 🟡 важливо → 🔵 стратегічно

---

## v1 — Прототип (поточний стан)

Мета: довести що концепція працює. Один документ, повний цикл.

- [x] Telegram Bot + Mini App (TWA)
- [x] DynamicLegalFormBuilder — форма з JSON config
- [x] n8n workflow: форма → Groq → Google Docs → Telegram
- [x] Supabase: послуги, кейси, юристи
- [x] RAG: pgvector + hybrid search, СК + ЦПК засіяно
- [x] PII шифрування AES-256-GCM
- [x] Адмін-панель: базовий конструктор форм
- [x] Послуга розлучення (розлучення без дітей)
- [x] Послуга аліментів (session 10, 2026-05-13)
- [x] Моніторинг змін законів (watched_laws) — **петля замкнена** (автодетект → флип → ревʼю): ✅
  - [x] `status` kill-switch (`active|needs_review|disabled`) + аудит `law_change_log` (migration 011)
  - [x] Ручні lifecycle-інструменти: `scripts/service-lifecycle.mjs` (флип статусу + фіксація зміни закону → флип залежних послуг у `needs_review`); реєстр законів `scripts/law-registry.mjs` (ідентичність по URL)
  - [x] Автоматичний CRON zakon.rada.gov.ua (фіча `cron-law-monitor`, session 19): `scripts/check-law-updates.mjs` (детект → канонічний `applyLawChange` з `detected_by='cron'` → флип залежних послуг у `needs_review` → панель Ольги). GitHub Actions (щотижня + кнопка `workflow_dispatch`); retry/backoff + дедуп спільних законів по URL. Хардинг `If-Modified-Since` відкладено → IMPROVEMENTS #48
  - [x] Admin-UI: бейдж статусу + флип (`is_published` → `status` як єдине джерело, session 17, #31)
  - [x] Admin-UI: панель ревʼю `law_change_log` (+ RLS для authenticated, migration 013, session 18, #32)

### Досліджені кандидати (service-demand research, червень 2026)

- **Військові спори (ТЦК / мобілізація / відстрочка)** — найвищий попит і порожня конкурентна ніша, in-scope. АЛЕ модель = досудовий триаж + ескалація до військового юриста (не продаж документа), потрібен юрист-партнёр. Деталі: `docs/research/service-demand/01-candidate-military-disputes.md` 🔵
- Конкурентна замітка: Дія / Legal Mind зайшли в договори/розписки (не позови); FastDoc робить позови на розлучення/аліменти з 2018. Диференціація — валідація юристом + умовна логіка + ескалація + Telegram UX. Деталі: `docs/research/service-demand/00-ukraine.md`

---

## v2 — GraphRAG + Інструмент юриста

Мета: вийти за межі простих документів. Складні кейси (розлучення + аліменти + майно) вимагають розуміння зв'язків між законами, а не просто пошуку схожого тексту.

### 2.1 GraphRAG (Supabase-first)
- [ ] Таблиця `law_relations (from_chunk_id, to_chunk_id, relation_type)` 🟡
- [ ] relation_type: "requires", "overrides", "exception_if", "references"
- [ ] AI витягує зв'язки з текстів законів автоматично
- [ ] n8n: traversal-запити через граф при генерації складних документів

### 2.2 Інтерфейс для юриста (HITL)
- [ ] Панель рецензування: pending_review → approve / reject / edit 🟡
- [ ] Картка зв'язку: "Ст. 109 СК → вимагає → Ст. 57 ЦПК. Джерело: [фрагмент]"
- [ ] Підсвічування фрагменту в тексті закону (Frontend Tool)
- [ ] Жоден зв'язок не потрапляє в граф без підтвердження юриста

### 2.3 Складні послуги
- [ ] Розлучення з дітьми (опіка, місце проживання) 🟡
- [ ] Поділ майна 🔵
- [ ] Аліменти на повнолітніх 🔵

---

## v3 — UX нового покоління

Мета: конкурентна перевага в інтерфейсі. Жоден український юридичний сервіс так не робить.

### 3.1 AI-асистент форми
- [ ] Чат поруч з формою 🟡
- [ ] Користувач описує ситуацію словами → AI заповнює поля
- [ ] Shared State: agent.setState() пише в state форми, React читає
- [ ] Frontend Tools: navigateToSection, highlightField

### 3.2 Streaming та rich UI
- [ ] Streaming статус генерації: "аналізую закони... → формую документ... → готово" 🟡
- [ ] Rich картки в відповіді: стаття закону, посилання, попередження
- [ ] CopilotKit Controlled UI: DocumentResultCard після генерації

### 3.3 Skill автоматизації
- [ ] Claude Code skill для автооновлення changelog 🟡
- [ ] Skill для запуску feature spec (SDD автоматизація)

---

## Технічний борг (виправити при нагоді)

- [ ] Delivery pipeline: n8n v7 hardening — error trigger + ensure-profile wiring + guard-ноди + try/catch. Items 3–7 у `docs/architecture/workflow-improvements.md` (НЕ внедрено) 🟡
- [x] Document generation: зробити сервіс-агностичним — **doc-engine** (фіча #34, session 20): декларативний шаблон-DSL у `services.document_template` + спільний движок `render-document.js` + dispatch по `generation_mode`. Пілот alimony live на шаблоні (117 parity-тестів байт-у-байт). Хвости:
  - [x] Портувати divorce на шаблон — **зроблено** (фіча #35, session 21): 263 parity-тести байт-у-байт, live e2e + rollback-флип перевірені; обидві послуги на `generation_mode='template'`. Сервіс-специфічні словники (REASONS_MAP, EXEMPT_REASONS) і динамічна нумерація «ПРОШУ» живуть у самому шаблоні. Винос legacy-білдерів з ноди → IMPROVEMENTS #52
  - [ ] Фаза 2: типографіка Google Docs з `{{!style:}}` директив (IMPROVEMENTS #50 — «красиві відступи») 🟡
  - [ ] Admin-UI редактор шаблону для юриста (IMPROVEMENTS #51) 🔵
- [ ] RLS: посилити row-level security 🟡
- [x] Тести для n8n Code nodes — 79 тестів (validate, shared utils, divorce document), commit b3c9013

---

## Архівні ідеї (можливо колись)

- Neo4j замість Supabase для графу (якщо law_relations > 1000 і JOIN-запити гальмують)
- MCP сервер для zakon.rada.gov.ua (актуальні тексти законів у контексті агента)
- Service Builder: юрист сам додає послугу через Google Docs шаблон без розробника
- Мобільний застосунок поза Telegram
