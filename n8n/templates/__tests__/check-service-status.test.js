import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { checkServiceStatus, UNAVAILABLE_MESSAGE, NOT_FOUND_MESSAGE } = (() => {
  const code = readFileSync(resolve(__dirname, '../check-service-status.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

// ─── checkServiceStatus ──────────────────────────────────────────────────────

describe('checkServiceStatus', () => {
  it('serves an active service (no block message)', () => {
    const r = checkServiceStatus({ status: 'active', title: 'Розірвання шлюбу' })
    expect(r._active).toBe(true)
    expect(r._status).toBe('active')
    expect(r._service_title).toBe('Розірвання шлюбу')
    expect(r._block_message).toBeNull()
  })

  it('blocks needs_review like disabled', () => {
    const r = checkServiceStatus({ status: 'needs_review', title: 'Розірвання шлюбу' })
    expect(r._active).toBe(false)
    expect(r._status).toBe('needs_review')
    expect(r._block_message).toBe(UNAVAILABLE_MESSAGE)
  })

  it('blocks a disabled service', () => {
    const r = checkServiceStatus({ status: 'disabled', title: 'Спори з ТЦК' })
    expect(r._active).toBe(false)
    expect(r._status).toBe('disabled')
    expect(r._block_message).toBe(UNAVAILABLE_MESSAGE)
  })

  it('blocks a not-found service (null row)', () => {
    const r = checkServiceStatus(null)
    expect(r._active).toBe(false)
    expect(r._status).toBe('not_found')
    expect(r._service_title).toBeNull()
    expect(r._block_message).toBe(NOT_FOUND_MESSAGE)
  })

  it('blocks a service with an unexpected / missing status', () => {
    const r = checkServiceStatus({ title: 'Щось' })
    expect(r._active).toBe(false)
    expect(r._status).toBe('unknown')
    expect(r._block_message).toBe(UNAVAILABLE_MESSAGE)
  })

  it('never serves anything but the exact string "active"', () => {
    for (const status of ['Active', 'ACTIVE', 'active ', 'enabled', '']) {
      expect(checkServiceStatus({ status })._active).toBe(false)
    }
  })
})
