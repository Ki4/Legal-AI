/**
 * Matrix for validateAnswers (plan D3, task T4). The REAL alimonyConfig is the
 * main fixture so the show_if graph, labels and validator wiring are the
 * production ones; tiny synthetic configs cover multicheck/number, which the
 * alimony form does not contain.
 */
import { describe, expect, it } from 'vitest'

import { MAX_ARRAY_ITEMS, MAX_FIELD_CHARS, validateAnswers } from '../validate.js'
// Cross-folder import of the client SSoT config (vitest transpiles it; tsc excludes __tests__)
import { alimonyConfig } from '../../../client/src/data/alimonyConfig'
import type { FormConfig, FormField } from '../types.js'

const config = alimonyConfig as FormConfig

/** Ground truth (plan «Проверенные факты»): the 16 unconditionally-required alimony ids. */
const UNCONDITIONAL_REQUIRED = [
  'last_name',
  'first_name',
  'middle_name',
  'birth_date',
  'registered_address',
  'defendant_last_name',
  'defendant_first_name',
  'defendant_middle_name',
  'defendant_registered_address',
  'marital_status',
  'children_details',
  'family_cert_date',
  'abandonment_date',
  'alimony_type',
  'alimony_start_date',
  'defendant_employed',
]

function miniConfig(field: FormField): FormConfig {
  return {
    service_id: 'test',
    title: 'Test',
    tabs: [{ id: 't', label: 'T' }],
    steps: [field],
  }
}

const multicheckConfig = miniConfig({
  id: 'reasons',
  tab: 't',
  type: 'multicheck',
  label: 'Причини',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ],
})

const numberConfig = miniConfig({ id: 'amount', tab: 't', type: 'number', label: 'Сума' })

describe('validateAnswers — strict mode', () => {
  it('empty input → exactly the 16 unconditionally-required fields as missing_required errors', () => {
    const report = validateAnswers(config, {}, 'strict')
    expect(report.ok).toBe(false)
    expect(report.errors).toHaveLength(16)
    expect(report.errors.every((e) => e.problem === 'missing_required')).toBe(true)
    expect(report.errors.every((e) => e.message === "Обов'язкове поле не заповнено")).toBe(true)
    expect(new Set(report.errors.map((e) => e.field))).toEqual(new Set(UNCONDITIONAL_REQUIRED))
    // strict mode: missingRequired mirrors the missing_required errors
    expect(report.missingRequired.map((m) => m.field).sort()).toEqual([...UNCONDITIONAL_REQUIRED].sort())
    expect(report.warnings).toHaveLength(0)
    expect(report.cleaned).toEqual({})
  })

  it('hidden field with a value → hidden_by_condition warning + nulled in cleaned', () => {
    const report = validateAnswers(config, { has_no_ipn: true, tax_number: '1234567899' }, 'strict')
    const warning = report.warnings.find((w) => w.field === 'tax_number')
    expect(warning?.problem).toBe('hidden_by_condition')
    expect(warning?.message).toContain('has_no_ipn != true') // describeCondition rendering of show_if
    expect(warning?.message).toContain('значення проігноровано')
    expect(report.cleaned.tax_number).toBeNull()
    expect(report.cleaned.has_no_ipn).toBe(true)
    // no error for the hidden field — its (valid) value was simply discarded
    expect(report.errors.some((e) => e.field === 'tax_number')).toBe(false)
  })

  it('hidden field with an INVALID value → still only a warning (format checks are visible-only)', () => {
    const report = validateAnswers(config, { has_no_ipn: true, tax_number: '1234567890' }, 'strict')
    expect(report.errors.some((e) => e.field === 'tax_number')).toBe(false)
    expect(report.warnings.some((w) => w.field === 'tax_number' && w.problem === 'hidden_by_condition')).toBe(true)
    expect(report.cleaned.tax_number).toBeNull()
  })

  it('visible ІПН with broken checksum → invalid_format with the verbatim client message', () => {
    const report = validateAnswers(config, { tax_number: '1234567890' }, 'strict')
    const error = report.errors.find((e) => e.field === 'tax_number')
    expect(error?.problem).toBe('invalid_format')
    expect(error?.message).toBe('Некоректний ІПН (не сходиться контрольна цифра)')
  })

  it('choice value outside options → invalid_option listing the allowed values', () => {
    const report = validateAnswers(config, { marital_status: 'separated' }, 'strict')
    const error = report.errors.find((e) => e.field === 'marital_status')
    expect(error?.problem).toBe('invalid_option')
    expect(error?.expected).toContain('Допустимі значення')
    expect(error?.expected).toContain('married')
    expect(error?.expected).toContain('divorced')
    expect(error?.expected).toContain('never_married')
  })

  it('same_actual_address=false reveals actual_address without making it required', () => {
    const report = validateAnswers(config, { same_actual_address: false }, 'strict')
    // actual_address is now visible (show_if same_actual_address != true) but has no required:true
    expect(report.errors.some((e) => e.field === 'actual_address')).toBe(false)
    expect(report.missingRequired.some((m) => m.field === 'actual_address')).toBe(false)
    // boolean false IS answered (client isAnswered semantics) — no issue for the toggle itself
    expect(report.errors.some((e) => e.field === 'same_actual_address')).toBe(false)
    expect(report.errors.filter((e) => e.problem === 'missing_required')).toHaveLength(16)
  })

  it("boolean field given a string ('yes') → invalid_type", () => {
    const report = validateAnswers(config, { same_actual_address: 'yes' }, 'strict')
    const error = report.errors.find((e) => e.field === 'same_actual_address')
    expect(error?.problem).toBe('invalid_type')
  })

  it('unknown input key → unknown_field error and the key is NOT copied into cleaned', () => {
    const report = validateAnswers(config, { plaintif_name: 'Іван' }, 'strict')
    const error = report.errors.find((e) => e.field === 'plaintif_name')
    expect(error?.problem).toBe('unknown_field')
    expect(error?.label).toBeNull()
    expect('plaintif_name' in report.cleaned).toBe(false)
  })

  it('unknown key one typo away from a real id → hint suggests the real id', () => {
    const report = validateAnswers(config, { tax_numbe: '1234567899' }, 'strict')
    const error = report.errors.find((e) => e.field === 'tax_numbe')
    expect(error?.problem).toBe('unknown_field')
    expect(error?.hint).toContain('tax_number')
  })
})

