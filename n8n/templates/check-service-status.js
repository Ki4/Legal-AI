/**
 * check-service-status.js
 * n8n Code Node — service lifecycle kill-switch (write-path guard).
 *
 * Runs right after "Get Service". ONLY status === 'active' is served; a service
 * in needs_review or disabled (or not found) is blocked BEFORE any case is
 * inserted or any document generated. This is the authoritative enforcement
 * point — it protects even a forwarded / cached form link that bypassed the
 * read-path catalog filters.
 *
 * Mirror of the inline code in the "Check Service Status" node of form-submit.
 * Kept here so the gate is unit-testable without the n8n runtime.
 *
 * n8n entry point (paste into Code Node):
 *   const rows = $('Get Service').all();
 *   const svc = rows.length ? rows[0].json : null;
 *   return [{ json: checkServiceStatus(svc) }];
 */

const UNAVAILABLE_MESSAGE =
  'На жаль, ця послуга зараз тимчасово недоступна. Ми оновлюємо її відповідно до змін у законодавстві. Спробуйте, будь ласка, пізніше.';
const NOT_FOUND_MESSAGE =
  'На жаль, цю послугу не знайдено або вона недоступна. Спробуйте, будь ласка, пізніше.';

/**
 * Decide whether a service may be served.
 *
 * @param {object|null} svc - service row from "Get Service" (null if not found)
 * @param {string} [svc.status] - lifecycle status (active|needs_review|disabled)
 * @param {string} [svc.title]  - service title (for messaging)
 * @returns {{ _active: boolean, _status: string, _service_title: (string|null), _block_message: (string|null) }}
 */
function checkServiceStatus(svc) {
  if (!svc) {
    return { _active: false, _status: 'not_found', _service_title: null, _block_message: NOT_FOUND_MESSAGE };
  }

  const title = svc.title || null;

  if (svc.status === 'active') {
    return { _active: true, _status: 'active', _service_title: title, _block_message: null };
  }

  // needs_review and disabled both block serving; so does any unexpected value.
  return {
    _active: false,
    _status: svc.status || 'unknown',
    _service_title: title,
    _block_message: UNAVAILABLE_MESSAGE,
  };
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkServiceStatus, UNAVAILABLE_MESSAGE, NOT_FOUND_MESSAGE };
}
