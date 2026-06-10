// Single source of truth for the law_change_log audit used by the admin review panel.
// Mirrors the DB CHECK constraints on law_change_log (migration 011): action and
// detected_by. Rows are created by service_role only (manual script today, CRON later);
// the lawyer reads them and sets `action` to reviewed / dismissed (migration 013 RLS).

export type LawChangeAction = 'flagged' | 'reviewed' | 'dismissed'
export type LawChangeDetectedBy = 'manual' | 'cron'

/** Row shape as read from public.law_change_log. */
export interface LawChangeLogRow {
  id: number
  law_slug: string
  law_title: string | null
  old_revision_date: string | null
  new_revision_date: string | null
  detected_at: string
  detected_by: LawChangeDetectedBy
  affected_services: string[]
  action: LawChangeAction
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
}

export function isLawChangeAction(value: unknown): value is LawChangeAction {
  return value === 'flagged' || value === 'reviewed' || value === 'dismissed'
}

/** Coerce an unknown DB value into a safe action (defaults to 'flagged' = pending). */
export function toLawChangeAction(value: unknown): LawChangeAction {
  return isLawChangeAction(value) ? value : 'flagged'
}

/** A change is pending review while it is still 'flagged'. */
export function isPending(action: LawChangeAction): boolean {
  return action === 'flagged'
}

export function pendingCount(rows: { action: LawChangeAction }[]): number {
  return rows.reduce((n, r) => (isPending(r.action) ? n + 1 : n), 0)
}

interface ActionMeta {
  label: string // Ukrainian label shown to the lawyer
  dot: string   // tailwind bg-* for the status dot
  badge: string // tailwind classes for the badge pill
}

export const ACTION_META: Record<LawChangeAction, ActionMeta> = {
  flagged: {
    label: 'Очікує ревʼю',
    dot:   'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  reviewed: {
    label: 'Переглянуто',
    dot:   'bg-green-400',
    badge: 'bg-green-500/10 text-green-400',
  },
  dismissed: {
    label: 'Відхилено',
    dot:   'bg-slate-500',
    badge: 'bg-slate-800 text-slate-400',
  },
}

export const DETECTED_BY_LABEL: Record<LawChangeDetectedBy, string> = {
  manual: 'Вручну',
  cron:   'Автоматично',
}

export interface ReviewAction {
  to: LawChangeAction
  label: string
  /** primary = filled/affirmative; secondary = muted */
  variant: 'primary' | 'secondary'
}

// Transitions the lawyer can drive from each action state. A pending (flagged) change is
// resolved by confirming a review (→reviewed) or dismissing it (→dismissed). A resolved
// row can be re-opened (→flagged) if it needs another look.
const TRANSITIONS: Record<LawChangeAction, ReviewAction[]> = {
  flagged: [
    { to: 'reviewed',  label: 'Переглянуто', variant: 'primary' },
    { to: 'dismissed', label: 'Відхилити',   variant: 'secondary' },
  ],
  reviewed: [
    { to: 'flagged', label: 'Повернути в очікування', variant: 'secondary' },
  ],
  dismissed: [
    { to: 'flagged', label: 'Повернути в очікування', variant: 'secondary' },
  ],
}

export function reviewActions(current: LawChangeAction): ReviewAction[] {
  return TRANSITIONS[current]
}

/** Human-readable revision change, e.g. "2026-01-01 → 2026-03-04" or "→ 2026-03-04". */
export function formatRevision(oldDate: string | null, newDate: string | null): string {
  const to = newDate || '?'
  return oldDate ? `${oldDate} → ${to}` : `→ ${to}`
}
