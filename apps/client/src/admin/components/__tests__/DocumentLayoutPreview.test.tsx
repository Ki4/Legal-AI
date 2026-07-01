// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DocumentLayoutPreview } from '../DocumentLayoutPreview'

// A representative rendered claim (all 8 canonical blocks). The engine itself is
// mocked away here so this test needs no '@doc-engine' alias (unavailable under
// `vitest run`); detectBlocks/paginate run for real. Real per-service structure
// is covered by detectBlocks.test.ts, which renders the actual templates.
const { MOCK_TEXT, PARA_COUNT, CIRC_IDX } = vi.hoisted(() => {
  const LINES = [
    'До суду за місцем проживання відповідача',
    '(Знайти ваш суд: https://court.gov.ua/)',
    '',
    'Позивач: Тест Іван Іванович',
    'Адреса: м. Київ',
    '',
    'Відповідач: Тест Петро Петрович',
    'Адреса: м. Львів',
    '',
    '',
    'ПОЗОВНА ЗАЯВА',
    'про розірвання шлюбу',
    '',
    '',
    'Обставини справи викладено одним рядком тут.', // index 14 — circumstances
    '',
    'Відповідно до ст.105 СК України шлюб припиняється.',
    '',
    'П Р О Ш У :',
    '',
    '1. Розірвати шлюб.',
    '',
    'Додатки:',
    '- копія паспорта.',
    '',
    '«___» _______ 20__ року   (підпис)   Тест Іван Іванович',
  ]
  return { MOCK_TEXT: LINES.join('\n'), PARA_COUNT: LINES.length, CIRC_IDX: 14 }
})

vi.mock('../../lib/documentPreview', () => ({
  renderLayout: () => ({ ok: true, text: MOCK_TEXT, styleHints: {} }),
}))

const smallHeights = () => new Array(PARA_COUNT).fill(12)

afterEach(cleanup)

describe('DocumentLayoutPreview', () => {
  it('renders the document for a service without crashing (divorce & alimony)', () => {
    for (const slug of ['divorce', 'alimony']) {
      const { unmount } = render(
        <DocumentLayoutPreview template="tpl" slug={slug} heightsForTest={smallHeights()} />,
      )
      // text appears in both the hidden measurer and the rendered pages
      expect(screen.getAllByText(/П\s*Р\s*О\s*Ш\s*У/).length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('always shows the "наближено" fidelity caveat', () => {
    render(<DocumentLayoutPreview template="tpl" slug="divorce" heightsForTest={smallHeights()} />)
    expect(screen.getByText(/Наближено/)).toBeTruthy()
  })

  it('keeps the guide legend collapsed by default and expands it on click', () => {
    render(<DocumentLayoutPreview template="tpl" slug="divorce" heightsForTest={smallHeights()} />)
    // collapsed: relation labels not in the DOM yet
    expect(screen.queryByText('Тримати разом')).toBeNull()
    fireEvent.click(screen.getByText(/Як це працює/))
    expect(screen.getByText('Тримати разом')).toBeTruthy()
    expect(screen.getByText('З нової сторінки')).toBeTruthy()
  })

  it('warns when a block is taller than a page (overflow)', () => {
    const heights = smallHeights()
    heights[CIRC_IDX] = 700 // circumstances paragraph exceeds one page
    render(<DocumentLayoutPreview template="tpl" slug="divorce" heightsForTest={heights} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toMatch(/вищий за сторінку/)
    expect(alert.textContent).toMatch(/Обставини/)
  })

  it('shows no overflow warning when everything fits', () => {
    render(<DocumentLayoutPreview template="tpl" slug="divorce" heightsForTest={smallHeights()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the empty-template fallback when no template', () => {
    render(<DocumentLayoutPreview template={null} slug="divorce" />)
    expect(screen.getByText(/ще не має шаблону/)).toBeTruthy()
  })
})
