/**
 * hybrid-pipeline-integration.test.js
 * Integration test for the full hybrid pipeline chain (#74, IMPROVEMENTS #74).
 *
 * NOT an e2e test against real Groq — uses fixture L3 responses to pin the
 * behaviour of the full deterministic chain:
 *
 *   fixture l3Response
 *     → buildHybridContext (real checkGroundedness + L4c abstention)
 *     → buildContext + renderDocumentWithStyles (real engine)
 *     → assert _content shape
 *
 * Why: 928 unit tests cover each module in isolation. A field rename in
 * sync-build-document-node.mjs (_review_card, _ai_reasoning, etc.) would go
 * undetected until a real client request. This test pins the seam.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

// ─── Load CJS modules ─────────────────────────────────────────────────────────

const { buildHybridContext }                     = require(resolve(__dirname, '../build-hybrid-context.js'))
const { checkGroundedness }                      = require(resolve(__dirname, '../groundedness.js'))
const { buildContext, renderDocumentWithStyles } = require(resolve(__dirname, '../render-document.js'))

const TEMPLATE = readFileSync(
  resolve(__dirname, '../services/alimony-change.document.txt'),
  'utf8',
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wrap reasoning text into a Groq-shaped HTTP response fixture. */
function makeL3Response(reasoningText, citationsUsed = []) {
  return {
    choices: [{
      message: {
        content: JSON.stringify({ reasoning_text: reasoningText, citations_used: citationsUsed }),
      },
    }],
  }
}

/** Run the full chain and return { text, _abstained, _ai_reasoning }. */
function runPipeline(answers, l3Response, l2ArticleIds, aiExtras = {}) {
  const hybrid = buildHybridContext(l3Response, l2ArticleIds, answers, checkGroundedness)
  const aiPayload = { ...aiExtras, reasoning: hybrid._ai_reasoning }
  const ctx = buildContext(answers, aiPayload)
  const { text } = renderDocumentWithStyles(TEMPLATE, ctx)
  return { text, _abstained: hybrid._abstained, _ai_reasoning: hybrid._ai_reasoning }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// L2 article set for alimony-change (golden from scenario-1)
const L2_ARTICLE_IDS = ['ст.192 СК', 'ст.182 СК', 'ст.183 СК']

// Fallback paragraph that the template emits when ai.reasoning is empty (lines 91-92)
const FALLBACK_PARA = 'Відповідно до ч. 2 ст. 182 СК України розмір аліментів має бути необхідним та достатнім'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('hybrid pipeline integration — abstention path (RED span)', () => {
  it('RED citation → abstained=true, ai_reasoning empty, template uses fallback paragraph', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    // l3Response contains a citation NOT in L2 → checkGroundedness returns has_red=true
    const l3 = makeL3Response(
      'Відповідно до ст.141 СК України суд може зменшити аліменти.', // ст.141 is NOT in L2
      ['ст.141 СК'],
    )

    const { text, _abstained, _ai_reasoning } = runPipeline(answers, l3, L2_ARTICLE_IDS)

    expect(_abstained).toBe(true)
    expect(_ai_reasoning).toBe('')
    expect(text).toContain(FALLBACK_PARA)
    // Must NOT contain the hallucionated citation in the rendered document
    expect(text).not.toContain('ст.141 СК')
  })

  it('RED invented amount → abstained=true, fallback used', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    // Invented monetary amount not present in L0 answers
    const l3 = makeL3Response(
      'Розмір аліментів становить 99999 грн на місяць, що обґрунтовано ст.192 СК.',
      ['ст.192 СК'],
    )

    const { _abstained, text } = runPipeline(answers, l3, L2_ARTICLE_IDS)

    expect(_abstained).toBe(true)
    expect(text).toContain(FALLBACK_PARA)
  })

  it('malformed l3Response (JSON parse error) → abstained=true, fallback used', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    const badL3 = { choices: [{ message: { content: 'not json at all' } }] }

    const { _abstained, text } = runPipeline(answers, badL3, L2_ARTICLE_IDS)

    expect(_abstained).toBe(true)
    expect(text).toContain(FALLBACK_PARA)
  })
})

