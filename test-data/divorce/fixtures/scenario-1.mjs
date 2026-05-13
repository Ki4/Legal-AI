// Scenario 1: Simple divorce (no children, mutual consent)
// Plaintiff: Петренко Оксана Іванівна (female)
// Spouse: Петренко Андрій Сергійович

export const description = 'Просте розлучення (без дітей, взаємна згода)';

export const answers = {
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
};

export const mockAi = {
  plaintiff_instrumental:  'Петренко Оксаною Іванівною',
  plaintiff_genitive:      'Петренко Оксани Іванівни',
  spouse_instrumental:     'Петренком Андрієм Сергійовичем',
  spouse_genitive:         'Петренка Андрія Сергійовича',
  marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
  children_genitive:       null,
};
