import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require   = createRequire(import.meta.url)

const { prepareL4b, fillCriticTemplate } = require(resolve(__dirname, '../prepare-l4b.js'))
const { parseL4bResponse }               = require(resolve(__dirname, '../build-hybrid-context.js'))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_PROMPT_TEMPLATE =
  'Напрямок: {{DIRECTION}}\nПідстави: {{CHANGED_FACTS_JSON}}\nНорми: {{L2_NORMS}}\nТекст: {{REASONING_TEXT}}'

const REASONING = 'Відповідно до ст.192 СК розмір аліментів може бути збільшено.'
const L2_NORMS  = 'ст.192 СК: текст норми...'

// ─── fillCriticTemplate ───────────────────────────────────────────────────────

describe('fillCriticTemplate', () => {
  it('replaces all 4 placeholders', () => {
    const result = fillCriticTemplate(MOCK_PROMPT_TEMPLATE, {
      DIRECTION:          'Збільшення',
      CHANGED_FACTS_JSON: '["child_needs_up_general"]',
      L2_NORMS:           L2_NORMS,
      REASONING_TEXT:     REASONING,
    })
    expect(result).toContain('Напрямок: Збільшення')
    expect(result).toContain('Підстави: ["child_needs_up_general"]')
    expect(result).toContain('Норми: ' + L2_NORMS)
    expect(result).toContain('Текст: ' + REASONING)
    expect(result).not.toContain('{{')
  })

  it('leaves unmatched placeholders intact (unknown keys)', () => {
    const result = fillCriticTemplate('Hello {{UNKNOWN}}', {
      DIRECTION: 'x', CHANGED_FACTS_JSON: '[]', L2_NORMS: '', REASONING_TEXT: '',
    })
    expect(result).toContain('{{UNKNOWN}}')
  })
})

// ─── prepareL4b ───────────────────────────────────────────────────────────────

describe('prepareL4b', () => {
  it('returns a valid Groq request body', () => {
    const result = prepareL4b(REASONING, 'Збільшення', ['child_needs_up_general'], L2_NORMS, MOCK_PROMPT_TEMPLATE)

    expect(result).toHaveProperty('_groq_body')
    const body = result._groq_body
    expect(body.model).toBe('llama-3.3-70b-versatile')
    expect(body.temperature).toBe(0)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(Array.isArray(body.messages)).toBe(true)
    expect(body.messages.length).toBe(1)
    expect(body.messages[0].role).toBe('user')
  })

  it('filled prompt contains reasoning text', () => {
    const { _groq_body } = prepareL4b(REASONING, 'Збільшення', ['child_needs_up_general'], L2_NORMS, MOCK_PROMPT_TEMPLATE)
    expect(_groq_body.messages[0].content).toContain(REASONING)
  })

  it('uses provided modelName', () => {
    const { _groq_body } = prepareL4b(REASONING, 'Збільшення', [], L2_NORMS, MOCK_PROMPT_TEMPLATE, 'llama-3.1-8b-instant')
    expect(_groq_body.model).toBe('llama-3.1-8b-instant')
  })

  it('serialises changedFacts as JSON array', () => {
    const facts = ['payer_income_up', 'child_needs_up_general']
    const { _groq_body } = prepareL4b(REASONING, 'Збільшення', facts, L2_NORMS, MOCK_PROMPT_TEMPLATE)
    expect(_groq_body.messages[0].content).toContain('"payer_income_up"')
  })

  it('handles empty / null changedFacts gracefully', () => {
    expect(() => prepareL4b(REASONING, 'Збільшення', null, L2_NORMS, MOCK_PROMPT_TEMPLATE)).not.toThrow()
    expect(() => prepareL4b(REASONING, 'Збільшення', undefined, L2_NORMS, MOCK_PROMPT_TEMPLATE)).not.toThrow()
  })

  it('handles empty reasoningText', () => {
    const { _groq_body } = prepareL4b('', 'Зменшення', [], '', MOCK_PROMPT_TEMPLATE)
    expect(_groq_body.messages[0].content).toContain('Зменшення')
  })
})

// ─── parseL4bResponse ─────────────────────────────────────────────────────────

