import { describe, it, expect } from 'vitest'
import { deriveFormFlow, type FlowStep } from '../formFlow'
import type { FormConfig } from '../../types/form'
import type { FieldDiff } from '../serviceAnatomy'

const form: FormConfig = {
  service_id: 's', title: 'S',
  tabs: [{ id: 't', label: 'T' }],
  steps: [
    { id: 'a', tab: 't', type: 'text', label: 'A' },
    { id: 'b', tab: 't', type: 'boolean', label: 'Є діти?' },
    { id: 'c', tab: 't', type: 'boolean', label: 'Аліменти?', show_if: { field: 'b', operator: '==', value: true } },
    { id: 'd', tab: 't', type: 'number', label: 'Кількість', show_if: { field: 'b', operator: '==', value: true } },
    { id: 'e', tab: 't', type: 'number', label: 'Сума', show_if: { field: 'c', operator: '==', value: true } },
    { id: 'f', tab: 't', type: 'text', label: 'F' },
    { id: 'orphan', tab: 't', type: 'text', label: 'Orphan', show_if: { field: 'ghost', operator: '==', value: true } },
  ],
}
const diff = { usedFields: ['a', 'c'], unusedFields: ['b', 'd', 'e', 'f', 'orphan'], unmatchedPlaceholders: [] } as unknown as FieldDiff

const flat = (steps: FlowStep[]): FlowStep[] => steps.flatMap((s) => [s, ...(s.yes ? flat(s.yes) : [])])

