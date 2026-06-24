import { describe, it, expect } from 'vitest'
import { liveServiceToViz } from '../vizData'
import type { FormConfig } from '../../../types/form'

// A small divorce-shaped service: the template prints last_name/first_name directly and cites
// ст. 110 СК; it also references {{property_details}} the form never asks; the form has a `phone`
// field the template never uses. So: used=2, extra=1 (phone), missing=1 (property_details).
const FORM: FormConfig = {
  service_id: 's', title: 'Розлучення', tabs: [{ id: 'parties', label: 'Сторони' }, { id: 'contacts', label: 'Контакти' }],
  steps: [
    { id: 'last_name', tab: 'parties', type: 'text', label: 'Прізвище' },
    { id: 'first_name', tab: 'parties', type: 'text', label: "Ім'я" },
    { id: 'phone', tab: 'contacts', type: 'phone', label: 'Телефон' },
  ],
}
const TEMPLATE = `Позивач {{last_name}} {{first_name}}.
Відповідно до ст. 110 Сімейного кодексу України, прошу розірвати шлюб.
Майно: {{property_details}}.`

const ROW = {
  id: 'divorce', slug: 'divorce', title: 'Розірвання шлюбу', icon: '⚖️', price: 0,
  status: 'active', generation_mode: 'template', document_template: TEMPLATE, form_config: FORM,
}

describe('liveServiceToViz', () => {
  const viz = liveServiceToViz(ROW)

  it('carries through identity + status', () => {
    expect(viz.slug).toBe('divorce')
    expect(viz.title).toBe('Розірвання шлюбу')
    expect(viz.status).toBe('active')
    expect(viz.requestsPerMonth).toBeNull() // no analytics source
  })

  it('computes anatomy counts from the template/form diff', () => {
    expect(viz.counts).toEqual({ used: 2, extra: 1, missing: 1, total: 3 })
  })

  it('maps each form field to used / extra', () => {
    const byId = Object.fromEntries(viz.fields.map((f) => [f.id, f.map]))
    expect(byId.last_name).toBe('used')
    expect(byId.first_name).toBe('used')
    expect(byId.phone).toBe('extra')
  })

  it('adds unmatched placeholders as a "missing" group', () => {
    const missing = viz.fields.find((f) => f.id === 'property_details')
    expect(missing?.map).toBe('missing')
    expect(missing?.tab).toBe('__missing')
    expect(viz.tabs.some((t) => t.id === '__missing')).toBe(true)
  })

  it('derives article nodes from template citations', () => {
    expect(viz.articles).toHaveLength(1)
    expect(viz.articles[0].label).toBe('ст. 110')
    expect(viz.articles[0].sub).toBe('СК України')
    expect(viz.articles[0].kind).toBe('art')
  })

  it('exposes a document node and a non-green health (missing placeholder)', () => {
    expect(viz.doc?.kind).toBe('doc')
    expect(viz.health).toBe('problem') // unmatched placeholder → red/problem
  })
})
