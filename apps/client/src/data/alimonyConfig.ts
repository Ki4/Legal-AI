import type { FormConfig } from '../types/form'

export const alimonyConfig: FormConfig = {
  service_id: 'alimony',
  title: 'Аліменти',
  subtitle: 'Підготовка заяви про стягнення аліментів на дитину',
  tabs: [
    { id: 'plaintiff',  label: 'Позивач' },
    { id: 'respondent', label: 'Відповідач' },
    { id: 'children',   label: 'Діти' },
    { id: 'finances',   label: 'Фінанси' },
  ],
  steps: [

    // ══════════════════════════════════════════
    // TAB 1: ПОЗИВАЧ
    // ══════════════════════════════════════════
    {
      id: 'last_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'Ваше прізвище',
      placeholder: 'Коваленко',
      required: true,
    },
    {
      id: 'first_name',
      tab: 'plaintiff',
      type: 'text',
      label: 'Імʼя',
      placeholder: 'Олена',
      required: true,
    },
    {
      id: 'patronymic',
      tab: 'plaintiff',
      type: 'text',
      label: 'По батькові',
      placeholder: 'Іванівна',
    },
    {
      id: 'birth_date',
      tab: 'plaintiff',
      type: 'date',
      label: 'Дата народження',
      required: true,
    },
    {
      id: 'address',
      tab: 'plaintiff',
      type: 'text',
      label: 'Адреса проживання',
      placeholder: 'м. Київ, вул. Хрещатик, 1, кв. 5',
      required: true,
      hint: 'За цією адресою визначається підсудність',
    },
    {
      id: 'phone',
      tab: 'plaintiff',
      type: 'phone',
      label: 'Номер телефону',
      placeholder: '+380501234567',
    },
    {
      id: 'marital_status',
      tab: 'plaintiff',
      type: 'choice',
      label: 'Поточний сімейний статус',
      required: true,
      options: [
        { value: 'divorced',  label: 'Розлучені' },
        { value: 'separated', label: 'Живемо окремо, шлюб не розірваний' },
        { value: 'married',   label: 'Офіційно у шлюбі' },
        { value: 'not_married', label: 'У шлюбі не перебували' },
      ],
    },

    // ══════════════════════════════════════════
    // TAB 2: ВІДПОВІДАЧ
    // ══════════════════════════════════════════
    {
      id: 'respondent_last_name',
      tab: 'respondent',
      type: 'text',
      label: 'Прізвище відповідача',
      placeholder: 'Коваленко',
      required: true,
    },
    {
      id: 'respondent_first_name',
      tab: 'respondent',
      type: 'text',
      label: 'Імʼя відповідача',
      placeholder: 'Сергій',
      required: true,
    },
    {
      id: 'respondent_patronymic',
      tab: 'respondent',
      type: 'text',
      label: 'По батькові відповідача',
      placeholder: 'Миколайович',
    },
    {
      id: 'respondent_birth_date',
      tab: 'respondent',
      type: 'date',
      label: 'Дата народження відповідача',
    },
    {
      id: 'respondent_address',
      tab: 'respondent',
      type: 'text',
      label: 'Адреса відповідача (якщо відома)',
      placeholder: 'м. Київ, вул. ...',
      hint: 'Якщо невідома — суд може встановити через реєстр',
    },
    {
      id: 'respondent_workplace',
      tab: 'respondent',
      type: 'text',
      label: 'Місце роботи відповідача (якщо відомо)',
      placeholder: 'ТОВ "Компанія", м. Київ',
      hint: 'Допомагає при примусовому стягненні',
    },

    // ══════════════════════════════════════════
    // TAB 3: ДІТИ
    // ══════════════════════════════════════════
    {
      id: 'children_count',
      tab: 'children',
      type: 'choice',
      label: 'Кількість неповнолітніх дітей',
      required: true,
      options: [
        { value: '1', label: '1 дитина' },
        { value: '2', label: '2 дитини' },
        { value: '3', label: '3 дитини' },
        { value: '4+', label: '4 або більше' },
      ],
    },
    {
      id: 'children_details',
      tab: 'children',
      type: 'textarea',
      label: 'ПІБ та дати народження дітей',
      placeholder: 'Коваленко Іван Сергійович, 15.03.2018\nКоваленко Марія Сергіївна, 22.07.2020',
      required: true,
      hint: 'Кожну дитину — з нового рядка',
    },
    {
      id: 'children_living_with',
      tab: 'children',
      type: 'choice',
      label: 'З ким проживають діти?',
      required: true,
      options: [
        { value: 'me',         label: 'Зі мною' },
        { value: 'respondent', label: 'З відповідачем' },
        { value: 'shared',     label: 'Почергово / спільна опіка' },
      ],
    },
    {
      id: 'alimony_type',
      tab: 'children',
      type: 'choice',
      label: 'Форма стягнення аліментів',
      required: true,
      explanation: 'Відсотки від доходу — стандартна форма: 25% на 1 дитину, 33% на 2, 50% на 3+. Тверда сума — фіксована щомісячна виплата, незалежно від доходу.',
      options: [
        { value: 'percent',    label: 'Відсотки від доходу (стандартно)' },
        { value: 'fixed',      label: 'Тверда грошова сума' },
        { value: 'combined',   label: 'Комбінована форма' },
      ],
    },
    {
      id: 'fixed_amount',
      tab: 'children',
      type: 'text',
      label: 'Бажана сума аліментів (грн/місяць)',
      placeholder: '5000',
      show_if: { any: [
        { field: 'alimony_type', operator: '==', value: 'fixed' },
        { field: 'alimony_type', operator: '==', value: 'combined' },
      ]},
      animation: 'slide-down',
      hint: 'Не менше прожиткового мінімуму (зараз ~2563 грн)',
    },

    // ══════════════════════════════════════════
    // TAB 4: ФІНАНСИ
    // ══════════════════════════════════════════
    {
      id: 'respondent_employed',
      tab: 'finances',
      type: 'boolean',
      label: 'Відповідач офіційно працевлаштований?',
    },
    {
      id: 'respondent_employer',
      tab: 'finances',
      type: 'text',
      label: 'Назва роботодавця',
      placeholder: 'ТОВ "Назва підприємства"',
      show_if: { field: 'respondent_employed', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'respondent_income_known',
      tab: 'finances',
      type: 'boolean',
      label: 'Відомий розмір доходу відповідача?',
    },
    {
      id: 'respondent_income_amount',
      tab: 'finances',
      type: 'text',
      label: 'Орієнтовний дохід відповідача (грн/місяць)',
      placeholder: '30000',
      show_if: { field: 'respondent_income_known', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'has_enforcement',
      tab: 'finances',
      type: 'boolean',
      label: 'Були раніше рішення суду про аліменти?',
      hint: 'Якщо так — це може бути зміна розміру аліментів',
    },
    {
      id: 'enforcement_details',
      tab: 'finances',
      type: 'textarea',
      label: 'Вкажіть деталі попереднього рішення',
      placeholder: 'Рішення від 01.01.2020, сума 2000 грн/міс...',
      show_if: { field: 'has_enforcement', operator: '==', value: true },
      animation: 'slide-down',
    },
  ],
}
