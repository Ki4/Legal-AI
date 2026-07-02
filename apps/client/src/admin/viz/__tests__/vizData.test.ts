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

// ─── Citation parsing edge cases ──────────────────────────────────────────────
describe('liveServiceToViz — citations', () => {
  const form = (...ids: string[]): FormConfig => ({
    service_id: 's', title: 'S', tabs: [{ id: 'p', label: 'P' }],
    steps: ids.map((id) => ({ id, tab: 'p', type: 'text', label: id })),
  })

  it('parses genitive-case statute names across multiple laws and short-tags each', () => {
    // Templates cite laws in the genitive ("Сімейного кодексу", "Цивільного процесуального…").
    // A multi-article list under one statute uses the double abbreviation "ст.ст. 110, 112".
    const tpl = `{{last_name}}. ст.ст. 110, 112 Сімейного кодексу України;
ст. 175 Цивільного процесуального кодексу України; ст. 4 Закону України «Про судовий збір».`
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: tpl, form_config: form('last_name') })

    // Three distinct laws, in registry order, with the correct short law tags on each article.
    const subs = viz.articles.map((a) => a.sub)
    expect(new Set(subs)).toEqual(new Set(['СК України', 'ЦПК України', 'Про судовий збір']))
    // ст. 110 + 112 (СК) + 175 (ЦПК) + 4 (ПСЗ) = 4 article nodes.
    expect(viz.articles.map((a) => a.label).sort()).toEqual(['ст. 110', 'ст. 112', 'ст. 175', 'ст. 4'])

    // citations[] mirrors laws→articles with canonical (nominative) titles, articles as strings.
    expect(viz.citations.map((c) => c.slug)).toEqual(['simeinyi-kodeks', 'tsyvilnyi-protsesualnyi-kodeks', 'pro-sudovyi-zbir'])
    const sk = viz.citations.find((c) => c.slug === 'simeinyi-kodeks')!
    expect(sk.title).toBe('Сімейний кодекс України')
    expect(sk.articles).toEqual(['110', '112'])
  })

  it('reads a comma list under a single "ст." too, same as the double abbreviation', () => {
    // The single "ст." abbreviation is grammatically for one article, but hand-edited templates
    // use it for lists — "ст. 110, 112 СК" must capture BOTH articles, not drop them. "ст.ст. …"
    // (double abbreviation) reads the same list. (serviceAnatomy: single branch → ARTICLE_LIST.)
    const bare = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '{{a}} ст. 110, 112 Сімейного кодексу України.', form_config: form('a') })
    expect(bare.articles.map((n) => n.label)).toEqual(['ст. 110', 'ст. 112'])
    const dbl = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '{{a}} ст.ст. 110, 112 Сімейного кодексу України.', form_config: form('a') })
    expect(dbl.articles.map((n) => n.label)).toEqual(['ст. 110', 'ст. 112'])
  })

  it('dedupes a repeated article citation into a single node', () => {
    const tpl = '{{a}} ст. 110 Сімейного кодексу України ... знову ст. 110 Сімейного кодексу України.'
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: tpl, form_config: form('a') })
    expect(viz.articles).toHaveLength(1)
    expect(viz.citations[0].articles).toEqual(['110'])
  })

  it('yields no articles, no doc, and a non-green health for an empty template', () => {
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '', form_config: form('a') })
    expect(viz.articles).toEqual([])
    expect(viz.citations).toEqual([])
    expect(viz.doc).toBeNull()
    expect(viz.health).toBe('problem') // template mode but no template → red
  })

  it('yields no articles for a template that cites nothing recognizable', () => {
    const tpl = '{{a}} Просто текст без жодних посилань на статтю.'
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: tpl, form_config: form('a') })
    expect(viz.articles).toEqual([])
    expect(viz.citations).toEqual([])
  })

  it('reports a green/ok health when template, fields and citations all line up', () => {
    const tpl = '{{a}} ст. 110 Сімейного кодексу України.'
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: tpl, form_config: form('a') })
    expect(viz.counts).toEqual({ used: 1, extra: 0, missing: 0, total: 1 })
    expect(viz.health).toBe('ok')
  })
})

// ─── Defensive defaults for malformed / partial rows ──────────────────────────
describe('liveServiceToViz — defensive defaults', () => {
  it('falls back to an empty form when form_config is null', () => {
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '{{a}} ст. 110 Сімейного кодексу України.', form_config: null })
    // {{a}} has no form field → an unmatched placeholder (missing), zero real fields.
    expect(viz.fields.some((f) => f.id === 'a' && f.map === 'missing')).toBe(true)
    expect(viz.counts.total).toBe(0)
    expect(viz.health).toBe('problem')
  })

  it('falls back to an empty form when form_config.steps is not an array', () => {
    const viz = liveServiceToViz({
      slug: 'x', title: 'X', generation_mode: 'template', document_template: '',
      // malformed shape — steps missing
      form_config: { service_id: 's', title: 'T', tabs: [] } as unknown as FormConfig,
    })
    expect(viz.fields).toEqual([])
    expect(viz.counts.total).toBe(0)
  })

  it('defaults id to slug, icon to null and price to 0 when absent', () => {
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '', form_config: null })
    expect(viz.id).toBe('x')      // no id on the row → slug
    expect(viz.icon).toBeNull()
    expect(viz.price).toBe(0)
  })

  it('keeps the explicit id and price when present', () => {
    const viz = liveServiceToViz({ id: 'real-id', slug: 'x', title: 'X', price: 250, icon: '⚖️', generation_mode: 'template', document_template: '', form_config: null })
    expect(viz.id).toBe('real-id')
    expect(viz.price).toBe(250)
    expect(viz.icon).toBe('⚖️')
  })

  it('exempts a legacy generation_mode="js" service from the "needs a template" red', () => {
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'js', document_template: '', form_config: null })
    // js mode has no template but is not red for it; the amber legacy note → warn.
    expect(viz.health).toBe('warn')
  })

  // issue #86: a js-mode service whose DB row holds a drifted DRAFT template must not viz-scream.
  it('js mode + drifted dormant template → warn health, no "__missing" group, flagged non-authoritative', () => {
    const form: FormConfig = {
      service_id: 's', title: 'S', tabs: [{ id: 'p', label: 'P' }],
      steps: [{ id: 'respondent_last_name', tab: 'p', type: 'text', label: 'Прізвище' }],
    }
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'js', document_template: '{{defendant_employer}} {{plaintiff_phone}}', form_config: form })
    expect(viz.templateAuthoritative).toBe(false)
    expect(viz.health).toBe('warn')                                   // not 'problem'
    expect(viz.tabs.some((t) => t.id === '__missing')).toBe(false)    // no alarm group
    expect(viz.counts.missing).toBe(2)                                // …but the count stays informational
  })

  it('template mode keeps the "__missing" group and problem health for the same drift', () => {
    const form: FormConfig = {
      service_id: 's', title: 'S', tabs: [{ id: 'p', label: 'P' }],
      steps: [{ id: 'respondent_last_name', tab: 'p', type: 'text', label: 'Прізвище' }],
    }
    const viz = liveServiceToViz({ slug: 'x', title: 'X', generation_mode: 'template', document_template: '{{defendant_employer}} {{plaintiff_phone}}', form_config: form })
    expect(viz.templateAuthoritative).toBe(true)
    expect(viz.health).toBe('problem')
    expect(viz.tabs.some((t) => t.id === '__missing')).toBe(true)
  })
})