describe('validateAnswers — date fields', () => {
  it("'15.03.1990' → invalid_format with the exact server message", () => {
    const report = validateAnswers(config, { birth_date: '15.03.1990' }, 'strict')
    const error = report.errors.find((e) => e.field === 'birth_date')
    expect(error?.problem).toBe('invalid_format')
    expect(error?.message).toBe('Дата має бути у форматі YYYY-MM-DD (наприклад 1990-03-15)')
  })

  it("'1990-02-30' matches the shape but is not a real calendar date → invalid_format", () => {
    const report = validateAnswers(config, { birth_date: '1990-02-30' }, 'strict')
    expect(report.errors.some((e) => e.field === 'birth_date' && e.problem === 'invalid_format')).toBe(true)
  })

  it("'1990-03-15' → no error for the field", () => {
    const report = validateAnswers(config, { birth_date: '1990-03-15' }, 'strict')
    expect(report.errors.some((e) => e.field === 'birth_date')).toBe(false)
  })
})

describe('validateAnswers — multicheck (synthetic fixture)', () => {
  it('item outside options → invalid_option', () => {
    const report = validateAnswers(multicheckConfig, { reasons: ['a', 'c'] }, 'strict')
    const error = report.errors.find((e) => e.field === 'reasons')
    expect(error?.problem).toBe('invalid_option')
    expect(error?.expected).toContain('Допустимі значення')
  })

  it('non-array value → invalid_type', () => {
    const report = validateAnswers(multicheckConfig, { reasons: 'a' }, 'strict')
    expect(report.errors.find((e) => e.field === 'reasons')?.problem).toBe('invalid_type')
  })

  it(`more than ${MAX_ARRAY_ITEMS} items → invalid_format`, () => {
    const items = Array<string>(MAX_ARRAY_ITEMS + 1).fill('a')
    const report = validateAnswers(multicheckConfig, { reasons: items }, 'strict')
    expect(report.errors.find((e) => e.field === 'reasons')?.problem).toBe('invalid_format')
  })
})

