/**
 * Scenario 3: Одна дитина, батьки не були у шлюбі, % від доходу
 * Позивач — мати, відповідач — батько, дохід невідомий
 */

export const answers = {
  // Позивач
  last_name: 'Мельник', first_name: 'Оксана', middle_name: 'Василівна',
  birth_date: '1995-07-10',
  registered_address: 'м. Харків, вул. Сумська, 15, кв. 3',
  same_actual_address: true,
  has_no_ipn: true,
  passport_series: 'МН 456789',
  plaintiff_phone: '+380661234567',
  plaintiff_official_email: 'absent',

  // Відповідач
  defendant_last_name: 'Бондар', defendant_first_name: 'Сергій', defendant_middle_name: 'Петрович',
  defendant_birth_date: '1993-02-14',
  defendant_registered_address: 'м. Харків, пр. Науки, 44, кв. 10',
  defendant_actual_address_known: 'unknown',
  defendant_has_no_ipn: false,
  defendant_tax_number: '2489012345',
  defendant_official_email: 'absent',

  // Шлюб
  marital_status: 'never_married',

  // Діти
  children_details: 'Мельник Дарина Сергіївна, 05.03.2020, свідоцтво № І-ХК 789012 від 06.03.2020',
  family_cert_date: '2024-02-20',
  abandonment_date: '2021-06-01',

  // Аліменти
  alimony_type: 'percent',
  defendant_employed: 'unknown',
  alimony_start_date: '2024-03-01',

  // Реквізити рахунку позивача (ЦПК ст.175 ч.7) — рахунку немає, вказано спосіб
  plaintiff_has_account: false,
  plaintiff_payout_method: 'поштовий переказ за адресою реєстрації позивача',
};

export const mockAi = {
  plaintiff_instrumental:  'Мельник Оксану Василівну',
  plaintiff_genitive:      'Мельник Оксани Василівни',
  defendant_instrumental:  'Бондарем Сергієм Петровичем',
  defendant_genitive:      'Бондаря Сергія Петровича',
  marriage_place_locative: null,
  children_genitive:       'Мельник Дарини Сергіївни, 05.03.2020 р.н.',
};
