import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { verifyInitData } = (() => {
  const code = readFileSync(resolve(__dirname, '../verify-init-data.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, require)
  return m.exports
})()

const BOT_TOKEN = '123456:test-bot-token-abc'

// Independently builds a signed initData string following Telegram's documented
// WebApp algorithm, so tests don't just call back into the function under test.
function buildInitData(fields, botToken) {
  const entries = Object.entries(fields).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])
  const dataCheckString = entries
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const params = new URLSearchParams()
  for (const [k, v] of entries) params.set(k, v)
  params.set('hash', hash)
  return params.toString()
}

function validFields(overrides) {
  return {
    query_id: 'AAH_test',
    user: { id: 111222333, first_name: 'Олена' },
    auth_date: Math.floor(Date.now() / 1000),
    ...overrides,
  }
}

describe('verifyInitData', () => {
  it('accepts a validly-signed initData and extracts the user', () => {
    const initData = buildInitData(validFields(), BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(true)
    expect(result.user.id).toBe(111222333)
    expect(result.user.first_name).toBe('Олена')
  })

  it('rejects a tampered hash', () => {
    const initData = buildInitData(validFields(), BOT_TOKEN)
    const params = new URLSearchParams(initData)
    const flipped = params.get('hash').replace(/^./, (c) => (c === '0' ? '1' : '0'))
    params.set('hash', flipped)
    const result = verifyInitData(params.toString(), BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad_signature')
  })

  it('rejects a forged user id appended after signing (the #56 spoofing scenario)', () => {
    const initData = buildInitData(validFields(), BOT_TOKEN)
    const params = new URLSearchParams(initData)
    // Attacker swaps the user id but keeps the original (now-mismatched) hash —
    // they cannot recompute a valid hash without the bot token.
    params.set('user', JSON.stringify({ id: 999999999, first_name: 'Attacker' }))
    const result = verifyInitData(params.toString(), BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad_signature')
  })

  it('rejects when signed with the wrong bot token', () => {
    const initData = buildInitData(validFields(), 'wrong-token')
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('bad_signature')
  })

  it('rejects missing hash field', () => {
    const params = new URLSearchParams()
    params.set('user', JSON.stringify({ id: 1 }))
    params.set('auth_date', String(Math.floor(Date.now() / 1000)))
    const result = verifyInitData(params.toString(), BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('missing_hash')
  })

  it('rejects missing initData', () => {
    expect(verifyInitData('', BOT_TOKEN).valid).toBe(false)
    expect(verifyInitData('', BOT_TOKEN).reason).toBe('missing')
    expect(verifyInitData(null, BOT_TOKEN).valid).toBe(false)
    expect(verifyInitData(undefined, BOT_TOKEN).valid).toBe(false)
  })

  it('rejects when bot token is not configured', () => {
    const initData = buildInitData(validFields(), BOT_TOKEN)
    const result = verifyInitData(initData, '')
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('no_bot_token')
  })

  it('rejects an expired auth_date beyond the replay window', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 100000 // ~27.7h ago
    const initData = buildInitData(validFields({ auth_date: oldAuthDate }), BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('accepts a custom maxAgeSeconds within range', () => {
    const authDate = Math.floor(Date.now() / 1000) - 30
    const initData = buildInitData(validFields({ auth_date: authDate }), BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN, { maxAgeSeconds: 60 })
    expect(result.valid).toBe(true)
  })

  it('rejects when auth_date is missing', () => {
    const fields = validFields()
    delete fields.auth_date
    const initData = buildInitData(fields, BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('missing_auth_date')
  })

  it('rejects malformed user JSON', () => {
    const initData = buildInitData(validFields({ user: 'not-json-{' }), BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('malformed_user')
  })

  it('rejects when user field is absent', () => {
    const fields = validFields()
    delete fields.user
    const initData = buildInitData(fields, BOT_TOKEN)
    const result = verifyInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('missing_user')
  })
})
