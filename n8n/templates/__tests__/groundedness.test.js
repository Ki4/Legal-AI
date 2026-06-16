import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module (repo convention: static repo file, not untrusted input)
const { checkGroundedness } = (() => {
  const code = readFileSync(resolve(__dirname, '../groundedness.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
})()

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ANSWERS = {
  change_direction:        'increase',
  last_name:               'Коваленко',
  first_name:              'Оксана',
  middle_name:             'Іванівна',
  prior_alimony_type:      'percent',
  prior_alimony_value:     '1/4',
  prior_case_number:       '761/12345/20',
  prior_decision_date:     '2020-03-15',
  requested_alimony_type:  'percent',
  requested_alimony_value: '1/3',
  children_details:        'Коваленко Дарина Андріївна, 10.06.2016',
}

const BASE_L2 = ['ст.192 СК', 'ст.182 СК', 'ст.183 СК', 'ст.28 ЦПК']

// ─── GREEN path ───────────────────────────────────────────────────────────────

describe('checkGroundedness — GREEN path', () => {
  it('clean reasoning with known data and L2 citations → no RED spans', () => {
    const text = [
      'Рішенням суду від 15.03.2020 стягнуто аліменти у розмірі 1/4 частини від заробітку.',
      'З огляду на зміну обставин, відповідно до ст.192 СК України розмір аліментів може бути змінений.',
      'Суд, відповідно до ст.182 СК України, враховує матеріальне становище сторін.',
      'Просимо збільшити розмір до 1/3 частини від заробітку відповідача.',
    ].join(' ')

    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    expect(result.has_red).toBe(false)
    expect(result.spans.filter(s => s.status === 'RED')).toHaveLength(0)
  })
})

// ─── Citation checks ──────────────────────────────────────────────────────────

describe('checkGroundedness — citation RED', () => {
  it('hallucinated article (ст.141 СК not in L2) → RED span', () => {
    const text = 'Відповідно до ст.141 СК України батьки зобов\'язані утримувати дитину.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'citation')
    expect(red.length).toBeGreaterThan(0)
    expect(red[0].text).toContain('141')
    expect(result.has_red).toBe(true)
  })

  it('L2 citation ст.192 СК → not flagged', () => {
    const text = 'Відповідно до ст.192 СК розмір може бути змінений.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const citationRed = result.spans.filter(s => s.type === 'citation' && s.status === 'RED')
    expect(citationRed).toHaveLength(0)
  })

  it('out-of-L2 ЦПК article (ст.175 not in L2) → RED', () => {
    const l2 = ['ст.192 СК', 'ст.182 СК']
    const text = 'Згідно з ст.175 ЦПК позовна заява повинна містити ціну позову.'
    const result = checkGroundedness(text, BASE_ANSWERS, l2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'citation')
    expect(red.length).toBeGreaterThan(0)
  })
})

// ─── Amount checks ────────────────────────────────────────────────────────────

describe('checkGroundedness — amount RED', () => {
  it('hallucinated грн amount → RED', () => {
    const text = 'Різниця складає 5000 грн.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'amount')
    expect(red.length).toBeGreaterThan(0)
    expect(result.has_red).toBe(true)
  })

  it('amount present in L0 → not RED', () => {
    const answers = { ...BASE_ANSWERS, prior_alimony_value: '6000', requested_alimony_value: '4000' }
    const text = 'Поточний розмір — 6000 грн, бажаний — 4000 грн.'
    const result = checkGroundedness(text, answers, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'amount')
    expect(red).toHaveLength(0)
  })
})

// ─── Fraction checks ──────────────────────────────────────────────────────────

describe('checkGroundedness — fraction RED', () => {
  it('hallucinated fraction 1/5 not in L0 → RED', () => {
    const text = 'Просимо встановити розмір у 1/5 від заробітку.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'fraction')
    expect(red.length).toBeGreaterThan(0)
  })

  it('fraction 1/4 present in L0 → not RED', () => {
    const text = 'Поточний розмір 1/4 частини.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'fraction')
    expect(red).toHaveLength(0)
  })
})

// ─── Date checks ──────────────────────────────────────────────────────────────

describe('checkGroundedness — date RED', () => {
  it('hallucinated date → RED', () => {
    const text = 'Рішення від 01.05.2019 було ухвалено судом.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'date')
    expect(red.length).toBeGreaterThan(0)
  })

  it('date matching L0 ISO format (2020-03-15 → 15.03.2020) → not RED', () => {
    const text = 'Рішенням від 15.03.2020 стягнуто аліменти.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'date')
    expect(red).toHaveLength(0)
  })
})

// ─── Case number checks ───────────────────────────────────────────────────────

describe('checkGroundedness — case number RED', () => {
  it('hallucinated case number → RED', () => {
    const text = 'Справа № 999/99999/20 розглядалась судом.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'case_number')
    expect(red.length).toBeGreaterThan(0)
  })

  it('case number matching L0 → not RED', () => {
    const text = 'Справа № 761/12345/20 вже розглядалась.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'case_number')
    expect(red).toHaveLength(0)
  })
})

// ─── Summary flags ────────────────────────────────────────────────────────────

describe('checkGroundedness — summary flags', () => {
  it('no issues → has_red=false', () => {
    const text = 'Відповідно до ст.192 СК розмір аліментів може бути змінений.'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    expect(result.has_red).toBe(false)
  })

  it('RED citation → has_red=true', () => {
    const text = 'Відповідно до ст.999 СК ...'
    const result = checkGroundedness(text, BASE_ANSWERS, BASE_L2)
    expect(result.has_red).toBe(true)
  })

  it('empty text → no spans, no flags', () => {
    const result = checkGroundedness('', BASE_ANSWERS, BASE_L2)
    expect(result.spans).toHaveLength(0)
    expect(result.has_red).toBe(false)
    expect(result.has_amber).toBe(false)
  })

  it('null l2ArticleIds → all citations flagged RED', () => {
    const text = 'Відповідно до ст.192 СК ...'
    const result = checkGroundedness(text, BASE_ANSWERS, null)
    const red = result.spans.filter(s => s.status === 'RED' && s.type === 'citation')
    expect(red.length).toBeGreaterThan(0)
  })
})
