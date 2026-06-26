/**
 * Realistic per-service example form answers, used ONLY to render a filled
 * "this is what the client gets" document preview in the admin (A5, session 48).
 *
 * Source of truth for the shapes: the byte-parity goldens in
 * n8n/templates/__tests__/*-template-parity.test.js (BASE_ANSWERS, "most
 * branches on" realistic cases). Kept in sync by sampleAnswers.test.ts, which
 * renders each set through the real doc-engine and asserts the document fills
 * (key values present, no leftover '________' skeleton holes).
 *
 * These are display fixtures, not legal data — fictional people.
 */
export const SAMPLE_ANSWERS: Record<string, Record<string, unknown>> = {
  divorce: {
    last_name: 'Коваленко', first_name: 'Марія', middle_name: 'Олександрівна',
    birth_date: '1985-11-08',
    registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
    same_actual_address: true,
    tax_number: '2756789012', has_no_ipn: false,
    plaintiff_phone: '+380931234567',
    plaintiff_email: 'kovalenko.maria@ukr.net',
    plaintiff_official_email: 'absent',
    surname_after_divorce: 'keep',

    spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович',
    spouse_birth_date: '1983-02-14',
    spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
    spouse_actual_address_known: 'same',
    spouse_tax_number: '2667890123', spouse_has_no_ipn: false,
    spouse_phone: '+380951234567',
    spouse_email: 'kovalenko.viktor@ukr.net',
    spouse_official_email: 'unknown',

    marriage_date: '2010-09-10',
    marriage_place: 'Приморський відділ РАЦС Одеського міського управління юстиції',
    marriage_act_number: '312',
    marriage_cert_series: 'І-ОД № 456789',
    marriage_cert_date: '2010-09-10',

    spouse_consents: false,
    has_children: true,
    children_details: 'Коваленко Олена Вікторівна, 15.05.2012\nКоваленко Максим Вікторович, 22.08.2015',
    children_live_with: 'plaintiff',
    children_dispute: 'none',
    alimony_claim: true,
    alimony_amount: 'percent',
    divorce_reasons: ['no_understanding', 'different_views', 'no_financial_support'],
    joint_household: 'no',

    has_joint_property: false,
    debt_claim: false,
    simplified_proceedings: 'yes',
    court_fee_exempt: 'no',
    court_costs_on: 'defendant',
    pretrial_settlement: 'not_conducted',
    evidence_preservation: 'not_conducted',
    originals_location: 'plaintiff',
  },

  alimony: {
    last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
    birth_date: '1990-03-15',
    registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
    same_actual_address: true,
    tax_number: '2934567890', has_no_ipn: false,
    plaintiff_phone: '+380501234567',
    plaintiff_email: 'inna.ivanova@gmail.com',
    plaintiff_official_email: 'absent',

    defendant_last_name: 'Іванов', defendant_first_name: 'Іван', defendant_middle_name: 'Іванович',
    defendant_birth_date: '1988-07-22',
    defendant_registered_address: 'м. Київ, вул. Грушевського, 5, кв. 3',
    defendant_actual_address_known: 'same',
    defendant_tax_number: '2845678901', defendant_has_no_ipn: false,
    defendant_official_email: 'unknown',

    marital_status: 'divorced',
    marriage_date: '2015-06-20',
    marriage_place: 'Шевченківський відділ РАЦС у м. Києві',
    marriage_act_number: '547',
    divorce_date: '2022-03-10',
    divorce_court: 'Шевченківського районного суду м. Києва',
    divorce_case_number: '761/1234/22',

    children_details: 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
    family_cert_date: '2024-01-10',
    abandonment_date: '2022-03-01',

    alimony_type: 'percent',
    defendant_employed: 'yes',
    defendant_employer: 'ТОВ «Альфа Сервіс»',
    defendant_position: 'менеджера',
    defendant_salary: '25000',
    alimony_start_date: '2024-02-01',
  },
}

/** Returns realistic example answers for a service slug, or null if none defined. */
export function sampleAnswersFor(slug: string | null | undefined): Record<string, unknown> | null {
  if (!slug) return null
  return SAMPLE_ANSWERS[slug] ?? null
}
