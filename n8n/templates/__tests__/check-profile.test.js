import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { checkProfile, NO_PROFILE_MESSAGE } = (() => {
  const code = readFileSync(resolve(__dirname, '../check-profile.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

describe('checkProfile', () => {
  it('passes a user that has an identity with user_id', () => {
    const r = checkProfile({ user_id: '0b0bedd2-caab-4a90-b14a-931a86883f41' })
    expect(r._has_profile).toBe(true)
    expect(r._user_id).toBe('0b0bedd2-caab-4a90-b14a-931a86883f41')
    expect(r._block_message).toBeNull()
  })

  it('blocks when no identity row was found (null)', () => {
    const r = checkProfile(null)
    expect(r._has_profile).toBe(false)
    expect(r._user_id).toBeNull()
    expect(r._block_message).toBe(NO_PROFILE_MESSAGE)
  })

  it('blocks an identity row missing user_id', () => {
    const r = checkProfile({ external_id: '236581343' })
    expect(r._has_profile).toBe(false)
    expect(r._block_message).toBe(NO_PROFILE_MESSAGE)
  })

  it('never throws on undefined input', () => {
    expect(() => checkProfile(undefined)).not.toThrow()
  })
})
