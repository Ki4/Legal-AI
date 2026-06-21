import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * divorce-with-children G1 (issue #28): "суд визначить" residence option +
 * графік участі у вихованні (ст.157 СК) for the parent living separately.
 *
 * No legacy-builder equivalent exists for these branches (they postdate the
 * doc-engine port, divorce-template-parity.test.js's `buildDivorceDocument`
 * comparison doesn't apply) -- these tests assert directly on engine output.
 * Existing 263 parity tests stay green untouched (verified separately): the
 * new fields are absent in all of their fixtures, so none of these branches
 * fire and the existing numbered items (5-8) are computed by unmodified code.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadCjs(relPath) {
  const code = readFileSync(resolve(__dirname, relPath), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, () => { throw new Error('require not available') })
  return m.exports
}

const { renderDocument, buildContext } = loadCjs('../render-document.js')
const TEMPLATE = readFileSync(resolve(__dirname, '../services/divorce.document.txt'), 'utf8')
const render = (answers, ai) => renderDocument(TEMPLATE, buildContext(answers, ai))

const BASE_ANSWERS = {
  last_name: 'Коваленко', first_name: 'Марія', middle_name: 'Олександрівна',
  birth_date: '1985-11-08',
  registered_address: 'м. Одеса, вул. Дерибасівська, 5, кв. 12',
  same_actual_address: true,
  tax_number: '2756789012', has_no_ipn: false,
  plaintiff_phone: '+380931234567', plaintiff_email: 'kovalenko.maria@ukr.net',
  plaintiff_official_email: 'absent', surname_after_divorce: 'keep',
  spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович',
  spouse_birth_date: '1983-02-14',
  spouse_registered_address: 'м. Одеса, вул. Пушкінська, 20, кв. 8',
  spouse_actual_address_known: 'same',
  spouse_tax_number: '2667890123', spouse_has_no_ipn: false,
  spouse_phone: '+380951234567', spouse_email: 'kovalenko.viktor@ukr.net',
  spouse_official_email: 'unknown',
  marriage_date: '2010-09-10',
  marriage_place: 'Приморський відділ РАЦС Одеського міського управління юстиції',
  marriage_act_number: '312', marriage_cert_series: 'І-ОД № 456789', marriage_cert_date: '2010-09-10',
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
  simplified_proceedings: 'yes', court_fee_exempt: 'no', court_costs_on: 'defendant',
  pretrial_settlement: 'not_conducted', evidence_preservation: 'not_conducted', originals_location: 'plaintiff',
}

const BASE_AI = {
  plaintiff_instrumental: 'Коваленко Марією Олександрівною',
  plaintiff_genitive: 'Коваленко Марії Олександрівни',
  defendant_instrumental: 'Коваленком Віктором Петровичем',
  defendant_genitive: 'Коваленка Віктора Петровича',
  marriage_place_locative: 'Приморському відділі РАЦС Одеського міського управління юстиції',
}

describe('children_live_with = court', () => {
  it('renders the court-determines-residence sentence', () => {
    const text = render({ ...BASE_ANSWERS, children_live_with: 'court' }, BASE_AI)
    expect(text).toContain('Місце проживання дітей сторонами не визначено та підлягає встановленню судом.')
    expect(text).not.toContain('Діти проживають')
  })

  it('still asks the court to determine residence, without a dangling "з ________"', () => {
    const text = render({ ...BASE_ANSWERS, children_live_with: 'court' }, BASE_AI)
    expect(text).toMatch(/5\. Визначити місце проживання Коваленко Олена Вікторівна, 15\.05\.2012 р\.н\.\n/)
    expect(text).not.toContain('з ________')
  })
})

describe('visitation schedule (ст.157 СК) — agreed', () => {
  it('renders the agreed-schedule paragraph and numbers the ПРОШУ item 6 when nothing else optional is present', () => {
    const text = render({
      ...BASE_ANSWERS,
      visitation_dispute: 'none',
      visitation_schedule_text: 'кожні вихідні з пʼятниці по неділю',
    }, BASE_AI)
    expect(text).toContain(
      'Відповідно до ст.157 Сімейного кодексу України сторони узгодили графік участі у вихованні та спілкуванні з дитиною того з батьків, хто проживає окремо: кожні вихідні з пʼятниці по неділю.'
    )
    expect(text).toMatch(/6\. Визначити графік участі у вихованні та спілкуванні з дитиною того з батьків, хто проживає окремо, відповідно до ст\.157 Сімейного кодексу України: кожні вихідні з пʼятниці по неділю\./)
  })

  it('is numbered 7 (last) when residence + alimony are present; property/debt add no ПРОШУ items (Variant B, #67)', () => {
    const text = render({
      ...BASE_ANSWERS,
      alimony_claim: true, alimony_amount: 'percent',
      has_joint_property: true, property_dispute: 'none',
      debt_claim: true,
      visitation_dispute: 'none',
      visitation_schedule_text: 'кожні вихідні',
    }, BASE_AI)
    expect(text).toMatch(/5\. Визначити місце проживання/)
    expect(text).toMatch(/6\. Стягнути з відповідача/)
    // Variant B: property/debt division is deferred to a separate suit — no ПРОШУ demand
    expect(text).not.toMatch(/Визнати за позивачем право на 1\/2/)
    expect(text).not.toMatch(/Розподілити між сторонами спільні боргові/)
    expect(text).toMatch(/7\. Визначити графік участі у вихованні/)
    // body acknowledges property/debt but defers division (no ________ placeholders)
    expect(text).toContain('вимога про поділ майна не є предметом цього позову')
    expect(text).toContain('Вимога про їх розподіл не є предметом цього позову')
  })

  it('renders even when the residence item itself is disputed (visitation is independently gated)', () => {
    const text = render({
      ...BASE_ANSWERS,
      children_dispute: 'separate',
      visitation_dispute: 'none',
      visitation_schedule_text: 'кожні вихідні',
    }, BASE_AI)
    expect(text).not.toMatch(/\d\. Визначити місце проживання/) // residence item suppressed by dispute
    expect(text).toMatch(/5\. Визначити графік участі у вихованні/) // visitation still asked, becomes item 5
  })

  it('does not render when the schedule text is empty (no placeholder — optional clause with nothing elected)', () => {
    const text = render({ ...BASE_ANSWERS, visitation_dispute: 'none', visitation_schedule_text: '' }, BASE_AI)
    expect(text).not.toContain('ст.157 Сімейного кодексу України')
    expect(text).not.toMatch(/Визначити графік участі/)
  })
})

describe('visitation schedule — disputed', () => {
  it('renders the deferral sentence, no numbered ПРОШУ item', () => {
    const text = render({ ...BASE_ANSWERS, visitation_dispute: 'separate' }, BASE_AI)
    expect(text).toContain(
      'Спір щодо порядку участі у вихованні дитини та графіка побачень того з батьків, хто проживає окремо, буде вирішуватися в окремому провадженні.'
    )
    expect(text).not.toMatch(/Визначити графік участі/)
  })
})

describe('visitation guard — children_live_with both/court ignores stale visitation fields', () => {
  it('both: visitation fields present in payload are ignored entirely', () => {
    const text = render({
      ...BASE_ANSWERS, children_live_with: 'both',
      visitation_dispute: 'none', visitation_schedule_text: 'кожні вихідні',
    }, BASE_AI)
    expect(text).not.toContain('ст.157 Сімейного кодексу України')
    expect(text).not.toMatch(/Визначити графік участі/)
  })

  it("court: visitation fields present in payload are ignored entirely", () => {
    const text = render({
      ...BASE_ANSWERS, children_live_with: 'court',
      visitation_dispute: 'separate',
    }, BASE_AI)
    expect(text).not.toContain('графіка побачень того з батьків')
  })
})
