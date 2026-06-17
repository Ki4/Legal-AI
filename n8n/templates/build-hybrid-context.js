/**
 * build-hybrid-context.js
 * L4 Critics — groundedness check, abstention decision, review-card assembly.
 *
 * Assumes checkGroundedness() is available in scope (inlined from groundedness.js
 * by scripts/sync-hybrid-nodes.mjs before this file).
 *
 * Pure-ish function (checkGroundedness injected as param for testability):
 *   buildHybridContext(l3Response, l2ArticleIds, answers, checkGroundednessImpl)
 *   → { _ai_reasoning, _review_card, _spans, _has_red, _abstained }
 *
 * n8n Code Node entry point (inlined by scripts/sync-hybrid-nodes.mjs):
 *   const l3Response = $json;
 *   const prepCtx = $('Prepare Reasoning').first().json;
 *   const l2ArticleIds = prepCtx._l2_article_ids || [];
 *   const answers = prepCtx._answers_snapshot || {};
 *   const result = buildHybridContext(l3Response, l2ArticleIds, answers, checkGroundedness);
 *   return [{ json: result }];
 */

const PM_ABLE_BODIED_2026 = 3328  // грн (01.01.2026; update annually)

// ─── Parse L3 Groq response ───────────────────────────────────────────────────

/**
 * Extract { reasoning_text, citations_used } from the raw Groq HTTP response.
 * Returns null on any parse failure (triggers abstention in caller).
 */
function parseL3Response(l3Response) {
  try {
    const raw = l3Response?.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.reasoning_text !== 'string') return null
    return {
      reasoning_text: parsed.reasoning_text,
      citations_used: Array.isArray(parsed.citations_used) ? parsed.citations_used : [],
    }
  } catch (_) {
    return null
  }
}

// ─── Parse L4b LLM Critic response ───────────────────────────────────────────

/**
 * Extract { overall, sentences, summary } from the raw Groq HTTP response for L4b.
 * Returns null on any parse failure or if l4bResponse is not provided —
 * callers treat null as "L4b not available", which does NOT trigger abstention.
 */
function parseL4bResponse(l4bResponse) {
  if (!l4bResponse) return null
  try {
    const raw = l4bResponse?.choices?.[0]?.message?.content || ''
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.sentences)) return null
    return {
      overall:   String(parsed.overall || 'GREEN').toUpperCase(),
      sentences: parsed.sentences,
      summary:   parsed.summary || '',
    }
  } catch (_) {
    return null
  }
}

// ─── Court fee (§3.4) ─────────────────────────────────────────────────────────

/**
 * Court fee calculation per §3.4 requirements.
 * Returns a summary object for the review-card court_fee field.
 */
function buildCourtFeeSummary(answers) {
  const direction = answers.change_direction

  if (direction === 'increase') {
    return {
      basis:          'exempt',
      amount:         null,
      price_of_claim: null,
      norm:           'п.3 ч.1 ст.5 ЗУ «Про судовий збір»',
      text:           'Від сплати судового збору звільнений на підставі п.3 ч.1 ст.5 ЗУ «Про судовий збір».',
    }
  }

  // decrease — 1% of price_of_claim, min 0.4 × PM_ABLE_BODIED_2026
  const priorType     = answers.prior_alimony_type
  const requestedType = answers.requested_alimony_type

  if (priorType === 'fixed' && requestedType === 'fixed') {
    const prior     = parseFloat(String(answers.prior_alimony_value     || '0').replace(',', '.'))
    const requested = parseFloat(String(answers.requested_alimony_value || '0').replace(',', '.'))

    if (!isNaN(prior) && !isNaN(requested)) {
      const monthly_delta    = Math.abs(requested - prior)
      const price_of_claim   = Math.round(monthly_delta * 12 * 100) / 100
      const fee_floor        = Math.round(0.4 * PM_ABLE_BODIED_2026 * 100) / 100
      const fee_calculated   = Math.round(price_of_claim * 0.01 * 100) / 100
      const fee              = Math.max(fee_calculated, fee_floor)

      return {
        basis:          'calculated',
        amount:         fee,
        price_of_claim: price_of_claim,
        norm:           'ст.4 ЗСЗ, ст.176 ЦПК',
        text:           `Ціна позову: ${price_of_claim} грн. Судовий збір: ${fee} грн (1% ціни позову, ст.4 ЗУ «Про судовий збір»), сплачено, квитанція додається.`,
      }
    }
  }

  // percent or mixed — can't auto-calculate without income data
  return {
    basis:          'manual',
    amount:         null,
    price_of_claim: null,
    norm:           'ст.4 ЗСЗ, ст.176 ЦПК',
    text:           'Ціна позову потребує розрахунку юристом (розмір у частках від доходу). Судовий збір: 1% ціни позову, не менше ' + (0.4 * PM_ABLE_BODIED_2026) + ' грн.',
    notes:          'prior_alimony_type=' + priorType + ', requested_alimony_type=' + requestedType + ' — розрахунок ціни позову потребує даних про дохід',
  }
}

