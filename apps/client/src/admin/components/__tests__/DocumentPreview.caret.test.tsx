// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { DocumentPreview } from '../DocumentPreview'

// Caret↔paragraph sync-highlight (S2 slice C): the engine-backed render and the
// mapping are mocked (no '@doc-engine' alias under vitest) — the test covers the
// wiring caretLine → mapCaretToParagraph → highlighted paragraph div.
const LINES = ['ПОЗОВНА ЗАЯВА', 'Позивач: ________', 'Підпис']

vi.mock('../../lib/documentPreview', () => ({
  renderPreview: vi.fn(() => ({
    ok: true,
    paragraphs: LINES.map((text) => ({ text, className: '' })),
    text: LINES.join('\n'),
    styleHints: {},
  })),
  renderAnnotatedPreview: vi.fn(),
  mapCaretToParagraph: vi.fn(() => 1),
}))

import { mapCaretToParagraph } from '../../lib/documentPreview'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const highlightedOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[class*="bg-brand/10"]'))

describe('DocumentPreview — caret↔paragraph sync-highlight (caretLine)', () => {
  it('highlights the mapped paragraph and passes the caret line through', () => {
    const { container } = render(<DocumentPreview template="tpl" slug={null} caretLine={4} />)
    expect(mapCaretToParagraph).toHaveBeenCalledWith('tpl', 4, expect.anything())
    const hits = highlightedOf(container)
    expect(hits).toHaveLength(1)
    expect(hits[0].textContent).toContain('Позивач:')
  })

  it('highlights nothing without a caret line', () => {
    const { container } = render(<DocumentPreview template="tpl" slug={null} />)
    expect(mapCaretToParagraph).not.toHaveBeenCalled()
    expect(highlightedOf(container)).toHaveLength(0)
  })

  it('highlights nothing when the mapping has no honest answer (null)', () => {
    vi.mocked(mapCaretToParagraph).mockReturnValue(null)
    const { container } = render(<DocumentPreview template="tpl" slug={null} caretLine={2} />)
    expect(highlightedOf(container)).toHaveLength(0)
    expect(screen.getByText('ПОЗОВНА ЗАЯВА')).toBeTruthy() // preview intact
  })
})
