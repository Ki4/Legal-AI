/**
 * shared/utils.js
 * Спільні helper-функції для всіх document builder шаблонів.
 *
 * УВАГА: n8n Code Node = vanilla JS, без import/require.
 * Цей файл — reference implementation. При створенні нового шаблону
 * scaffold-service.mjs копіює ці функції inline в {service}-document.js.
 *
 * Для тестів можна підключити через:
 *   const utils = require('./n8n-templates/shared/utils.js');
 */

// ─── Date formatting ────────────────────────────────────────────────────────

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

/** ISO дата → "«20» червня 2015" (для початку речення / офіційних документів) */
function formatDateQuoted(iso) {
  if (!iso) return '«___» _______ _____';
  const d = new Date(iso);
  return `«${d.getUTCDate()}» ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── Field access helpers ───────────────────────────────────────────────────

/** Значення поля або прочерк. answers = об'єкт відповідей, field = ключ */
function val(answers, field, fallback) {
  if (fallback === undefined) fallback = '________';
  const v = answers[field];
  if (v === null || v === undefined || v === '') return fallback;
  return v;
}

/** Чи заповнено поле (не null, не undefined, не '', не false) */
function has(answers, field) {
  const v = answers[field];
  return v !== null && v !== undefined && v !== '' && v !== false;
}

// ─── Type helpers ───────────────────────────────────────────────────────────

/** Стать за по батькові (-івна/-ївна/-овна = female, інакше male) */
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

/** Повне ПІБ з окремих полів */
function fullName(answers, prefix) {
  const parts = [
    answers[prefix + '_last_name'] || answers[prefix + 'last_name'],
    answers[prefix + '_first_name'] || answers[prefix + 'first_name'],
    answers[prefix + '_middle_name'] || answers[prefix + 'middle_name'],
  ].filter(Boolean);
  return parts.join(' ') || '________';
}

/** Адреса: місто, вулиця, будинок, квартира → один рядок */
function formatAddress(answers, prefix) {
  const parts = [];
  const city = answers[prefix + '_city'] || answers[prefix + 'city'];
  const street = answers[prefix + '_street'] || answers[prefix + 'street'];
  const house = answers[prefix + '_house'] || answers[prefix + 'house'];
  const apt = answers[prefix + '_apartment'] || answers[prefix + 'apartment'];
  if (city) parts.push(city);
  if (street) parts.push('вул. ' + street);
  if (house) parts.push('буд. ' + house);
  if (apt) parts.push('кв. ' + apt);
  return parts.join(', ') || '________';
}

// ─── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MONTHS, formatDate, formatDateQuoted,
    val, has,
    detectGender, isTrue,
    fullName, formatAddress,
  };
}
