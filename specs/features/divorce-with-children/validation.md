# divorce-with-children — Validation

> Scorecard. Фіча завершена, коли всі пункти ✅. Порядок = `plan.md` (G1→G3).
> Менший за `alimony-change`: чисто детерміновано, тож немає retrieval-eval / groundedness-eval / abstention-контракту — лише parity + regression.

## G1 — Форма + шаблон

- [x] `children_live_with` має третю опцію `court`; форма показує її в `DynamicLegalFormBuilder`
- [x] `visitation_dispute` показується **тільки** коли `children_live_with ∈ {plaintiff, defendant}` (НЕ при `both`/`court`) — перевірено `evalCondition` з `any` (live form_config + client unit-тести `conditions.test.ts`, уже існуючі, без змін — `any`/`all` вже підтримані)
- [x] `visitation_schedule_text` показується **тільки** коли `visitation_dispute=='none'`
- [x] Шаблон: гілка `children_live_with=='court'` рендерить коректний текст, не ламає існуючі `plaintiff`/`defendant`/`both`
- [x] Шаблон: абзац участі у вихованні — 3 стани (узгоджений текст / «окреме провадження» / відсутній абзац при `both`/`court`)
- [x] Шаблон: новий пункт «ПРОШУ» (графік) рендериться лише коли застосовний (`visitation_dispute=='none'` і є текст)
- [x] **Знайдено й виправлено під час тестів:** `children_live_with=='court'` залишав пункт 5 із текстом «...з ________.» (порожній плейсхолдер замість сторони) — нісенітниця для запиту «суд визначить». Виправлено: для `court` пункт 5 закінчується одразу після ПІБ/дати дітей, без «з ...»-частини.

## G2 — Тести (parity + regression)

- [x] **Регресія: усі 263 існуючих тести `divorce-template-parity.test.js` — без модифікації очікуваних виводів, без змін фікстур** — підтверджено (263/263 ✅ до і після, нуль діффів у тесті)
- [x] Нові parity-кейси (`divorce-children-visitation.test.js`, 9 тестів, прямі асерції на вивід движка — без legacy-builder еквіваленту):
  - [x] `children_live_with='court'` — коректний текст пункту 5, без «з ________»
  - [x] `visitation_dispute='none'` + текст графіка, **без** аліментів/майна/боргів — пункт = 6
  - [x] `visitation_dispute='none'` + текст графіка, **з** аліментами + майном + боргами — повний ланцюжок 5/6/7/8/9 коректний
  - [x] Графік незалежний від `children_dispute='separate'` (residence-спір) — рендериться як пункт 5, коли саме місце проживання спірне, а графік погоджений
  - [x] Порожній `visitation_schedule_text` → жодного абзацу/пункту (без плейсхолдера — свідомий вибір, нема що показувати)
  - [x] `visitation_dispute='separate'` — абзац-заглушка, **без** нового пункту «ПРОШУ»
  - [x] `children_live_with='both'` і `'court'` — нові `visitation_*` поля ігноруються навіть якщо задані (template-level guard, не лише форми)
- [x] Root vitest 981/981 ✅ (було 972, +9) · client vitest 92/92 ✅ · tsc clean

## G3 — Доки + live

- [x] `docs/architecture/DECISIONS.md` — запис: опіка→ст.157 СК графік участі, чому без hybrid, чому новий пункт ОСТАННІЙ у нумерації
- [x] `specs/roadmap.md` v2.3 — «Розлучення з дітьми» позначено ✅ з посиланням на цю спеку
- [x] `scripts/upload-document-template.mjs divorce` — заливка оновленого шаблону, round-trip звірка ✅
- [x] `node scripts/update-form-configs.mjs` — заливка оновленого form_config (усі 5 послуг; **виявлено й виправлено** попутний баг: скрипт мав биті імпорт-шляхи з epoxy-структури до монорепо-рефакторингу + залежав від `@supabase/supabase-js`, недоступного з кореня — переписано на спільний REST-клієнт `scripts/lib/supabase-rest.mjs`, перейменовано `.ts`→`.mjs`)
- [x] Live smoke-тест: `scripts/test-webhook.mjs 5` (новий сценарій, додано) → execution у живому n8n, `Build Document` без помилок, `_checklist_result.ok===true`, рендер містить новий абзац (ст.157 СК) і пункт «7» (residence=5, alimony=6, visitation=7) — підтверджено через n8n REST `/executions/:id?includeData=true`
- [x] Live regression: той самий execution підтверджує пункти 1-6 незмінні відносно існуючої логіки
- [ ] `gh issue close 28` з посиланням на merge-коміт — буде зроблено при мерджі в main
- [x] changelog + session-summary

**Не пов'язана знахідка (зафіксована, не блокує):** execution провалився на кроці `Copy Template` (Google OAuth `invalid/expired/revoked`) — той самий клас інциденту, що в session 15 (OAuth consent screen у Testing-режимі протухає за 7 днів простою). Не регресія цієї фічі — `Build Document` (моя зміна) відпрацював коректно ДО цього кроку. Потребує переавторизації Google OAuth (через ngrok-origin, як у session 15) — за Сергієм.

## Edge cases (обов'язково)

- [ ] `visitation_dispute='none'` але `visitation_schedule_text` порожній → абзац/пункт **не** рендериться (як зараз `property_details` порожній → секція майна не йде, навіть якщо `has_joint_property=true`... уточнити: чи поточна форма дозволяє `none`+порожній текст; якщо так — трактувати як «немає змістовного графіка», без вигадування плейсхолдера `________` — на відміну від інших полів типу `divorce_reasons`)
- [ ] `children_live_with` змінюється з `'plaintiff'` на `'court'` ПІСЛЯ того, як користувач уже заповнив `visitation_dispute`/`visitation_schedule_text` (форма) → поля ховаються (show_if), але якщо answers-об'єкт зберіг старі значення в payload — шаблон **також** має guard'ити (не лише форма), щоб «застряглі» дані не потрапили в документ
- [ ] Декілька дітей з різним режимом проживання (теоретично) — поза scope; форма зараз має один `children_live_with` на всіх дітей разом (як і зараз), не per-child

## Definition of Done

Користувач, що подає форму «розлучення» з дітьми, може (а) вказати, що місце проживання визначить суд, і (б) зафіксувати узгоджений графік участі у вихованні дитини тим з батьків, хто проживає окремо (ст.157 СК), або позначити це спірним питанням для окремого провадження — без жодної зміни поведінки для всіх сценаріїв, що не використовують ці нові поля (263 існуючих тести залишаються золотим стандартом регресії).
