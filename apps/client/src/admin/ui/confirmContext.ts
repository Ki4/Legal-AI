// Context + hook for the imperative confirm dialog. Kept separate from the provider component
// so the .tsx file can export only a component (react-refresh/only-export-components).
import { createContext, useContext } from 'react'
import type { ConfirmVariant } from './ConfirmModal'

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

export const ConfirmCtx = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
