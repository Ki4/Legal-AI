// S2 slice A (specs/features/template-editor §5b): pure scanner that classifies
// every {{…}} tag of a template by kind. Engine-free and DOM-free — the single
// source for CodeMirror decorations, unit-tested against real template idioms.
// The scanner NEVER mutates or normalizes the text: positions index into the
// exact string the engine will render (DSL = SSoT, invariant 1).

export type TokenKind =
  /** {{! … }} — authoring comment, stripped by the engine. */
  | 'comment'
  /** {{!style: …}} — per-paragraph style directive. */
  | 'style'
  /** {{#if}} / {{else}} / {{/if}} / {{#each}} / {{/each}} — control flow. */
  | 'logic'
  /** {{path}} — plain interpolation of a single field/context path. */
  | 'var'
  /** {{helper arg …}} — helper call or any other expression. */
  | 'helper'

export interface TemplateToken {
  /** Absolute char offset of '{{' (inclusive). */
  from: number
  /** Absolute char offset just past '}}' (exclusive). */
  to: number
  kind: TokenKind
  /** For 'var': the root segment of the path (before the first dot). Keeps a
   *  leading '@' for each-scope helpers ('@index1') so consumers can tell them
   *  from form fields. */
  name?: string
}

const TAG_RE = /\{\{([^{}]*)\}\}/g
// A plain interpolation: one dotted path, optionally rooted in an each-scope
// helper (@index / @first / …). Anything with spaces/operators is a 'helper'.
const VAR_RE = /^@?[A-Za-z_][\w]*(?:\.[\w@]+)*$/

/** A matched {{#if}}/{{#each}} … {{/if}}/{{/each}} pair (absolute offsets). */
export interface TemplateBlock {
  kind: 'if' | 'each'
  openFrom: number
  openTo: number
  closeFrom: number
  closeTo: number
}

/**
 * Match control-flow blocks of a template. Tolerant by design (an editor
 * decorates half-written templates constantly): unclosed opens and stray
 * closes are silently dropped, a close pops the NEAREST open of its kind —
 * never throws. The parse GATE, not this scanner, is what blocks publishing.
 */
export function matchTemplateBlocks(text: string): TemplateBlock[] {
  const stack: Array<{ kind: 'if' | 'each'; from: number; to: number }> = []
  const out: TemplateBlock[] = []
  for (const t of scanTemplateTokens(text)) {
    if (t.kind !== 'logic') continue
    const inner = text.slice(t.from + 2, t.to - 2).trim()
    if (inner.startsWith('#if')) {
      stack.push({ kind: 'if', from: t.from, to: t.to })
    } else if (inner.startsWith('#each')) {
      stack.push({ kind: 'each', from: t.from, to: t.to })
    } else if (inner.startsWith('/if') || inner.startsWith('/each')) {
      const kind = inner.startsWith('/if') ? 'if' : 'each'
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].kind === kind) {
          const open = stack[i]
          stack.length = i
          out.push({ kind, openFrom: open.from, openTo: open.to, closeFrom: t.from, closeTo: t.to })
          break
        }
      }
    }
  }
  return out.sort((a, b) => a.openFrom - b.openFrom)
}

/** An inline run {{#bold}}…{{/bold}} (+italic/underline) — absolute offsets. */
export interface TemplateRun {
  style: 'bold' | 'italic' | 'underline'
  openFrom: number
  openTo: number
  closeFrom: number
  closeTo: number
}

const RUN_STYLES = ['bold', 'italic', 'underline'] as const

/**
 * Match inline style runs (styleHints v2). Tolerant like matchTemplateBlocks:
 * unclosed opens and stray closes are dropped, a close pops the NEAREST open of
 * its style — the parse gate, not this scanner, blocks broken runs.
 */
export function matchTemplateRuns(text: string): TemplateRun[] {
  const stack: Array<{ style: TemplateRun['style']; from: number; to: number }> = []
  const out: TemplateRun[] = []
  for (const t of scanTemplateTokens(text)) {
    if (t.kind !== 'logic') continue
    const inner = text.slice(t.from + 2, t.to - 2).trim()
    const open = RUN_STYLES.find((s) => inner === `#${s}`)
    const close = RUN_STYLES.find((s) => inner === `/${s}`)
    if (open) {
      stack.push({ style: open, from: t.from, to: t.to })
    } else if (close) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].style === close) {
          const o = stack[i]
          stack.length = i
          out.push({ style: close, openFrom: o.from, openTo: o.to, closeFrom: t.from, closeTo: t.to })
          break
        }
      }
    }
  }
  return out.sort((a, b) => a.openFrom - b.openFrom)
}

/** Style keywords of a {{!style: …}} tag ('center', 'bold', '/keep-block', …). */
export function styleKeywordsOf(text: string, token: TemplateToken): string[] {
  const inner = text.slice(token.from + 2, token.to - 2).trim()
  return inner
    .replace(/^!style:?/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Find the template line whose text actually reaches the rendered output,
 * starting at `line`: forward first (natural for a style directive — it styles
 * the paragraph BELOW it), then backward, else null. A line is skipped when its
 * content is nothing but comment/style/logic tags (standalone tags — the engine
 * swallows the whole line) or when a tag spanning multiple lines crosses it
 * (no safe place to host extra text). A blank line qualifies: it renders as an
 * empty paragraph.
 */
export function findEmittingLine(text: string, line: number): number | null {
  const lines = text.split('\n')
  if (line < 0 || line >= lines.length) return null
  const tokens = scanTemplateTokens(text)
  const starts: number[] = []
  let acc = 0
  for (const l of lines) {
    starts.push(acc)
    acc += l.length + 1
  }
  const nonEmitting = (k: TokenKind) => k === 'comment' || k === 'style' || k === 'logic'
  const emits = (i: number): boolean => {
    const from = starts[i]
    const to = from + lines[i].length
    const overlapping = tokens.filter((t) => t.from < to && t.to > from)
    if (overlapping.some((t) => t.from < from || t.to > to)) return false // mid multi-line tag
    if (overlapping.some((t) => !nonEmitting(t.kind))) return true // {{var}}/{{helper}} emit text
    if (overlapping.length === 0) return true // plain (possibly blank) line
    // Only non-emitting tags: the line survives iff any plain text sits around them.
    let rest = ''
    let cursor = from
    for (const t of overlapping) {
      rest += text.slice(cursor, t.from)
      cursor = t.to
    }
    rest += text.slice(cursor, to)
    return rest.trim() !== ''
  }
  for (let i = line; i < lines.length; i++) if (emits(i)) return i
  for (let i = line - 1; i >= 0; i--) if (emits(i)) return i
  return null
}

/** Scan a template into classified {{…}} tokens, in document order. */
export function scanTemplateTokens(text: string): TemplateToken[] {
  const out: TemplateToken[] = []
  if (!text) return out
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(text)) !== null) {
    const inner = m[1].trim()
    const from = m.index
    const to = m.index + m[0].length
    if (inner.startsWith('!style:')) {
      // The engine requires the colon (render-document.js `'!style:'`) — a
      // colon-less {{!styleXYZ}} is a plain comment to it, so mirror that here.
      out.push({ from, to, kind: 'style' })
    } else if (inner.startsWith('!')) {
      out.push({ from, to, kind: 'comment' })
    } else if (inner.startsWith('#') || inner.startsWith('/') || /^else\b/.test(inner)) {
      out.push({ from, to, kind: 'logic' })
    } else if (VAR_RE.test(inner)) {
      out.push({ from, to, kind: 'var', name: inner.split('.')[0] })
    } else {
      out.push({ from, to, kind: 'helper' })
    }
  }
  return out
}
