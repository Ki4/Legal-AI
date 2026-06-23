import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module (repo convention: static repo file, not untrusted input)
const { checkLawChangeGroundedness } = (() => {
  const code = readFileSync(resolve(__dirname, '../law-change-groundedness.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
})()

const CTX = {
  articleDiffs: {
    changed_articles: ['182'],
    hunks: [{ article_num: '182', op: 'changed', removed: ['Стара формула.'], added: ['Нова формула 50 відсотків.'] }],
  },
  scope: { services: [{ slug: 'alimony', severity: 'high', articles: ['182'] }], norms: ['182', '184'] },
}

const CLEAN_DRAFT = {
  summary: 'Змінено ст.182 СК — нова формула розміру.',
  per_service: [{
    slug: 'alimony', severity: 'high', confidence: 0.8, articles: ['182'],
    hypothesis: 'Ймовірно зачеплено розрахунок за ст.182.',
    evidence: 'Нова формула 50 відсотків.',
  }],
  overall_confidence: 0.8,
}

describe('checkLawChangeGroundedness', () => {
  it('passes a fully grounded draft (no RED)', () => {
    const r = checkLawChangeGroundedness(CLEAN_DRAFT, CTX)
    expect(r.has_red).toBe(false)
    expect(r.spans).toEqual([])
  })

  it('REDs a service outside the L2 scope', () => {
    const r = checkLawChangeGroundedness(
      { ...CLEAN_DRAFT, per_service: [{ ...CLEAN_DRAFT.per_service[0], slug: 'ghost' }] }, CTX)
    expect(r.has_red).toBe(true)
    expect(r.spans.some((s) => s.type === 'service')).toBe(true)
  })

  it('REDs a cited article outside the allowed set', () => {
    const r = checkLawChangeGroundedness(
      { ...CLEAN_DRAFT, per_service: [{ ...CLEAN_DRAFT.per_service[0], articles: ['999'] }] }, CTX)
    expect(r.has_red).toBe(true)
    expect(r.spans.some((s) => s.type === 'citation')).toBe(true)
  })

  it('REDs evidence that is not verbatim in the diff', () => {
    const r = checkLawChangeGroundedness(
      { ...CLEAN_DRAFT, per_service: [{ ...CLEAN_DRAFT.per_service[0], evidence: 'Це я вигадав.' }] }, CTX)
    expect(r.has_red).toBe(true)
    expect(r.spans.some((s) => s.type === 'evidence')).toBe(true)
  })

  it('REDs an out-of-set article cited in the prose summary', () => {
    const r = checkLawChangeGroundedness({ ...CLEAN_DRAFT, summary: 'Також змінено ст.500.' }, CTX)
    expect(r.has_red).toBe(true)
    expect(r.spans.some((s) => s.type === 'citation')).toBe(true)
  })

  it('treats an allowed scope norm (ст.184) as a valid citation', () => {
    const r = checkLawChangeGroundedness(
      { ...CLEAN_DRAFT, summary: 'Дотично до ст.184.', per_service: [{ ...CLEAN_DRAFT.per_service[0], articles: ['182', '184'] }] },
      CTX)
    expect(r.has_red).toBe(false)
  })
})
