import { describe, it, expect } from 'vitest'
import {
  isAnswered,
  cleanPhoneInput,
  PHONE_MAX_LENGTH,
  validateForm,
  findFirstErrorTab,
  countVisible,
  countAnswered,
  countRequired,
  countRequiredAnswered,
  clearStaleAnswers,
} from '../form-utils'
import type { FormConfig, Answers, FormField } from '../../types/form'

// ─── isAnswered ──────────────────────────────────────────────────────────────

describe('isAnswered', () => {
  it('returns false for null', () => {
    expect(isAnswered(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    // At runtime, answers[key] can be undefined when key doesn't exist
    expect(isAnswered(undefined as unknown as Answers[string])).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isAnswered('')).toBe(false)
  })

  it('returns false for whitespace-only string', () => {
    expect(isAnswered('   ')).toBe(false)
    expect(isAnswered('\t\n')).toBe(false)
  })

  it('returns true for non-empty string', () => {
    expect(isAnswered('Олена')).toBe(true)
    expect(isAnswered('a')).toBe(true)
  })

  it('returns false for empty array', () => {
    expect(isAnswered([])).toBe(false)
  })

  it('returns true for non-empty array', () => {
    expect(isAnswered(['option1'])).toBe(true)
    expect(isAnswered(['a', 'b'])).toBe(true)
  })

  it('returns true for boolean true', () => {
    expect(isAnswered(true)).toBe(true)
  })

  it('returns true for boolean false (user made a conscious choice)', () => {
    expect(isAnswered(false)).toBe(true)
  })
})

// ─── cleanPhoneInput ─────────────────────────────────────────────────────────

describe('cleanPhoneInput', () => {
  it('allows digits', () => {
    expect(cleanPhoneInput('0501234567')).toBe('0501234567')
  })

  it('allows + prefix', () => {
    expect(cleanPhoneInput('+380501234567')).toBe('+380501234567')
  })

  it('allows spaces', () => {
    expect(cleanPhoneInput('+380 50 123 45 67')).toBe('+380 50 123 45 67')
  })

  it('allows dashes', () => {
    expect(cleanPhoneInput('+380-50-123-45-67')).toBe('+380-50-123-45-67')
  })

  it('allows parentheses', () => {
    expect(cleanPhoneInput('+380(50)1234567')).toBe('+380(50)1234567')
  })

  it('removes letters', () => {
    expect(cleanPhoneInput('+380abc50def')).toBe('+38050')
  })

  it('removes Cyrillic characters', () => {
    expect(cleanPhoneInput('+380привет50')).toBe('+38050')
  })

  it('removes special characters except allowed', () => {
    // @ # $ are not in allowed set → removed, digits stay
    expect(cleanPhoneInput('+380@50#12$34')).toBe('+380501234')
  })

  it('handles empty string', () => {
    expect(cleanPhoneInput('')).toBe('')
  })

  it('PHONE_MAX_LENGTH is 19', () => {
    expect(PHONE_MAX_LENGTH).toBe(19)
  })
})

// ─── validateForm ────────────────────────────────────────────────────────────

// Helper: minimal FormConfig for testing
function makeConfig(fields: Partial<FormField>[]): FormConfig {
  return {
    service_id: 'test',
    title: 'Test Form',
    tabs: [
      { id: 'tab1', label: 'Tab 1' },
      { id: 'tab2', label: 'Tab 2' },
    ],
    steps: fields.map((f, i) => ({
      id: f.id ?? `field_${i}`,
      tab: f.tab ?? 'tab1',
      type: f.type ?? 'text',
      label: f.label ?? `Field ${i}`,
      required: f.required,
      show_if: f.show_if,
      options: f.options,
    })),
  }
}

describe('validateForm', () => {
  it('returns empty array when no required fields', () => {
    const config = makeConfig([
      { id: 'name', label: 'Name' },
      { id: 'email', label: 'Email' },
    ])
    expect(validateForm(config, {})).toEqual([])
  })

  it('returns labels of unanswered required fields', () => {
    const config = makeConfig([
      { id: 'name', label: "Ім'я", required: true },
      { id: 'phone', label: 'Телефон', required: true },
      { id: 'comment', label: 'Коментар' },
    ])
    expect(validateForm(config, {})).toEqual(["Ім'я", 'Телефон'])
  })

  it('returns empty when all required fields are answered', () => {
    const config = makeConfig([
      { id: 'name', label: "Ім'я", required: true },
      { id: 'phone', label: 'Телефон', required: true },
    ])
    const answers: Answers = { name: 'Олена', phone: '+380501234567' }
    expect(validateForm(config, answers)).toEqual([])
  })

  it('treats empty string as unanswered', () => {
    const config = makeConfig([
      { id: 'name', label: "Ім'я", required: true },
    ])
    expect(validateForm(config, { name: '' })).toEqual(["Ім'я"])
  })

  it('treats whitespace-only as unanswered', () => {
    const config = makeConfig([
      { id: 'name', label: "Ім'я", required: true },
    ])
    expect(validateForm(config, { name: '   ' })).toEqual(["Ім'я"])
  })

  it('skips required fields that are hidden via show_if', () => {
    const config = makeConfig([
      { id: 'has_children', label: 'Чи є діти?', type: 'boolean', required: true },
      {
        id: 'children_count',
        label: 'Кількість дітей',
        required: true,
        show_if: { field: 'has_children', operator: '==', value: true },
      },
    ])
    // has_children is false → children_count is hidden → not validated
    const answers: Answers = { has_children: false }
    expect(validateForm(config, answers)).toEqual([])
  })

  it('validates required fields that are visible via show_if', () => {
    const config = makeConfig([
      { id: 'has_children', label: 'Чи є діти?', type: 'boolean', required: true },
      {
        id: 'children_count',
        label: 'Кількість дітей',
        required: true,
        show_if: { field: 'has_children', operator: '==', value: true },
      },
    ])
    // has_children is true → children_count is visible but unanswered
    const answers: Answers = { has_children: true }
    expect(validateForm(config, answers)).toEqual(['Кількість дітей'])
  })

  it('boolean false counts as answered', () => {
    const config = makeConfig([
      { id: 'consent', label: 'Згода', type: 'boolean', required: true },
    ])
    // User explicitly chose "no" — that's still an answer
    expect(validateForm(config, { consent: false })).toEqual([])
  })

  it('empty multicheck array counts as unanswered', () => {
    const config = makeConfig([
      { id: 'docs', label: 'Документи', type: 'multicheck', required: true },
    ])
    expect(validateForm(config, { docs: [] })).toEqual(['Документи'])
  })

  it('non-empty multicheck array counts as answered', () => {
    const config = makeConfig([
      { id: 'docs', label: 'Документи', type: 'multicheck', required: true },
    ])
    expect(validateForm(config, { docs: ['passport'] })).toEqual([])
  })
})

// ─── findFirstErrorTab ───────────────────────────────────────────────────────

describe('findFirstErrorTab', () => {
  it('returns -1 when no errors', () => {
    const config = makeConfig([
      { id: 'name', label: 'Name', required: true, tab: 'tab1' },
    ])
    expect(findFirstErrorTab(config, { name: 'Олена' })).toBe(-1)
  })

  it('returns index of first tab with error', () => {
    const config = makeConfig([
      { id: 'name', label: 'Name', required: true, tab: 'tab1' },
      { id: 'phone', label: 'Phone', required: true, tab: 'tab2' },
    ])
    // Tab1 answered, tab2 not
    expect(findFirstErrorTab(config, { name: 'Олена' })).toBe(1)
  })

  it('returns tab1 when first field is empty', () => {
    const config = makeConfig([
      { id: 'name', label: 'Name', required: true, tab: 'tab1' },
      { id: 'phone', label: 'Phone', required: true, tab: 'tab2' },
    ])
    expect(findFirstErrorTab(config, {})).toBe(0)
  })
})

// ─── countVisible / countAnswered / countRequired / countRequiredAnswered ────

describe('field counting', () => {
  const config = makeConfig([
    { id: 'name', label: 'Name', required: true, tab: 'tab1' },
    { id: 'age', label: 'Age', tab: 'tab1' },
    {
      id: 'children_count',
      label: 'Children',
      required: true,
      tab: 'tab1',
      show_if: { field: 'has_children', operator: '==', value: true },
    },
    { id: 'has_children', label: 'Has children', type: 'boolean', tab: 'tab1' },
    { id: 'phone', label: 'Phone', required: true, tab: 'tab2' },
  ])

  const answers: Answers = {
    name: 'Олена',
    has_children: false,
    // children_count is hidden because has_children is false
    // age is empty
    // phone is empty
  }

  it('countVisible counts only visible fields in given tab', () => {
    // tab1: name, age, has_children are visible; children_count is hidden
    expect(countVisible(config, 'tab1', answers)).toBe(3)
    expect(countVisible(config, 'tab2', answers)).toBe(1)
  })

  it('countAnswered counts visible + answered fields', () => {
    // tab1: name (answered), has_children (answered), age (not answered) = 2
    expect(countAnswered(config, 'tab1', answers)).toBe(2)
    expect(countAnswered(config, 'tab2', answers)).toBe(0)
  })

  it('countRequired counts visible + required fields', () => {
    // tab1: name (req + visible), children_count (req but hidden) = 1
    expect(countRequired(config, 'tab1', answers)).toBe(1)
    expect(countRequired(config, 'tab2', answers)).toBe(1)
  })

  it('countRequiredAnswered counts visible + required + answered', () => {
    // tab1: name (req + visible + answered) = 1
    expect(countRequiredAnswered(config, 'tab1', answers)).toBe(1)
    expect(countRequiredAnswered(config, 'tab2', answers)).toBe(0)
  })

  it('when has_children becomes true, children_count becomes visible', () => {
    const withChildren: Answers = { ...answers, has_children: true }
    // Now children_count is visible: name, age, children_count, has_children = 4
    expect(countVisible(config, 'tab1', withChildren)).toBe(4)
    expect(countRequired(config, 'tab1', withChildren)).toBe(2)
  })
})

// ─── clearStaleAnswers ───────────────────────────────────────────────────────

describe('clearStaleAnswers', () => {
  const steps: FormField[] = [
    { id: 'has_children', tab: 'tab1', type: 'boolean', label: 'Has children' },
    {
      id: 'children_count',
      tab: 'tab1',
      type: 'number',
      label: 'Count',
      show_if: { field: 'has_children', operator: '==', value: true },
    },
    {
      id: 'children_names',
      tab: 'tab1',
      type: 'text',
      label: 'Names',
      show_if: { field: 'has_children', operator: '==', value: true },
    },
  ]

  it('nullifies hidden children when parent value changes', () => {
    const answers: Answers = {
      has_children: false,
      children_count: '2',       // stale — should be cleared
      children_names: 'Олена',   // stale — should be cleared
    }
    const result = clearStaleAnswers(steps, answers)
    expect(result.children_count).toBeNull()
    expect(result.children_names).toBeNull()
    expect(result.has_children).toBe(false)
  })

  it('preserves visible children when parent allows them', () => {
    const answers: Answers = {
      has_children: true,
      children_count: '2',
      children_names: 'Олена',
    }
    const result = clearStaleAnswers(steps, answers)
    expect(result.children_count).toBe('2')
    expect(result.children_names).toBe('Олена')
  })

  it('does not touch fields without show_if', () => {
    const answers: Answers = {
      has_children: true,
      unrelated_field: 'keep me',
    }
    const result = clearStaleAnswers(steps, answers)
    expect(result.unrelated_field).toBe('keep me')
  })
})
