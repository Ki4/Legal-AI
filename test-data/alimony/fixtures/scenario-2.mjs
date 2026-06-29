/**
 * Scenario 2: Двоє дітей, у шлюбі (не розлучені), фіксована сума
 * Позивач — батько, відповідач — мати, не працевлаштована
 */

export const answers = {
  // Позивач
  last_name: 'Коваленко', first_name: 'Дмитро', middle_name: 'Олегович',
  birth_date: '1985-11-20',
  registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
  same_actual_address: false,
  actual_address: 'м. Одеса, вул. Пушкінська, 1, кв. 3',
  tax_number: '2756789012', has_no_ipn: false,
  plaintiff_phone: '+380931234567',
  plaintiff_official_email: 'absent',

  // Відповідач
  defendant_last_name: 'Коваленко', defendant_first_name: 'Наталія', defendant_middle_name: 'Вікторівна',
  defendant_birth_date: '1987-04-03',
  defendant_registered_address: 'м. Одеса, вул. Рішельєвська, 20, кв. 8',
  defendant_actual_address_known: 'same',
  defendant_tax_number: '2667890123', defendant_has_no_ipn: false,
  defendant_official_email: 'absent',

  // Шлюб
  marital_status: 'married',
  marriage_date: '2010-09-10',
  marriage_place: 'Приморський відділ РАЦС Одеського міського управління юстиції',
  marriage_act_number: '312',

  // Діти
  children_details: [
    'Коваленко Олена Дмитрівна, 15.05.2012, свідоцтво № І-ОД 456789 від 16.05.2012',
    'Коваленко Максим Дмитрович, 22.08.2015, свідоцтво № І-ОД 567890 від 23.08.2015',
  ].join('\n'),
  family_cert_date: '2024-03-01',
  abandonment_date: '2023-10-01',

  // Аліменти
  alimony_type: 'fixed',
  alimony_fixed_amount: '8000',
  defendant_employed: 'no',
  alimony_start_date: '2024-03-15',

  // Реквізити рахунку позивача (ЦПК ст.175 ч.7) — є рахунок
  plaintiff_has_account: true,
  plaintiff_account_iban: 'UA903052992990004149123456789',
  plaintiff_account_bank: 'АТ «Ощадбанк»',
};

export const mockAi = {
  plaintiff_instrumental:  'Коваленку Дмитру Олеговичу',
  plaintiff_genitive:      'Коваленка Дмитра Олеговича',
  defendant_instrumental:  'Коваленко Наталією Вікторівною',
  defendant_genitive:      'Коваленко Наталії Вікторівни',
  marriage_place_locative: 'Приморському відділі РАЦС Одеського міського управління юстиції',
  children_genitive:       'Коваленко Олени Дмитрівни, 15.05.2012 р.н.; Коваленка Максима Дмитровича, 22.08.2015 р.н.',
};
