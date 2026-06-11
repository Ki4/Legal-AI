# doc-engine — Plan

> Підхід, групи задач, послідовність. Деталі контракту — `requirements.md`, перевірка — `validation.md`.

## Підхід

Розділити **код** (движок рендерингу, пишеться 1 раз, тестується) і **контент** (шаблон документа, дані на послугу в БД) — дзеркально до пари `DynamicLegalFormBuilder` + `form_config`, яка вже довела себе на формах.

Доказ коректності — **пілот на реальній послузі**: alimony портується з JS-білдера на шаблон, і голден-тести зобовʼязані дати байт-у-байт той самий документ. Якщо DSL не виражає реальну послугу з усім розгалуженням (3 статуси шлюбу, 1-N дітей, percent/fixed, ІПН/паспорт) — це зʼясується тут, а не на пʼятій послузі.

Порядок виправдання ризику: спершу движок+шаблон доводяться **офлайн** (vitest, без жодних змін у проді), потім міграція (нічого не вмикає, default `'js'`), потім деплой ноди (dispatch, alimony ще на `'js'`), і лише в кінці — флип однієї колонки, який миттєво відкочується.

## Групи задач

### G1 — Движок рендерингу
- `n8n/templates/render-document.js` — парсер DSL (без eval) + рендерер + хелпери + `buildContext` (computed-шар).
- `n8n/templates/__tests__/render-document.test.js` — юніт-тести кожної конструкції DSL: підстановка+fallback, `|raw`, if/else-if/else, порівняння, and/or/not, each з `@index1`/`@first`/`@last`, поглинання рядків блоковими тегами, коментарі, ігнорування `{{!style:}}`, помилки парсингу (незакритий блок, невідомий хелпер → зрозуміла помилка, не мовчазний пропуск).
- Хелпери: formatDate, formatDateQuoted, gender, plural, alimonyFraction, concat — кожен з тестами.

### G2 — Пілот alimony: шаблон + паритет
- `n8n/templates/services/alimony.document.txt` — шаблон, еквівалентний `buildAlimonyDocument`.
- Паритет-тести: рендер шаблону vs виклик старого JS-білдера на **матриці гілок** (marital_status × alimony_type × 0/1/3 дітей × ІПН/паспорт × employed/no × official_email 3 значення — програмний перебір комбінацій) — рівність рядків.
- Голдени: 3 існуючі fixtures → expected/*.txt байт-у-байт.

### G3 — Схема + інструменти
- `supabase/migrations/014_doc_engine.sql` — `generation_mode` + `document_template` + backfill `'js'` (застосувати через SQL Editor).
- `scripts/upload-document-template.mjs <slug>` — завантаження шаблону в БД (`--dry-run`).
- Завантажити alimony-шаблон у БД (режим ще `'js'` — нічого не вмикається).

### G4 — n8n інтеграція + live
- Build Document: інлайн движка + dispatch по `generation_mode` (fallback на legacy builders).
- Деплой `scripts/deploy-workflow.mjs form-submit`; live e2e ДО флипу (`test-webhook.mjs a1` — йде legacy-шляхом, регресії нема).
- Флип `alimony.generation_mode = 'template'` (service_role) → live e2e `a1`, `a2` — документ генерується движком, контент той самий.
- Перевірка rollback: флип назад у `'js'` → e2e → знову `'template'`.

### G5 — Доки + закриття
- `docs/architecture/DECISIONS.md` — рішення: шаблон-DSL як контракт, режим = властивість послуги, правила-не-позиції для розривів сторінок.
- `docs/architecture/IMPROVEMENTS.md` — declension-конвенція полів; фаза 2 (Google Docs стилі); admin-редактор шаблону.
- `specs/roadmap.md` — сервіс-агностична генерація: пілот закрито, divorce-порт + фаза 2 — наступні.
- `docs/runbooks/` — коротка памʼятка «як змінити текст документа послуги» (редагувати .txt → upload-скрипт).
- changelog + session-summary; merge → main, `Closes #N`.

## Послідовність і чекпоінти

```
G1 ──► G2 ──► G3 ──► G4 ──► G5
 offline (vitest)    │ live
                     └─ кожен крок реверсивний: міграція не вмикає,
                        деплой не вмикає, вмикає лише флип колонки
```

Якщо G2 покаже, що DSL не виражає alimony без милиць — зупинитись і повернутись до спеки (розширити контракт свідомо, не патчем).