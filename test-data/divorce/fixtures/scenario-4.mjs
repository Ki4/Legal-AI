// Scenario 4: Minimal (required fields only)
// Plaintiff: Тестенко Анна Тестівна (female)
// Spouse: Тестенко Іван (no middle name)

export const description = 'Мінімальний набір полів';

export const answers = {
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
};

export const mockAi = {
  plaintiff_instrumental:  'Тестенко Анною Тестівною',
  plaintiff_genitive:      'Тестенко Анни Тестівни',
  spouse_instrumental:     'Тестенком Іваном',
  spouse_genitive:         'Тестенка Івана',
  marriage_place_locative: 'відділі РАЦС Шевченківського району м. Києва',
  children_genitive:       null,
};
