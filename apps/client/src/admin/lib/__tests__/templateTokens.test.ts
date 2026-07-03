import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { matchTemplateBlocks, scanTemplateTokens, styleKeywordsOf } from '../templateTokens'
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

  it('matches nested if/each blocks and reports exact tag ranges', () => {
    const text = '{{#if a}}\n{{#each children}}\n{{raw}}\n{{/each}}\n{{else}}\nx\n{{/if}}'
    const blocks = matchTemplateBlocks(text)
    expect(blocks.map((b) => b.kind)).toEqual(['if', 'each'])
    const ifBlock = blocks[0]
    expect(text.slice(ifBlock.openFrom, ifBlock.openTo)).toBe('{{#if a}}')
    expect(text.slice(ifBlock.closeFrom, ifBlock.closeTo)).toBe('{{/if}}')
    const each = blocks[1]
    expect(each.openFrom).toBeGreaterThan(ifBlock.openFrom)
    expect(each.closeTo).toBeLessThan(ifBlock.closeFrom)
  })

  it('tolerates broken pairs while typing — drops them, never throws', () => {
    expect(matchTemplateBlocks('{{#if a}} без закриття')).toEqual([])
    expect(matchTemplateBlocks('текст {{/if}} без відкриття')).toEqual([])
    // stray /each inside an if: the if still matches its own /if
    const blocks = matchTemplateBlocks('{{#if a}}{{/each}}{{/if}}')
    expect(blocks.map((b) => b.kind)).toEqual(['if'])
  })

  it('extracts style keywords from a {{!style:}} tag', () => {
    const text = '{{!style: center bold keep-with-next}}\nЗАГОЛОВОК'
    const [token] = scanTemplateTokens(text)
    expect(styleKeywordsOf(text, token)).toEqual(['center', 'bold', 'keep-with-next'])
    const closer = '{{!style: /keep-block}}'
    expect(styleKeywordsOf(closer, scanTemplateTokens(closer)[0])).toEqual(['/keep-block'])
  })

  it('keeps exact positions in CRLF text (SQL-imported templates may carry \\r\\n)', () => {
    const text = 'Позивач: {{plaintiff_name}}\r\n{{!style: center}}\r\nЗАЯВА'
    const [a, b] = scanTemplateTokens(text)
    expect(text.slice(a.from, a.to)).toBe('{{plaintiff_name}}')
    expect(text.slice(b.from, b.to)).toBe('{{!style: center}}')
  })

  it('finds adjacent tags with zero gap — monotonic ranges hold at the boundary', () => {
    const tokens = scanTemplateTokens('{{first_name}}{{last_name}}')
    expect(tokens.map((t) => [t.from, t.to])).toEqual([
      [0, 14],
      [14, 27],
    ])
  })

  it('classifies an empty tag {{}} as helper without crashing', () => {
    expect(kindsOf('{{}}')).toEqual(['helper'])
  })

  it('finds the inner tag of triple braces {{{x}}} with exact offsets', () => {
    const text = 'сума: {{{amount}}}'
    const [t] = scanTemplateTokens(text)
    expect(text.slice(t.from, t.to)).toBe('{{amount}}')
  })

  it('matches a tag whose inner text spans lines (char class admits \\n)', () => {
    const tokens = scanTemplateTokens('{{#if\nhas_children}}')
    expect(tokens.map((t) => t.kind)).toEqual(['logic'])
  })

  it('tolerates CROSSED pairs: /if pops its open and silently drops the each under it', () => {
    // {{#if}} {{#each}} {{/if}} {{/each}} — mid-edit state; the gate, not the
    // scanner, is what blocks publishing. The if matches; the each is dropped.
    const blocks = matchTemplateBlocks('{{#if a}}\n{{#each b}}\n{{/if}}\n{{/each}}')
    expect(blocks.map((b) => b.kind)).toEqual(['if'])
  })

  it('matches an open/close pair on the SAME line (fold service must offer no fold)', () => {
    const text = '{{#if a}}текст{{/if}}'
    const [b] = matchTemplateBlocks(text)
    expect(b.kind).toBe('if')
    expect(b.openFrom).toBe(0)
    expect(text.slice(b.closeFrom, b.closeTo)).toBe('{{/if}}')
  })

  it('returns [] keywords for an empty {{!style:}} — the pill renders blank (see report)', () => {
    const text = '{{!style:}}'
    expect(styleKeywordsOf(text, scanTemplateTokens(text)[0])).toEqual([])
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
