import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { validatePayload } = (() => {
  const code = readFileSync(resolve(__dirname, '../validate.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

// ─── validatePayload ────────────────────────────────────────────────────────

describe('validatePayload', () => {
  const validBody = {
    user_id: '123456',
    service_slug: 'divorce',
    answers: { name: 'Олена' },
    consented_at: '2025-01-01T00:00:00Z',
  }

  it('returns valid result for complete payload', () => {
    const result = validatePayload(validBody)
    expect(result._valid).toBe(true)
    expect(result._user_id).toBe('123456')
    expect(result._service_slug).toBe('divorce')
    expect(result._answers).toEqual({ name: 'Олена' })
    expect(result._consented_at).toBe('2025-01-01T00:00:00Z')
    expect(result._submitted_at).toBeDefined()
  })

  it('converts numeric user_id to string', () => {
    const body = { ...validBody, user_id: 789 }
    const result = validatePayload(body)
    expect(result._valid).toBe(true)
    expect(result._user_id).toBe('789')
  })

  it('rejects missing body', () => {
    expect(validatePayload(null)._valid).toBe(false)
    expect(validatePayload(null)._error).toBe('missing body')
    expect(validatePayload(undefined)._valid).toBe(false)
  })

  it('rejects missing user_id', () => {
    const body = { ...validBody, user_id: undefined }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('missing user_id')
  })

  it('rejects empty string user_id', () => {
    const body = { ...validBody, user_id: '' }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('missing user_id')
  })

  it('rejects missing service_slug', () => {
    const body = { ...validBody, service_slug: undefined }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('missing service_slug')
  })

  it('rejects empty service_slug', () => {
    const body = { ...validBody, service_slug: '' }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('missing service_slug')
  })

  it('rejects missing answers', () => {
    const body = { ...validBody, answers: undefined }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('empty answers')
  })

  it('rejects null answers', () => {
    const body = { ...validBody, answers: null }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('empty answers')
  })

  it('rejects empty answers object', () => {
    const body = { ...validBody, answers: {} }
    const result = validatePayload(body)
    expect(result._valid).toBe(false)
    expect(result._error).toBe('empty answers')
  })

  it('auto-generates consented_at when missing', () => {
    const body = { ...validBody, consented_at: undefined }
    const result = validatePayload(body)
    expect(result._valid).toBe(true)
    expect(result._consented_at).toBeDefined()
    // Should be a valid ISO string
    expect(new Date(result._consented_at).toISOString()).toBe(result._consented_at)
  })

  it('auto-generates _submitted_at', () => {
    const result = validatePayload(validBody)
    expect(result._submitted_at).toBeDefined()
    const ts = new Date(result._submitted_at)
    expect(ts.getTime()).toBeGreaterThan(Date.now() - 5000)
  })
})
