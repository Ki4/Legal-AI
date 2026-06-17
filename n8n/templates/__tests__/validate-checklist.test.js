import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * Required-clause checklist validator (issue #4 / IMPROVEMENTS #39).
 * Deterministic, no LLM — see specs/features/checklist-validator/.
 *
 * Integration tests render the REAL templates (not mocks) so that a future
 * template edit that silently drops a required clause is caught here, not
 * just in the byte-parity tests (which only prove "same as before", not
 * "legally complete").
 */

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS modules (repo convention; static repo files, not untrusted input).
// validate-checklist.js has no require of its own (mirrors how n8n inlines
// it right after render-document.js in the same Code Node scope, see
// scripts/sync-build-document-node.mjs) — concatenate both sources into one
// Function body so parseExpr/evalExpr resolve as plain in-scope identifiers,
// exactly like production.
function loadInlinedWithRenderDocument() {
  const renderCode = readFileSync(resolve(__dirname, '../render-document.js'), 'utf8')
  const checklistCode = readFileSync(resolve(__dirname, '../validate-checklist.js'), 'utf8')
  const combined = [
    renderCode,
    checklistCode,
    'module.exports = { renderDocument, buildContext, validateChecklist, evalCondition };',
  ].join('\n')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', combined)
  fn(m, m.exports)
  return m.exports
}

const { validateChecklist, evalCondition, renderDocument, buildContext } = loadInlinedWithRenderDocument()

const DIVORCE_TEMPLATE = readFileSync(resolve(__dirname, '../services/divorce.document.txt'), 'utf8')
const DIVORCE_CHECKLIST = JSON.parse(readFileSync(resolve(__dirname, '../services/divorce.checklist.json'), 'utf8'))
const ALIMONY_TEMPLATE = readFileSync(resolve(__dirname, '../services/alimony.document.txt'), 'utf8')
const ALIMONY_CHECKLIST = JSON.parse(readFileSync(resolve(__dirname, '../services/alimony.checklist.json'), 'utf8'))

// ─── evalCondition ─────────────────────────────────────────────────────────

describe('evalCondition', () => {
  it('"true" literal always applies, regardless of context', () => {
    expect(evalCondition('true', {})).toBe(true)
    expect(evalCondition('true', { anything: false })).toBe(true)
  })

  it('evaluates a simple truthy path', () => {
    expect(evalCondition('answers.has_children', { answers: { has_children: true } })).toBe(true)
    expect(evalCondition('answers.has_children', { answers: { has_children: false } })).toBe(false)
  })

  it('evaluates and/or/not and comparisons — same syntax as {{#if}}', () => {
    const ctx = { alimony_claim: true, children_dispute: 'separate' }
    expect(evalCondition('alimony_claim and children_dispute != \'separate\'', ctx)).toBe(false)
    expect(evalCondition('alimony_claim or children_dispute == \'separate\'', ctx)).toBe(true)
    expect(evalCondition('not alimony_claim', ctx)).toBe(false)
  })
})

// ─── validateChecklist — unit (mock checklist) ──────────────────────────────

describe('validateChecklist (mock checklist)', () => {
  const checklist = {
    items: [
      { id: 'always', description: 'Always required', appliesIf: 'true', mustMatchAny: ['foo'] },
      { id: 'conditional', description: 'Only if flag', appliesIf: 'flag', mustMatchAny: ['bar'] },
      { id: 'either', description: 'Satisfied by either pattern', appliesIf: 'true', mustMatchAny: ['baz', 'qux'] },
    ],
  }

  it('reports satisfied items present in the text', () => {
    const result = validateChecklist('foo baz', { flag: false }, checklist)
    expect(result.ok).toBe(true)
    expect(result.satisfied.map((i) => i.id)).toEqual(['always', 'either'])
    expect(result.missing).toEqual([])
  })

  it('skips items whose appliesIf is false — neither missing nor satisfied', () => {
    const result = validateChecklist('foo baz', { flag: false }, checklist)
    expect(result.satisfied.find((i) => i.id === 'conditional')).toBeUndefined()
    expect(result.missing.find((i) => i.id === 'conditional')).toBeUndefined()
  })

  it('flags an applicable item with no matching pattern as missing', () => {
    const result = validateChecklist('foo bar', { flag: true }, checklist)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([{ id: 'either', description: 'Satisfied by either pattern' }])
    expect(result.satisfied.map((i) => i.id).sort()).toEqual(['always', 'conditional'])
  })

  it('mustMatchAny is satisfied by any single pattern, not all', () => {
    const result = validateChecklist('text containing qux only', {}, checklist)
    expect(result.satisfied.find((i) => i.id === 'either')).toBeDefined()
  })
})

// ─── Integration: real divorce template ─────────────────────────────────────

describe('divorce.checklist.json against the real template', () => {
  const BASE_ANSWERS = {
    last_name: 'Коваленко', first_name: 'Марія', middle_name: 'Олександрівна',
    birth_date: '1985-11-08',
    registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
    same_actual_address: true,
    tax_number: '2756789012', has_no_ipn: false,
    plaintiff_official_email: 'absent',
    surname_after_divorce: 'keep',
    spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович',
    spouse_birth_date: '1983-02-14',
    spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
    spouse_actual_address_known: 'same',
    spouse_tax_number: '2667890123', spouse_has_no_ipn: false,
    spouse_official_email: 'unknown',
    marriage_date: '2010-09-10',
    marriage_place: 'Приморський відділ РАЦС Одеського міського управління юстиції',
    marriage_act_number: '312',
    spouse_consents: false,
    has_children: true,
    children_details: 'Коваленко Олена Вікторівна, 15.05.2012',
    children_live_with: 'plaintiff',
    children_dispute: 'none',
    alimony_claim: false,
    divorce_reasons: ['no_understanding'],
    joint_household: 'no',
    has_joint_property: false,
    debt_claim: false,
    simplified_proceedings: 'yes',
    court_fee_exempt: 'no',
    court_costs_on: 'defendant',
    pretrial_settlement: 'not_conducted',
    evidence_preservation: 'not_conducted',
    originals_location: 'plaintiff',
  }
  const BASE_AI = {
    plaintiff_instrumental: 'Коваленко Марією Олександрівною',
    plaintiff_genitive: 'Коваленко Марії Олександрівни',
    defendant_instrumental: 'Коваленком Віктором Петровичем',
    defendant_genitive: 'Коваленка Віктора Петровича',
    marriage_place_locative: 'Приморському відділі РАЦС Одеського міського управління юстиції',
    children_genitive: 'Коваленко Олени Вікторівни, 15.05.2012 р.н.',
  }

  function renderAndValidate(answersOverride) {
    const answers = { ...BASE_ANSWERS, ...answersOverride }
    const context = buildContext(answers, BASE_AI)
    const text = renderDocument(DIVORCE_TEMPLATE, context)
    return validateChecklist(text, context, DIVORCE_CHECKLIST)
  }

  it('base case (children, no dispute): all applicable items satisfied', () => {
    const result = renderAndValidate({})
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('children_dispute=separate: custody item satisfied via the DEFERRED pattern, not the decided one', () => {
    const answers = { ...BASE_ANSWERS, children_dispute: 'separate' }
    const context = buildContext(answers, BASE_AI)
    const text = renderDocument(DIVORCE_TEMPLATE, context)
    expect(text).not.toContain('Визначити місце проживання')
    expect(text).toContain('окремому провадженні')
    const result = validateChecklist(text, context, DIVORCE_CHECKLIST)
    expect(result.ok).toBe(true)
    expect(result.satisfied.find((i) => i.id === 'children_custody_or_deferred')).toBeDefined()
  })

  it('no children: custody item does not apply — not in missing or satisfied', () => {
    const answers = { ...BASE_ANSWERS, has_children: false, children_details: '', children_live_with: undefined }
    const context = buildContext(answers, BASE_AI)
    const text = renderDocument(DIVORCE_TEMPLATE, context)
    const result = validateChecklist(text, context, DIVORCE_CHECKLIST)
    expect(result.ok).toBe(true)
    const ids = [...result.missing, ...result.satisfied].map((i) => i.id)
    expect(ids).not.toContain('children_custody_or_deferred')
  })

  it('court_fee_exempt=yes still satisfies the court-fee-disclosure item', () => {
    const result = renderAndValidate({ court_fee_exempt: 'yes', court_fee_exempt_reason: 'disability_1_2' })
    expect(result.ok).toBe(true)
  })

  it('negative: a corrupted render (sentence stripped) is correctly flagged missing', () => {
    const context = buildContext(BASE_ANSWERS, BASE_AI)
    const fullText = renderDocument(DIVORCE_TEMPLATE, context)
    const corrupted = fullText.replace(/Відповідно до ст\.27 ЦПК[^.]*\./, '')
    const result = validateChecklist(corrupted, context, DIVORCE_CHECKLIST)
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([{ id: 'territorial_jurisdiction', description: 'Підсудність — позов за місцем проживання відповідача (ст. 27 ЦПК)' }])
  })
})

// ─── Integration: real alimony template ──────────────────────────────────────

describe('alimony.checklist.json against the real template', () => {
  const BASE_ANSWERS = {
    last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
    birth_date: '1990-03-15',
    registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
    same_actual_address: true,
    tax_number: '2934567890', has_no_ipn: false,
    plaintiff_official_email: 'absent',
    defendant_last_name: 'Іванов', defendant_first_name: 'Іван', defendant_middle_name: 'Іванович',
    defendant_birth_date: '1988-07-22',
    defendant_registered_address: 'м. Київ, вул. Грушевського, 5, кв. 3',
    defendant_actual_address_known: 'same',
    defendant_tax_number: '2845678901', defendant_has_no_ipn: false,
    defendant_official_email: 'unknown',
    marital_status: 'divorced',
    marriage_date: '2015-06-20',
    marriage_place: 'Шевченківський відділ РАЦС у м. Києві',
    marriage_act_number: '547',
    divorce_date: '2022-03-10',
    divorce_court: 'Шевченківського районного суду м. Києва',
    divorce_case_number: '761/1234/22',
    children_details: 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
    family_cert_date: '2024-01-10',
    abandonment_date: '2022-03-01',
    alimony_type: 'percent',
    defendant_employed: 'yes',
    defendant_employer: 'ТОВ «Альфа Сервіс»',
    alimony_start_date: '2024-02-01',
  }
  const BASE_AI = {
    plaintiff_instrumental: 'Іванову Інну Петрівну',
    plaintiff_genitive: 'Іванової Інни Петрівни',
    defendant_instrumental: 'Іванова Івана Івановича',
    defendant_genitive: 'Іванова Івана Івановича',
    marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
    children_genitive: 'Іванова Олега Івановича, 15.05.2018 р.н.',
  }

  function renderAndValidate(answersOverride) {
    const answers = { ...BASE_ANSWERS, ...answersOverride }
    const context = buildContext(answers, BASE_AI)
    const text = renderDocument(ALIMONY_TEMPLATE, context)
    return validateChecklist(text, context, ALIMONY_CHECKLIST)
  }

  it('alimony_type=percent: all items satisfied', () => {
    const result = renderAndValidate({ alimony_type: 'percent' })
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('alimony_type=fixed: amount clause still satisfied (other branch, same item)', () => {
    const result = renderAndValidate({ alimony_type: 'fixed', alimony_fixed_amount: '5000' })
    expect(result.ok).toBe(true)
    expect(result.satisfied.find((i) => i.id === 'alimony_amount_clause')).toBeDefined()
  })

  it('negative: stripping the amount clause is flagged missing', () => {
    const context = buildContext(BASE_ANSWERS, BASE_AI)
    const fullText = renderDocument(ALIMONY_TEMPLATE, context)
    const corrupted = fullText.replace(/1\. Стягнути з[^\n]*\n/, '')
    const result = validateChecklist(corrupted, context, ALIMONY_CHECKLIST)
    expect(result.missing.map((i) => i.id)).toContain('alimony_amount_clause')
  })
})
