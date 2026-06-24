import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { FormConfig } from '../../types/form'
import {
  analyzeTemplate,
  extractArticlesByLaw,
  diffFormVsTemplate,
  collectBrokenShowIf,
  collectEmptyLabelFields,
  describeShowIf,
  serviceHealth,
  fieldTypeLabel,
  lawCodeFromUrl,
  analyzeService,
} from '../serviceAnatomy'
import { divorceFormConfig } from '../../data/divorceFormConfig'
import { alimonyChangeFormConfig } from '../../data/alimonyChangeFormConfig'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')
const tpl = (slug: string) => readFileSync(resolve(REPO, `n8n/templates/services/${slug}.document.txt`), 'utf8')
const golden = (slug: string) => JSON.parse(readFileSync(resolve(REPO, `n8n/templates/services/${slug}.citations.json`), 'utf8'))

// ───────────────────────────── Citations (parity vs goldens) ─────────────────
describe('extractArticlesByLaw — parity with goldens', () => {
  for (const slug of ['divorce', 'alimony', 'alimony-change']) {
    it(`${slug}.document.txt citations === ${slug}.citations.json`, () => {
      expect(extractArticlesByLaw(tpl(slug))).toEqual(golden(slug).laws)
    })
  }

  it('handles list and range forms', () => {
    const r = extractArticlesByLaw('ст.ст. 150, 180–184 СК України та ст.27 ЦПК України')
    const sk = r.find((l) => l.slug === 'simeinyi-kodeks')!
    expect(sk.articles).toEqual(['150', '180', '181', '182', '183', '184'])
    expect(r.find((l) => l.slug === 'tsyvilnyi-protsesualnyi-kodeks')!.articles).toEqual(['27'])
  })

  it('reads a comma list under a single "ст." (not only "ст.ст.")', () => {
    // "ст. 110, 112 СК" — single abbreviation + comma list — captures BOTH articles.
    const r = extractArticlesByLaw('ст. 110, 112 Сімейного кодексу України; ст. 4 Закону України «Про судовий збір»')
    expect(r.find((l) => l.slug === 'simeinyi-kodeks')!.articles).toEqual(['110', '112'])
    expect(r.find((l) => l.slug === 'pro-sudovyi-zbir')!.articles).toEqual(['4'])
  })

  it('does not bleed a list across a law boundary', () => {
    // The list stops at the law name: "ст. 110 СК ... ст. 60 ЦПК" → 110 under СК, 60 under ЦПК.
    const r = extractArticlesByLaw('ст. 110 Сімейного кодексу України, ст. 175 Цивільного процесуального кодексу України')
    expect(r.find((l) => l.slug === 'simeinyi-kodeks')!.articles).toEqual(['110'])
    expect(r.find((l) => l.slug === 'tsyvilnyi-protsesualnyi-kodeks')!.articles).toEqual(['175'])
  })

  it('empty / no-citation text → []', () => {
    expect(extractArticlesByLaw('')).toEqual([])
    expect(extractArticlesByLaw('Просто текст без посилань')).toEqual([])
  })
})

// ───────────────────────────── Template path extraction ──────────────────────
describe('analyzeTemplate', () => {
  it('collects depth-0 field refs, excludes loop-item + meta + computed', () => {
    const a = analyzeTemplate(`
      {{last_name}} {{plaintiff_name}}
      {{#if has_children}}{{#each children}}{{name}} {{@index1}} {{this}}{{/each}}{{/if}}
      {{!style: center bold}}
      {{! a comment }}
      {{formatDate marriage_date}}
    `)
    // direct form fields present
    expect(a.fieldRefs).toContain('last_name')
    expect(a.fieldRefs).toContain('marriage_date') // helper arg
    // computed keys are NOT field refs
    expect(a.fieldRefs).not.toContain('plaintiff_name')
    expect(a.fieldRefs).not.toContain('has_children')
    // loop-item + meta + comments never leak
    expect(a.fieldRefs).not.toContain('name')
    expect(a.fieldRefs).not.toContain('this')
    expect(a.fieldRefs.some((f) => f.startsWith('@'))).toBe(false)
    expect(a.eachPaths).toContain('children')
    expect(a.computedRefs).toContain('plaintiff_name')
  })

  it('strips |raw and helper names', () => {
    const a = analyzeTemplate("{{surname_after_divorce|raw}} {{gender plaintiff_gender 'він' 'вона'}}")
    expect(a.fieldRefs).toContain('surname_after_divorce')
    expect(a.fieldRefs).not.toContain('gender') // helper name
  })

  it('empty template → hasTemplate false', () => {
    expect(analyzeTemplate('').hasTemplate).toBe(false)
    expect(analyzeTemplate('   ').hasTemplate).toBe(false)
    expect(analyzeTemplate('x').hasTemplate).toBe(true)
  })
})

