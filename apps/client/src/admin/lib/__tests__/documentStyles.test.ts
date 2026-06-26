import { describe, it, expect } from 'vitest'
import { styleClasses, toParagraphs } from '../documentStyles'

describe('styleClasses', () => {
  it('maps known style keywords to Tailwind classes', () => {
    expect(styleClasses(['center'])).toBe('text-center')
    expect(styleClasses(['bold'])).toBe('font-semibold')
    expect(styleClasses(['center', 'bold'])).toBe('text-center font-semibold')
  })

  it('returns empty string for no / undefined keywords', () => {
    expect(styleClasses(undefined)).toBe('')
    expect(styleClasses([])).toBe('')
  })

  it('ignores print-only hints with no on-screen effect', () => {
    expect(styleClasses(['keep-with-next'])).toBe('')
    expect(styleClasses(['bold', 'page-break'])).toBe('font-semibold')
  })
})

describe('toParagraphs', () => {
  it('splits text by newline and attaches per-paragraph classes', () => {
    const text = 'ЗАЯВА\nрядок без стилю\nпідпис'
    const hints = { 0: ['center', 'bold'], 2: ['right'] }
    expect(toParagraphs(text, hints)).toEqual([
      { text: 'ЗАЯВА', className: 'text-center font-semibold' },
      { text: 'рядок без стилю', className: '' },
      { text: 'підпис', className: 'text-right' },
    ])
  })

  it('preserves blank lines as empty paragraphs', () => {
    expect(toParagraphs('a\n\nb', {})).toEqual([
      { text: 'a', className: '' },
      { text: '', className: '' },
      { text: 'b', className: '' },
    ])
  })
})
