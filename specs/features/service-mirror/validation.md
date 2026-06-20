# service-mirror — Validation

> Definition of Done. Слайс 1 — нормативно. Тикати по мірі виконання; `Closes #N` при merge.

## G1 — Спільна логіка анатомії (`serviceAnatomy.ts`)
- [ ] `analyzeTemplate` витягує `usedFieldIds` з `{{id}}` і `{{#if id …}}`, ігнорує `{{!style:…}}`/коментарі.
- [ ] `analyzeTemplate` витягує цитати тим самим regex, що `scripts/lib/citations.mjs`.
- [ ] **Паритет-тест:** на реальному `divorce.document.txt` і `alimony.document.txt` набір цитат із `analyzeTemplate` === відповідний golden `<slug>.citations.json`.
- [ ] `diffFormVsTemplate` коректно ділить на used/unused/unmatched на фікстурах (включно з `PIPELINE_PROVIDED`-винятками).
- [ ] `serviceHealth` повертає red/amber/green за §3.4 — покрито кейсами: нема шаблону→red; unmatched→red; show_if на неіснуюче поле→red; unused→amber; stale-цитата→amber; порожній label→amber; чистий→green; legacy `js`→не red через відсутній шаблон.
- [ ] Усі функції чисті (без I/O); vitest зелений; tsc clean.

## G2 — Сторінка перегляду
- [ ] `services/:id` рендерить read-only view; `services/:id/edit` — старий редактор. Нічого не пишеться в `services` зі сторінки перегляду (перевірити: жодного `.update`/`.insert`).
- [ ] Форма «як є»: таби + поля з типом людською мовою, обов'язковість, варіанти, `show_if` природною мовою; `field.id` лише під «технічні деталі».
- [ ] `show_if` на неіснуюче поле показує ⚠-позначку.
- [ ] Анатомія: списки used / unused / unmatched + health-світлофор із людськими `reasons`.
- [ ] Порожній/відсутній `document_template` → акуратний стан 🔴 «Документ не має шаблону», без падіння.

## G3 — Каталог + закони
- [ ] Health-badge на картці послуги в `DashboardPage` (колір + tooltip reasons); рахується з тих самих функцій G1.
- [ ] Секція «Закони»: статті → лінки на джерело; badge «застаріло»/«змінено» з `law_chunks.is_stale` / `law_change_log` pending.
- [ ] Послуга без цитат → порожній стан секції, без падіння.

## G4 — Доки
- [ ] `DECISIONS.md` — розворот «білдер→дзеркало», read-only-first, межа анатомії (парсинг ≠ рендер).
- [ ] `IMPROVEMENTS.md` — занесено: граф-viz, слайс2 коментарі, слайс3 заявки, AI-чернетка з прикладу, ролі/RLS, HITL-редагування графа, превʼю документа, email-сповіщення.
- [ ] `roadmap.md` — рядок service-mirror.
- [ ] changelog + session-summary оновлено; issue закрито при merge.

## Перевірка наживо (слайс 1)
- [ ] Відкрити **divorce** (template, повний) → очікувано 🟢 або 🟡 з конкретними reasons; цитати лінкуються; форма читається.
- [ ] Відкрити **alimony-change** (hybrid, `disabled`) → анатомія показує `{{reasoning}}`-секцію коректно; health відображає стан.
- [ ] Створити свідомо «битий» тест-сервіс (поле в формі без використання + плейсхолдер без поля) → 🔴 з правильними reasons. Прибрати після перевірки.
- [ ] Жодного запису в БД зі сторінки перегляду (звірити мережеві запити — лише SELECT).

## Слайс 2 / Слайс 3 (контур — деталізується у своїх гілках)
- [ ] **2:** `service_notes` міграція + RLS; юрист створює/закриває нотатку; dev бачить інбокс.
- [ ] **3:** `service_requests` міграція + Storage bucket `service-examples` (приватний); заявка з файлом зберігається; dev читає через signed URL.

## Стоп-умова (з plan.md)
- [ ] Якщо парсинг `render-document.js` не переноситься в браузер чисто — зафіксувати рішення: окремий міні-парсер (≈30 рядків) + паритет-тест, повний рендер → слайс «превʼю документа». Не тягнути весь движок у бандл.
