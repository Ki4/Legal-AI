/**
 * Structural assertions for "Стягнення аліментів"
 * Used by test-document.mjs to verify document correctness.
 */
export default function assertions(answers, doc) {
  const a = answers;
  return [
    ['ПОЗОВНА ЗАЯВА присутня',             doc.includes('ПОЗОВНА ЗАЯВА')],
    ['Підзаголовок стягнення аліментів',   doc.includes('про стягнення аліментів')],
    ['Секція П Р О Ш У',                   doc.includes('П Р О Ш У  С У Д')],
    ['Секція Додатки',                     doc.includes('Додатки:')],
    ['Прізвище позивача',                  doc.includes(a.last_name)],
    ['Прізвище відповідача',               doc.includes(a.defendant_last_name)],
    ['ст. 180 СК України',                 doc.includes('ст. 180')],
    ['ст. 182 СК України',                 doc.includes('ст. 182')],
    ['п.6 ч.3 ст.175 ЦПК',                doc.includes('п.6 ч.3 ст.175 ЦПК України')],
    ['п.10 ч.3 ст.175 ЦПК',               doc.includes('п.10 ч.3 ст.175 ЦПК України')],
    ['Звільнення від судового збору',      doc.includes('звільнен') && doc.includes('судового збору')],
    ['Шлюб (якщо у шлюбі або розірвано)', a.marital_status === 'never_married' || doc.includes('шлюб')],
    ['Розлучення (якщо divorced)',         a.marital_status !== 'divorced' || doc.includes('розірвано')],
    ['Аліменти % (якщо percent)',          a.alimony_type !== 'percent' || doc.includes('заробітку')],
    ['Аліменти фікс (якщо fixed)',         a.alimony_type !== 'fixed' || doc.includes('твердій грошовій')],
    ['Довідка про склад сім\'ї',           doc.includes('склад сім\'ї')],
    ['Свідоцтво про народження',           doc.includes('свідоцтв')],
  ];
}
