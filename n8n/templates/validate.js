/**
 * validate.js
 * n8n Code Node — validates incoming webhook payload.
 *
 * Extracted from the v6-hybrid workflow "Validate" Code Node
 * so it can be unit-tested without n8n runtime.
 *
 * n8n entry point (paste into Code Node):
 *   const body = $('Webhook').first().json.body;
 *   const result = validatePayload(body);
 *   return [{ json: result }];
 */

/**
 * Validate the incoming form submission payload.
 *
 * @param {object} body - webhook request body
 * @param {string} body.user_id - Telegram user id
 * @param {string} body.service_slug - service identifier
 * @param {object} body.answers - form answers object
 * @param {string} [body.consented_at] - ISO timestamp of user consent
 * @param {string} [body.user_first_name] - Telegram first name (for Ensure Profile)
 * @returns {{ _valid: boolean, _error?: string, _user_id?: string, _service_slug?: string, _answers?: object, _consented_at?: string, _submitted_at?: string, _user_first_name?: string }}
 */
function validatePayload(body) {
  if (!body) {
    return { _valid: false, _error: 'missing body' };
  }

  const { service_slug, user_id, answers, consented_at, user_first_name } = body;

  if (!user_id) return { _valid: false, _error: 'missing user_id' };
  if (!service_slug) return { _valid: false, _error: 'missing service_slug' };
  if (!answers || Object.keys(answers).length === 0) return { _valid: false, _error: 'empty answers' };

  return {
    _valid: true,
    _user_id: String(user_id),
    _service_slug: service_slug,
    _answers: answers,
    _consented_at: consented_at || new Date().toISOString(),
    _submitted_at: new Date().toISOString(),
    _user_first_name: user_first_name || null,
  };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validatePayload };
}
