import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * doc-engine pilot proof (#34, G2): the declarative alimony template rendered
 * by the engine must be BYTE-IDENTICAL to the legacy buildAlimonyDocument JS
 * builder — across the golden fixtures AND a programmatic branch matrix.
 *
 * If this file goes red, the template port changed legal content. Do not
 * "fix" by editing goldens — fix the template (or consciously extend the DSL
 * via the spec, see specs/features/doc-engine/).
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
const { buildAlimonyDocument } = (() => {
  // alimony-document.js has no module.exports guard exporting the builder —
  // it runs a CLI demo under require.main; load it with a fake module.
  const code = readFileSync(resolve(__dirname, '../alimony-document.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code + '\nmodule.exports = { buildAlimonyDocument };')
  fn(m, m.exports, () => ({ main: null }))
  return m.exports
})()

const TEMPLATE = readFileSync(resolve(__dirname, '../services/alimony.document.txt'), 'utf8')

const renderViaEngine = (answers, ai) => renderDocument(TEMPLATE, buildContext(answers, ai))
const renderViaBuilder = (answers, ai) => buildAlimonyDocument(answers, ai)

// ─── Base case (realistic, most branches "on") ───────────────────────────────

const BASE_ANSWERS = {
  last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
  birth_date: '1990-03-15',
  registered_address: 'м. Київ, вул. Хрещатик, 10, кв. 25',
  same_actual_address: true,
  tax_number: '2934567890', has_no_ipn: false,
  plaintiff_phone: '+380501234567',
  plaintiff_email: 'inna.ivanova@gmail.com',
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
  defendant_position: 'менеджера',
  defendant_salary: '25000',
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

const ONE_CHILD = 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018'
const THREE_CHILDREN = [
  'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
  'Іванова Марія Іванівна, 20.08.2020, свідоцтво № І-КВ 234567 від 21.08.2020',
  'Іванов Тарас Іванович, 01.12.2022, свідоцтво № І-КВ 345678 від 02.12.2022',
].join('\n')

function compare(answers, ai) {
  expect(renderViaEngine(answers, ai)).toBe(renderViaBuilder(answers, ai))
}

// ─── Structural matrix: marital × type × children × ai ───────────────────────

describe('parity matrix: structural dimensions', () => {
  const maritals = ['married', 'divorced', 'never_married', undefined]
  const types = ['percent', 'fixed', undefined]
  const childrenSets = [
    ['no children', ''],
    ['one child', ONE_CHILD],
    ['three children', THREE_CHILDREN],
  ]
  const ais = [
    ['full ai', BASE_AI],
    ['empty ai (fallbacks)', {}],
  ]

  for (const marital of maritals) {
    for (const type of types) {
      for (const [childLabel, children] of childrenSets) {
        for (const [aiLabel, ai] of ais) {
          it(`marital=${marital ?? 'missing'} × type=${type ?? 'missing'} × ${childLabel} × ${aiLabel}`, () => {
            const answers = {
              ...BASE_ANSWERS,
              marital_status: marital,
              alimony_type: type,
              children_details: children,
              ...(type === 'fixed' ? { alimony_fixed_amount: '8000' } : {}),
            }
            compare(answers, ai)
          })
        }
      }
    }
  }
})

// ─── One-at-a-time branch toggles from the base case ─────────────────────────

describe('parity: individual branch toggles', () => {
  const cases = {
    'actual address differs': { same_actual_address: false, actual_address: 'м. Київ, вул. Лютеранська, 3' },
    'same_actual_address as string "false"': { same_actual_address: 'false', actual_address: 'м. Київ, вул. Лютеранська, 3' },
    'same_actual_address as string "true"': { same_actual_address: 'true', actual_address: 'м. Київ, вул. Лютеранська, 3' },
    'actual address flag set but address empty': { same_actual_address: false, actual_address: '' },

    'plaintiff has passport instead of IPN': { has_no_ipn: true, passport_series: 'АВ 123456', tax_number: '' },
    'plaintiff no IPN and no passport': { has_no_ipn: true, tax_number: '' },
    'plaintiff IPN flag false but no number': { has_no_ipn: false, tax_number: '' },

    'no plaintiff phone': { plaintiff_phone: '' },
    'no plaintiff email': { plaintiff_email: '' },
    'plaintiff official email present': { plaintiff_official_email: 'present' },

    'no defendant registered address': { defendant_registered_address: '' },
    'defendant actual address different': { defendant_actual_address_known: 'different', defendant_actual_address: 'м. Львів, вул. Зелена, 1' },
    'defendant actual address different but empty': { defendant_actual_address_known: 'different', defendant_actual_address: '' },
    'defendant actual address unknown': { defendant_actual_address_known: 'unknown' },

    'defendant passport instead of IPN': { defendant_has_no_ipn: true, defendant_passport_series: 'СН 654321', defendant_tax_number: '' },
    'defendant phone and email present': { defendant_phone: '+380671112233', defendant_email: 'ivanov@gmail.com' },
    'defendant official email present': { defendant_official_email: 'present' },
    'defendant official email absent': { defendant_official_email: 'absent' },

    'male plaintiff, female defendant (all gender forms swap)': {
      last_name: 'Коваленко', first_name: 'Дмитро', middle_name: 'Олегович',
      defendant_last_name: 'Коваленко', defendant_first_name: 'Наталія', defendant_middle_name: 'Вікторівна',
    },

    'divorce: court without case number': { divorce_case_number: '' },
    'divorce: no court at all': { divorce_court: '', divorce_case_number: '' },
    'no divorce date': { divorce_date: '' },

    'no marriage date': { marriage_date: '' },
    'no marriage act number': { marriage_act_number: '' },
    'no birth dates': { birth_date: '', defendant_birth_date: '' },

    'child line without certificate': { children_details: 'Іванов Олег Іванович, 15.05.2018' },
    'female single child (донька)': { children_details: 'Іванова Марія Іванівна, 20.08.2020, свідоцтво № І-КВ 234567 від 21.08.2020' },
    'children with blank lines in details': { children_details: '\n' + ONE_CHILD + '\n\n' },

    'no family cert date': { family_cert_date: '' },
    'no abandonment date': { abandonment_date: '' },
    'no alimony start date': { alimony_start_date: '' },

    'employed without employer name': { defendant_employed: 'yes', defendant_employer: '' },
    'employed without position': { defendant_position: '' },
    'employed without salary': { defendant_salary: '' },
    'defendant unemployed': { defendant_employed: 'no', defendant_employer: '', defendant_position: '', defendant_salary: '' },
    'employment status missing': { defendant_employed: undefined, defendant_employer: '' },
    'defendant other income': { defendant_other_income: 'здає в оренду квартиру' },
  }

  for (const [label, patch] of Object.entries(cases)) {
    it(label, () => compare({ ...BASE_ANSWERS, ...patch }, BASE_AI))
  }

  it('fixed type: unemployed has no income clause (legacy asymmetry preserved)', () => {
    compare({ ...BASE_ANSWERS, alimony_type: 'fixed', alimony_fixed_amount: '9000', defendant_employed: 'no', defendant_employer: '' }, BASE_AI)
  })

  it('fixed type without amount', () => {
    compare({ ...BASE_ANSWERS, alimony_type: 'fixed', alimony_fixed_amount: '' }, BASE_AI)
  })

  it('fixed type: employed with position and salary', () => {
    compare({ ...BASE_ANSWERS, alimony_type: 'fixed', alimony_fixed_amount: '7500' }, BASE_AI)
  })

  it('ai missing entirely (null)', () => {
    compare(BASE_ANSWERS, null)
  })

  it('partial ai (only some declensions)', () => {
    compare(BASE_ANSWERS, { plaintiff_genitive: 'Іванової Інни Петрівни' })
  })
})

// ─── Goldens: 3 fixture scenarios byte-identical to expected/*.txt ───────────

describe('goldens: template === expected files', () => {
  for (const n of [1, 2, 3]) {
    it(`scenario-${n} renders byte-identical to golden`, async () => {
      const { answers, mockAi } = await import(`../../../test-data/alimony/fixtures/scenario-${n}.mjs`)
      const expected = readFileSync(
        resolve(__dirname, `../../../test-data/alimony/expected/scenario-${n}.txt`),
        'utf8'
      )
      expect(renderViaEngine(answers, mockAi)).toBe(expected)
      // sanity: legacy builder still matches its own golden too
      expect(renderViaBuilder(answers, mockAi)).toBe(expected)
    })
  }
})
