import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module (repo convention: static repo file, not untrusted input)
const { computeImpactScope, diffTouchesNumbers } = (() => {
  const code = readFileSync(resolve(__dirname, '../law-change-scope.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
})()

// ─── Fixtures: ст.182/184 СК (2947-14), ст.175 ЦПК (1618-15) ──────────────────
const CHUNKS = [
  { id: 'c1', law_code: '2947-14', article_num: '182', service_slugs: ['alimony', 'alimony-change'] },
  { id: 'c2', law_code: '2947-14', article_num: '184', service_slugs: ['alimony'] },
  { id: 'c3', law_code: '1618-15', article_num: '175', service_slugs: ['divorce', 'alimony', 'property'] },
  { id: 'c4', law_code: '2947-14', article_num: '999', service_slugs: ['ghost'] },
]
const RELATIONS = [
  { from_chunk_id: 'c2', to_chunk_id: 'c1', relation_type: 'requires',   verified_by: 'olga@x' },
  { from_chunk_id: 'c3', to_chunk_id: 'c1', relation_type: 'references', verified_by: 'olga@x' },
  { from_chunk_id: 'c4', to_chunk_id: 'c1', relation_type: 'requires',   verified_by: null }, // unverified → ignored
]

const sev = (scope, slug) => scope.services.find((s) => s.slug === slug)?.severity

describe('computeImpactScope', () => {
  it('maps a changed article to direct + rippled services with legal severity', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    // Direct serving article → high; requires-ripple → high; references-ripple → low.
    expect(sev(scope, 'alimony')).toBe('high')          // direct + requires(184) + references(175)
    expect(sev(scope, 'alimony-change')).toBe('high')   // direct
    expect(sev(scope, 'divorce')).toBe('low')           // via references(175)
    expect(sev(scope, 'property')).toBe('low')          // via references(175)
    expect(scope.changed_articles).toEqual(['182'])
  })

  it('ignores UNVERIFIED relations (a graph edge without sign-off never drives impact)', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    expect(scope.services.find((s) => s.slug === 'ghost')).toBeUndefined()
  })

  it('softens severity one step when the diff is non-substantive (touchesNumbers=false)', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
      touchesNumbers: false,
    })
    expect(sev(scope, 'alimony')).toBe('medium')        // high → medium
    expect(sev(scope, 'divorce')).toBe('low')           // low stays low
  })

  it('returns empty scope for a changed article no chunk/relation covers', () => {
    const scope = computeImpactScope({
      changedArticles: ['12345'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    expect(scope.services).toEqual([])
  })

  it('takes the MAX severity over all paths to a service (high beats low)', () => {
    // alimony is reached directly (high) and also via references(175) (low) → high wins.
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    const alimony = scope.services.find((s) => s.slug === 'alimony')
    expect(alimony.severity).toBe('high')
    // it collected both its own article (182) and the rippled ones (184 via requires, 175 via references)
    expect(alimony.articles).toEqual(['175', '182', '184'])
    expect(alimony.relations).toEqual(expect.arrayContaining(['direct', 'requires', 'references']))
  })

  it('treats an `overrides` relation at the high ceiling', () => {
    const chunks = [
      { id: 'a', law_code: 'L', article_num: '1', service_slugs: [] },             // changed, serves nothing directly
      { id: 'b', law_code: 'L', article_num: '2', service_slugs: ['svc-over'] },    // neighbor via overrides
    ]
    const relations = [{ from_chunk_id: 'a', to_chunk_id: 'b', relation_type: 'overrides', verified_by: 'olga@x' }]
    const scope = computeImpactScope({ changedArticles: ['1'], lawCode: 'L', lawChunks: chunks, lawRelations: relations })
    expect(sev(scope, 'svc-over')).toBe('high')
  })

  it('maps an unknown relation_type to the low ceiling', () => {
    const chunks = [
      { id: 'a', law_code: 'L', article_num: '1', service_slugs: [] },
      { id: 'b', law_code: 'L', article_num: '2', service_slugs: ['svc-x'] },
    ]
    const relations = [{ from_chunk_id: 'a', to_chunk_id: 'b', relation_type: 'mentions', verified_by: 'olga@x' }]
    const scope = computeImpactScope({ changedArticles: ['1'], lawCode: 'L', lawChunks: chunks, lawRelations: relations })
    expect(sev(scope, 'svc-x')).toBe('low')
  })

  it('keeps a low severity at low when softening (no underflow below low)', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
      touchesNumbers: false,
    })
    // divorce/property only reachable via references → already low, stays low.
    expect(sev(scope, 'divorce')).toBe('low')
    expect(sev(scope, 'property')).toBe('low')
  })

  it('sorts services by severity desc, then slug asc', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    const order = scope.services.map((s) => s.slug)
    // highs first (alimony, alimony-change — alphabetical), then lows (divorce, property)
    expect(order).toEqual(['alimony', 'alimony-change', 'divorce', 'property'])
  })

  it('builds a deduped, numerically-sorted norms list from changed + rippled articles', () => {
    const scope = computeImpactScope({
      changedArticles: ['182'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: RELATIONS,
    })
    expect(scope.norms).toEqual(['175', '182', '184'])
  })

  it('treats a direct-serving change with no relations as high and only its own article', () => {
    const scope = computeImpactScope({
      changedArticles: ['184'], lawCode: '2947-14', lawChunks: CHUNKS, lawRelations: [],
    })
    expect(sev(scope, 'alimony')).toBe('high')
    expect(scope.services.find((s) => s.slug === 'alimony').articles).toEqual(['184'])
  })

  it('survives missing arrays (null chunks / relations / changedArticles)', () => {
    const scope = computeImpactScope({ changedArticles: null, lawCode: 'L', lawChunks: null, lawRelations: null })
    expect(scope.services).toEqual([])
    expect(scope.changed_articles).toEqual([])
    expect(scope.norms).toEqual([])
  })
})

describe('diffTouchesNumbers', () => {
  it('is true when a hunk touches money / % / dates / terms / subsistence minimum', () => {
    expect(diffTouchesNumbers({ hunks: [{ added: ['не менше 50 відсотків прожиткового мінімуму'] }] })).toBe(true)
    expect(diffTouchesNumbers({ hunks: [{ removed: ['строком на 12 місяців'] }] })).toBe(true)
  })

  it('is false for a pure wording / structure change', () => {
    expect(diffTouchesNumbers({ hunks: [{ added: ['Статтю викладено в новій редакції'] }] })).toBe(false)
  })

  it('is false for missing / malformed input', () => {
    expect(diffTouchesNumbers(null)).toBe(false)
    expect(diffTouchesNumbers({})).toBe(false)
  })
})
