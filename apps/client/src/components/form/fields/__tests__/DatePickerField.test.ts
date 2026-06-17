import { describe, it, expect } from 'vitest'
import { maskDateInput, parseDisplay } from '../DatePickerField'

const MAX_YEAR = 2027 // fixed bound so tests don't drift with "today"

describe('maskDateInput', () => {
  it('passes through 1-2 digits unchanged', () => {
    expect(maskDateInput('0')).toBe('0')
    expect(maskDateInput('01')).toBe('01')
  })

  it('inserts a dot after the day once a 3rd digit is typed', () => {
    expect(maskDateInput('011')).toBe('01.1')
    expect(maskDateInput('0101')).toBe('01.01')
  })

  it('inserts both dots once the month is complete', () => {
    expect(maskDateInput('01011')).toBe('01.01.1')
    expect(maskDateInput('01011990')).toBe('01.01.1990')
  })

  it('strips non-digit characters (manually typed dots, letters)', () => {
    expect(maskDateInput('01.01.1990')).toBe('01.01.1990')
    expect(maskDateInput('ab01cd01ef1990')).toBe('01.01.1990')
  })

  it('caps at 8 digits (DDMMYYYY) ignoring extra input', () => {
    expect(maskDateInput('010119905555')).toBe('01.01.1990')
  })

  it('shrinks correctly on backspace (dot removal does not eat a digit)', () => {
    expect(maskDateInput('01.01.199')).toBe('01.01.199')
  })
})

describe('parseDisplay', () => {
  it('parses a valid complete date to ISO (YYYY-MM-DD)', () => {
    expect(parseDisplay('01.01.1990', MAX_YEAR)).toBe('1990-01-01')
    expect(parseDisplay('29.02.2024', MAX_YEAR)).toBe('2024-02-29') // leap year
  })

  it('rejects incomplete or malformed strings', () => {
    expect(parseDisplay('01.01.199', MAX_YEAR)).toBeNull()
    expect(parseDisplay('', MAX_YEAR)).toBeNull()
    expect(parseDisplay('01-01-1990', MAX_YEAR)).toBeNull()
  })

  it('rejects an out-of-range month', () => {
    expect(parseDisplay('01.13.1990', MAX_YEAR)).toBeNull()
    expect(parseDisplay('01.00.1990', MAX_YEAR)).toBeNull()
  })

  it('rejects a day that does not exist in the given month', () => {
    expect(parseDisplay('31.02.2023', MAX_YEAR)).toBeNull() // Feb has 28/29 days
    expect(parseDisplay('29.02.2023', MAX_YEAR)).toBeNull() // 2023 is not a leap year
    expect(parseDisplay('31.04.2023', MAX_YEAR)).toBeNull() // April has 30 days
  })

  it('rejects years outside the sane bounds', () => {
    expect(parseDisplay('01.01.1899', MAX_YEAR)).toBeNull()
    expect(parseDisplay('01.01.2028', MAX_YEAR)).toBeNull() // beyond maxYear
    expect(parseDisplay('01.01.1900', MAX_YEAR)).toBe('1900-01-01')
    expect(parseDisplay('01.01.2027', MAX_YEAR)).toBe('2027-01-01')
  })
})
