import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CLAIM_SKELETON } from '../templateSkeleton'
import { detectBlocks } from '../detectBlocks'

// The skeleton's whole value is that it works with the REAL engine out of the
// box: parses, and detectBlocks recognizes all 8 canonical blocks — so the
// «Розкладка» preview and the block labels light up from the first minute.
// Load the engine the same way detectBlocks.test.ts does (no '@doc-engine'
// alias under `vitest run`).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
const require = createRequire(import.meta.url)
const engine = require(resolve(repoRoot, 'n8n/templates/render-document.js'))

const CANON = [
  'court_header',
  'parties',
  'doc_title',
  'circumstances',
  'legal_basis',
  'petition',
  'appendices',
  'signature',
]

describe('CLAIM_SKELETON — «Створити з каркаса» (§5)', () => {
  const { text, styleHints } = engine.renderDocumentWithStyles(
    CLAIM_SKELETON,
    engine.buildContext({}, {}),
  )
  const blocks = detectBlocks(text, styleHints)
  const byId = (id: string) => blocks.find((b) => b.id === id)

  it('passes the parse gate (renders with empty answers, no throw)', () => {
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('strips the how-to comments from the rendered document', () => {
    expect(text).not.toContain('Каркас позовної заяви')
    expect(text).not.toContain('{{!')
  })

  it('detectBlocks finds all 8 canonical blocks in document order', () => {
    const ids = blocks.filter((b) => b.id !== 'unknown').map((b) => b.id)
    expect(ids).toEqual(CANON)
  })

  it('keeps appendices + signature as one keep-together unit', () => {
    expect(byId('appendices')?.relation).toBe('keep-together')
    expect(byId('signature')?.relation).toBe('keep-together')
  })

  it('glues the title and ПРОШУ headings to their next line', () => {
    expect(byId('doc_title')?.relation).toBe('keep-together')
    expect(byId('petition')?.relation).toBe('keep-together')
  })
})
