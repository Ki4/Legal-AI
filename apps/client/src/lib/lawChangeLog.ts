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
  // ─── law-change-impact agent (migration 027) ───────────────────────────────
  article_diffs: ArticleDiffs | null // deterministic L1 diff (ground truth)
  ai_summary: string | null          // L3 plain-language draft; null until digest / when abstained
  ai_impact: AiImpactItem[] | null   // L3 per-service hypotheses
  ai_confidence: number | null       // 0..1
  ai_status: AiStatus
  ai_model: string | null
  ai_generated_at: string | null
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

// ─── law-change-impact agent (migration 027) ─────────────────────────────────
// Read model for the AI "what changed" draft shown above the lawyer's notes. The agent
// writes only the ai_* columns + article_diffs; the lawyer's `notes`/`action` stay the SSoT.

export type AiStatus = 'pending' | 'drafted' | 'abstained' | 'error'
export type Severity = 'high' | 'medium' | 'low'

/** One per-service impact hypothesis (L3 output). */
export interface AiImpactItem {
  slug: string
  severity: Severity
  confidence: number
  articles: string[]
  hypothesis: string
  evidence?: string
}

/** One changed-article hunk of the deterministic diff (L1). */
export interface ArticleDiffHunk {
  article_num: string | null
  op: 'added' | 'removed' | 'changed'
  removed: string[]
  added: string[]
}

/** The deterministic revision diff snapshot (law_change_log.article_diffs). */
export interface ArticleDiffs {
  level: 'law' | 'article'
  law_code: string | null
  changed_articles: string[]
  hunks: ArticleDiffHunk[]
  source_url: string | null
  captured_at: string
  truncated: boolean
}

/** Coerce an unknown DB value into a safe ai_status (defaults to 'pending'). */
export function toAiStatus(value: unknown): AiStatus {
  return value === 'drafted' || value === 'abstained' || value === 'error' ? value : 'pending'
}

/** Severity → Ukrainian label + tailwind colours (legal risk, not demand). */
export const SEVERITY_META: Record<Severity, { label: string; dot: string; text: string }> = {
  high:   { label: 'високий ризик', dot: 'bg-red-400',    text: 'text-red-400' },
  medium: { label: 'середній',      dot: 'bg-amber-400',  text: 'text-amber-400' },
  low:    { label: 'низький',       dot: 'bg-slate-400',  text: 'text-slate-400' },
}

/** Confidence as a 0–100% string, or null when absent. */
export function confidencePct(c: number | null): string | null {
  return c == null ? null : `${Math.round(c * 100)}%`
}
