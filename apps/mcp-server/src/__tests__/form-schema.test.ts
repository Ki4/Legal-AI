/**
 * form_config → JSON Schema converter (plan D2 / task T3).
 *
 * Unit tests cover all 8 field types on synthetic fixtures; the real configs
 * pin the contract: full alimony schema snapshot + the exact 16 unconditionally
 * required ids + show_if preconditions on real conditional fields.
 */
import { describe, expect, it } from 'vitest'

import { formConfigToJsonSchema } from '../form-schema.js'
// Cross-folder imports of the client SSoT configs (vitest transpiles; tsc excludes __tests__)
import { alimonyConfig } from '../../../client/src/data/alimonyConfig'
import { divorceFormConfig } from '../../../client/src/data/divorceFormConfig'

import type { FormConfig, FormField } from '../types.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeConfig(steps: FormField[]): FormConfig {
  return {
    service_id: 'synthetic',
    title: 'Synthetic fixture',
    tabs: [{ id: 'main', label: 'Main' }],
    steps,
  }
}

function props(config: FormConfig): Record<string, Record<string, unknown>> {
  return formConfigToJsonSchema(config).properties as Record<string, Record<string, unknown>>
}

function schemaFor(field: FormField): Record<string, unknown> {
  return props(makeConfig([field]))[field.id]
}

// ── per-type mapping (all 8 field types) ──────────────────────────────────────

