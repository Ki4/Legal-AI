/**
 * Scenario 1 = TC1 (test-matrix §5) = example.md Кейс A
 * increase, percent (1/4) → percent (1/3), court_decision, 1 дитина 6-18
 * changed_facts: [child_needs_up_general, payer_income_up]
 * Збір — звільнення (п.3 ч.1 ст.5 ЗСЗ), суд — за вибором позивача (ст.28 ч.1 ЦПК).
 */

export const answers = {
  change_direction: 'increase',

  // Позивач = одержувач (з ким живе дитина)
  last_name: 'Коваленко', first_name: 'Оксана', middle_name: 'Іванівна',
  birth_date: '1988-04-12',
  registered_address: 'м. Київ, вул. Хрещатик, 22, кв. 5',
  same_actual_address: true,
  has_no_ipn: false, tax_number: '2987654321',
  plaintiff_phone: '+380501112233', plaintiff_email: 'o.kovalenko@example.com',
  plaintiff_official_email: 'absent',

  // Відповідач = платник
  defendant_last_name: 'Коваленко', defendant_first_name: 'Андрій', defendant_middle_name: 'Сергійович',
  defendant_birth_date: '1985-09-30',
  defendant_registered_address: 'м. Київ, вул. Лесі Українки, 7, кв. 41',
  defendant_actual_address_known: 'same',
  defendant_has_no_ipn: false, defendant_tax_number: '2876543210',
  defendant_official_email: 'absent',

  // Попереднє рішення (Таб 2)
  prior_basis: 'court_decision',
  prior_court: 'Шевченківського районного суду міста Києва',
  prior_case_number: '761/12345/20',
  prior_decision_date: '2020-03-15',
  prior_alimony_type: 'percent', prior_alimony_value: '1/4',

  // Діти (Таб 3)
  has_children: true,
  children_details: 'Коваленко Дарина Андріївна, 10.06.2016, свідоцтво № 123456 від 20.06.2016',

  // Зміна обставин (Таб 4)
  changed_facts: ['child_needs_up_general', 'payer_income_up'],
  changed_facts_detail: 'Донька пішла до школи, додались витрати на навчання, гуртки та лікування; колишній чоловік змінив роботу і його дохід зріс.',
  requested_alimony_type: 'percent', requested_alimony_value: '1/3',
  evidence_list: ['family_composition', 'education_expenses'],
};

export const mockAi = {
  plaintiff_genitive: 'Коваленко Оксани Іванівни',
  defendant_genitive: 'Коваленка Андрія Сергійовича',
  children_genitive: 'Коваленко Дарини Андріївни, 10.06.2016 р.н.',
};
