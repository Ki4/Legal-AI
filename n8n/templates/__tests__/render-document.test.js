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

const { renderDocument, buildContext, HELPERS, FALLBACK, truthy, detectGender, parseChildrenDetails, normalizeCert } = engine

const r = (tpl, ctx = {}) => renderDocument(tpl, ctx)

// ─── Engine source: no eval ──────────────────────────────────────────────────

describe('engine safety', () => {
  it('source contains no eval or Function constructor calls', () => {
    const code = readFileSync(resolve(__dirname, '../render-document.js'), 'utf8')
    // strip comments before scanning (the contract is documented in them)
    const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(stripped).not.toMatch(/\beval\s*\(/)
    expect(stripped).not.toMatch(/new\s+Function/)
  })
})

// ─── Interpolation ───────────────────────────────────────────────────────────

describe('interpolation', () => {
  it('substitutes a field', () => {
    expect(r('Позивач: {{name}}', { name: 'Іванова Інна' })).toBe('Позивач: Іванова Інна')
  })

  it('empty value falls back to ________', () => {
    expect(r('{{missing}}', {})).toBe(FALLBACK)
    expect(r('{{empty}}', { empty: '' })).toBe(FALLBACK)
    expect(r('{{nul}}', { nul: null })).toBe(FALLBACK)
  })

  it('|raw renders empty value as empty string', () => {
    expect(r('[{{missing|raw}}]', {})).toBe('[]')
    expect(r('[{{x | raw}}]', { x: '' })).toBe('[]')
    expect(r('[{{x|raw}}]', { x: 'ok' })).toBe('[ok]')
  })

  it('false boolean is NOT replaced by fallback (only null/undefined/empty are)', () => {
    expect(r('{{flag}}', { flag: false })).toBe('false')
  })

  it('zero and numbers render as-is', () => {
    expect(r('{{n}}', { n: 0 })).toBe('0')
    expect(r('{{n}} грн', { n: 25000 })).toBe('25000 грн')
  })

  it('resolves dotted paths (ai layer)', () => {
    expect(r('{{ai.plaintiff_genitive}}', { ai: { plaintiff_genitive: 'Іванової Інни' } })).toBe('Іванової Інни')
  })
})

// ─── Conditions ──────────────────────────────────────────────────────────────

describe('{{#if}} blocks', () => {
  it('truthiness uses has() semantics', () => {
    const tpl = "{{#if x}}YES{{else}}NO{{/if}}"
    expect(r(tpl, { x: 'val' })).toBe('YES')
    expect(r(tpl, { x: '' })).toBe('NO')
    expect(r(tpl, { x: null })).toBe('NO')
    expect(r(tpl, {})).toBe('NO')
    expect(r(tpl, { x: false })).toBe('NO')
    expect(r(tpl, { x: 'false' })).toBe('NO') // string 'false' is falsy per spec
    expect(r(tpl, { x: true })).toBe('YES')
    expect(r(tpl, { x: 0 })).toBe('YES') // 0 is a value, not "empty"
  })

  it('== and != compare against literals', () => {
    const tpl = "{{#if status == 'divorced'}}D{{else}}X{{/if}}"
    expect(r(tpl, { status: 'divorced' })).toBe('D')
    expect(r(tpl, { status: 'married' })).toBe('X')
    expect(r("{{#if s != 'unknown'}}K{{/if}}", { s: 'same' })).toBe('K')
  })

  it('== treats boolean true and string "true" as equal (form values arrive both ways)', () => {
    const tpl = "{{#if x == 'true'}}T{{/if}}"
    expect(r(tpl, { x: true })).toBe('T')
    expect(r(tpl, { x: 'true' })).toBe('T')
    expect(r(tpl, { x: false })).toBe('')
  })

  it('numeric comparisons', () => {
    expect(r('{{#if n > 1}}MANY{{else}}ONE{{/if}}', { n: 3 })).toBe('MANY')
    expect(r('{{#if n > 1}}MANY{{else}}ONE{{/if}}', { n: 1 })).toBe('ONE')
    expect(r('{{#if n >= 3}}HALF{{/if}}', { n: 3 })).toBe('HALF')
    expect(r('{{#if n <= 2}}LOW{{/if}}', { n: 2 })).toBe('LOW')
    expect(r('{{#if n < 2}}LOW{{/if}}', { n: 5 })).toBe('')
  })

  it('else if chains', () => {
    const tpl = "{{#if m == 'a'}}A{{else if m == 'b'}}B{{else if m == 'c'}}C{{else}}Z{{/if}}"
    expect(r(tpl, { m: 'a' })).toBe('A')
    expect(r(tpl, { m: 'b' })).toBe('B')
    expect(r(tpl, { m: 'c' })).toBe('C')
    expect(r(tpl, { m: 'q' })).toBe('Z')
  })

  it('and / or / not', () => {
    expect(r("{{#if a and b}}Y{{/if}}", { a: 1, b: 1 })).toBe('Y')
    expect(r("{{#if a and b}}Y{{else}}N{{/if}}", { a: 1, b: '' })).toBe('N')
    expect(r("{{#if a or b}}Y{{/if}}", { a: '', b: 1 })).toBe('Y')
    expect(r("{{#if not a}}Y{{/if}}", { a: '' })).toBe('Y')
    expect(r("{{#if not a and b}}Y{{else}}N{{/if}}", { a: '', b: 1 })).toBe('Y')
    expect(r("{{#if a == 'x' or a == 'y'}}Y{{/if}}", { a: 'y' })).toBe('Y')
  })

  it('nested ifs', () => {
    const tpl = "{{#if a}}{{#if b}}AB{{else}}A{{/if}}{{else}}NONE{{/if}}"
    expect(r(tpl, { a: 1, b: 1 })).toBe('AB')
    expect(r(tpl, { a: 1 })).toBe('A')
    expect(r(tpl, {})).toBe('NONE')
  })
})

// ─── Loops ───────────────────────────────────────────────────────────────────

describe('{{#each}} blocks', () => {
  const kids = [
    { name: 'Іванов Олег', birthDate: '15.05.2018' },
    { name: 'Іванова Марія', birthDate: '20.08.2020' },
  ]

  it('iterates with item properties and @index1', () => {
    const tpl = '{{#each children}}{{@index1}}) {{name}}, {{birthDate}};{{/each}}'
    expect(r(tpl, { children: kids })).toBe('1) Іванов Олег, 15.05.2018;2) Іванова Марія, 20.08.2020;')
  })

  it('@first / @last booleans work in conditions', () => {
    const tpl = '{{#each items}}{{.}}{{#if not @last}}, {{/if}}{{/each}}'
    expect(r(tpl, { items: ['a', 'b', 'c'] })).toBe('a, b, c')
  })

  it('{{.}} renders the current scalar item', () => {
    expect(r('{{#each xs}}[{{.}}]{{/each}}', { xs: ['x', 'y'] })).toBe('[x][y]')
  })

  it('outer context stays reachable inside the loop', () => {
    const tpl = '{{#each children}}{{name}} ({{family}});{{/each}}'
    expect(r(tpl, { children: kids, family: 'Іванови' })).toBe('Іванов Олег (Іванови);Іванова Марія (Іванови);')
  })

  it('empty or missing array renders nothing', () => {
    expect(r('A{{#each xs}}X{{/each}}B', { xs: [] })).toBe('AB')
    expect(r('A{{#each xs}}X{{/each}}B', {})).toBe('AB')
  })
})

// ─── Whitespace control (critical for byte-identical output) ─────────────────

describe('standalone line consumption', () => {
  it('block tags on their own line leave no blank lines', () => {
    const tpl = 'Line1\n{{#if x}}\nInside\n{{/if}}\nLine2'
    expect(r(tpl, { x: 1 })).toBe('Line1\nInside\nLine2')
    expect(r(tpl, {})).toBe('Line1\nLine2')
  })

  it('indented standalone tags also consume their line', () => {
    const tpl = 'A\n  {{#if x}}\nB\n  {{/if}}\nC'
    expect(r(tpl, { x: 1 })).toBe('A\nB\nC')
  })

  it('inline tags do NOT consume anything', () => {
    expect(r('A {{#if x}}B{{/if}} C', { x: 1 })).toBe('A B C')
    expect(r('A {{#if x}}B{{/if}} C', {})).toBe('A  C')
  })

  it('adjacent standalone tags do not double-consume', () => {
    const tpl = '{{#if a}}\nA\n{{/if}}\n{{#if b}}\nB\n{{/if}}\nEnd'
    expect(r(tpl, { a: 1, b: 1 })).toBe('A\nB\nEnd')
    expect(r(tpl, { b: 1 })).toBe('B\nEnd')
    expect(r(tpl, {})).toBe('End')
  })

  it('each on standalone lines: one output line per item', () => {
    const tpl = 'Діти:\n{{#each xs}}\n{{@index1}}) {{.}};\n{{/each}}\nКінець'
    expect(r(tpl, { xs: ['a', 'b'] })).toBe('Діти:\n1) a;\n2) b;\nКінець')
  })

  it('CRLF input is normalized to LF', () => {
    expect(r('A\r\n{{#if x}}\r\nB\r\n{{/if}}\r\nC', { x: 1 })).toBe('A\nB\nC')
  })
})

// ─── Comments and phase-2 style directives ───────────────────────────────────

describe('comments and directives', () => {
  it('comments are dropped, standalone comment consumes its line', () => {
    expect(r('A\n{{! внутрішня нотатка }}\nB', {})).toBe('A\nB')
    expect(r('A{{! inline }}B', {})).toBe('AB')
  })

  it('{{!style: ...}} directives are ignored in phase 1', () => {
    const tpl = '{{!style: center bold keep-with-next}}\nП Р О Ш У  С У Д :\n\nТекст'
    expect(r(tpl, {})).toBe('П Р О Ш У  С У Д :\n\nТекст')
  })
})

// ─── Helper calls in templates ───────────────────────────────────────────────

describe('helper calls', () => {
  it('formatDate from a field', () => {
    expect(r('{{formatDate d}} року', { d: '2015-06-20' })).toBe('20 червня 2015 року')
  })

  it('helper with literal args (gender)', () => {
    expect(r("{{gender g 'уклав' 'уклала'}}", { g: 'female' })).toBe('уклала')
    expect(r("{{gender g 'уклав' 'уклала'}}", { g: 'male' })).toBe('уклав')
  })

  it('helper args resolve paths including @meta inside each', () => {
    const tpl = "{{#each xs}}{{plural @index1 'один' 'багато'}};{{/each}}"
    expect(r(tpl, { xs: ['a', 'b'] })).toBe('один;багато;')
  })
})

// ─── Parse errors (clear, with line numbers — not silent) ────────────────────

describe('parse errors', () => {
  it('unclosed {{#if}} throws with line number', () => {
    expect(() => r('a\nb\n{{#if x}}never closed', {})).toThrow(/Unclosed \{\{#if\}\}.*line 3/)
  })

  it('unclosed {{#each}} throws with line number', () => {
    expect(() => r('{{#each xs}}item', { xs: [] })).toThrow(/Unclosed \{\{#each\}\}.*line 1/)
  })

  it('stray {{/if}} throws', () => {
    expect(() => r('text {{/if}}', {})).toThrow(/Unexpected/)
  })

  it('unknown helper throws by name', () => {
    expect(() => r("{{declineName x 'a'}}", {})).toThrow(/Unknown helper "declineName"/)
  })

  it('unterminated literal throws', () => {
    expect(() => r("{{gender g 'уклав}}", {})).toThrow(/Unterminated string literal/)
  })

  it('{{else}} after {{else}} throws', () => {
    expect(() => r('{{#if x}}a{{else}}b{{else}}c{{/if}}', {})).toThrow(/Duplicate \{\{else\}\}/)
  })

  it('incomplete expression throws', () => {
    expect(() => r('{{#if x ==}}a{{/if}}', {})).toThrow(/Incomplete|Unexpected/)
  })
})

// ─── Helpers (unit) ──────────────────────────────────────────────────────────

describe('HELPERS', () => {
  it('formatDate', () => {
    expect(HELPERS.formatDate('2015-06-20')).toBe('20 червня 2015')
    expect(HELPERS.formatDate('2024-01-10')).toBe('10 січня 2024')
    expect(HELPERS.formatDate('')).toBe(FALLBACK)
    expect(HELPERS.formatDate(null)).toBe(FALLBACK)
    expect(HELPERS.formatDate('garbage')).toBe(FALLBACK)
  })

  it('formatDateQuoted', () => {
    expect(HELPERS.formatDateQuoted('2015-06-20')).toBe('«20» червня 2015')
    expect(HELPERS.formatDateQuoted('')).toBe('«___» _______ _____')
  })

  it('gender', () => {
    expect(HELPERS.gender('female', 'звільнений', 'звільнена')).toBe('звільнена')
    expect(HELPERS.gender('male', 'звільнений', 'звільнена')).toBe('звільнений')
    expect(HELPERS.gender(undefined, 'звільнений', 'звільнена')).toBe('звільнений')
  })

  it('plural with 2 forms', () => {
    expect(HELPERS.plural(1, 'дитиною', 'дітьми')).toBe('дитиною')
    expect(HELPERS.plural(2, 'дитиною', 'дітьми')).toBe('дітьми')
    expect(HELPERS.plural(3, 'дитиною', 'дітьми')).toBe('дітьми')
  })

  it('plural with 3 ukrainian forms', () => {
    expect(HELPERS.plural(1, 'дитина', 'дитини', 'дітей')).toBe('дитина')
    expect(HELPERS.plural(2, 'дитина', 'дитини', 'дітей')).toBe('дитини')
    expect(HELPERS.plural(5, 'дитина', 'дитини', 'дітей')).toBe('дітей')
    expect(HELPERS.plural(11, 'дитина', 'дитини', 'дітей')).toBe('дітей')
    expect(HELPERS.plural(21, 'дитина', 'дитини', 'дітей')).toBe('дитина')
    expect(HELPERS.plural(22, 'дитина', 'дитини', 'дітей')).toBe('дитини')
  })

  it('alimonyFraction (ст. 183 СК)', () => {
    expect(HELPERS.alimonyFraction(1)).toBe('1/4')
    expect(HELPERS.alimonyFraction(2)).toBe('1/3')
    expect(HELPERS.alimonyFraction(3)).toBe('1/2')
    expect(HELPERS.alimonyFraction(5)).toBe('1/2')
    expect(HELPERS.alimonyFraction(undefined)).toBe('1/4')
  })

  it('concat skips empty parts', () => {
    expect(HELPERS.concat('a', '', 'b', null, 'c')).toBe('abc')
    expect(HELPERS.concat('', null)).toBe('')
  })
})

// ─── buildContext (computed layer) ───────────────────────────────────────────

describe('buildContext', () => {
  const answers = {
    last_name: 'Іванова', first_name: 'Інна', middle_name: 'Петрівна',
    defendant_last_name: 'Іванов', defendant_first_name: 'Іван', defendant_middle_name: 'Іванович',
    marriage_place: 'Шевченківський відділ РАЦС',
    children_details:
      'Іванов Олег Іванович, 15.05.2018, свідоцтво № І-КВ 123456 від 16.05.2018\n' +
      'Іванова Марія Іванівна, 20.08.2020, свідоцтво № І-КВ 234567 від 21.08.2020',
  }

  it('joins names and detects genders', () => {
    const c = buildContext(answers, {})
    expect(c.plaintiff_name).toBe('Іванова Інна Петрівна')
    expect(c.defendant_name).toBe('Іванов Іван Іванович')
    expect(c.plaintiff_gender).toBe('female')
    expect(c.defendant_gender).toBe('male')
  })

  it('empty name parts are skipped; all-empty → fallback', () => {
    const c = buildContext({ last_name: 'Іванова', first_name: '', middle_name: null }, {})
    expect(c.plaintiff_name).toBe('Іванова')
    expect(buildContext({}, {}).plaintiff_name).toBe(FALLBACK)
  })

  it('parses children with cert instrumental and gender', () => {
    const c = buildContext(answers, {})
    expect(c.children).toHaveLength(2)
    expect(c.n_children).toBe(2)
    expect(c.children[0]).toMatchObject({
      name: 'Іванов Олег Іванович',
      birthDate: '15.05.2018',
      certInfo: 'свідоцтво № І-КВ 123456 від 16.05.2018',
      certInstrumental: 'свідоцтвом № І-КВ 123456 від 16.05.2018',
      gender: 'male',
    })
    expect(c.children[1].gender).toBe('female')
    expect(c.first_child_gender).toBe('male')
  })

  it('no children: n_children stays 1 (legacy builder semantics), male default', () => {
    const c = buildContext({}, {})
    expect(c.children).toEqual([])
    expect(c.n_children).toBe(1)
    expect(c.first_child_gender).toBe('male')
  })

  it('ai layer falls back to assembled names', () => {
    const c = buildContext(answers, {})
    expect(c.ai.plaintiff_genitive).toBe('Іванова Інна Петрівна')
    expect(c.ai.marriage_place_locative).toBe('Шевченківський відділ РАЦС')
    const c2 = buildContext(answers, { plaintiff_genitive: 'Іванової Інни Петрівни' })
    expect(c2.ai.plaintiff_genitive).toBe('Іванової Інни Петрівни')
  })

  it('children_genitive falls back to name+birthDate list', () => {
    const c = buildContext(answers, {})
    expect(c.ai.children_genitive).toBe(
      'Іванов Олег Іванович, 15.05.2018 р.н.; Іванова Марія Іванівна, 20.08.2020 р.н.'
    )
  })
})

// ─── Internal utilities ──────────────────────────────────────────────────────

describe('internals', () => {
  it('truthy: has() semantics', () => {
    expect(truthy('x')).toBe(true)
    expect(truthy(0)).toBe(true)
    expect(truthy(true)).toBe(true)
    expect(truthy('')).toBe(false)
    expect(truthy(null)).toBe(false)
    expect(truthy(undefined)).toBe(false)
    expect(truthy(false)).toBe(false)
    expect(truthy('false')).toBe(false)
  })

  it('detectGender by patronymic suffix', () => {
    expect(detectGender('Петрівна')).toBe('female')
    expect(detectGender('Сергіївна')).toBe('female')
    expect(detectGender('Іванович')).toBe('male')
    expect(detectGender('')).toBe('male')
  })

  it('normalizeCert: свідоцтво → свідоцтвом', () => {
    expect(normalizeCert('свідоцтво № І-КВ 123456')).toBe('свідоцтвом № І-КВ 123456')
    expect(normalizeCert('довідка № 5')).toBe('довідка № 5')
    expect(normalizeCert('')).toBe('')
  })

  it('parseChildrenDetails skips blank lines and lines without a name', () => {
    expect(parseChildrenDetails('\n\nІванов Олег, 15.05.2018\n\n')).toHaveLength(1)
    expect(parseChildrenDetails(null)).toEqual([])
  })
})
