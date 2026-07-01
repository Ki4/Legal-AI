import { describe, it, expect } from 'vitest'
import { paginate, type ParaLayout, type PageMetrics } from '../paginate'

const M: PageMetrics = { contentHeight: 100 }

/** Which page each paragraph index landed on (1-based), for terse assertions. */
function pageOf(result: ReturnType<typeof paginate>, index: number): number | undefined {
  for (const pg of result.pages) {
    if (pg.segments.some((s) => s.index === index)) return pg.pageNo
  }
  return undefined
}

describe('paginate', () => {
  it('returns no pages for empty input', () => {
    expect(paginate([], M)).toEqual({ pages: [], overflow: [] })
  })

  it('keeps a keep-together group whole on the next page rather than splitting it', () => {
    // para0 fills most of page 1; the glued group [1,2] would fit para1 on page 1
    // (90 ≤ 100) but para2 would spill — so the whole unit must move to page 2.
    const paras: ParaLayout[] = [
      { index: 0, height: 60, blockId: 'a' },
      { index: 1, height: 30, blockId: 'b', keepWithNext: true },
      { index: 2, height: 30, blockId: 'b' },
    ]
    const r = paginate(paras, M)
    expect(pageOf(r, 0)).toBe(1)
    expect(pageOf(r, 1)).toBe(2)
    expect(pageOf(r, 2)).toBe(2) // stayed with para1 — not split
    expect(r.pages).toHaveLength(2)
  })

  it('would split the same paragraphs if they were NOT glued (control)', () => {
    const paras: ParaLayout[] = [
      { index: 0, height: 60, blockId: 'a' },
      { index: 1, height: 30, blockId: 'b' }, // no keepWithNext
      { index: 2, height: 30, blockId: 'b' },
    ]
    const r = paginate(paras, M)
    expect(pageOf(r, 1)).toBe(1) // fits on page 1 (60+30=90)
    expect(pageOf(r, 2)).toBe(2)
  })

  it('flags a block taller than a page as overflow and still draws the break', () => {
    const paras: ParaLayout[] = [
      { index: 0, height: 40, blockId: 'a' },
      { index: 1, height: 150, blockId: 'huge' }, // taller than contentHeight
    ]
    const r = paginate(paras, M)
    expect(r.overflow).toContain('huge')
    expect(pageOf(r, 0)).toBe(1)
    expect(pageOf(r, 1)).toBe(2) // oversized block starts clean on its own page
  })

  it('forces a new page on page-break-before', () => {
    const paras: ParaLayout[] = [
      { index: 0, height: 50, blockId: 'a' },
      { index: 1, height: 50, blockId: 'b', pageBreakBefore: true },
    ]
    const r = paginate(paras, M)
    expect(pageOf(r, 0)).toBe(1)
    expect(pageOf(r, 1)).toBe(2) // would fit (50+50=100) but forced to new page
  })

  it('does not emit a leading blank page when the first paragraph has page-break-before', () => {
    const paras: ParaLayout[] = [{ index: 0, height: 50, blockId: 'a', pageBreakBefore: true }]
    const r = paginate(paras, M)
    expect(r.pages).toHaveLength(1)
    expect(r.pages[0].pageNo).toBe(1)
  })

  it('lets page-break-before override an upstream keep-with-next glue', () => {
    const paras: ParaLayout[] = [
      { index: 0, height: 20, blockId: 'a', keepWithNext: true },
      { index: 1, height: 20, blockId: 'b', pageBreakBefore: true },
    ]
    const r = paginate(paras, M)
    expect(pageOf(r, 0)).toBe(1)
    expect(pageOf(r, 1)).toBe(2) // not glued — the break wins
  })

  it('assigns a multi-page document correctly and tracks vertical offsets', () => {
    // 5 paragraphs of height 40 → pages hold 2 each (2*40=80 ≤ 100, 3*40=120 > 100).
    const paras: ParaLayout[] = [0, 1, 2, 3, 4].map((i) => ({
      index: i,
      height: 40,
      blockId: 'x',
    }))
    const r = paginate(paras, M)
    expect(r.pages).toHaveLength(3)
    expect(r.pages[0].segments.map((s) => s.index)).toEqual([0, 1])
    expect(r.pages[1].segments.map((s) => s.index)).toEqual([2, 3])
    expect(r.pages[2].segments.map((s) => s.index)).toEqual([4])
    // vertical offsets reset per page
    expect(r.pages[0].segments.map((s) => s.top)).toEqual([0, 40])
    expect(r.pages[1].segments.map((s) => s.top)).toEqual([0, 40])
  })

  it('reports no overflow when every block fits', () => {
    const paras: ParaLayout[] = [{ index: 0, height: 50, blockId: 'a' }]
    expect(paginate(paras, M).overflow).toEqual([])
  })
})
