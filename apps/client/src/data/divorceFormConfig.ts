import type { FormConfig } from '../types/form'

export const divorceFormConfig: FormConfig = {
  service_id: 'divorce',
  title: 'Розлучення',
  subtitle: 'Підготовка позовної заяви про розірвання шлюбу',
  tabs: [
    { id: 'plaintiff', label: 'Позивач' },
    { id: 'defendant', label: 'Відповідач' },
    { id: 'marriage', label: 'Шлюб і сімʼя' },
    { id: 'proceedings', label: 'Провадження' },
  ],
  steps: [
    // ═══════════════════════════════════════════════════════════
    // TAB 1: ПОЗИВАЧ (той, хто подає заяву)
    // Алгоритм юриста: п.1
    // ═══════════════════════════════════════════════════════════
    {
      id: 'last_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'Прізвище',
      placeholder: 'Іванова',
      hint: 'Відповідно до паспорта.',
      required: true,
    },
    {
      id: 'first_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'Імʼя',
      placeholder: 'Інна',
      required: true,
    },
    {
      id: 'middle_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'По батькові',
      placeholder: 'Петрівна',
      required: true,
    },
    {
      id: 'birth_date',
      tab: 'plaintiff',
      type: 'date',
      label: 'Дата народження',
      required: true,
    },
    {
      id: 'registered_address',
      tab: 'plaintiff',
      type: 'text',
      label: 'Зареєстроване місце проживання',
      placeholder: 'м. Київ, вул. Хрещатик, 1, кв. 10',
      hint: 'Адреса за пропискою (реєстрацією).',
      required: true,
    },
    {
      id: 'same_actual_address',
      tab: 'plaintiff',
      type: 'boolean',
      label: 'Фактична адреса збігається із зареєстрованою?',
      hint: 'Якщо проживаєте за іншою адресою — вкажіть її.',
    },
    {
      id: 'actual_address',
      tab: 'plaintiff',
      type: 'text',
      label: 'Фактичне місце проживання',
      placeholder: 'м. Київ, вул. Лесі Українки, 5, кв. 20',
      show_if: { field: 'same_actual_address', operator: '==', value: false },
      animation: 'slide-down',
    },
    {
      id: 'has_no_ipn',
      tab: 'plaintiff',
      type: 'boolean',
      label: 'Відмовився від ІПН (релігійні переконання)',
      hint: 'Оберіть «Так» лише якщо Ви офіційно відмовились від ІПН.',
    },
    {
      id: 'tax_number',
      tab: 'plaintiff',
      type: 'text',
      label: 'Реєстраційний номер облікової картки (ІПН)',
      placeholder: '1234567890',
      hint: '10 цифр. Вказується у позові для ідентифікації особи.',
      show_if: { field: 'has_no_ipn', operator: '!=', value: true },
      animation: 'slide-down',
    },
    {
      id: 'passport_series',
      tab: 'plaintiff',
      type: 'text',
      label: 'Серія та номер паспорта',
      placeholder: 'АА 123456 або 123456789 (ID-картка)',
      hint: 'Вказується замість ІПН.',
      show_if: { field: 'has_no_ipn', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'plaintiff_phone',
      tab: 'plaintiff',
      type: 'text',
      label: 'Номер телефону',
      placeholder: '+380501234567',
      hint: 'Для звʼязку суду з вами.',
    },
    {
      id: 'plaintiff_email',
      tab: 'plaintiff',
      type: 'text',
      label: 'Адреса електронної пошти',
      placeholder: 'example@gmail.com',
      hint: 'Суд може надсилати повістки на email.',
    },
    {
      id: 'plaintiff_official_email',
      tab: 'plaintiff',
      type: 'choice',
      label: 'Офіційна електронна адреса (Дія, ЄСІТС)',
      options: [
        { value: 'absent', label: 'Відсутня' },
        { value: 'present', label: 'Є' },
      ],
      hint: 'Більшість громадян обирають «Відсутня».',
    },
    // --- Прізвище після розлучення (Алгоритм п.1) ---
    {
      id: 'surname_after_divorce',
      tab: 'plaintiff',
      type: 'choice',
      label: 'Прізвище після розірвання шлюбу',
      options: [
        { value: 'keep', label: 'Залишити поточне прізвище' },
        { value: 'maiden', label: 'Повернути дошлюбне прізвище' },
        { value: 'not_changed', label: 'Це моє дошлюбне прізвище' },
      ],
      hint: 'Після розлучення можна повернути дошлюбне прізвище.',
      explanation: 'Відповідно до ст. 113 СК України, після розірвання шлюбу особа має право залишити прізвище іншого з подружжя або відновити своє дошлюбне прізвище.',
    },
    {
      id: 'maiden_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'Дошлюбне прізвище',
      placeholder: 'Петрова',
      show_if: { field: 'surname_after_divorce', operator: '==', value: 'maiden' },
      animation: 'slide-down',
    },

    // ═══════════════════════════════════════════════════════════
    // TAB 2: ВІДПОВІДАЧ (другий з подружжя)
    // Алгоритм юриста: п.2
    // ═══════════════════════════════════════════════════════════
    {
      id: 'spouse_last_name',
      tab: 'defendant',
      type: 'text',
      label: 'Прізвище відповідача',
      placeholder: 'Іванов',
      required: true,
    },
    {
      id: 'spouse_first_name',
      tab: 'defendant',
      type: 'text',
      label: 'Імʼя відповідача',
      placeholder: 'Іван',
      required: true,
    },
    {
      id: 'spouse_middle_name',
      tab: 'defendant',
      type: 'text',
      label: 'По батькові відповідача',
      placeholder: 'Іванович',
    },
    {
      id: 'spouse_birth_date',
      tab: 'defendant',
      type: 'date',
      label: 'Дата народження відповідача',
      hint: 'Якщо відома.',
    },
    {
      id: 'spouse_registered_address',
      tab: 'defendant',
      type: 'text',
      label: 'Зареєстроване місце проживання відповідача',
      placeholder: 'м. Київ, вул. Хрещатик, 2, кв. 5',
      hint: 'За цією адресою визначається суд.',
      explanation: 'Відповідно до ст. 27 ЦПК України позови до фізичної особи подаються за місцем її реєстрації. Знайти суд: https://court.gov.ua/',
    },
    {
      id: 'spouse_actual_address_known',
      tab: 'defendant',
      type: 'choice',
      label: 'Фактична адреса відповідача',
      options: [
        { value: 'same', label: 'Збігається із зареєстрованою' },
        { value: 'different', label: 'Інша адреса' },
        { value: 'unknown', label: 'Невідома' },
      ],
    },
    {
      id: 'spouse_actual_address',
      tab: 'defendant',
      type: 'text',
      label: 'Фактична адреса проживання відповідача',
      placeholder: 'м. Київ, вул. Лесі Українки, 10, кв. 3',
      show_if: { field: 'spouse_actual_address_known', operator: '==', value: 'different' },
      animation: 'slide-down',
    },
    {
      id: 'spouse_has_no_ipn',
      tab: 'defendant',
      type: 'boolean',
      label: 'Відповідач відмовився від ІПН',
      hint: 'Оберіть «Так» якщо відомо, що відповідач відмовився від ІПН.',
    },
    {
      id: 'spouse_tax_number',
      tab: 'defendant',
      type: 'text',
      label: 'ІПН відповідача',
      placeholder: '1234567890',
      hint: 'Якщо відомий. Вкажіть «невідомий» якщо не знаєте.',
      show_if: { field: 'spouse_has_no_ipn', operator: '!=', value: true },
      animation: 'slide-down',
    },
    {
      id: 'spouse_passport_series',
      tab: 'defendant',
      type: 'text',
      label: 'Серія та номер паспорта відповідача',
      placeholder: 'АА 123456 або 123456789',
      show_if: { field: 'spouse_has_no_ipn', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'spouse_phone',
      tab: 'defendant',
      type: 'text',
      label: 'Номер телефону відповідача',
      placeholder: '+380XXXXXXXXX',
      hint: 'Якщо відомий.',
    },
    {
      id: 'spouse_email',
      tab: 'defendant',
      type: 'text',
      label: 'Електронна пошта відповідача',
      placeholder: 'example@gmail.com',
    },
    {
      id: 'spouse_official_email',
      tab: 'defendant',
      type: 'choice',
      label: 'Офіційна електронна адреса відповідача',
      options: [
        { value: 'absent', label: 'Відсутня' },
        { value: 'unknown', label: 'Невідома' },
        { value: 'present', label: 'Є' },
      ],
    },

    // ═══════════════════════════════════════════════════════════
    // TAB 3: ШЛЮБ І СІМ'Я
    // Алгоритм юриста: п.3, п.4, п.5, п.6
    // ═══════════════════════════════════════════════════════════

    // --- Відомості про шлюб (Алгоритм п.3) ---
    {
      id: 'marriage_date',
      tab: 'marriage',
      type: 'date',
      label: 'Дата реєстрації шлюбу',
      hint: 'Зазначена у свідоцтві про шлюб.',
      required: true,
    },
    {
      id: 'marriage_place',
      tab: 'marriage',
      type: 'text',
      label: 'Орган ДРАЦС, що зареєстрував шлюб',
      placeholder: 'Відділ РАЦС Шевченківського району м. Київ',
      hint: 'Повна назва без скорочень, як у свідоцтві.',
      required: true,
    },
    {
      id: 'marriage_act_number',
      tab: 'marriage',
      type: 'text',
      label: 'Номер актового запису',
      placeholder: '123',
      hint: 'Вказаний у свідоцтві про шлюб.',
    },
    {
      id: 'marriage_cert_series',
      tab: 'marriage',
      type: 'text',
      label: 'Серія та номер свідоцтва про шлюб',
      placeholder: '1-КЕ № 123456',
      hint: 'Зазначені на бланку свідоцтва.',
    },
    {
      id: 'marriage_cert_date',
      tab: 'marriage',
      type: 'date',
      label: 'Дата видачі свідоцтва про шлюб',
      hint: 'Якщо відрізняється від дати реєстрації шлюбу.',
    },
    {
      id: 'spouse_consents',
      tab: 'marriage',
      type: 'boolean',
      label: 'Чи згоден другий з подружжя на розлучення?',
      hint: 'Взаємна згода спрощує процедуру.',
      explanation: 'За взаємної згоди та відсутності дітей — розлучення через РАЦС. За наявності дітей — через суд, але прискорено (ст. 106–107 СК).',
      required: true,
    },

    // --- Діти (Алгоритм п.4) ---
    {
      id: 'has_children',
      tab: 'marriage',
      type: 'boolean',
      label: 'Чи є спільні неповнолітні діти?',
      hint: 'Діти до 18 років, народжені або усиновлені у цьому шлюбі.',
      explanation: 'Наявність дітей означає, що розлучення відбуватиметься виключно через суд (ст. 109 СК).',
      required: true,
    },
    {
      id: 'children_details',
      tab: 'marriage',
      type: 'textarea',
      label: 'ПІБ та дати народження дітей',
      placeholder: 'Іванов Іван Іванович, 12.05.2015\nІванова Марія Іванівна, 03.11.2018',
      hint: 'Кожну дитину — з нового рядка: ПІБ, дата народження.',
      show_if: { field: 'has_children', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'children_live_with',
      tab: 'marriage',
      type: 'choice',
      label: 'З ким зараз проживають діти?',
      options: [
        { value: 'plaintiff', label: 'Зі мною (позивачем)' },
        { value: 'defendant', label: 'З відповідачем' },
        { value: 'both', label: 'Частково з кожним' },
      ],
      show_if: { field: 'has_children', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'children_dispute',
      tab: 'marriage',
      type: 'choice',
      label: 'Спір щодо місця проживання дітей',
      options: [
        { value: 'none', label: 'Спір відсутній' },
        { value: 'separate', label: 'Є, вирішуватиметься окремо' },
      ],
      hint: 'Якщо є спір — він буде вирішуватися в окремому провадженні.',
      show_if: { field: 'has_children', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'alimony_claim',
      tab: 'marriage',
      type: 'boolean',
      label: 'Чи хочете заявити вимогу про аліменти?',
      hint: 'Можна заявити одночасно з позовом про розлучення.',
      explanation: 'Аліменти на дітей: на 1 дитину — 25%, на 2 — 33%, на 3+ — 50% доходу (ст. 183 СК).',
      show_if: { field: 'has_children', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'alimony_amount',
      tab: 'marriage',
      type: 'choice',
      label: 'Форма стягнення аліментів',
      options: [
        { value: 'percent', label: 'Відсоток від доходу' },
        { value: 'fixed', label: 'Фіксована сума' },
        { value: 'mixed', label: 'Змішана форма' },
      ],
      show_if: { field: 'alimony_claim', operator: '==', value: true },
      animation: 'slide-down',
    },

    // --- Причини розлучення (Алгоритм п.5) ---
    {
      id: 'divorce_reasons',
      tab: 'marriage',
      type: 'multicheck',
      label: 'Причини розірвання шлюбу',
      options: [
        { value: 'no_common_interests', label: 'Відсутність спільних інтересів' },
        { value: 'no_understanding', label: 'Відсутність взаєморозуміння' },
        { value: 'different_views', label: 'Різні погляди на сімейне життя' },
        { value: 'lost_feelings', label: 'Втрата почуття любові та поваги' },
        { value: 'incompatibility', label: 'Несумісність характерів' },
        { value: 'alcohol', label: 'Зловживання алкоголем' },
        { value: 'abuse', label: 'Жорстоке поводження з членами сімʼї' },
        { value: 'no_financial_support', label: 'Відсутність фінансової підтримки сімʼї' },
        { value: 'no_child_care', label: 'Ухилення від виховання дітей' },
      ],
      hint: 'Оберіть одну або кілька причин.',
      explanation: 'Ці підстави зазначаються у позовній заяві для обґрунтування вимоги про розірвання шлюбу (ст. 112 СК).',
      required: true,
    },
    {
      id: 'joint_household',
      tab: 'marriage',
      type: 'choice',
      label: 'Чи ведете з відповідачем спільне господарство?',
      options: [
        { value: 'no', label: 'Не ведемо' },
        { value: 'yes', label: 'Ведемо' },
      ],
      hint: 'Чи проживаєте разом та маєте спільний бюджет.',
    },

    // ═══════════════════════════════════════════════════════════
    // TAB 4: ПРОВАДЖЕННЯ (процесуальні питання)
    // Алгоритм юриста: п.7-15
    // ═══════════════════════════════════════════════════════════

    // --- Майно (Алгоритм п.8) ---
    {
      id: 'has_joint_property',
      tab: 'proceedings',
      type: 'boolean',
      label: 'Чи є спільне майно?',
      hint: 'Квартира, авто, бізнес, заощадження — все, що придбано у шлюбі.',
      explanation: 'Майно, набуте у шлюбі, є спільною власністю і підлягає поділу (ст. 60–70 СК).',
    },
    {
      id: 'property_dispute',
      tab: 'proceedings',
      type: 'choice',
      label: 'Спір щодо поділу майна',
      options: [
        { value: 'none', label: 'Спір відсутній' },
        { value: 'separate', label: 'Є, вирішуватиметься окремо' },
      ],
      show_if: { field: 'has_joint_property', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'debt_claim',
      tab: 'proceedings',
      type: 'boolean',
      label: 'Чи є спільні борги або кредити?',
      hint: 'Іпотека, авто-кредит, споживчі кредити.',
      explanation: 'Спільні борги поділяються пропорційно до часток у майні (ст. 73 СК).',
    },

    // --- Порядок провадження (Алгоритм п.10) ---
    {
      id: 'simplified_proceedings',
      tab: 'proceedings',
      type: 'choice',
      label: 'Спрощене позовне провадження',
      options: [
        { value: 'yes', label: 'Так (рекомендовано)' },
        { value: 'no', label: 'Ні, загальне провадження' },
      ],
      hint: 'Для типових розлучень обирайте спрощене — швидший розгляд.',
      explanation: 'Спрощене провадження — стандартний вибір для справ про розлучення без складних суперечок. Загальне обирається рідко, якщо справа потребує тривалого розгляду.',
    },

    // --- Судовий збір (Алгоритм п.11) ---
    {
      id: 'court_fee_exempt',
      tab: 'proceedings',
      type: 'choice',
      label: 'Звільнення від судового збору',
      options: [
        { value: 'no', label: 'Ні, підстави відсутні' },
        { value: 'yes', label: 'Так, маю підстави' },
      ],
      hint: 'Більшість позивачів не звільнені від сплати.',
      explanation: 'Від сплати звільняються: особи з інвалідністю I та II груп; законні представники дітей з інвалідністю; постраждалі від Чорнобильської катастрофи 1–2 категорій (ст. 5 Закону «Про судовий збір»).',
    },
    {
      id: 'court_fee_exempt_reason',
      tab: 'proceedings',
      type: 'choice',
      label: 'Підстава для звільнення',
      options: [
        { value: 'disability_1_2', label: 'Особа з інвалідністю I або II групи' },
        { value: 'child_disability', label: 'Законний представник дитини з інвалідністю' },
        { value: 'chornobyl', label: 'Постраждалий від Чорнобильської катастрофи (1–2 кат.)' },
      ],
      show_if: { field: 'court_fee_exempt', operator: '==', value: 'yes' },
      animation: 'slide-down',
    },

    // --- На кого покласти витрати (Алгоритм п.12) ---
    {
      id: 'court_costs_on',
      tab: 'proceedings',
      type: 'choice',
      label: 'Судові витрати покласти на',
      options: [
        { value: 'defendant', label: 'Відповідача' },
        { value: 'plaintiff', label: 'Залишити за мною (позивачем)' },
      ],
      hint: 'Якщо суд задовольнить позов — відповідач зобовʼязаний відшкодувати судовий збір.',
      explanation: 'Якщо обираєте «на відповідача» — після задоволення позову суд стягне з нього суму судового збору та підтверджені витрати на адвоката.',
    },

    // --- Досудове врегулювання (Алгоритм п.13) ---
    {
      id: 'pretrial_settlement',
      tab: 'proceedings',
      type: 'choice',
      label: 'Досудове врегулювання спору',
      options: [
        { value: 'none', label: 'Не проводилось' },
        { value: 'conducted', label: 'Проводилось (медіація, листування)' },
      ],
      hint: 'Вимога п.6 ч.3 ст.175 ЦПК.',
    },

    // --- Забезпечення доказів (Алгоритм п.14) ---
    {
      id: 'evidence_preservation',
      tab: 'proceedings',
      type: 'choice',
      label: 'Забезпечення доказів або позову',
      options: [
        { value: 'none', label: 'Не здійснювалось' },
        { value: 'conducted', label: 'Здійснювалось' },
      ],
      hint: 'Вимога п.7 ч.3 ст.175 ЦПК.',
    },

    // --- Оригінали документів (Алгоритм п.15) ---
    {
      id: 'originals_location',
      tab: 'proceedings',
      type: 'choice',
      label: 'Оригінали документів',
      options: [
        { value: 'plaintiff', label: 'Всі у мене (позивача)' },
        { value: 'partial', label: 'Частково у відповідача' },
      ],
      hint: 'Вимога п.8 ч.3 ст.175 ЦПК.',
      explanation: 'Якщо оригінал свідоцтва про шлюб або інший документ перебуває у відповідача — суд може витребувати його ухвалою.',
    },

    // --- Підтвердження (Алгоритм п.9) ---
    {
      id: 'no_other_lawsuits',
      tab: 'proceedings',
      type: 'boolean',
      label: 'Підтверджую, що не подано іншого позову з тих самих підстав',
      hint: 'Вимога п.10 ч.3 ст.175 ЦПК.',
      required: true,
    },
  ],
}
