# doc-engine — Validation

> Scorecard. Фіча вважається завершеною, коли всі пункти ✅.

## G1 — Движок

- [x] Юніт-тести покривають кожну конструкцію DSL з requirements §3 (підстановка+fallback, `|raw`, if/else-if/else, ==/!=/>/<, and/or/not, each + `@index1`/`@first`/`@last`, поглинання рядків, `{{! }}`, ігнор `{{!style:}}`) — 56 тестів
- [x] Помилки шаблону (незакритий блок, невідомий хелпер) → зрозуміла помилка з позицією, НЕ мовчазний пропуск
- [x] Парсер не використовує `eval`/`new Function` (окремий тест сканує сирці движка)
- [x] Кожен хелпер має тести (formatDate, formatDateQuoted, gender, plural, alimonyFraction, concat)

## G2 — Пілот alimony

- [x] Паритет-матриця: рендер шаблону === старий `buildAlimonyDocument` на програмному переборі гілок — **117 parity-тестів**: матриця 72 комбінації (marital_status × alimony_type × діти 0/1/3 × ai-fallback) + 40+ поодиноких перемикачів гілок — 100% рівність
- [x] Голдени: 3/3 сценарії байт-у-байт з `test-data/alimony/expected/*.txt`
- [x] Root vitest повністю зелений: **385/385** (було 213, +172)

## G3 — Схема

- [x] Migration 014 застосовано (Supabase SQL Editor, 2026-06-11); `generation_mode` має CHECK, default `'js'`; усі 5 послуг = `'js'` — верифіковано через REST
- [x] `upload-document-template.mjs` ідемпотентний (повторний запуск = no-op); `--dry-run` не пише
- [x] Шаблон alimony у БД === файлу в git (round-trip звірка в скрипті, 10225 chars)

## G4 — Live

- [x] Деплой form-submit: 28→28 нод (лише jsCode Build Document), 10 credential-прив'язок збережено
- [x] e2e ДО флипу (`test-webhook.mjs a1`): exec 35 `success` — legacy-шлях без регресій
- [x] Флип alimony → `'template'`: e2e `a1` (exec 36) + `a2` (exec 37) — обидва `success` до `Send Doc Link`; live `_content` **байт-у-байт === локальний движок === legacy builder** на точних вхідних даних виконання (answers + ai витягнуті з exec через n8n API). Template-шлях підтверджено станом БД на момент виконання (mode=template + template present → dispatch детермінований)
- [x] Rollback-перевірка: флип назад `'js'` → e2e exec 38 `success` → знову `'template'`
- [x] divorce (неторкнута, `'js'`): e2e сценарій 2 — exec 39 `success`

## G5 — Доки

- [x] DECISIONS: розділ «Doc-engine» (шаблон-дані vs JS-код, не-AI, байт-паритет, розриви сторінок = правила-не-позиції, анти-дрейф генерованої ноди)
- [x] IMPROVEMENTS: #49 (declension-конвенція), #50 (фаза 2 Google Docs стилі), #51 (admin-редактор шаблону); #17 позначено вирішеним інакше
- [x] roadmap оновлено (пункт закрито + 3 хвости); runbook `docs/runbooks/document-template-editing.md`
- [ ] changelog + session-summary; Issue закрито `Closes #34` при merge

## Definition of Done

Юрист (через розробника поки немає admin-редактора) може змінити формулювання в документі alimony, відредагувавши **текстовий файл** і запустивши upload-скрипт — без жодної зміни JS-коду і без передеплою n8n. Документ у проді байт-у-байт відповідає голденам. ✅ Досягнуто (процес: runbook `document-template-editing.md`)
