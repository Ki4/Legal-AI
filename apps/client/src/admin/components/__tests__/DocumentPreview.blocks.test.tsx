// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DocumentPreview } from '../DocumentPreview'

// Block labels (template-editor §5): the engine-backed render is mocked (no
// '@doc-engine' alias under vitest) but detectBlocks runs FOR REAL on the
// mocked render output — the test covers the wiring render → detect → labels.
const LINES = [
  'До суду за місцем проживання відповідача',
  'Позивач: ________',
  'Відповідач: ________',
]

vi.mock('../../lib/documentPreview', () => ({
  renderPreview: vi.fn(() => ({
    ok: true,
    paragraphs: LINES.map((text) => ({ text, className: '' })),
    text: LINES.join('\n'),
    styleHints: {},
  })),
  renderAnnotatedPreview: vi.fn(),
}))

import { renderPreview } from '../../lib/documentPreview'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DocumentPreview — block labels (showBlocks)', () => {
  it('labels detected canonical blocks with their registry names', () => {
    render(<DocumentPreview template="tpl" slug={null} showBlocks />)
    expect(screen.getByText('Шапка суду')).toBeTruthy()
    expect(screen.getByText('Сторони')).toBeTruthy()
  })

  it('shows no labels without the showBlocks prop (mirror pages unchanged)', () => {
    render(<DocumentPreview template="tpl" slug={null} />)
    expect(screen.queryByText('Шапка суду')).toBeNull()
  })

  it('honestly drops the labels when the render fails (parse error)', () => {
    vi.mocked(renderPreview).mockReturnValue({
      ok: false,
      paragraphs: [],
      error: 'unclosed {{#if}}',
    })
    render(<DocumentPreview template="tpl" slug={null} showBlocks />)
    expect(screen.queryByText('Шапка суду')).toBeNull()
    expect(screen.getByText(/Не вдалося відрендерити превʼю/)).toBeTruthy()
  })
})