// ─── Questions for lawyer ─────────────────────────────────────────────────────

/**
 * Build the questions_for_lawyer array based on form answers and groundedness results.
 * l4b — parsed L4b response (or null if L4b was not run / failed to parse).
 */
function buildQuestionsForLawyer(answers, groundednessResult, abstained, l4b) {
  const questions = []

  // ст.192 + prior_basis=agreement with own procedure clause
  if (answers.prior_basis === 'agreement' &&
      (answers.agreement_own_procedure === 'yes' || answers.agreement_own_procedure === 'unknown')) {
    questions.push({
      id:       'agreement_procedure',
      severity: 'warning',
      text:     'Аліменти встановлені договором. Договір може містити власний порядок зміни розміру. ' +
                'Перевірте текст договору (поле agreement_own_procedure=' + answers.agreement_own_procedure + ') ' +
                'перед підготовкою позову — може знадобитися виконання договірних процедур спочатку (ст.189 СК).',
    })
  }

  // ст.197 — existing debt при decrease
  if (answers.change_direction === 'decrease' && answers.existing_debt === 'yes') {
    questions.push({
      id:       'existing_debt',
      severity: 'warning',
      text:     'Клієнт вказав наявність заборгованості зі сплати аліментів (existing_debt=yes). ' +
                'Зменшення розміру аліментів НЕ покриває і НЕ списує минулу заборгованість (ст.197 СК). ' +
                'Попередьте клієнта про необхідність окремого врегулювання боргу.',
    })
  }

  // L3 abstained — reasoning fallback used
  if (abstained) {
    questions.push({
      id:       'reasoning_abstained',
      severity: 'info',
      text:     'AI-обґрунтування відхилено критиком (RED span або помилка парсингу). ' +
                'В документі використано загальний параграф (fallback ст.182 СК). ' +
                'Перевірте та, за потреби, допишіть обґрунтування вручну.',
    })
  }

  // L4a AMBER spans — soft warnings from deterministic critic
  if (groundednessResult?.has_amber) {
    questions.push({
      id:       'amber_spans',
      severity: 'info',
      text:     'В AI-тексті виявлено AMBER-позначки (потенційні неточності): ' +
                (groundednessResult.spans || [])
                  .filter(s => s.status === 'AMBER')
                  .map(s => `"${s.text}" — ${s.reason}`)
                  .join('; ') +
                '. Перевірте відповідні місця в документі.',
    })
  }

  // L4b AMBER sentences — soft warnings from LLM critic (only when not already abstained)
  const l4bAmberSentences = (l4b?.sentences || []).filter(s => s.status === 'AMBER')
  if (!abstained && l4bAmberSentences.length > 0) {
    questions.push({
      id:       'l4b_amber',
      severity: 'info',
      text:     'LLM-критик (незалежний аналіз) позначив деякі речення як AMBER: ' +
                l4bAmberSentences
                  .map(s => `"${String(s.text || '').slice(0, 60)}…" — ${s.reason || ''}`)
                  .join('; ') +
                '. Перевірте відповідні місця в документі.',
    })
  }

  return questions
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * @param {object}   l3Response             - raw Groq HTTP response (choices[0].message.content = JSON string)
 * @param {string[]} l2ArticleIds            - allowed citation IDs from Prepare Reasoning node
 * @param {object}   answers                 - L0 form answers snapshot
 * @param {Function} checkGroundednessImpl   - injected from groundedness.js (or a test mock)
 * @param {object}  [l4bResponse]            - optional: raw Groq HTTP response from L4b LLM Critic node
 * @returns {{ _ai_reasoning: string, _review_card: object, _spans: object[], _has_red: boolean, _abstained: boolean }}
 */
function buildHybridContext(l3Response, l2ArticleIds, answers, checkGroundednessImpl, l4bResponse) {
  // 1. Parse L3 response
  const l3 = parseL3Response(l3Response)
  const parseError = l3 === null

  // 2. L4a — deterministic groundedness critic
  let groundedness = { spans: [], has_red: false, has_amber: false }
  if (!parseError) {
    try {
      groundedness = checkGroundednessImpl(l3.reasoning_text, answers, l2ArticleIds)
    } catch (e) {
      console.log('[L4a] Groundedness check threw:', e.message)
      groundedness = { spans: [], has_red: true, has_amber: false }
    }
  }

  // 3. L4b — optional LLM critic (null when not provided or parse fails)
  const l4b = parseL4bResponse(l4bResponse)
  const l4bHasRed = l4b !== null && l4b.overall === 'RED'

  // 4. L4c abstention: parse error OR L4a RED OR L4b RED → discard AI reasoning
  const abstained = parseError || groundedness.has_red || l4bHasRed

  // 5. ai.reasoning — used by Build Document to fill {{#if ai.reasoning}}
  const aiReasoning = abstained ? '' : (l3?.reasoning_text || '')

  // 6. Court fee summary
  const courtFee = buildCourtFeeSummary(answers)

  // 7. Jurisdiction basis (asymmetric per §3.1)
  const jurisdictionBasis = answers.change_direction === 'increase'
    ? 'ст.28 ч.1 ЦПК — за вибором позивача (місце проживання позивача або відповідача)'
    : 'ст.27 ЦПК — за зареєстрованим місцем проживання відповідача (загальні правила)'

  // 8. Questions for lawyer
  const questionsForLawyer = buildQuestionsForLawyer(answers, groundedness, abstained, l4b)

  // 9. Review-card (L5 handoff)
  const reviewCard = {
    service:            'alimony-change',
    direction:          answers.change_direction || 'unknown',
    route:              'PROCEED',
    court_fee:          courtFee,
    jurisdiction_basis: jurisdictionBasis,
    prior_order: {
      basis:       answers.prior_basis,
      court:       answers.prior_court       || null,
      case_number: answers.prior_case_number || null,
      date:        answers.prior_decision_date,
      amount:      answers.prior_alimony_value,
      type:        answers.prior_alimony_type,
    },
    facts_changed:    (Array.isArray(answers.changed_facts)
      ? answers.changed_facts
      : Object.keys(answers.changed_facts || {}).filter(k => answers.changed_facts[k])
    ).filter(f => f !== 'child_needs_up_extraordinary'),
    norms_used:       l3?.citations_used || [],
    reasoning_section: {
      text:      aiReasoning,
      abstained: abstained,
      spans:     groundedness.spans,
      has_red:   groundedness.has_red || l4bHasRed,
      has_amber: groundedness.has_amber || (l4b?.overall === 'AMBER'),
      ...(parseError ? { parse_error: true } : {}),
      ...(l4b ? { l4b: { overall: l4b.overall, summary: l4b.summary } } : {}),
    },
    questions_for_lawyer: questionsForLawyer,
  }

  return {
    _ai_reasoning: aiReasoning,
    _review_card:  reviewCard,
    _spans:        groundedness.spans,
    _has_red:      groundedness.has_red || l4bHasRed,
    _abstained:    abstained,
  }
}

// ── Exports (for Node.js testing; skipped in n8n Code Node) ───────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildHybridContext,
    parseL3Response,
    parseL4bResponse,
    buildCourtFeeSummary,
    buildQuestionsForLawyer,
  }
}
