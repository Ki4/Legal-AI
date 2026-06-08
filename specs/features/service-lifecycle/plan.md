# Plan — service-lifecycle

> Feature branch: `feature/service-lifecycle`
> Roadmap link: v1 «Моніторинг змін законів (watched_laws)» 🟡 + master-context «Етап B».
> Scope decision (interview 2026-06-08): **backend-фундамент**. БЕЗ admin-UI, БЕЗ CRON.

## Мета

Зробити послугу самодостатнім **керованим юнітом** із життєвим циклом:
кожна послуга має `status` (kill-switch), а зміни законів фіксуються в аудит-лог
(`law_change_log`). Юрист може зняти послугу з продажу **флипом колонки, без деплою** —
коли закон змінився, а шаблон ще не пере-валідований.

Це юридичний запобіжник (quality bar = court-ready) і фундамент під майбутній
HITL-флоу та GraphRAG (той самий «закон → послуги → ревʼю» каркас).

## Ключові рішення (з інтерв'ю)

1. **Обсяг** = backend-фундамент. Admin-UI (кнопка флипу + панель ревʼю) — окрема наступна фіча.
2. **`needs_review` блокує користувача так само, як `disabled`.** Не віддаємо потенційно
   застарілий документ. Послуга обслуговує тільки в статусі `active`.
3. **Без CRON.** Зміну закону фіксує людина/скрипт вручну → запис у `law_change_log` +
   флип залежних послуг у `needs_review`. Автоматичний моніторинг zakon.rada.gov.ua —
   пізніша фіча; `scripts/check-law-updates.mjs` лишається референсом.
4. **`law_deps` = розширення наявної `services.watched_laws` (JSONB, міграція 007).**
   Зворотний індекс «закон → які послуги залежать» будується запитом, нової relations-таблиці немає.

## Enforcement points (де працює kill-switch)

| Шлях | Файл | Роль |
|------|------|------|
| **Write (генерація)** — авторитетний | `n8n/workflows/current/form-submit.json` | guard після «Get Service»: якщо `status != 'active'` → ввічлива відмова, генерація НЕ запускається. Захищає навіть пересланий/кешований лінк. |
| **Read (бот-меню)** | `n8n/workflows/current/main-bot.json` | «Get Service» → якщо не `active`, надіслати «послуга тимчасово недоступна» замість кнопки TWA. |
| **Read (форма TWA)** | `apps/client/src/App.tsx` | додати `status` у select form_config; якщо не `active` — показати «недоступно» замість форми. |

Авторитетний — n8n write-path. Read-шляхи = захист у глибину + UX.

## Task groups (послідовність)

- **G1 — Схема (migration 011).** `services.status` (`active|needs_review|disabled`,
  CHECK, DEFAULT `disabled`) + backfill (`divorce`,`alimony` → `active`; решта лишається `disabled`).
  Таблиця `law_change_log`. Узгодити з наявним `needs_law_review` (status — авторитетний).
- **G2 — Write-path guard (form-submit).** Нода-перевірка статусу після «Get Service»;
  гілка відмови → Telegram-повідомлення + Respond.
- **G3 — Read-path guards.** `App.tsx` (select `status`, екран «недоступно») +
  `main-bot.json` (повідомлення замість кнопки).
- **G4 — Ручні lifecycle-інструменти.** Скрипт для (а) флипу статусу послуги,
  (б) запису зміни закону в `law_change_log` + флип залежних послуг у `needs_review`.
- **G5 — Тести + доки.** Unit-тест для guard-логіки (status gate). Оновити
  DECISIONS.md, changelog, roadmap (`watched_laws` пункт → частково закрито).

**Sequence:** G1 → G2 → G3 → G4 → G5.

## Поза scope (явно НЕ робимо в цій фічі)

- Admin-UI: кнопка флипу статусу, бейдж у списку послуг, панель ревʼю `law_change_log`.
- Автоматичний CRON-моніторинг zakon.rada.gov.ua.
- Нормалізована таблиця `law_deps` / `law_relations` (це v2 GraphRAG).
- Будь-яка зміна формату документів чи form_config.