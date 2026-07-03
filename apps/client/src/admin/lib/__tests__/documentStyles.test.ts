import { describe, it, expect } from 'vitest'
import { styleClasses, toParagraphs, toSegments } from '../documentStyles'

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

  it('attaches inline segments only to paragraphs that have runs (styleHints v2)', () => {
    const paras = toParagraphs('перший\nдругий', { 0: ['center'] }, {
      1: [{ start: 0, end: 2, styles: ['bold'] }],
    })
    expect(paras[0]).toEqual({ text: 'перший', className: 'text-center' })
    expect(paras[1].segments).toEqual([
      { text: 'др', className: 'font-semibold' },
      { text: 'угий', className: '' },
    ])
  })
})

describe('toSegments — inline runs → styled preview segments (styleHints v2)', () => {
  it('splits a line into plain and styled slices', () => {
    const line = 'Позивач: Іваненко Іван, тел.'
    expect(toSegments(line, [{ start: 9, end: 22, styles: ['bold'] }])).toEqual([
      { text: 'Позивач: ', className: '' },
      { text: 'Іваненко Іван', className: 'font-semibold' },
      { text: ', тел.', className: '' },
    ])
  })

  it('invariant: concatenated segment texts equal the line, whatever the runs', () => {
    const line = 'абвгдеєжз'
    const cases = [
      [{ start: 0, end: 9, styles: ['bold'] }],
      [{ start: 2, end: 5, styles: ['italic'] }, { start: 4, end: 8, styles: ['bold'] }],
      [{ start: 0, end: 99, styles: ['underline'] }], // out-of-range clamps
      [{ start: 5, end: 5, styles: ['bold'] }], // degenerate
    ]
    for (const runs of cases) {
      expect(toSegments(line, runs).map((s) => s.text).join('')).toBe(line)
    }
  })

  it('overlapping runs compose classes on the intersection', () => {
    expect(toSegments('абвгд', [
      { start: 0, end: 4, styles: ['bold'] },
      { start: 2, end: 5, styles: ['italic'] },
    ])).toEqual([
      { text: 'аб', className: 'font-semibold' },
      { text: 'вг', className: 'font-semibold italic' },
      { text: 'д', className: 'italic' },
    ])
  })

  it('unknown run keywords are ignored (forward-compat, like styleClasses)', () => {
    expect(toSegments('аб', [{ start: 0, end: 2, styles: ['strike'] }])).toEqual([
      { text: 'аб', className: '' },
    ])
  })
})
