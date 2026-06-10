// Single source of truth for the service lifecycle status used across the admin UI.
// Mirrors the DB CHECK constraint on services.status (migration 011) and the guards
// in n8n (form-submit/main-bot) + TWA (App.tsx). Only 'active' is served to users.

export type ServiceStatus = 'active' | 'needs_review' | 'disabled'

export const SERVICE_STATUSES: ServiceStatus[] = ['active', 'needs_review', 'disabled']

export function isServiceStatus(value: unknown): value is ServiceStatus {
  return value === 'active' || value === 'needs_review' || value === 'disabled'
}

/** Coerce an unknown DB value into a safe status (defaults to 'disabled'). */
export function toServiceStatus(value: unknown): ServiceStatus {
  return isServiceStatus(value) ? value : 'disabled'
}

interface StatusMeta {
  label: string      // Ukrainian label shown to the lawyer
  dot: string        // tailwind bg-* for the status dot
  badge: string      // tailwind classes for the badge pill
}

export const STATUS_META: Record<ServiceStatus, StatusMeta> = {
  active: {
    label: 'Активна',
    dot:   'bg-green-400',
    badge: 'bg-green-500/10 text-green-400',
  },
  needs_review: {
    label: 'Потребує ревʼю',
    dot:   'bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  disabled: {
    label: 'Вимкнена',
    dot:   'bg-slate-500',
    badge: 'bg-slate-800 text-slate-400',
  },
}

export interface StatusAction {
  to: ServiceStatus
  label: string
  /** primary = filled/affirmative action; secondary = muted */
  variant: 'primary' | 'secondary'
}

// Lawyer-driven transitions per current status. 'needs_review' is set by the system
// (law change); the lawyer resolves it by confirming (→active) or disabling.
const TRANSITIONS: Record<ServiceStatus, StatusAction[]> = {
  active: [
    { to: 'disabled', label: 'Вимкнути', variant: 'secondary' },
  ],
  disabled: [
    { to: 'active', label: 'Активувати', variant: 'primary' },
  ],
  needs_review: [
    { to: 'active',   label: 'Підтвердити', variant: 'primary' },
    { to: 'disabled', label: 'Вимкнути',    variant: 'secondary' },
  ],
}

export function statusActions(current: ServiceStatus): StatusAction[] {
  return TRANSITIONS[current]
}

/** Keeps the deprecated is_published column coherent with status (migration 012). */
export function isPublishedFor(status: ServiceStatus): boolean {
  return status === 'active'
}
