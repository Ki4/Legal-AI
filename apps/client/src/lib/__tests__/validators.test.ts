import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhoneUA,
  validateInn,
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
  it('returns null for an unrelated text field', () => {
    expect(resolveValidationRule(f({ id: 'plaintiff_last_name' }))).toBeNull()
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
    expect(validateValue(f({ id: 'plaintiff_last_name' }), 'не email')).toBeNull()
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
