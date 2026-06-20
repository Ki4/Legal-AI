import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhoneUA,
  validateInn,
  validateName,
  validatePassport,
  resolveValidationRule,
  validateValue,
} from '../validators'
import type { FormField } from '../../types/form'

// ─── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts a normal email', () => {
    expect(validateEmail('name@example.com')).toBeNull()
  })
  it('accepts subdomains and plus-addressing', () => {
    expect(validateEmail('a.b+tag@mail.sub.example.co')).toBeNull()
  })
  it('trims surrounding whitespace', () => {
    expect(validateEmail('  name@example.com  ')).toBeNull()
  })
  it('rejects missing @', () => {
    expect(validateEmail('nameexample.com')).not.toBeNull()
  })
  it('rejects missing TLD', () => {
    expect(validateEmail('name@example')).not.toBeNull()
  })
  it('rejects spaces inside', () => {
    expect(validateEmail('na me@example.com')).not.toBeNull()
  })
})

// ─── validatePhoneUA ──────────────────────────────────────────────────────────

describe('validatePhoneUA', () => {
  it('accepts +380XXXXXXXXX', () => {
    expect(validatePhoneUA('+380501234567')).toBeNull()
  })
  it('accepts 380XXXXXXXXX without plus', () => {
    expect(validatePhoneUA('380501234567')).toBeNull()
  })
  it('accepts local 0XXXXXXXXX', () => {
    expect(validatePhoneUA('0501234567')).toBeNull()
  })
  it('accepts formatting characters (spaces, dashes, parens)', () => {
    expect(validatePhoneUA('+380 (50) 123-45-67')).toBeNull()
  })
  it('rejects too few digits', () => {
    expect(validatePhoneUA('+38050123')).not.toBeNull()
  })
  it('rejects too many digits', () => {
    expect(validatePhoneUA('+3805012345678')).not.toBeNull()
  })
  it('rejects a 10-digit number not starting with 0', () => {
    expect(validatePhoneUA('1234567890')).not.toBeNull()
  })
})

// ─── validateInn (РНОКПП) ─────────────────────────────────────────────────────

describe('validateInn', () => {
  // 3068208400 is a well-known valid sample РНОКПП (checksum holds)
  it('accepts a valid 10-digit ІПН with correct checksum', () => {
    expect(validateInn('3068208400')).toBeNull()
  })
  it('rejects fewer than 10 digits', () => {
    expect(validateInn('123456789')).toBe('ІПН має містити 10 цифр')
  })
  it('rejects non-digit characters', () => {
    expect(validateInn('30682084ab')).toBe('ІПН має містити 10 цифр')
  })
  it('rejects a 10-digit number with a wrong checksum', () => {
    expect(validateInn('3068208401')).toBe('Некоректний ІПН (не сходиться контрольна цифра)')
  })
})

// ─── validateName ─────────────────────────────────────────────────────────────

describe('validateName', () => {
  it('accepts a simple Ukrainian name', () => {
    expect(validateName('Іваненко')).toBeNull()
  })
  it('accepts an apostrophe and hyphen', () => {
    expect(validateName("Дʼяченко-Петренко")).toBeNull()
    expect(validateName("Кравець'юк")).toBeNull()
  })
  it('accepts a Russian-form name (full Cyrillic block)', () => {
    expect(validateName('Воробьёв')).toBeNull()
  })
  it('rejects a trailing quote (the ыуйцу" case)', () => {
    expect(validateName('ыуйцу"')).not.toBeNull()
  })
  it('rejects digits', () => {
    expect(validateName('Іван123')).not.toBeNull()
  })
  it('rejects Latin letters', () => {
    expect(validateName('Ivan')).not.toBeNull()
  })
  it('rejects a value with no letters', () => {
    expect(validateName('---')).not.toBeNull()
  })
})

// ─── validatePassport ─────────────────────────────────────────────────────────

describe('validatePassport', () => {
  it('accepts the old book format (2 letters + 6 digits)', () => {
    expect(validatePassport('АА123456')).toBeNull()
  })
  it('accepts the old format with a space', () => {
    expect(validatePassport('АА 123456')).toBeNull()
  })
  it('accepts a 9-digit ID-card number', () => {
    expect(validatePassport('123456789')).toBeNull()
  })
  it('rejects Latin letters in the series', () => {
    expect(validatePassport('AA123456')).not.toBeNull()
  })
  it('rejects the wrong digit count', () => {
    expect(validatePassport('АА12345')).not.toBeNull()
    expect(validatePassport('12345678')).not.toBeNull()
  })
})

// ─── resolveValidationRule ────────────────────────────────────────────────────

function f(partial: Partial<FormField>): FormField {
  return { id: 'x', tab: 't', type: 'text', label: 'L', ...partial }
}

describe('resolveValidationRule', () => {
  it('honours an explicit validation rule', () => {
    expect(resolveValidationRule(f({ type: 'text', id: 'whatever', validation: 'email' }))).toBe('email')
  })
  it('maps the phone field type to phone', () => {
    expect(resolveValidationRule(f({ type: 'phone', id: 'whatever' }))).toBe('phone')
  })
  it('infers email from id', () => {
    expect(resolveValidationRule(f({ id: 'plaintiff_email' }))).toBe('email')
  })
  it('infers phone from id', () => {
    expect(resolveValidationRule(f({ id: 'spouse_phone' }))).toBe('phone')
  })
  it('infers inn from tax_number id', () => {
    expect(resolveValidationRule(f({ id: 'tax_number' }))).toBe('inn')
  })
  it('infers passport from id', () => {
    expect(resolveValidationRule(f({ id: 'spouse_passport_series' }))).toBe('passport')
  })
  it('infers name from *_name ids', () => {
    expect(resolveValidationRule(f({ id: 'spouse_last_name' }))).toBe('name')
    expect(resolveValidationRule(f({ id: 'maiden_name' }))).toBe('name')
  })
  it('infers name from patronymic', () => {
    expect(resolveValidationRule(f({ id: 'respondent_patronymic' }))).toBe('name')
  })
  it('returns null for an unrelated text field', () => {
    expect(resolveValidationRule(f({ id: 'registered_address' }))).toBeNull()
  })
  it('does not infer rules for non-text/phone types', () => {
    expect(resolveValidationRule(f({ id: 'some_email', type: 'choice' }))).toBeNull()
  })
})

// ─── validateValue ────────────────────────────────────────────────────────────

describe('validateValue', () => {
  it('returns null for an empty value (required-ness handled elsewhere)', () => {
    expect(validateValue(f({ id: 'plaintiff_email' }), '')).toBeNull()
    expect(validateValue(f({ id: 'plaintiff_email' }), '   ')).toBeNull()
    expect(validateValue(f({ id: 'plaintiff_email' }), null)).toBeNull()
  })
  it('returns null when no rule applies', () => {
    expect(validateValue(f({ id: 'registered_address' }), 'будь-який текст 123')).toBeNull()
  })
  it('returns an error message for an invalid email field', () => {
    expect(validateValue(f({ id: 'plaintiff_email' }), 'garbage')).not.toBeNull()
  })
  it('returns null for a valid email field', () => {
    expect(validateValue(f({ id: 'plaintiff_email' }), 'a@b.com')).toBeNull()
  })
  it('ignores non-string values', () => {
    expect(validateValue(f({ id: 'plaintiff_email' }), true)).toBeNull()
  })
})
