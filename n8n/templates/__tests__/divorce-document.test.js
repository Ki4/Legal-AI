import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// divorce-document.js doesn't export via module.exports normally —
// it has a self-test guard. We load the source and replace that block
// with a proper export so we can test buildDivorceDocument.
const { buildDivorceDocument } = (() => {
  const code = readFileSync(resolve(__dirname, '../divorce-document.js'), 'utf8')
  const cleanCode = code.replace(
    /if\s*\(typeof module.*?require\.main.*?===.*?module\)[\s\S]*$/,
    '\nmodule.exports = { buildDivorceDocument };'
  )
  const m = { exports: {} }
  const fn = new Function('module', 'exports', cleanCode)
  fn(m, m.exports)
  return m.exports
})()

// ─── Minimal AI declension mock ─────────────────────────────────────────────

const baseAi = {
  plaintiff_instrumental: 'Петренко Оксаною Іванівною',
  plaintiff_genitive: 'Петренко Оксани Іванівни',
  spouse_instrumental: 'Петренком Андрієм Сергійовичем',
  spouse_genitive: 'Петренка Андрія Сергійовича',
  marriage_place_locative: 'Шевченківському відділі РАЦС у м. Києві',
  children_genitive: null,
}

// ─── Minimal answers for divorce without children ───────────────────────────

