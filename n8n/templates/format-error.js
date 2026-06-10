/**
 * format-error.js
 * n8n Code Node — builds an admin alert message from the Error Trigger payload.
 *
 * Runs inside the Error Trigger sub-flow of form-submit. ANY unhandled failure
 * after validation (DB error, Groq timeout, Google Docs API, template runtime
 * error) reaches the Error Trigger; this turns the raw payload into a readable
 * Telegram alert so the operator finds out instead of the failure being silent.
 *
 * Mirror of the inline code in the "Format Error" node. Pure + unit-testable.
 *
 * n8n entry point (paste into Code Node):
 *   return [{ json: { text: formatError($json) } }];
 */

/**
 * Turn an Error Trigger payload into a single alert string.
 *
 * @param {object} payload - the Error Trigger $json
 * @param {object} [payload.execution] - { id, url, lastNodeExecuted, error }
 * @param {object} [payload.workflow]  - { id, name }
 * @returns {string} multi-line alert text
 */
function formatError(payload) {
  const p = payload || {};
  const exec = p.execution || {};
  const wf = p.workflow || {};
  // error can sit on execution.error (Error Trigger) or top-level (defensive)
  const err = exec.error || p.error || {};

  const lines = [
    '⚠️ Workflow error: ' + (wf.name || 'Legal AI — Form Submit'),
    'Node: ' + (exec.lastNodeExecuted || 'unknown'),
    'Error: ' + (err.message || 'unknown error'),
    'Exec: ' + (exec.id || '—'),
    'Time: ' + new Date().toISOString(),
  ];
  if (exec.url) lines.push(exec.url);
  return lines.join('\n');
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatError };
}