// ───────────────── Real-template diff: no FALSE unmatched from computed layer ──
// The analyzer must not flag computed-layer keys (plaintiff_name, court_fee, children…)
// as unmatched. alimony-change is fully aligned. divorce has a REAL gap the mirror
// surfaces: the template prints {{property_details}} / {{debt_details}} (the property/debt
// description in the petition), but the form only asks has_joint_property/property_dispute/
// debt_claim — never the description itself, so it renders '________' in production.
// (Flagged to Sergey — verify vs live config + decide if the form should collect them.)
const COMPUTED_KEYS = ['plaintiff_name', 'defendant_name', 'children', 'has_children', 'n_children', 'court_fee', 'price_of_claim', 'ai']

describe('diffFormVsTemplate — real templates', () => {
  it('alimony-change: zero unmatched (fully aligned)', () => {
    const diff = diffFormVsTemplate(alimonyChangeFormConfig, analyzeTemplate(tpl('alimony-change')))
    expect(diff.unmatchedPlaceholders).toEqual([])
  })

  it('divorce: surfaces only the real property/debt-description gap', () => {
    const diff = diffFormVsTemplate(divorceFormConfig, analyzeTemplate(tpl('divorce')))
    expect(diff.unmatchedPlaceholders).toEqual(['debt_details', 'property_details'])
    // never a false positive from the computed layer
    for (const k of COMPUTED_KEYS) expect(diff.unmatchedPlaceholders).not.toContain(k)
  })
})

// ───────────────────────────── diff on synthetic fixtures ────────────────────
describe('diffFormVsTemplate — fixtures', () => {
  const form: FormConfig = {
    service_id: 'x', title: 'X', tabs: [{ id: 't', label: 'T' }],
    steps: [
      { id: 'last_name', tab: 't', type: 'text', label: 'Прізвище' },
      { id: 'first_name', tab: 't', type: 'text', label: "Ім'я" },
      { id: 'middle_name', tab: 't', type: 'text', label: 'По батькові' },
      { id: 'reason', tab: 't', type: 'textarea', label: 'Причина' },
      { id: 'unused_one', tab: 't', type: 'text', label: 'Зайве' },
    ],
  }

  it('field used only via a computed key counts as used (not unused)', () => {
    // template uses plaintiff_name (← last/first/middle) + reason; never unused_one
    const a = analyzeTemplate('{{plaintiff_name}} {{reason}}')
    const d = diffFormVsTemplate(form, a)
    expect(d.usedFields).toEqual(['first_name', 'last_name', 'middle_name', 'reason'])
    expect(d.unusedFields).toEqual(['unused_one'])
    expect(d.unmatchedPlaceholders).toEqual([])
  })

  it('template ref with no field → unmatched', () => {
    const d = diffFormVsTemplate(form, analyzeTemplate('{{reason}} {{ghost_field}}'))
    expect(d.unmatchedPlaceholders).toEqual(['ghost_field'])
  })
})

// ───────────────────────────── show_if introspection ─────────────────────────
describe('show_if helpers', () => {
  const form: FormConfig = {
    service_id: 'x', title: 'X', tabs: [{ id: 't', label: 'T' }],
    steps: [
      { id: 'has_children', tab: 't', type: 'boolean', label: 'Є діти' },
      { id: 'count', tab: 't', type: 'number', label: 'Скільки', show_if: { field: 'has_children', operator: '==', value: true } },
      { id: 'broken', tab: 't', type: 'text', label: 'Бите', show_if: { field: 'ghost', operator: '==', value: true } },
    ],
  }

  it('detects show_if referencing a missing field', () => {
    expect(collectBrokenShowIf(form)).toEqual(['broken'])
  })

  it('describes a condition with the field label, Так/Ні', () => {
    expect(describeShowIf({ field: 'has_children', operator: '==', value: true }, form))
      .toBe('«Є діти» дорівнює Так')
  })

  it('describes all/any chains', () => {
    expect(describeShowIf({ all: [
      { field: 'has_children', operator: '==', value: true },
      { field: 'count', operator: '>', value: 1 },
    ] }, form)).toBe('«Є діти» дорівнює Так і «Скільки» більше «1»')
  })

  it('flags empty labels', () => {
    const f: FormConfig = { ...form, steps: [{ id: 'nolabel', tab: 't', type: 'text', label: '  ' }] }
    expect(collectEmptyLabelFields(f)).toEqual(['nolabel'])
  })
})

