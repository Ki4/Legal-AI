import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { formatError } = (() => {
  const code = readFileSync(resolve(__dirname, '../format-error.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

describe('formatError', () => {
  it('formats a full Error Trigger payload', () => {
    const text = formatError({
      execution: {
        id: 'exec_123',
        url: 'https://n8n.example/execution/exec_123',
        lastNodeExecuted: 'Insert Case',
        error: { message: 'duplicate key value violates unique constraint' },
      },
      workflow: { id: 'wf1', name: 'Legal AI — Form Submit' },
    })
    expect(text).toContain('⚠️ Workflow error: Legal AI — Form Submit')
    expect(text).toContain('Node: Insert Case')
    expect(text).toContain('Error: duplicate key value violates unique constraint')
    expect(text).toContain('Exec: exec_123')
    expect(text).toContain('https://n8n.example/execution/exec_123')
  })

  it('falls back gracefully on a sparse payload', () => {
    const text = formatError({})
    expect(text).toContain('⚠️ Workflow error: Legal AI — Form Submit')
    expect(text).toContain('Node: unknown')
    expect(text).toContain('Error: unknown error')
    expect(text).toContain('Exec: —')
  })

  it('never throws on null/undefined input', () => {
    expect(() => formatError(null)).not.toThrow()
    expect(() => formatError(undefined)).not.toThrow()
  })

  it('reads a top-level error if execution.error is absent', () => {
    const text = formatError({ error: { message: 'boom' } })
    expect(text).toContain('Error: boom')
  })

  it('omits the URL line when no execution url is present', () => {
    const text = formatError({ execution: { id: 'e1', lastNodeExecuted: 'X' } })
    expect(text).not.toContain('http')
  })
})
