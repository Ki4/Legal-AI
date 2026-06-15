/**
 * Scenario 2 = TC2 (test-matrix §5)
 * decrease, fixed (15000) → fixed (2000), court_decision, 1 дитина < 6
 * delta=13000 → price_of_claim=156000, 1% = 1560 > 1331.20 → НЕ floor.
 * changed_facts: [payer_income_down]; existing_debt = 'no'.
 * Branch coverage: same_actual_address=false, has_no_ipn=true (passport),
 * defendant_actual_address_known='different', defendant_official_email='present'.
 */

export const answers = {
  change_direction: 'decrease',

  // Позивач = платник
  last_name: 'Петренко', first_name: 'Олександр', middle_name: 'Вікторович',
  birth_date: '1986-02-14',
  registered_address: 'м. Київ, вул. Драгоманова, 15, кв. 8',
  same_actual_address: false,
  actual_address: 'м. Київ, вул. Здолбунівська, 3, кв. 12',
  has_no_ipn: true, passport_series: 'СН 123456',
  plaintiff_phone: '+380672223344', plaintiff_email: 'o.petrenko@example.com',
  plaintiff_official_email: 'present',

  // Відповідач = одержувач
  defendant_last_name: 'Петренко', defendant_first_name: 'Марина', defendant_middle_name: 'Сергіївна',
  defendant_birth_date: '1989-05-03',
  defendant_registered_address: 'м. Київ, вул. Антоновича, 22, кв. 10',
  defendant_actual_address_known: 'different',
  defendant_actual_address: 'м. Бориспіль, вул. Київський шлях, 15',
  defendant_has_no_ipn: false, defendant_tax_number: '3123456789',
  defendant_phone: '+380632345566', defendant_email: 'm.petrenko@example.com',
  defendant_official_email: 'present',

  // Попереднє рішення (Таб 2)
  prior_basis: 'court_decision',
  prior_court: 'Дарницького районного суду міста Києва',
  prior_case_number: '753/4567/19',
  prior_decision_date: '2019-11-20',
  prior_alimony_type: 'fixed', prior_alimony_value: '15000',

  // Діти (Таб 3)
  has_children: true,
  children_details: 'Петренко Софія Олександрівна, 10.03.2024, свідоцтво № І-ПД 654321 від 15.03.2024',

  // Зміна обставин (Таб 4)
  changed_facts: ['payer_income_down'],
  changed_facts_detail: 'Позивач втратив роботу за основним місцем працевлаштування, його дохід суттєво знизився.',
  existing_debt: 'no',
  requested_alimony_type: 'fixed', requested_alimony_value: '2000',
  evidence_list: ['income_decrease'],
};

export const mockAi = {
  plaintiff_genitive: 'Петренка Олександра Вікторовича',
  defendant_genitive: 'Петренко Марини Сергіївни',
  children_genitive: 'Петренко Софії Олександрівни, 10.03.2024 р.н.',
};
