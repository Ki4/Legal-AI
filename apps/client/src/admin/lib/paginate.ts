// document-layout-preview G3 — deterministic pagination engine (issue #84).
//
// paginate(paras, metrics) assigns rendered paragraphs to A4 pages, honouring
// the SAME primitive production uses — the engine's per-paragraph
// `keep-with-next` chains and `page-break-before` (requirements invariant 5).
// Blocks are only a labeling overlay (carried through as blockId); pagination
// itself reasons about paragraphs, so the preview shows the REAL effect of
// keep-block (appendices + signature ride together) rather than a re-derived
// block rule.
//
// Heights are INJECTED (measured by the component via getBoundingClientRect;
// mocked in tests) so this module stays pure and deterministic.

/** One rendered paragraph's layout input. */
export interface ParaLayout {
  /** 0-based paragraph (line) index in the rendered document. */
  index: number
  /** Measured height in the same unit as PageMetrics.contentHeight. */
  height: number
  /** Glue this paragraph to the next (from styleHints keep-with-next). */
  keepWithNext?: boolean
  /** Force a page break before this paragraph (from styleHints). */
  pageBreakBefore?: boolean
  /** Owning canonical block id (for highlighting + overflow reporting). */
  blockId?: string
}

export interface PageMetrics {
  /** Usable content height per page (page height minus top+bottom margins). */
  contentHeight: number
}

/** A paragraph placed on a page, with its vertical offset. */
export interface PlacedPara {
  index: number
  blockId?: string
  /** Vertical offset from the top of the page content area. */
  top: number
  height: number
}

export interface Page {
  /** 1-based page number. */
  pageNo: number
  segments: PlacedPara[]
}

export interface PaginationResult {
  pages: Page[]
  /** Block ids whose keep-together unit is taller than one page (engine will
   *  split them — the preview flags this honestly, requirements §2.2). */
  overflow: string[]
}

/**
 * Group paragraphs into keep-units: a maximal run glued by keep-with-next. A
 * `page-break-before` on the next paragraph overrides the glue (it must start a
 * new page), so the run ends there — matching relationOf's precedence.
 */
function buildGroups(paras: ParaLayout[]): number[][] {
  const groups: number[][] = []
  let i = 0
  while (i < paras.length) {
    const group = [i]
    let j = i
    while (
      paras[j].keepWithNext &&
      j + 1 < paras.length &&
      !paras[j + 1].pageBreakBefore
    ) {
      j++
      group.push(j)
    }
    groups.push(group)
    i = j + 1
  }
  return groups
}

/**
 * Lay paragraphs onto pages.
 * @param paras   paragraphs in document order, with injected heights + hints.
 * @param metrics page content height.
 */
export function paginate(paras: ParaLayout[], metrics: PageMetrics): PaginationResult {
  if (!paras || paras.length === 0) return { pages: [], overflow: [] }
  const { contentHeight } = metrics

  const groups = buildGroups(paras)
  const overflow = new Set<string>()

  const pages: Page[] = [{ pageNo: 1, segments: [] }]
  let page = pages[0]
  let y = 0
  const newPage = () => {
    page = { pageNo: page.pageNo + 1, segments: [] }
    pages.push(page)
    y = 0
  }
  const groupHeight = (g: number[]) => g.reduce((s, idx) => s + paras[idx].height, 0)

  for (const g of groups) {
    const first = paras[g[0]]
    if (first.pageBreakBefore && page.segments.length > 0) newPage()

    const gh = groupHeight(g)
    const oversized = gh > contentHeight
    if (oversized) {
      // Taller than a page: start it clean on a fresh page (if current has
      // content) and let it overflow the boundary — an honest break, not silent.
      if (page.segments.length > 0) newPage()
    } else if (y + gh > contentHeight && page.segments.length > 0) {
      // Whole group doesn't fit → move it as a unit to the next page.
      newPage()
    }

    for (const idx of g) {
      const p = paras[idx]
      page.segments.push({ index: idx, blockId: p.blockId, top: y, height: p.height })
      y += p.height
    }

    if (oversized) {
      for (const idx of g) if (paras[idx].blockId) overflow.add(paras[idx].blockId as string)
      // y now exceeds contentHeight → the next group is forced onto a new page.
    }
  }

  return { pages, overflow: [...overflow] }
}
