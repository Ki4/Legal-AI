import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { formatGenFailure, userFailureMessage } = (() => {
  const code = readFileSync(resolve(__dirname, '../format-gen-failure.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

describe('formatGenFailure (admin alert)', () => {
  it('formats a full failure context', () => {
    const text = formatGenFailure({
      error: { message: 'invalid_grant: token expired' },
      executionId: 'exec_77',
      caseId: 412,
      serviceTitle: 'Розірвання шлюбу',
    })
    expect(text).toContain('🚨 Збій генерації документа')
    expect(text).toContain('Послуга: Розірвання шлюбу')
    expect(text).toContain('Кейс №: 412')
    expect(text).toContain('Помилка: invalid_grant: token expired')
    expect(text).toContain('Exec: exec_77')
    expect(text).toContain('Клієнта сповіщено автоматично.')
  })

  it('falls back gracefully on an empty context', () => {
    const text = formatGenFailure({})
    expect(text).toContain('Послуга: —')
    expect(text).toContain('Кейс №: —')
    expect(text).toContain('Помилка: unknown error')
    expect(text).toContain('Exec: —')
  })

  it('reads error.description when message is absent', () => {
    const text = formatGenFailure({ error: { description: 'HTTP 500 from Google Docs' } })
    expect(text).toContain('Помилка: HTTP 500 from Google Docs')
  })

  it('never throws on null/undefined input', () => {
    expect(() => formatGenFailure(null)).not.toThrow()
    expect(() => formatGenFailure(undefined)).not.toThrow()
  })

  it('treats empty-string caseId/executionId as missing', () => {
    const text = formatGenFailure({ caseId: '', executionId: '' })
    expect(text).toContain('Кейс №: —')
    expect(text).toContain('Exec: —')
  })
})

describe('userFailureMessage (client notification)', () => {
  it('includes a tap-to-copy case number + service title when provided', () => {
    const text = userFailureMessage(412, 'Розірвання шлюбу')
    expect(text).toContain('Не вдалося сформувати документ')
    expect(text).toContain('технічна помилка')
    expect(text).toContain('📋 Розірвання шлюбу')
    expect(text).toContain('🔢 Кейс: <code>412</code>')
  })

  it('omits the case line when no case id', () => {
    const text = userFailureMessage()
    expect(text).toContain('Не вдалося сформувати документ')
    expect(text).not.toContain('Кейс:')
  })

  it('omits the case line on empty-string id', () => {
    expect(userFailureMessage('')).not.toContain('Кейс:')
  })

  it('omits the service line when no title', () => {
    expect(userFailureMessage(412)).not.toContain('📋')
  })

  it('never throws', () => {
    expect(() => userFailureMessage(null)).not.toThrow()
  })
})
