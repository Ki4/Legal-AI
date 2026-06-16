import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// CJS-loader pattern (repo convention for n8n Code node mirrors).
// `code` is a static repo file — not user input — so new Function() is safe here.
const { buildTypographyRequests } = (() => {
  const code = readFileSync(resolve(__dirname, '../apply-typography.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

// Helper: build a minimal Google Docs body with N paragraphs
function makeBody(paragraphTexts) {
  let idx = 1 // startIndex after the sectionBreak at 0
  const content = [{ endIndex: 1, sectionBreak: {} }] // index 0
  for (const text of paragraphTexts) {
    const end = idx + text.length + 1 // +1 for the trailing \n
    content.push({ startIndex: idx, endIndex: end, paragraph: { elements: [] } })
    idx = end
  }
  return { content }
}

describe('buildTypographyRequests', () => {
  it('returns [] when styleHints is empty', () => {
    const body = makeBody(['line 0', 'line 1'])
    expect(buildTypographyRequests({}, body)).toEqual([])
  })

  it('returns [] when styleHints is null', () => {
    expect(buildTypographyRequests(null, makeBody(['x']))).toEqual([])
  })

  it('returns [] when docBody is missing', () => {
    expect(buildTypographyRequests({ 0: ['center'] }, null)).toEqual([])
  })

  it('center → updateParagraphStyle alignment=CENTER', () => {
    const body = makeBody(['TITLE', 'body'])
    const reqs = buildTypographyRequests({ 0: ['center'] }, body)
    expect(reqs).toHaveLength(1)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.alignment).toBe('CENTER')
    expect(reqs[0].updateParagraphStyle.fields).toContain('alignment')
    expect(reqs[0].updateParagraphStyle.range.startIndex).toBe(1) // first para
  })

  it('right → updateParagraphStyle alignment=END', () => {
    const body = makeBody(['TITLE'])
    const reqs = buildTypographyRequests({ 0: ['right'] }, body)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.alignment).toBe('END')
  })

  it('bold → updateTextStyle bold=true, range excludes trailing newline', () => {
    const body = makeBody(['TITLE', 'body'])
    const reqs = buildTypographyRequests({ 0: ['bold'] }, body)
    expect(reqs).toHaveLength(1)
    expect(reqs[0].updateTextStyle.textStyle.bold).toBe(true)
    // endIndex should be 1 less than paragraph endIndex (excl. \n)
    const para = body.content[1]
    expect(reqs[0].updateTextStyle.range.endIndex).toBe(para.endIndex - 1)
  })

  it('center+bold → two requests', () => {
    const body = makeBody(['HEADING'])
    const reqs = buildTypographyRequests({ 0: ['center', 'bold'] }, body)
    expect(reqs).toHaveLength(2)
    const types = reqs.map((r) => Object.keys(r)[0])
    expect(types).toContain('updateParagraphStyle')
    expect(types).toContain('updateTextStyle')
  })

  it('keep-with-next → paragraphStyle.keepWithNext=true', () => {
    const body = makeBody(['heading', 'body'])
    const reqs = buildTypographyRequests({ 0: ['keep-with-next'] }, body)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.keepWithNext).toBe(true)
    expect(reqs[0].updateParagraphStyle.fields).toContain('keepWithNext')
  })

  it('keep-together → paragraphStyle.keepLinesTogether=true', () => {
    const body = makeBody(['block'])
    const reqs = buildTypographyRequests({ 0: ['keep-together'] }, body)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.keepLinesTogether).toBe(true)
  })

  it('page-break-before → paragraphStyle.pageBreakBefore=true', () => {
    const body = makeBody(['new section'])
    const reqs = buildTypographyRequests({ 0: ['page-break-before'] }, body)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.pageBreakBefore).toBe(true)
  })

  it('indent → paragraphStyle.indentFirstLine', () => {
    const body = makeBody(['indented'])
    const reqs = buildTypographyRequests({ 0: ['indent'] }, body)
    expect(reqs[0].updateParagraphStyle.paragraphStyle.indentFirstLine).toEqual({
      magnitude: 720, unit: 'PT',
    })
  })

  it('unknown keyword is silently ignored', () => {
    const body = makeBody(['line'])
    expect(() => buildTypographyRequests({ 0: ['unknown-kw'] }, body)).not.toThrow()
    // unknown keyword alone → no requests (no known style fields set)
    expect(buildTypographyRequests({ 0: ['unknown-kw'] }, body)).toHaveLength(0)
  })

  it('paraIdx out of range is skipped gracefully', () => {
    const body = makeBody(['only one paragraph'])
    const reqs = buildTypographyRequests({ 5: ['center'] }, body)
    expect(reqs).toEqual([])
  })

  it('multiple style hints → requests for each paragraph', () => {
    const body = makeBody(['TITLE', 'intro', 'SECTION'])
    const hints = { 0: ['center', 'bold'], 2: ['center', 'bold'] }
    const reqs = buildTypographyRequests(hints, body)
    // 2 paragraphs × 2 requests each (updateParagraphStyle + updateTextStyle)
    expect(reqs).toHaveLength(4)
  })

  it('correct startIndex/endIndex for non-first paragraph', () => {
    const body = makeBody(['line 0', 'line 1', 'line 2'])
    // 'line 0' = indices 1..8 (6 chars + \n = 7, so endIndex = 1+7=8)
    // 'line 1' = indices 8..15
    const reqs = buildTypographyRequests({ 1: ['center'] }, body)
    const para = body.content[2] // second paragraph element (index 1 after sectionBreak)
    expect(reqs[0].updateParagraphStyle.range.startIndex).toBe(para.startIndex)
    expect(reqs[0].updateParagraphStyle.range.endIndex).toBe(para.endIndex)
  })

  it('fields string lists all applied paragraph fields', () => {
    const body = makeBody(['x'])
    const reqs = buildTypographyRequests({ 0: ['center', 'keep-with-next', 'keep-together'] }, body)
    const fields = reqs[0].updateParagraphStyle.fields
    expect(fields).toContain('alignment')
    expect(fields).toContain('keepWithNext')
    expect(fields).toContain('keepLinesTogether')
  })
})
