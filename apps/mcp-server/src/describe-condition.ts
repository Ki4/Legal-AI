import type { ShowIfCondition, SingleCondition } from './types.js'

function fmtValue(v: boolean | string | number): string {
  return typeof v === 'string' ? `"${v}"` : String(v)
}

function single(c: SingleCondition): string {
  return `${c.field} ${c.operator} ${fmtValue(c.value)}`
}

/**
 * Human-readable rendering of a show_if condition — used in tool-schema
 * descriptions («Питати ЛИШЕ якщо: …») and hidden_by_condition warnings.
 * Combinators follow plan D2: all → « І », any → « АБО ».
 */
export function describeCondition(cond: ShowIfCondition): string {
  if ('all' in cond) return cond.all.map(single).join(' І ')
  if ('any' in cond) return cond.any.map(single).join(' АБО ')
  return single(cond)
}
