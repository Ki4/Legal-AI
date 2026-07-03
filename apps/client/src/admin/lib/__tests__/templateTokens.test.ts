import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { scanTemplateTokens } from '../templateTokens'
import { CLAIM_SKELETON } from '../templateSkeleton'

const kindsOf = (text: string) => scanTemplateTokens(text).map((t) => t.kind)

describe('scanTemplateTokens — DSL tag classification (S2 slice A)', () => {
  it('classifies every tag kind of the real template idiom', () => {
    expect(kindsOf('{{!style: center bold}}')).toEqual(['style'])
    expect(kindsOf('{{! авторський коментар }}')).toEqual(['comment'])
    expect(kindsOf('{{#if has_children}}x{{else if n_children == 2}}y{{/if}}')).toEqual([
      'logic',
      'logic',
      'logic',
    ])
    expect(kindsOf('{{#each children}}{{raw}}{{/each}}')).toEqual(['logic', 'var', 'logic'])
    expect(kindsOf('{{plaintiff_name}}')).toEqual(['var'])
    expect(kindsOf('{{formatDate birth_date}}')).toEqual(['helper'])
    expect(kindsOf('{{plural n_children "дитиною" "дітьми"}}')).toEqual(['helper'])
  })

  it('reports the root path segment as the var name', () => {
    const tokens = scanTemplateTokens('{{children.0.raw}} {{ai.plaintiff_genitive}} {{@index1}}')
    expect(tokens.map((t) => [t.kind, t.name])).toEqual([
      ['var', 'children'],
      ['var', 'ai'],
      ['var', '@index1'], // '@' kept — each-scope helper, not a form field
    ])
  })

  it('returns exact source positions (from/to slice the raw tag)', () => {
    const text = 'Позивач: {{plaintiff_name}}, тел. {{plaintiff_phone}}'
    const [a, b] = scanTemplateTokens(text)
    expect(text.slice(a.from, a.to)).toBe('{{plaintiff_name}}')
    expect(text.slice(b.from, b.to)).toBe('{{plaintiff_phone}}')
  })

  it('never throws and covers the claim skeleton and the real divorce template', () => {
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
    const divorce = readFileSync(
      resolve(repoRoot, 'n8n/templates/services/divorce.document.txt'),
      'utf8',
    )
    for (const text of [CLAIM_SKELETON, divorce]) {
      const tokens = scanTemplateTokens(text)
      expect(tokens.length).toBeGreaterThan(10)
      // Monotonic, non-overlapping ranges — RangeSetBuilder relies on this.
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i].from).toBeGreaterThanOrEqual(tokens[i - 1].to)
      }
    }
    const divorceKinds = new Set(scanTemplateTokens(divorce).map((t) => t.kind))
    for (const kind of ['comment', 'style', 'logic', 'var', 'helper']) {
      expect(divorceKinds.has(kind as never)).toBe(true)
    }
  })
})