describe('validateAnswers — number fields (synthetic fixture)', () => {
  it("non-numeric string → invalid_format; '5000,50' passes", () => {
    const bad = validateAnswers(numberConfig, { amount: 'п’ять тисяч' }, 'strict')
    expect(bad.errors.find((e) => e.field === 'amount')?.problem).toBe('invalid_format')
    const good = validateAnswers(numberConfig, { amount: '5000,50' }, 'strict')
    expect(good.errors.some((e) => e.field === 'amount')).toBe(false)
  })
})

describe('validateAnswers — length caps', () => {
  it('text field over the default 200-char cap → invalid_format', () => {
    const report = validateAnswers(config, { registered_address: 'х'.repeat(201) }, 'strict')
    const error = report.errors.find((e) => e.field === 'registered_address')
    expect(error?.problem).toBe('invalid_format')
    expect(error?.message).toBe('Значення задовге (максимум 200 символів)')
  })

  it('any string field is capped at MAX_FIELD_CHARS even without a per-field cap', () => {
    const report = validateAnswers(numberConfig, { amount: '1'.repeat(MAX_FIELD_CHARS + 1) }, 'strict')
    const error = report.errors.find((e) => e.field === 'amount')
    expect(error?.problem).toBe('invalid_format')
    expect(error?.message).toBe(`Значення задовге (максимум ${MAX_FIELD_CHARS} символів)`)
  })
})

describe('validateAnswers — partial mode', () => {
  it('format errors still fire; missing required are informational only', () => {
    const report = validateAnswers(config, { tax_number: '1234567890' }, 'partial')
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]?.field).toBe('tax_number')
    expect(report.errors[0]?.problem).toBe('invalid_format')
    expect(report.errors.some((e) => e.problem === 'missing_required')).toBe(false)
    expect(report.missingRequired).toHaveLength(16)
    expect(report.ok).toBe(false) // false ONLY because of the ІПН error
  })

  it('only valid provided fields → ok:true with non-empty missingRequired', () => {
    const report = validateAnswers(config, { last_name: 'Іваненко' }, 'partial')
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.missingRequired).toHaveLength(15)
    expect(report.missingRequired.some((m) => m.field === 'last_name')).toBe(false)
  })
})

describe('validateAnswers — children_details heuristic', () => {
  it('well-formed line (ПІБ, ДД.ММ.РРРР, свідоцтво…) → no warning', () => {
    const report = validateAnswers(
      config,
      { children_details: 'Іваненко Марія Петрівна, 12.05.2015, свідоцтво № І-АБ 123456 від 20.05.2015' },
      'strict',
    )
    expect(report.warnings.filter((w) => w.field === 'children_details')).toHaveLength(0)
  })

  it('line without a parseable birth date → warning explaining the expected line format', () => {
    const report = validateAnswers(config, { children_details: 'Марія' }, 'strict')
    const warning = report.warnings.find((w) => w.field === 'children_details')
    expect(warning?.problem).toBe('invalid_format')
    expect(warning?.message).toContain('ПІБ, дата народження, свідоцтво № ... від ...')
  })

  it('mixed lines → one warning per bad line only', () => {
    const report = validateAnswers(
      config,
      { children_details: 'Іваненко Марія Петрівна, 12.05.2015, свідоцтво № І-АБ 123456 від 20.05.2015\nМарія' },
      'strict',
    )
    expect(report.warnings.filter((w) => w.field === 'children_details')).toHaveLength(1)
  })
})

describe('validateAnswers — payload contract (plan D3)', () => {
  it('broken-ІПН issue carries the full ValidationIssue shape', () => {
    const report = validateAnswers(config, { tax_number: '1234567890' }, 'strict')
    const issue = report.errors.find((e) => e.field === 'tax_number')
    expect(issue).toEqual({
      field: 'tax_number',
      label: 'ІПН (РНОКПП)',
      problem: 'invalid_format',
      message: 'Некоректний ІПН (не сходиться контрольна цифра)',
      expected: '10 цифр РНОКПП з коректною контрольною цифрою',
      hint: 'Перепитайте користувача точне значення поля «ІПН (РНОКПП)» і викличте інструмент повторно.',
    })
    expect(issue?.hint).toContain('Перепитайте')
  })
})
