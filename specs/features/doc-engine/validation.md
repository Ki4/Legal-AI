# doc-engine — Validation

> Scorecard. Фіча вважається завершеною, коли всі пункти ✅.

## G1 — Движок

- [ ] Юніт-тести покривають кожну конструкцію DSL з requirements §3 (підстановка+fallback, `|raw`, if/else-if/else, ==/!=/>/<, and/or/not, each + `@index1`/`@first`/`@last`, поглинання рядків, `{{! }}`, ігнор `{{!style:}}`)
- [ ] Помилки шаблону (незакритий блок, невідомий хелпер) → зрозуміла помилка з позицією, НЕ мовчазний пропуск
- [ ] Парсер не використовує `eval`/`new Function`
- [ ] Кожен хелпер має тести (formatDate, formatDateQuoted, gender, plural, alimonyFraction, concat)

## G2 — Пілот alimony

- [ ] Паритет-матриця: рендер шаблону === старий `buildAlimonyDocument` на програмному переборі гілок (marital_status × alimony_type × діти 0/1/3 × ІПН/паспорт × employed × official_email) — 100% рівність
- [ ] Голдени: 3/3 сценарії байт-у-байт з `test-data/alimony/expected/*.txt`
- [ ] Root vitest повністю зелений (213 існуючих + нові)

## G3 — Схема

- [ ] Migration 014 застосовано; `generation_mode` має CHECK, default `'js'`; усі поточні послуги = `'js'`
- [ ] `upload-document-template.mjs` ідемпотентний; `--dry-run` не пише
- [ ] Шаблон alimony у БД === файлу в git (звірка після upload)

## G4 — Live

- [ ] Деплой form-submit: diff нод очікуваний (лише Build Document), credential-ID збережені
- [ ] e2e ДО флипу (`test-webhook.mjs a1`): legacy-шлях працює, документ у Telegram
- [ ] Флип alimony → `'template'`: e2e `a1` + `a2` — документ генерується ДВИЖКОМ (exec-лог підтверджує template-шлях), контент відповідає голденам
- [ ] Rollback-перевірка: флип назад `'js'` → e2e ok → знову `'template'`
- [ ] divorce (неторкнута, `'js'`): e2e `2` — регресії немає

## G5 — Доки

- [ ] DECISIONS: контракт DSL, режим=властивість послуги, розриви сторінок = правила-не-позиції
- [ ] IMPROVEMENTS: declension-конвенція; фаза 2 Google Docs стилі; admin-редактор шаблону
- [ ] roadmap оновлено; runbook «як змінити текст документа»
- [ ] changelog + session-summary; Issue закрито `Closes #N` при merge

## Definition of Done

Юрист (через розробника поки немає admin-редактора) може змінити формулювання в документі alimony, відредагувавши **текстовий файл** і запустивши upload-скрипт — без жодної зміни JS-коду і без передеплою n8n. Документ у проді байт-у-байт відповідає голденам.