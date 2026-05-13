import type { FormConfig } from '../types/form'

export const alimonyFormConfig: FormConfig = {
  title: 'Стягнення аліментів',
  tabs: [
    // ─── TAB 1: Позивач ────────────────────────────────────────────────────────
    {
      id: 'plaintiff',
      label: 'Позивач',
      fields: [
        { id: 'last_name',   type: 'text', label: 'Прізвище',      required: true,  placeholder: 'Іванова' },
        { id: 'first_name',  type: 'text', label: 'Ім\'я',          required: true,  placeholder: 'Інна' },
        { id: 'middle_name', type: 'text', label: 'По батькові',    required: true,  placeholder: 'Петрівна' },
        { id: 'birth_date',  type: 'date', label: 'Дата народження', required: true },
        {
          id: 'registered_address', type: 'text', required: true,
          label: 'Адреса реєстрації',
          placeholder: 'м. Київ, вул. Хрещатик, 10, кв. 25',
          tooltip: 'Адреса зазначена в паспорті як місце реєстрації',
        },
        {
          id: 'same_actual_address', type: 'boolean',
          label: 'Фактична адреса збігається з адресою реєстрації',
          required: false,
        },
        {
          id: 'actual_address', type: 'text', required: false,
          label: 'Фактична адреса проживання',
          placeholder: 'м. Київ, вул. Пушкінська, 5, кв. 3',
          show_if: { field: 'same_actual_address', operator: '!=', value: true },
        },
        {
          id: 'has_no_ipn', type: 'boolean', required: false,
          label: 'Відмовився(-лась) від ІПН',
          tooltip: 'Відмітьте, якщо ви маєте паспорт з відміткою про відмову від ІПН',
        },
        {
          id: 'tax_number', type: 'text', required: false,
          label: 'ІПН (РНОКПП)',
          placeholder: '1234567890',
          tooltip: '10 цифр — реєстраційний номер облікової картки платника податків',
          show_if: { field: 'has_no_ipn', operator: '!=', value: true },
        },
        {
          id: 'passport_series', type: 'text', required: false,
          label: 'Серія та номер паспорта',
          placeholder: 'МН 456789',
          show_if: { field: 'has_no_ipn', operator: '==', value: true },
        },
        { id: 'plaintiff_phone', type: 'phone', label: 'Телефон', required: false, placeholder: '+380501234567' },
        { id: 'plaintiff_email', type: 'text',  label: 'Email',   required: false, placeholder: 'email@gmail.com' },
        {
          id: 'plaintiff_official_email', type: 'choice', required: false,
          label: 'Офіційна електронна адреса (ЄСІТС)',
          options: [
            { value: 'absent',  label: 'Відсутня' },
            { value: 'present', label: 'Наявна в ЄСІТС' },
          ],
        },
      ],
    },

    // ─── TAB 2: Відповідач ─────────────────────────────────────────────────────
    {
      id: 'defendant',
      label: 'Відповідач',
      fields: [
        { id: 'defendant_last_name',   type: 'text', label: 'Прізвище',      required: true,  placeholder: 'Іванов' },
        { id: 'defendant_first_name',  type: 'text', label: 'Ім\'я',          required: true,  placeholder: 'Іван' },
        { id: 'defendant_middle_name', type: 'text', label: 'По батькові',    required: true,  placeholder: 'Іванович' },
        { id: 'defendant_birth_date',  type: 'date', label: 'Дата народження', required: false,
          tooltip: 'Вкажіть якщо відома — потрібна для ПРОШУ у позові',
        },
        {
          id: 'defendant_registered_address', type: 'text', required: true,
          label: 'Адреса реєстрації відповідача',
          placeholder: 'м. Київ, вул. Грушевського, 5, кв. 3',
        },
        {
          id: 'defendant_actual_address_known', type: 'choice', required: false,
          label: 'Фактична адреса відповідача',
          options: [
            { value: 'same',      label: 'Збігається з адресою реєстрації' },
            { value: 'different', label: 'Інша адреса' },
            { value: 'unknown',   label: 'Невідома' },
          ],
        },
        {
          id: 'defendant_actual_address', type: 'text', required: false,
          label: 'Фактична адреса проживання відповідача',
          show_if: { field: 'defendant_actual_address_known', operator: '==', value: 'different' },
        },
        {
          id: 'defendant_has_no_ipn', type: 'boolean', required: false,
          label: 'Відповідач відмовився від ІПН',
        },
        {
          id: 'defendant_tax_number', type: 'text', required: false,
          label: 'ІПН відповідача',
          placeholder: '1234567890',
          tooltip: 'Вкажіть якщо відомий',
          show_if: { field: 'defendant_has_no_ipn', operator: '!=', value: true },
        },
        {
          id: 'defendant_passport_series', type: 'text', required: false,
          label: 'Серія та номер паспорта відповідача',
          placeholder: 'МН 456789',
          show_if: { field: 'defendant_has_no_ipn', operator: '==', value: true },
        },
        { id: 'defendant_phone', type: 'phone', label: 'Телефон відповідача', required: false },
        { id: 'defendant_email', type: 'text',  label: 'Email відповідача',   required: false },
        {
          id: 'defendant_official_email', type: 'choice', required: false,
          label: 'Офіційна електронна адреса відповідача',
          options: [
            { value: 'absent',  label: 'Відсутня' },
            { value: 'present', label: 'Наявна в ЄСІТС' },
            { value: 'unknown', label: 'Невідома' },
          ],
        },
      ],
    },

    // ─── TAB 3: Шлюб і діти ───────────────────────────────────────────────────
    {
      id: 'family',
      label: 'Шлюб і діти',
      fields: [
        {
          id: 'marital_status', type: 'choice', required: true,
          label: 'Сімейний стан',
          tooltip: 'Від цього залежить формулювання у позові',
          options: [
            { value: 'married',       label: 'У шлюбі (не розірвано)' },
            { value: 'divorced',      label: 'Шлюб розірвано' },
            { value: 'never_married', label: 'Офіційного шлюбу не було' },
          ],
        },
        // Marriage fields (only for married/divorced)
        {
          id: 'marriage_date', type: 'date', required: false,
          label: 'Дата реєстрації шлюбу',
          show_if: { field: 'marital_status', operator: '!=', value: 'never_married' },
        },
        {
          id: 'marriage_place', type: 'text', required: false,
          label: 'Де зареєстровано шлюб (назва відділу РАЦС)',
          placeholder: 'Шевченківський відділ РАЦС у м. Києві',
          tooltip: 'Повна назва відділу реєстрації актів цивільного стану',
          show_if: { field: 'marital_status', operator: '!=', value: 'never_married' },
        },
        {
          id: 'marriage_act_number', type: 'text', required: false,
          label: 'Номер актового запису',
          placeholder: '547',
          show_if: { field: 'marital_status', operator: '!=', value: 'never_married' },
        },
        // Divorce fields (only if divorced)
        {
          id: 'divorce_date', type: 'date', required: false,
          label: 'Дата розірвання шлюбу',
          show_if: { field: 'marital_status', operator: '==', value: 'divorced' },
        },
        {
          id: 'divorce_court', type: 'text', required: false,
          label: 'Суд, який розірвав шлюб',
          placeholder: 'Шевченківського районного суду м. Києва',
          show_if: { field: 'marital_status', operator: '==', value: 'divorced' },
        },
        {
          id: 'divorce_case_number', type: 'text', required: false,
          label: 'Номер справи про розірвання',
          placeholder: '761/1234/22',
          show_if: { field: 'marital_status', operator: '==', value: 'divorced' },
        },
        // Children
        {
          id: 'children_details', type: 'textarea', required: true,
          label: 'Дані про дітей',
          placeholder: 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
          tooltip: 'Кожна дитина — окремий рядок. Формат: ПІБ, дата народження, свідоцтво № ... від ...',
        },
        {
          id: 'family_cert_date', type: 'date', required: true,
          label: 'Дата довідки про склад сім\'ї',
          tooltip: 'Довідка підтверджує, що дитина проживає з вами',
        },
        {
          id: 'abandonment_date', type: 'date', required: true,
          label: 'З якої дати відповідач не утримує дитину',
          tooltip: 'Вкажіть приблизну дату, з якої відповідач перестав надавати фінансову допомогу',
        },
      ],
    },

    // ─── TAB 4: Аліменти ─────────────────────────────────────────────────────
    {
      id: 'alimony',
      label: 'Аліменти',
      fields: [
        {
          id: 'alimony_type', type: 'choice', required: true,
          label: 'Форма стягнення аліментів',
          tooltip: '% від доходу — автоматично розраховується судом. Фіксована сума — зручна якщо дохід відповідача нерегулярний або невідомий.',
          options: [
            { value: 'percent', label: 'Частка від заробітку (1/4, 1/3 або 1/2)' },
            { value: 'fixed',   label: 'Тверда грошова сума (фіксована)' },
          ],
        },
        {
          id: 'alimony_fixed_amount', type: 'text', required: false,
          label: 'Сума аліментів (грн/місяць)',
          placeholder: '5000',
          tooltip: 'Вкажіть бажану суму. Не менше 50% прожиткового мінімуму для дитини.',
          show_if: { field: 'alimony_type', operator: '==', value: 'fixed' },
        },
        {
          id: 'alimony_start_date', type: 'date', required: true,
          label: 'Дата подачі позову (з якої стягувати)',
          tooltip: 'Зазвичай — сьогоднішня дата. Аліменти стягуються починаючи з дати подачі позову.',
        },
        {
          id: 'defendant_employed', type: 'choice', required: true,
          label: 'Чи працевлаштований відповідач?',
          options: [
            { value: 'yes',     label: 'Так, офіційно працевлаштований' },
            { value: 'no',      label: 'Ні, не працевлаштований' },
            { value: 'unknown', label: 'Невідомо' },
          ],
        },
        {
          id: 'defendant_employer', type: 'text', required: false,
          label: 'Місце роботи відповідача',
          placeholder: 'ТОВ «Альфа Сервіс»',
          show_if: { field: 'defendant_employed', operator: '==', value: 'yes' },
        },
        {
          id: 'defendant_position', type: 'text', required: false,
          label: 'Посада відповідача',
          placeholder: 'менеджера',
          tooltip: 'Вкажіть у родовому відмінку: "менеджера", "бухгалтера", "директора"',
          show_if: { field: 'defendant_employed', operator: '==', value: 'yes' },
        },
        {
          id: 'defendant_salary', type: 'text', required: false,
          label: 'Приблизна зарплата відповідача (грн)',
          placeholder: '25000',
          show_if: { field: 'defendant_employed', operator: '==', value: 'yes' },
        },
        {
          id: 'defendant_other_income', type: 'textarea', required: false,
          label: 'Інші джерела доходу відповідача',
          placeholder: 'Здає квартиру в оренду (~5000 грн/міс)',
          tooltip: 'Необов\'язково. Якщо відомі інші доходи — вкажіть для суду.',
        },
      ],
    },
  ],
}
