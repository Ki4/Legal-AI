// Pure date-string helpers for <DatePickerField>. Extracted from the component
// file so React Fast Refresh keeps working: react-refresh/only-export-components
// forbids exporting non-component values (these helpers, imported by tests)
// alongside the component itself.

export function parseYMD(v: string): { y: number; m: number; d: number } | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

export function formatDisplay(v: string) {
  const p = parseYMD(v)
  if (!p) return ''
  return `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}`
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function getFirstDayOfWeek(year: number, month: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

// Strips non-digits and re-inserts dots as the user types: "01011990" → "01.01.1990"
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

// Validates a complete "ДД.ММ.РРРР" string against real calendar bounds; returns ISO or null
export function parseDisplay(text: string, maxYear: number): string | null {
  const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
  if (mo < 1 || mo > 12) return null
  if (y < 1900 || y > maxYear) return null
  if (d < 1 || d > getDaysInMonth(y, mo)) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
