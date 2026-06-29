import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

/**
 * preview-module G2 (#83) — #86-critical contract for deriveExcerpt().
 *
 * The excerpt that ships to the client BEFORE payment must contain the court
 * header + parties + opening circumstances and PHYSICALLY NOTHING of the legal
 * essence — no statute citation, no "ПРОШУ", no numbered request. This absence
 * (not the watermark) is the moat against "screenshot → LLM completes it".
 *
 * Negative assertions deliberately use INDEPENDENT regexes (not the module's
 * own cut markers) so the test is not tautological with the implementation.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the CJS template module (repo convention; static repo file).
const { deriveExcerpt, hasReasoningMarker } = (() => {
  const code = readFileSync(resolve(__dirname, '../preview-excerpt.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', 'require', code)
  fn(m, m.exports, require)
  return m.exports
})()

// Every rendered golden produced by the parity tests is a real document the
// extractor must handle. Reusing them keeps this test honest against drift.
const SERVICES = ['divorce', 'alimony']
const GOLDENS = SERVICES.flatMap((svc) => {
  const dir = resolve(__dirname, `../../../test-data/${svc}/expected`)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => ({ svc, name: `${svc}/${f}`, text: readFileSync(resolve(dir, f), 'utf8') }))
})

// Independent forbidden-leak detectors (mirror validation.md §1).
const ANY_CITATION = /ст\.?\s*\d+/i            // any "ст.NNN" statute reference
const STATTI_CITATION = /статт[іяею]\s*\d+/i   // "статті 175" long form
const NUMBERED_REQUEST = /^\s*\d+\.\s/m        // "1. …" operative request lines

describe('preview-excerpt G2 — goldens load', () => {
  it('found rendered goldens for both services', () => {
    expect(GOLDENS.length).toBeGreaterThanOrEqual(7) // 4 divorce + 3 alimony
    expect(GOLDENS.some((g) => g.svc === 'divorce')).toBe(true)
    expect(GOLDENS.some((g) => g.svc === 'alimony')).toBe(true)
  })
})

describe.each(GOLDENS)('preview-excerpt G2 — $name', ({ svc, text }) => {
  const excerpt = deriveExcerpt(text, svc)

  // ── Positive: the safe parts ARE present ─────────────────────────────────
  it('contains court header + both parties + document title', () => {
    expect(excerpt).toContain('До суду за місцем проживання відповідача')
    expect(excerpt).toContain('Позивач:')
    expect(excerpt).toContain('Відповідач:')
    expect(excerpt).toContain('ПОЗОВНА ЗАЯВА')
  })

  it('contains at least one circumstances paragraph (non-trivial length)', () => {
    // header+parties alone are short; an opening circumstance pushes it longer.
    expect(excerpt.length).toBeGreaterThan(400)
  })

  // ── Negative: the essence is PHYSICALLY ABSENT (#86 moat) ─────────────────
  it('leaks NO statute citation (ст.NNN / статті NNN)', () => {
    expect(ANY_CITATION.test(excerpt)).toBe(false)
    expect(STATTI_CITATION.test(excerpt)).toBe(false)
  })

  it('leaks NO "ПРОШУ" operative header (spaced or solid)', () => {
    expect(excerpt).not.toContain('ПРОШУ')
    expect(excerpt.replace(/\s+/g, '')).not.toContain('ПРОШУ')
  })

  it('leaks NO numbered request line ("1. …")', () => {
    expect(NUMBERED_REQUEST.test(excerpt)).toBe(false)
  })

  it('leaks NO reasoning-zone tokens (ЦПК / СК України)', () => {
    expect(excerpt).not.toContain('ЦПК')
    expect(excerpt).not.toContain('СК України')
    expect(excerpt).not.toContain('Сімейного кодексу')
  })

  // ── Drift guard: the cut marker exists in every real document ─────────────
  it('has a detectable reasoning marker (template-drift guard)', () => {
    expect(hasReasoningMarker(text)).toBe(true)
  })

  // ── The excerpt is a strict prefix of the source (no rewriting) ──────────
  it('is a verbatim prefix of the source document', () => {
    expect(text.replace(/\r\n?/g, '\n')).toContain(excerpt)
  })
})

describe('preview-excerpt G2 — degraded / hostile input (fail-closed)', () => {
  it('returns "" for empty / nullish / non-string input', () => {
    expect(deriveExcerpt('')).toBe('')
    expect(deriveExcerpt(null)).toBe('')
    expect(deriveExcerpt(undefined)).toBe('')
    expect(deriveExcerpt('   \n\n  ')).toBe('')
    expect(deriveExcerpt(42)).toBe('')
    expect(deriveExcerpt({})).toBe('')
    expect(deriveExcerpt(['x'])).toBe('')
  })

  it('does not throw on arbitrary short text and never echoes essence', () => {
    expect(() => deriveExcerpt('Коротко без жодних маркерів')).not.toThrow()
    // No header/parties → safeHeaderOnly keeps nothing → ''.
    expect(deriveExcerpt('Коротко без жодних маркерів')).toBe('')
  })

  it('fail-closed on template drift: marker absent → header+parties ONLY', () => {
    // A document missing any citation/ПРОШУ (simulated template drift).
    const drifted = [
      'До суду за місцем проживання відповідача',
      '',
      'Позивач: Тест Тестович',
      'Зареєстроване місце проживання: м. Київ',
      '',
      'Відповідач: Інший Інакший',
      '',
      'ПОЗОВНА ЗАЯВА',
      'про щось',
      '',
      'СЕКРЕТНИЙ операційний абзац який не можна показувати клієнту до оплати.',
    ].join('\n')

    expect(hasReasoningMarker(drifted)).toBe(false)
    const out = deriveExcerpt(drifted, 'divorce')
    // Keeps the safe header + parties…
    expect(out).toContain('Позивач: Тест Тестович')
    expect(out).toContain('Відповідач: Інший Інакший')
    // …and drops everything from the title onward — incl. the secret paragraph.
    expect(out).not.toContain('СЕКРЕТНИЙ')
    expect(out).not.toContain('ПОЗОВНА ЗАЯВА')
  })

  it('cuts before a leading-citation document, returning header+parties', () => {
    const doc = [
      'До суду за місцем проживання відповідача',
      '',
      'Позивач: А Б',
      '',
      'Відповідач: В Г',
      '',
      'Відповідно до ст.105 СК України суд розриває шлюб.',
      '',
      'П Р О Ш У :',
      '1. Розірвати шлюб.',
    ].join('\n')

    const out = deriveExcerpt(doc, 'divorce')
    expect(out).toContain('Позивач: А Б')
    expect(out).toContain('Відповідач: В Г')
    expect(/ст\.?\s*\d+/i.test(out)).toBe(false)
    expect(out).not.toContain('ПРОШУ')
  })
})
