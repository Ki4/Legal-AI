/**
 * insertAtCursor.ts — pure textarea-editing helpers for the template editor
 * toolbar (specs/features/template-editor §4a).
 *
 * All functions take the current text + selection offsets and return the new
 * text plus the caret position to restore. No DOM access — the component reads
 * selectionStart/selectionEnd from the ref and applies the result.
 *
 * DSL context: {{!style: …}} directives must stand ALONE on their own line
 * (render-document.js treats each '\n'-separated line as a paragraph), hence
 * insertLineBefore / wrapSelection operate on whole lines.
 */

export interface EditResult {
  text: string
  caret: number
}

/** Replace the selection (or insert at the caret) with `snippet`; caret lands after it. */
export function insertSnippet(
  text: string,
  selStart: number,
  selEnd: number,
  snippet: string,
): EditResult {
  const next = text.slice(0, selStart) + snippet + text.slice(selEnd)
  return { text: next, caret: selStart + snippet.length }
}

/**
 * Insert `line` as a standalone line immediately BEFORE the paragraph that
 * contains selStart. The caret keeps its original text position (shifted by
 * the inserted length) so typing continues where the user was.
 */
export function insertLineBefore(text: string, selStart: number, line: string): EditResult {
  // Start of the current paragraph: right after the last '\n' left of selStart.
  const lineStart = text.lastIndexOf('\n', selStart - 1) + 1
  const inserted = line + '\n'
  const next = text.slice(0, lineStart) + inserted + text.slice(lineStart)
  return { text: next, caret: selStart + inserted.length }
}

/**
 * Wrap the EXACT selection in an inline pair (styleHints v2 runs, S2-B):
 * `Позивач: {{#bold}}{{plaintiff_name}}{{/bold}}` — no line juggling, offsets
 * as selected. Caret lands right after `close` so typing continues unstyled.
 * Callers guard against an empty selection (nothing to wrap).
 */
export function wrapInline(
  text: string,
  selStart: number,
  selEnd: number,
  open: string,
  close: string,
): EditResult {
  const from = Math.min(selStart, selEnd)
  const to = Math.max(selStart, selEnd)
  const next = text.slice(0, from) + open + text.slice(from, to) + close + text.slice(to)
  return { text: next, caret: to + open.length + close.length }
}

/**
 * Wrap whole paragraphs in a paired range macro: `open` goes on its own line
 * before the paragraph containing selStart, `close` on its own line after the
 * paragraph containing selEnd. A collapsed selection wraps just the current
 * paragraph. Caret lands at the end of the wrapped content (before `close`).
 */
export function wrapSelection(
  text: string,
  selStart: number,
  selEnd: number,
  open: string,
  close: string,
): EditResult {
  // Normalize a backwards selection defensively (DOM never yields one, but pure fn).
  const from = Math.min(selStart, selEnd)
  const to = Math.max(selStart, selEnd)

  const blockStart = text.lastIndexOf('\n', from - 1) + 1
  const eol = text.indexOf('\n', to)
  const blockEnd = eol === -1 ? text.length : eol

  const middle = text.slice(blockStart, blockEnd)
  const next =
    text.slice(0, blockStart) + open + '\n' + middle + '\n' + close + text.slice(blockEnd)
  return { text: next, caret: blockStart + open.length + 1 + middle.length }
}
