// styleHints v2 "runs" (S2 slice B, template-editor §5b): inline character
// styles {{#bold}}…{{/bold}} / {{#italic}} / {{#underline}}. Legally-critical
// engine change — the parity block proves old templates render byte-identical.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module (repo convention: n8n templates use module.exports; the
// loaded code is a static repo file, not untrusted input)
const engine = (() => {
  const code = readFileSync(resolve(__dirname, '../render-document.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

const { renderDocument, renderDocumentWithStyles, buildContext } = engine

const rs = (tpl, ctx = {}) => renderDocumentWithStyles(tpl, ctx)

// ─── Parity: templates WITHOUT run tags are untouched ────────────────────────

describe('runs parity — no run tags → nothing changes', () => {
  const realTemplates = ['divorce', 'alimony', 'alimony-change'].map((slug) =>
    resolve(__dirname, `../services/${slug}.document.txt`),
  )

  it('real service templates render byte-identical text and empty styleRuns', () => {
    const ctx = buildContext({}, {})
    for (const path of realTemplates) {
      const tpl = readFileSync(path, 'utf8')
      const plain = renderDocument(tpl, ctx)
      const { text, styleRuns } = renderDocumentWithStyles(tpl, ctx)
      expect(text).toBe(plain)
      expect(styleRuns).toEqual({})
    }
  })

  it('styleHints v1 output shape is unchanged for a template without runs', () => {
    const { styleHints, styleRuns } = rs('{{!style: center bold}}\nЗАЯВА\nтекст')
    expect(styleHints).toEqual({ 0: ['center', 'bold'] })
    expect(styleRuns).toEqual({})
  })
})

// ─── Text output: run tags are markers, not text ─────────────────────────────

describe('runs — text output', () => {
  it('renderDocument strips run tags from the text', () => {
    expect(renderDocument('Позивач: {{#bold}}Іваненко{{/bold}}, далі', {}))
      .toBe('Позивач: Іваненко, далі')
  })

  it('renderDocumentWithStyles returns the same text as renderDocument', () => {
    const tpl = 'а {{#bold}}б {{#italic}}в{{/italic}}{{/bold}} г'
    expect(rs(tpl).text).toBe(renderDocument(tpl, {}))
  })

  it('run tags standing alone on a line consume the line (standalone rule)', () => {
    const out = renderDocument('{{#bold}}\nЖирний абзац\n{{/bold}}\nЗвичайний', {})
    expect(out).toBe('Жирний абзац\nЗвичайний')
  })
})

// ─── Offsets: measured AFTER variable substitution ───────────────────────────

describe('runs — offsets after substitution', () => {
  it('marks exactly the substituted value', () => {
    const { text, styleRuns } = rs('Позивач: {{#bold}}{{name}}{{/bold}}, тел.', { name: 'Іваненко Іван' })
    expect(text).toBe('Позивач: Іваненко Іван, тел.')
    expect(styleRuns).toEqual({ 0: [{ start: 9, end: 22, styles: ['bold'] }] })
    expect(text.slice(9, 22)).toBe('Іваненко Іван')
  })

  it('offsets shift with the value length, not the tag length', () => {
    const short = rs('x {{#bold}}{{v}}{{/bold}} y', { v: 'аб' })
    const long = rs('x {{#bold}}{{v}}{{/bold}} y', { v: 'абвгдеєж' })
    expect(short.styleRuns[0]).toEqual([{ start: 2, end: 4, styles: ['bold'] }])
    expect(long.styleRuns[0]).toEqual([{ start: 2, end: 10, styles: ['bold'] }])
  })

  it('empty range {{#bold}}{{/bold}} produces no run', () => {
    expect(rs('а{{#bold}}{{/bold}}б').styleRuns).toEqual({})
  })

  it('fallback ________ inside a run is styled too (offsets stay honest)', () => {
    const { text, styleRuns } = rs('{{#bold}}{{missing}}{{/bold}}')
    expect(text).toBe('________')
    expect(styleRuns[0]).toEqual([{ start: 0, end: 8, styles: ['bold'] }])
  })
})

// ─── Paragraph splitting ─────────────────────────────────────────────────────

describe('runs — multi-paragraph ranges split per paragraph', () => {
  it('a run spanning \\n is split into per-paragraph relative ranges', () => {
    const { styleRuns } = rs('аб{{#bold}}вг\nде{{/bold}}жз')
    expect(styleRuns).toEqual({
      0: [{ start: 2, end: 4, styles: ['bold'] }],
      1: [{ start: 0, end: 2, styles: ['bold'] }],
    })
  })

  it('a run wrapping whole standalone-tag lines styles the inner paragraphs only', () => {
    const { text, styleRuns } = rs('{{#bold}}\nперший\nдругий\n{{/bold}}\nхвіст')
    expect(text).toBe('перший\nдругий\nхвіст')
    expect(styleRuns).toEqual({
      0: [{ start: 0, end: 6, styles: ['bold'] }],
      1: [{ start: 0, end: 6, styles: ['bold'] }],
    })
  })
})

// ─── Interaction with if / each ──────────────────────────────────────────────

describe('runs — inside and around blocks', () => {
  it('a run may wrap a whole {{#if}} block', () => {
    const tpl = '{{#bold}}до {{#if flag}}так{{else}}ні{{/if}} після{{/bold}}'
    expect(rs(tpl, { flag: true }).styleRuns[0]).toEqual([{ start: 0, end: 12, styles: ['bold'] }])
    expect(rs(tpl, { flag: false }).styleRuns[0]).toEqual([{ start: 0, end: 11, styles: ['bold'] }])
  })

  it('runs inside {{#each}} mark every iteration', () => {
    const { text, styleRuns } = rs(
      '{{#each items}}{{#bold}}{{this}}{{/bold}}; {{/each}}',
      { items: ['аа', 'ббб'] },
    )
    expect(text).toBe('аа; ббб; ')
    expect(styleRuns[0]).toEqual([
      { start: 0, end: 2, styles: ['bold'] },
      { start: 4, end: 7, styles: ['bold'] },
    ])
  })

  it('a run in a non-taken branch produces nothing', () => {
    const { styleRuns } = rs('{{#if flag}}{{#bold}}х{{/bold}}{{/if}}звичайний', { flag: false })
    expect(styleRuns).toEqual({})
  })
})

// ─── Nesting and overlap ─────────────────────────────────────────────────────

describe('runs — nesting', () => {
  it('nested different styles produce overlapping separate runs', () => {
    const { text, styleRuns } = rs('{{#bold}}аб {{#italic}}вг{{/italic}}{{/bold}}')
    expect(text).toBe('аб вг')
    expect(styleRuns[0]).toEqual([
      { start: 0, end: 5, styles: ['bold'] },
      { start: 3, end: 5, styles: ['italic'] },
    ])
  })

  it('nested same style pairs innermost-first (both ranges kept)', () => {
    const { styleRuns } = rs('{{#bold}}а{{#bold}}б{{/bold}}в{{/bold}}')
    expect(styleRuns[0]).toEqual([
      { start: 0, end: 3, styles: ['bold'] },
      { start: 1, end: 2, styles: ['bold'] },
    ])
  })

  it('underline works as a run style', () => {
    expect(rs('{{#underline}}пкт{{/underline}}').styleRuns[0])
      .toEqual([{ start: 0, end: 3, styles: ['underline'] }])
  })
})

// ─── Parse gate: broken runs are publish-blocking errors ─────────────────────

describe('runs — parse errors', () => {
  it('unclosed {{#bold}} throws with line number', () => {
    expect(() => rs('рядок\n{{#bold}}без закриття')).toThrow('Unclosed {{#bold}} opened at line 2')
  })

  it('stray {{/bold}} throws', () => {
    expect(() => rs('текст {{/bold}}')).toThrow('Unexpected {{/bold}} at line 1')
  })

  it('mismatched close names the open tag', () => {
    expect(() => rs('{{#bold}}х{{/italic}}'))
      .toThrow('Unexpected {{/italic}} at line 1 (expected {{/bold}} for {{#bold}} opened at line 1)')
  })

  it('a run may not straddle an {{#if}} boundary (open inside, close outside)', () => {
    expect(() => rs('{{#if f}}{{#bold}}х{{/if}}{{/bold}}', { f: true }))
      .toThrow('Unclosed {{#bold}} opened at line 1')
  })

  it('a run opened before a branch and closed inside it is rejected too', () => {
    expect(() => rs('{{#bold}}{{#if f}}х{{/bold}}{{/if}}', { f: true }))
      .toThrow('Unexpected {{/bold}} at line 1')
  })

  it('unknown #-tags are NOT widened into runs — they stay plain interp fallbacks', () => {
    // Guards the RUN_STYLES whitelist: {{#strike}} is not a run, so it renders
    // as an unresolvable path (________), exactly like before this feature.
    expect(renderDocument('{{#strike}}х{{/strike}}', {})).toBe('________х________')
  })
})
