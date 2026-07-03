import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  findEmittingLine,
  matchTemplateBlocks,
  matchTemplateRuns,
  scanTemplateTokens,
  styleKeywordsOf,
} from '../templateTokens'
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

  it('returns [] keywords for an empty {{!style:}} — the editor shows the raw tag, not a blank pill (s67 finding)', () => {
    const text = '{{!style:}}'
    expect(styleKeywordsOf(text, scanTemplateTokens(text)[0])).toEqual([])
  })

  it('requires the colon for style tags — engine parity (a colon-less {{!styleXYZ}} is a comment to the engine)', () => {
    expect(kindsOf('{{!styleXYZ}}')).toEqual(['comment'])
    expect(kindsOf('{{!style bold}}')).toEqual(['comment'])
    expect(kindsOf('{{!style:}}')).toEqual(['style'])
    expect(kindsOf('{{!style: bold}}')).toEqual(['style'])
  })

  it('never throws and covers the claim skeleton and the real divorce template (+findEmittingLine total)', () => {
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
    // findEmittingLine is total over the real template: every line resolves.
    const lineCount = divorce.split('\n').length
    for (let i = 0; i < lineCount; i++) {
      expect(findEmittingLine(divorce, i)).not.toBeNull()
    }
  })
})

describe('matchTemplateRuns — inline {{#bold}}…{{/bold}} ranges for editor marks (slice C)', () => {
  it('matches runs of every style with exact inner ranges', () => {
    const text = 'Позивач: {{#bold}}{{plaintiff_name}}{{/bold}} і {{#italic}}текст{{/italic}}'
    const runs = matchTemplateRuns(text)
    expect(runs.map((r) => r.style)).toEqual(['bold', 'italic'])
    expect(text.slice(runs[0].openTo, runs[0].closeFrom)).toBe('{{plaintiff_name}}')
    expect(text.slice(runs[1].openTo, runs[1].closeFrom)).toBe('текст')
  })

  it('tolerates broken pairs while typing — drops them, never throws', () => {
    expect(matchTemplateRuns('{{#bold}}без закриття')).toEqual([])
    expect(matchTemplateRuns('текст {{/bold}}')).toEqual([])
    // a close pops the NEAREST open of its style; the italic stays open → dropped
    const runs = matchTemplateRuns('{{#bold}}а {{#italic}}б{{/bold}}')
    expect(runs.map((r) => r.style)).toEqual(['bold'])
  })

  it('does not confuse runs with control flow or vars', () => {
    expect(matchTemplateRuns('{{#if a}}x{{/if}} {{boldness}}')).toEqual([])
  })
})

describe('findEmittingLine — caret line → nearest line that reaches the output (S2 slice C)', () => {
  const tpl = [
    '{{! коментар }}', // 0 — swallowed
    '{{!style: center bold}}', // 1 — swallowed (styles line 2)
    'ПОЗОВНА ЗАЯВА', // 2 — emits
    '', // 3 — blank line emits an empty paragraph
    '{{#if has_children}}', // 4 — swallowed
    'Діти: {{n_children}}', // 5 — emits
    '{{/if}}', // 6 — swallowed
    'Підпис {{!style: keep-with-next}}', // 7 — text around an inline tag emits
  ].join('\n')

  it('keeps a content line as its own host', () => {
    expect(findEmittingLine(tpl, 2)).toBe(2)
    expect(findEmittingLine(tpl, 5)).toBe(5)
  })

  it('walks a comment/style/logic-only line FORWARD to the paragraph it affects', () => {
    expect(findEmittingLine(tpl, 0)).toBe(2)
    expect(findEmittingLine(tpl, 1)).toBe(2) // directive styles the next paragraph
    expect(findEmittingLine(tpl, 4)).toBe(5) // {{#if}} opens the branch below
  })

  it('treats a blank line as emitting (empty paragraph) and text around inline tags too', () => {
    expect(findEmittingLine(tpl, 3)).toBe(3)
    expect(findEmittingLine(tpl, 7)).toBe(7)
  })

  it('falls back BACKWARD when nothing emits below (trailing directive at EOF)', () => {
    const t = 'Текст\n{{!style: keep-block}}'
    expect(findEmittingLine(t, 1)).toBe(0)
  })

  it('skips lines crossed by a multi-line tag (no safe place for extra text)', () => {
    const t = 'A\n{{#if\nhas_children}}\nB\n{{/if}}'
    expect(findEmittingLine(t, 1)).toBe(3) // both tag lines skipped → 'B'
    expect(findEmittingLine(t, 2)).toBe(3)
  })

  it('returns null for an all-directive template and out-of-range lines', () => {
    expect(findEmittingLine('{{! a }}\n{{#if x}}\n{{/if}}', 0)).toBeNull()
    expect(findEmittingLine(tpl, -1)).toBeNull()
    expect(findEmittingLine(tpl, 99)).toBeNull()
    expect(findEmittingLine('', 0)).toBe(0) // single empty line — an empty paragraph
  })
})