describe('formConfigToJsonSchema — per-type mapping', () => {
  it('text → string; maxLength ONLY when explicitly set', () => {
    const plain = schemaFor({ id: 'registered_address', tab: 'main', type: 'text', label: 'Адреса реєстрації' })
    expect(plain).toEqual({ type: 'string', description: 'Адреса реєстрації.' })
    expect(plain).not.toHaveProperty('maxLength')

    const capped = schemaFor({ id: 'note', tab: 'main', type: 'text', label: 'Нотатка', maxLength: 120 })
    expect(capped.maxLength).toBe(120)
  })

  it('textarea → string, no default maxLength in schema', () => {
    const s = schemaFor({
      id: 'children_details',
      tab: 'main',
      type: 'textarea',
      label: 'Дані про дітей',
      hint: 'Кожна дитина — окремий рядок.',
    })
    expect(s.type).toBe('string')
    expect(s).not.toHaveProperty('maxLength')
    expect(s.description).toBe('Дані про дітей. Кожна дитина — окремий рядок.')
  })

  it('phone → string + phone format note (rule from field type)', () => {
    const s = schemaFor({ id: 'plaintiff_phone', tab: 'main', type: 'phone', label: 'Телефон' })
    expect(s.type).toBe('string')
    expect(s).not.toHaveProperty('pattern')
    expect(s.description).toBe('Телефон. Формат: +380XXXXXXXXX або 0XXXXXXXXX.')
  })

  it('date → string + ISO pattern + conversion note', () => {
    const s = schemaFor({ id: 'birth_date', tab: 'main', type: 'date', label: 'Дата народження' })
    expect(s.type).toBe('string')
    expect(s.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$')
    expect(s.description).toBe(
      'Дата народження. Формат: YYYY-MM-DD (користувач зазвичай називає ДД.ММ.РРРР — переконвертуйте).',
    )
  })

  it('boolean → boolean', () => {
    const s = schemaFor({ id: 'same_actual_address', tab: 'main', type: 'boolean', label: 'Адреси збігаються' })
    expect(s).toEqual({ type: 'boolean', description: 'Адреси збігаються.' })
  })

  it('choice → string + enum of option values + Варіанти note (value — label)', () => {
    const s = schemaFor({
      id: 'alimony_type',
      tab: 'main',
      type: 'choice',
      label: 'Форма стягнення',
      options: [
        { value: 'percent', label: 'Частка від заробітку' },
        { value: 'fixed', label: 'Тверда грошова сума' },
      ],
    })
    expect(s.type).toBe('string')
    expect(s.enum).toEqual(['percent', 'fixed'])
    expect(s.description).toBe(
      'Форма стягнення. Варіанти: percent — Частка від заробітку; fixed — Тверда грошова сума.',
    )
  })

  it('multicheck → array + items.enum + uniqueItems', () => {
    const s = schemaFor({
      id: 'attachments',
      tab: 'main',
      type: 'multicheck',
      label: 'Додатки',
      options: [
        { value: 'a', label: 'А' },
        { value: 'b', label: 'Б' },
      ],
    })
    expect(s.type).toBe('array')
    expect(s.items).toEqual({ type: 'string', enum: ['a', 'b'] })
    expect(s.uniqueItems).toBe(true)
    expect(s.description).toBe('Додатки. Варіанти: a — А; b — Б.')
  })

  it('number → STRING with money pattern (Answers carry no JS numbers)', () => {
    const s = schemaFor({ id: 'claim_amount', tab: 'main', type: 'number', label: 'Сума позову' })
    expect(s.type).toBe('string')
    expect(s.pattern).toBe('^\\d+([.,]\\d+)?$')
    expect(s.description).toBe('Сума позову. Число рядком, наприклад "5000" або "5000,50".')
  })
})

// ── description assembly ──────────────────────────────────────────────────────

describe('description assembly', () => {
  it('does not double terminal punctuation of label/hint', () => {
    const s = schemaFor({ id: 'f1', tab: 'main', type: 'text', label: 'Мітка.', hint: 'Уточнення тут.' })
    expect(s.description).toBe('Мітка. Уточнення тут.')
  })

  it('joins label + hint + explanation in order', () => {
    const s = schemaFor({
      id: 'f2',
      tab: 'main',
      type: 'text',
      label: 'Поле',
      hint: 'Підказка',
      explanation: 'Пояснення',
    })
    expect(s.description).toBe('Поле. Підказка. Пояснення.')
  })

  it('format notes via resolveValidationRule id heuristics (inn / email / name / passport)', () => {
    expect(schemaFor({ id: 'tax_number', tab: 'main', type: 'text', label: 'ІПН (РНОКПП)' }).description).toBe(
      'ІПН (РНОКПП). Формат: 10 цифр РНОКПП (перевіряється контрольна цифра).',
    )
    expect(schemaFor({ id: 'plaintiff_email', tab: 'main', type: 'text', label: 'Email' }).description).toBe(
      'Email. Формат: name@example.com.',
    )
    expect(schemaFor({ id: 'first_name', tab: 'main', type: 'text', label: "Ім'я" }).description).toBe(
      "Ім'я. Лише кирилиця, апостроф, дефіс — без латиниці та цифр.",
    )
    expect(schemaFor({ id: 'passport_series', tab: 'main', type: 'text', label: 'Паспорт' }).description).toBe(
      'Паспорт. Формат: АА123456 (книжечка) або 9 цифр (ID-картка).',
    )
  })

  it('explicit validation rule (iban) + show_if precondition appended last', () => {
    const s = schemaFor({
      id: 'some_account',
      tab: 'main',
      type: 'text',
      label: 'IBAN',
      validation: 'iban',
      show_if: { field: 'has_account', operator: '==', value: true },
    })
    expect(s.description).toBe(
      'IBAN. Формат: UA + 27 цифр (перевіряється контрольна сума). Питати ЛИШЕ якщо: has_account == true.',
    )
  })

  it('all/any combinators render as І / АБО', () => {
    const all = schemaFor({
      id: 'combo_all',
      tab: 'main',
      type: 'text',
      label: 'Комбо',
      show_if: {
        all: [
          { field: 'a', operator: '==', value: 'x' },
          { field: 'b', operator: '!=', value: true },
        ],
      },
    })
    expect(all.description).toContain('Питати ЛИШЕ якщо: a == "x" І b != true.')

    const any = schemaFor({
      id: 'combo_any',
      tab: 'main',
      type: 'text',
      label: 'Комбо',
      show_if: {
        any: [
          { field: 'a', operator: '>', value: 2 },
          { field: 'b', operator: '<', value: 5 },
        ],
      },
    })
    expect(any.description).toContain('Питати ЛИШЕ якщо: a > 2 АБО b < 5.')
  })
})

// ── real divorce config — multicheck on divorce_reasons ───────────────────────

describe('real divorce config (divorceFormConfig)', () => {
  it('divorce_reasons → array schema with enum of real option values', () => {
    const source = divorceFormConfig.steps.find((s) => s.id === 'divorce_reasons')
    expect(source?.type).toBe('multicheck')

    const reasons = props(divorceFormConfig as FormConfig).divorce_reasons
    expect(reasons.type).toBe('array')
    expect(reasons.uniqueItems).toBe(true)
    expect(reasons.items).toEqual({
      type: 'string',
      enum: (source?.options ?? []).map((o) => o.value),
    })
    expect((reasons.items as { enum: string[] }).enum).toContain('alcohol')
    expect(reasons.description).toContain('Причини розірвання шлюбу.')
    expect(reasons.description).toContain('Варіанти: no_common_interests — Відсутність спільних інтересів;')
  })
})

// ── real alimony config — full contract ───────────────────────────────────────

describe('real alimony config (alimonyConfig)', () => {
  const schema = formConfigToJsonSchema(alimonyConfig as FormConfig)

  it('full schema matches snapshot (MCP tool inputSchema contract)', () => {
    expect(schema).toMatchSnapshot()
  })

  it('required = EXACTLY the 16 unconditionally-required ids', () => {
    const EXPECTED = [
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
    expect([...(schema.required as string[])].sort()).toEqual([...EXPECTED].sort())
  })

  it('object envelope with additionalProperties === false', () => {
    expect(schema.type).toBe('object')
    expect(schema.additionalProperties).toBe(false)
  })

  it('properties = every step id, nothing else', () => {
    const properties = schema.properties as Record<string, unknown>
    expect(Object.keys(properties).sort()).toEqual(alimonyConfig.steps.map((s) => s.id).sort())
  })

  it('conditional divorce_date carries the show_if precondition and is not required', () => {
    const properties = schema.properties as Record<string, Record<string, unknown>>
    expect(properties.divorce_date.description).toContain('Питати ЛИШЕ якщо: marital_status == "divorced".')
    expect(schema.required).not.toContain('divorce_date')
  })

  it('plaintiff_account_iban: checksum note + boolean precondition', () => {
    const properties = schema.properties as Record<string, Record<string, unknown>>
    const iban = properties.plaintiff_account_iban
    expect(iban.description).toContain('контрольна сума')
    expect(iban.description).toContain('plaintiff_has_account == true')
  })
})
