// Surface card + section label (Claude Design canvas).
import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`bg-paper border border-line rounded-2xl shadow-card ${className}`}>{children}</div>
}

export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-xs font-semibold tracking-[0.08em] uppercase text-inkMute ${className}`}>{children}</div>
  )
}
