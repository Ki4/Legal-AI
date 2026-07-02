import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { makeAnnotatedContext, splitAnnotated } from '../annotatedContext'

// Load the REAL doc-engine (the '@doc-engine' vite alias is unavailable under
// `vitest run`) so the Proxy contract — `has` covering field roots, `get`
// returning the sentinel — is checked against the engine's actual resolvePath.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
const require = createRequire(import.meta.url)
const engine = require(resolve(repoRoot, 'n8n/templates/render-document.js'))

function renderAnnotated(template: string, fieldIds: string[], answers: Record<string, unknown> = {}): string {
  const ctx = makeAnnotatedContext(engine.buildContext(answers, {}), new Set(fieldIds))
  return engine.renderDocumentWithStyles(template, ctx).text
}

describe('makeAnnotatedContext — against the real engine', () => {
  it('renders an unfilled known form field as a ⦃field_id⦄ sentinel', () => {
    expect(renderAnnotated('Позивач: {{last_name}}', ['last_name'])).toBe('Позивач: ⦃last_name⦄')
  })

  it('leaves a non-field unknown variable as the engine fallback ________', () => {
    expect(renderAnnotated('X: {{totally_unknown_var}}', ['last_name'])).toBe('X: ________')
  })

  it('keeps real values when the field is filled (base value wins over sentinel)', () => {
    expect(renderAnnotated('{{last_name}}', ['last_name'], { last_name: 'Іванова' })).toBe('Іванова')
  })

  it('{{#if}} on an annotated field takes the TRUTHY branch (sentinel is a non-empty string — documented, accepted)', () => {
    expect(renderAnnotated('{{#if last_name}}A{{else}}B{{/if}}', ['last_name'])).toBe('A')
  })

  it('computed engine keys (plaintiff_name) still render ________ in this mode', () => {
    expect(renderAnnotated('{{plaintiff_name}}', ['last_name'])).toBe('________')
  })
})

describe('splitAnnotated', () => {
  it('splits a mixed line into text and chip parts', () => {
    expect(splitAnnotated('Позивач: ⦃last_name⦄ ⦃first_name⦄, тел. ________')).toEqual([
      { kind: 'text', value: 'Позивач: ' },
      { kind: 'chip', value: 'last_name' },
      { kind: 'text', value: ' ' },
      { kind: 'chip', value: 'first_name' },
      { kind: 'text', value: ', тел. ________' },
    ])
  })

  it('returns a single text part when there are no sentinels', () => {
    expect(splitAnnotated('П Р О Ш У :')).toEqual([{ kind: 'text', value: 'П Р О Ш У :' }])
  })

  it('handles chips at line start/end and adjacent chips', () => {
    expect(splitAnnotated('⦃a⦄⦃b⦄ кінець ⦃c⦄')).toEqual([
      { kind: 'chip', value: 'a' },
      { kind: 'chip', value: 'b' },
      { kind: 'text', value: ' кінець ' },
      { kind: 'chip', value: 'c' },
    ])
  })

  it('returns an empty array for an empty line', () => {
    expect(splitAnnotated('')).toEqual([])
  })
})
