import { describe, it, expect } from 'vitest'
import {
  validateExampleFile,
  buildExamplePath,
  MAX_EXAMPLE_BYTES,
} from '../serviceRequestFile'

const pdf = (over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: 'sample.pdf',
  size: 1000,
  type: 'application/pdf',
  ...over,
})

describe('validateExampleFile', () => {
  it('accepts a normal PDF', () => {
    expect(validateExampleFile(pdf())).toBeNull()
  })

  it('accepts a DOCX by MIME', () => {
    expect(validateExampleFile(pdf({
      name: 'позов.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }))).toBeNull()
  })

  it('accepts a DOCX when the browser left type empty (falls back to extension)', () => {
    expect(validateExampleFile(pdf({ name: 'позов.docx', type: '' }))).toBeNull()
  })

  it('rejects an empty file', () => {
    expect(validateExampleFile(pdf({ size: 0 }))).toMatch(/порожній/)
  })

  it('rejects a file over 10 MB', () => {
    expect(validateExampleFile(pdf({ size: MAX_EXAMPLE_BYTES + 1 }))).toMatch(/завеликий/)
  })

  it('rejects an unsupported type', () => {
    expect(validateExampleFile(pdf({ name: 'photo.png', type: 'image/png' }))).toMatch(/PDF або DOC/)
  })
})

describe('buildExamplePath', () => {
  it('namespaces under requests/ with the unique id', () => {
    expect(buildExamplePath('sample.pdf', 'abc123')).toBe('requests/abc123_sample.pdf')
  })

  it('sanitises an all-Cyrillic base to the "file" fallback, keeps the extension', () => {
    expect(buildExamplePath('Позов про поділ.docx', 'u1')).toBe('requests/u1_file.docx')
  })

  it('replaces unsafe chars with underscores', () => {
    const p = buildExamplePath('my file (final)!.pdf', 'u2')
    expect(p).toMatch(/^requests\/u2_[a-zA-Z0-9._-]+\.pdf$/)
  })

  it('falls back to "file" when the base sanitises to empty', () => {
    expect(buildExamplePath('Позов.pdf', 'u3')).toBe('requests/u3_file.pdf')
  })

  it('keeps two uploads of the same name apart via the id', () => {
    expect(buildExamplePath('doc.pdf', 'a')).not.toBe(buildExamplePath('doc.pdf', 'b'))
  })
})
