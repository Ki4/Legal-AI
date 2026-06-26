import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SAMPLE_ANSWERS, sampleAnswersFor } from '../sampleAnswers'

/**
 * Drift guard for the admin document-preview sample fixtures (A5).
 *
 * The samples are realistic answers used to render a FILLED preview. If a
 * template renames/adds a field, or a sample goes out of sync, the filled
 * document would regress to skeleton holes — this catches that by rendering
 * each sample through the REAL doc-engine (same renderer n8n uses) and
 * asserting the document actually fills.
 *
 * Loads the CJS engine + templates directly from the repo (parity-test
 * convention) — no '@doc-engine' vite alias needed under vitest. Static repo
 * files, not untrusted input.
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../../../../..') // __tests__ → lib → admin → src → client → apps → repo

function loadCjs(relPath: string) {
  const code = readFileSync(resolve(ROOT, relPath), 'utf8')
  const m = { exports: {} as Record<string, unknown> }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
}

const { renderDocument, buildContext } = loadCjs('n8n/templates/render-document.js') as {
  renderDocument: (tpl: string, ctx: unknown) => string
  buildContext: (answers: unknown, ai: unknown) => unknown
}

const TEMPLATES: Record<string, string> = {
  divorce: 'n8n/templates/services/divorce.document.txt',
  alimony: 'n8n/templates/services/alimony.document.txt',
}

const holes = (s: string) => (s.match(/_{4,}/g) || []).length

describe('admin sample answers (A5 filled preview)', () => {
  // Every sample must have a template to render against (keeps the two in lockstep).
  it('only defines samples for services that have a golden template', () => {
    for (const slug of Object.keys(SAMPLE_ANSWERS)) {
      expect(TEMPLATES[slug], `no template mapped for sample "${slug}"`).toBeTruthy()
    }
  })

  for (const [slug, relPath] of Object.entries(TEMPLATES)) {
    describe(slug, () => {
      const sample = SAMPLE_ANSWERS[slug]
      const template = readFileSync(resolve(ROOT, relPath), 'utf8')
      const filled = renderDocument(template, buildContext(sample, {}))
      const empty = renderDocument(template, buildContext({}, {}))

      it('renders a substantial document without throwing', () => {
        expect(filled.length).toBeGreaterThan(500)
      })

      it('fills the skeleton far more than empty answers do', () => {
        // The whole point of A5: the sample must collapse most '________' holes.
        expect(holes(filled)).toBeLessThan(holes(empty))
        expect(holes(filled)).toBeLessThanOrEqual(2) // ≤ runtime-only blanks (e.g. court-costs amount)
      })

      it('prints the plaintiff name from the sample', () => {
        const { last_name, first_name } = sample as { last_name: string; first_name: string }
        expect(filled).toContain(last_name)
        expect(filled).toContain(first_name)
      })
    })
  }

  it('sampleAnswersFor returns null for unknown / empty slug', () => {
    expect(sampleAnswersFor(null)).toBeNull()
    expect(sampleAnswersFor('does-not-exist')).toBeNull()
    expect(sampleAnswersFor('divorce')).toBe(SAMPLE_ANSWERS.divorce)
  })
})
