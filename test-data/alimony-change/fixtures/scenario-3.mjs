/**
 * Scenario 3 = TC9 (test-matrix §5)
 * decrease, fixed (6000) → fixed (4000), court_decision, 1 дитина 6-18, existing_debt='yes'
 * delta=2000 → price_of_claim=24000, 1% = 240 < 1331.20 → court_fee = floor (1331.20).
 * changed_facts: [payer_new_dependents].
 * Branch coverage: same_actual_address=true (no actual_address line), has_no_ipn=false (tax_number),
 * defendant_actual_address_known='unknown', defendant_has_no_ipn=true (passport),
 * defendant_official_email='unknown'.
 */

export const answers = {
  change_direction: 'decrease',

  // Позивач = платник
  last_name: 'Бондаренко', first_name: 'Віталій', middle_name: 'Олегович',
  birth_date: '1983-11-02',
  registered_address: 'м. Київ, вул. Велика Васильківська, 50, кв. 17',
  same_actual_address: true,
  has_no_ipn: false, tax_number: '3211234567',
  plaintiff_phone: '+380501239988', plaintiff_email: 'v.bondarenko@example.com',
  plaintiff_official_email: 'absent',

  // Відповідач = одержувач
  defendant_last_name: 'Бондаренко', defendant_first_name: 'Тетяна', defendant_middle_name: 'Миколаївна',
  defendant_birth_date: '1986-04-18',
  defendant_registered_address: 'м. Київ, вул. Сагайдачного, 9, кв. 3',
  defendant_actual_address_known: 'unknown',
  defendant_has_no_ipn: true, defendant_passport_series: 'МК 765432',
  defendant_phone: '+380673214455', defendant_email: 't.bondarenko@example.com',
  defendant_official_email: 'unknown',

  // Попереднє рішення (Таб 2)
  prior_basis: 'court_decision',
  prior_court: 'Печерського районного суду міста Києва',
  prior_case_number: '757/9876/19',
  prior_decision_date: '2019-08-12',
  prior_alimony_type: 'fixed', prior_alimony_value: '6000',

  // Діти (Таб 3)
  has_children: true,
  children_details: 'Бондаренко Максим Віталійович, 05.09.2017, свідоцтво № І-ПД 112233 від 10.09.2017',

  // Зміна обставин (Таб 4)
  changed_facts: ['payer_new_dependents'],
  changed_facts_detail: 'У позивача народилася ще одна дитина, він несе витрати на її утримання.',
  existing_debt: 'yes',
  requested_alimony_type: 'fixed', requested_alimony_value: '4000',
  evidence_list: ['family_composition', 'new_child_birth_cert'],
};

export const mockAi = {
  plaintiff_genitive: 'Бондаренка Віталія Олеговича',
  defendant_genitive: 'Бондаренко Тетяни Миколаївни',
  children_genitive: 'Бондаренка Максима Віталійовича, 05.09.2017 р.н.',
};
