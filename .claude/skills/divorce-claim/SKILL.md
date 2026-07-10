---
name: divorce-claim
description: >-
  PRODUCT PoC skill (user-facing): knowledge pack for the Ukrainian divorce
  claim interview (позовна заява про розірвання шлюбу), optionally with a
  child alimony claim inside the same package — field guidance and tab order
  for generate_divorce_document params (service slug: divorce). Service is
  currently needs_review, so generate returns a structured refusal (expected
  kill-switch behaviour).
---

> ⚠️ ПРОДУКТОВИЙ скіл (PoC, user-facing) — на відміну від dev-скілів цієї папки. Юридичний зміст — ЧЕРНЕТКА до підтвердження юристом (Olga). Після PoC переїде до skills/ (top-level).

# Divorce claim — пакет «Розірвання шлюбу»

Загальні правила інтерв'ю — у скілі `legal-intake`. Тут — знання пакета.

## ⚠️ Статус: needs_review (очікувана відмова)

Сервіс `divorce` зараз має статус `needs_review` — шаблон на перевірці юриста. `generate_divorce_document` поверне структуровану відмову `service_unavailable`. Це ОЧІКУВАНА поведінка (kill-switch), не збій. Попередь користувача ДО початку інтерв'ю; актуальний статус завжди бери з `list_services` (послугу можуть увімкнути будь-коли).

## Що це за документ

- «ПОЗОВНА ЗАЯВА про розірвання шлюбу» (сервіс `divorce`).
- Подається **до суду за місцем проживання відповідача** (знайти суд: https://court.gov.ua/). Explanation конфіга (`spouse_registered_address`): «Відповідно до ст. 27 ЦПК України позови до фізичної особи подаються за місцем її реєстрації.»
- Структура за шаблоном: шапка → шлюб (дата, орган ДРАЦС, актовий запис, свідоцтво) → згода відповідача → діти → причини розірвання → спільне господарство → спори (діти/майно/борги) → процесуальні повідомлення (ч.3 ст.175 ЦПК) → судовий збір → «ПРОШУ»: 1) провадження, 2) розірвати шлюб, 3) прізвище, 4) судові витрати, далі опційно — місце проживання дітей, аліменти, графік побачень → Додатки → підпис.
- Поділ майна та розподіл боргів НЕ є предметом цього позову — шаблон явно виносить їх в окреме провадження.

## Правова основа (РІВНО з divorce.citations.json)

- Сімейний кодекс України — ст. 105, 110, 112, 157 — https://zakon.rada.gov.ua/laws/show/2947-14
- Цивільний процесуальний кодекс України — ст. 27, 175, 187, 274 — https://zakon.rada.gov.ua/laws/show/1618-15
- Закон України «Про судовий збір» — ст. 4, 5 — https://zakon.rada.gov.ua/laws/show/3674-17

Статті у текст підставляє шаблон — НЕ додавай інших. Розміру судового збору в системі НЕМАЄ: шаблон лишає суму порожньою («__________ грн.») — не називай цифр.

## Особливості конфіга (реальні ids з divorceFormConfig)

