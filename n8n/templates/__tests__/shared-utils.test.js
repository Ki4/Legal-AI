import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const utils = (() => {
  const code = readFileSync(resolve(__dirname, '../shared/utils.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

const {
  MONTHS, formatDate, formatDateQuoted,
  val, has, detectGender, isTrue,
  fullName, formatAddress,
} = utils

// ─── MONTHS ─────────────────────────────────────────────────────────────────

describe('MONTHS', () => {
  it('has 12 Ukrainian month names in genitive', () => {
    expect(MONTHS).toHaveLength(12)
    expect(MONTHS[0]).toBe('січня')
    expect(MONTHS[11]).toBe('грудня')
  })
})

// ─── formatDate ─────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats ISO date to Ukrainian "day month year"', () => {
    expect(formatDate('2015-06-20')).toBe('20 червня 2015')
  })

  it('formats January date correctly', () => {
    expect(formatDate('2024-01-05')).toBe('5 січня 2024')
  })

  it('formats December date correctly', () => {
    expect(formatDate('2023-12-31')).toBe('31 грудня 2023')
  })

  it('returns placeholder for null/undefined/empty', () => {
    expect(formatDate(null)).toBe('________')
    expect(formatDate(undefined)).toBe('________')
    expect(formatDate('')).toBe('________')
  })
})

// ─── formatDateQuoted ───────────────────────────────────────────────────────

describe('formatDateQuoted', () => {
  it('formats ISO date with guillemets', () => {
    expect(formatDateQuoted('2015-06-20')).toBe('«20» червня 2015')
  })

  it('returns quoted placeholder for empty', () => {
    expect(formatDateQuoted(null)).toBe('«___» _______ _____')
    expect(formatDateQuoted('')).toBe('«___» _______ _____')
  })
})

// ─── val ────────────────────────────────────────────────────────────────────

describe('val', () => {
  const answers = { name: 'Олена', empty: '', nothing: null }

  it('returns field value when present', () => {
    expect(val(answers, 'name')).toBe('Олена')
  })

  it('returns fallback for empty string', () => {
    expect(val(answers, 'empty')).toBe('________')
  })

  it('returns fallback for null', () => {
    expect(val(answers, 'nothing')).toBe('________')
  })

  it('returns fallback for missing field', () => {
    expect(val(answers, 'nonexistent')).toBe('________')
  })

  it('uses custom fallback when provided', () => {
    expect(val(answers, 'nonexistent', 'N/A')).toBe('N/A')
  })
})

// ─── has ────────────────────────────────────────────────────────────────────

describe('has', () => {
  it('returns true for non-empty value', () => {
    expect(has({ name: 'Олена' }, 'name')).toBe(true)
  })

  it('returns true for boolean true', () => {
    expect(has({ consent: true }, 'consent')).toBe(true)
  })

  it('returns false for boolean false', () => {
    expect(has({ consent: false }, 'consent')).toBe(false)
  })

  it('returns false for null', () => {
    expect(has({ x: null }, 'x')).toBe(false)
  })

  it('returns false for undefined (missing field)', () => {
    expect(has({}, 'x')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(has({ x: '' }, 'x')).toBe(false)
  })
})

// ─── detectGender ───────────────────────────────────────────────────────────

describe('detectGender', () => {
  it('detects female by -івна', () => {
    expect(detectGender('Олександрівна')).toBe('female')
  })

  it('detects female by -ївна', () => {
    expect(detectGender('Андріївна')).toBe('female')
  })

  it('detects female by -овна', () => {
    expect(detectGender('Павловна')).toBe('female')
  })

  it('detects male by -ович', () => {
    expect(detectGender('Петрович')).toBe('male')
  })

  it('detects male by -ійович', () => {
    expect(detectGender('Сергійович')).toBe('male')
  })

  it('defaults to male for null/undefined', () => {
    expect(detectGender(null)).toBe('male')
    expect(detectGender(undefined)).toBe('male')
  })

  it('handles whitespace around name', () => {
    expect(detectGender('  Олександрівна  ')).toBe('female')
  })
})

// ─── isTrue ─────────────────────────────────────────────────────────────────

describe('isTrue', () => {
  it('returns true for boolean true', () => {
    expect(isTrue(true)).toBe(true)
  })

  it('returns true for string "true"', () => {
    expect(isTrue('true')).toBe(true)
  })

  it('returns false for boolean false', () => {
    expect(isTrue(false)).toBe(false)
  })

  it('returns false for string "false"', () => {
    expect(isTrue('false')).toBe(false)
  })

  it('returns false for null/undefined/0', () => {
    expect(isTrue(null)).toBe(false)
    expect(isTrue(undefined)).toBe(false)
    expect(isTrue(0)).toBe(false)
  })
})

// ─── fullName ───────────────────────────────────────────────────────────────

describe('fullName', () => {
  it('joins last_name, first_name, middle_name', () => {
    const a = { p_last_name: 'Петренко', p_first_name: 'Оксана', p_middle_name: 'Іванівна' }
    expect(fullName(a, 'p')).toBe('Петренко Оксана Іванівна')
  })

  it('returns placeholder when no name parts', () => {
    expect(fullName({}, 'p')).toBe('________')
  })

  it('handles missing middle name', () => {
    const a = { p_last_name: 'Петренко', p_first_name: 'Оксана' }
    expect(fullName(a, 'p')).toBe('Петренко Оксана')
  })

  it('works with underscore-prefixed fields (prefix_last_name)', () => {
    const a = { spouse_last_name: 'Коваленко', spouse_first_name: 'Віктор', spouse_middle_name: 'Петрович' }
    expect(fullName(a, 'spouse')).toBe('Коваленко Віктор Петрович')
  })
})

// ─── formatAddress ──────────────────────────────────────────────────────────

describe('formatAddress', () => {
  it('joins city, street, house, apartment', () => {
    const a = {
      addr_city: 'м. Київ',
      addr_street: 'Хрещатик',
      addr_house: '1',
      addr_apartment: '5',
    }
    expect(formatAddress(a, 'addr')).toBe('м. Київ, вул. Хрещатик, буд. 1, кв. 5')
  })

  it('omits missing parts', () => {
    const a = { addr_city: 'м. Одеса', addr_street: 'Дерибасівська' }
    expect(formatAddress(a, 'addr')).toBe('м. Одеса, вул. Дерибасівська')
  })

  it('returns placeholder when all parts missing', () => {
    expect(formatAddress({}, 'addr')).toBe('________')
  })
})
