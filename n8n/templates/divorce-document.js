/**
 * divorce-document.js
 * n8n Code Node — будує позовну заяву про розірвання шлюбу
 *
 * Вхід:
 *   answers   — об'єкт з відповідями форми (field_id: value)
 *   ai        — об'єкт з відміненими формами від AI:
 *               { plaintiff_instrumental, plaintiff_genitive,
 *                 spouse_instrumental, spouse_genitive,
 *                 marriage_place_locative, children_genitive }
 *
 * Вихід: рядок — готовий текст документа
 *
 * n8n entry point (Code node):
 *   const answers = $('Webhook').item.json.body.answers;
 *   const ai = JSON.parse($('AI Declension').item.json.choices[0].message.content);
 *   const document = buildDivorceDocument(answers, ai);
 *   return [{ json: { document } }];
 */

function buildDivorceDocument(answers, ai) {
  const a = answers;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const MONTHS = [
    'січня','лютого','березня','квітня','травня','червня',
    'липня','серпня','вересня','жовтня','листопада','грудня'
  ];

  /** ISO дата → "20 червня 2015" */
  function formatDate(iso) {
    if (!iso) return '________';
    const d = new Date(iso);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  /** ISO дата → "«20» червня 2015" (для початку речення) */
  function formatDateQuoted(iso) {
    if (!iso) return '«___» _______ _____';
    const d = new Date(iso);
    return `«${d.getUTCDate()}» ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  /** Значення поля або прочерк */
  function val(field, fallback = '________') {
    const v = a[field];
    if (v === null || v === undefined || v === '') return fallback;
    return v;
  }

  /** Чи заповнено поле */
  function has(field) {
    const v = a[field];
    return v !== null && v !== undefined && v !== '' && v !== false;
  }

  /** Стать за по батькові */
  function detectGender(middleName) {
    if (!middleName) return 'male';
    const m = String(middleName).trim();
    if (m.endsWith('івна') || m.endsWith('ївна') || m.endsWith('овна')) return 'female';
    return 'male';
  }

  /** Булевий або рядковий "true"/"false" → boolean */
  function isTrue(v) {
    return v === true || v === 'true';
  }

  const REASONS_MAP = {
    'no_common_interests':  'відсутність спільних інтересів',
    'no_understanding':     'відсутність взаєморозуміння',
    'different_views':      'різні погляди на сімейне життя та обов\'язки подружжя',
    'lost_feelings':        'втрата почуття любові та поваги один до одного',
    'incompatibility':      'несумісність характерів',
    'alcohol':              'зловживання алкоголем з боку відповідача',
    'abuse':                'жорстоке поводження з членами сім\'ї з боку відповідача',
    'no_financial_support': 'відсутність фінансової підтримки сім\'ї з боку відповідача',
    'no_child_care':        'ухилення від виховання дітей з боку відповідача',
  };

  /** Масив кодів причин → природній текст ("а також" перед останньою) */
  function formatReasons(reasons) {
    if (!reasons || !reasons.length) return '________';
    const texts = (Array.isArray(reasons) ? reasons : [reasons])
      .map(r => REASONS_MAP[r] || r)
      .filter(Boolean);
    if (texts.length === 0) return '________';
    if (texts.length === 1) return texts[0];
    const last = texts.pop();
    return texts.join(', ') + ', а також ' + last;
  }

  /** Частка аліментів залежно від кількості дітей */
  function alimonyFraction(n) {
    if (n >= 3) return '1/2 (50%)';
    if (n === 2) return '1/3 (33%)';
    return '1/4 (25%)';
  }

  /** Кількість дітей з рядка children_details (один запис на рядок) */
  function countChildren(details) {
    if (!details) return 1;
    const lines = String(details).split(/\n/).filter(l => l.trim());
    return Math.max(1, lines.length);
  }

  /** "дитиною" / "дітьми" */
  function childWord(n) {
    return n === 1 ? 'дитиною' : 'дітьми';
  }

  /** Parse children_details → масив рядків */
  function parseChildren(details) {
    if (!details) return [];
    return String(details).split(/\n/).map(l => l.trim()).filter(Boolean);
  }

  /** Масив дітей → нумерований список з "р.н." для вбудовування в речення */
  function inlineChildren(details) {
    const kids = parseChildren(details);
    if (kids.length === 0) return '________';
    if (kids.length === 1) return `${kids[0]} р.н.`;
    return kids.map((k, i) => `${i + 1}) ${k} р.н.`).join('; ');
  }

  // ─── Базові дані ─────────────────────────────────────────────────────────────

  const plaintiffName = [val('last_name'), val('first_name'), val('middle_name')]
    .filter(s => s !== '________').join(' ') || '________';
  const spouseName = [val('spouse_last_name'), val('spouse_first_name'), val('spouse_middle_name')]
    .filter(s => s !== '________').join(' ') || '________';

  const isFemale      = detectGender(a.middle_name)       === 'female';
  const spouseIsFemale = detectGender(a.spouse_middle_name) === 'female';

  const plaintiffInstrumental  = (ai && ai.plaintiff_instrumental)  || plaintiffName;
  const plaintiffGenitive      = (ai && ai.plaintiff_genitive)     || plaintiffName;
  const spouseInstrumental     = (ai && ai.spouse_instrumental)    || spouseName;
  const spouseGenitive         = (ai && ai.spouse_genitive)        || spouseName;
  const marriagePlaceLocative  = (ai && ai.marriage_place_locative) || val('marriage_place');
  const childrenGenitive       = (ai && ai.children_genitive)      || inlineChildren(a.children_details);

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
  doc += `Відповідач: ${spouseName}\n`;
  if (has('spouse_registered_address')) {
    doc += `Зареєстроване місце проживання: ${a.spouse_registered_address}\n`;
  }
  if (a.spouse_actual_address_known === 'different' && has('spouse_actual_address')) {
    doc += `Фактичне місце проживання: ${a.spouse_actual_address}\n`;
  } else if (a.spouse_actual_address_known === 'unknown') {
    doc += 'Фактичне місце проживання невідоме\n';
  }
  if (!isTrue(a.spouse_has_no_ipn) && has('spouse_tax_number')) {
    doc += `(ІПН: ${a.spouse_tax_number})\n`;
  } else if (isTrue(a.spouse_has_no_ipn) && has('spouse_passport_series')) {
    doc += `(серія та номер паспорта: ${a.spouse_passport_series})\n`;
  }
  if (has('spouse_phone')) doc += `Тел.: ${a.spouse_phone}\n`;
  if (has('spouse_email')) doc += `Адреса електронної пошти: ${a.spouse_email}\n`;
  if (a.spouse_official_email === 'present') {
    doc += 'Офіційна електронна адреса: наявна в ЄСІТС\n';
  } else if (a.spouse_official_email === 'unknown') {
    doc += 'Офіційна електронна адреса — невідома\n';
  } else {
    doc += 'Офіційна електронна адреса — відсутня\n';
  }

  // ─── ЗАГОЛОВОК ───────────────────────────────────────────────────────────────

  doc += '\n\nПОЗОВНА ЗАЯВА\nпро розірвання шлюбу\n\n\n';

  // ─── ФАКТИЧНА ЧАСТИНА ────────────────────────────────────────────────────────

  const marriageDateQuoted = formatDateQuoted(a.marriage_date);
  const marriageVerb = isFemale ? 'зареєструвала' : 'зареєстрував';
  const actNum = has('marriage_act_number') ? `актовий запис № ${a.marriage_act_number}` : 'актовий запис № ________';
  let marriageCert = '';
  if (has('marriage_cert_series')) {
    marriageCert = ` (копія свідоцтва про шлюб Серії ${a.marriage_cert_series}`;
    if (has('marriage_cert_date')) {
      marriageCert += ` від ${formatDate(a.marriage_cert_date)} року`;
    }
    marriageCert += ')';
  }

  doc += `${marriageDateQuoted} року я, ${plaintiffName} (надалі за текстом – Позивач) ${marriageVerb} шлюб із ${spouseInstrumental} у ${marriagePlaceLocative}, ${actNum}${marriageCert}.\n\n`;

  // Згода відповідача
  if (isTrue(a.spouse_consents)) {
    doc += `Відповідач ${spouseIsFemale ? 'згодна' : 'згоден'} на розірвання шлюбу.\n\n`;
  } else {
    doc += 'Відповідач не дає згоди на розірвання шлюбу.\n\n';
  }

  // Діти
  if (isTrue(a.has_children)) {
    if (has('children_details')) {
      const childrenText = inlineChildren(a.children_details);
      const period = childrenText.endsWith('.') ? '' : '.';
      doc += `Від даного шлюбу у сторін є спільні неповнолітні діти: ${childrenText}${period}\n`;
    } else {
      doc += 'Від даного шлюбу у сторін є спільні неповнолітні діти: ________ (ПІБ та дати народження).\n';
    }
    if (a.children_live_with === 'plaintiff')        doc += 'Діти проживають з позивачем.\n';
    else if (a.children_live_with === 'defendant')   doc += 'Діти проживають з відповідачем.\n';
    else if (a.children_live_with === 'both')        doc += 'Діти проживають частково з кожним із батьків.\n';
    doc += '\n';
  } else {
    doc += 'Від даного шлюбу спільних дітей у сторін немає.\n\n';
  }

  // ─── ПРАВОВЕ ОБҐРУНТУВАННЯ ───────────────────────────────────────────────────

  doc += 'Відповідно до ч.3 ст.105 СК України шлюб припиняється внаслідок його розірвання за позовом одного з подружжя на підставі рішення суду.\n\n';
  doc += 'Розірвання шлюбу судом відбувається за позовом одного з подружжя відповідно до ст.110 СК України.\n\n';
  doc += 'Відповідно до ст.112 Сімейного кодексу України суд постановляє рішення про розірвання шлюбу, якщо буде встановлено, що подальше спільне життя подружжя і збереження шлюбу суперечило б інтересам одного з них, інтересам їхніх дітей, що мають істотне значення.\n\n';

  const reasonsText = formatReasons(a.divorce_reasons);
  doc += `Підставами для розірвання шлюбу є: ${reasonsText}.\n\n`;

  doc += (a.joint_household === 'yes')
    ? 'З відповідачем продовжуємо вести спільне господарство.\n\n'
    : 'З відповідачем спільного господарства не ведемо.\n\n';

  doc += 'З урахуванням викладеного, вважаю, що подружні відносини між мною та відповідачем фактично припинилися. Подальше спільне життя та збереження шлюбу суперечить моїм інтересам, у зв\'язку з чим наполягаю на його розірванні.\n\n';

  // Спір про дітей
  if (isTrue(a.has_children)) {
    if (a.children_dispute === 'separate') {
      doc += 'Спір щодо місця проживання та виховання дітей є, але буде вирішуватися в окремому провадженні.\n\n';
    } else {
      doc += 'Спір щодо місця проживання та виховання дітей відсутній.\n\n';
    }
  }

  // Спільне майно
  if (isTrue(a.has_joint_property)) {
    if (a.property_dispute === 'separate') {
      doc += 'За час шлюбу сторонами набуто спільне майно. Спір щодо поділу буде вирішуватися в окремому провадженні.\n\n';
    } else {
      const propDetails = has('property_details') ? a.property_details : '________';
      const propEnd = propDetails.endsWith('.') ? '' : '.';
      doc += `За час шлюбу сторонами набуто спільне майно: ${propDetails}${propEnd}\n`;
      doc += `Позивач просить визнати за ${isFemale ? 'нею' : 'ним'} право на 1/2 частку зазначеного майна.\n\n`;
    }
  }

  // Боргові зобов'язання
  if (isTrue(a.debt_claim)) {
    const debtDetails = has('debt_details') ? a.debt_details : '________';
    const debtEnd = debtDetails.endsWith('.') ? '' : '.';
    doc += `Між сторонами є спільні боргові зобов'язання: ${debtDetails}${debtEnd} Відповідно до ст.65 Сімейного кодексу України, позивач просить розподілити зазначені боргові зобов'язання між сторонами.\n\n`;
  }

  // ─── ПРОЦЕСУАЛЬНІ ВИМОГИ (ст.175 ЦПК, пп.6-10) ──────────────────────────────

  doc += 'Відповідно до ст.27 ЦПК України позови до фізичної особи пред\'являються в суд за зареєстрованим у встановленому законом порядку місцем її проживання або перебування, якщо інше не передбачено законом.\n\n';

  // п.6 — досудове врегулювання
  doc += (a.pretrial_settlement === 'conducted')
    ? 'Згідно з п.6 ч.3 ст.175 ЦПК України повідомляю, що заходи досудового врегулювання спору проводилися (медіація / листування).\n\n'
    : 'Згідно з п.6 ч.3 ст.175 ЦПК України повідомляю, що заходи досудового врегулювання спору не проводилися.\n\n';

  // п.7 — забезпечення доказів
  doc += (a.evidence_preservation === 'conducted')
    ? 'Відповідно до п.7 ч.3 ст.175 ЦПК України повідомляю, що заходи забезпечення доказів або позову здійснювалися.\n\n'
    : 'Відповідно до п.7 ч.3 ст.175 ЦПК України повідомляю, що вжиття заходів забезпечення доказів або позову до подання позовної заяви не здійснювалось.\n\n';

  // п.8 — оригінали документів
  doc += (a.originals_location === 'partial' || a.originals_location === 'defendant')
    ? 'Відповідно до п.8 ч.3 ст.175 ЦПК України повідомляю, що частина оригіналів документів перебуває у відповідача. Прошу суд витребувати їх у встановленому порядку.\n\n'
    : 'Відповідно до п.8 ч.3 ст.175 ЦПК України повідомляю, що у позивача перебувають оригінали письмових або електронних доказів, копії яких додано до заяви.\n\n';

  // п.9 — судовий збір
  doc += (a.court_fee_exempt === 'yes')
    ? 'Згідно з п.9 ч.3 ст.175 ЦПК України повідомляю, що витрати на оплату судового збору відсутні у зв\'язку зі звільненням від його сплати.\n\n'
    : 'Згідно з п.9 ч.3 ст.175 ЦПК України повідомляю, що понесені мною витрати становлять __________ грн. (оплата судового збору), що підтверджується квитанцією.\n\n';

  // п.10 — інший позов
  doc += 'Відповідно до п.10 ч.3 ст.175 ЦПК України підтверджую, що мною не подано іншого позову (позовів) до цього ж відповідача (відповідачів) з тим самим предметом та з тих самих підстав.\n\n';

  // ─── СУДОВИЙ ЗБІР ────────────────────────────────────────────────────────────

  const EXEMPT_REASONS = {
    'disability_1_2':  { article: 'п.1 ч.1 ст.5', status: 'особи з інвалідністю I або II групи' },
    'child_disability':{ article: 'п.2 ч.1 ст.5', status: 'законного представника дитини з інвалідністю' },
    'chornobyl':       { article: 'п.11 ч.1 ст.5', status: 'постраждалого від Чорнобильської катастрофи 1–2 категорії' },
  };

  if (a.court_fee_exempt === 'yes') {
    const info = EXEMPT_REASONS[a.court_fee_exempt_reason] || { article: '________', status: '________' };
    const exemptWord = isFemale ? 'звільнена' : 'звільнений';
    doc += `Від сплати судового збору ${exemptWord} на підставі ${info.article} Закону України «Про судовий збір» у зв'язку з наявністю статусу ${info.status}. Посвідчення №________ від ________ додається.\n\n`;
  } else {
    doc += 'Судовий збір сплачений мною в повному обсязі на підставі пп.3 п.1 ч.2 ст.4 Закону України «Про судовий збір».\n\n';
  }

  // ─── ПРОШУ ───────────────────────────────────────────────────────────────────

  doc += 'На підставі вищевикладеного та керуючись ст.ст.105, 110, 112 Сімейного Кодексу України, ст.ст.175, 187, 274 ЦПК України,—\n\n';
  doc += 'П Р О Ш У :\n\n';

  let n = 1;

  // 1. Тип провадження
  doc += (a.simplified_proceedings === 'no')
    ? `${n++}. Відкрити провадження та призначити справу до розгляду в порядку загального позовного провадження.\n\n`
    : `${n++}. Відкрити провадження та призначити справу до розгляду в спрощеному позовному провадженні.\n\n`;

  // 2. Розірвати шлюб
  const birthText       = has('birth_date')       ? `${formatDate(a.birth_date)} року народження`       : 'року народження ________';
  const spouseBirthText = has('spouse_birth_date') ? `${formatDate(a.spouse_birth_date)} року народження` : '________ року народження';
  const marriageDateText = has('marriage_date')    ? `${formatDate(a.marriage_date)} року`               : '________ року';
  const actNumShort = has('marriage_act_number') ? a.marriage_act_number : '________';

  doc += `${n++}. Розірвати шлюб, укладений між мною, ${plaintiffInstrumental}, ${birthText}, та ${spouseInstrumental}, ${spouseBirthText}, зареєстрований ${marriageDateText} у ${marriagePlaceLocative}, актовий запис № ${actNumShort}.\n\n`;

  // 3. Прізвище
  if (a.surname_after_divorce === 'maiden' && has('maiden_name')) {
    doc += `${n++}. Після розірвання шлюбу повернути дошлюбне прізвище – ${a.maiden_name}.\n\n`;
  } else {
    doc += `${n++}. Після розірвання шлюбу залишити прізвище – ${val('last_name')}.\n\n`;
  }

  // 4. Судові витрати
  doc += (a.court_costs_on === 'plaintiff')
    ? `${n++}. Судові витрати по сплаті судового збору залишити за позивачем.\n\n`
    : `${n++}. Судові витрати по сплаті судового збору покласти на відповідача.\n\n`;

  // 5. Місце проживання дітей (якщо є і спір не окремо)
  if (isTrue(a.has_children) && a.children_dispute !== 'separate') {
    const childrenNamesGen = childrenGenitive || '________';
    let livingWith = '________';
    if (a.children_live_with === 'plaintiff')      livingWith = 'позивачем';
    else if (a.children_live_with === 'defendant') livingWith = 'відповідачем';
    doc += `${n++}. Визначити місце проживання ${childrenNamesGen} з ${livingWith}.\n\n`;
  }

  // Аліменти
  if (isTrue(a.alimony_claim)) {
    const nChildren = countChildren(a.children_details);
    const childrenNamesGen = childrenGenitive || '________';
    const cWord = childWord(nChildren);
    let alimonyLine = `${n++}. Стягнути з відповідача, ${spouseGenitive}, аліменти на утримання ${childrenNamesGen} `;
    if (a.alimony_amount === 'percent') {
      alimonyLine += `у розмірі ${alimonyFraction(nChildren)} частини від заробітку та/або іншого доходу щомісячно до досягнення ${cWord} повноліття.\n\n`;
    } else if (a.alimony_amount === 'fixed') {
      alimonyLine += `у твердій грошовій сумі в розмірі __________ грн. щомісячно до досягнення ${cWord} повноліття.\n\n`;
    } else if (a.alimony_amount === 'mixed') {
      alimonyLine += `у розмірі ${alimonyFraction(nChildren)} частини від заробітку та/або іншого доходу, але не менше __________ грн. щомісячно до досягнення ${cWord} повноліття.\n\n`;
    } else {
      alimonyLine += `у розмірі __________ щомісячно до досягнення ${cWord} повноліття.\n\n`;
    }
    doc += alimonyLine;
  }

  // Майно (якщо спір не окремо)
  if (isTrue(a.has_joint_property) && a.property_dispute !== 'separate') {
    const propDetails = has('property_details') ? a.property_details : '________';
    const pe = propDetails.endsWith('.') ? '' : '.';
    doc += `${n++}. Визнати за позивачем право на 1/2 частку спільного майна подружжя, а саме: ${propDetails}${pe}\n\n`;
  }

  // Борги
  if (isTrue(a.debt_claim)) {
    const debtDetails = has('debt_details') ? a.debt_details : '________';
    const de = debtDetails.endsWith('.') ? '' : '.';
    doc += `${n++}. Розподілити між сторонами спільні боргові зобов'язання: ${debtDetails}${de}\n\n`;
  }

  // ─── ДОДАТКИ ─────────────────────────────────────────────────────────────────

  doc += 'Додатки:\n';
  if (a.court_fee_exempt === 'yes') {
    doc += '- копія посвідчення про право на звільнення від судового збору — 2 примірники;\n';
  } else {
    doc += '- квитанція про сплату судового збору (оригінал для суду, копія — відповідачу);\n';
  }
  doc += '- свідоцтво про шлюб (оригінал для суду, копія — відповідачу);\n';
  doc += '- копія паспорта та РНОКПП позивача — 2 примірники;\n';
  if (isTrue(a.has_children)) {
    doc += '- копія/копії свідоцтва/свідоцтв про народження дитини/дітей — по 2 примірники;\n';
  }
  if (isTrue(a.has_joint_property)) {
    doc += '- документи, що підтверджують право власності на спільне майно — по 2 примірники;\n';
  }
  if (isTrue(a.debt_claim)) {
    doc += '- копії документів щодо боргових зобов\'язань (кредитні договори тощо) — по 2 примірники;\n';
  }
  doc += '- 1 екземпляр позовної заяви з копіями доданих документів для відповідача по справі.\n';

  // ─── ПІДПИС ──────────────────────────────────────────────────────────────────

  doc += `\n\n«___» _______ 20__ року                                              (підпис)    ${plaintiffName}\n`;

  return doc;
}


// ─── ШВИДКИЙ ТЕСТ (запусти node divorce-document.js щоб перевірити) ────────────

if (typeof module !== 'undefined' && require.main === module) {
  // Сценарій 2: Розлучення з дітьми + аліменти
  const testAnswers = {
    last_name: 'Коваленко', first_name: 'Марія', middle_name: 'Олександрівна',
    birth_date: '1985-11-08',
    registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
    same_actual_address: false,
    actual_address: 'м. Одеса, вул. Рішельєвська, 3, кв. 8',
    tax_number: '2756789012', has_no_ipn: false,
    plaintiff_phone: '+380931234567', plaintiff_email: 'kovalenko.maria@ukr.net',
    plaintiff_official_email: 'absent',
    surname_after_divorce: 'keep',

    spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович',
    spouse_birth_date: '1983-02-14',
    spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
    spouse_actual_address_known: 'same',
    spouse_tax_number: '2667890123', spouse_has_no_ipn: false,
    spouse_phone: '+380951234567', spouse_email: 'kovalenko.viktor@ukr.net',
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
    pretrial_settlement: 'not_conducted',
    evidence_preservation: 'not_conducted',
    originals_location: 'plaintiff',
    no_other_lawsuits: true,
  };

  const testAi = {
    plaintiff_instrumental: 'Коваленко Марією Олександрівною',
    plaintiff_genitive:     'Коваленко Марії Олександрівни',
    spouse_instrumental:    'Коваленком Віктором Петровичем',
    spouse_genitive:        'Коваленка Віктора Петровича',
  };

  const result = buildDivorceDocument(testAnswers, testAi);
  console.log(result);
  console.log('\n--- СИМВОЛІВ:', result.length, '---');
}
