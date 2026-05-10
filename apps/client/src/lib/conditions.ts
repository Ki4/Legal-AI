import type { Answers, SingleCondition, ShowIfCondition } from '../types/form'

export function evalSingle(c: SingleCondition, answers: Answers): boolean {
  const actual = answers[c.field]
  if (c.operator === '==') return actual === c.value
  if (c.operator === '!=') return actual !== c.value
  if (c.operator === '>') return Number(actual) > Number(c.value)
  if (c.operator === '<') return Number(actual) < Number(c.value)
  return true
}

export function evalCondition(cond: ShowIfCondition, answers: Answers): boolean {
  if ('all' in cond) return cond.all.every(c => evalSingle(c, answers))
  if ('any' in cond) return cond.any.some(c => evalSingle(c, answers))
  return evalSingle(cond, answers)
}

export function isVisible(s: { show_if?: ShowIfCondition }, answers: Answers): boolean {
  if (!s.show_if) return true
  return evalCondition(s.show_if, answers)
}
