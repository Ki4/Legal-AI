import { useCallback, useMemo, useState } from 'react'
import { renderLayout } from '../lib/documentPreview'
import { sampleAnswersFor } from '../lib/sampleAnswers'
import { detectBlocks, type DetectedBlock } from '../lib/detectBlocks'
import { paginate, type ParaLayout } from '../lib/paginate'
import { RELATIONS, type RelationId } from '../lib/blockRegistry'
import { styleClasses } from '../lib/documentStyles'
import { LayoutGuide } from './LayoutGuide'

// A4 page rendered at a compact preview scale. Page width, margins (ДСТУ-orient:
// 30/15/20/20 мм) and font are all in one consistent px space, so pagination
// reflects exactly what is drawn on screen (fidelity is advisory — see caveat).
const PAGE_W = 480
const PAGE_H = Math.round((PAGE_W * 297) / 210) // A4 portrait ratio
const MM = PAGE_W / 210 // px per mm at this scale
const MARGIN = { top: 20 * MM, right: 15 * MM, bottom: 20 * MM, left: 30 * MM }
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right
const CONTENT_H = PAGE_H - MARGIN.top - MARGIN.bottom
const FONT_PX = 11.5
const LINE_H = 1.55
const PARA_PAD_LEFT = 6
const PARA_BORDER = 3

const REL_COLOR = Object.fromEntries(RELATIONS.map((r) => [r.id, r.color])) as Record<
  RelationId,
  string
>

