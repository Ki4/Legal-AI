import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * doc-engine divorce port proof (#35): the declarative divorce template
 * rendered by the engine must be BYTE-IDENTICAL to the legacy
 * buildDivorceDocument JS builder — across the golden fixtures AND a
 * programmatic branch matrix (incl. the dynamic ПРОШУ numbering).
 *
 * If this file goes red, the template port changed legal content. Do not
 * "fix" by editing goldens — fix the template (or consciously extend the DSL
 * via the spec, see specs/features/doc-engine/).
 *
 * Known conscious non-goals (degenerate inputs the form cannot produce):
 *  - divorce_reasons as a bare string (multicheck always sends an array);
 *  - children_details made of whitespace-only or name-less lines.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS modules (repo convention; static repo files, not untrusted input)
function loadCjs(relPath) {
  const code = readFileSync(resolve(__dirname, relPath), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
}

const { renderDocument, buildContext } = loadCjs('../render-document.js')
const { buildDivorceDocument } = (() => {
  // divorce-document.js has no module.exports — it runs a CLI demo under
  // require.main; load it with a fake require (`.main` resolves undefined).
  const code = readFileSync(resolve(__dirname, '../divorce-document.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code + '\nmodule.exports = { buildDivorceDocument };')
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
})()

const TEMPLATE = readFileSync(resolve(__dirname, '../services/divorce.document.txt'), 'utf8')

const renderViaEngine = (answers, ai) => renderDocument(TEMPLATE, buildContext(answers, ai))
const renderViaBuilder = (answers, ai) => buildDivorceDocument(answers, ai)

// ─── Base case (realistic, most branches "on") ───────────────────────────────

const BASE_ANSWERS = {
  last_name: 'Коваленко', first_name: 'Марія', middle_name: 'Олександрівна',
  birth_date: '1985-11-08',
  registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
  same_actual_address: true,
  tax_number: '2756789012', has_no_ipn: false,
  plaintiff_phone: '+380931234567',
  plaintiff_email: 'kovalenko.maria@ukr.net',
  plaintiff_official_email: 'absent',
  surname_after_divorce: 'keep',

  spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович',
  spouse_birth_date: '1983-02-14',
  spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
  spouse_actual_address_known: 'same',
  spouse_tax_number: '2667890123', spouse_has_no_ipn: false,
  spouse_phone: '+380951234567',
  spouse_email: 'kovalenko.viktor@ukr.net',
  spouse_official_email: 'unknown',

  marriage_date: '2010-09-10',
  marriage_place: 'Приморський відділ РАЦС Одеського міського управління юстиції',
  marriage_act_number: '312',
  marriage_cert_series: 'І-ОД № 456789',
  marriage_cert_date: '2010-09-10',

  spouse_consents: false,
  has_children: true,
  children_details: 'Коваленко Олена Вікторівна, 15.05.2012\nКоваленко Максим Вікторович, 22.08.2015',
  children_live_with: 'plaintiff',
  children_dispute: 'none',
  alimony_claim: true,
  alimony_amount: 'percent',
  divorce_reasons: ['no_understanding', 'different_views', 'no_financial_support'],
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

// Live system sends unified defendant_* AI keys (Prepare Declension, s10)
const BASE_AI = {
  plaintiff_instrumental: 'Коваленко Марією Олександрівною',
  plaintiff_genitive: 'Коваленко Марії Олександрівни',
  defendant_instrumental: 'Коваленком Віктором Петровичем',
  defendant_genitive: 'Коваленка Віктора Петровича',
  marriage_place_locative: 'Приморському відділі РАЦС Одеського міського управління юстиції',
  children_genitive: 'Коваленко Олени Вікторівни, 15.05.2012 р.н. та Коваленка Максима Вікторовича, 22.08.2015 р.н.',
}

const ONE_CHILD = 'Коваленко Олена Вікторівна, 15.05.2012'
const TWO_CHILDREN = 'Коваленко Олена Вікторівна, 15.05.2012\nКоваленко Максим Вікторович, 22.08.2015'
const THREE_CHILDREN = TWO_CHILDREN + '\nКоваленко Тарас Вікторович, 01.12.2020'

function compare(answers, ai) {
  expect(renderViaEngine(answers, ai)).toBe(renderViaBuilder(answers, ai))
}

// ─── Structural matrix: children × dispute × alimony × property × debt ───────
// Drives the dynamic ПРОШУ numbering (items 5..8) through every combination.

describe('parity matrix: optional ПРОШУ items numbering', () => {
  const childrenSets = [
    ['no children', { has_children: false, children_details: '', children_live_with: undefined }],
    ['one child', { has_children: true, children_details: ONE_CHILD, children_live_with: 'plaintiff' }],
    ['two children', { has_children: true, children_details: TWO_CHILDREN, children_live_with: 'defendant' }],
    ['three children', { has_children: true, children_details: THREE_CHILDREN, children_live_with: 'both' }],
    ['children flag without details', { has_children: true, children_details: '' }],
  ]
  const disputes = ['none', 'separate', undefined]
  const alimonies = [true, false]
  const properties = [
    ['no property', { has_joint_property: false }],
    ['property together', { has_joint_property: true, property_dispute: 'together', property_details: 'квартира за адресою м. Одеса, вул. Дерибасівська, 5, кв. 12' }],
    ['property separate', { has_joint_property: true, property_dispute: 'separate' }],
  ]
  const debts = [true, false]

  for (const [childLabel, childPatch] of childrenSets) {
    for (const dispute of disputes) {
      for (const alimony of alimonies) {
        for (const [propLabel, propPatch] of properties) {
          for (const debt of debts) {
            it(`${childLabel} × dispute=${dispute ?? 'missing'} × alimony=${alimony} × ${propLabel} × debt=${debt}`, () => {
              const answers = {
                ...BASE_ANSWERS,
                ...childPatch,
                children_dispute: dispute,
                alimony_claim: alimony,
                ...propPatch,
                debt_claim: debt,
                ...(debt ? { debt_details: 'кредитний договір № 123 від 01.01.2020' } : {}),
              }
              compare(answers, BASE_AI)
            })
          }
        }
      }
    }
  }
})

// ─── AI fallback matrix: children sets × ai present/absent ───────────────────
// children_genitive fallback differs from alimony's (numbered raw lines).

describe('parity matrix: AI fallbacks', () => {
  const childrenSets = [
    ['no children', { has_children: false, children_details: '' }],
    ['one child', { has_children: true, children_details: ONE_CHILD, children_live_with: 'plaintiff' }],
    ['three children', { has_children: true, children_details: THREE_CHILDREN, children_live_with: 'plaintiff' }],
  ]
  const ais = [
    ['full ai', BASE_AI],
    ['empty ai (fallbacks)', {}],
    ['null ai', null],
    ['ai without children_genitive', { ...BASE_AI, children_genitive: null }],
    ['legacy spouse_* ai keys', {
      plaintiff_instrumental: 'Коваленко Марією Олександрівною',
      plaintiff_genitive: 'Коваленко Марії Олександрівни',
      spouse_instrumental: 'Коваленком Віктором Петровичем',
      spouse_genitive: 'Коваленка Віктора Петровича',
      marriage_place_locative: 'Приморському відділі РАЦС Одеського міського управління юстиції',
    }],
    ['partial ai (only plaintiff_genitive)', { plaintiff_genitive: 'Коваленко Марії Олександрівни' }],
  ]

  for (const [childLabel, childPatch] of childrenSets) {
    for (const [aiLabel, ai] of ais) {
      it(`${childLabel} × ${aiLabel}`, () => {
        compare({ ...BASE_ANSWERS, ...childPatch }, ai)
      })
    }
  }
})

// ─── One-at-a-time branch toggles from the base case ─────────────────────────

describe('parity: individual branch toggles', () => {
  const cases = {
    'actual address differs': { same_actual_address: false, actual_address: 'м. Одеса, вул. Рішельєвська, 3, кв. 8' },
    'same_actual_address as string "false"': { same_actual_address: 'false', actual_address: 'м. Одеса, вул. Рішельєвська, 3' },
    'same_actual_address as string "true"': { same_actual_address: 'true', actual_address: 'м. Одеса, вул. Рішельєвська, 3' },
    'actual address flag set but address empty': { same_actual_address: false, actual_address: '' },

    'plaintiff has passport instead of IPN': { has_no_ipn: true, passport_series: 'КМ 123456', tax_number: '' },
    'plaintiff no IPN and no passport': { has_no_ipn: true, tax_number: '' },
    'plaintiff IPN flag false but no number': { has_no_ipn: false, tax_number: '' },

    'no plaintiff phone': { plaintiff_phone: '' },
    'no plaintiff email': { plaintiff_email: '' },
    'plaintiff official email present': { plaintiff_official_email: 'present' },

    'no spouse registered address': { spouse_registered_address: '' },
    'spouse actual address different': { spouse_actual_address_known: 'different', spouse_actual_address: 'м. Львів, вул. Зелена, 1' },
    'spouse actual address different but empty': { spouse_actual_address_known: 'different', spouse_actual_address: '' },
    'spouse actual address unknown': { spouse_actual_address_known: 'unknown' },

    'spouse passport instead of IPN': { spouse_has_no_ipn: true, spouse_passport_series: 'СН 654321', spouse_tax_number: '' },
    'no spouse phone': { spouse_phone: '' },
    'no spouse email': { spouse_email: '' },
    'spouse official email present': { spouse_official_email: 'present' },
    'spouse official email absent': { spouse_official_email: 'absent' },

    'male plaintiff, female spouse (all gender forms swap)': {
      last_name: 'Коваленко', first_name: 'Віктор', middle_name: 'Петрович',
      spouse_last_name: 'Коваленко', spouse_first_name: 'Марія', spouse_middle_name: 'Олександрівна',
    },

    'spouse consents': { spouse_consents: true },
    'spouse consents as string "true"': { spouse_consents: 'true' },

    'no marriage date': { marriage_date: '' },
    'no marriage act number': { marriage_act_number: '' },
    'no marriage cert series (no cert clause)': { marriage_cert_series: '' },
    'marriage cert without date': { marriage_cert_date: '' },
    'no birth date (inverted fallback wording)': { birth_date: '' },
    'no spouse birth date': { spouse_birth_date: '' },
    'no birth dates at all': { birth_date: '', spouse_birth_date: '' },

    'divorce reasons: empty array': { divorce_reasons: [] },
    'divorce reasons: missing': { divorce_reasons: undefined },
    'divorce reasons: single': { divorce_reasons: ['alcohol'] },
    'divorce reasons: two (а також before last)': { divorce_reasons: ['no_common_interests', 'lost_feelings'] },
    'divorce reasons: all nine known codes': {
      divorce_reasons: [
        'no_common_interests', 'no_understanding', 'different_views', 'lost_feelings',
        'incompatibility', 'alcohol', 'abuse', 'no_financial_support', 'no_child_care',
      ],
    },
    'divorce reasons: unknown code passes through': { divorce_reasons: ['no_understanding', 'інша причина з форми'] },

    'joint household continues': { joint_household: 'yes' },

    'children live with defendant': { children_live_with: 'defendant' },
    'children live with both': { children_live_with: 'both' },
    'children_live_with missing': { children_live_with: undefined },
    'children details with blank lines': { children_details: '\n' + ONE_CHILD + '\n\n' },
    'child line with certificate part (raw line inlined)': { children_details: 'Коваленко Олена Вікторівна, 15.05.2012, свідоцтво № І-ОД 111222 від 16.05.2012' },

    'alimony fixed': { alimony_amount: 'fixed' },
    'alimony mixed': { alimony_amount: 'mixed' },
    'alimony amount missing (generic wording)': { alimony_amount: undefined },

    'maiden name restoration': { surname_after_divorce: 'maiden', maiden_name: 'Іванченко' },
    'maiden requested but maiden_name empty (falls back to keep)': { surname_after_divorce: 'maiden', maiden_name: '' },

    'court costs on plaintiff': { court_costs_on: 'plaintiff' },
    'general proceedings': { simplified_proceedings: 'no' },

    'pretrial settlement conducted': { pretrial_settlement: 'conducted' },
    'evidence preservation conducted': { evidence_preservation: 'conducted' },
    'originals partially at defendant': { originals_location: 'partial' },
    'originals at defendant': { originals_location: 'defendant' },

    'court fee exempt: disability_1_2': { court_fee_exempt: 'yes', court_fee_exempt_reason: 'disability_1_2' },
    'court fee exempt: child_disability': { court_fee_exempt: 'yes', court_fee_exempt_reason: 'child_disability' },
    'court fee exempt: chornobyl': { court_fee_exempt: 'yes', court_fee_exempt_reason: 'chornobyl' },
    'court fee exempt: unknown reason (placeholders)': { court_fee_exempt: 'yes', court_fee_exempt_reason: 'other' },
    'court fee exempt: reason missing (placeholders)': { court_fee_exempt: 'yes' },

    'property details ending with period (no double period)': {
      has_joint_property: true, property_dispute: 'together',
      property_details: 'квартира за адресою м. Одеса, вул. Дерибасівська, 5.',
    },
    'property together but details empty (placeholder + period)': {
      has_joint_property: true, property_dispute: 'together', property_details: '',
    },
    'debt details ending with period': { debt_claim: true, debt_details: 'кредитний договір № 123 від 01.01.2020.' },
    'debt claim but details empty (placeholder + period)': { debt_claim: true, debt_details: '' },
  }

  for (const [label, patch] of Object.entries(cases)) {
    it(label, () => compare({ ...BASE_ANSWERS, ...patch }, BASE_AI))
  }
})

// ─── Goldens: 4 fixture scenarios byte-identical to expected/*.txt ───────────

describe('goldens: template === expected files', () => {
  for (const n of [1, 2, 3, 4]) {
    it(`scenario-${n} renders byte-identical to golden`, async () => {
      const { answers, mockAi } = await import(`../../../test-data/divorce/fixtures/scenario-${n}.mjs`)
      const expected = readFileSync(
        resolve(__dirname, `../../../test-data/divorce/expected/scenario-${n}.txt`),
        'utf8'
      )
      expect(renderViaEngine(answers, mockAi)).toBe(expected)
      // sanity: legacy builder still matches its own golden too
      expect(renderViaBuilder(answers, mockAi)).toBe(expected)
    })
  }
})
