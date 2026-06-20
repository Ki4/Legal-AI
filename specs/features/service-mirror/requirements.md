# service-mirror — Requirements

> Контракт фічі. Слайс 1 (дзеркало, read-only) — нормативно; слайси 2-3 — контур (деталізуються у своїх гілках).

## §1. Дані, що читаємо (слайс 1)

Усе з рядка `services` (вже існує) + допоміжне:
- `services`: `id, slug, title, description, icon, price, status, form_config, document_template, generation_mode`.
- `law_chunks`: `law_code, article, is_stale` — для badge «застаріло» на цитатах.
- `law_change_log`: `affected_services, action` — для badge «змінено» (pending) на послузі/статтях.

Жодних записів у `services`. Жодного доступу до `cases` PII (лічильник справ — поза слайсом 1; за потреби пізніше через aggregate-RPC без PII).

## §2. Форма «як є»

Для кожного табу `form_config.tabs[]` → поля `form_config.steps[]` з `tab === tab.id`, у порядку масиву. На поле показати:
- **Підпис** (`label`); якщо порожній — «Без назви» (сигнал якості).
- **Тип** людською мовою: `text→Текст`, `textarea→Великий текст`, `date→Дата`, `boolean→Так/Ні`, `choice→Вибір (один)`, `multicheck→Вибір (кілька)`, `number→Число`, `phone→Телефон`.
- **Обов'язкове** — позначка, якщо `required`.
- **Варіанти** — для `choice`/`multicheck` перелічити `options[].label`.
- **Умова показу** — якщо є `show_if`, відрендерити природною мовою: «показується, якщо `<label поля>` `<дорівнює|не дорівнює>` `<value>`». `value=true→«Так»`, `false→«Ні»`, інакше — як є. Поле умови шукаємо за `id` у `form_config.steps`; якщо не знайдено — показати `id` + позначку «⚠ поле умови не існує» (gap).
- **`field.id`** — НЕ показувати в основному вигляді (лише за «технічні деталі», згорнуто), щоб не лякати юриста.

## §3. Анатомія документа + health

### §3.1 Парсинг шаблону (`analyzeTemplate`)
Вхід — `services.document_template` (текст DSL). Вихід:
- `usedFieldIds` — усі `field_id`, на які шаблон посилається: токени `{{id}}`, `{{#if id …}}`, умови. (Службові токени `{{!style:…}}`, `{{!comment}}` — ігнорувати.)
- `placeholders` — повний список плейсхолдерів (для відображення).
- `citations` — статті законів за тим самим regex, що в `scripts/lib/citations.mjs` (напр. `ст. 192 СК`, `ст. 27 ЦПК`).

Якщо `document_template` порожній/`null` → `analyze` повертає порожні масиви; це окремо обробляється в health (🔴).

### §3.2 Зіставлення (`diffFormVsTemplate`)
Нехай `F = {id формою}` (з `form_config.steps`), `U = usedFieldIds`.
- **usedFields** = `F ∩ U` — поля, що йдуть у документ (ок).
- **unusedFields** = `F \ U` — форма питає, документ ігнорує (🟡 gap «зайве питання»).
- **unmatchedPlaceholders** = `U \ F` — документ чекає дані, форма не питає (🔴 gap «битий шаблон»), з винятком службово-обчислюваних id (напр. `court_name`, `case_number` тощо, які доставляє пайплайн, а не форма) — список винятків `PIPELINE_PROVIDED` у `serviceAnatomy.ts`, документований і покритий тестом.

### §3.3 Застарілі цитати
Стаття з `citations` вважається застарілою, якщо у `law_chunks` за відповідним `law_code` є `is_stale = true`, або у `law_change_log` є рядок з `action='flagged'` (pending), де `slug послуги ∈ affected_services`. Кожна така стаття → badge «застаріло/змінено».

### §3.4 Health-світлофор (`serviceHealth`)
- **🔴 red** (послуга не згенерує коректно), якщо будь-що:
  - `document_template` порожній (для `generation_mode ∈ {template, hybrid}`);
  - `unmatchedPlaceholders` непорожній (шаблон чекає поле, якого немає у формі й немає в `PIPELINE_PROVIDED`);
  - є поле `show_if` з неіснуючим полем умови.
- **🟡 amber** (працює, але є на що звернути увагу), якщо немає red і будь-що:
  - `unusedFields` непорожній (форма питає зайве);
  - є застаріла/змінена цитата (§3.3);
  - є поле з порожнім `label`.
- **🟢 green** — інакше.
- Вихід: `{ level, reasons: string[] }`, де `reasons` — людські рядки укр. мовою для показу («Документ не має шаблону», «Поле „X" не використовується в документі», «Стаття 192 СК позначена як змінена» …).

Legacy `generation_mode='js'` (divorce/alimony portовані на template, але можливі історичні рядки) → health не вимагає `document_template` (🟢/🟡 за рештою правил), з reason-приміткою «генерація через legacy-білдер».

## §4. Закони — список (слайс 1)
Для кожної статті з `citations`:
- текст статті (як у шаблоні, напр. «ст. 192 СК»);
- лінк на джерело: якщо є відповідний `law_chunks.law_code` → лінк на zakon.rada за `law_code`; інакше — пошуковий лінк-фолбек;
- badge «застаріло»/«змінено» за §3.3.
Граф (вузли/рёбра `law_relations`) — **не** в цьому слайсі.

## §5. Роутинг і доступ
- `services/:id` → `ServiceViewPage` (read-only). `services/:id/edit` → існуючий `ServiceEditPage`.
- `DashboardPage`: клік по картці → view; ✏️ → edit; 👁 (перегляд форми клієнта) лишається.
- Health-badge на картці в каталозі (компактний: лише колір + tooltip з reasons).
- Доступ — як зараз (`AdminGuard`, будь-який залогінений). Ролі/RLS — поза скоупом.

## §6. Слайс 2 — Коментарі (контур)
Таблиця `service_notes`: `id, service_id (fk), author_email, body, status ('open'|'done') default 'open', created_at`. RLS authenticated: SELECT/INSERT/UPDATE `USING (true)` (патерн `law_change_log` migration 013); DELETE — service_role. Панель на `ServiceViewPage` + dev-інбокс (усі нотатки).

## §7. Слайс 3 — Заявка на послугу (контур)
Таблиця `service_requests`: `id, title, description, laws_text, example_file_path, status ('open'|'done'), requested_by_email, created_at`. Файл прикладу → приватний Storage bucket `service-examples` (signed URL для dev). DOCX/PDF, ліміт розміру. Форма заявки + dev-інбокс.

## §7.1 Безпека
- Приклад документа від юриста — це **шаблон-зразок**, не клієнтський PII; bucket приватний, доступ через signed URL лише залогіненому. (На відміну від `cases` — їх не чіпаємо.)
- Жодних секретів у коді; Storage-ключі — через існуючий Supabase anon/authenticated клієнт.

## §8. Нефункціональні
- TS strict; `import type {}`; без `any` без коментаря.
- Анатомія рахується в браузері, синхронно, миттєво (дані вже в пам'яті після завантаження послуги) — без додаткових запитів окрім `law_chunks`/`law_change_log` для badge.
- UI укр.; стиль — наявний dark-admin (slate); чисто і структурно, без над-дизайну (граф-viz пізніше).
