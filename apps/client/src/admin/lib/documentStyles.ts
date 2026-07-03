// Pure helpers for the document preview: map doc-engine {{!style: …}} hints to
// CSS classes and split rendered text into styled paragraphs.
// Kept engine-free so it is unit-testable without the '@doc-engine' alias.

/** A rendered paragraph: its text + the CSS classes derived from style hints. */
export interface PreviewParagraph {
  text: string
  className: string
  /** Inline run segments (styleHints v2). Present only when the paragraph has
   *  {{#bold}}-style runs; segments concatenate back to exactly `text`. */
  segments?: PreviewSegment[]
}

/** A slice of a paragraph with its inline (character-level) style classes. */
export interface PreviewSegment {
  text: string
  className: string
}

/** An inline run as produced by the engine (offsets relative to the paragraph). */
export interface StyleRun {
  start: number
  end: number
  styles: string[]
}

const RUN_CLASSES: Record<string, string> = {
  bold: 'font-semibold',
  italic: 'italic',
  underline: 'underline',
}

/**
 * Split a paragraph into inline-styled segments from its runs. Overlapping runs
 * compose (bold + italic on the intersection). Invariant: concatenated segment
 * texts === line (runs never mutate text — worst failure is a lost style).
 */
export function toSegments(line: string, runs: StyleRun[]): PreviewSegment[] {
  // Character boundaries where the active style set changes.
  const cuts = new Set<number>([0, line.length])
  for (const r of runs) {
    cuts.add(Math.max(0, Math.min(r.start, line.length)))
    cuts.add(Math.max(0, Math.min(r.end, line.length)))
  }
  const points = [...cuts].sort((a, b) => a - b)
  const segments: PreviewSegment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    if (to <= from) continue
    const classes = new Set<string>()
    for (const r of runs) {
      if (r.start <= from && r.end >= to) {
        for (const kw of r.styles) {
          const cls = RUN_CLASSES[kw]
          if (cls) classes.add(cls)
        }
      }
    }
    segments.push({ text: line.slice(from, to), className: [...classes].join(' ') })
  }
  return segments
}

/** Map doc-engine {{!style: …}} keywords to Tailwind classes for on-screen preview.
 *  Print-layout-only hints (keep-with-next / keep-together / page-break) have no
 *  visual effect here and are intentionally ignored. */
export function styleClasses(keywords: string[] | undefined): string {
  if (!keywords || keywords.length === 0) return ''
  const out: string[] = []
  for (const k of keywords) {
    switch (k) {
      case 'center': out.push('text-center'); break
      case 'right': out.push('text-right'); break
      case 'bold': out.push('font-semibold'); break
      case 'italic': out.push('italic'); break
      case 'indent': out.push('indent-8'); break
      default: break
    }
  }
  return out.join(' ')
}

/** Split rendered text into paragraphs and attach each paragraph's style classes.
 *  When styleRuns are provided, paragraphs with runs also carry inline segments. */
export function toParagraphs(
  text: string,
  styleHints: Record<number, string[]>,
  styleRuns?: Record<number, StyleRun[]>,
): PreviewParagraph[] {
  return text.split('\n').map((line, i) => {
    const runs = styleRuns?.[i]
    return {
      text: line,
      className: styleClasses(styleHints[i]),
      ...(runs && runs.length ? { segments: toSegments(line, runs) } : {}),
    }
  })
}
