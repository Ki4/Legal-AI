/**
 * Drift guard: the verbatim copies in src/ must behave identically to the
 * apps/client originals on the same inputs. If this file goes red, re-copy the
 * client original (see provenance headers) — never patch the copy in place.
 */
import { describe, expect, it } from 'vitest'

import * as copyV from '../validators.js'
import * as copyC from '../conditions.js'
// Cross-folder imports of the client originals (vitest transpiles them; tsc excludes __tests__)
import * as origV from '../../../client/src/lib/validators'
import * as origC from '../../../client/src/lib/conditions'
import { alimonyConfig } from '../../../client/src/data/alimonyConfig'

import type { Answers, FormField, ShowIfCondition } from '../types.js'

const STRING_CASES = [
  '',
  '   ',
  'name@example.com',
  'name@example',
  'weird @mail.com',
  '+380501234567',
  '0501234567',
  '380501234567',
  '050123456',
  '8050123456',
  '+38 (050) 123-45-67',
  '1234567899', // valid INN: checksum computed by hand (sum=295, 295%11%10=9)
  '1234567890', // broken checksum
  '2934567890',
  '123456789',
  '12345678901',
  'абв1234567',
  ' 1234567899 ',
  'UA213996220000026007233566001',
  'UA213996220000026007233566002',
  'UA21399622000002600723356600',
  'ua21 3996 2200 0002 6007 2335 6600 1',
  'Іваненко',
  "Мар'яна-Оксана",
  'Ivanov',
  'Іван123',
  'ыуйцу"',
  'АА123456',
  'AA123456', // Latin letters — must be rejected by passport rule
  '123456789 ',
  '12345678',
  'АА 123456',
]

describe('validators parity (copy === client original)', () => {
  const fns = ['validateEmail', 'validatePhoneUA', 'validateInn', 'validateName', 'validatePassport', 'validateIban'] as const

  for (const fn of fns) {
    it(fn, () => {
      for (const v of STRING_CASES) {
        expect(copyV[fn](v), `${fn}(${JSON.stringify(v)})`).toBe(origV[fn](v))
      }
    })
  }

  it('known ground truths hold (absolute, not just parity)', () => {
    expect(copyV.validateInn('1234567899')).toBeNull()
    expect(copyV.validateInn('1234567890')).toBe('Некоректний ІПН (не сходиться контрольна цифра)')
    expect(copyV.validateInn('12345')).toBe('ІПН має містити 10 цифр')
    expect(copyV.validatePassport('АА123456')).toBeNull()
    expect(copyV.validatePassport('AA123456')).not.toBeNull()
    expect(copyV.validateIban('UA2139962200000260072335660')).toBe('Некоректний IBAN (UA + 27 цифр)')
    expect(copyV.validateName('Ivanov')).not.toBeNull()
    expect(copyV.validateName("Мар'яна-Оксана")).toBeNull()
  })

  it('resolveValidationRule parity across alimony fields + synthetic ids', () => {
    const synthetic: FormField[] = [
      { id: 'tcc_name', tab: 't', type: 'text', label: 'x' },
      { id: 'plaintiff_email', tab: 't', type: 'text', label: 'x' },
      { id: 'contact', tab: 't', type: 'phone', label: 'x' },
      { id: 'note_email', tab: 't', type: 'textarea', label: 'x' },
      { id: 'tax_number', tab: 't', type: 'text', label: 'x' },
      { id: 'random', tab: 't', type: 'text', label: 'x', validation: 'iban' },
      { id: 'first_name', tab: 't', type: 'text', label: 'x' },
      { id: 'defendant_passport_series', tab: 't', type: 'text', label: 'x' },
    ]
    for (const f of [...alimonyConfig.steps, ...synthetic]) {
      expect(copyV.resolveValidationRule(f as FormField), f.id).toBe(origV.resolveValidationRule(f))
    }
  })

  it('validateValue parity incl. non-string values', () => {
    const values: unknown[] = ['', '  ', 'abc', true, false, null, undefined, ['a'], 42, '0501234567']
    for (const f of alimonyConfig.steps) {
      for (const v of values) {
        expect(copyV.validateValue(f as FormField, v), `${f.id}<${String(v)}>`).toBe(origV.validateValue(f, v))
      }
    }
  })
})

describe('conditions parity (copy === client original)', () => {
  const SCENARIOS: Answers[] = [
    {},
    { same_actual_address: true },
    { same_actual_address: false },
    { has_no_ipn: true, defendant_has_no_ipn: true },
    { marital_status: 'divorced' },
    { marital_status: 'never_married' },
    { plaintiff_has_account: true },
    { alimony_type: 'fixed' },
    { defendant_employed: 'yes' },
    { defendant_actual_address_known: 'different' },
    { some_number: '5' },
    { some_number: 2 },
  ]

  it('evalSingle parity on operator matrix', () => {
    const conds = [
      { field: 'same_actual_address', operator: '==', value: true },
      { field: 'same_actual_address', operator: '!=', value: true },
      { field: 'marital_status', operator: '==', value: 'divorced' },
      { field: 'some_number', operator: '>', value: 3 },
      { field: 'some_number', operator: '<', value: 3 },
      { field: 'missing_field', operator: '!=', value: true },
    ] as const
    for (const answers of SCENARIOS) {
      for (const c of conds) {
        expect(copyC.evalSingle(c, answers)).toBe(origC.evalSingle(c, answers))
      }
    }
  })

  it('isVisible parity over the real alimony show_if graph', () => {
    for (const answers of SCENARIOS) {
      for (const step of alimonyConfig.steps) {
        expect(copyC.isVisible(step, answers as Answers), `${step.id}`).toBe(origC.isVisible(step, answers))
      }
    }
  })

  it('evalCondition parity for all/any combinators', () => {
    const combos: ShowIfCondition[] = [
      { all: [{ field: 'a', operator: '==', value: true }, { field: 'b', operator: '!=', value: 'x' }] },
      { any: [{ field: 'a', operator: '==', value: true }, { field: 'b', operator: '==', value: 'x' }] },
      { field: 'a', operator: '==', value: false },
    ]
    const answerSets: Answers[] = [{}, { a: true }, { b: 'x' }, { a: true, b: 'x' }, { a: false, b: 'y' }]
    for (const cond of combos) {
      for (const answers of answerSets) {
        expect(copyC.evalCondition(cond, answers)).toBe(origC.evalCondition(cond as never, answers))
      }
    }
  })
})
