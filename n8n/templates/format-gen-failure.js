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
 * HTML parse_mode — mirrors the polish of the success card. The case id is shown
 * here prominently and tap-to-copy (<code>), because on the failure path the user
 * actually needs it to reference the problem in support (on success it's omitted).
 * @param {string|number} [caseId]
 * @param {string} [serviceTitle]
 */
function userFailureMessage(caseId, serviceTitle) {
  const lines = ['⚠️ <b>Не вдалося сформувати документ</b>'];
  if (serviceTitle) lines.push('📋 ' + serviceTitle);
  lines.push(
    '',
    'Сталася технічна помилка — але ваші дані збережено, і ми вже отримали сповіщення й розберемось.',
  );
  if (caseId != null && caseId !== '') {
    lines.push(
      '',
      '🔢 Кейс: <code>' + caseId + '</code>',
      'Вкажіть цей номер, якщо звертаєтесь у підтримку.',
    );
  }
  lines.push('', 'Спробуйте ще раз трохи пізніше.');
  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatGenFailure, userFailureMessage };
}
