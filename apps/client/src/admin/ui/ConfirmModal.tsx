// Design-system confirmation dialog (Claude Design canvas). Replaces native window.confirm
// across the admin so destructive/irreversible actions get a consistent, on-brand prompt.
// Presentational: state + promise wiring live in ./useConfirm (ConfirmProvider).
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'

export type ConfirmVariant = 'danger' | 'warn' | 'info'

export interface ConfirmModalProps {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_META: Record<ConfirmVariant, { iconWrap: string; btn: ButtonVariant; Icon: typeof AlertTriangle }> = {
  danger: { iconWrap: 'bg-danger/10 text-danger', btn: 'danger',  Icon: AlertTriangle },
  warn:   { iconWrap: 'bg-warn/10 text-warn',     btn: 'primary', Icon: AlertTriangle },
  info:   { iconWrap: 'bg-brand/10 text-brand',   btn: 'primary', Icon: Info },
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const meta = VARIANT_META[variant]

  // Focus the confirm button on open; Esc cancels. Keeps keyboard flow sane
  // without a full focus-trap library (Tier 1 scope).
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // Render nothing when closed — no lingering full-screen overlay to intercept clicks.
  // (Enter animation only; instant dismiss is standard for a confirm dialog and avoids
  // AnimatePresence exit-timing pitfalls that can leave an invisible pointer-blocking overlay.)
  if (!open) return null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
    >
      {/* Backdrop — click cancels */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Dialog */}
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-md bg-paper border border-line rounded-t-2xl sm:rounded-2xl shadow-card-hover p-6"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center ${meta.iconWrap}`}>
            <meta.Icon size={22} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h2 className="text-[16px] font-semibold text-ink leading-snug">{title}</h2>
            {body && <p className="text-[13.5px] text-inkSoft leading-relaxed mt-1.5">{body}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button ref={confirmRef} variant={meta.btn} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
