# alimony-change — Test Matrix (Input × Routing × Output)

> **«ТЗ для друга»**: формальний опис простору вхідних варіацій (D1–D9), детермінованого маршрутизатора **L0.5** (`route()`) і очікуваного Output для кожної комбінації.
> Контракт полів — `requirements.md` §1; юридичний алгоритм — §0; харнесс-шари — §4; робочий приклад — `example.md`.
> Цей документ — джерело golden-кейсів для `validation.md` G1 (parity) і G2 (retrieval-eval).
>
> ⚠️ Маршрути `ABSTAIN_EXTRAORDINARY` / `ABSTAIN_INDEXATION` (§2, §4) — **запропонований дизайн, pending підтвердження Олі** (research 2026-06-15). До підтвердження `route()` завжди повертає `PROCEED`; решта матриці (детерміновані гілки L1, court fee, підсудність, ПРОШУ) — чинна вже зараз.

---

## 1. Input — вимірності варіацій

| Вимір | Поле (form_config) | Значення | Джерело |
|---|---|---|---|
| D1 | `change_direction` | `increase` \| `decrease` | Таб 1 — **драйвер усього** |
| D2 | `prior_alimony_type` | `percent` \| `fixed` | Таб 2 |
| D3 | `requested_alimony_type` | `percent` \| `fixed` | Таб 4 |
| D4 | `prior_basis` | `court_decision` \| `agreement` | Таб 2 |
| D5 | `changed_facts` | підмножина 9-значного enum (нижче) | Таб 4 — **вхід для L3 і для L0.5** |
| D6 | дитина/діти (з `children_details`) | 1 дитина <6 \| 1 дитина 6–18 \| декілька різного віку | Таб 3 |
| D7 | `agreement_own_procedure` | `yes`\|`no`\|`unknown` — лише якщо D4=`agreement` | Таб 2, НОВЕ §0.8 |
| D8 | `existing_debt` | `yes`\|`no` — лише якщо D1=`decrease` | Таб 2, НОВЕ §0.9 |
| D9 | `evidence_list` | непорожній \| порожній | Таб 4 |

### D2×D3 → `monthly_delta`

`monthly_delta` потрібна для ціни позову (§3.4, лише `decrease`). **Обчислюється, коли `prior_alimony_type=fixed` І `requested_alimony_type=fixed`** (обидва — грн). Інакше (будь-яка сторона `percent`) → `monthly_delta=unknown` → ціну позову заповнює юрист, review-card ставить питання (requirements §7, TC4 нижче). Для `increase` це не блокує нічого — збір звільнений незалежно.

### D5 — `changed_facts` enum: доступність за напрямком (`show_if`) і маршрут

