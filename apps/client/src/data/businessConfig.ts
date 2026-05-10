import type { FormConfig } from '../types/form'

export const businessConfig: FormConfig = {
  service_id: 'business',
  title: 'Бізнес / ФОП',
  subtitle: 'Реєстрація, закриття або юридичний супровід ФОП та ТОВ',
  tabs: [
    { id: 'general', label: 'Загальне' },
    { id: 'details', label: 'Деталі' },
  ],
  steps: [

    // ══════════════════════════════════════════
    // TAB 1: ЗАГАЛЬНЕ
    // ══════════════════════════════════════════
    {
      id: 'action_type',
      tab: 'general',
      type: 'choice',
      label: 'Що потрібно зробити?',
      required: true,
      options: [
        { value: 'open',         label: 'Відкрити ФОП або ТОВ' },
        { value: 'close',        label: 'Закрити ФОП або ТОВ' },
        { value: 'change_kved',  label: 'Змінити / додати КВЕДи' },
        { value: 'change_data',  label: 'Змінити дані (адреса, назва тощо)' },
        { value: 'consult',      label: 'Потрібна консультація' },
      ],
    },
    {
      id: 'entity_type',
      tab: 'general',
      type: 'choice',
      label: 'Форма господарювання',
      required: true,
      options: [
        { value: 'fop',  label: 'ФОП (фізична особа-підприємець)' },
        { value: 'tov',  label: 'ТОВ (товариство з обмеженою відповідальністю)' },
        { value: 'pp',   label: 'ПП (приватне підприємство)' },
        { value: 'other', label: 'Інша форма' },
      ],
    },
    {
      id: 'last_name',
      tab: 'general',
      type: 'text',
      label: 'Прізвище',
      placeholder: 'Іваненко',
      required: true,
    },
    {
      id: 'first_name',
      tab: 'general',
      type: 'text',
      label: 'Імʼя',
      placeholder: 'Іван',
      required: true,
    },
    {
      id: 'patronymic',
      tab: 'general',
      type: 'text',
      label: 'По батькові',
      placeholder: 'Іванович',
    },
    {
      id: 'tax_id',
      tab: 'general',
      type: 'text',
      label: 'РНОКПП (ІПН)',
      placeholder: '1234567890',
      hint: '10-значний ідентифікаційний номер платника податків',
    },
    {
      id: 'phone',
      tab: 'general',
      type: 'phone',
      label: 'Номер телефону',
      placeholder: '+380501234567',
      required: true,
    },

    // ══════════════════════════════════════════
    // TAB 2: ДЕТАЛІ
    // ══════════════════════════════════════════
    {
      id: 'tax_system',
      tab: 'details',
      type: 'choice',
      label: 'Система оподаткування',
      show_if: { any: [
        { field: 'action_type', operator: '==', value: 'open' },
        { field: 'action_type', operator: '==', value: 'consult' },
      ]},
      animation: 'slide-down',
      explanation: 'ЄП 1 гр: до 167 МЗП, без найманих; ЄП 2 гр: до 834 МЗП, до 10 найманих; ЄП 3 гр: до 1167 МЗП, без обмежень; Загальна: без обмежень, з ПДВ.',
      options: [
        { value: 'ep1', label: 'Єдиний податок 1 група' },
        { value: 'ep2', label: 'Єдиний податок 2 група' },
        { value: 'ep3', label: 'Єдиний податок 3 група' },
        { value: 'general', label: 'Загальна система' },
        { value: 'unknown', label: 'Не визначився, потрібна консультація' },
      ],
    },
    {
      id: 'activity_description',
      tab: 'details',
      type: 'textarea',
      label: 'Вид діяльності (що плануєте робити / що робите зараз)',
      placeholder: 'Розробка програмного забезпечення, IT-консалтинг...',
      show_if: { any: [
        { field: 'action_type', operator: '==', value: 'open' },
        { field: 'action_type', operator: '==', value: 'change_kved' },
        { field: 'action_type', operator: '==', value: 'consult' },
      ]},
      animation: 'slide-down',
      hint: 'Опишіть своїми словами — підберемо відповідні КВЕДи',
    },
    {
      id: 'current_kved',
      tab: 'details',
      type: 'text',
      label: 'Поточний основний КВЕД (якщо є)',
      placeholder: '62.01 — Розробка комп\'ютерних програм',
      show_if: { field: 'action_type', operator: '==', value: 'change_kved' },
      animation: 'slide-down',
    },
    {
      id: 'edrpou',
      tab: 'details',
      type: 'text',
      label: 'ЄДРПОУ або реєстраційний номер (якщо є)',
      placeholder: '12345678',
      show_if: { any: [
        { field: 'action_type', operator: '==', value: 'close' },
        { field: 'action_type', operator: '==', value: 'change_kved' },
        { field: 'action_type', operator: '==', value: 'change_data' },
      ]},
      animation: 'slide-down',
    },
    {
      id: 'closing_reason',
      tab: 'details',
      type: 'choice',
      label: 'Причина закриття',
      show_if: { field: 'action_type', operator: '==', value: 'close' },
      animation: 'slide-down',
      options: [
        { value: 'voluntary',   label: 'Добровільне рішення' },
        { value: 'no_activity', label: 'Відсутність діяльності' },
        { value: 'debts',       label: 'Є борги / зобовʼязання' },
        { value: 'other',       label: 'Інша причина' },
      ],
    },
    {
      id: 'has_employees',
      tab: 'details',
      type: 'boolean',
      label: 'Є наймані працівники?',
      show_if: { field: 'action_type', operator: '==', value: 'close' },
      animation: 'slide-down',
    },
    {
      id: 'additional_info',
      tab: 'details',
      type: 'textarea',
      label: 'Додаткова інформація або запитання',
      placeholder: 'Будь-які деталі, що можуть бути важливими...',
    },
  ],
}
