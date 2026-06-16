import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { buildHybridContext, parseL3Response, buildCourtFeeSummary, buildQuestionsForLawyer } =
  require(resolve(__dirname, '../build-hybrid-context.js'))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_GROQ_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        reasoning_text: 'Рішенням суду від 15.03.2020 стягнуто 1/4 від заробітку. Відповідно до ст.192 СК підстава — зміна обставин.',
        citations_used: ['ст.192 СК', 'ст.182 СК'],
      }),
    },
  }],
}

const BASE_ANSWERS_INCREASE = {
  change_direction:        'increase',
  prior_basis:             'court_decision',
  prior_court:             'Шевченківський районний суд м. Києва',
  prior_case_number:       '761/12345/20',
  prior_decision_date:     '15.03.2020',
  prior_alimony_type:      'percent',
  prior_alimony_value:     '1/4',
  requested_alimony_type:  'percent',
  requested_alimony_value: '1/3',
  children_details:        'Коваленко Дарина Андріївна, 10.06.2016',
  changed_facts:           ['child_needs_up_general'],
}

const BASE_ANSWERS_DECREASE_FIXED = {
  change_direction:        'decrease',
  prior_basis:             'court_decision',
  prior_decision_date:     '01.01.2022',
  prior_alimony_type:      'fixed',
  prior_alimony_value:     '5000',
  requested_alimony_type:  'fixed',
  requested_alimony_value: '3000',
  changed_facts:           ['payer_income_down'],
}

const L2_ARTICLE_IDS = ['ст.192 СК', 'ст.182 СК']

const CLEAN_GROUNDEDNESS = vi.fn(() => ({ spans: [], has_red: false, has_amber: false }))
const RED_GROUNDEDNESS   = vi.fn(() => ({ spans: [{ text: 'ст.141', type: 'citation', status: 'RED', reason: 'поза L2' }], has_red: true, has_amber: false }))
const AMBER_GROUNDEDNESS = vi.fn(() => ({ spans: [{ text: '25%', type: 'percent', status: 'AMBER', reason: 'перевірте' }], has_red: false, has_amber: true }))

// ─── parseL3Response ──────────────────────────────────────────────────────────

describe('parseL3Response', () => {
  it('extracts reasoning_text and citations_used from valid Groq response', () => {
    const result = parseL3Response(VALID_GROQ_RESPONSE)
    expect(result).not.toBeNull()
    expect(result.reasoning_text).toContain('ст.192 СК')
    expect(result.citations_used).toEqual(['ст.192 СК', 'ст.182 СК'])
  })

  it('returns null when response is null', () => {
    expect(parseL3Response(null)).toBeNull()
  })

  it('returns null when choices array is empty', () => {
    expect(parseL3Response({ choices: [] })).toBeNull()
  })

  it('returns null when content is invalid JSON', () => {
    const bad = { choices: [{ message: { content: 'not json' } }] }
    expect(parseL3Response(bad)).toBeNull()
  })

  it('returns null when reasoning_text is missing', () => {
    const bad = { choices: [{ message: { content: '{"citations_used":[]}' } }] }
    expect(parseL3Response(bad)).toBeNull()
  })

  it('strips markdown code fences', () => {
    const withFence = {
      choices: [{ message: { content: '```json\n{"reasoning_text":"ok","citations_used":[]}\n```' } }],
    }
    const result = parseL3Response(withFence)
    expect(result).not.toBeNull()
    expect(result.reasoning_text).toBe('ok')
  })

  it('defaults citations_used to [] when missing', () => {
    const noCitations = {
      choices: [{ message: { content: '{"reasoning_text":"text"}' } }],
    }
    expect(parseL3Response(noCitations).citations_used).toEqual([])
  })
})

// ─── buildCourtFeeSummary ─────────────────────────────────────────────────────

