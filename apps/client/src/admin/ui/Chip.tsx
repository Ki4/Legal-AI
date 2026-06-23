// Field chip (Claude Design canvas) — mono, tone shows how a form field maps to the document.
import type { ReactNode } from 'react'

export type ChipTone = 'used' | 'extra' | 'missing' | 'neutral'

const TONE: Record<ChipTone, string> = {
  used:    'text-ok bg-ok/10 border-ok/20',
  extra:   'text-warn bg-warn/10 border-warn/20',
  missing: 'text-danger bg-danger/10 border-danger/20',
  neutral: 'text-inkSoft bg-paperAlt border-line',
}

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={`font-mono text-[11.5px] px-2.5 py-1 rounded-lg border ${TONE[tone]}`}>{children}</span>
  )
}
