/**
 * Pure utility functions for form logic.
 * Extracted from DynamicLegalFormBuilder.tsx and FormField.tsx
 * so they can be unit-tested without React DOM.
 */

import type { FormConfig, FormField, Answers } from '../types/form'
import { isVisible } from './conditions'

// ── Field counting ──────────────────────────────────────────────────────────

/** Count visible fields in a given tab */
export function countVisible(config: FormConfig, tabId: string, answers: Answers): number {
  return config.steps.filter(s => s.tab === tabId && isVisible(s, answers)).length
}

/** Count answered fields in a given tab (visible only) */
export function countAnswered(config: FormConfig, tabId: string, answers: Answers): number {
  return config.steps.filter((s) => {
    if (s.tab !== tabId) return false
    if (!isVisible(s, answers)) return false
    return isAnswered(answers[s.id])
  }).length
}

/** Count required fields in a given tab (visible only) */
export function countRequired(config: FormConfig, tabId: string, answers: Answers): number {
  return config.steps.filter(s => s.tab === tabId && s.required && isVisible(s, answers)).length
}

/** Count required AND answered fields in a given tab (visible only) */
export function countRequiredAnswered(config: FormConfig, tabId: string, answers: Answers): number {
  return config.steps.filter((s) => {
    if (s.tab !== tabId || !s.required) return false
    if (!isVisible(s, answers)) return false
    return isAnswered(answers[s.id])
  }).length
}

// ── Validation ──────────────────────────────────────────────────────────────

/** Check if a single answer value is non-empty */
export function isAnswered(value: Answers[string]): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true // boolean true/false are both "answered"
}

/** Validate all required fields across the entire form. Returns array of error labels. */
export function validateForm(config: FormConfig, answers: Answers): string[] {
  const errors: string[] = []
  for (const step of config.steps) {
    if (!step.required) continue
    if (!isVisible(step, answers)) continue
    if (!isAnswered(answers[step.id])) {
      errors.push(step.label)
    }
  }
  return errors
}

/** Find the index of the first tab that contains a required unanswered field */
export function findFirstErrorTab(config: FormConfig, answers: Answers): number {
  for (const step of config.steps) {
    if (!step.required || !isVisible(step, answers)) continue
    if (!isAnswered(answers[step.id])) {
      const tabIdx = config.tabs.findIndex(t => t.id === step.tab)
      if (tabIdx >= 0) return tabIdx
    }
  }
  return -1
}

// ── Input cleaning ──────────────────────────────────────────────────────────

/** Clean phone input: allow only digits, +, spaces, dashes, parens */
export function cleanPhoneInput(raw: string): string {
  return raw.replace(/[^\d+\s\-()]/g, '')
}

/** Max length for phone field */
export const PHONE_MAX_LENGTH = 19

// ── Draft persistence ───────────────────────────────────────────────────────

const DRAFT_PREFIX = 'draft_'

export function loadDraft(slug: string): Answers {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${slug}`)
    if (!raw) return {}
    return JSON.parse(raw) as Answers
  } catch { return {} }
}

export function saveDraft(slug: string, answers: Answers) {
  try { localStorage.setItem(`${DRAFT_PREFIX}${slug}`, JSON.stringify(answers)) } catch { /* quota */ }
}

export function clearDraft(slug: string) {
  try { localStorage.removeItem(`${DRAFT_PREFIX}${slug}`) } catch { /* noop */ }
}

// ── Stale answer cleanup ────────────────────────────────────────────────────

/**
 * When a parent field changes, children that become hidden should be reset to null.
 * This prevents stale data from being submitted.
 */
export function clearStaleAnswers(steps: FormField[], answers: Answers): Answers {
  const next = { ...answers }
  for (const step of steps) {
    if (step.show_if && !isVisible(step, next) && next[step.id] !== undefined) {
      next[step.id] = null
    }
  }
  return next
}
