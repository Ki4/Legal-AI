import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { detectBlocks } from '../detectBlocks'
import { sampleAnswersFor } from '../sampleAnswers'

// Load the REAL doc-engine + templates from the repo (the vite `@doc-engine`
// alias only exists in the admin build config, not under `vitest run`), so this
// test exercises the same rendered text + styleHints production sees.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
const require = createRequire(import.meta.url)
const engine = require(resolve(repoRoot, 'n8n/templates/render-document.js'))

function renderDoc(slug: string): { text: string; styleHints: Record<number, string[]> } {
  const template = readFileSync(
    resolve(repoRoot, `n8n/templates/services/${slug}.document.txt`),
    'utf8',
  )
  const ctx = engine.buildContext(sampleAnswersFor(slug) ?? {}, {})
  return engine.renderDocumentWithStyles(template, ctx)
}

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

describe.each(['divorce', 'alimony'])('detectBlocks — real %s document', (slug) => {
  const { text, styleHints } = renderDoc(slug)
  const blocks = detectBlocks(text, styleHints)
  const byId = (id: string) => blocks.find((b) => b.id === id)

  it('finds all 8 canonical blocks in document order', () => {
    const ids = blocks.filter((b) => b.id !== 'unknown').map((b) => b.id)
    expect(ids).toEqual(CANON)
  })

  it('covers every paragraph contiguously with no gaps or overlaps', () => {
    const lastLine = text.split('\n').length - 1
    expect(blocks[0].startPara).toBe(0)
    expect(blocks[blocks.length - 1].endPara).toBe(lastLine)
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].startPara).toBe(blocks[i - 1].endPara + 1)
    }
  })

  it('recognizes appendices + signature as one keep-together unit', () => {
    expect(byId('appendices')?.relation).toBe('keep-together')
    expect(byId('signature')?.relation).toBe('keep-together')
  })

  it('marks heading blocks (title / ПРОШУ) as keep-together (glued to next line)', () => {
    // doc_title and the ПРОШУ heading carry keep-with-next in the templates so
    // the heading never orphans from the line that follows it (session 58).
    expect(byId('doc_title')?.relation).toBe('keep-together')
    expect(byId('petition')?.relation).toBe('keep-together')
  })

  it('leaves the free-flowing narrative blocks unglued', () => {
    expect(byId('court_header')?.relation).toBeNull()
    expect(byId('parties')?.relation).toBeNull()
    expect(byId('circumstances')?.relation).toBeNull()
    expect(byId('legal_basis')?.relation).toBeNull()
  })

  it('anchors the title and ПРОШУ blocks on real content', () => {
    const lines = text.split('\n')
    expect(lines[byId('doc_title')!.startPara]).toMatch(/ПОЗОВНА ЗАЯВА/)
    expect(lines[byId('petition')!.startPara]).toMatch(/П\s*Р\s*О\s*Ш\s*У/)
    expect(lines[byId('appendices')!.startPara]).toMatch(/^Додатки\s*:/)
  })

  it('carries registry labels + colors', () => {
    expect(byId('petition')?.label).toBe('ПРОШУ')
    expect(byId('appendices')?.color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('detectBlocks — fail-closed', () => {
  it('returns a single unknown block on unrecognizable input', () => {
    const blocks = detectBlocks('якийсь випадковий текст\nбез жодних якорів', {})
    expect(blocks).toHaveLength(1)
    expect(blocks[0].id).toBe('unknown')
    expect(blocks[0].startPara).toBe(0)
    expect(blocks[0].endPara).toBe(1)
  })

  it('returns [] for empty / non-string input', () => {
    expect(detectBlocks('', {})).toEqual([])
    // @ts-expect-error — defensive runtime guard
    expect(detectBlocks(null, {})).toEqual([])
  })

  it('degrades to partial coverage when interior anchors are missing', () => {
    // Header + parties present, but no title / citation / ПРОШУ / appendices.
    const text = 'До суду за місцем проживання відповідача\n\nПозивач: Тест Тест Тест\nбла бла бла'
    const blocks = detectBlocks(text, {})
    // court_header + parties recognized; the tail becomes part of parties (last
    // marker extends to EOF) — never throws, always covers the whole document.
    expect(blocks.some((b) => b.id === 'court_header')).toBe(true)
    expect(blocks.some((b) => b.id === 'parties')).toBe(true)
    expect(blocks[blocks.length - 1].endPara).toBe(text.split('\n').length - 1)
  })

  it('honors page-break-before precedence over keep-together', () => {
    // Minimal doc with a title block forced to a new page AND kept together.
    const text = 'ПОЗОВНА ЗАЯВА\nпро щось\n\nтекст'
    const hints = { 0: ['page-break-before', 'keep-with-next'] }
    const blocks = detectBlocks(text, hints)
    const title = blocks.find((b) => b.id === 'doc_title')
    expect(title?.relation).toBe('page-break-before')
  })
})
