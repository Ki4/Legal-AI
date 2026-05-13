/**
 * Scenario 1: Одна дитина, після розлучення, % від доходу
 * Позивач — мати, відповідач — батько, працевлаштований
 */

export const answers = {
  // Позивач
  last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
  birth_date: '1990-03-15',
  registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
  same_actual_address: true,
  tax_number: '2934567890', has_no_ipn: false,
  plaintiff_phone: '+380501234567',
  plaintiff_email: 'inna.ivanova@gmail.com',
  plaintiff_official_email: 'absent',

  // Відповідач
  defendant_last_name: 'Іванов', defendant_first_name: 'Іван', defendant_middle_name: 'Іванович',
  defendant_birth_date: '1988-07-22',
  defendant_registered_address: 'м. Київ, вул. Грушевського, 5, кв. 3',
  defendant_actual_address_known: 'same',
  defendant_tax_number: '2845678901', defendant_has_no_ipn: false,
  defendant_official_email: 'unknown',

  // Шлюб
  marital_status: 'divorced',
  marriage_date: '2015-06-20',
  marriage_place: 'Шевченківський відділ РАЦС у м. Києві',
  marriage_act_number: '547',
  divorce_date: '2022-03-10',
  divorce_court: 'Шевченківського районного суду м. Києва',
  divorce_case_number: '761/1234/22',

  // Діти
  children_details: 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
  family_cert_date: '2024-01-10',
  abandonment_date: '2022-03-01',

  // Аліменти
  alimony_type: 'percent',
  defendant_employed: 'yes',
  defendant_employer: 'ТОВ «Альфа Сервіс»',
  defendant_position: 'менеджера',
  defendant_salary: '25000',
  alimony_start_date: '2024-02-01',
};

export const mockAi = {
  plaintiff_instrumental:  'Іванову Інну Петрівну',
  plaintiff_genitive:      'Іванової Інни Петрівни',
  defendant_instrumental:  'Івановим Іваном Івановичем',
  defendant_genitive:      'Іванова Івана Івановича',
  marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
  children_genitive:       'Іванова Олега Івановича, 15.05.2018 р.н.',
};
