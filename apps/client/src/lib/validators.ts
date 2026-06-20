/**
 * Pure field-format validators for the legal form (#81).
 *
 * Each validator takes the trimmed string value and returns a Ukrainian error
 * message, or `null` when the value is valid. Validators DO NOT enforce
 * required-ness — an empty value is always considered "valid" here; whether a
 * field must be filled is decided separately by `isAnswered` / `required`.
 *
 * A field opts into a rule either explicitly via `field.validation` in the
 * form config, or implicitly through `resolveValidationRule` heuristics, so
 * existing Supabase configs get validation without a data migration.
 */

import type { FormField } from '../types/form'

export type ValidationRule = 'email' | 'phone' | 'inn'

// ── Individual validators ─────────────────────────────────────────────────────

// Deliberately simple, non-catastrophic email shape: something@something.tld
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(value: string): string | null {
  return EMAIL_RE.test(value.trim()) ? null : 'Некоректний email (приклад: name@example.com)'
}

/**
 * Ukrainian phone number. Accepts the common shapes after stripping spaces,
 * dashes, parentheses and a leading +:
 *   +380XXXXXXXXX / 380XXXXXXXXX (12 digits) or 0XXXXXXXXX (10 digits).
 */
export function validatePhoneUA(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  const ok = (digits.length === 12 && digits.startsWith('380')) ||
             (digits.length === 10 && digits.startsWith('0'))
  return ok ? null : 'Некоректний номер (приклад: +380501234567)'
}

/**
 * Ukrainian tax ID / РНОКПП (ІПН): 10 digits with a checksum on the 10th digit.
 * Coefficients applied to the first 9 digits; (sum % 11) % 10 must equal d10.
 */
const INN_WEIGHTS = [-1, 5, 7, 9, 4, 6, 10, 5, 7]

export function validateInn(value: string): string | null {
  const digits = value.trim()
  if (!/^\d{10}$/.test(digits)) return 'ІПН має містити 10 цифр'
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * INN_WEIGHTS[i]
  const control = (sum % 11) % 10
  return control === Number(digits[9]) ? null : 'Некоректний ІПН (не сходиться контрольна цифра)'
}

// ── Rule resolution + dispatch ────────────────────────────────────────────────

const VALIDATORS: Record<ValidationRule, (v: string) => string | null> = {
  email: validateEmail,
  phone: validatePhoneUA,
  inn: validateInn,
}

/**
 * Decide which format rule (if any) applies to a field. Explicit
 * `field.validation` wins; otherwise infer from the field type / id so that
 * existing configs validate without being edited.
 */
export function resolveValidationRule(field: FormField): ValidationRule | null {
  if (field.validation) return field.validation
  if (field.type === 'phone') return 'phone'
  // Only text-ish fields carry these formats
  if (field.type !== 'text') return null
  const id = field.id.toLowerCase()
  if (/email|e_mail/.test(id)) return 'email'
  if (/phone|tel(?:ephone)?|mobile/.test(id)) return 'phone'
  if (/tax_number|\bipn\b|\binn\b|rnokpp/.test(id)) return 'inn'
  return null
}

/**
 * Validate a single field's current value. Returns a Ukrainian error message,
 * or `null` when valid (or empty, or no rule applies).
 */
export function validateValue(field: FormField, value: unknown): string | null {
  const rule = resolveValidationRule(field)
  if (!rule) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null // emptiness handled by required-check, not here
  return VALIDATORS[rule](trimmed)
}
