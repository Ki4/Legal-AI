import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const { prepareReasoning, buildArticleId, fillPromptTemplate } =
  require(resolve(__dirname, '../prepare-reasoning.js'))

const STUB_PROMPT = 'DIR={{DIRECTION}} FACTS={{CHANGED_FACTS_JSON}} NORMS={{L2_NORMS}} IDS={{L2_ARTICLE_IDS}} PV={{PRIOR_VALUE}} PT={{PRIOR_TYPE}} RV={{REQUESTED_VALUE}} RT={{REQUESTED_TYPE}} CH={{CHILDREN_INFO}} DD={{PRIOR_DECISION_DATE}}'

const BASE_ANSWERS = {
  change_direction:        'increase',
  prior_alimony_type:      'percent',
  prior_alimony_value:     '1/4',
  prior_decision_date:     '15.03.2020',
  requested_alimony_type:  'percent',
  requested_alimony_value: '1/3',
  children_details:        'Коваленко Дарина Андріївна, 10.06.2016',
  changed_facts:           ['child_needs_up_general', 'recipient_income_down'],
}

const BASE_L2_ROWS = [
  { law_code: '2947-14', article_num: 'Стаття 192', article_title: 'Зміна розміру аліментів', content: 'Розмір аліментів може бути змінений за рішенням суду.' },
  { law_code: '2947-14', article_num: 'Стаття 182', article_title: 'Розмір аліментів',        content: 'При визначенні розміру суд враховує стан здоров\'я та матеріальне становище.' },
]

// ─── buildArticleId ───────────────────────────────────────────────────────────

describe('buildArticleId', () => {
  it('converts "Стаття 192" + Family Code to "ст.192 СК"', () => {
    expect(buildArticleId({ law_code: '2947-14', article_num: 'Стаття 192' })).toBe('ст.192 СК')
  })

  it('converts "ст. 28" + CPC code to "ст.28 ЦПК"', () => {
    expect(buildArticleId({ law_code: '1618-15', article_num: 'ст. 28' })).toBe('ст.28 ЦПК')
  })

  it('handles plain number', () => {
    expect(buildArticleId({ law_code: '3674-12', article_num: '5' })).toBe('ст.5 ЗСЗ')
  })

  it('handles unknown law_code (no abbreviation)', () => {
    expect(buildArticleId({ law_code: 'unknown', article_num: 'Стаття 10' })).toBe('ст.10')
  })

  it('returns null when article_num has no digits', () => {
    expect(buildArticleId({ law_code: '2947-14', article_num: '' })).toBeNull()
  })

  it('handles abbreviated law_code alias СК', () => {
    expect(buildArticleId({ law_code: 'СК', article_num: 'Стаття 183' })).toBe('ст.183 СК')
  })
})

// ─── fillPromptTemplate ───────────────────────────────────────────────────────

describe('fillPromptTemplate', () => {
  it('replaces all placeholders', () => {
    const result = fillPromptTemplate(STUB_PROMPT, {
      DIRECTION:            'Збільшення',
      CHANGED_FACTS_JSON:   '[]',
      L2_NORMS:             'норми',
      L2_ARTICLE_IDS:       'ст.192 СК',
      PRIOR_VALUE:          '1/4',
      PRIOR_TYPE:           'частка від заробітку',
      REQUESTED_VALUE:      '1/3',
      REQUESTED_TYPE:       'частка від заробітку',
      CHILDREN_INFO:        'дитина',
      PRIOR_DECISION_DATE:  '15.03.2020',
    })
    expect(result).not.toContain('{{')
    expect(result).toContain('Збільшення')
    expect(result).toContain('ст.192 СК')
    expect(result).toContain('1/4')
  })
})

// ─── prepareReasoning — main cases ───────────────────────────────────────────

