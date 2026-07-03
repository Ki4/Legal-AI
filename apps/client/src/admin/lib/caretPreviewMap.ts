// S2 slice C (specs/features/template-editor §5b): map the caret's template
// line to the paragraph index of the rendered preview. Engine-injectable (same
// pattern as templateGate) — unit tests load the real doc-engine via
// createRequire, the UI binds the '@doc-engine' alias in
// documentPreview.mapCaretToParagraph.
//
// Method: append a private-use sentinel char to the nearest EMITTING template
// line (findEmittingLine) and re-render with the SAME context as the visible
// preview — whatever output paragraph the sentinel lands in is the caret's
// paragraph. The engine itself resolves ifs/eachs/directives, so the mapping
// can never drift from the real render. Fail-soft by design: a parse error or
// a swallowed sentinel (e.g. a false {{#if}} branch) → null → no highlight.

import { findEmittingLine } from './templateTokens'

/** Private-use codepoint — can never occur in legal document text. */
export const CARET_SENTINEL = '\uE000'

export function mapLineToRenderedParagraph(
  render: (template: string) => { text: string },
  template: string,
  line: number,
): number | null {
  const host = findEmittingLine(template, line)
  if (host === null) return null
  const lines = template.split('\n')
  lines[host] += CARET_SENTINEL
  try {
    const { text } = render(lines.join('\n'))
    const idx = text.split('\n').findIndex((l) => l.includes(CARET_SENTINEL))
    return idx === -1 ? null : idx
  } catch {
    return null
  }
}
