import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import type { FormConfig } from '../../types/form'
import {
  analyzeTemplate,
  extractArticlesByLaw,
  diffFormVsTemplate,
  collectBrokenShowIf,
  collectEmptyLabelFields,
  collectDeadRefs,
  describeShowIf,
  serviceHealth,
  isTemplateAuthoritative,
  templateDrivesGeneration,
  fieldTypeLabel,
  lawCodeFromUrl,
  analyzeService,
  providedContextKeys,
} from '../serviceAnatomy'
import { divorceFormConfig } from '../../data/divorceFormConfig'
import { alimonyChangeFormConfig } from '../../data/alimonyChangeFormConfig'
import { alimonyConfig } from '../../data/alimonyConfig'

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

  it('inline run tags (styleHints v2) are style markers, not field refs', () => {
    const a = analyzeTemplate('Позивач: {{#bold}}{{last_name}}{{/bold}} і {{#italic}}курсив{{/italic}}')
    expect(a.fieldRefs).toContain('last_name')
    expect(a.fieldRefs).not.toContain('#bold')
    expect(a.fieldRefs).not.toContain('/bold')
    expect(a.fieldRefs).not.toContain('#italic')
    expect(a.referencedPaths.some((p) => p.includes('bold') || p.includes('italic'))).toBe(false)
  })

  it('empty template → hasTemplate false', () => {
    expect(analyzeTemplate('').hasTemplate).toBe(false)
    expect(analyzeTemplate('   ').hasTemplate).toBe(false)
    expect(analyzeTemplate('x').hasTemplate).toBe(true)
  })
})

// ───────────────── Real-template diff: no FALSE unmatched from computed layer ──
// The analyzer must not flag computed-layer keys (plaintiff_name, court_fee, children…)
// as unmatched. Both real services are now fully aligned: divorce previously printed
// {{property_details}} / {{debt_details}} the form never collected (→ '________' in
// production) — that gap was the mirror's first finding (#67) and is now closed by
// Variant B (property/debt acknowledged but division deferred to a separate suit,
// no inline details). If this regresses, the form/template drifted apart again.
const COMPUTED_KEYS = ['plaintiff_name', 'defendant_name', 'children', 'has_children', 'n_children', 'court_fee', 'price_of_claim', 'ai']

describe('diffFormVsTemplate — real templates', () => {
  it('alimony-change: zero unmatched (fully aligned)', () => {
    const diff = diffFormVsTemplate(alimonyChangeFormConfig, analyzeTemplate(tpl('alimony-change')))
    expect(diff.unmatchedPlaceholders).toEqual([])
  })

  // The missing invariant that let issue #86 ship: the live alimony row rendered the
  // new-convention template while its form_config was still the legacy 24-field version
  // (respondent_* vs defendant_*) → real submissions produced documents with 16 «________»
  // holes. alimonyConfig is now the aligned SSoT; this pins form↔template alignment.
  it('alimony: zero unmatched (form SSoT aligned with the doc-engine template, #86)', () => {
    const diff = diffFormVsTemplate(alimonyConfig, analyzeTemplate(tpl('alimony')))
    expect(diff.unmatchedPlaceholders).toEqual([])
  })

  it('divorce: zero unmatched after #67 (property/debt gap closed via Variant B)', () => {
    const diff = diffFormVsTemplate(divorceFormConfig, analyzeTemplate(tpl('divorce')))
    expect(diff.unmatchedPlaceholders).toEqual([])
    // never a false positive from the computed layer
    for (const k of COMPUTED_KEYS) expect(diff.unmatchedPlaceholders).not.toContain(k)
  })
})

// ─────────────── Dead refs (publish-gate #88 §3) + engine parity ─────────────
// The gate's predicate: a template ref the engine can NEVER fill for this form.
// Red-team blocker (s72): the bare unmatched list was blind to the computed/ai
// layer — {{ai.typo}}, {{answers.ghost}}, {{plaintiff_name}}-without-sources all
// printed '________' in EVERY document while passing unmatched===[].

const FORM = (ids: string[]): FormConfig => ({
  service_id: 's', title: 't', tabs: [],
  steps: ids.map((id) => ({ id, tab: 'g', label: id, type: 'text' as const })),
})
const dead = (tplText: string, ids: string[]) => collectDeadRefs(FORM(ids), analyzeTemplate(tplText))

