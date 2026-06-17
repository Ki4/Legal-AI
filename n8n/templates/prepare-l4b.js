/**
 * prepare-l4b.js
 * L3→L4b bridge — assembles the Groq request body for the L4b LLM Critic.
 *
 * Pure function (unit-tested in __tests__/prepare-l4b.test.js):
 *   prepareL4b(reasoningText, direction, changedFacts, l2NormsText, promptTemplate, modelName)
 *   → { _groq_body }
 *
 * n8n Code Node entry point (inlined by scripts/sync-l4b-nodes.mjs):
 *   const result = prepareL4b(reasoningText, direction, changedFacts, l2NormsText, L4B_PROMPT_TEMPLATE, modelName);
 *   return [{ json: result }];
 *
 * L4B_PROMPT_TEMPLATE is injected as a const by the sync script before this code.
 * Never paste this file directly into n8n — run scripts/sync-l4b-nodes.mjs.
 */

/**
 * Fill alimony-change-critic.txt placeholders.
 * Placeholder set is a strict subset of the reasoning prompt (only 4 tokens).
 */
function fillCriticTemplate(template, ctx) {
  return template
    .replace('{{DIRECTION}}',          ctx.DIRECTION)
    .replace('{{CHANGED_FACTS_JSON}}', ctx.CHANGED_FACTS_JSON)
    .replace('{{L2_NORMS}}',           ctx.L2_NORMS)
    .replace('{{REASONING_TEXT}}',     ctx.REASONING_TEXT)
}

/**
 * @param {string}   reasoningText  - L3 generated reasoning paragraph (from parseL3Response)
 * @param {string}   direction      - 'Збільшення' or 'Зменшення'
 * @param {string[]} changedFacts   - raw fact keys from answers.changed_facts
 * @param {string}   l2NormsText    - formatted norm text (_l2_norms_text from Prepare Reasoning)
 * @param {string}   promptTemplate - content of n8n/prompts/alimony-change-critic.txt
 * @param {string}  [modelName]     - Groq model id; defaults to llama-3.3-70b-versatile
 * @returns {{ _groq_body: object }}
 */
function prepareL4b(reasoningText, direction, changedFacts, l2NormsText, promptTemplate, modelName = 'llama-3.3-70b-versatile') {
  const filledPrompt = fillCriticTemplate(promptTemplate, {
    DIRECTION:          direction,
    CHANGED_FACTS_JSON: JSON.stringify(Array.isArray(changedFacts) ? changedFacts : [], null, 2),
    L2_NORMS:           l2NormsText || '',
    REASONING_TEXT:     reasoningText || '',
  })

  const groqBody = {
    model:           modelName,
    temperature:     0,
    response_format: { type: 'json_object' },
    messages:        [{ role: 'user', content: filledPrompt }],
  }

  return { _groq_body: groqBody }
}

// ── Exports (for Node.js testing; skipped in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { prepareL4b, fillCriticTemplate }
}