describe('buildCourtFeeSummary', () => {
  it('returns exempt for increase', () => {
    const result = buildCourtFeeSummary(BASE_ANSWERS_INCREASE)
    expect(result.basis).toBe('exempt')
    expect(result.amount).toBeNull()
    expect(result.norm).toContain('ст.5')
  })

  it('calculates fee for decrease fixed→fixed', () => {
    const result = buildCourtFeeSummary(BASE_ANSWERS_DECREASE_FIXED)
    // delta = |3000 - 5000| = 2000; price = 2000*12 = 24000; fee = max(240, 0.4*3328=1331.2) = 1331.2
    expect(result.basis).toBe('calculated')
    expect(result.price_of_claim).toBe(24000)
    expect(result.amount).toBe(1331.2)
    expect(result.norm).toContain('ст.4 ЗСЗ')
  })

  it('uses fee_floor (0.4 PM) when 1% < floor', () => {
    // delta = 100; price = 1200; 1% = 12; floor = 1331.2
    const answers = { ...BASE_ANSWERS_DECREASE_FIXED, prior_alimony_value: '3100', requested_alimony_value: '3000' }
    const result = buildCourtFeeSummary(answers)
    expect(result.amount).toBe(1331.2)
  })

  it('uses 1% when above floor', () => {
    // delta = 2000; price = 24000; 1% = 240 < 1331.2 → floor
    // need delta > 133120 to exceed floor... skip that edge
    // Just check that a large delta uses 1% correctly
    const answers = { ...BASE_ANSWERS_DECREASE_FIXED, prior_alimony_value: '200000', requested_alimony_value: '100000' }
    const result = buildCourtFeeSummary(answers)
    expect(result.price_of_claim).toBe(1200000)
    expect(result.amount).toBe(12000)  // 1% of 1200000
  })

  it('returns manual for percent decrease (no income data)', () => {
    const answers = { change_direction: 'decrease', prior_alimony_type: 'percent', requested_alimony_type: 'percent' }
    const result = buildCourtFeeSummary(answers)
    expect(result.basis).toBe('manual')
    expect(result.amount).toBeNull()
    expect(result.notes).toBeDefined()
  })

  it('returns manual for mixed types decrease', () => {
    const answers = { change_direction: 'decrease', prior_alimony_type: 'percent', requested_alimony_type: 'fixed' }
    expect(buildCourtFeeSummary(answers).basis).toBe('manual')
  })
})

// ─── buildQuestionsForLawyer ──────────────────────────────────────────────────

describe('buildQuestionsForLawyer', () => {
  const CLEAN = { spans: [], has_red: false, has_amber: false }

  it('returns empty array for clean case', () => {
    expect(buildQuestionsForLawyer(BASE_ANSWERS_INCREASE, CLEAN, false)).toHaveLength(0)
  })

  it('adds agreement_procedure question when agreement + own_procedure=yes', () => {
    const answers = { ...BASE_ANSWERS_INCREASE, prior_basis: 'agreement', agreement_own_procedure: 'yes' }
    const qs = buildQuestionsForLawyer(answers, CLEAN, false)
    expect(qs.some(q => q.id === 'agreement_procedure')).toBe(true)
  })

  it('adds agreement_procedure question when agreement + own_procedure=unknown', () => {
    const answers = { ...BASE_ANSWERS_INCREASE, prior_basis: 'agreement', agreement_own_procedure: 'unknown' }
    expect(buildQuestionsForLawyer(answers, CLEAN, false).some(q => q.id === 'agreement_procedure')).toBe(true)
  })

  it('does NOT add agreement_procedure when own_procedure=no', () => {
    const answers = { ...BASE_ANSWERS_INCREASE, prior_basis: 'agreement', agreement_own_procedure: 'no' }
    expect(buildQuestionsForLawyer(answers, CLEAN, false).some(q => q.id === 'agreement_procedure')).toBe(false)
  })

  it('adds existing_debt question for decrease + existing_debt=yes', () => {
    const answers = { ...BASE_ANSWERS_DECREASE_FIXED, existing_debt: 'yes' }
    const qs = buildQuestionsForLawyer(answers, CLEAN, false)
    expect(qs.some(q => q.id === 'existing_debt')).toBe(true)
  })

  it('adds reasoning_abstained question when abstained', () => {
    const qs = buildQuestionsForLawyer(BASE_ANSWERS_INCREASE, CLEAN, true)
    expect(qs.some(q => q.id === 'reasoning_abstained')).toBe(true)
  })

  it('adds amber_spans question when has_amber', () => {
    const groundedness = { spans: [{ text: '25%', type: 'percent', status: 'AMBER', reason: 'перевірте' }], has_red: false, has_amber: true }
    const qs = buildQuestionsForLawyer(BASE_ANSWERS_INCREASE, groundedness, false)
    expect(qs.some(q => q.id === 'amber_spans')).toBe(true)
    expect(qs.find(q => q.id === 'amber_spans').text).toContain('25%')
  })
})

// ─── buildHybridContext — main integration ────────────────────────────────────

