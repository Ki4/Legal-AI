import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { dedupUpdate, DEFAULT_TTL_MS } = (() => {
  const code = readFileSync(resolve(__dirname, '../dedup-update.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, require)
  return m.exports
})()

describe('dedupUpdate', () => {
  it('treats a first-seen update_id as not duplicate and records it', () => {
    const store = {}
    const r = dedupUpdate(store, 101, 1000)
    expect(r.isDuplicate).toBe(false)
    expect(store['101']).toBe(1000)
  })

  it('flags a repeat of the same update_id as duplicate', () => {
    const store = {}
    dedupUpdate(store, 101, 1000)
    const r = dedupUpdate(store, 101, 1500)
    expect(r.isDuplicate).toBe(true)
    // timestamp not overwritten on a duplicate hit
    expect(store['101']).toBe(1000)
  })

  it('treats different update_ids independently', () => {
    const store = {}
    expect(dedupUpdate(store, 1, 1000).isDuplicate).toBe(false)
    expect(dedupUpdate(store, 2, 1000).isDuplicate).toBe(false)
  })

  it('normalises numeric and string ids to the same key', () => {
    const store = {}
    dedupUpdate(store, 101, 1000)
    expect(dedupUpdate(store, '101', 1100).isDuplicate).toBe(true)
  })

  it('expires entries past the TTL (a later retry beyond TTL is not a dup)', () => {
    const store = {}
    dedupUpdate(store, 101, 1000)
    const r = dedupUpdate(store, 101, 1000 + DEFAULT_TTL_MS + 1)
    expect(r.isDuplicate).toBe(false)
  })

  it('prunes other expired entries so the map cannot grow unbounded', () => {
    const store = {}
    dedupUpdate(store, 1, 0)
    dedupUpdate(store, 2, 0)
    // a fresh update far in the future prunes the two old ones
    dedupUpdate(store, 3, DEFAULT_TTL_MS + 10)
    expect(Object.keys(store)).toEqual(['3'])
  })

  it('fails open on a missing update_id (never drops a real message)', () => {
    const store = {}
    expect(dedupUpdate(store, null, 1000).isDuplicate).toBe(false)
    expect(dedupUpdate(store, undefined, 1000).isDuplicate).toBe(false)
    expect(dedupUpdate(store, '', 1000).isDuplicate).toBe(false)
    expect(Object.keys(store)).toEqual([])
  })
})
