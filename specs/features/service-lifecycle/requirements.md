# Requirements — service-lifecycle

## Form fields

**Немає.** Це інфраструктурна / lifecycle-фіча, не нова послуга для користувача.
Жодних нових полів форми, жодного нового form_config.

## PII

**Не торкається PII.** `status` — стан послуги; `law_change_log` — метадані про закони
(slug, назва, дати редакцій, дія юриста). Персональних даних немає →
**вимога шифрування не застосовується.**

## Supabase changes (migration 011)

### 1. `services.status` — kill-switch
- Нова колонка `status TEXT NOT NULL DEFAULT 'disabled'`.
- `CHECK (status IN ('active', 'needs_review', 'disabled'))`.
- Семантика:
  - `active` — послуга обслуговує користувачів (єдиний стан, де дозволена генерація).
  - `needs_review` — закон змінився / шаблон не пере-валідований → **блокується як disabled**.
  - `disabled` — вимкнена вручну (за замовчуванням для нових послуг до sign-off юриста).
- **Backfill:** `divorce`, `alimony` → `active`. Усі інші наявні рядки лишаються `disabled`
  (стале/placeholder = автоматично вимкнено — це бажано).
- DEFAULT `disabled` тому, що quality bar вимагає sign-off Ольги перед продакшеном
  кожної нової послуги.

### 2. `services.needs_law_review` (наявний, міграція 007) — узгодження
- Колонка лишається без зміни схеми.
- **`status` стає авторитетним джерелом правди** для того, чи обслуговувати послугу.
  `needs_law_review` = довідковий прапорець «закон під підозрою». Майбутня фіча може
  його прибрати. Зараз: коли фіксуємо зміну закону, ставимо `status='needs_review'`
  (блокує) — це головне.

### 3. `law_change_log` — аудит змін законів (нова таблиця)
Призначення: незмінний журнал «закон X змінився → які послуги зачеплено → що зробив юрист».
Поля (на рівні вимог, не фінальний DDL):
- `id` — surrogate PK.
- `law_slug`, `law_title` — який закон (узгоджено зі `slug` у `watched_laws`).
- `old_revision_date`, `new_revision_date` — дати редакцій (стара відома → нова виявлена).
- `detected_at` (default now), `detected_by` — `'manual'` зараз, `'cron'` у майбутньому.
- `affected_services` — масив slug послуг, виведений із `watched_laws` (зворотний індекс).
- `action` — `'flagged' | 'reviewed' | 'dismissed'` (default `'flagged'`).
- `reviewed_by`, `reviewed_at`, `notes` — заповнюються коли юрист закрив ревʼю.
- **RLS:** як службова таблиця — доступ лише `service_role` (узгодити з міграцією 005).

## n8n changes

### form-submit.json (write-path, авторитетний guard)
- Після ноди **«Get Service»** додати перевірку: чи `status === 'active'`.
- Якщо НЕ active → коротке замикання на гілку відмови:
  - НЕ створювати case, НЕ викликати AI, НЕ генерувати документ.
  - Відповісти користувачу ввічливим повідомленням (укр.): послуга тимчасово недоступна,
    зверніться пізніше.
  - Respond на webhook коректним статусом (не 500).
- Існуюча валідна гілка (`active`) працює як раніше.

### main-bot.json (read-path, бот-меню)
- На шляху, де «Get Service (high/low)» → «Send TWA Button»: якщо `status != 'active'`,
  надіслати повідомлення «послуга тимчасово недоступна» замість кнопки TWA.
- Примітка: меню послуг у боті зараз частково захардкоджене (Switch-нода) — повний
  динамічний каталог поза scope; тут лише не віддаємо кнопку на неактивну послугу.

## Frontend changes

### apps/client/src/App.tsx
- У запиті form_config додати `status` до `select` (`form_config, title, status`).
- Якщо `status !== 'active'` → показати екран «Послуга тимчасово недоступна» замість
  рендеру форми (не вантажити форму неактивної послуги).
- Кеш: не кешувати/не показувати форму для неактивної послуги.

## Manual lifecycle tooling (G4)

Скрипт(и) у `scripts/` (Node.js, бо n8n/Supabase-узгодженість; не PowerShell):
- **Флип статусу:** задати `status` послузі за slug (`active|needs_review|disabled`).
- **Фіксація зміни закону:** записати рядок у `law_change_log` + виставити
  `status='needs_review'` усім послугам, у чиїх `watched_laws` є цей `law_slug`
  (зворотний індекс запитом). `detected_by='manual'`.
- Базуватись на наявному `scripts/check-law-updates.mjs` як референсі.

## Constraints / що НЕ чіпати

- **НЕ** змінювати логіку генерації документів, шаблони (`*-document.js`), form_config.
- **НЕ** будувати admin-UI (окрема фіча).
- **НЕ** реалізовувати CRON / скрапінг zakon.rada.gov.ua.
- **НЕ** створювати нову нормалізовану таблицю звʼязків (lawʼdeps лишається в `watched_laws` JSONB).
- n8n оновлювати **тільки через Node.js API**, не PowerShell (кирилиця), і після
  оновлення відновлювати реальні ключі в Global Config (placeholders у JSON).
- Міграцію застосовувати через Supabase SQL Editor (DDL не йде через REST).
- Жодних секретів у коді / JSON (правило проекту).