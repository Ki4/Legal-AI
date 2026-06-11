# Як змінити текст документа послуги (doc-engine)

> Для послуг з `generation_mode = 'template'` (зараз: **alimony**). Текст позовної заяви —
> це ШАБЛОН (дані), а не код: правка формулювання не потребує передеплою n8n.
> Контракт DSL: `specs/features/doc-engine/requirements.md` §3.

## Швидкий шлях (правка формулювання)

1. Відредагуй файл шаблону: `n8n/templates/services/<slug>.document.txt`
   (наприклад `alimony.document.txt`). Синтаксис:
   - `{{поле}}` — відповідь з форми (порожня → `________`)
   - `{{#if умова}} … {{else}} … {{/if}}` — умовний фрагмент
   - `{{#each children}} … {{/each}}` — повтор по дітях
   - `{{formatDate поле}}`, `{{gender …}}`, `{{plural …}}` — хелпери (список у §3.7 спеки)
   - `{{!style: …}}` — розмітка типографіки (фаза 2; зараз ігнорується)
2. Прожени тести — parity-тести впадуть, якщо зміна зламала структуру:
   `npx vitest run n8n/templates/__tests__/`
   **Очікувано червоні** будуть голдени, якщо ти ЗМІНИВ формулювання (це не баг — вихід
   справді інший). Подивись diff очима, переконайся що зміна саме та, яку хотів.
3. Онови голдени свідомо (після ревʼю око-в-око): згенеруй нові expected-файли через
   `node scripts/test-document.mjs alimony` / онови `test-data/alimony/expected/*.txt`.
4. Залий шаблон у Supabase: `node scripts/upload-document-template.mjs <slug>`
   (є `--dry-run`; скрипт ідемпотентний і звіряє БД===файл після запису).
5. Готово — наступна генерація вже використовує новий текст. Передеплой n8n НЕ потрібен.

## Перевірка наживо

```bash
node scripts/test-webhook.mjs a1   # alimony percent
node scripts/test-webhook.mjs a2   # alimony fixed
```
Документ прийде в Telegram; виконання — у n8n UI (`http://localhost:5678`).

## Rollback

Миттєвий, без деплою — флип колонки назад на legacy JS-білдер:
```sql
UPDATE services SET generation_mode = 'js' WHERE slug = '<slug>';
```
(і назад на `'template'`, коли полагодиш шаблон). Той самий патерн, що status kill-switch.

## Якщо шаблон зламаний (помилка DSL)

Движок кидає помилку з номером рядка (напр. `Unclosed {{#if}} opened at line 42`) —
виконання падає, Error Trigger шле алерт адміну в Telegram, юзер бачить помилку (не тихо).
Полагодь шаблон → upload → повтори.

## Що НЕ можна робити

- ❌ Правити jsCode ноди Build Document інлайн у n8n UI — нода ГЕНЕРОВАНА
  (`scripts/sync-build-document-node.mjs` з дзеркал `n8n/templates/`); інлайн-правку
  зітре наступний деплой.
- ❌ Правити `document_template` напряму в БД — розʼїдеться з git-файлом (SSoT).
  Завжди: файл → upload-скрипт.
- ❌ Додавати нові хелпери «нашвидкуруч» — хелпер = юридично-критична логіка,
  лише через `render-document.js` + тести (+ оновлення §3.7 спеки).
