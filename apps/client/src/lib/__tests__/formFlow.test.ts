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
