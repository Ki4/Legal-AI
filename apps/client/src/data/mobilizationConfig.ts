import type { FormConfig } from '../types/form'

export const mobilizationConfig: FormConfig = {
  service_id: 'mobilization_deferral',
  title: 'Відстрочка від мобілізації',
  subtitle: 'Підготовка заяви та пакету документів',
  tabs: [
    { id: 'grounds',   label: 'Підстава' },
    { id: 'personal',  label: 'Особисті дані' },
    { id: 'documents', label: 'Документи' },
    { id: 'military',  label: 'Військовий облік' },
  ],
  steps: [

    // ══════════════════════════════════════════
    // TAB 1: ПІДСТАВА
    // ══════════════════════════════════════════
    {
      id: 'grounds',
      tab: 'grounds',
      type: 'choice',
      label: 'Підстава для відстрочки',
      hint: 'Оберіть підставу, що найточніше описує вашу ситуацію.',
      explanation:
        'Закон України «Про мобілізаційну підготовку та мобілізацію» (ст. 23) передбачає відстрочку для окремих категорій громадян.',
      required: true,
      options: [
        { value: 'student',    label: 'Студент денної форми навчання' },
        { value: 'children',   label: 'Батько дитини до 3 років' },
        { value: 'many_kids',  label: 'Багатодітний батько (3+ дітей)' },
        { value: 'caregiver',  label: 'Єдиний догляд за хворим родичем' },
        { value: 'critical',   label: 'Критична інфраструктура / ОПК' },
      ],
    },
    {
      id: 'has_prev_deferral',
      tab: 'grounds',
      type: 'boolean',
      label: 'Чи отримували ви відстрочку раніше?',
      hint: 'Повторна відстрочка можлива, але потребує додаткових підстав.',
      required: true,
    },
    {
      id: 'prev_deferral_reason',
      tab: 'grounds',
      type: 'text',
      label: 'Підстава попередньої відстрочки',
      placeholder: 'Напр.: навчання у КНУ ім. Шевченка, 2023 р.',
      show_if: { field: 'has_prev_deferral', operator: '==', value: true },
      animation: 'slide-down',
    },

    // ══════════════════════════════════════════
    // TAB 2: ОСОБИСТІ ДАНІ
    // ══════════════════════════════════════════
    {
      id: 'last_name',
      tab: 'personal',
      type: 'text',
      label: 'Прізвище',
      placeholder: 'Шевченко',
      required: true,
    },
    {
      id: 'first_name',
      tab: 'personal',
      type: 'text',
      label: "Ім'я",
      placeholder: 'Тарас',
      required: true,
    },
    {
      id: 'middle_name',
      tab: 'personal',
      type: 'text',
      label: 'По батькові',
      placeholder: 'Григорович',
      required: true,
    },
    {
      id: 'birth_date',
      tab: 'personal',
      type: 'date',
      label: 'Дата народження',
      required: true,
    },
    {
      id: 'ipn',
      tab: 'personal',
      type: 'text',
      label: 'ІПН (РНОКПП)',
      placeholder: '1234567890',
      hint: '10-значний ідентифікаційний номер платника податків.',
      required: true,
    },
    {
      id: 'address',
      tab: 'personal',
      type: 'text',
      label: 'Адреса реєстрації',
      placeholder: 'м. Київ, вул. Хрещатик, 1, кв. 10',
      required: true,
    },
    {
      id: 'phone',
      tab: 'personal',
      type: 'phone',
      label: 'Контактний телефон',
      placeholder: '+380 67 123 45 67',
      required: true,
    },

    // — Поля для СТУДЕНТА —
    {
      id: 'university',
      tab: 'personal',
      type: 'text',
      label: 'Повна назва закладу освіти',
      placeholder: 'Київський національний університет ім. Тараса Шевченка',
      hint: 'Вкажіть офіційну назву відповідно до свідоцтва/довідки.',
      show_if: { field: 'grounds', operator: '==', value: 'student' },
      animation: 'slide-down',
    },
    {
      id: 'study_year',
      tab: 'personal',
      type: 'choice',
      label: 'Курс навчання',
      options: [1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} курс` })),
      show_if: { field: 'grounds', operator: '==', value: 'student' },
      animation: 'slide-down',
    },
    {
      id: 'graduation_date',
      tab: 'personal',
      type: 'date',
      label: 'Очікувана дата закінчення навчання',
      show_if: { field: 'grounds', operator: '==', value: 'student' },
      animation: 'slide-down',
    },

    // — Поля для БАТЬКІВ (children АБО many_kids) —
    {
      id: 'children_count',
      tab: 'personal',
      type: 'choice',
      label: 'Кількість дітей',
      options: [
        { value: '1', label: '1 дитина' },
        { value: '2', label: '2 дитини' },
        { value: '3', label: '3 дитини' },
        { value: '4+', label: '4 і більше' },
      ],
      show_if: { any: [
        { field: 'grounds', operator: '==', value: 'children' },
        { field: 'grounds', operator: '==', value: 'many_kids' },
      ]},
      animation: 'slide-down',
    },
    {
      id: 'youngest_child_birth',
      tab: 'personal',
      type: 'date',
      label: 'Дата народження наймолодшої дитини',
      hint: 'Для підтвердження віку дитини до 3 років.',
      show_if: { field: 'grounds', operator: '==', value: 'children' },
      animation: 'slide-down',
    },
    {
      id: 'spouse_status',
      tab: 'personal',
      type: 'choice',
      label: 'Статус другого з подружжя',
      options: [
        { value: 'works',    label: 'Працює / в декреті' },
        { value: 'disabled', label: 'Особа з інвалідністю' },
        { value: 'deceased', label: 'Померлий/а' },
        { value: 'single',   label: 'Одинока мати/батько' },
      ],
      show_if: { any: [
        { field: 'grounds', operator: '==', value: 'children' },
        { field: 'grounds', operator: '==', value: 'many_kids' },
      ]},
      animation: 'slide-down',
    },

    // — Поля для ДОГЛЯДУ —
    {
      id: 'caregiver_relation',
      tab: 'personal',
      type: 'choice',
      label: 'Ким є підопічна особа',
      options: [
        { value: 'parent',   label: 'Батько / мати' },
        { value: 'spouse',   label: 'Чоловік / дружина' },
        { value: 'sibling',  label: 'Брат / сестра' },
        { value: 'child',    label: 'Дитина з інвалідністю' },
      ],
      show_if: { field: 'grounds', operator: '==', value: 'caregiver' },
      animation: 'slide-down',
    },
    {
      id: 'caregiver_disability_group',
      tab: 'personal',
      type: 'choice',
      label: 'Група інвалідності підопічного',
      options: [
        { value: '1', label: 'I група' },
        { value: '2', label: 'II група' },
        { value: 'child', label: 'Дитина з інвалідністю' },
      ],
      show_if: { field: 'grounds', operator: '==', value: 'caregiver' },
      animation: 'slide-down',
    },

    // — Поля для КРИТИЧНОЇ ІНФРАСТРУКТУРИ —
    {
      id: 'employer',
      tab: 'personal',
      type: 'text',
      label: 'Назва підприємства / організації',
      placeholder: 'ДП «Антонов», ТОВ «Укренерго»...',
      hint: 'Підприємство має бути внесено до переліку критичної інфраструктури.',
      show_if: { field: 'grounds', operator: '==', value: 'critical' },
      animation: 'slide-down',
    },
    {
      id: 'position',
      tab: 'personal',
      type: 'text',
      label: 'Посада',
      placeholder: 'Інженер-конструктор 1 категорії',
      show_if: { field: 'grounds', operator: '==', value: 'critical' },
      animation: 'slide-down',
    },

    // ══════════════════════════════════════════
    // TAB 3: ДОКУМЕНТИ
    // ══════════════════════════════════════════
    {
      id: 'docs_student',
      tab: 'documents',
      type: 'multicheck',
      label: 'Документи студента (оберіть наявні)',
      hint: 'Всі документи мають бути чинними на дату подачі заяви.',
      options: [
        { value: 'student_card',  label: 'Студентський квиток' },
        { value: 'certificate',   label: 'Довідка з університету (форма №1)' },
        { value: 'transcript',    label: 'Витяг із залікової книжки' },
        { value: 'order',         label: 'Наказ про зарахування' },
      ],
      show_if: { field: 'grounds', operator: '==', value: 'student' },
      animation: 'slide-down',
    },
    {
      id: 'docs_children',
      tab: 'documents',
      type: 'multicheck',
      label: 'Документи (діти)',
      options: [
        { value: 'birth_cert',  label: 'Свідоцтво про народження дитини' },
        { value: 'marriage',    label: 'Свідоцтво про шлюб' },
        { value: 'reg_cert',    label: 'Довідка про реєстрацію місця проживання' },
      ],
      show_if: { any: [
        { field: 'grounds', operator: '==', value: 'children' },
        { field: 'grounds', operator: '==', value: 'many_kids' },
      ]},
      animation: 'slide-down',
    },
    {
      id: 'docs_caregiver',
      tab: 'documents',
      type: 'multicheck',
      label: 'Документи (догляд)',
      options: [
        { value: 'disability_cert', label: 'Посвідчення особи з інвалідністю' },
        { value: 'msek',            label: 'Висновок МСЕК' },
        { value: 'family_comp',     label: 'Довідка про склад сім\'ї' },
        { value: 'no_other',        label: 'Довідка про відсутність інших доглядачів' },
      ],
      show_if: { field: 'grounds', operator: '==', value: 'caregiver' },
      animation: 'slide-down',
    },
    {
      id: 'docs_critical',
      tab: 'documents',
      type: 'multicheck',
      label: 'Документи (критична інфраструктура)',
      options: [
        { value: 'employer_letter', label: 'Клопотання роботодавця' },
        { value: 'critical_list',   label: 'Витяг з переліку критичних підприємств' },
        { value: 'work_contract',   label: 'Трудовий договір / наказ про призначення' },
      ],
      show_if: { field: 'grounds', operator: '==', value: 'critical' },
      animation: 'slide-down',
    },
    {
      id: 'passport_type',
      tab: 'documents',
      type: 'choice',
      label: 'Тип документа, що посвідчує особу',
      required: true,
      options: [
        { value: 'id_card',   label: 'ID-картка' },
        { value: 'passport',  label: 'Паспорт (книжечка)' },
        { value: 'foreign',   label: 'Закордонний паспорт' },
      ],
    },

    // ══════════════════════════════════════════
    // TAB 4: ВІЙСЬКОВИЙ ОБЛІК
    // ══════════════════════════════════════════
    {
      id: 'tcc_name',
      tab: 'military',
      type: 'text',
      label: 'Назва ТЦК та СП',
      placeholder: 'Шевченківський РВК м. Київ',
      hint: 'Територіальний центр комплектування за місцем реєстрації.',
      required: true,
    },
    {
      id: 'military_rank',
      tab: 'military',
      type: 'choice',
      label: 'Категорія військовозобов\'язаного',
      required: true,
      options: [
        { value: 'reserve_1', label: 'Резерв 1-ї черги' },
        { value: 'reserve_2', label: 'Резерв 2-ї черги' },
        { value: 'conscript', label: 'Призовник' },
        { value: 'none',      label: 'Не перебуваю на обліку' },
      ],
    },
    {
      id: 'has_summons',
      tab: 'military',
      type: 'boolean',
      label: 'Чи отримували повістку?',
      required: true,
    },
    {
      id: 'summons_date',
      tab: 'military',
      type: 'date',
      label: 'Дата отримання повістки',
      hint: 'Вкажіть дату з повістки або дату вручення.',
      show_if: { field: 'has_summons', operator: '==', value: true },
      animation: 'slide-down',
    },
    {
      id: 'additional_info',
      tab: 'military',
      type: 'textarea',
      label: 'Додаткова інформація',
      placeholder: 'Вкажіть будь-які обставини, що можуть вплинути на розгляд заяви...',
    },
  ],
}
