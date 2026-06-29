/**
 * alimony-document.js
 * n8n Code Node — будує позовну заяву про стягнення аліментів
 *
 * Вхід:
 *   answers   — об'єкт з відповідями форми (field_id: value)
 *   ai        — об'єкт з відміненими формами від AI:
 *               { plaintiff_instrumental, plaintiff_genitive,
 *                 defendant_instrumental, defendant_genitive,
 *                 marriage_place_locative, children_genitive }
 *
 * Вихід: рядок — готовий текст документа
 *
 * children_details format (one child per line):
 *   "Іванов Олег Петрович, 15.05.2015, свідоцтво № ІМ-КВ 123456 від 16.05.2015"
 */

function buildAlimonyDocument(answers, ai) {
  const a = answers;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const MONTHS = [
    'січня','лютого','березня','квітня','травня','червня',
    'липня','серпня','вересня','жовтня','листопада','грудня'
  ];

  function formatDate(iso) {
    if (!iso) return '________';
    const d = new Date(iso);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  function val(field, fallback = '________') {
    const v = a[field];
    if (v === null || v === undefined || v === '') return fallback;
    return v;
  }

  function has(field) {
    const v = a[field];
    return v !== null && v !== undefined && v !== '' && v !== false;
  }

  function isTrue(v) {
    return v === true || v === 'true';
  }

  function detectGender(middleName) {
    if (!middleName) return 'male';
    const m = String(middleName).trim();
    if (m.endsWith('івна') || m.endsWith('ївна') || m.endsWith('овна')) return 'female';
    return 'male';
  }

  /**
   * Parse children_details — one child per line:
   *   "Іванов Олег Петрович, 15.05.2015, свідоцтво № ІМ-КВ 123456 від 16.05.2015"
   * Returns [{ name, birthDate, certInfo }]
   */
  function parseChildren(details) {
    if (!details) return [];
    return String(details)
      .split(/\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/,\s*/);
        const name      = (parts[0] || '').trim();
        const birthDate = (parts[1] || '').trim();
        const certInfo  = parts.slice(2).join(', ').trim();
        return { name, birthDate, certInfo };
      })
      .filter(c => c.name);
  }

  function alimonyFraction(n) {
    if (n >= 3) return '1/2';
    if (n === 2) return '1/3';
    return '1/4';
  }

  // child gender from middle name (3rd word in ПІБ)
  function childGender(child) {
    const parts = child.name.split(/\s+/);
    return detectGender(parts[2]);
  }

  function childGenitivePhrase(children) {
    if (children.length > 1) return 'наших спільних дітей';
    return childGender(children[0]) === 'female'
      ? 'нашої спільної доньки'
      : 'нашого спільного сина';
  }

  /** "свідоцтво №..." → "свідоцтвом №..." (instrumental after "підтверджується") */
  function normalizeCert(certInfo) {
    if (!certInfo) return certInfo;
    const lc = certInfo.toLowerCase();
    if (lc.startsWith('свідоцтво ')) return 'свідоцтвом ' + certInfo.slice('свідоцтво '.length);
    return certInfo;
  }

  function minorChildPhrase(children) {
    if (children.length > 1) return 'неповнолітніх дітей';
    return childGender(children[0]) === 'female' ? 'неповнолітньої доньки' : 'неповнолітнього сина';
  }

  // ─── Base data ───────────────────────────────────────────────────────────────

  const plaintiffName  = [val('last_name'), val('first_name'), val('middle_name')]
    .filter(s => s !== '________').join(' ') || '________';
  const defendantName  = [val('defendant_last_name'), val('defendant_first_name'), val('defendant_middle_name')]
    .filter(s => s !== '________').join(' ') || '________';

  const isFemale      = detectGender(a.middle_name) === 'female';
  const isDefFemale   = detectGender(a.defendant_middle_name) === 'female';

  const plaintiffInstrumental = (ai && ai.plaintiff_instrumental) || plaintiffName;
  const plaintiffGenitive     = (ai && ai.plaintiff_genitive)     || plaintiffName;
  const defendantInstrumental = (ai && ai.defendant_instrumental) || defendantName;
  const defendantGenitive     = (ai && ai.defendant_genitive)     || defendantName;
  const marriagePlaceLocative = (ai && ai.marriage_place_locative) || val('marriage_place');

  const children  = parseChildren(a.children_details);
  const nChildren = children.length || 1;

  const childrenGenitive = (ai && ai.children_genitive)
    || (children.length > 0
      ? children.map(c => `${c.name}, ${c.birthDate} р.н.`).join('; ')
      : '________');

  const maritalStatus = a.marital_status || 'married'; // married | divorced | never_married
  const alimonyType   = a.alimony_type   || 'percent'; // percent | fixed

  const plaintiffDOB  = has('birth_date')          ? formatDate(a.birth_date)          : '________';
  const defendantDOB  = has('defendant_birth_date') ? formatDate(a.defendant_birth_date) : '________';

  // ─── ШАПКА ───────────────────────────────────────────────────────────────────

  let doc = '';

  doc += 'До суду за місцем проживання відповідача\n';
  doc += '(Знайти ваш суд: https://court.gov.ua/)\n\n';

  // Позивач
  doc += `Позивач: ${plaintiffName}\n`;
  doc += `Зареєстроване місце проживання: ${val('registered_address')}\n`;
  if (!isTrue(a.same_actual_address) && has('actual_address')) {
    doc += `Фактичне місце проживання: ${a.actual_address}\n`;
  }
  if (!isTrue(a.has_no_ipn) && has('tax_number')) {
    doc += `(реєстраційний номер облікової картки платника податків (ІПН): ${a.tax_number})\n`;
  } else if (isTrue(a.has_no_ipn) && has('passport_series')) {
    doc += `(серія та номер паспорта: ${a.passport_series})\n`;
  }
  if (has('plaintiff_phone')) doc += `Тел.: ${a.plaintiff_phone}\n`;
  if (has('plaintiff_email')) doc += `Адреса електронної пошти: ${a.plaintiff_email}\n`;
  doc += (a.plaintiff_official_email === 'present')
    ? 'Офіційна електронна адреса: наявна в ЄСІТС\n'
    : 'Офіційна електронна адреса — відсутня\n';

  doc += '\n';

  // Відповідач
  doc += `Відповідач: ${defendantName}\n`;
  if (has('defendant_registered_address')) {
    doc += `Зареєстроване місце проживання: ${a.defendant_registered_address}\n`;
  }
  if (a.defendant_actual_address_known === 'different' && has('defendant_actual_address')) {
    doc += `Фактичне місце проживання: ${a.defendant_actual_address}\n`;
  } else if (a.defendant_actual_address_known === 'unknown') {
    doc += 'Фактичне місце проживання невідоме\n';
  }
  if (!isTrue(a.defendant_has_no_ipn) && has('defendant_tax_number')) {
    doc += `(ІПН: ${a.defendant_tax_number})\n`;
  } else if (isTrue(a.defendant_has_no_ipn) && has('defendant_passport_series')) {
    doc += `(серія та номер паспорта: ${a.defendant_passport_series})\n`;
  }
  if (has('defendant_phone')) doc += `Тел.: ${a.defendant_phone}\n`;
  if (has('defendant_email')) doc += `Адреса електронної пошти: ${a.defendant_email}\n`;
  if (a.defendant_official_email === 'present') {
    doc += 'Офіційна електронна адреса: наявна в ЄСІТС\n';
  } else if (a.defendant_official_email === 'unknown') {
    doc += 'Офіційна електронна адреса — невідома\n';
  } else {
    doc += 'Офіційна електронна адреса — відсутня\n';
  }

  // ─── ЗАГОЛОВОК ───────────────────────────────────────────────────────────────

  doc += '\n\nПОЗОВНА ЗАЯВА\nпро стягнення аліментів\n\n\n';

  // ─── ФАКТИЧНА ЧАСТИНА ────────────────────────────────────────────────────────

  // 1. Marriage / relationship intro
  if (maritalStatus === 'married' || maritalStatus === 'divorced') {
    const marriageVerb = isFemale ? 'уклала' : 'уклав';
    const marriageDate = has('marriage_date') ? formatDate(a.marriage_date) : '________';
    const actNum = has('marriage_act_number')
      ? `актовий запис № ${a.marriage_act_number}`
      : 'актовий запис № ________';
    doc += `${marriageDate} року я, ${plaintiffName}, ${plaintiffDOB} року народження, ${marriageVerb} шлюб з ${defendantInstrumental}, ${defendantDOB} року народження, який ми зареєстрували у ${marriagePlaceLocative}, про що зроблений ${actNum}.\n\n`;
  }

  // 2. Divorce clause (if applicable)
  if (maritalStatus === 'divorced') {
    const divorceDate = has('divorce_date') ? formatDate(a.divorce_date) : '________';
    let divorceRef = 'копією рішення суду';
    if (has('divorce_court') && has('divorce_case_number')) {
      divorceRef = `рішенням ${a.divorce_court} від ${divorceDate} по справі № ${a.divorce_case_number}`;
    } else if (has('divorce_court')) {
      divorceRef = `рішенням ${a.divorce_court} від ${divorceDate}`;
    }
    doc += `Шлюб між мною та відповідачем розірвано ${divorceDate} року, що підтверджується ${divorceRef}.\n\n`;
  }

  // 3. Children
  const bornPrefix = maritalStatus === 'never_married' ? 'Від наших стосунків у нас' : 'У шлюбі у нас';

  if (children.length === 0) {
    // fallback (no data)
    doc += `${bornPrefix} народилась дитина: ________ (ПІБ дитини), ________ року народження, що підтверджується свідоцтвом про народження № ________ від ________ року.\n\n`;
  } else if (children.length === 1) {
    const c = children[0];
    const certPart = c.certInfo
      ? `, що підтверджується ${normalizeCert(c.certInfo)}`
      : ', що підтверджується свідоцтвом про народження № ________ від ________ року';
    doc += `${bornPrefix} народилась дитина: ${c.name}, ${c.birthDate} року народження${certPart}.\n\n`;
  } else {
    doc += `${bornPrefix} народились діти:\n`;
    children.forEach((c, i) => {
      const certPart = c.certInfo ? `, що підтверджується ${normalizeCert(c.certInfo)}` : '';
      doc += `${i + 1}) ${c.name}, ${c.birthDate} року народження${certPart};\n`;
    });
    doc += '\n';
  }

  const famCertDate = has('family_cert_date') ? formatDate(a.family_cert_date) : '________';
  const liveSubj = nChildren === 1 ? 'Дитина проживає' : 'Діти проживають';
  doc += `${liveSubj} разом зі мною, що підтверджується довідкою про склад сім'ї від ${famCertDate} року.\n\n`;

  // 4. Defendant not supporting
  const abandonDate   = has('abandonment_date') ? formatDate(a.abandonment_date) : '________';
  const childPhrase = children.length > 0 ? childGenitivePhrase(children) : 'нашого спільного сина';
  doc += `Відповідно до ст. 180 Сімейного кодексу України (надалі – СК України), батьки зобов'язані утримувати дитину до досягнення нею повноліття, а відповідач з ${abandonDate} року не бере участі у вихованні та утриманні ${childPhrase}.\n\n`;

  // ─── ПРАВОВА ЧАСТИНА ─────────────────────────────────────────────────────────

  doc += 'Відповідно до ст. 150 СК України, батьки зобов\'язані виховувати дитину в дусі поваги до прав та свобод інших людей, любові до своєї сім\'ї та родини, свого народу, своєї Батьківщини. Батьки зобов\'язані піклуватися про здоров\'я дитини, її фізичний, духовний та моральний розвиток. Батьки зобов\'язані забезпечити здобуття дитиною повної загальної середньої освіти, готувати її до самостійного життя.\n\n';

  const countSubj = nChildren === 1 ? 'дитині' : 'дітям';
  doc += `Таким чином, ${countSubj} повинен бути забезпечений належний рівень життя, необхідний для фізичного, розумового, духовного, морального і соціального розвитку.\n\n`;

  // 5. Income / amount reasoning
  const parentWord  = isDefFemale ? 'мати' : 'батько';
  const whichParent = isDefFemale ? 'яка є здоровою та працездатною' : 'який є здоровим та працездатним';
  const aloneWord   = isFemale ? 'я одна' : 'я один';

  if (alimonyType === 'percent') {
    const fraction = alimonyFraction(nChildren);
    let incomeClause = '';
    if (a.defendant_employed === 'yes' && has('defendant_employer')) {
      const pos    = has('defendant_position') ? ` на посаді ${a.defendant_position}` : '';
      const salary = has('defendant_salary')   ? ` та має постійний дохід у розмірі ${a.defendant_salary} грн` : '';
      incomeClause = `, оскільки працює в ${a.defendant_employer}${pos}${salary}`;
    } else if (a.defendant_employed === 'no') {
      incomeClause = '. Відповідач на даний час офіційно не працевлаштований, проте є працездатним і може отримувати доходи';
    }
    doc += `Такий рівень ${aloneWord} не зможу забезпечити, тому ${parentWord}, ${whichParent}, зможе сплачувати аліменти на рівні ${fraction} частини з усіх видів заробітку (доходу)${incomeClause}.\n\n`;
  } else {
    const fixedAmount = has('alimony_fixed_amount') ? `${a.alimony_fixed_amount} гривень` : '________ гривень';
    let incomeClause = '';
    if (a.defendant_employed === 'yes' && has('defendant_employer')) {
      const pos    = has('defendant_position') ? ` на посаді ${a.defendant_position}` : '';
      const salary = has('defendant_salary')   ? `, отримує дохід у розмірі ${a.defendant_salary} грн` : '';
      incomeClause = `, оскільки працює в ${a.defendant_employer}${pos}${salary}`;
    }
    doc += `Такий рівень ${aloneWord} не зможу забезпечити самостійно, тому ${parentWord}, ${whichParent}, зможе сплачувати аліменти у твердій грошовій сумі в розмірі ${fixedAmount} щомісяця${incomeClause}.\n\n`;
  }

  if (has('defendant_other_income')) {
    doc += `Крім того, відповідач має інші джерела доходу: ${a.defendant_other_income}.\n\n`;
  }

  doc += 'У відповідності до ст. 141 СК України мати, батько мають рівні права та обов\'язки щодо дитини, незалежно від того, чи перебували вони у шлюбі між собою. Розірвання шлюбу між батьками, проживання їх окремо від дитини не впливає на обсяг їхніх прав і не звільняє від обов\'язків щодо дитини.\n\n';

  doc += 'Відповідно до ч. 2 ст. 182 СК України розмір аліментів має бути необхідним та достатнім для забезпечення гармонійного розвитку дитини.\n\n';

  doc += 'Крім цього, відповідно до вимог Сімейного кодексу України (ст. 182-184), вирішуючи питання щодо розміру аліментів, суд повинен ураховувати: стан здоров\'я, матеріальне становище дитини і платника аліментів; наявність в останнього інших неповнолітніх дітей, непрацездатних чоловіка, дружини, батьків, повнолітніх дочки, сина; наявність рухомого та нерухомого майна, грошових коштів; інші обставини, що мають істотне значення.\n\n';

  const defOtherPron = isDefFemale ? 'вона' : 'він';
  doc += `Так, відповідач є працездатним, отримує дохід, а тому вважаю, що ${defOtherPron} може сплачувати аліменти у зазначеному розмірі.\n\n`;

  // ─── ПРОЦЕСУАЛЬНА ЧАСТИНА (ст.175 ЦПК) ──────────────────────────────────────

  doc += 'Відповідно до п.6 ч.3 ст.175 ЦПК України повідомляю, що заходи досудового врегулювання спору не проводилися.\n\n';
  doc += 'Відповідно до п.7 ч.3 ст.175 ЦПК України повідомляю, що вжиття заходів забезпечення доказів або позову до подання позовної заяви не здійснювалось.\n\n';
  doc += 'Відповідно до п.8 ч.3 ст.175 ЦПК України повідомляю, що у позивача перебувають оригінали письмових або електронних доказів, копії яких додано до заяви.\n\n';
  doc += 'Згідно із п.9 ч.3 ст.175 ЦПК України повідомляю, що витрати на правову допомогу відсутні.\n\n';
  doc += 'У відповідності із п.10 ч.3 ст.175 ЦПК України підтверджую, що мною не подано іншого позову (позовів) до цього ж відповідача (відповідачів) з тим самим предметом та з тих самих підстав.\n\n';

  // ст.175 ч.7 ЦПК (Закон №4833-IX): реквізити рахунку позивача у позові про стягнення коштів.
  // Аліменти = завжди стягнення коштів → блок безумовний; гілка «рахунку немає» — закон допускає
  // для фізособи (#87 / issue #76). NB: це ЧАСТИНА 7, не «п.7 ч.3» (інша норма, вище).
  if (a.plaintiff_has_account && a.plaintiff_account_iban) {
    doc += `Відповідно до частини сьомої статті 175 ЦПК України повідомляю реквізити рахунку для зарахування присуджених коштів у разі задоволення позову: ${val('plaintiff_account_iban')}${a.plaintiff_account_bank ? `, відкритий у ${val('plaintiff_account_bank')}` : ''}.\n\n`;
  } else {
    doc += `Відповідно до частини сьомої статті 175 ЦПК України повідомляю, що рахунок у банку або небанківському надавачі платіжних послуг відсутній; бажаний спосіб отримання присуджених коштів у разі задоволення позову — ${val('plaintiff_payout_method')}.\n\n`;
  }

  // ─── СУДОВИЙ ЗБІР ────────────────────────────────────────────────────────────

  const exemptWord = isFemale ? 'звільнена' : 'звільнений';
  doc += `Від сплати судового збору за подання позову про стягнення аліментів я ${exemptWord} на підставі п.3 ч.1 ст.5 Закону України «Про судовий збір».\n\n`;

  // ─── ПРОШУ ───────────────────────────────────────────────────────────────────

  doc += 'На підставі викладеного та у відповідності до ст.ст. 150, 180–184 СК України, керуючись ст.ст. 174, 175 ЦПК України,—\n\n';
  doc += 'П Р О Ш У  С У Д :\n\n';

  const startDate  = has('alimony_start_date') ? formatDate(a.alimony_start_date) : '________';
  const tillWord   = nChildren > 1 ? 'дітей' : 'дитини';

  if (alimonyType === 'percent') {
    const fraction = alimonyFraction(nChildren);
    doc += `1. Стягнути з ${defendantGenitive}, ${defendantDOB} року народження, на користь ${plaintiffGenitive}, ${plaintiffDOB} року народження, аліменти на утримання ${childrenGenitive} в розмірі ${fraction} частини з усіх видів заробітку (доходу), але не менше 50 відсотків прожиткового мінімуму для дитини відповідного віку, щомісячно, починаючи стягнення з ${startDate} року і до повноліття ${tillWord}.\n\n`;
  } else {
    const fixedAmount = has('alimony_fixed_amount') ? `${a.alimony_fixed_amount} гривень` : '________ гривень';
    doc += `1. Стягнути з ${defendantGenitive}, ${defendantDOB} року народження, на користь ${plaintiffGenitive}, ${plaintiffDOB} року народження, аліменти на утримання ${childrenGenitive} у твердій грошовій сумі в розмірі ${fixedAmount} щомісячно, починаючи стягнення з ${startDate} року і до повноліття ${tillWord}.\n\n`;
  }

  // ─── ДОДАТКИ ─────────────────────────────────────────────────────────────────

  doc += 'Додатки:\n';
  if (maritalStatus === 'married' || maritalStatus === 'divorced') {
    doc += '- копія свідоцтва про укладення шлюбу — 2 примірники;\n';
  }
  if (maritalStatus === 'divorced') {
    doc += '- копія рішення суду про розірвання шлюбу — 2 примірники;\n';
  }
  const certPlural = nChildren > 1 ? 'свідоцтв про народження дітей' : 'свідоцтва про народження дитини';
  doc += `- копія ${certPlural} — по 2 примірники;\n`;
  doc += '- довідка про склад сім\'ї — 2 примірники;\n';
  doc += '- копія паспорта позивача — 2 примірники;\n';
  if (!isTrue(a.has_no_ipn)) {
    doc += '- копія облікової картки платника податків позивача — 2 примірники;\n';
  }
  doc += '- 1 екземпляр позовної заяви з копіями доданих документів для відповідача по справі.\n';

  // ─── ПІДПИС ──────────────────────────────────────────────────────────────────

  doc += `\n\n«___» _______ 20__ року                                              (підпис)    ${plaintiffName}\n`;

  return doc;
}


// ─── QUICK TEST ──────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && require.main === module) {
  const testAnswers = {
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
  };

  const testAi = {
    plaintiff_instrumental:  'Іванову Інну Петрівну',
    plaintiff_genitive:      'Іванової Інни Петрівни',
    defendant_instrumental:  'Іванова Івана Івановича',
    defendant_genitive:      'Іванова Івана Івановича',
    marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
    children_genitive:       'Іванова Олега Івановича, 15.05.2018 р.н.',
  };

  const result = buildAlimonyDocument(testAnswers, testAi);
  console.log(result);
  console.log('\n--- СИМВОЛІВ:', result.length, '---');
}
