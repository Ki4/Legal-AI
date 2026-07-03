import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CARET_SENTINEL, mapLineToRenderedParagraph } from '../caretPreviewMap'

// Load the REAL doc-engine (the '@doc-engine' vite alias is unavailable under
// `vitest run`) — the caret↔paragraph mapping must ride the production render,
// exactly like documentPreview.mapCaretToParagraph does in the UI.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
const require = createRequire(import.meta.url)
const engine = require(resolve(repoRoot, 'n8n/templates/render-document.js'))

const renderWith =
  (answers: Record<string, unknown> = {}) =>
  (tpl: string) =>
    engine.renderDocumentWithStyles(tpl, engine.buildContext(answers, {}))

// NB: branch/list keys must NOT collide with buildContext's computed layer
// (has_children/children are recomputed from children_details and shadow raw
// answers) — plain pass-through keys keep the test about the MAPPING.
const TPL = [
  '{{!style: center bold}}', // 0 — swallowed, styles line 1
  'ПОЗОВНА ЗАЯВА', // 1 → paragraph 0
  '{{! авторський коментар }}', // 2 — swallowed
  '', // 3 → paragraph 1 (blank)
  '{{#if urgent}}', // 4 — swallowed
  'Терміново: {{urgent_reason}}', // 5 → paragraph 2 only when urgent
  '{{/if}}', // 6 — swallowed
  'Підпис', // 7 → last paragraph
].join('\n')

describe('mapLineToRenderedParagraph — caret line → preview paragraph (real engine)', () => {
  it('maps a content line to its rendered paragraph', () => {
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 1)).toBe(0)
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 3)).toBe(1) // blank line = empty paragraph
  })

  it('maps a style/comment line to the paragraph it affects (the one below)', () => {
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 0)).toBe(0)
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 2)).toBe(1)
  })

  it('is honest about a false {{#if}} branch: the paragraph is not in the preview → null', () => {
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 5)).toBeNull()
  })

  it('follows the branch when the answers make it true — indices shift with the render', () => {
    const withBranch = renderWith({ urgent: true, urgent_reason: 'загроза' })
    expect(mapLineToRenderedParagraph(withBranch, TPL, 5)).toBe(2)
    expect(mapLineToRenderedParagraph(withBranch, TPL, 7)).toBe(3)
    // same last line WITHOUT the branch sits one paragraph higher
    expect(mapLineToRenderedParagraph(renderWith(), TPL, 7)).toBe(2)
  })

  it('maps an {{#each}} body line to the FIRST item paragraph', () => {
    const tpl = '{{#each witnesses}}\n- {{raw}}\n{{/each}}\nКінець'
    const render = renderWith({ witnesses: [{ raw: 'Марія' }, { raw: 'Іван' }] })
    expect(mapLineToRenderedParagraph(render, tpl, 1)).toBe(0)
    expect(mapLineToRenderedParagraph(render, tpl, 3)).toBe(2)
  })

  it('fails soft: broken template → null, never throws', () => {
    expect(mapLineToRenderedParagraph(renderWith(), '{{#if x}}\nбез закриття', 1)).toBeNull()
  })

  it('never leaks the sentinel into the mapped render of the ORIGINAL text', () => {
    // The probe is a copy — rendering the original template stays byte-identical.
    const { text } = renderWith()(TPL)
    expect(text.includes(CARET_SENTINEL)).toBe(false)
  })
})
