// Pure formatters for the async document-generation failure path (form-submit).
//
// Background: in form-submit, everything after "Respond OK" (200 to the TWA)
// runs asynchronously: Copy Template → … → Share Document. If any of those
// fail, only the admin used to be alerted (the catch-all Error Trigger runs in
// a separate execution with no access to the user's chat id), and the client
// was left forever on "Документ готується... ⏳" (real incident: case 56e84825,
// Google OAuth expiry on Copy Template).
//
// These two pure functions build the messages for a fan-in error branch that
// runs IN the main execution (so the user id / case id are available). They are
// mirrored verbatim into the "Format Gen Failure" Code node by
// scripts/sync-user-error-feedback.mjs — edit here, not in n8n.

/**
 * Admin alert text for an async generation failure.
 * @param {{error?: object, executionId?: string|number, caseId?: string|number, serviceTitle?: string}} ctx
 */
function formatGenFailure(ctx) {
  const c = ctx || {};
  const err = c.error || {};
  const lines = [
    '🚨 Збій генерації документа (ПІСЛЯ відповіді клієнту)',
    'Послуга: ' + (c.serviceTitle || '—'),
    'Кейс №: ' + (c.caseId != null && c.caseId !== '' ? c.caseId : '—'),
    'Помилка: ' + (err.message || err.description || 'unknown error'),
    'Exec: ' + (c.executionId != null && c.executionId !== '' ? c.executionId : '—'),
    'Клієнта сповіщено автоматично.',
    'Time: ' + new Date().toISOString(),
  ];
  return lines.join('\n');
}

/**
 * Friendly Telegram message shown to the client when generation fails.
 * Markdown parse_mode.
 * @param {string|number} [caseId]
 */
function userFailureMessage(caseId) {
  const lines = [
    '⚠️ Вибачте, під час підготовки документа сталася технічна помилка.',
    '',
    'Ми вже отримали сповіщення про це й розберемося. Будь ласка, спробуйте ще раз трохи пізніше — або ми звʼяжемося з вами.',
  ];
  if (caseId != null && caseId !== '') {
    lines.push('', '🔢 Ваш кейс №: ' + caseId);
  }
  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatGenFailure, userFailureMessage };
}
