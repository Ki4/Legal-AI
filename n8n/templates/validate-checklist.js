/**
 * validate-checklist.js
 * Deterministic required-clause checklist validator (issue #4 / IMPROVEMENTS #39).
 *
 * No LLM — divorce/alimony render through the deterministic doc-engine
 * (render-document.js), so the only failure mode worth checking is a
 * template/condition bug that silently drops a legally-required clause.
 * Each checklist item is "applicable in this case?" (appliesIf, same
 * expression syntax as {{#if}} in render-document.js) + "does the
 * rendered text satisfy it?" (mustMatchAny — any one pattern is enough,
 * since some obligations are satisfied by either of two formulations,
 * e.g. custody decided vs. explicitly deferred to separate proceedings).
 *
 * n8n entry point (paste into Code Node, after renderDocumentWithStyles):
 *   const result = validateChecklist($json._content, context, svc.required_checklist);
 *   return [{ json: { ...$json, _checklist_result: result } }];
 *
 * Depends on parseExpr/evalExpr from render-document.js being in scope —
 * in the n8n Code Node this file is concatenated right after
 * render-document.js (scripts/sync-build-document-node.mjs), so they're
 * already plain functions in the same script, not require()'d. n8n's Code
 * Node sandbox does not reliably expose a working require(), so this file
 * deliberately has no top-level require/import of its own (see
 * __tests__/validate-checklist.test.js for how tests provide them).
 */

/**
 * @param {string} exprStr - "true" or an expression in render-document.js syntax
 * @param {object} context - same shape as buildContext(answers, ai) output
 */
function evalCondition(exprStr, context) {
  if (exprStr === 'true') return true
  return evalExpr(parseExpr(exprStr, 0), [{ item: context, meta: null }])
}

/**
 * @param {string} renderedText - the final rendered document (_content)
 * @param {object} context - same context object used to render it
 * @param {{items: Array<{id, description, appliesIf, mustMatchAny: string[]}>}} checklist
 * @returns {{ok: boolean, missing: Array, satisfied: Array}}
 */
function validateChecklist(renderedText, context, checklist) {
  const missing = []
  const satisfied = []

  for (const item of (checklist && checklist.items) || []) {
    if (!evalCondition(item.appliesIf, context)) continue

    const ok = item.mustMatchAny.some((pattern) => new RegExp(pattern, 'u').test(renderedText))
    const entry = { id: item.id, description: item.description }
    ;(ok ? satisfied : missing).push(entry)
  }

  return { ok: missing.length === 0, missing, satisfied }
}

// ── Exports (for Node.js testing; ignored in n8n Code Node) ───────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateChecklist, evalCondition }
}