| Значення | Доступне при | Норми (L2) | Маршрут |
|---|---|---|---|
| `payer_income_up` | `increase` | ст.192, ст.182 ч.2 | `PROCEED` |
| `payer_income_down` | `decrease` | ст.192, ст.182 ч.2 | `PROCEED` |
| `payer_new_dependents` | `decrease` | ст.192, ст.182 (інші діти/утриманці) | `PROCEED` |
| `payer_health_down` | `decrease` | ст.192, ст.182 (здоров'я платника) | `PROCEED` |
| `child_needs_up_general` | `increase` | ст.192, ст.182 ч.2, ст.183/184 | `PROCEED` |
| `child_needs_up_extraordinary` | `increase` | — (поза L2 цієї послуги) | **`ABSTAIN_EXTRAORDINARY`** (§4.2) |
| `child_health_down` | `increase` | ст.192, ст.182 (здоров'я дитини) | `PROCEED` |
| `recipient_income_down` | `increase` | ст.192, ст.182 (становище одержувача) | `PROCEED` |
| `cost_of_living_up` | обидва | ст.192 (⚠️ слабка підстава) | `PROCEED` *(окрім singleton+`fixed`, див. §2)* |

> 🆕 **Спостереження (не з основних 8 питань research):** для `decrease` немає симетричного до `recipient_income_down` факту («дохід одержувача зріс» — підстава для платника просити зменшення). Можливий пропуск enum (`recipient_income_up`) — *не блокує пілот, занесено в `document-tiers-tz.md` §6 п.10 як OPEN*.

---

## 2. Маршрутизація (L0.5) — `route(changed_facts, prior_alimony_type)`

| # | Умова | → Route | Output |
|---|---|---|---|
| R1 | `child_needs_up_extraordinary ∈ changed_facts` | `ABSTAIN_EXTRAORDINARY` | §4.2 — без документа |
| R2 | `prior_alimony_type=fixed` І `changed_facts == {cost_of_living_up}` (РІВНО, singleton) | `ABSTAIN_INDEXATION` | §4.3 — без документа |
| R3 | `prior_alimony_type=percent` І `changed_facts == {cost_of_living_up}` (singleton) | `PROCEED` | §3, але L4b critic → AMBER «слабка підстава для percent» |
| R4 | `changed_facts = ∅` або суперечливий набір (напр. `payer_income_up` + `payer_income_down`) | — | блокується **валідацією форми** (до L0.5, до route()) |
| R5 | будь-що інше | `PROCEED` | §3, звичний документ |

Порядок перевірки: R4 (форма) → R1 → R2 → R5. R1 має пріоритет над R2 (якщо обрано і `_extraordinary`, і singleton `cost_of_living_up` — неможливо одночасно, бо R2 вимагає singleton).

---

## 3. Output — маршрут `PROCEED`

### 3.1 Детерміновані гілки за D1 (`change_direction`)

| | `increase` (позивач = одержувач) | `decrease` (позивач = платник) |
|---|---|---|
| Підсудність (шапка) | за вибором позивача — місце позивача **або** відповідача (ст.28 ч.1 ЦПК) | за місцем проживання відповідача (ст.27 ЦПК, без альтернативи) |
| Судовий збір | звільнення, п.3 ч.1 ст.5 ЗУ «Про судовий збір» | `courtFee()`: ціна позову = `monthly_delta×12` (ст.176 ЦПК); збір = `max(1%, 0.4×3328=1331.20)` (ст.4 ЗСЗ) |
| `ПРОШУ` — дія | «Збільшити розмір аліментів ... з X до Y» | «Зменшити розмір аліментів ... з X до Y» |
| `ПРОШУ` — момент дії | «з дня набрання рішенням суду законної сили» (ст.191 СК, ППВСУ №3/2006 п.23) — **однаково для обох напрямків** | те саме |
| 50%-floor (тільки `requested_alimony_type=percent`) | застосовується до `requested_alimony_value`, вік дитини з `children_details` (registry: <6→2817/floor 1408.50; 6-18→3512/floor 1756) | те саме |

### 3.2 L3 reasoning — вхід/вихід

- **Вхід:** `changed_facts[]` (мінус ті, що дали `ABSTAIN_*`) + L2-набір норм (поданий вище у D5-таблиці) + enum-констрейнт цитат.
- **Вихід:** 1–3 речення, що зв'язують `changed_facts` з ст.192/182; критик-1 (детерм.) + критик-2 (LLM groundedness) → 🟢/🟡; `ABSTAIN_REASONING` (L4c, не плутати з L0.5!) → секція відсутня, generic-абзац ст.182.
- ⚠️ Якщо серед `changed_facts` лишився тільки `cost_of_living_up` (після фільтрації R2 — тобто `prior_alimony_type=percent`, R3) — L3 НЕ повинен писати «закон підняв мінімум» як підставу (ст.192: зміна закону ≠ підстава); критик-2 ловить це як AMBER (validation.md edge cases).

### 3.3 Review-card — поля, що залежать від варіацій

Базова структура — requirements §2.2. Додатково за варіаціями:
- `jurisdiction_basis`: `"ст.28 ч.1 ЦПК (за вибором позивача)"` (increase) | `"ст.27 ЦПК (за місцем проживання відповідача)"` (decrease)
- `court_fee.exempt`: `true` (increase) | `false` + `price_of_claim`/`fee_amount`/`fee_basis` (decrease) | `"manual"` якщо `monthly_delta=unknown` (D2×D3, TC4)
- `questions_for_lawyer` додатково містить: D7=`agreement_own_procedure∈{yes,unknown}` → питання про порядок зміни договору (§0.8); D8=`existing_debt=yes` → попередження про ст.197 (§0.9); R3 → AMBER щодо `cost_of_living_up`+`percent`

---

## 4. Output — маршрути `ABSTAIN_*` (без документа)

### 4.1 Спільна форма
```jsonc
{
  "service": "alimony-change",
  "route": "abstain_extraordinary" | "abstain_indexation",
  "abstention_reason": "...",
  "redirect_message": "...",
  "questions_for_lawyer": [...]
}
```
Документ (Google Docs) **не створюється**. Користувач у TWA бачить `redirect_message`.

### 4.2 `ABSTAIN_EXTRAORDINARY` (R1)
> «Ваш запит стосується конкретної додаткової витрати на дитину з визначеною вартістю (лікування, навчання тощо). Це інший вид позову — "стягнення додаткових витрат на дитину" (ст.181, 185 СК України), а не "зміна розміру аліментів" (ст.192). Цей сервіс поки не підтримує такий позов — рекомендуємо звернутись до юриста.»

`abstention_reason: "child_needs_up_extraordinary → ст.181/185 СК, інший позов"`

### 4.3 `ABSTAIN_INDEXATION` (R2)
> «Аліменти присуджені у твердій сумі, і єдина названа причина — зростання вартості життя. Такий розмір індексується **автоматично, без суду** (ст.184 СК України). Позов про "зміну розміру" (ст.192) тут не є належним способом захисту — якщо є й інші причини, оберіть їх у формі.»

`abstention_reason: "fixed + singleton cost_of_living_up → ст.184 СК, позасудова індексація"`

---

## 5. Конкретні тест-кейси (golden, для `validation.md` G1)

| TC | D1 | D2→D3 | D4 (D7) | D5 (changed_facts) | D6 | D8 | Route | Очікуваний Output |
|---|---|---|---|---|---|---|---|---|
| TC1 | increase | percent→percent | court_decision | `[child_needs_up_general, payer_income_up]` | 1×6-18 | — | PROCEED | = `example.md` Кейс A: суд за позивачем (ст.28), fee=exempt, ПРОШУ «...набрання законної сили», floor 1756 |
| TC2 | decrease | fixed→fixed | court_decision | `[payer_income_down]` | 1×<6 | no | PROCEED | суд за відповідачем (ст.27), fee=1% ціни позову (вище floor) |
| TC3 | decrease | fixed→fixed (Δ=100) | court_decision | `[payer_health_down]` | 1×6-18 | no | PROCEED | ціна позову=1200, 1%=12 < floor → fee=**1331.20** (floor спрацював) |
| TC4 | decrease | percent→fixed | court_decision | `[payer_income_down]` | 1×<6 | no | PROCEED | `monthly_delta=unknown` → `court_fee.exempt="manual"`, review-card: «юрист заповнює ціну позову» |
| TC5 | increase | percent→percent | court_decision | `[child_needs_up_extraordinary]` | 1×6-18 | — | **ABSTAIN_EXTRAORDINARY** | без документа, §4.2 |
| TC6 | decrease | fixed→fixed | court_decision | `[cost_of_living_up]` (singleton) | 1×<6 | no | **ABSTAIN_INDEXATION** | без документа, §4.3 |
| TC7 | increase | percent→percent | court_decision | `[cost_of_living_up]` (singleton) | 1×6-18 | — | PROCEED (R3) | документ генерується, L4b critic → AMBER «слабка підстава для percent» |
| TC8 | increase | agreement→percent | agreement (`agreement_own_procedure=yes`) | `[recipient_income_down]` | 1×<6 | — | PROCEED | review-card питання: «перевірити власний порядок зміни договору» (§0.8) |
| TC9 | decrease | fixed→fixed | court_decision | `[payer_new_dependents]` | 1×6-18 | **yes** | PROCEED | документ + попередження: зменшення не покриває заборгованість (ст.197, §0.9) |
| TC10 | increase | percent→percent | court_decision | `[child_needs_up_general, child_health_down]` | 2× (1×<6, 1×6-18) | — | PROCEED | 50%-floor рахується **per-age**: 1408.50 і 1756 окремо |
| TC11 | increase | percent→percent | court_decision | `[recipient_income_down]` | 1×6-18 | — | PROCEED, **L4c ABSTAIN_REASONING** | Groq 5xx/критики провалені → документ генерується, але §2.1 п.4 = generic-абзац ст.182 (НЕ L0.5-abstention — документ є) |
| TC12 | будь-який | — | — | `[payer_income_up, payer_income_down]` (суперечливо) | — | — | блок на формі (R4) | форма не дає відправити — до route(), до L0.5 |

> TC1 = `example.md` Кейс A; TC2/TC3 ~ Кейс B (з конкретизацією floor). TC5–TC9, TC11–TC12 — нові, з'явились унаслідок research 2026-06-15.

---

## 6. Pending — потребує підтвердження Олі

> 📌 **Стан (2026-06-15):** Оля поки недоступна (орієнтовне повернення ~2026-06-25). Усі 6 пунктів нижче лишаються «запропонований дизайн» — не блокують подальшу роботу над іншими частинами спеки/пайплайна, але **не йдуть у прод без її підтвердження**. Той самий таймлайн вже тримає окремий пункт — розблокування CRON law-monitor (`project_cron_schedule_pending`).

| # | Що | Де в спеці |
|---|---|---|
| 1 | Split `child_needs_up` → `_general`/`_extraordinary` + `ABSTAIN_EXTRAORDINARY` (TC5) | requirements §1/§2.4/§3.0; document-tiers-tz §6 п.6 |
| 2 | `ABSTAIN_INDEXATION` для `fixed`+singleton `cost_of_living_up` (TC6) | requirements §2.4/§3.0; document-tiers-tz §6 п.7 |
| 3 | `agreement_own_procedure` — формулювання питання юристу (TC8) | requirements §0.8; document-tiers-tz §6 п.8 |
| 4 | `existing_debt` — формулювання попередження клієнту (TC9) | requirements §0.9; document-tiers-tz §6 п.9 |
| 5 | Поріг «істотності» зміни обставин (ст.192) — для L4c abstention-порога (TC11) | document-tiers-tz §6 п.1 — досі OPEN, не закрито цим research |
| 6 | 🆕 Можливий пропуск enum `recipient_income_up` для `decrease` | document-tiers-tz §6 п.10 (новий) |

Усі інші зміни цього документа (підсудність ст.27/28, ПМ-2026, формулювання «ПРОШУ») — **вже резолюшн** (✅), не потребують підтвердження для внесення в спеку; фінальне ярус-3 ревью перед прод-релізом — стандартна процедура (`CLAUDE.md`: «кожна нова послуга — sign-off Олі»).
