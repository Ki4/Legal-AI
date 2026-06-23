// Status pill (Claude Design canvas) — muted tone + optional dot. Never decorative.
import type { ReactNode } from 'react'

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'brand' | 'neutral'

const TONE: Record<BadgeTone, { pill: string; dot: string }> = {
  ok:      { pill: 'bg-ok/10 text-ok',         dot: 'bg-ok' },
  warn:    { pill: 'bg-warn/10 text-warn',     dot: 'bg-warn' },
  danger:  { pill: 'bg-danger/10 text-danger', dot: 'bg-danger' },
  brand:   { pill: 'bg-brand/10 text-brand',   dot: 'bg-brand' },
  neutral: { pill: 'bg-paperAlt text-inkSoft', dot: 'bg-inkMute' },
}

export function Badge({
  tone = 'neutral',
  dot = true,
  className = '',
  children,
}: { tone?: BadgeTone; dot?: boolean; className?: string; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-semibold ${t.pill} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
      {children}
    </span>
  )
}