describe('hybrid pipeline integration — proceed path (clean reasoning)', () => {
  it('clean l3Response → abstained=false, ai_reasoning in output, no fallback paragraph', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    // Clean reasoning: all citations in L2, no invented amounts/dates/names
    const reasoningText =
      'Відповідно до ст.192 СК розмір аліментів може бути збільшено у зв\'язку зі ' +
      'зміною матеріального становища платника та зростанням потреб дитини (ст.182 СК, ст.183 СК).'

    const l3 = makeL3Response(reasoningText, ['ст.192 СК', 'ст.182 СК', 'ст.183 СК'])

    const { text, _abstained, _ai_reasoning } = runPipeline(answers, l3, L2_ARTICLE_IDS)

    expect(_abstained).toBe(false)
    expect(_ai_reasoning).toBe(reasoningText)
    expect(text).toContain(reasoningText)
    // Fallback should NOT appear when AI reasoning is present
    expect(text).not.toContain(FALLBACK_PARA)
  })

  it('clean reasoning → review_card.abstained=false, norms_used populated', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    const reasoningText = 'Зміна обставин підтверджується відповідно до ст.192 СК та ст.182 СК.'
    const l3 = makeL3Response(reasoningText, ['ст.192 СК', 'ст.182 СК'])

    const hybrid = buildHybridContext(l3, L2_ARTICLE_IDS, answers, checkGroundedness)

    expect(hybrid._abstained).toBe(false)
    expect(hybrid._review_card.reasoning_section.abstained).toBe(false)
    expect(hybrid._review_card.norms_used).toEqual(['ст.192 СК', 'ст.182 СК'])
    expect(hybrid._review_card.service).toBe('alimony-change')
    expect(hybrid._review_card.direction).toBe('increase')
  })
})

describe('hybrid pipeline integration — review-card shape', () => {
  it('review_card always has required fields regardless of abstention', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    const l3Red = makeL3Response('Відповідно до ст.141 СК рішення може бути скасоване.', ['ст.141 СК'])
    const hybrid = buildHybridContext(l3Red, L2_ARTICLE_IDS, answers, checkGroundedness)

    const rc = hybrid._review_card
    expect(rc).toHaveProperty('service', 'alimony-change')
    expect(rc).toHaveProperty('direction')
    expect(rc).toHaveProperty('court_fee')
    expect(rc).toHaveProperty('jurisdiction_basis')
    expect(rc).toHaveProperty('reasoning_section')
    expect(rc.reasoning_section).toHaveProperty('abstained', true)
    expect(rc).toHaveProperty('questions_for_lawyer')
    // abstained → reasoning_abstained question added
    expect(rc.questions_for_lawyer.some(q => q.id === 'reasoning_abstained')).toBe(true)
  })

  it('scenario-1 (increase) → court_fee is exempt', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    const l3 = makeL3Response('Обґрунтування ст.192 СК та ст.182 СК.', ['ст.192 СК', 'ст.182 СК'])
    const hybrid = buildHybridContext(l3, L2_ARTICLE_IDS, answers, checkGroundedness)

    expect(hybrid._review_card.court_fee.basis).toBe('exempt')
  })

  it('rendered document has no unresolved {{ }} tags in either path', async () => {
    const { answers } = await import('../../../test-data/alimony-change/fixtures/scenario-1.mjs')

    // Abstain path
    const l3Red = makeL3Response('Текст із ст.141 СК.', ['ст.141 СК'])
    const { text: textAbstained } = runPipeline(answers, l3Red, L2_ARTICLE_IDS)
    expect(textAbstained).not.toMatch(/\{\{[^}]+\}\}/)

    // Proceed path
    const l3Clean = makeL3Response('Обґрунтування ст.192 СК.', ['ст.192 СК'])
    const { text: textProceed } = runPipeline(answers, l3Clean, L2_ARTICLE_IDS)
    expect(textProceed).not.toMatch(/\{\{[^}]+\}\}/)
  })
})
