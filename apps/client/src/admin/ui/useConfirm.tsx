// Imperative confirmation dialog for the admin. Mount <ConfirmProvider> once near the
// router root, then `const confirm = useConfirm()` anywhere below and `await confirm({...})`
// resolves true/false. Replaces native window.confirm with a design-system ConfirmModal.
// The hook + context live in ./confirmContext (this file exports only the component).
import { useCallback, useRef, useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { ConfirmCtx, type ConfirmFn, type ConfirmOptions } from './confirmContext'

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((result: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    setOpts(next)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }, [])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <ConfirmModal
        open={opts !== null}
        title={opts?.title ?? ''}
        body={opts?.body}
        confirmLabel={opts?.confirmLabel}
        cancelLabel={opts?.cancelLabel}
        variant={opts?.variant ?? 'info'}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmCtx.Provider>
  )
}
