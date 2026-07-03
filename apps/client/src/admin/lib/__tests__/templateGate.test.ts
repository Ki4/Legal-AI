import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runParseGate, localizeEngineError } from '../templateGate'

// Load the REAL doc-engine (the '@doc-engine' vite alias is unavailable under
// `vitest run`) — the gate must behave exactly like production parsing.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../..')
const require = createRequire(import.meta.url)
const engine = require(resolve(repoRoot, 'n8n/templates/render-document.js'))

const render = (tpl: string) => engine.renderDocumentWithStyles(tpl, engine.buildContext({}, {}))
const gate = (tpl: string) => runParseGate(render, tpl)

describe('runParseGate (real engine)', () => {
  it('passes a valid template with interpolation, style directives and logic', () => {
    const tpl = [
      '{{!style: right}}',
      'До суду',
      'Позивач: {{plaintiff_name}}',
      '{{#if has_children}}',
      '{{#each children}}Дитина: {{name}}{{/each}}',
      '{{/if}}',
      '{{!style: keep-block}}',
      'Додатки: …',
      'Підпис',
      '{{!style: /keep-block}}',
    ].join('\n')
    expect(gate(tpl)).toEqual({ ok: true })
  })

  it('blocks an unclosed {{#if}} with a plain-Ukrainian message', () => {
    const r = gate('Текст\n{{#if has_children}}\nбез закриття')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/^Помилка в шаблоні: /)
  })

  it('blocks an unclosed {{#each}}', () => {
    expect(gate('{{#each children}} {{name}}').ok).toBe(false)
  })

  it('blocks an unknown helper call', () => {
    expect(gate("{{bogusHelper first_name 'x'}}").ok).toBe(false)
  })

  it('blocks a stray {{/if}} outside a block', () => {
    expect(gate('текст {{/if}} текст').ok).toBe(false)
  })

  it('treats plain text and lone braces as valid (no false positives)', () => {
    expect(gate('Звичайний текст без тегів.').ok).toBe(true)
    expect(gate('Пункт 1) текст { не тег } текст').ok).toBe(true)
  })

  it('passes inline runs and blocks broken ones (styleHints v2)', () => {
    expect(gate('Позивач: {{#bold}}{{plaintiff_name}}{{/bold}}').ok).toBe(true)
    expect(gate('{{#bold}}без закриття').ok).toBe(false)
    expect(gate('текст {{/bold}}').ok).toBe(false)
    expect(gate('{{#if has_children}}{{#bold}}х{{/if}}{{/bold}}').ok).toBe(false) // straddles the block
  })
})

describe('localizeEngineError — real engine messages arrive in Ukrainian', () => {
  const errorOf = (tpl: string): string => {
    const r = gate(tpl)
    if (r.ok) throw new Error('expected a parse failure')
    return r.error
  }

  it('unclosed {{#if}} / {{#each}}', () => {
    expect(errorOf('Текст\n{{#if has_children}}\nбез закриття')).toBe(
      'Помилка в шаблоні: блок {{#if}} відкрито в рядку 2, але він не закритий — додайте закривальний тег',
    )
    expect(errorOf('{{#each children}} {{name}}')).toMatch(/блок \{\{#each\}\} відкрито в рядку 1/)
  })

  it('unknown helper', () => {
    expect(errorOf("{{bogusHelper first_name 'x'}}")).toMatch(
      /невідомий тег "bogusHelper" у рядку 1/,
    )
  })

  it('stray {{/if}}', () => {
    expect(errorOf('текст {{/if}} текст')).toMatch(/зайвий тег \{\{\/if\}\} у рядку 1/)
  })

  it('broken condition expression', () => {
    expect(errorOf('{{#if has_children ==}}x{{/if}}')).toMatch(/помилка в умові/)
  })

  it('unknown messages fall through verbatim', () => {
    expect(localizeEngineError('Something novel exploded')).toBe('Something novel exploded')
  })

  it('stray {{! mid-template: the swallowed src spans LINES and still localizes (s66 tail)', () => {
    // A lone `{{!` inside an expression swallows the following lines into one
    // tag — the engine's src blob then contains '\n', which `.+?` never matches.
    const tpl = '{{#if a {{!\nЗразок тексту\nще рядок}}\nx\n{{/if}}'
    expect(errorOf(tpl)).toMatch(/^Помилка в шаблоні: помилка в умові "/)
    // and the raw engine message for the same case localizes directly:
    expect(
      localizeEngineError('Unexpected "{{!" in expression "a {{!\nтекст" at line 1'),
    ).toBe('помилка в умові "a {{!\nтекст" (рядок 1) — перевірте вираз')
  })

  it('inline runs (styleHints v2): unclosed / mismatched / stray in Ukrainian', () => {
    expect(errorOf('рядок\n{{#bold}}без закриття')).toBe(
      'Помилка в шаблоні: інлайн-стиль {{#bold}} відкрито в рядку 2, але не закрито — додайте {{/bold}} у тому самому блоці',
    )
    expect(errorOf('{{#bold}}х{{/italic}}')).toBe(
      'Помилка в шаблоні: тег {{/italic}} у рядку 1 не збігається: очікується {{/bold}} для {{#bold}}, відкритого в рядку 1',
    )
    expect(errorOf('текст {{/underline}}')).toMatch(/зайвий тег \{\{\/underline\}\} у рядку 1/)
  })
})
