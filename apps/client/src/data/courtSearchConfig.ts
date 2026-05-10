import type { FormConfig } from '../types/form'

export const courtSearchConfig: FormConfig = {
  service_id: 'court_search',
  title: 'Пошук суду',
  subtitle: 'Автоматизований пошук підсудності та контактів суду',
  tabs: [
    { id: 'general', label: 'Ваша справа' },
  ],
  steps: [

    // ══════════════════════════════════════════
    // TAB 1: ВАША СПРАВА
    // ══════════════════════════════════════════
    {
      id: 'case_type',
      tab: 'general',
      type: 'choice',
      label: 'Тема позову',
      required: true,
      options: [
        { value: 'divorce',      label: 'Розірвання шлюбу' },
        { value: 'alimony',      label: 'Стягнення аліментів' },
        { value: 'property',     label: 'Майновий спір' },
        { value: 'labor',        label: 'Трудовий спір' },
        { value: 'debt',         label: 'Стягнення боргу' },
        { value: 'housing',      label: 'Житловий спір' },
        { value: 'admin',        label: 'Адміністративне оскарження' },
        { value: 'other',        label: 'Інше' },
      ],
    },
    {
      id: 'plaintiff_region',
      tab: 'general',
      type: 'text',
      label: 'Ваша область',
      placeholder: 'Київська область',
      required: true,
    },
    {
      id: 'plaintiff_city',
      tab: 'general',
      type: 'text',
      label: 'Ваше місто або район',
      placeholder: 'м. Київ / Вишгородський район',
      required: true,
    },
    {
      id: 'defendant_region',
      tab: 'general',
      type: 'text',
      label: 'Область відповідача (якщо відрізняється)',
      placeholder: 'Харківська область',
      hint: 'Позов подається за місцем проживання відповідача (або позивача — у справах про аліменти)',
    },
    {
      id: 'defendant_city',
      tab: 'general',
      type: 'text',
      label: 'Місто або район відповідача',
      placeholder: 'м. Харків',
    },
    {
      id: 'claim_amount',
      tab: 'general',
      type: 'choice',
      label: 'Ціна позову (якщо майнова вимога)',
      show_if: { any: [
        { field: 'case_type', operator: '==', value: 'property' },
        { field: 'case_type', operator: '==', value: 'debt' },
        { field: 'case_type', operator: '==', value: 'labor' },
      ]},
      animation: 'slide-down',
      explanation: 'Від ціни позову залежить розмір судового збору та підсудність (місцевий чи апеляційний суд).',
      options: [
        { value: 'under_100k',  label: 'До 100 000 грн' },
        { value: '100k_500k',   label: '100 000 — 500 000 грн' },
        { value: 'over_500k',   label: 'Понад 500 000 грн' },
        { value: 'unknown',     label: 'Складно визначити' },
      ],
    },
    {
      id: 'urgency',
      tab: 'general',
      type: 'choice',
      label: 'Терміновість',
      options: [
        { value: 'normal',  label: 'Звичайна — ознайомлення з процесом' },
        { value: 'soon',    label: 'Найближчі 1-2 тижні' },
        { value: 'urgent',  label: 'Терміново — є строки або засідання' },
      ],
    },
    {
      id: 'additional_info',
      tab: 'general',
      type: 'textarea',
      label: 'Додаткові деталі (необовʼязково)',
      placeholder: 'Будь-яка інформація, що допоможе знайти правильний суд...',
    },
  ],
}