describe('prepareReasoning', () => {
  it('returns correct shape', () => {
    const result = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    expect(result).toHaveProperty('_groq_body')
    expect(result).toHaveProperty('_l2_article_ids')
    expect(result).toHaveProperty('_l2_norms_text')
    expect(result).toHaveProperty('_answers_snapshot')
  })

  it('builds correct article IDs from L2 rows', () => {
    const { _l2_article_ids } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    expect(_l2_article_ids).toEqual(['ст.192 СК', 'ст.182 СК'])
  })

  it('deduplicates rows with the same articleId', () => {
    const duplicated = [...BASE_L2_ROWS, { ...BASE_L2_ROWS[0] }]
    const { _l2_article_ids } = prepareReasoning(BASE_ANSWERS, duplicated, STUB_PROMPT)
    expect(_l2_article_ids).toEqual(['ст.192 СК', 'ст.182 СК'])
  })

  it('falls back to stub articles when l2Rows is empty', () => {
    const { _l2_article_ids, _l2_norms_text } = prepareReasoning(BASE_ANSWERS, [], STUB_PROMPT)
    expect(_l2_article_ids).toContain('ст.192 СК')
    expect(_l2_article_ids).toContain('ст.182 СК')
    expect(_l2_norms_text).toContain('не вдалося завантажити')
  })

  it('falls back to stub articles when l2Rows is null', () => {
    const { _l2_article_ids } = prepareReasoning(BASE_ANSWERS, null, STUB_PROMPT)
    expect(_l2_article_ids.length).toBeGreaterThan(0)
  })

  it('sets direction Збільшення for increase', () => {
    const { _groq_body } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    expect(_groq_body.messages[0].content).toContain('Збільшення')
  })

  it('sets direction Зменшення for decrease', () => {
    const answers = { ...BASE_ANSWERS, change_direction: 'decrease' }
    const { _groq_body } = prepareReasoning(answers, BASE_L2_ROWS, STUB_PROMPT)
    expect(_groq_body.messages[0].content).toContain('Зменшення')
  })

  it('translates alimony types to Ukrainian labels', () => {
    const answers = { ...BASE_ANSWERS, prior_alimony_type: 'percent', requested_alimony_type: 'fixed' }
    const { _groq_body } = prepareReasoning(answers, BASE_L2_ROWS, STUB_PROMPT)
    const content = _groq_body.messages[0].content
    expect(content).toContain('частка від заробітку')
    expect(content).toContain('тверда сума')
  })

  it('accepts changed_facts as object (checkbox map)', () => {
    const answers = {
      ...BASE_ANSWERS,
      changed_facts: { payer_income_up: true, child_health_down: false, recipient_income_down: true },
    }
    const { _groq_body } = prepareReasoning(answers, BASE_L2_ROWS, STUB_PROMPT)
    const content = _groq_body.messages[0].content
    expect(content).toContain('payer_income_up')
    expect(content).toContain('recipient_income_down')
    expect(content).not.toContain('child_health_down')
  })

  it('strips child_needs_up_extraordinary from facts (L0.5 gate)', () => {
    const answers = {
      ...BASE_ANSWERS,
      changed_facts: ['child_needs_up_extraordinary', 'child_needs_up_general'],
    }
    const { _groq_body } = prepareReasoning(answers, BASE_L2_ROWS, STUB_PROMPT)
    const content = _groq_body.messages[0].content
    expect(content).not.toContain('child_needs_up_extraordinary')
    expect(content).toContain('child_needs_up_general')
  })

  it('uses default model when modelName is omitted', () => {
    const { _groq_body } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    expect(_groq_body.model).toBe('llama-3.3-70b-versatile')
    expect(_groq_body.temperature).toBe(0.3)
    expect(_groq_body.response_format).toEqual({ type: 'json_object' })
  })

  it('uses provided modelName when passed (Global Config override)', () => {
    const { _groq_body } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT, 'llama-3.1-8b-instant')
    expect(_groq_body.model).toBe('llama-3.1-8b-instant')
  })

  it('passes answers_snapshot through unchanged', () => {
    const { _answers_snapshot } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    expect(_answers_snapshot).toBe(BASE_ANSWERS)
  })

  it('includes children_details and prior_decision_date in prompt', () => {
    const { _groq_body } = prepareReasoning(BASE_ANSWERS, BASE_L2_ROWS, STUB_PROMPT)
    const content = _groq_body.messages[0].content
    expect(content).toContain('Коваленко Дарина Андріївна')
    expect(content).toContain('15.03.2020')
  })
})
