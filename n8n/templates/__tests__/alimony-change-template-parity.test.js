import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * alimony-change template guard (#37, G1): unlike alimony.document.txt there is
 * NO legacy JS builder to diff against — this is a brand-new document. Instead:
 *
 *  - "structural matrix" + "individual branch toggles" render the template
 *    across every {{#if}}/{{#each}} branch and assert it doesn't throw and
 *    doesn't leak unresolved `{{ }}` tags (the class of bug fixed in this
 *    template: a literal `{{ai.reasoning}}` inside a `{{! comment }}` broke
 *    the non-greedy tag tokenizer). Legally-significant branches additionally
 *    assert on the rendered Ukrainian text.
 *  - "goldens" pin 3 full scenarios byte-identical to test-data/alimony-change.
 *
 * If this file goes red, the template changed legal content. Do not "fix" by
 * editing goldens — fix the template (or extend the DSL via the doc-engine spec).
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
const TEMPLATE = readFileSync(resolve(__dirname, '../services/alimony-change.document.txt'), 'utf8')

const renderViaEngine = (answers, ai) => renderDocument(TEMPLATE, buildContext(answers, ai))

/** Render and assert no unresolved `{{ }}` tags leaked into the output. */
function render(answers, ai) {
  const out = renderViaEngine(answers, ai)
  expect(out).not.toContain('{{')
  expect(out).not.toContain('}}')
  return out
}

// ─── Base case: increase, percent → percent, court_decision, 1 child (6-18) ──

const BASE_ANSWERS = {
  change_direction: 'increase',

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

  prior_basis: 'court_decision',
  prior_court: 'Шевченківського районного суду м. Києва',
  prior_case_number: '761/1234/22',
  prior_decision_date: '2022-03-10',
  prior_alimony_type: 'percent', prior_alimony_value: '1/4',

  children_details: 'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',

  existing_debt: 'no',
  requested_alimony_type: 'percent', requested_alimony_value: '1/3',
}

const BASE_AI = {
  plaintiff_genitive: 'Іванової Інни Петрівни',
  defendant_genitive: 'Іванова Івана Івановича',
  children_genitive: 'Іванова Олега Івановича, 15.05.2018 р.н.',
}

const ONE_CHILD = BASE_ANSWERS.children_details
const TWO_CHILDREN = [
  'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018',
  'Іванова Марія Іванівна, 20.08.2014, свідоцтво № І-КВ 234567 від 21.08.2014',
].join('\n')

// decrease, fixed → fixed (delta=2000 → 1% of price_of_claim < floor → court_fee = floor)
const DECREASE_BASE = {
  ...BASE_ANSWERS,
  change_direction: 'decrease',
  prior_alimony_type: 'fixed', prior_alimony_value: '6000',
  requested_alimony_type: 'fixed', requested_alimony_value: '4000',
  existing_debt: 'no',
}

// ─── Structural matrix: direction × prior_basis × alimony types × children × ai ──

describe('structural matrix: direction × prior_basis × types × children × ai', () => {
  const directions = ['increase', 'decrease']
  const priorBases = ['court_decision', 'agreement']
  const typeCombos = [
    ['percent', 'percent'],
    ['fixed', 'fixed'],
    ['percent', 'fixed'],
    ['fixed', 'percent'],
  ]
  const childrenSets = [
    ['one child', ONE_CHILD],
    ['two children', TWO_CHILDREN],
    ['no children', ''],
  ]
  const ais = [
    ['full ai', BASE_AI],
    ['empty ai (fallbacks)', {}],
  ]

  for (const direction of directions) {
    for (const priorBasis of priorBases) {
      for (const [priorType, reqType] of typeCombos) {
        for (const [childLabel, children] of childrenSets) {
          for (const [aiLabel, ai] of ais) {
            it(`${direction} × ${priorBasis} × prior=${priorType}/req=${reqType} × ${childLabel} × ${aiLabel}`, () => {
              render({
                ...BASE_ANSWERS,
                change_direction: direction,
                prior_basis: priorBasis,
                prior_alimony_type: priorType,
                prior_alimony_value: priorType === 'percent' ? '1/4' : '6000',
                requested_alimony_type: reqType,
                requested_alimony_value: reqType === 'percent' ? '1/3' : '4000',
                existing_debt: 'no',
                children_details: children,
              }, ai)
            })
          }
        }
      }
    }
  }
})

// ─── Individual branch toggles from the base (increase) case ────────────────

describe('parity: individual branch toggles (increase base)', () => {
  const cases = [
    ['jurisdiction header + title (увага: за вибором позивача, ст.28 ч.1 ЦПК)', {}, (out) => {
      expect(out).toContain('за вибором позивача (ст. 28 ч.1 ЦПК України)')
      expect(out).toContain('про збільшення розміру аліментів')
    }],

    ['actual address differs', { same_actual_address: false, actual_address: 'м. Львів, вул. Зелена, 1' }, (out) => {
      expect(out).toContain('Фактичне місце проживання: м. Львів, вул. Зелена, 1')
    }],
    ['actual address flag set but address empty', { same_actual_address: false, actual_address: '' }, (out) => {
      expect(out).not.toContain('Фактичне місце проживання:')
    }],

    ['plaintiff has passport instead of IPN', { has_no_ipn: true, passport_series: 'АВ 123456', tax_number: '' }, (out) => {
      expect(out).toContain('(серія та номер паспорта: АВ 123456)')
      expect(out).not.toContain('реєстраційний номер облікової картки')
    }],
    ['plaintiff no IPN and no passport', { has_no_ipn: true, tax_number: '', passport_series: '' }, (out) => {
      expect(out).not.toContain('реєстраційний номер облікової картки')
      expect(out).not.toContain('серія та номер паспорта')
    }],

    ['no plaintiff phone', { plaintiff_phone: '' }, (out) => {
      expect(out).not.toContain('Тел.:')
    }],
    ['no plaintiff email', { plaintiff_email: '' }, (out) => {
      expect(out).not.toContain('Адреса електронної пошти:')
    }],
    ['plaintiff official email present', { plaintiff_official_email: 'present' }, (out) => {
      expect(out).toContain('Офіційна електронна адреса: наявна в ЄСІТС')
    }],

    ['no defendant registered address', { defendant_registered_address: '' }, (out) => {
      expect(out.match(/Зареєстроване місце проживання:/g)).toHaveLength(1)
    }],
    ['defendant actual address different', { defendant_actual_address_known: 'different', defendant_actual_address: 'м. Одеса, вул. Дерибасівська, 5' }, (out) => {
      expect(out).toContain('Фактичне місце проживання: м. Одеса, вул. Дерибасівська, 5')
    }],
    ['defendant actual address different but empty', { defendant_actual_address_known: 'different', defendant_actual_address: '' }, (out) => {
      expect(out).not.toContain('Фактичне місце проживання')
    }],
    ['defendant actual address unknown', { defendant_actual_address_known: 'unknown' }, (out) => {
      expect(out).toContain('Фактичне місце проживання невідоме')
    }],

    ['defendant passport instead of IPN', { defendant_has_no_ipn: true, defendant_passport_series: 'СН 654321', defendant_tax_number: '' }, (out) => {
      expect(out).toContain('(серія та номер паспорта: СН 654321)')
    }],
    ['defendant phone and email present', { defendant_phone: '+380671112233', defendant_email: 'ivanov@gmail.com' }, (out) => {
      expect(out).toContain('Тел.: +380671112233')
      expect(out).toContain('Адреса електронної пошти: ivanov@gmail.com')
    }],
    ['defendant official email present', { defendant_official_email: 'present' }, (out) => {
      expect(out).toContain('Офіційна електронна адреса: наявна в ЄСІТС')
    }],
    ['defendant official email absent', { defendant_official_email: 'absent' }, (out) => {
      expect(out).toContain('Офіційна електронна адреса — відсутня')
    }],

    ['male plaintiff → fee exemption uses "звільнений"', { middle_name: 'Олександрович' }, (out) => {
      expect(out).toContain('я звільнений на підставі п.3 ч.1 ст.5')
    }],
    ['female plaintiff → fee exemption uses "звільнена"', {}, (out) => {
      expect(out).toContain('я звільнена на підставі п.3 ч.1 ст.5')
    }],

    ['prior_basis agreement (increase)', { prior_basis: 'agreement' }, (out) => {
      expect(out).toContain('Договором про сплату аліментів від')
      expect(out).toContain('копія договору про сплату аліментів від')
      expect(out).not.toContain('Рішенням')
      expect(out).not.toContain('копія рішення')
    }],

    ['prior fixed amount → formatMoney applied', { prior_alimony_type: 'fixed', prior_alimony_value: '8000' }, (out) => {
      expect(out).toContain('у твердій грошовій сумі в розмірі 8 000 грн')
    }],

    ['requested fixed amount → no 50%-floor clause', { requested_alimony_type: 'fixed', requested_alimony_value: '5000' }, (out) => {
      expect(out).toContain('5 000 грн щомісячно')
      expect(out).not.toContain('прожиткового мінімуму для')
    }],

    ['requested percent, 1 child → singular "дитини" + one floor amount', {}, (out) => {
      expect(out).toContain('не менше 50 відсотків прожиткового мінімуму для дитини відповідного віку (станом на 2026 рік — 1 756 грн)')
      expect(out).toContain('до повноліття дитини.')
    }],

    ['ai.reasoning empty → generic ст.182-184 fallback paragraph', {}, (out) => {
      expect(out).toContain('розмір аліментів має бути необхідним та достатнім для забезпечення гармонійного розвитку дитини')
    }],
  ]

  for (const [label, patch, assertFn] of cases) {
    it(label, () => assertFn(render({ ...BASE_ANSWERS, ...patch }, BASE_AI)))
  }

  it('ai.reasoning present → custom text replaces generic ст.182-184 paragraph', () => {
    const out = render(BASE_ANSWERS, { ...BASE_AI, reasoning: 'Кастомний текст обґрунтування зміни обставин.' })
    expect(out).toContain('Кастомний текст обґрунтування зміни обставин.')
    expect(out).not.toContain('розмір аліментів має бути необхідним та достатнім')
  })

  it('requested percent, 2 children → "кожної дитини" + per-child floor amounts joined by ", "', () => {
    const out = render({ ...BASE_ANSWERS, children_details: TWO_CHILDREN }, {
      ...BASE_AI,
      children_genitive: 'Іванова Олега Івановича, 15.05.2018 р.н.; Іванової Марії Іванівни, 20.08.2014 р.н.',
    })
    expect(out).toContain('не менше 50 відсотків прожиткового мінімуму для кожної дитини відповідного віку (станом на 2026 рік — 1 756 грн, 1 756 грн)')
    expect(out).toContain('до повноліття дітей.')
    expect(out).toContain('копія свідоцтв про народження дітей — по 2 примірники;')
  })

  it('no children_details + empty ai → children_genitive falls back to FALLBACK', () => {
    const out = render({ ...BASE_ANSWERS, children_details: '' }, {})
    expect(out).toContain('на утримання ________')
  })
})

// ─── Decrease-specific branches ──────────────────────────────────────────────

describe('parity: decrease-specific branches', () => {
  it('jurisdiction header + title (ст.27 ЦПК — місце проживання відповідача)', () => {
    const out = render(DECREASE_BASE, BASE_AI)
    expect(out).toContain('за зареєстрованим місцем проживання відповідача (ст. 27 ЦПК України)')
    expect(out).toContain('про зменшення розміру аліментів')
  })

  it('prior_basis court_decision (decrease): "з мене на користь відповідача"', () => {
    const out = render(DECREASE_BASE, BASE_AI)
    expect(out).toContain('з мене на користь відповідача')
    expect(out).toContain('у твердій грошовій сумі в розмірі 6 000 грн')
  })

  it('court fee = floor (0,4 ПМ) when 1% of price_of_claim <= floor', () => {
    // delta=2000 → price_of_claim=24000, 1%=240 < 1331.20
    const out = render(DECREASE_BASE, BASE_AI)
    expect(out).toContain('Ціна позову становить 24 000 грн')
    expect(out).toContain('судовий збір у розмірі 1 331,20 грн (0,4 прожиткового мінімуму для працездатних осіб — підлога')
  })

  it('court fee = 1% of price_of_claim when above floor', () => {
    // delta=13000 → price_of_claim=156000, 1%=1560 > 1331.20
    const out = render({ ...DECREASE_BASE, prior_alimony_value: '15000', requested_alimony_value: '2000' }, BASE_AI)
    expect(out).toContain('Ціна позову становить 156 000 грн')
    expect(out).toContain('судовий збір у розмірі 1 560 грн (1% ціни позову')
  })

  it('existing_debt = yes → ст.197 СК debt clause present', () => {
    const out = render({ ...DECREASE_BASE, existing_debt: 'yes' }, BASE_AI)
    expect(out).toContain('наявна заборгованість зі сплати аліментів за минулий період (ст. 197 СК України)')
  })

  it('existing_debt = no → debt clause absent', () => {
    const out = render({ ...DECREASE_BASE, existing_debt: 'no' }, BASE_AI)
    expect(out).not.toContain('заборгованість зі сплати аліментів')
  })

  it('court fee receipt attachment listed in Додатки', () => {
    const out = render(DECREASE_BASE, BASE_AI)
    expect(out).toContain('квитанція про сплату судового збору — 2 примірники;')
  })
})

// ─── Goldens: 3 fixture scenarios byte-identical to expected/*.txt ───────────

describe('goldens: template === expected files', () => {
  for (const n of [1, 2, 3]) {
    it(`scenario-${n} renders byte-identical to golden`, async () => {
      const { answers, mockAi } = await import(`../../../test-data/alimony-change/fixtures/scenario-${n}.mjs`)
      const expected = readFileSync(
        resolve(__dirname, `../../../test-data/alimony-change/expected/scenario-${n}.txt`),
        'utf8'
      )
      expect(renderViaEngine(answers, mockAi)).toBe(expected)
    })
  }
})
