import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runParseGate } from '../templateGate'

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
})
