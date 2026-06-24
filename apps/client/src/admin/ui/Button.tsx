// Design-system button (Claude Design canvas). Variants: primary / secondary / ghost / danger.
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-brand text-white shadow-card hover:bg-brand/90',
  secondary: 'bg-paper text-ink border border-lineStrong hover:bg-paperAlt',
  ghost:     'bg-transparent text-brand hover:bg-brand/10',
  danger:    'bg-paper text-danger border border-danger/30 hover:bg-danger/10',
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-[18px] py-2.5
                  text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  )
}
