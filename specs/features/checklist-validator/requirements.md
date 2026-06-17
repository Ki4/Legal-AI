# checklist-validator — Requirements

> Tier 2 spec (issue #4 / IMPROVEMENTS #39). Перевірка, що згенерований документ містить усі юридично обов'язкові елементи для свого типу.
> Тригер Tier 2: «зачіпає юридичну коректність документа — помилка = некоректний позов» (SDD-GUIDE.md).

---

## 1. Проблема (стан зараз)

- Шаблони `divorce.document.txt` / `alimony.document.txt` кодують обов'язкові пункти позову (підсудність, місце проживання дітей, судовий збір тощо) через `{{#if}}`-гілки, прив'язані до відповідей форми.
- Паритет-тести (263/132) доводять, що шаблон == legacy builder байт-у-байт, але **нічого не перевіряє, що сам набір гілок покриває обов'язкові юридичні елементи**. Майбутня правка шаблону (нова умова, видалений пункт) може мовчки видалити обов'язковий пункт — паритет-тести цього не зловлять, бо звіряють тільки зі старим (тим самим) текстом.
- Оригінальна постановка issue #4 припускала, що документ генерує LLM (Groq) і при провалі — регенерація. Це не відповідає поточній архітектурі: divorce/alimony на `generation_mode='template'` (doc-engine, #34) — без LLM у шляху взагалі; hybrid (alimony-change) використовує AI лише для одного абзацу обґрунтування, обов'язкові пункти так само рендеряться детерміновано тим самим движком.

## 2. Архітектура

```
services (Supabase)                         n8n Build Document footer
┌────────────────────────────┐              ┌──────────────────────────────────┐
│ required_checklist: JSONB   │ ───────────► │ після renderDocumentWithStyles:   │
└────────────────────────────┘              │  validateChecklist(text, ctx, cl) │
                                             │  → _checklist_result у return     │
SSoT у git:                                 └──────────────────────────────────┘
n8n/templates/services/<slug>.checklist.json         │
                                                       ▼
                                          Update Case Abstention (existing node)
                                          + checklist_failed field → cases table
                                                       │
                                                       ▼
                                          DashboardPage.tsx — badge (Сергій бачить без Ольги)
```

Перевірка — **детермінована, без LLM**: regex-присутність очікуваного тексту в фінальному рендері, за умовою (`appliesIf`), що визначає, чи пункт застосовний до цього кейсу. Без LLM-викликів, без вартості, без галюцинацій — узгоджено з принципом проєкту «95% документа детерміновано за задумом».

## 3. Контракт

### 3.1 Мова умов `appliesIf` — переюзана, не нова

`render-document.js` вже має парсер булевих виразів для `{{#if}}` (`parseExpr` → AST, `evalExpr` → bool, підтримує `and`/`or`/`not`, `==`/`!=`/`>`/`<`/`>=`/`<=`). `evalExpr` додається до `module.exports` (раніше — внутрішня функція). `appliesIf` у checklist-конфізі використовує ТОЧНО той самий синтаксис, що автор шаблону вже бачить у `{{#if}}` — без другої мови умов.

`evalCondition(exprStr, context)`: спецвипадок `"true"` → завжди застосовується; інакше `evalExpr(parseExpr(exprStr, 0), [context])`.

### 3.2 Формат checklist-конфігу (golden, SSoT у git)

`n8n/templates/services/<slug>.checklist.json`:
```json
{
  "slug": "<slug>",
  "items": [
    {
      "id": "snake_case_id",
      "description": "Людинозрозумілий опис (укр.) — що має бути в документі і чому (стаття закону)",
      "appliesIf": "true | вираз у синтаксисі render-document.js",
      "mustMatchAny": ["regex1", "regex2", "..."]
    }
  ]
}
```
- `mustMatchAny` — масив regex (unicode-aware, `u`-флаг); пункт «задоволений», якщо текст матчить **хоч один**. Це навмисно: один юридичний обов'язок інколи виконується двома різними формулюваннями (напр. місце проживання дітей — або вирішено в цьому позові, або явно винесено в окреме провадження при `children_dispute == 'separate'`). Одне фіксоване рядкове порівняння дало б фальшиве «не виконано» на легітимному документі.
- Пункти з `appliesIf` що оцінюється в `false` для даного кейсу — пропускаються (не входять ні в `missing`, ні в `satisfied`).

### 3.3 Функція валідатора

`n8n/templates/validate-checklist.js`:
```js
validateChecklist(renderedText, context, checklist)
  → { ok: boolean, missing: [{id, description}], satisfied: [{id, description}] }
```
`context` — той самий об'єкт, що повертає `buildContext(answers, ai)` у render-document.js (уже обчислений у Build Document footer для рендеру — повторне обчислення не потрібне).

### 3.4 Точка інтеграції — існуючий footer, не нова нода

Build Document footer (`scripts/sync-build-document-node.mjs`) уже рендерить документ і має `context` під рукою для `template`/`hybrid` режимів. Додається: якщо `svc.required_checklist` непорожній — викликати `validateChecklist`, додати `_checklist_result` у `return [{ json: {...} }]`. Нової n8n-ноди немає.

### 3.5 Персист — існуюча нода, нове поле

`Update Case Abstention` (session 29, `scripts/sync-abstention-node.mjs`) — Supabase-нода, що вже пише `cases.abstained` паралельною гілкою від Build Document для КОЖНОГО кейсу (не лише hybrid). Додається ще один `fieldsUi.fieldValues` запис: `checklist_failed = {{ $json._checklist_result?.ok === false }}`. Нової Supabase-ноди немає.

## 4. Зміни Supabase

**Migration 021** (`021_checklist_validation.sql`):
- `services.required_checklist JSONB NOT NULL DEFAULT '[]'::jsonb` + COMMENT (SSoT = git файл, upload через `upload-document-checklist.mjs`).
- `cases.checklist_failed BOOLEAN DEFAULT NULL` (дзеркало migration 020 `abstained`).

Без backfill-логіки: порожній `'[]'::jsonb` = перевірка не застосовується (як `document_template IS NULL` у doc-engine).

## 5. Admin-видимість

`DashboardPage.tsx` — другий бейдж поруч з «Abstention rate» (та сама форма запиту, `not('checklist_failed','is',null)`, amber коли є провали за останні 30 днів). Сергій бачить провали без Ольги і без нової сторінки.

## 6. PII / безпека

Без змін у потоці PII. Checklist-конфіг не містить персональних даних — лише regex-паттерни юридичних формулювань.

## 7. Поза scope (свідомо)

- Admin-UI редактор checklist для юриста (як і document_template — поки файл у git + upload-скрипт).
- Розширення checklist на alimony-change (hybrid) — список лише для divorce + alimony в цій фічі; hybrid-пілот ще `disabled`.
- Блокування відправки документа при провалі — v1 лише алертить/флагає (`checklist_failed`), не блокує доставку клієнту (хибний негатив на живому клієнті — гірший ризик, ніж пропущений рев'ю-сигнал).