describe('collectDeadRefs — 4 structural classes', () => {
  it('class 1: bare field ref with no form field (incl. |raw silent-empty)', () => {
    expect(dead('{{payment_receipt}}', [])).toEqual([{ ref: 'payment_receipt', kind: 'unmatched-field' }])
    // |raw suppresses the visible fallback but the hole is the same — still dead
    expect(dead('{{payment_receipt|raw}}', [])).toEqual([{ ref: 'payment_receipt', kind: 'unmatched-field' }])
    expect(dead('{{payment_receipt}}', ['payment_receipt'])).toEqual([])
  })

  it('class 2: computed key with NONE of its source fields in the form', () => {
    const d = dead('{{plaintiff_name}}', [])
    expect(d).toEqual([{ ref: 'plaintiff_name', kind: 'missing-sources', sources: ['last_name', 'first_name', 'middle_name'] }])
    // ≥1 source present → engine renders something (joinName skips empties)
    expect(dead('{{plaintiff_name}}', ['last_name'])).toEqual([])
    // silent-vanish case: {{#each children}} without children_details
    expect(dead('{{#each children}}{{name}}{{/each}}', [])).toEqual([
      { ref: 'children', kind: 'missing-sources', sources: ['children_details'] },
    ])
    // defendant aliases: spouse_* convention satisfies the requirement (divorce)
    expect(dead('{{defendant_name}}', ['spouse_last_name'])).toEqual([])
  })

  it('class 2 exemption: graceful-default keys never block (render defaults, not holes)', () => {
    expect(dead('{{gender plaintiff_gender \'він\' \'вона\'}} {{n_children}}', [])).toEqual([])
  })

  it('class 3: unknown ai./ai_raw. subpath (declension typo)', () => {
    expect(dead('{{ai.defendant_dative}}', [])).toEqual([{ ref: 'ai.defendant_dative', kind: 'unknown-ai-path' }])
    // known subpath with sources present → alive; ai.reasoning is source-free (LLM)
    expect(dead('{{ai.plaintiff_genitive}}', ['last_name'])).toEqual([])
    expect(dead('{{#if ai.reasoning}}x{{/if}}', [])).toEqual([])
    // ai_raw escape hatch: known keys legitimately empty, unknown keys dead
    expect(dead('{{#if ai_raw.reasoning}}x{{/if}}', [])).toEqual([])
    expect(dead('{{#if ai_raw.ghost}}x{{/if}}', [])).toEqual([{ ref: 'ai_raw.ghost', kind: 'unknown-ai-path' }])
  })

  it('class 3b: known ai declension with NO source fields → dead (guard ends in FALLBACK)', () => {
    expect(dead('{{ai.marriage_place_locative}}', [])).toEqual([
      { ref: 'ai.marriage_place_locative', kind: 'missing-sources', sources: ['marriage_place'] },
    ])
  })

  it('class 4: answers.* escape hatch to a nonexistent field', () => {
    expect(dead('{{answers.ghost}}', [])).toEqual([{ ref: 'answers.ghost', kind: 'unknown-answers-path' }])
    expect(dead('{{answers.has_children}}', ['has_children'])).toEqual([])
  })

  it('live templates: ZERO dead refs (superset of the #86 unmatched invariant)', () => {
    expect(collectDeadRefs(alimonyChangeFormConfig, analyzeTemplate(tpl('alimony-change')))).toEqual([])
    expect(collectDeadRefs(alimonyConfig, analyzeTemplate(tpl('alimony')))).toEqual([])
    expect(collectDeadRefs(divorceFormConfig, analyzeTemplate(tpl('divorce')))).toEqual([])
  })
})

describe('templateDrivesGeneration (gate predicate, stricter than isTemplateAuthoritative)', () => {
  it('template/hybrid/null drive generation; js and future modes do not', () => {
    expect(templateDrivesGeneration('template')).toBe(true)
    expect(templateDrivesGeneration('hybrid')).toBe(true)
    expect(templateDrivesGeneration(null)).toBe(true) // first publish auto-flips null → template
    expect(templateDrivesGeneration('js')).toBe(false)
    expect(templateDrivesGeneration('ai_generate')).toBe(false) // #86 lesson: dormant draft ≠ blocked
  })
})

