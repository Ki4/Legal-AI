# Validation — service-lifecycle

Scorecard. Фіча готова, коли всі чекбокси нижче зелені.

## Схема (migration 011)

- [x] `services.status` існує, тип TEXT, `NOT NULL`, DEFAULT `'disabled'` (migration 011, G1).
- [x] CHECK-constraint відхиляє значення поза `active|needs_review|disabled`.
- [x] Backfill: `divorce`=`active`, `alimony`=`active`, решта = `disabled` (верифіковано REST).
- [x] Таблиця `law_change_log` створена з усіма полями з requirements.
- [x] RLS на `law_change_log`: anon-ключ НЕ читає; `service_role` читає/пише.

## Write-path guard (form-submit, авторитетний)

- [x] Послуга `active`: сабміт форми → документ генерується як раніше (regression).
- [x] Послуга `disabled`: сабміт → **case НЕ створюється**, користувач отримує «недоступно»,
      webhook відповідає 503 (G2, live-тест `military` → 503, Insert Case не виконано).
- [x] Послуга `needs_review`: поводиться **так само як disabled** (блок).
- [x] Пересланий/кешований лінк на неактивну послугу блокується на сервері (guard, не лише UI).

## Read-path guards

- [x] `App.tsx`: неактивна послуга → екран «недоступно» (G3, Playwright: `?service=military`).
- [x] `main-bot`: неактивна послуга → повідомлення «недоступно», кнопка TWA НЕ надсилається (G3, live deploy).
- [x] `active` послуга в боті та формі працює без змін (Playwright: `?service=divorce`→форма).

## Manual lifecycle tooling

- [x] Скрипт флипу статусу: `set-status <slug> <status>` (`scripts/service-lifecycle.mjs`) —
      перевірено `needs_review → active` для divorce (узгоджено чистить `needs_law_review`).
- [x] Скрипт фіксації зміни закону: `log-law-change` створює рядок у `law_change_log`
      (`detected_by='manual'`) і виставляє `needs_review` УСІМ залежним послугам.
- [x] `affected_services` у логу збігається з реальним переліком (live-тест: divorce+alimony).
- [x] **Bonus:** ідентичність закону = канонічний URL (реєстр `scripts/law-registry.mjs`),
      НЕ вільний slug — зворотний індекс стійкий до slug-дрейфу. `validate`/`normalize` тримають
      `watched_laws` у канонічному вигляді (виправлено реальний дрейф slug'ів divorce vs alimony).

## Тести + доки

- [x] Unit-тест guard-логіки (status gate) у `n8n/templates/__tests__/` зелений (vitest 153/153).
- [x] `npm run test:docs` — divorce 4/4, alimony 3/3 (regression, генерація не зачеплена). + client vitest 68/68.
- [x] DECISIONS.md: запис «Service lifecycle: status kill-switch + ідентичність закону по URL».
- [x] roadmap.md: `watched_laws` моніторинг позначено як частково закрито (фундамент є, CRON/admin-UI — окремо).
- [x] changelog.md: запис у Pending commits (session 14, G4).

## Definition of Done

- [x] Усі чекбокси вище зелені.
- [x] Олга може зняти послугу з продажу одним флипом (`set-status <slug> disabled`), без деплою — підтверджено вручну.
- [x] Жоден активний шлях (форма/бот/генерація) для `active` послуг не зламано (тести зелені, стан БД чистий).