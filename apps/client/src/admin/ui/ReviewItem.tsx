// Unified review-queue item (Claude Design canvas) — one pattern for comments / requests /
// law-changes. "Позначити вирішеним" is an explicit button, not a status badge (fixes the
// session-42 UX debt called out in the brief). Resolved rows dim, keep the body collapsed
// behind a "Показати"/"Сховати" toggle, and offer to re-open.
//
// Most inboxes use the open/done model (onResolve/onReopen). Law-changes have a richer review
// (reviewed vs dismissed, custom transitions), so they pass their own `actions` for the open
// state and a `resolvedLabel`/`resolvedTone` for the resolved badge.
import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export interface ReviewItemProps {
  title: ReactNode
  timestamp?: string
  body?: ReactNode
  resolved?: boolean
  openLabel?: string
  resolvedLabel?: string             // badge text on resolved rows (default "Вирішено")
  resolvedTone?: 'ok' | 'neutral'    // green check vs muted dot
  reopenLabel?: string               // re-open button text (default "Відкрити знову")
  onResolve?: () => void
  onReopen?: () => void
  onOpen?: () => void
  actions?: ReactNode                // custom open-state action row (replaces onResolve/onOpen)
  children?: ReactNode               // extra content (e.g. a notes textarea, AI draft card)
}

export function ReviewItem({
  title, timestamp, body, resolved = false, openLabel = 'Відкрити послугу',
  resolvedLabel = 'Вирішено', resolvedTone = 'ok', reopenLabel = 'Відкрити знову',
  onResolve, onReopen, onOpen, actions, children,
}: ReviewItemProps) {
  const [showBody, setShowBody] = useState(false)
  if (resolved) {
    const hasContent = Boolean(body || children)
    return (
      <div className="border border-line rounded-xl px-4 py-3.5 bg-paperAlt/60">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-inkSoft line-through truncate">{title}</span>
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] flex-shrink-0 ${resolvedTone === 'ok' ? 'text-ok' : 'text-inkMute'}`}>
            {resolvedTone === 'ok'
              ? <Check size={13} strokeWidth={2.2} />
              : <span className="w-1.5 h-1.5 rounded-full bg-inkMute" />}
            {resolvedLabel}
          </span>
        </div>
        {showBody && (
          <div className="mt-2.5">
            {body && <p className="text-[13px] text-inkSoft leading-relaxed">{body}</p>}
            {children}
          </div>
        )}
        <div className="flex items-center gap-2.5 mt-2.5">
          {hasContent && (
            <button onClick={() => setShowBody((v) => !v)}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-inkMute hover:text-ink transition-colors">
              <ChevronDown size={13} strokeWidth={2}
                className={`transition-transform ${showBody ? '' : '-rotate-90'}`} />
              {showBody ? 'Сховати' : 'Показати'}
            </button>
          )}
          {onReopen && (
            <button onClick={onReopen}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-inkSoft bg-paper
                         border border-lineStrong rounded-[9px] px-3 py-1.5 hover:text-ink transition-colors">
              {reopenLabel}
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="border border-line rounded-xl px-4 py-3.5 bg-paper">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-sm font-semibold text-ink">{title}</span>
        {timestamp && <span className="text-[11.5px] text-inkMute flex-shrink-0">{timestamp}</span>}
      </div>
      {body && <p className="text-[13px] text-inkSoft leading-relaxed mb-3.5">{body}</p>}
      {children}
      {(actions || onResolve || onOpen) && (
        <div className="flex items-center gap-2.5">
          {actions ?? (
            <>
              {onResolve && (
                <button onClick={onResolve}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-brand
                             rounded-[9px] px-3.5 py-1.5 hover:bg-brand/90 transition-colors">
                  <Check size={14} strokeWidth={2.2} /> Позначити вирішеним
                </button>
              )}
              {onOpen && (
                <button onClick={onOpen}
                  className="text-[13px] font-medium text-inkSoft rounded-[9px] px-3 py-1.5 hover:bg-paperAlt hover:text-ink transition-colors">
                  {openLabel}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
