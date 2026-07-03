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