describe('buildHybridContext', () => {
  it('returns correct shape', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result).toHaveProperty('_ai_reasoning')
    expect(result).toHaveProperty('_review_card')
    expect(result).toHaveProperty('_spans')
    expect(result).toHaveProperty('_has_red')
    expect(result).toHaveProperty('_abstained')
  })

  it('passes through reasoning_text when groundedness is clean', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._abstained).toBe(false)
    expect(result._ai_reasoning).toContain('ст.192 СК')
  })

  it('abstains (empty reasoning) when groundedness returns RED', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, RED_GROUNDEDNESS)
    expect(result._abstained).toBe(true)
    expect(result._has_red).toBe(true)
    expect(result._ai_reasoning).toBe('')
  })

  it('abstains on L3 parse error (null response)', () => {
    const result = buildHybridContext(null, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._abstained).toBe(true)
    expect(result._ai_reasoning).toBe('')
  })

  it('abstains on malformed L3 response', () => {
    const bad = { choices: [{ message: { content: 'not json' } }] }
    const result = buildHybridContext(bad, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._abstained).toBe(true)
  })

  it('does not abstain on AMBER only', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, AMBER_GROUNDEDNESS)
    expect(result._abstained).toBe(false)
    expect(result._ai_reasoning).not.toBe('')
  })

  it('review-card has correct direction', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.direction).toBe('increase')
  })

  it('review-card jurisdiction_basis is ст.28 for increase', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.jurisdiction_basis).toContain('ст.28')
  })

  it('review-card jurisdiction_basis is ст.27 for decrease', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_DECREASE_FIXED, CLEAN_GROUNDEDNESS)
    expect(result._review_card.jurisdiction_basis).toContain('ст.27')
  })

  it('review-card court_fee is exempt for increase', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.court_fee.basis).toBe('exempt')
  })

  it('review-card court_fee is calculated for decrease fixed→fixed', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_DECREASE_FIXED, CLEAN_GROUNDEDNESS)
    expect(result._review_card.court_fee.basis).toBe('calculated')
    expect(result._review_card.court_fee.price_of_claim).toBe(24000)
  })

  it('review-card reasoning_section.abstained=true on RED', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, RED_GROUNDEDNESS)
    expect(result._review_card.reasoning_section.abstained).toBe(true)
  })

  it('review-card reasoning_section.parse_error=true on null response', () => {
    const result = buildHybridContext(null, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.reasoning_section.parse_error).toBe(true)
  })

  it('review-card prior_order filled from answers', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    const po = result._review_card.prior_order
    expect(po.basis).toBe('court_decision')
    expect(po.case_number).toBe('761/12345/20')
    expect(po.date).toBe('15.03.2020')
    expect(po.amount).toBe('1/4')
  })

  it('review-card norms_used from L3 citations_used', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.norms_used).toEqual(['ст.192 СК', 'ст.182 СК'])
  })

  it('review-card norms_used empty on abstention', () => {
    const result = buildHybridContext(null, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, CLEAN_GROUNDEDNESS)
    expect(result._review_card.norms_used).toEqual([])
  })

  it('checkGroundedness is called with correct args', () => {
    const mockFn = vi.fn(() => ({ spans: [], has_red: false, has_amber: false }))
    buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, mockFn)
    expect(mockFn).toHaveBeenCalledOnce()
    const [text, ans, ids] = mockFn.mock.calls[0]
    expect(typeof text).toBe('string')
    expect(ans).toBe(BASE_ANSWERS_INCREASE)
    expect(ids).toBe(L2_ARTICLE_IDS)
  })

  it('checkGroundedness throwing is treated as RED', () => {
    const throwingFn = vi.fn(() => { throw new Error('critic exploded') })
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, throwingFn)
    expect(result._abstained).toBe(true)
    expect(result._has_red).toBe(true)
  })

  it('review-card questions include reasoning_abstained on RED', () => {
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, BASE_ANSWERS_INCREASE, RED_GROUNDEDNESS)
    expect(result._review_card.questions_for_lawyer.some(q => q.id === 'reasoning_abstained')).toBe(true)
  })

  it('facts_changed strips child_needs_up_extraordinary', () => {
    const answers = { ...BASE_ANSWERS_INCREASE, changed_facts: ['child_needs_up_extraordinary', 'child_needs_up_general'] }
    const result = buildHybridContext(VALID_GROQ_RESPONSE, L2_ARTICLE_IDS, answers, CLEAN_GROUNDEDNESS)
    expect(result._review_card.facts_changed).not.toContain('child_needs_up_extraordinary')
    expect(result._review_card.facts_changed).toContain('child_needs_up_general')
  })
})
