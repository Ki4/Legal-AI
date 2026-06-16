/**
 * prepare-reasoning.js
 * L2→L3 bridge — assembles the Groq reasoning request body from L0 answers + L2 law chunks.
 *
 * Pure function (unit-tested in __tests__/prepare-reasoning.test.js):
 *   prepareReasoning(answers, l2Rows, promptTemplate)
 *   → { _groq_body, _l2_article_ids, _l2_norms_text, _answers_snapshot }
 *
 * n8n Code Node entry point (inlined by scripts/sync-hybrid-nodes.mjs):
 *   const answers = $('Validate').item.json._answers || {};
 *   const l2Rows = $('L2 Get Norms').all().map(item => item.json);
 *   const result = prepareReasoning(answers, l2Rows, REASONING_PROMPT_TEMPLATE);
 *   return [{ json: result }];
 *
 * REASONING_PROMPT_TEMPLATE is injected as a const by the sync script before this code.
 * Never paste this file directly into n8n — run scripts/sync-hybrid-nodes.mjs.
 */

// ─── Law code → citation abbreviation ────────────────────────────────────────
const LAW_ABBREV = {
  '2947-14': 'СК',   // Сімейний кодекс України
  '1618-15': 'ЦПК',  // Цивільний процесуальний кодекс
  '3674-12': 'ЗСЗ',  // Закон про судовий збір
  // short-name aliases (if seeded with abbreviated codes)
  'СК':  'СК',
  'ЦПК': 'ЦПК',
  'ЗСЗ': 'ЗСЗ',
}