describe('deriveFormFlow', () => {
  const tree = deriveFormFlow(form, diff)
  const all = flat(tree)
  const find = (id: string) => all.find((s) => s.id === id)

  it('wraps the flow in start and end nodes', () => {
    expect(tree[0].kind).toBe('start')
    expect(tree[tree.length - 1].kind).toBe('end')
  })

  it('renders an always-shown field with its document flag', () => {
    expect(find('a')).toMatchObject({ kind: 'field', flag: 'used' })
    expect(find('f')).toMatchObject({ kind: 'field', flag: 'extra' })
  })

  it('turns a controlling field into a gate with its dependents on the branch', () => {
    const b = find('b')!
    expect(b.kind).toBe('gate')
    expect(b.branch).toBe('так')
    expect(b.yes?.map((s) => s.id)).toEqual(['c', 'd'])
  })

  it('nests gates: a dependent that controls others becomes its own gate', () => {
    const c = find('c')!
    expect(c.kind).toBe('gate')
    expect(c.yes?.map((s) => s.id)).toEqual(['e'])
  })

  it('renders each field exactly once (no cycles/dupes)', () => {
    const ids = all.filter((s) => s.kind !== 'start' && s.kind !== 'end').map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('surfaces a show_if pointing at a missing field at the top instead of hiding it', () => {
    expect(tree.some((s) => s.id === 'orphan')).toBe(true)
  })
})

// ─── Branch tags, condition shapes, and degenerate inputs ─────────────────────
const mk = (steps: FormConfig['steps']): FormConfig => ({
  service_id: 's', title: 'S', tabs: [{ id: 't', label: 'T' }], steps,
})
const emptyDiff = { usedFields: [], unusedFields: [], unmatchedPlaceholders: [] } as unknown as FieldDiff
const tagOf = (form: FormConfig, gateId: string): string | undefined =>
  flat(deriveFormFlow(form, emptyDiff)).find((s) => s.id === gateId)?.branch

describe('deriveFormFlow — branch tags', () => {
  it("renders == true / == false as «так» / «ні»", () => {
    const yes = mk([
      { id: 'g', tab: 't', type: 'boolean', label: 'G' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { field: 'g', operator: '==', value: true } },
    ])
    const no = mk([
      { id: 'g', tab: 't', type: 'boolean', label: 'G' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { field: 'g', operator: '==', value: false } },
    ])
    expect(tagOf(yes, 'g')).toBe('так')
    expect(tagOf(no, 'g')).toBe('ні')
  })

  it('renders == with a non-boolean value as "= <value>"', () => {
    const form = mk([
      { id: 'g', tab: 't', type: 'number', label: 'G' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { field: 'g', operator: '==', value: 2 } },
    ])
    expect(tagOf(form, 'g')).toBe('= 2')
  })

  it('renders != as "≠ <value>" and other operators verbatim', () => {
    const neq = mk([
      { id: 'g', tab: 't', type: 'text', label: 'G' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { field: 'g', operator: '!=', value: 'x' } },
    ])
    const gt = mk([
      { id: 'g', tab: 't', type: 'number', label: 'G' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { field: 'g', operator: '>', value: 5 } },
    ])
    expect(tagOf(neq, 'g')).toBe('≠ x')
    expect(tagOf(gt, 'g')).toBe('> 5')
  })

  it('collapses a gate with mixed dependent conditions to «за умовою»', () => {
    const form = mk([
      { id: 'g', tab: 't', type: 'number', label: 'G' },
      { id: 'a', tab: 't', type: 'text', label: 'A', show_if: { field: 'g', operator: '==', value: 2 } },
      { id: 'b', tab: 't', type: 'text', label: 'B', show_if: { field: 'g', operator: '>', value: 5 } },
    ])
    expect(tagOf(form, 'g')).toBe('за умовою')
  })
})

describe('deriveFormFlow — all/any conditions', () => {
  it('hinges a gate on the first field of an `all` condition', () => {
    const form = mk([
      { id: 'h', tab: 't', type: 'boolean', label: 'H' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { all: [{ field: 'h', operator: '==', value: false }] } },
    ])
    const tree = deriveFormFlow(form, emptyDiff)
    const h = flat(tree).find((s) => s.id === 'h')!
    expect(h.kind).toBe('gate')
    expect(h.branch).toBe('ні')
    expect(h.yes?.map((s) => s.id)).toEqual(['c'])
  })

  it('hinges a gate on the first field of an `any` condition', () => {
    const form = mk([
      { id: 'k', tab: 't', type: 'boolean', label: 'K' },
      { id: 'c', tab: 't', type: 'text', label: 'C', show_if: { any: [{ field: 'k', operator: '==', value: true }] } },
    ])
    const tree = deriveFormFlow(form, emptyDiff)
    const k = flat(tree).find((s) => s.id === 'k')!
    expect(k.kind).toBe('gate')
    expect(k.branch).toBe('так')
  })
})

describe('deriveFormFlow — degenerate inputs', () => {
  it('wraps an empty form in just start + end (no field steps)', () => {
    const tree = deriveFormFlow(mk([]), emptyDiff)
    expect(tree.map((s) => s.kind)).toEqual(['start', 'end'])
  })

  it('falls back to the field id when a field has no label', () => {
    const tree = deriveFormFlow(mk([{ id: 'no_label', tab: 't', type: 'text', label: '' }]), emptyDiff)
    expect(tree.find((s) => s.id === 'no_label')?.label).toBe('no_label')
  })

  it('treats a field with an empty `all` array as a top-level field, not a gate (no primary field)', () => {
    // primaryField returns null for an empty all[] → orphan branch → surfaced at top as a field
    const form = mk([{ id: 'odd', tab: 't', type: 'text', label: 'Odd', show_if: { all: [] } }])
    const tree = deriveFormFlow(form, emptyDiff)
    expect(tree.find((s) => s.id === 'odd')).toMatchObject({ kind: 'field' })
  })

  it('marks a field present in usedFields as `used`, otherwise `extra`', () => {
    const form = mk([
      { id: 'u', tab: 't', type: 'text', label: 'U' },
      { id: 'x', tab: 't', type: 'text', label: 'X' },
    ])
    const diff = { usedFields: ['u'], unusedFields: ['x'], unmatchedPlaceholders: [] } as unknown as FieldDiff
    const tree = deriveFormFlow(form, diff)
    expect(tree.find((s) => s.id === 'u')?.flag).toBe('used')
    expect(tree.find((s) => s.id === 'x')?.flag).toBe('extra')
  })

  it('renders every field exactly once even with deep gate nesting (no dupes/cycles)', () => {
    // a → gates b → gates c → gates d (a 4-level chain)
    const form = mk([
      { id: 'a', tab: 't', type: 'boolean', label: 'A' },
      { id: 'b', tab: 't', type: 'boolean', label: 'B', show_if: { field: 'a', operator: '==', value: true } },
      { id: 'c', tab: 't', type: 'boolean', label: 'C', show_if: { field: 'b', operator: '==', value: true } },
      { id: 'd', tab: 't', type: 'text', label: 'D', show_if: { field: 'c', operator: '==', value: true } },
    ])
    const all = flat(deriveFormFlow(form, emptyDiff))
    const ids = all.filter((s) => s.kind !== 'start' && s.kind !== 'end').map((s) => s.id)
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
