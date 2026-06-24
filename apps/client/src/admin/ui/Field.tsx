// Form primitives (Claude Design canvas) — label + input + textarea with the soft focus ring.
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <label className={`block text-[12.5px] font-semibold text-inkSoft mb-1.5 ${className}`}>{children}</label>
}

const FIELD =
  'w-full bg-paper border border-lineStrong rounded-[10px] px-3.5 py-2.5 text-sm text-ink ' +
  'placeholder-inkMute focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} resize-none ${className}`} {...rest} />
}
