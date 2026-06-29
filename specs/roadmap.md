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

### 2.0 Citation coverage (крок 0, regex-шар) ✅
- [x] `scripts/lib/citations.mjs` — regex-екстрактор цитат із doc-engine шаблонів 🟢
- [x] Голдени `n8n/templates/services/<slug>.citations.json` (SSoT) + vitest-страж від дрейфу 🟢
- [x] `scripts/extract-citations.mjs report` — звірка golden ↔ `watched_laws` (Supabase) 🟢
- [x] Migration 015: закрито дрейф ст.27 ЦПК (divorce), ст.174 ЦПК (alimony) + проактивно ст.113 СК (divorce) 🟢

### 2.1 GraphRAG (Supabase-first)
- [ ] Таблиця `law_relations (from_chunk_id, to_chunk_id, relation_type)` 🟡
- [ ] relation_type: "requires", "overrides", "exception_if", "references"
- [ ] AI витягує зв'язки з текстів законів автоматично
- [ ] n8n: traversal-запити через граф при генерації складних документів

### 2.2 Інтерфейс для юриста (HITL)
- [x] **Адмінка-дзеркало (service-mirror, #66)** — read-only огляд послуги: форма як є + анатомія документа (поля in/out + health 🟢/🟡/🔴) + закони (цитати + stale/changed badge). Слайс 1 (анатомія) ✅; слайс 2 (коментарі юриста `service_notes`) ✅; слайс 3 (заявка на послугу `service_requests` + приклад документа в Storage) ✅ (session 42). Спека `specs/features/service-mirror/` 🟢
- [ ] Панель рецензування: pending_review → approve / reject / edit 🟡
- [x] **Агент «що змінилось» (law-change-impact)** 🔴 — поверх CRON-моніторингу: детермінований diff редакцій (Node, G1 на main) + попередня чернетка «що змінилось + вплив по послугах» (n8n/Groq, enum-констрейнт + abstention) у панелі «Зміни законів» для підпису Олі. Закриває єдиний реальний юр-ризик (проґавлена зміна закону). **Живий end-to-end (session 51):** монітор пише `pending`+`article_diffs` → workflow `law-change-digest` (L2→L3→L4→L5) drafts/abstains → юрист бачить `AiDraftCard`. ТЗ: `specs/features/law-change-impact/` (Tier 2). Залишок: G5 доки + deferred (L4b LLM-критик, поартикульний diff). Issue #73
- [ ] Картка зв'язку: "Ст. 109 СК → вимагає → Ст. 57 ЦПК. Джерело: [фрагмент]"
- [ ] Підсвічування фрагменту в тексті закону (Frontend Tool)
- [ ] Жоден зв'язок не потрапляє в граф без підтвердження юриста

### 2.3 Складні послуги (Tier 2 — гібридний документ)

> Канон рівнів документів Tier 0/1/2/3 + критичний огляд legaltech: `docs/research/document-tiers-tz.md`. Deep-dive харнесса: `docs/research/service-tiers-and-ai-harness.md`.

- [x] **Зміна розміру аліментів (↑/↓)** — пілот режиму `hybrid` реалізовано (G1–G5, issue #37 closed, sessions 24/25/29). `status='disabled'` — продакшн-флип чекає Ольгу (~2026-06-25). ТЗ: `specs/features/alimony-change/` 🟡
- [x] Розлучення з дітьми (опіка → графік участі у вихованні дитини, ст.157 СК; «суд визначить» місце проживання) — розширення існуючої `divorce` (G1-G3 завершено, session 32), спека: `specs/features/divorce-with-children/` 🟢
- [ ] Поділ майна 🔵 (друга Tier 2-ітерація — «вибухова комбінаторика», після обкатки харнесса)
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
- [ ] **Гарний вивід документа (PDF/DOCX + лімітований предперегляд)** 🟡 — експорт PDF/DOCX і відправка файлом у бот; *лімітований предперегляд* (перша сторінка / watermark як вітрина якості перед збереженням); **цілісність ключових блоків** — шапка / «ПРОШУ» / дата+підпис / додатки на одній сторінці, без розриву (keep-together). Деталі: IMPROVEMENTS #77 (+ #50 типографіка) + research `docs/research/document-typography-and-toolchain.md` (рішення 2026-06-25: рендерер `docx`+Gotenberg, NBSP-пасс, один-источник→багато-рендерерів, ДСТУ=тригер міграції; журнал `docs/architecture/document-generation-design-notes.md` Q1–Q6)

### 3.3 Skill автоматизації
- [ ] Claude Code skill для автооновлення changelog 🟡
- [ ] Skill для запуску feature spec (SDD автоматизація)

---

## Технічний борг (виправити при нагоді)

- [x] Delivery pipeline: n8n v7 hardening — error trigger + guard-ноди + try/catch + structured error response (items 4–7, session 15, Refs #30, deployed+verified live). Залишився лише пункт 3 (Ensure Profile auto-create) — deprioritized, Task #1, не потрібен для PoC 🟢
- [x] Document generation: зробити сервіс-агностичним — **doc-engine** (фіча #34, session 20): декларативний шаблон-DSL у `services.document_template` + спільний движок `render-document.js` + dispatch по `generation_mode`. Пілот alimony live на шаблоні (117 parity-тестів байт-у-байт). Хвости:
  - [x] Портувати divorce на шаблон — **зроблено** (фіча #35, session 21): 263 parity-тести байт-у-байт, live e2e + rollback-флип перевірені; обидві послуги на `generation_mode='template'`. Сервіс-специфічні словники (REASONS_MAP, EXEMPT_REASONS) і динамічна нумерація «ПРОШУ» живуть у самому шаблоні. Винос legacy-білдерів з ноди → IMPROVEMENTS #52
  - [x] Фаза 2: типографіка Google Docs з `{{!style:}}` директив (IMPROVEMENTS #50, session 27, PR#43 merged + задеплоєно) 🟡
  - [ ] Admin-UI редактор шаблону для юриста (IMPROVEMENTS #51) 🔵
- [x] Checklist validator — детермінований regex-чек обов'язкових юридичних пунктів (issue #4 / IMPROVEMENTS #39, `specs/features/checklist-validator/`): живий деплой завершено сесія 31 (migration 021 застосована, workflow задеплоєно, чеклісти divorce+alimony завантажені, smoke test зелений) 🟢
- [ ] RLS: посилити row-level security 🟡
- [x] Тести для n8n Code nodes — 79 тестів (validate, shared utils, divorce document), commit b3c9013

---

## Архівні ідеї (можливо колись)

- Neo4j замість Supabase для графу (якщо law_relations > 1000 і JOIN-запити гальмують)
- MCP сервер для zakon.rada.gov.ua (актуальні тексти законів у контексті агента)
- Service Builder: юрист сам додає послугу через Google Docs шаблон без розробника
- Мобільний застосунок поза Telegram
