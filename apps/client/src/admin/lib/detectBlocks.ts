// document-layout-preview G2 — deterministic block recognition (issue #84).
//
// detectBlocks(text, styleHints) → the 8 canonical claim blocks (blockRegistry)
// as paragraph ranges, each tagged with its integrity relation. Boundaries come
// from ANCHORS in the rendered document (headings / «ПРОШУ» / «Додатки:» / the
// first statute citation) + keep-with-next ranges in styleHints — never fragile
// fixed line numbers. Same deterministic approach as preview-excerpt.js /
// citations.mjs (requirements §4).
//
// Fail-closed (requirements §4, invariant): any line not covered by a
// recognized canonical block becomes an `unknown` block. On template drift the
// function degrades to labeling less (or a single `unknown` spanning the doc) —
// it never throws and never guesses boundaries.

import { CANONICAL_BLOCKS, relationOf, type RelationId } from './blockRegistry'

/** A recognized (or unknown) segment of the document, in paragraph units. */
export interface DetectedBlock {
  /** Canonical block id from the registry, or 'unknown' for undetected spans. */
  id: string
  /** Ukrainian label (from registry; 'Нерозпізнано' for unknown). */
  label: string
  /** 0-based paragraph (line) index where the block starts (inclusive). */
  startPara: number
  /** 0-based paragraph (line) index where the block ends (inclusive). */
  endPara: number
  /** Integrity relation covering the block, or null. */
  relation: RelationId | null
  /** Highlight colour (from registry; neutral grey for unknown). */
  color: string
}

const UNKNOWN_LABEL = 'Нерозпізнано'
const UNKNOWN_COLOR = '#94A3B8' // slate-400

// ── Anchor patterns (reused / mirrored from preview-excerpt.js) ──────────────
const COURT_RE = /^\s*До суду/
const PARTIES_RE = /^\s*Позивач\s*[:：]/
const TITLE_RE = /^\s*ПОЗОВНА ЗАЯВА/
// First statute citation — same rule that preview-excerpt cuts on. Marks the
// start of the legal-basis zone. Case-insensitive; "ст.105" / "ст. 180".
const CITATION_RE = /ст\.?\s*\d/i
// «ПРОШУ» operative header, rendered spaced as "П Р О Ш У".
const PROSHU_RE = /П\s*Р\s*О\s*Ш\s*У/
const APPENDICES_RE = /^\s*Додатки\s*:/
// Trailing date + signature line (golden renders "… (підпис)  Name").
const SIGNATURE_RE = /підпис/i

const labelOf = (id: string) => CANONICAL_BLOCKS.find((b) => b.id === id)?.label ?? id
const colorOf = (id: string) => CANONICAL_BLOCKS.find((b) => b.id === id)?.color ?? UNKNOWN_COLOR

/** First index at/after `from` whose line matches `re`, or -1. */
function findFrom(lines: string[], re: RegExp, from: number): number {
  for (let i = Math.max(0, from); i < lines.length; i++) {
    if (re.test(lines[i])) return i
  }
  return -1
}

/**
 * Relation covering a block's paragraph range, from the engine's styleHints.
 * A block is `keep-together` if any of its paragraphs carries keep-with-next OR
 * the paragraph immediately before it does (glued in from the previous block —
 * this is how `signature` joins the `appendices` keep-block unit). Precedence
 * follows relationOf: page-break-before wins over keep-together.
 */
function relationForRange(
  styleHints: Record<number, string[]>,
  start: number,
  end: number,
): RelationId | null {
  if (relationOf(styleHints[start]) === 'page-break-before') return 'page-break-before'
  const gluedInFromPrev = start > 0 && (styleHints[start - 1]?.includes('keep-with-next') ?? false)
  if (gluedInFromPrev) return 'keep-together'
  for (let p = start; p <= end; p++) {
    if (relationOf(styleHints[p]) === 'keep-together') return 'keep-together'
  }
  return null
}

/**
 * Detect the canonical blocks of a rendered claim.
 * @param text        fully rendered document (renderDocumentWithStyles output).
 * @param styleHints  per-paragraph style keywords, keyed by 0-based line index.
 * @returns contiguous blocks covering every paragraph (gaps → `unknown`).
 */
export function detectBlocks(
  text: string,
  styleHints: Record<number, string[]> = {},
): DetectedBlock[] {
  if (!text || typeof text !== 'string') return []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const last = lines.length - 1

  // Locate anchors in document order; each search starts after the previous hit
  // (or 0 when the previous anchor is absent) to keep results monotonic.
  const from = (idx: number) => (idx >= 0 ? idx + 1 : 0)
  const courtIdx = findFrom(lines, COURT_RE, 0)
  const partiesIdx = findFrom(lines, PARTIES_RE, from(courtIdx))
  const titleIdx = findFrom(lines, TITLE_RE, from(partiesIdx))
  const citationIdx = findFrom(lines, CITATION_RE, from(titleIdx))
  const proshuIdx = findFrom(lines, PROSHU_RE, from(citationIdx))
  const appendicesIdx = findFrom(lines, APPENDICES_RE, from(proshuIdx))
  const signatureIdx = findFrom(lines, SIGNATURE_RE, from(appendicesIdx))

  // circumstances has no anchor of its own: it sits between the doc-title block
  // and the first citation. Start = first non-blank line after the title's
  // contiguous non-blank run; valid only if it lands before the citation.
  let circStart = -1
  if (titleIdx >= 0) {
    let titleEnd = titleIdx
    while (titleEnd + 1 <= last && lines[titleEnd + 1].trim() !== '') titleEnd++
    let k = titleEnd + 1
    while (k <= last && lines[k].trim() === '') k++
    if (k <= last && (citationIdx < 0 || k < citationIdx)) circStart = k
  }

  // Ordered candidate markers (id → start line); keep only found + strictly
  // increasing ones (drops any anchor that landed out of order on drift).
  const candidates: Array<{ id: string; start: number }> = [
    { id: 'court_header', start: courtIdx },
    { id: 'parties', start: partiesIdx },
    { id: 'doc_title', start: titleIdx },
    { id: 'circumstances', start: circStart },
    { id: 'legal_basis', start: citationIdx },
    { id: 'petition', start: proshuIdx },
    { id: 'appendices', start: appendicesIdx },
    { id: 'signature', start: signatureIdx },
  ]
  const markers: Array<{ id: string; start: number }> = []
  for (const c of candidates) {
    if (c.start < 0) continue
    if (markers.length && c.start <= markers[markers.length - 1].start) continue
    markers.push(c)
  }

  // Emit contiguous blocks covering [0..last]; any uncovered leading/interior
  // gap becomes an `unknown` block. Trailing coverage: last marker → last line.
  const out: DetectedBlock[] = []
  const push = (id: string, start: number, end: number, isUnknown: boolean) => {
    if (start > end) return
    out.push({
      id: isUnknown ? 'unknown' : id,
      label: isUnknown ? UNKNOWN_LABEL : labelOf(id),
      startPara: start,
      endPara: end,
      relation: relationForRange(styleHints, start, end),
      color: isUnknown ? UNKNOWN_COLOR : colorOf(id),
    })
  }

  if (markers.length === 0) {
    push('unknown', 0, last, true)
    return out
  }

  if (markers[0].start > 0) push('unknown', 0, markers[0].start - 1, true)
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].start
    const end = i + 1 < markers.length ? markers[i + 1].start - 1 : last
    push(markers[i].id, start, end, false)
  }
  return out
}
