// Unified review-queue item (Claude Design canvas) — one pattern for comments / requests /
// law-changes. "Позначити вирішеним" is an explicit button, not a status badge (fixes the
// session-42 UX debt called out in the brief). Resolved rows dim + offer "Відкрити знову".
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export interface ReviewItemProps {
  title: ReactNode
  timestamp?: string
  body?: ReactNode
  resolved?: boolean
  openLabel?: string
  onResolve?: () => void
  onReopen?: () => void
  onOpen?: () => void
  children?: ReactNode   // extra content (e.g. a notes textarea, AI draft card)
}

export function ReviewItem({
  title, timestamp, body, resolved = false, openLabel = 'Відкрити послугу',
  onResolve, onReopen, onOpen, children,
}: ReviewItemProps) {
  if (resolved) {
    return (
      <div className="border border-line rounded-xl px-4 py-3.5 bg-paperAlt/60">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold text-inkSoft line-through truncate">{title}</span>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ok flex-shrink-0">
            <Check size={13} strokeWidth={2.2} /> Вирішено
          </span>
        </div>
        {onReopen && (
          <button onClick={onReopen}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-inkSoft bg-paper
                       border border-lineStrong rounded-[9px] px-3 py-1.5 hover:text-ink transition-colors">
            Відкрити знову
          </button>
        )}
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
      <div className="flex items-center gap-2.5">
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
      </div>
    </div>
  )
}