// ───────────────────────────── health light ──────────────────────────────────
describe('serviceHealth', () => {
  const clean = { unmatchedPlaceholders: [], unusedFields: [], usedFields: ['a'] }

  it('green when everything aligns', () => {
    expect(serviceHealth({ generationMode: 'template', hasTemplate: true, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] }).level).toBe('green')
  })

  it('red: no template for template/hybrid mode', () => {
    expect(serviceHealth({ generationMode: 'template', hasTemplate: false, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] }).level).toBe('red')
    expect(serviceHealth({ generationMode: 'hybrid', hasTemplate: false, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] }).level).toBe('red')
  })

  it('red: unmatched placeholder', () => {
    const h = serviceHealth({ generationMode: 'template', hasTemplate: true, diff: { ...clean, unmatchedPlaceholders: ['ghost'] }, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] })
    expect(h.level).toBe('red')
    expect(h.reasons.join(' ')).toContain('ghost')
  })

  it('red: broken show_if', () => {
    expect(serviceHealth({ generationMode: 'template', hasTemplate: true, diff: clean, brokenShowIf: ['x'], emptyLabelFields: [], staleCitations: [] }).level).toBe('red')
  })

  it('amber: unused field / stale citation / empty label', () => {
    expect(serviceHealth({ generationMode: 'template', hasTemplate: true, diff: { ...clean, unusedFields: ['x'] }, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] }).level).toBe('amber')
    expect(serviceHealth({ generationMode: 'template', hasTemplate: true, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: ['ст.192 СК'] }).level).toBe('amber')
    expect(serviceHealth({ generationMode: 'template', hasTemplate: true, diff: clean, brokenShowIf: [], emptyLabelFields: ['x'], staleCitations: [] }).level).toBe('amber')
  })

  it('legacy js mode is not red for missing template, but amber', () => {
    expect(serviceHealth({ generationMode: 'js', hasTemplate: false, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] }).level).toBe('amber')
  })
})

describe('analyzeService — one-shot bundler', () => {
  it('alimony-change real service → not red, zero unmatched', () => {
    const r = analyzeService(alimonyChangeFormConfig, tpl('alimony-change'), 'hybrid')
    expect(r.diff.unmatchedPlaceholders).toEqual([])
    expect(r.health.level).not.toBe('red') // amber: AI-fed fields aren't in the template
  })

  it('a form field whose id collides with a computed key counts as used', () => {
    const form: FormConfig = {
      service_id: 'x', title: 'X', tabs: [{ id: 't', label: 'T' }],
      steps: [{ id: 'has_children', tab: 't', type: 'boolean', label: 'Є діти' }],
    }
    const r = analyzeService(form, '{{#if has_children}}є{{/if}}', 'template')
    expect(r.diff.unusedFields).toEqual([])
  })

  it('null form / empty template → red (no template), no crash', () => {
    const r = analyzeService(null, '', 'template')
    expect(r.health.level).toBe('red')
    expect(r.diff.usedFields).toEqual([])
  })

  it('staleCitations push health to amber', () => {
    const r = analyzeService(alimonyChangeFormConfig, tpl('alimony-change'), 'hybrid', ['ст.192 СК'])
    expect(r.health.level).toBe('amber')
  })
})

describe('misc helpers', () => {
  it('lawCodeFromUrl', () => {
    expect(lawCodeFromUrl('https://zakon.rada.gov.ua/laws/show/2947-14')).toBe('2947-14')
    expect(lawCodeFromUrl('https://zakon.rada.gov.ua/laws/show/2947-14/')).toBe('2947-14')
  })
  it('fieldTypeLabel', () => {
    expect(fieldTypeLabel('date')).toBe('Дата')
    expect(fieldTypeLabel('multicheck')).toBe('Вибір (кілька)')
  })
})
