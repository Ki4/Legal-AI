# template-editor — Plan

> Як будуємо. Сесія 1 = групи G1–G4 (ця гілка `claude/document-constructor-styling-a3zkky`).
> Сесії 2–3 — окремі гілки/issue, по спеці §4–§5.

## G1 — Міграція (`supabase/migrations/030_template_editor.sql`)

- `ALTER TABLE services ADD COLUMN IF NOT EXISTS document_template_draft TEXT;`
- `CREATE TABLE service_revisions` (id uuid pk default gen_random_uuid(), service_id uuid FK →
  services ON DELETE CASCADE, snapshot jsonb NOT NULL, changed_by uuid NULL, reason text NOT NULL,
  created_at timestamptz default now()). Індекс `(service_id, created_at DESC)`.
- RLS: enable; політика — лише `authenticated` (адмінка під Supabase Auth), anon — нічого.
  Append-only на рівні коду (UI не робить UPDATE/DELETE ревізій); DB-тригер не потрібен у v1.
- Idempotent (IF NOT EXISTS всюди), коментар-шапка «чому» за стилем 029.
- **Застосування — Сергій локально** (`supabase db push` або SQL Editor) — контейнер не має ключів.

## G2 — Чиста логіка (нові lib-модулі, unit-тестовані)

`apps/client/src/admin/lib/templateGate.ts`:
- `validateTemplate(template): { ok: true } | { ok: false; error: string }` — прогін через
  `@doc-engine.renderDocumentWithStyles(template, buildContext({}, {}))` у try/catch (та сама
  семантика, що `renderPreview`, але без мапінгу параграфів). Повертає укр. повідомлення
  `Помилка в шаблоні: <engine message>`.
- `ENGINE_COMPUTED_FIELDS: string[]` — білий список обчислюваних полів контексту (з `buildContext`:
  plaintiff_name, defendant_name, plaintiff_gender, defendant_gender, children, has_children,
  n_children, first_child_gender, monthly_delta, price_of_claim, court_fee, court_fee_is_floor,
  ai, ai_raw, answers + помічники each-скоупу @index/@index1/@first/@last, this).
- `unknownVariables(template, formFieldIds): string[]` — інтерполяції `{{path}}` з шаблону, чий
  корінь path не у form-полях і не в білому списку (хелпери/блок-теги/style-директиви — не змінні).
  Токенізація — легка regex по `{{…}}` з відсіюванням `#if/#each/else/!style/!коментар/хелпери`
  (список хелперів — з `@doc-engine.HELPERS`).
- `buildRevisionSnapshot(service): Json` — повний знімок рядка services для `service_revisions`.

`apps/client/src/admin/lib/serviceTemplate.ts`:
- `publishTemplate(supabase, serviceId, draft, userId)`: (1) validateTemplate → блок при помилці;
  (2) select повного рядка services; (3) insert снапшота в service_revisions
  (`reason='publish_template'`); (4) update `document_template = draft`. Послідовно, з чесними
  помилками кожного кроку (без транзакції — прийнятно для адмін-інструмента v1; зазначити в коді).

## G3 — UI: вкладка «Шаблон» у `ServiceEditPage.tsx`

- Розширити select існуючого loader-а: `+ document_template, document_template_draft, generation_mode`.
- Стейт: `draft` (init: draft ?? published ?? ''), `publishedTemplate`, dirty-інтеграція з наявним
  `isDirty`. «Зберегти чернетку» → update `document_template_draft` (без гейта). «Опублікувати» →
  `publishTemplate` → toast успіх/помилка, оновити publishedTemplate.
- Новий компонент `apps/client/src/admin/components/TemplateEditorTab.tsx`:
  - desktop (xl+): grid 2 колонки — textarea (font-mono, h-full) + панель прев'ю з табами
    «Документ» / «Розкладка» (реюз `DocumentPreview` / `DocumentLayoutPreview`, template=draft);
  - статус-рядок (чернетка ≠ опубліковане / парс-помилка / невідомі змінні жовтим);
  - `< xl`: прев'ю + повідомлення «Щоб редагувати шаблон — зайдіть з комп'ютера».
- Вкладки: `type Tab = 'form' | 'template' | 'ai' | 'settings'`; порядок Форма · Шаблон · AI · Опції.
- Слаг для sample-прев'ю: `config.service_id` (як ServiceViewPage передає slug).

## G4 — Тести + прогін

- Unit (vitest): `templateGate.test.ts` — валідний шаблон ok; незакритий `{{#if}}` → ok:false з укр.
  префіксом; unknownVariables: form-поле не флажиться, обчислюване не флажиться, вигадане флажиться,
  хелпери/style/блок-теги не флажаться. `serviceTemplate.test.ts` — publishTemplate: блок на кривому
  шаблоні (жодного запису), порядок snapshot→update на валідному (мок supabase).
- Компонентний smoke: вкладка рендериться, «Опублікувати» задизейблено при парс-помилці.
- Прогін: `npm run test`, `tsc -b`, `npm run lint`, `npm run build:admin`.
- E2E Playwright «Ольга без SQL» — СКЕЛЕТ у сесії 1 (сценарій як коментар/skip), повний прогін —
  фінал сесії 2 (коли з'являться кнопки стилів, які сценарій натискає).

## Сесія 2 (наступна гілка) — 3 паралельні агенти
(а) `TemplateToolbar.tsx` + `lib/insertAtCursor.ts` · (б) `VariablePalette.tsx` (form_config +
ENGINE_COMPUTED_FIELDS + diff-бейджі) · (в) annotate-режим чипів у `documentStyles.ts`/`DocumentPreview`
+ панель валідації. Інтеграція + E2E + демо.

## Сесія 3 — блоки Фаза 0 + каркас + історія
Мітки блоків (detectBlocks по draft) · «Створити з каркаса» (скелет позову, 8 блоків) · «Історія
змін» (список ревізій + «Відновити» через publishTemplate-подібний потік з reason='restore').
