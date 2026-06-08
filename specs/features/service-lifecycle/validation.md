# Validation — service-lifecycle

Scorecard. Фіча готова, коли всі чекбокси нижче зелені.

## Схема (migration 011)

- [ ] `services.status` існує, тип TEXT, `NOT NULL`, DEFAULT `'disabled'`.
- [ ] CHECK-constraint відхиляє значення поза `active|needs_review|disabled`
      (спроба `UPDATE ... status='foo'` → помилка).
- [ ] Backfill: `SELECT slug, status FROM services` → `divorce`=`active`, `alimony`=`active`,
      решта = `disabled`.
- [ ] Таблиця `law_change_log` створена з усіма полями з requirements.
- [ ] RLS на `law_change_log`: anon-ключ НЕ читає; `service_role` читає/пише.

## Write-path guard (form-submit, авторитетний)

- [ ] Послуга `active`: сабміт форми → документ генерується як раніше (regression).
- [ ] Послуга `disabled`: сабміт → **case НЕ створюється**, документ НЕ генерується,
      користувач отримує ввічливе «недоступно», webhook відповідає не-500.
- [ ] Послуга `needs_review`: поводиться **так само як disabled** (блок).
- [ ] Пересланий/кешований лінк на неактивну послугу так само блокується (guard на сервері, не лише в UI).

## Read-path guards

- [ ] `App.tsx`: відкриття форми неактивної послуги → екран «недоступно», форма не рендериться.
- [ ] `main-bot`: вибір неактивної послуги в боті → повідомлення «недоступно», кнопка TWA НЕ надсилається.
- [ ] `active` послуга в боті та формі працює без змін (regression).

## Manual lifecycle tooling

- [ ] Скрипт флипу статусу: `active → disabled` для послуги відображається в БД і одразу блокує генерацію.
- [ ] Скрипт фіксації зміни закону: створює рядок у `law_change_log` (`detected_by='manual'`)
      і виставляє `needs_review` УСІМ послугам, що залежать від цього `law_slug` (через `watched_laws`).
- [ ] `affected_services` у логу збігається з реальним переліком залежних послуг.

## Тести + доки

- [ ] Unit-тест guard-логіки (status gate) у `n8n/templates/__tests__/` зелений.
- [ ] `npm run test:docs` — divorce 4/4, alimony 3/3 (regression, генерація не зачеплена).
- [ ] DECISIONS.md: запис про status kill-switch + `needs_review`=blocking + law_deps у watched_laws.
- [ ] roadmap.md: `watched_laws` моніторинг позначено як частково закрито (фундамент є, CRON — окремо).
- [ ] changelog.md: запис у Pending commits.

## Definition of Done

- [ ] Усі чекбокси вище зелені.
- [ ] Олга може зняти послугу з продажу одним флипом (скрипт), без деплою — і це підтверджено вручну.
- [ ] Жоден активний шлях (форма/бот/генерація) для `active` послуг не зламано.