const baseAnswers = {
  last_name: 'Петренко',
  first_name: 'Оксана',
  middle_name: 'Іванівна',
  birth_date: '1990-03-15',
  registered_address: 'м. Київ, вул. Хрещатик, 1, кв. 5',
  same_actual_address: true,
  tax_number: '1234567890',
  has_no_ipn: false,
  plaintiff_phone: '+380501234567',
  plaintiff_email: 'test@example.com',
  plaintiff_official_email: 'absent',
  surname_after_divorce: 'keep',

  spouse_last_name: 'Петренко',
  spouse_first_name: 'Андрій',
  spouse_middle_name: 'Сергійович',
  spouse_birth_date: '1988-07-22',
  spouse_registered_address: 'м. Київ, вул. Хрещатик, 1, кв. 5',
  spouse_actual_address_known: 'same',
  spouse_tax_number: '0987654321',
  spouse_has_no_ipn: false,
  spouse_phone: '+380671234567',
  spouse_official_email: 'absent',

  marriage_date: '2015-06-20',
  marriage_place: 'Шевченківський відділ РАЦС у м. Києві',
  marriage_act_number: '123',
  marriage_cert_series: 'І-КВ № 123456',
  marriage_cert_date: '2015-06-20',

  spouse_consents: true,
  has_children: false,
  divorce_reasons: ['no_understanding', 'different_views'],
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildDivorceDocument', () => {
  it('produces a non-empty document string', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(typeof doc).toBe('string')
    expect(doc.length).toBeGreaterThan(500)
  })

  it('contains court header', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('До суду за місцем проживання відповідача')
  })

  it('contains plaintiff name', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('Позивач: Петренко Оксана Іванівна')
  })

  it('contains respondent name', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('Відповідач: Петренко Андрій Сергійович')
  })

  it('contains document title', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('ПОЗОВНА ЗАЯВА')
    expect(doc).toContain('про розірвання шлюбу')
  })

  it('uses AI declension for instrumental case', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('Петренком Андрієм Сергійовичем')
  })

  it('uses AI declension for locative case of marriage place', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('Шевченківському відділі РАЦС у м. Києві')
  })

  it('includes formatted marriage date', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('20')
    expect(doc).toContain('червня')
    expect(doc).toContain('2015')
  })

  it('includes IPN when provided', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('1234567890')
  })

  it('includes phone number', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('+380501234567')
  })

  it('says no children when has_children is false', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('спільних дітей у сторін немає')
  })

  it('includes divorce reasons from multicheck', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('відсутність взаєморозуміння')
    expect(doc).toContain("різні погляди на сімейне життя та обов'язки подружжя")
  })

  it('includes legal articles references', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('ст.105')
    expect(doc).toContain('ст.110')
    expect(doc).toContain('ст.112')
    expect(doc).toContain('СК України')
  })

  it('includes "ПРОШУ" section', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('П Р О Ш У')
  })

  it('includes attachments section', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('Додатки:')
    expect(doc).toContain('свідоцтво про шлюб')
  })

  it('includes signature block', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    expect(doc).toContain('(підпис)')
    expect(doc).toContain('Петренко Оксана Іванівна')
  })

  // ── Spouse consent variants ──

  it('says spouse consents when spouse_consents is true', () => {
    const doc = buildDivorceDocument({ ...baseAnswers, spouse_consents: true }, baseAi)
    expect(doc).toContain('згоден на розірвання шлюбу')
  })

  it('says spouse does not consent when false', () => {
    const doc = buildDivorceDocument({ ...baseAnswers, spouse_consents: false }, baseAi)
    expect(doc).toContain('не дає згоди на розірвання шлюбу')
  })

  // ── Children ──

  it('includes children section when has_children is true', () => {
    const withChildren = {
      ...baseAnswers,
      has_children: true,
      children_details: 'Петренко Софія Андріївна, 01.03.2018',
      children_live_with: 'plaintiff',
      children_dispute: 'none',
    }
    const ai = { ...baseAi, children_genitive: 'Петренко Софії Андріївни, 01.03.2018 р.н.' }
    const doc = buildDivorceDocument(withChildren, ai)
    expect(doc).toContain('спільні неповнолітні діти')
    expect(doc).toContain('Діти проживають з позивачем')
  })

  // ── Alimony ──

  it('includes alimony request when alimony_claim is true', () => {
    const withAlimony = {
      ...baseAnswers,
      has_children: true,
      children_details: 'Петренко Софія Андріївна, 01.03.2018',
      children_live_with: 'plaintiff',
      children_dispute: 'none',
      alimony_claim: true,
      alimony_amount: 'percent',
    }
    const ai = { ...baseAi, children_genitive: 'Петренко Софії Андріївни, 01.03.2018 р.н.' }
    const doc = buildDivorceDocument(withAlimony, ai)
    expect(doc).toContain('аліменти')
    expect(doc).toContain('1/4 (25%)')
  })

  it('uses 1/3 fraction for 2 children', () => {
    const with2Kids = {
      ...baseAnswers,
      has_children: true,
      children_details: 'Петренко Софія Андріївна, 01.03.2018\nПетренко Максим Андрійович, 15.09.2020',
      children_live_with: 'plaintiff',
      children_dispute: 'none',
      alimony_claim: true,
      alimony_amount: 'percent',
    }
    const doc = buildDivorceDocument(with2Kids, baseAi)
    expect(doc).toContain('1/3 (33%)')
  })

  // ── Joint property ──

  it('includes property division when has_joint_property and not separate', () => {
    const withProp = {
      ...baseAnswers,
      has_joint_property: true,
      property_dispute: 'together',
      property_details: 'квартира за адресою м. Київ, вул. Хрещатик, 1',
    }
    const doc = buildDivorceDocument(withProp, baseAi)
    expect(doc).toContain('спільне майно')
    expect(doc).toContain('квартира за адресою')
    expect(doc).toContain('1/2 частку')
  })

  it('mentions separate proceeding for property_dispute=separate', () => {
    const withPropSep = {
      ...baseAnswers,
      has_joint_property: true,
      property_dispute: 'separate',
    }
    const doc = buildDivorceDocument(withPropSep, baseAi)
    expect(doc).toContain('окремому провадженні')
  })

  // ── Court fee exemption ──

  it('includes exemption text when court_fee_exempt', () => {
    const exempt = {
      ...baseAnswers,
      court_fee_exempt: 'yes',
      court_fee_exempt_reason: 'disability_1_2',
    }
    const doc = buildDivorceDocument(exempt, baseAi)
    expect(doc).toContain('звільнена')
    expect(doc).toContain('інвалідністю')
  })

  // ── Maiden name ──

  it('includes maiden name restoration when requested', () => {
    const maiden = {
      ...baseAnswers,
      surname_after_divorce: 'maiden',
      maiden_name: 'Іванченко',
    }
    const doc = buildDivorceDocument(maiden, baseAi)
    expect(doc).toContain('дошлюбне прізвище')
    expect(doc).toContain('Іванченко')
  })

  // ── Debt ──

  it('includes debt section when debt_claim is true', () => {
    const withDebt = {
      ...baseAnswers,
      debt_claim: true,
      debt_details: 'кредитний договір № 123 від 01.01.2020',
    }
    const doc = buildDivorceDocument(withDebt, baseAi)
    expect(doc).toContain("боргові зобов'язання")
    expect(doc).toContain('кредитний договір')
  })

  // ── Fallbacks when AI is empty ──

  it('falls back to raw names when AI declension is empty', () => {
    const doc = buildDivorceDocument(baseAnswers, {})
    // Should still produce a document, using raw name as fallback
    expect(doc).toContain('Петренко Андрій Сергійович')
    expect(doc.length).toBeGreaterThan(500)
  })

  it('handles completely missing AI object', () => {
    const doc = buildDivorceDocument(baseAnswers, null)
    expect(doc).toContain('ПОЗОВНА ЗАЯВА')
    expect(doc.length).toBeGreaterThan(500)
  })

  // ── Female plaintiff gender detection ──

  it('uses feminine verb for female plaintiff', () => {
    const doc = buildDivorceDocument(baseAnswers, baseAi)
    // Оксана Іванівна → female → "зареєструвала"
    expect(doc).toContain('зареєструвала')
  })

  it('uses masculine verb for male plaintiff', () => {
    const maleAnswers = {
      ...baseAnswers,
      first_name: 'Андрій',
      middle_name: 'Сергійович',
      last_name: 'Петренко',
    }
    const doc = buildDivorceDocument(maleAnswers, baseAi)
    expect(doc).toContain('зареєстрував')
  })
})
