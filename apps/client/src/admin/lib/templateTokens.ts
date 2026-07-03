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

/** Style keywords of a {{!style: …}} tag ('center', 'bold', '/keep-block', …). */
export function styleKeywordsOf(text: string, token: TemplateToken): string[] {
  const inner = text.slice(token.from + 2, token.to - 2).trim()
  return inner
    .replace(/^!style:?/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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
    if (inner.startsWith('!style')) {
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