// ─── Changed-facts enum labels (for prompt context) ──────────────────────────
const CHANGED_FACTS_LABELS = {
  payer_income_up:        'дохід платника суттєво зріс',
  payer_income_down:      'дохід платника суттєво знизився',
  payer_new_dependents:   "у платника з'явилися інші утриманці",
  payer_health_down:      'стан здоров\'я платника погіршився',
  child_needs_up_general: 'звичайні потреби дитини зросли з віком',
  child_health_down:      'стан здоров\'я дитини погіршився',
  recipient_income_down:  'дохід одержувача суттєво знизився',
  cost_of_living_up:      'реальні витрати на утримання дитини зросли',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a citation string like "ст.192 СК" from a law_chunk row.
 * article_num may be "Стаття 192", "ст. 192", or "192".
 * Returns null if article number cannot be extracted.
 */
function buildArticleId(row) {
  const abbrev = LAW_ABBREV[row.law_code] || null
  const numMatch = String(row.article_num || '').match(/\d+/)
  if (!numMatch) return null
  const num = numMatch[0]
  return abbrev ? `ст.${num} ${abbrev}` : `ст.${num}`
}

/** Format one law_chunk row into a readable norm entry for the prompt. */
function formatNormEntry(row, articleId) {
  const title   = row.article_title ? ` — ${row.article_title}` : ''
  const content = (row.content || '').trim()
  return `${articleId}${title}:\n${content}`
}

/** Replace all {{PLACEHOLDER}} tokens in the prompt template string. */
function fillPromptTemplate(template, ctx) {
  return template
    .replace('{{DIRECTION}}',           ctx.DIRECTION)
    .replace('{{CHANGED_FACTS_JSON}}',  ctx.CHANGED_FACTS_JSON)
    .replace('{{L2_NORMS}}',            ctx.L2_NORMS)
    .replace('{{L2_ARTICLE_IDS}}',      ctx.L2_ARTICLE_IDS)
    .replace('{{PRIOR_VALUE}}',         ctx.PRIOR_VALUE)
    .replace('{{PRIOR_TYPE}}',          ctx.PRIOR_TYPE)
    .replace('{{REQUESTED_VALUE}}',     ctx.REQUESTED_VALUE)
    .replace('{{REQUESTED_TYPE}}',      ctx.REQUESTED_TYPE)
    .replace('{{CHILDREN_INFO}}',       ctx.CHILDREN_INFO)
    .replace('{{PRIOR_DECISION_DATE}}', ctx.PRIOR_DECISION_DATE)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ALIMONY_TYPE_UA = {
  percent: 'частка від заробітку',
  fixed:   'тверда сума',
}

/**
 * @param {object}   answers        - L0 form answers (_answers from Validate node)
 * @param {object[]} l2Rows         - law_chunk rows from Supabase (L2 Get Norms)
 * @param {string}   promptTemplate - content of n8n/prompts/alimony-change-reasoning.txt
 * @param {string}  [modelName]     - Groq model id; defaults to llama-3.3-70b-versatile. Read from Global Config in n8n.
 * @returns {{ _groq_body: object, _l2_article_ids: string[], _l2_norms_text: string, _answers_snapshot: object }}
 */
function prepareReasoning(answers, l2Rows, promptTemplate, modelName = 'llama-3.3-70b-versatile') {
  // 1. Direction label
  const direction = answers.change_direction === 'increase' ? 'Збільшення' : 'Зменшення'

  // 2. Changed facts — normalise to array, strip extraordinary (L0.5 gate; should not reach L3)
  let rawFacts = []
  if (Array.isArray(answers.changed_facts)) {
    rawFacts = answers.changed_facts
  } else if (answers.changed_facts && typeof answers.changed_facts === 'object') {
    rawFacts = Object.keys(answers.changed_facts).filter(k => answers.changed_facts[k])
  }
  const labelledFacts = rawFacts
    .filter(f => f !== 'child_needs_up_extraordinary')
    .map(f => ({ fact: f, label: CHANGED_FACTS_LABELS[f] || f }))

  // 3. Build L2 citation set from rows, deduplicated by articleId
  const seen        = new Set()
  const normEntries = []
  const articleIds  = []

  for (const row of (l2Rows || [])) {
    const id = buildArticleId(row)
    if (!id || seen.has(id)) continue
    seen.add(id)
    articleIds.push(id)
    normEntries.push(formatNormEntry(row, id))
  }

  // 4. Fallback when L2 retrieval returned nothing — use core article stubs
  if (articleIds.length === 0) {
    articleIds.push('ст.192 СК', 'ст.182 СК')
    normEntries.push('ст.192 СК: норму не вдалося завантажити. Використовуйте загальні положення.')
    normEntries.push('ст.182 СК: норму не вдалося завантажити. Використовуйте загальні положення.')
  }

  const l2NormsText       = normEntries.join('\n\n')
  const l2ArticleIdsText  = articleIds.join(', ')

  // 5. Alimony type labels
  const priorType     = ALIMONY_TYPE_UA[answers.prior_alimony_type]     || String(answers.prior_alimony_type     || '')
  const requestedType = ALIMONY_TYPE_UA[answers.requested_alimony_type] || String(answers.requested_alimony_type || '')

  // 6. Fill prompt
  const filledPrompt = fillPromptTemplate(promptTemplate, {
    DIRECTION:            direction,
    CHANGED_FACTS_JSON:   JSON.stringify(labelledFacts, null, 2),
    L2_NORMS:             l2NormsText,
    L2_ARTICLE_IDS:       l2ArticleIdsText,
    PRIOR_VALUE:          String(answers.prior_alimony_value     || ''),
    PRIOR_TYPE:           priorType,
    REQUESTED_VALUE:      String(answers.requested_alimony_value || ''),
    REQUESTED_TYPE:       requestedType,
    CHILDREN_INFO:        String(answers.children_details        || ''),
    PRIOR_DECISION_DATE:  String(answers.prior_decision_date     || ''),
  })

  // 7. Groq request body (model from Global Config → caller; JSON mode, temp 0.3)
  const groqBody = {
    model:           modelName,
    temperature:     0.3,
    response_format: { type: 'json_object' },
    messages:        [{ role: 'user', content: filledPrompt }],
  }

  return {
    _groq_body:        groqBody,
    _l2_article_ids:   articleIds,
    _l2_norms_text:    l2NormsText,
    _answers_snapshot: answers,
  }
}

// ── Exports (for Node.js testing; skipped in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { prepareReasoning, buildArticleId, fillPromptTemplate }
}