describe('parseL4bResponse', () => {
  const makeGroqResponse = (content) => ({
    choices: [{ message: { content: JSON.stringify(content) } }],
  })

  it('parses a valid GREEN response', () => {
    const resp = makeGroqResponse({
      sentences: [{ text: 'Речення 1.', status: 'GREEN', reason: null }],
      overall:   'GREEN',
      summary:   'All sentences are GREEN.',
    })
    const result = parseL4bResponse(resp)
    expect(result).not.toBeNull()
    expect(result.overall).toBe('GREEN')
    expect(result.sentences).toHaveLength(1)
    expect(result.summary).toBe('All sentences are GREEN.')
  })

  it('parses a RED response', () => {
    const resp = makeGroqResponse({
      sentences: [
        { text: 'Речення 1.', status: 'RED', reason: 'Гарантований результат.' },
      ],
      overall: 'RED',
      summary: 'RED detected.',
    })
    const result = parseL4bResponse(resp)
    expect(result.overall).toBe('RED')
  })

  it('normalises lowercase overall to uppercase', () => {
    const resp = makeGroqResponse({ sentences: [], overall: 'amber', summary: '' })
    expect(parseL4bResponse(resp).overall).toBe('AMBER')
  })

  it('returns null for null/undefined input', () => {
    expect(parseL4bResponse(null)).toBeNull()
    expect(parseL4bResponse(undefined)).toBeNull()
  })

  it('returns null for invalid JSON content', () => {
    const resp = { choices: [{ message: { content: 'not json' } }] }
    expect(parseL4bResponse(resp)).toBeNull()
  })

  it('returns null when sentences field is missing', () => {
    const resp = makeGroqResponse({ overall: 'GREEN', summary: 'ok' })
    expect(parseL4bResponse(resp)).toBeNull()
  })

  it('strips markdown code fences', () => {
    const inner = { sentences: [], overall: 'GREEN', summary: '' }
    const resp = { choices: [{ message: { content: '```json\n' + JSON.stringify(inner) + '\n```' } }] }
    expect(parseL4bResponse(resp)).not.toBeNull()
  })
})

// ─── buildHybridContext with l4bResponse ──────────────────────────────────────

describe('buildHybridContext — l4b integration', () => {
  const { buildHybridContext } = require(resolve(__dirname, '../build-hybrid-context.js'))

  const cleanGroundedness = () => ({ spans: [], has_red: false, has_amber: false })

  const L3_CLEAN = {
    choices: [{
      message: {
        content: JSON.stringify({
          reasoning_text: 'Відповідно до ст.192 СК розмір може бути збільшено.',
          citations_used: ['ст.192 СК'],
        }),
      },
    }],
  }

  const ANSWERS = {
    change_direction:       'increase',
    prior_basis:            'court_decision',
    prior_decision_date:    '2020-03-15',
    prior_alimony_type:     'percent',
    prior_alimony_value:    '1/4',
    requested_alimony_type: 'percent',
    changed_facts:          ['child_needs_up_general'],
  }

  const makeL4b = (overall, sentences = []) => ({
    choices: [{ message: { content: JSON.stringify({ overall, sentences, summary: '' }) } }],
  })

  it('l4bResponse=undefined → backward compatible, no abstention change', () => {
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, undefined)
    expect(r._abstained).toBe(false)
    expect(r._review_card.reasoning_section.l4b).toBeUndefined()
  })

  it('l4b overall=GREEN → not abstained, l4b info in review_card', () => {
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, makeL4b('GREEN'))
    expect(r._abstained).toBe(false)
    expect(r._review_card.reasoning_section.l4b.overall).toBe('GREEN')
  })

  it('l4b overall=RED → abstained=true, ai_reasoning empty', () => {
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, makeL4b('RED'))
    expect(r._abstained).toBe(true)
    expect(r._ai_reasoning).toBe('')
    expect(r._has_red).toBe(true)
  })

  it('l4b overall=AMBER → NOT abstained, but has_amber in review_card', () => {
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, makeL4b('AMBER'))
    expect(r._abstained).toBe(false)
    expect(r._review_card.reasoning_section.has_amber).toBe(true)
  })

  it('l4b AMBER sentences → l4b_amber question added to questions_for_lawyer', () => {
    const amberSentence = { text: 'Суд задовольнить позов.', status: 'AMBER', reason: 'Надто впевнено.' }
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, makeL4b('AMBER', [amberSentence]))
    const q = r._review_card.questions_for_lawyer.find(q => q.id === 'l4b_amber')
    expect(q).toBeDefined()
    expect(q.severity).toBe('info')
  })

  it('l4b parse failure (null) → no abstention, no l4b in review_card', () => {
    const badL4b = { choices: [{ message: { content: 'broken json' } }] }
    const r = buildHybridContext(L3_CLEAN, ['ст.192 СК'], ANSWERS, cleanGroundedness, badL4b)
    expect(r._abstained).toBe(false)
    expect(r._review_card.reasoning_section.l4b).toBeUndefined()
  })
})
