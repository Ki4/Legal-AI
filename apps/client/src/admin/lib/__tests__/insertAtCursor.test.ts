import { describe, it, expect } from 'vitest'
import { insertSnippet, insertLineBefore, wrapSelection, wrapInline } from '../insertAtCursor'

describe('insertSnippet', () => {
  it('inserts at a collapsed caret and lands the caret after the snippet', () => {
    const r = insertSnippet('Позивач: ', 9, 9, '{{last_name}}')
    expect(r.text).toBe('Позивач: {{last_name}}')
    expect(r.caret).toBe(9 + '{{last_name}}'.length)
  })

  it('replaces the selection', () => {
    const r = insertSnippet('Позивач: XXX кінець', 9, 12, '{{last_name}}')
    expect(r.text).toBe('Позивач: {{last_name}} кінець')
    expect(r.caret).toBe(9 + '{{last_name}}'.length)
  })

  it('handles empty text', () => {
    const r = insertSnippet('', 0, 0, '{{поле}}')
    expect(r.text).toBe('{{поле}}')
    expect(r.caret).toBe('{{поле}}'.length)
  })

  it('inserts at the very end of the text', () => {
    const r = insertSnippet('абв', 3, 3, 'г')
    expect(r.text).toBe('абвг')
    expect(r.caret).toBe(4)
  })
})

describe('insertLineBefore', () => {
  it('puts the directive on its own line before the current paragraph (mid-paragraph caret)', () => {
    const text = 'Перший абзац\nДругий абзац\nТретій'
    const caretInSecond = text.indexOf('Другий') + 3
    const r = insertLineBefore(text, caretInSecond, '{{!style: center}}')
    expect(r.text).toBe('Перший абзац\n{{!style: center}}\nДругий абзац\nТретій')
    // Caret keeps its original text position, shifted by the inserted length.
    expect(r.text.slice(r.caret - 3, r.caret)).toBe('Дру')
    expect(r.caret).toBe(caretInSecond + '{{!style: center}}\n'.length)
  })

  it('handles the first line (no newline to the left)', () => {
    const r = insertLineBefore('Абзац один\nАбзац два', 4, '{{!style: bold}}')
    expect(r.text).toBe('{{!style: bold}}\nАбзац один\nАбзац два')
    expect(r.caret).toBe(4 + '{{!style: bold}}\n'.length)
  })

  it('handles empty text', () => {
    const r = insertLineBefore('', 0, '{{!style: right}}')
    expect(r.text).toBe('{{!style: right}}\n')
    expect(r.caret).toBe('{{!style: right}}\n'.length)
  })

  it('handles a caret at position 0 of a later line', () => {
    const text = 'a\nb'
    const r = insertLineBefore(text, 2, '{{!style: indent}}')
    expect(r.text).toBe('a\n{{!style: indent}}\nb')
  })

  it('keeps the directive line clean in CRLF text (previous line keeps its \\r)', () => {
    const text = 'Перший\r\nДругий'
    const caretInSecond = text.indexOf('Другий') + 2
    const r = insertLineBefore(text, caretInSecond, '{{!style: right}}')
    // The directive occupies its own \n-terminated line — no \r glued to it,
    // so the engine's '\n'-split sees the directive verbatim.
    expect(r.text).toBe('Перший\r\n{{!style: right}}\nДругий')
    expect(r.caret).toBe(caretInSecond + '{{!style: right}}\n'.length)
  })
})

describe('wrapInline (styleHints v2 runs)', () => {
  it('wraps the exact selection and lands the caret after the close tag', () => {
    const text = 'Позивач: Іваненко, тел.'
    const from = 9
    const to = 17 // 'Іваненко'
    const r = wrapInline(text, from, to, '{{#bold}}', '{{/bold}}')
    expect(r.text).toBe('Позивач: {{#bold}}Іваненко{{/bold}}, тел.')
    expect(r.caret).toBe(to + '{{#bold}}{{/bold}}'.length)
    expect(r.text.slice(r.caret)).toBe(', тел.')
  })

  it('normalizes a backwards selection', () => {
    const r = wrapInline('абвгд', 4, 1, '{{#bold}}', '{{/bold}}')
    expect(r.text).toBe('а{{#bold}}бвг{{/bold}}д')
  })

  it('wraps a selection spanning lines verbatim (engine splits the run per paragraph)', () => {
    const r = wrapInline('аб\nвг', 1, 4, '{{#bold}}', '{{/bold}}')
    expect(r.text).toBe('а{{#bold}}б\nв{{/bold}}г')
  })
})

describe('wrapSelection', () => {
  const OPEN = '{{!style: keep-block}}'
  const CLOSE = '{{!style: /keep-block}}'

  it('wraps a multi-paragraph selection with open/close on their own lines', () => {
    const text = 'Шапка\nАбзац один\nАбзац два\nПідпис'
    const selStart = text.indexOf('один') // inside paragraph 2
    const selEnd = text.indexOf('два') + 1 // inside paragraph 3
    const r = wrapSelection(text, selStart, selEnd, OPEN, CLOSE)
    expect(r.text).toBe(`Шапка\n${OPEN}\nАбзац один\nАбзац два\n${CLOSE}\nПідпис`)
    // Caret at the end of the wrapped content (just before the '\n' + close line).
    expect(r.caret).toBe(r.text.indexOf(`\n${CLOSE}`))
  })

  it('wraps just the current paragraph on a collapsed selection', () => {
    const text = 'Перший\nДругий абзац\nТретій'
    const caret = text.indexOf('Другий') + 2
    const r = wrapSelection(text, caret, caret, OPEN, CLOSE)
    expect(r.text).toBe(`Перший\n${OPEN}\nДругий абзац\n${CLOSE}\nТретій`)
  })

  it('handles a selection starting at 0', () => {
    const r = wrapSelection('Один\nДва', 0, 2, OPEN, CLOSE)
    expect(r.text).toBe(`${OPEN}\nОдин\n${CLOSE}\nДва`)
  })

  it('handles a selection at the end of text with no trailing newline', () => {
    const text = 'Один\nДва'
    const r = wrapSelection(text, text.length - 1, text.length, OPEN, CLOSE)
    expect(r.text).toBe(`Один\n${OPEN}\nДва\n${CLOSE}`)
    expect(r.caret).toBe(r.text.indexOf(`\n${CLOSE}`))
  })

  it('handles empty text', () => {
    const r = wrapSelection('', 0, 0, OPEN, CLOSE)
    expect(r.text).toBe(`${OPEN}\n\n${CLOSE}`)
    // Caret on the empty line between the pair, ready for typing.
    expect(r.caret).toBe(OPEN.length + 1)
  })

  it('keeps whole lines when the selection covers them exactly', () => {
    const text = 'a\nbb\nc'
    const r = wrapSelection(text, 2, 4, OPEN, CLOSE) // exactly "bb"
    expect(r.text).toBe(`a\n${OPEN}\nbb\n${CLOSE}\nc`)
  })
})
