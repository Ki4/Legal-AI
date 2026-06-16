/**
 * route-alimony-change.js
 * L0.5 routing layer — pure function over `changed_facts` × `prior_alimony_type`,
 * runs BEFORE the alimony-change template (requirements §3.0, test-matrix §2).
 *
 * Both ABSTAIN_* branches are a proposed design pending Olga's sign-off
 * (research 2026-06-15, test-matrix.md §6). Until confirmed, `route()` always
 * returns PROCEED — pass `{ enabled: true }` to turn on the full table (used
 * by tests and, later, by form-submit once Olga confirms).
 *
 * n8n entry point (paste into Code Node, after the form_config is loaded):
 *   const r = route($json.changed_facts, $json.prior_alimony_type, { enabled: false });
 *   return [{ json: { ...$json, _route: r } }];
 */

const ROUTE = {
  PROCEED: 'PROCEED',
  ABSTAIN_EXTRAORDINARY: 'ABSTAIN_EXTRAORDINARY',
  ABSTAIN_INDEXATION: 'ABSTAIN_INDEXATION',
};

// Abstention message bundles (requirements §2.4, test-matrix §4.1-4.3) —
// `redirect_message` goes to the TWA user, `abstention_reason` to the
// review-card. No document is generated for either route.
const ABSTAIN_MESSAGES = {
  [ROUTE.ABSTAIN_EXTRAORDINARY]: {
    redirect_message:
      'Ваш запит стосується конкретної додаткової витрати на дитину з визначеною вартістю '
      + '(лікування, навчання тощо). Це інший вид позову — "стягнення додаткових витрат на дитину" '
      + '(ст.181, 185 СК України), а не "зміна розміру аліментів" (ст.192). Цей сервіс поки не '
      + 'підтримує такий позов — рекомендуємо звернутись до юриста.',
    abstention_reason: 'child_needs_up_extraordinary → ст.181/185 СК, інший позов',
  },
  [ROUTE.ABSTAIN_INDEXATION]: {
    redirect_message:
      'Аліменти присуджені у твердій сумі, і єдина названа причина — зростання вартості життя. '
      + 'Такий розмір індексується автоматично, без суду (ст.184 СК України). Позов про "зміну '
      + 'розміру" (ст.192) тут не є належним способом захисту — якщо є й інші причини, оберіть їх у формі.',
    abstention_reason: 'fixed + singleton cost_of_living_up → ст.184 СК, позасудова індексація',
  },
};

/**
 * @param {string[]|undefined} changedFacts - `changed_facts` enum values (Таб 4)
 * @param {'percent'|'fixed'|undefined} priorAlimonyType - `prior_alimony_type` (Таб 2)
 * @param {{ enabled?: boolean }} [opts] - `enabled: true` turns on the ABSTAIN_*
 *   branches (test-matrix §2, R1/R2); default/false = always PROCEED (R5).
 * @returns {string} one of ROUTE.*
 */
function route(changedFacts, priorAlimonyType, opts = {}) {
  if (!opts.enabled) return ROUTE.PROCEED;

  const facts = new Set(changedFacts || []);

  // R1: extraordinary need → other claim type (ст.181/185 СК), never PROCEED.
  if (facts.has('child_needs_up_extraordinary')) return ROUTE.ABSTAIN_EXTRAORDINARY;

  // R2: fixed amount + the ONLY changed fact is cost-of-living → out-of-court
  // indexation (ст.184 СК) is the proper remedy, not a ст.192 claim.
  if (priorAlimonyType === 'fixed' && facts.size === 1 && facts.has('cost_of_living_up')) {
    return ROUTE.ABSTAIN_INDEXATION;
  }

  // R3/R5: everything else (incl. percent + singleton cost_of_living_up) proceeds.
  return ROUTE.PROCEED;
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { route, ROUTE, ABSTAIN_MESSAGES };
}
