// Derive a decision-tree from a form's show_if rules: which questions branch, which fields
// appear only under a condition. Mirrors the viz-lab "Алгоритм форми" but on real form_config.
//
// A field that other fields' show_if reference becomes a `gate` (a branching question); the
// fields it gates hang on its `yes` branch (recursively). Fields nobody gates and that have no
// show_if are top-level `field` steps. Flag = used (printed in document) / extra (not in template).
import type { FormConfig, FormField, ShowIfCondition } from '../types/form'
import type { FieldDiff } from './serviceAnatomy'

export type FlowFlag = 'used' | 'extra'
export type FlowKind = 'start' | 'gate' | 'field' | 'end'

export interface FlowStep {
  id: string
  kind: FlowKind
  label: string
  hint?: string
  flag?: FlowFlag        // for `field` steps
  branch?: string        // for `gate` steps — the condition that opens the `yes` branch
  yes?: FlowStep[]       // for `gate` steps
  field?: FormField      // source field (gate/field steps) — for the detailed list view
}

/** The field id a condition primarily hinges on (first referenced field for all/any). */
function primaryField(cond: ShowIfCondition): string | null {
  if ('field' in cond) return cond.field
  const arr = 'all' in cond ? cond.all : cond.any
  return arr && arr.length ? arr[0].field : null
}

/** Short tag for the branch a condition opens, e.g. «так», «ні», «= 2», «≠ X». */
function branchTag(cond: ShowIfCondition): string {
  const sc = 'field' in cond ? cond : ('all' in cond ? cond.all : cond.any)?.[0]
  if (!sc) return 'за умовою'
  if (sc.operator === '==') return sc.value === true ? 'так' : sc.value === false ? 'ні' : `= ${sc.value}`
  if (sc.operator === '!=') return `≠ ${sc.value}`
  return `${sc.operator} ${sc.value}`
}

export function deriveFormFlow(form: FormConfig, diff: FieldDiff): FlowStep[] {
  const steps = form.steps
  const usedSet = new Set(diff.usedFields)
  const byId = new Map(steps.map((f) => [f.id, f]))

  // group conditional fields under the field that gates them
  const deps = new Map<string, FormField[]>()
  const orphans: FormField[] = []
  for (const f of steps) {
    if (!f.show_if) continue
    const ctrl = primaryField(f.show_if)
    if (ctrl && byId.has(ctrl)) (deps.get(ctrl) ?? deps.set(ctrl, []).get(ctrl)!).push(f)
    else orphans.push(f) // show_if points at a missing field — surface at top rather than hide
  }

  const flagOf = (f: FormField): FlowFlag => (usedSet.has(f.id) ? 'used' : 'extra')
  const built = new Set<string>()

  const build = (f: FormField): FlowStep => {
    built.add(f.id)
    const children = (deps.get(f.id) ?? []).filter((c) => !built.has(c.id))
    if (children.length) {
      const tags = [...new Set(children.map((c) => branchTag(c.show_if as ShowIfCondition)))]
      return {
        id: f.id, kind: 'gate', label: f.label || f.id, field: f,
        branch: tags.length === 1 ? tags[0] : 'за умовою',
        yes: children.map(build),
      }
    }
    return { id: f.id, kind: 'field', label: f.label || f.id, flag: flagOf(f), field: f }
  }

  const top = steps.filter((f) => !f.show_if)
  return [
    { id: '__start', kind: 'start', label: 'Старт форми', hint: 'клієнт відкриває форму' },
    ...top.map(build),
    ...orphans.filter((f) => !built.has(f.id)).map(build),
    { id: '__end', kind: 'end', label: 'Готовий документ', hint: 'збирається із заповнених полів' },
  ]
}
