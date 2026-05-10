#!/usr/bin/env node
// =============================================================
// Test: send mock form data to n8n webhook (UTF-8 safe)
// Usage: node scripts/test-webhook.mjs [scenario]
//   1 = simple, 2 = children+alimony, 3 = complex, 4 = minimal
// =============================================================

const WEBHOOK_URL = 'https://legal-ai-assistant.app.n8n.cloud/webhook-test/form-submit'

const scenarios = {
  1: {
    name: 'Simple divorce (no children, mutual consent)',
    data: {
      service_slug: 'divorce',
      user_id: '236581343',
      answers: {
        last_name: 'Петренко',
        first_name: 'Оксана',
        middle_name: 'Іванівна',
        birth_date: '1990-03-15',
        registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
        same_actual_address: true,
        tax_number: '2934567890',
        has_no_ipn: false,
        plaintiff_phone: '+380501234567',
        plaintiff_email: 'petrenko.oksana@gmail.com',
        plaintiff_official_email: 'absent',
        surname_after_divorce: 'maiden',
        maiden_name: 'Мельник',
        spouse_last_name: 'Петренко',
        spouse_first_name: 'Андрій',
        spouse_middle_name: 'Сергійович',
        spouse_birth_date: '1988-07-22',
        spouse_registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
        spouse_actual_address_known: 'same',
        spouse_tax_number: '2845678901',
        spouse_has_no_ipn: false,
        spouse_phone: '+380671234567',
        spouse_email: 'petrenko.andrii@gmail.com',
        spouse_official_email: 'absent',
        marriage_date: '2015-06-20',
        marriage_place: 'Шевченківський відділ РАЦС у м. Києві',
        marriage_act_number: '547',
        marriage_cert_series: 'І-КВ № 234567',
        marriage_cert_date: '2015-06-20',
        spouse_consents: true,
        has_children: false,
        divorce_reasons: ['no_common_interests', 'no_understanding'],
        joint_household: 'no',
        has_joint_property: false,
        debt_claim: false,
        simplified_proceedings: 'yes',
        court_fee_exempt: 'no',
        court_costs_on: 'defendant',
        pretrial_settlement: 'none',
        evidence_preservation: 'none',
        originals_location: 'plaintiff',
        no_other_lawsuits: true,
      },
    },
  },
  2: {
    name: 'Children + alimony',
    data: {
      service_slug: 'divorce',
      user_id: '236581343',
      answers: {
        last_name: 'Коваленко',
        first_name: 'Марія',
        middle_name: 'Олександрівна',
        birth_date: '1985-11-08',
        registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
        same_actual_address: false,
        actual_address: 'м. Одеса, вул. Рішельєвська, 3, кв. 8',
        tax_number: '2756789012',
        has_no_ipn: false,
        plaintiff_phone: '+380931234567',
        plaintiff_email: 'kovalenko.maria@ukr.net',
        plaintiff_official_email: 'absent',
        surname_after_divorce: 'keep',
        spouse_last_name: 'Коваленко',
        spouse_first_name: 'Віктор',
        spouse_middle_name: 'Петрович',
        spouse_birth_date: '1983-02-14',
        spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
        spouse_actual_address_known: 'same',
        spouse_tax_number: '2667890123',
        spouse_has_no_ipn: false,
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
        pretrial_settlement: 'none',
        evidence_preservation: 'none',
        originals_location: 'plaintiff',
        no_other_lawsuits: true,
      },
    },
  },
  3: {
    name: 'Complex (children + property + debt + exempt)',
    data: {
      service_slug: 'divorce',
      user_id: '236581343',
      answers: {
        last_name: 'Шевченко',
        first_name: 'Тетяна',
        middle_name: 'Миколаївна',
        birth_date: '1980-12-25',
        registered_address: 'м. Харків, вул. Сумська, 15, кв. 3',
        same_actual_address: true,
        tax_number: '2578901234',
        has_no_ipn: false,
        plaintiff_phone: '+380661234567',
        plaintiff_email: 'shevchenko.tetiana@gmail.com',
        plaintiff_official_email: 'absent',
        surname_after_divorce: 'maiden',
        maiden_name: 'Бондар',
        spouse_last_name: 'Шевченко',
        spouse_first_name: 'Олег',
        spouse_middle_name: 'Васильович',
        spouse_birth_date: '1978-06-03',
        spouse_registered_address: 'м. Харків, пр. Науки, 44, кв. 10',
        spouse_actual_address_known: 'different',
        spouse_actual_address: 'м. Харків, вул. Пушкінська, 67, кв. 2',
        spouse_tax_number: '2489012345',
        spouse_has_no_ipn: false,
        spouse_phone: '+380991234567',
        spouse_email: 'shevchenko.oleg@gmail.com',
        spouse_official_email: 'absent',
        marriage_date: '2005-03-01',
        marriage_place: 'Центральний відділ РАЦС Харківського міського управління юстиції',
        marriage_act_number: '189',
        marriage_cert_series: 'І-ХК № 678901',
        marriage_cert_date: '2005-03-01',
        spouse_consents: false,
        has_children: true,
        children_details: 'Шевченко Дарина Олегівна, 10.10.2010',
        children_live_with: 'plaintiff',
        children_dispute: 'none',
        alimony_claim: true,
        alimony_amount: 'fixed',
        divorce_reasons: ['alcohol', 'abuse', 'no_child_care', 'no_financial_support'],
        joint_household: 'no',
        has_joint_property: true,
        property_dispute: 'separate',
        debt_claim: true,
        simplified_proceedings: 'yes',
        court_fee_exempt: 'yes',
        court_fee_exempt_reason: 'disability_1_2',
        court_costs_on: 'defendant',
        pretrial_settlement: 'conducted',
        evidence_preservation: 'none',
        originals_location: 'partial',
        no_other_lawsuits: true,
      },
    },
  },
  4: {
    name: 'Minimal (required fields only)',
    data: {
      service_slug: 'divorce',
      user_id: '236581343',
      answers: {
        last_name: 'Тестенко',
        first_name: 'Анна',
        middle_name: 'Тестівна',
        birth_date: '1990-01-01',
        registered_address: 'м. Київ, вул. Тестова, 1, кв. 1',
        spouse_last_name: 'Тестенко',
        spouse_first_name: 'Іван',
        spouse_registered_address: 'м. Київ, вул. Тестова, 2, кв. 3',
        marriage_date: '2020-06-01',
        marriage_place: 'Відділ РАЦС Шевченківського району м. Києва',
        spouse_consents: true,
        has_children: false,
        divorce_reasons: ['lost_feelings', 'incompatibility'],
        joint_household: 'no',
        simplified_proceedings: 'yes',
        court_costs_on: 'defendant',
        pretrial_settlement: 'none',
        evidence_preservation: 'none',
        originals_location: 'plaintiff',
        no_other_lawsuits: true,
      },
    },
  },
}

const num = parseInt(process.argv[2] || '4', 10)
const scenario = scenarios[num]
if (!scenario) {
  console.log('Usage: node scripts/test-webhook.mjs [1|2|3|4]')
  process.exit(1)
}

console.log(`📋 Scenario ${num}: ${scenario.name}`)
console.log(`🚀 Sending to: ${WEBHOOK_URL}\n`)

try {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(scenario.data),
  })
  const text = await res.text()
  console.log(`📨 Response (${res.status}):`)
  console.log(text)
  console.log()
  if (res.ok) {
    console.log('✅ Check n8n executions and Telegram for the result.')
  } else {
    console.log('❌ Error! Click "Execute Workflow" in n8n first.')
  }
} catch (e) {
  console.error('❌ Fetch error:', e.message)
}
