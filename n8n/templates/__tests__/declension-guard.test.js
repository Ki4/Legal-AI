import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module (repo convention: n8n templates use module.exports; the
// loaded code is a static repo file, not untrusted input)
const engine = (() => {
  const code = readFileSync(resolve(__dirname, '../render-document.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

const { wordStemOk, declensionStemOk, guardDeclension, normalizeDeclensionWord, buildContext } = engine

describe('declension stem-guard — wordStemOk (single word)', () => {
  it('accepts real feminine inflection (Іванова → Іванову / Іванової)', () => {
    expect(wordStemOk('Іванова', 'Іванову')).toBe(true)   // accusative
    expect(wordStemOk('Іванова', 'Іванової')).toBe(true)  // genitive
    expect(wordStemOk('Інна', 'Інну')).toBe(true)
    expect(wordStemOk('Інна', 'Інни')).toBe(true)
    expect(wordStemOk('Петрівна', 'Петрівну')).toBe(true)
    expect(wordStemOk('Петрівна', 'Петрівни')).toBe(true)
  })

  it('accepts real masculine inflection (Іванов → Івановим / Іванова)', () => {
    expect(wordStemOk('Іванов', 'Івановим')).toBe(true)   // instrumental (ending grows)
    expect(wordStemOk('Іванов', 'Іванова')).toBe(true)    // genitive
    expect(wordStemOk('Іван', 'Іваном')).toBe(true)
    expect(wordStemOk('Іванович', 'Івановичем')).toBe(true)
  })

  it('accepts harsher fleeting-vowel cases (Орел → Орла, Швець → Швеця)', () => {
    expect(wordStemOk('Орел', 'Орла')).toBe(true)
    expect(wordStemOk('Швець', 'Швеця')).toBe(true)
  })

  it('accepts indeclinable / unchanged tokens (РАЦС, м., у)', () => {
    expect(wordStemOk('РАЦС', 'РАЦС')).toBe(true)
    expect(wordStemOk('м', 'м')).toBe(true)
    expect(wordStemOk('у', 'у')).toBe(true)
  })

  it('rejects a swapped surname (different word entirely)', () => {
    expect(wordStemOk('Іванова', 'Петренко')).toBe(false)
    expect(wordStemOk('Іванов', 'Сидоров')).toBe(false)
  })

  it('rejects empty / garbage', () => {
    expect(wordStemOk('Іванова', '')).toBe(false)
    expect(wordStemOk('', 'Іванову')).toBe(false)
    expect(wordStemOk('Іванова', '???')).toBe(false)
  })

  it('handles apostrophe variants (Гур’єв ≈ Гур\'єва)', () => {
    expect(wordStemOk('Гур’єв', "Гур'єва")).toBe(true)
    expect(wordStemOk("Гур'єв", 'Гур’євим')).toBe(true)
  })
})

describe('declension stem-guard — declensionStemOk (full name)', () => {
  it('accepts a correctly declined 3-word PIB', () => {
    expect(declensionStemOk('Іванова Інна Петрівна', 'Іванову Інну Петрівну')).toBe(true)
    expect(declensionStemOk('Іванова Інна Петрівна', 'Іванової Інни Петрівни')).toBe(true)
    expect(declensionStemOk('Іванов Іван Іванович', 'Івановим Іваном Івановичем')).toBe(true)
  })

  it('rejects a dropped or added word (word-count mismatch)', () => {
    expect(declensionStemOk('Іванова Інна Петрівна', 'Іванову Інну')).toBe(false)
    expect(declensionStemOk('Іванова Інна Петрівна', 'Іванову Інну Петрівну Зайве')).toBe(false)
  })

  it('rejects when any single word is a hallucinated swap', () => {
    expect(declensionStemOk('Іванова Інна Петрівна', 'Сидорову Інну Петрівну')).toBe(false)
    expect(declensionStemOk('Іванова Інна Петрівна', 'Іванову Олену Петрівну')).toBe(false)
  })

  it('rejects empty declined input', () => {
    expect(declensionStemOk('Іванова Інна Петрівна', '')).toBe(false)
    expect(declensionStemOk('Іванова Інна Петрівна', null)).toBe(false)
  })

  it('tolerates extra whitespace', () => {
    expect(declensionStemOk('Іванова  Інна   Петрівна', 'Іванову Інну Петрівну')).toBe(true)
  })
})

describe('declension stem-guard — guardDeclension (revert behaviour)', () => {
  const nom = 'Іванова Інна Петрівна'

  it('returns the AI form when it passes the guard', () => {
    expect(guardDeclension(nom, 'Іванову Інну Петрівну')).toBe('Іванову Інну Петрівну')
  })

  it('reverts to nominative on a hallucinated form', () => {
    expect(guardDeclension(nom, 'Петренко Олег Іванович')).toBe(nom)
  })

  it('reverts to nominative on empty AI (subsumes old || fallback)', () => {
    expect(guardDeclension(nom, '')).toBe(nom)
    expect(guardDeclension(nom, undefined)).toBe(nom)
  })
})

describe('declension stem-guard — buildContext integration', () => {
  const answers = {
    last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
    defendant_last_name: 'Іванов', defendant_first_name: 'Іван', defendant_middle_name: 'Іванович',
  }

  it('keeps a good AI declension in ai.* fields', () => {
    const ctx = buildContext(answers, {
      plaintiff_instrumental: 'Іванову Інну Петрівну',
      plaintiff_genitive: 'Іванової Інни Петрівни',
      defendant_instrumental: 'Івановим Іваном Івановичем',
      defendant_genitive: 'Іванова Івана Івановича',
    })
    expect(ctx.ai.plaintiff_instrumental).toBe('Іванову Інну Петрівну')
    expect(ctx.ai.defendant_genitive).toBe('Іванова Івана Івановича')
  })

  it('reverts a hallucinated declension to the nominative name', () => {
    const ctx = buildContext(answers, {
      plaintiff_instrumental: 'Бандера Степан Андрійович', // garbage swap
      defendant_genitive: '',                               // empty
    })
    expect(ctx.ai.plaintiff_instrumental).toBe('Іванова Інна Петрівна')
    expect(ctx.ai.defendant_genitive).toBe('Іванов Іван Іванович')
  })

  it('honours the spouse_* alias for the defendant before guarding', () => {
    const ctx = buildContext(answers, {
      spouse_instrumental: 'Івановим Іваном Івановичем',
    })
    expect(ctx.ai.defendant_instrumental).toBe('Івановим Іваном Івановичем')
  })
})

describe('declension stem-guard — normalizeDeclensionWord', () => {
  it('lowercases, unifies apostrophes, strips trailing punctuation', () => {
    expect(normalizeDeclensionWord('Гур’єв,')).toBe("гур'єв")
    expect(normalizeDeclensionWord('м.')).toBe('м')
  })
})