// Mirror-drift insurance (red-team should-fix): the git-template invariant does
// not cover DB-edited templates, so pin the mirror DIRECTLY to the engine: the
// computed layer buildContext() actually returns === PROVIDED_CONTEXT.
describe('buildContext ↔ PROVIDED_CONTEXT parity (mirror drift guard)', () => {
  it('engine computed keys === providedContextKeys()', () => {
    const require = createRequire(import.meta.url)
    const engine = require(resolve(REPO, 'n8n/templates/render-document.js'))
    const engineKeys = Object.keys(engine.buildContext({}, {})).sort()
    expect(engineKeys).toEqual(providedContextKeys())
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

  // ── issue #86: js-mode diff vs the dormant draft template is NOT an alarm ──
  it('js mode: drifted dormant template → amber with ONE draft note, not per-field red/amber', () => {
    const drifted = { usedFields: ['a'], unusedFields: ['x', 'y'], unmatchedPlaceholders: ['ghost1', 'ghost2'] }
    const h = serviceHealth({ generationMode: 'js', hasTemplate: true, diff: drifted, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] })
    expect(h.level).toBe('amber')
    const joined = h.reasons.join(' ')
    expect(joined).toContain('Чернетка шаблону розходиться з формою (бракує 2, не використано 2)')
    expect(joined).not.toContain('ghost1')                       // no per-placeholder red
    expect(joined).not.toContain('Поле «x»')                     // no per-field unused amber
  })

  it('js mode: form-side problems still red (broken show_if is real regardless of mode)', () => {
    const h = serviceHealth({ generationMode: 'js', hasTemplate: true, diff: clean, brokenShowIf: ['bad'], emptyLabelFields: [], staleCitations: [] })
    expect(h.level).toBe('red')
  })

  it('js mode without a template → no draft-drift note (nothing to compare)', () => {
    const h = serviceHealth({ generationMode: 'js', hasTemplate: false, diff: clean, brokenShowIf: [], emptyLabelFields: [], staleCitations: [] })
    expect(h.reasons.join(' ')).not.toContain('Чернетка')
  })

  it('isTemplateAuthoritative: only js is non-authoritative', () => {
    expect(isTemplateAuthoritative('js')).toBe(false)
    expect(isTemplateAuthoritative('template')).toBe(true)
    expect(isTemplateAuthoritative('hybrid')).toBe(true)
    expect(isTemplateAuthoritative(null)).toBe(true)
  })
})

describe('analyzeService — one-shot bundler', () => {
  it('alimony-change real service → not red, zero unmatched', () => {
    const r = analyzeService(alimonyChangeFormConfig, tpl('alimony-change'), 'hybrid')
    expect(r.diff.unmatchedPlaceholders).toEqual([])
    expect(r.health.level).not.toBe('red') // amber: AI-fed fields aren't in the template
  })

  // issue #86: for a js-mode service the stored template is a dormant draft — its drift
  // must NOT paint the service red (the legacy builder generates), one amber note instead.
  // Synthetic drifted pair (old-convention form × new-convention template).
  const driftedForm: FormConfig = {
    service_id: 'x', title: 'X', tabs: [{ id: 'p', label: 'P' }],
    steps: [{ id: 'respondent_last_name', tab: 'p', type: 'text', label: 'Прізвище' }],
  }
  const driftedTpl = '{{defendant_employer}} {{plaintiff_payout_method}}'

  it('js mode + drifted dormant template → amber with a draft note, not red', () => {
    const r = analyzeService(driftedForm, driftedTpl, 'js')
    expect(r.diff.unmatchedPlaceholders.length).toBeGreaterThan(0) // the drift is real…
    expect(r.health.level).toBe('amber')                            // …but not an alarm
    expect(r.health.reasons.join(' ')).toContain('на генерацію не впливає')
  })

  it('the SAME drift in template mode stays red (authoritative template must alarm)', () => {
    const r = analyzeService(driftedForm, driftedTpl, 'template')
    expect(r.health.level).toBe('red')
  })

  // issue #86 end-state on REAL live data: aligned form + template in template mode → green.
  it('alimony real form × real template (template mode) → green', () => {
    const r = analyzeService(alimonyConfig, tpl('alimony'), 'template')
    expect(r.diff.unmatchedPlaceholders).toEqual([])
    expect(r.health.level).toBe('green')
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