- **Відповідач = префікс `spouse_`** (НЕ `defendant_`): `spouse_last_name`, `spouse_first_name`, `spouse_middle_name`, `spouse_birth_date`, `spouse_registered_address`, `spouse_actual_address_known` (`same`/`different`/`unknown`), `spouse_actual_address`, `spouse_has_no_ipn`, `spouse_tax_number`, `spouse_passport_series`, `spouse_phone`, `spouse_email`, `spouse_official_email` (`absent`/`unknown`/`present`).
- **`divorce_reasons`** — multicheck, ОБОВ'ЯЗКОВЕ, можна кілька значень: `no_common_interests`, `no_understanding`, `different_views`, `lost_feelings`, `incompatibility`, `alcohol`, `abuse`, `no_financial_support`, `no_child_care`. Передавай коди — юридичні формулювання підставляє шаблон.
- **`surname_after_divorce`** — choice: `keep` («Залишити поточне прізвище») / `maiden` («Повернути дошлюбне прізвище» → відкриває `maiden_name`) / `not_changed` («Це моє дошлюбне прізвище»). Explanation конфіга: ст. 113 СК — право залишити прізвище або відновити дошлюбне.
- **`spouse_consents`** (boolean, обов'язкове) — explanation конфіга: «За взаємної згоди та відсутності дітей — розлучення через РАЦС. За наявності дітей — через суд, але прискорено (ст. 106–107 СК).»
- **Діти:** `has_children` (обов'язкове; explanation конфіга: «Наявність дітей означає, що розлучення відбуватиметься виключно через суд (ст. 109 СК).») → `children_details` (textarea; hint: «Кожну дитину — з нового рядка: ПІБ, дата народження» — БЕЗ свідоцтва, на відміну від alimony; приклад: `Іванов Іван Іванович, 12.05.2015`), `children_live_with` (`plaintiff`/`defendant`/`both`/`court`), `children_dispute` (`none`/`separate`), `visitation_dispute` (`none` → відкриває `visitation_schedule_text`; `separate` — окреме провадження; видиме, коли діти проживають з позивачем або відповідачем).
- **Аліменти всередині пакета:** `alimony_claim` (boolean, видиме при `has_children == true`; explanation конфіга: «Аліменти на дітей: на 1 дитину — 25%, на 2 — 33%, на 3+ — 50% доходу (ст. 183 СК).») → `alimony_amount` (`percent`/`fixed`/`mixed`; частку за кількістю дітей рахує шаблон; при `fixed`/`mixed` суму шаблон лишає порожньою) + блок рахунку (за шаблоном — частина сьома ст. 175 ЦПК): `plaintiff_has_account` → `plaintiff_account_iban` (валідація IBAN) + `plaintiff_account_bank`, інакше `plaintiff_payout_method`.
- **Майно/борги:** `has_joint_property` → `property_dispute` (`none`/`separate`); `debt_claim` (boolean).
- **Судовий збір:** `court_fee_exempt` (`no`/`yes`) → `court_fee_exempt_reason`: `disability_1_2` / `child_disability` / `chornobyl`. Explanation конфіга: звільняються особи з інвалідністю I та II груп; законні представники дітей з інвалідністю; постраждалі від Чорнобильської катастрофи 1–2 категорій (ст. 5 Закону «Про судовий збір»); відповідні пункти ч.1 ст.5 підставляє шаблон.
- **Процесуальні:** `simplified_proceedings` (`yes` — «Так (рекомендовано)» / `no`), `court_costs_on` (`defendant`/`plaintiff`), `pretrial_settlement` (`none`/`conducted`), `evidence_preservation` (`none`/`conducted`), `originals_location` (`plaintiff`/`partial`), `no_other_lawsuits` (boolean, обов'язкове підтвердження), `joint_household` (`no`/`yes`).

## Порядок інтерв'ю (config.tabs)

1. `plaintiff` — «Позивач»: ПІБ, дата народження, адреси, ІПН/паспорт, контакти, ЄСІТС, прізвище після розлучення.
2. `defendant` — «Відповідач»: усі `spouse_*`.
3. `marriage` — «Шлюб і сімʼя»: дані шлюбу/свідоцтва, згода відповідача, діти, аліменти (+ рахунок), причини розірвання, спільне господарство.
4. `proceedings` — «Провадження»: майно/борги, спрощене провадження, судовий збір, судові витрати, досудове врегулювання, забезпечення доказів, оригінали документів, підтвердження про відсутність іншого позову.

## Обов'язкові поля (required без show_if — 13)

`last_name`, `first_name`, `middle_name`, `birth_date`, `registered_address`, `spouse_last_name`, `spouse_first_name`, `marriage_date`, `marriage_place`, `spouse_consents`, `has_children`, `divorce_reasons`, `no_other_lawsuits`.

Умовні поля відкриваються за show_if (передумови описані у схемі інструмента) — вимоги перевіряй через `validate_params`, не вгадуй.

## Що підготувати заздалегідь (з «Додатки» шаблону)

- квитанція про сплату судового збору (оригінал для суду, копія — відповідачу) АБО, при звільненні, копія посвідчення про право на звільнення від збору — 2 прим.;
- свідоцтво про шлюб (оригінал для суду, копія — відповідачу) — з нього: дата шлюбу, орган ДРАЦС, № актового запису, серія/№ свідоцтва;
- копія паспорта та РНОКПП позивача — 2 прим.;
- копія(-ї) свідоцтва(-в) про народження дитини (дітей) — по 2 прим. (якщо є діти);
- 1 екземпляр позовної заяви з копіями доданих документів для відповідача.

## Що гарантує чеклист (divorce.checklist.json, fail-closed)

- Підстава розірвання шлюбу (ст. 110, 112 СК);
- Підсудність — позов за місцем проживання відповідача (ст. 27 ЦПК);
- Місце проживання дітей вирішене в цьому позові або явно винесене в окреме провадження (якщо є діти);
- Розкриття судового збору (сплачено або підстава звільнення);
- Блок підпису позивача.