function rgba(hex: string, a: number): string {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** Shared per-paragraph box style (same in the hidden measurer and the pages,
 *  so measured heights match rendered heights). */
function paraStyle(block: DetectedBlock | undefined): React.CSSProperties {
  const relColor = block?.relation ? REL_COLOR[block.relation] : null
  return {
    borderLeft: `${PARA_BORDER}px solid ${block?.color ?? 'transparent'}`,
    backgroundColor: relColor ? rgba(relColor, 0.1) : undefined,
    paddingLeft: PARA_PAD_LEFT,
  }
}

/**
 * Read-only page-aware layout preview (#84, G4). Renders the REAL document
 * (doc-engine + sampleAnswers) into simulated A4 pages, honouring the engine's
 * keep-with-next / page-break-before so integrity relations show their true
 * effect (appendices + signature ride together). Highlights blocks by colour,
 * warns on blocks taller than a page, and always shows the "наближено" caveat.
 */
export function DocumentLayoutPreview({
  template,
  slug,
  heightsForTest,
}: {
  template: string | null
  slug?: string | null
  /** Test seam: inject per-paragraph heights instead of DOM measurement (jsdom
   *  reports 0 heights). Undefined in production → real getBoundingClientRect. */
  heightsForTest?: number[]
}) {
  const sample = useMemo(() => sampleAnswersFor(slug), [slug])
  const answers = useMemo(() => sample ?? {}, [sample])
  const layout = useMemo(() => (template ? renderLayout(template, answers) : null), [template, answers])

  const text = layout?.ok ? layout.text : ''
  const styleHints = useMemo<Record<number, string[]>>(
    () => (layout?.ok ? layout.styleHints : {}),
    [layout],
  )
  const paragraphs = useMemo(() => (text ? text.split('\n') : []), [text])
  const blocks = useMemo(() => detectBlocks(text, styleHints), [text, styleHints])

  const paraToBlock = useMemo(() => {
    const m: (DetectedBlock | undefined)[] = new Array(paragraphs.length)
    for (const b of blocks) for (let p = b.startPara; p <= b.endPara; p++) m[p] = b
    return m
  }, [blocks, paragraphs.length])

  // Measure paragraph heights via a stable callback ref (no effect + setState
  // cascade): it fires on mount and, because the measurer is keyed by `text`,
  // again whenever the document changes. Tests inject heights directly.
  const [measured, setMeasured] = useState<number[]>([])
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    setMeasured(Array.from(el.children).map((c) => (c as HTMLElement).getBoundingClientRect().height))
  }, [])
  const heights = heightsForTest ?? measured

  const paras: ParaLayout[] = useMemo(
    () =>
      paragraphs.map((_, i) => ({
        index: i,
        height: heights[i] ?? 0,
        keepWithNext: styleHints[i]?.includes('keep-with-next'),
        pageBreakBefore: styleHints[i]?.includes('page-break-before'),
        blockId: paraToBlock[i]?.id,
      })),
    [paragraphs, heights, styleHints, paraToBlock],
  )
  const pagination = useMemo(() => paginate(paras, { contentHeight: CONTENT_H }), [paras])

  const overflowLabels = useMemo(
    () => pagination.overflow.map((id) => blocks.find((b) => b.id === id)?.label ?? id),
    [pagination.overflow, blocks],
  )

  if (!template) {
    return (
      <div className="text-center py-12 text-inkMute text-sm">
        Ця послуга ще не має шаблону документа — розкладка недоступна.
      </div>
    )
  }
  if (layout && !layout.ok) {
    return (
      <div className="text-center py-12 text-danger text-sm">
        Не вдалося відрендерити розкладку: {layout.error}
      </div>
    )
  }

  return (
    <div>
      <p className="text-[12.5px] text-inkMute mb-3">
        Так документ лягає по сторінках A4. Кольорові смужки — блоки документа; підсвічені —
        частини, що тримаються разом (не розриваються між сторінками).
      </p>

      {/* Caveat — fidelity is advisory (invariant 4, always visible) */}
      <p className="text-[11.5px] text-inkMute bg-paperAlt border border-line rounded-lg px-3 py-2 mb-4">
        <span aria-hidden>≈ </span>
        <span className="font-semibold">Наближено</span> — точна пагінація залежить від рушія (Google
        Docs). Канонічний вигляд — згенерований документ.
      </p>

      {overflowLabels.length > 0 && (
        <div
          role="alert"
          className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-xl px-3 py-2.5 mb-4"
        >
          ⚠ Блок вищий за сторінку — рушій розірве його: {overflowLabels.join(', ')}.
        </div>
      )}

      {/* Hidden measurer: paragraphs at content width, same box as the pages. */}
      <div
        key={text}
        aria-hidden
        ref={measureRef}
        className="font-serif"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          left: -99999,
          top: 0,
          width: CONTENT_W,
          fontSize: FONT_PX,
          lineHeight: LINE_H,
        }}
      >
        {paragraphs.map((p, i) => (
          <div key={i} style={{ paddingLeft: PARA_PAD_LEFT, borderLeft: `${PARA_BORDER}px solid transparent` }}>
            {p || ' '}
          </div>
        ))}
      </div>

      {/* A4 pages */}
      <div className="bg-paperAlt/60 rounded-xl p-4 md:p-6 max-h-[75vh] overflow-y-auto flex flex-col items-center gap-5">
        {pagination.pages.map((pg) => (
          <div
            key={pg.pageNo}
            className="bg-paper shadow-card relative flex-none"
            style={{
              width: PAGE_W,
              minHeight: PAGE_H,
              paddingTop: MARGIN.top,
              paddingRight: MARGIN.right,
              paddingBottom: MARGIN.bottom,
              paddingLeft: MARGIN.left,
            }}
          >
            <div className="font-serif text-ink" style={{ fontSize: FONT_PX, lineHeight: LINE_H }}>
              {pg.segments.map((s) => (
                <div key={s.index} className={styleClasses(styleHints[s.index]) || undefined} style={paraStyle(paraToBlock[s.index])}>
                  {paragraphs[s.index] || ' '}
                </div>
              ))}
            </div>
            <span className="absolute bottom-1.5 right-2.5 text-[10px] text-inkMute">
              {pg.pageNo}
            </span>
          </div>
        ))}
      </div>

      <LayoutGuide />
    </div>
  )
}
