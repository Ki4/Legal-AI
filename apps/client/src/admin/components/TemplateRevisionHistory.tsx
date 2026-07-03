import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { validateDraft } from '../lib/documentPreview'
import {
  listRevisions,
  restoreTemplate,
  type RevisionRow,
} from '../lib/serviceTemplate'
import { useConfirm } from '../ui'

/**
 * «Історія змін» (specs/features/template-editor §5): the service_revisions
 * archive for this service — every publish/restore left a snapshot here.
 * «Відновити» pushes a revision's template back through the SAME gated publish
 * flow (restoreTemplate: gate → snapshot(reason='restore') → set), so restoring
 * is as safe and as audited as publishing.
 */

const REASON_LABEL: Record<string, string> = {
  publish_template: 'Публікація шаблону',
  restore: 'Відновлення версії',
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TemplateRevisionHistory({
  serviceId,
  userId,
  refreshToken,
  onRestored,
}: {
  serviceId: string
  userId: string | null
  /** Bump to reload the list (the page increments it after each publish). */
  refreshToken: number
  onRestored: (template: string) => void
}) {
  const confirm = useConfirm()
  const [revisions, setRevisions] = useState<RevisionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    listRevisions(supabase, serviceId).then((r) => {
      if (cancelled) return
      setLoaded(true)
      if (r.ok) {
        setRevisions(r.revisions)
        setError(null)
      } else {
        setError(r.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [serviceId, refreshToken])

  async function handleRestore(rev: RevisionRow) {
    if (!supabase) return
    const okToRestore = await confirm({
      title: 'Відновити цю версію шаблону?',
      body: 'Чинна опублікована версія збережеться в історії — її можна буде повернути так само.',
      confirmLabel: 'Так, відновити',
      variant: 'warn',
    })
    if (!okToRestore) return

    setRestoringId(rev.id)
    const result = await restoreTemplate(
      { supabase, validate: validateDraft },
      { serviceId, revision: rev, userId },
    )
    setRestoringId(null)
    if (result.ok && result.template !== undefined) {
      setError(null)
      onRestored(result.template)
    } else if (!result.ok) {
      setError(result.error)
    }
  }

  // Nothing to show for a service that was never published — no empty chrome.
  if (loaded && !error && revisions.length === 0) return null

  return (
    <details className="flex-shrink-0">
      <summary className="text-sm font-semibold text-ink cursor-pointer select-none">
        Історія змін{loaded && !error ? ` (${revisions.length})` : ''}
      </summary>
      <div className="mt-2 space-y-1.5">
        <p className="text-xs text-inkMute">
          Знімки послуги перед кожною публікацією чи відновленням. «Відновити» повертає шаблон цієї
          версії у чернетку та публікує його.
        </p>
        {error && (
          <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {revisions.map((rev) => (
          <div
            key={rev.id}
            className="flex items-center gap-3 bg-paperAlt border border-line rounded-xl px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink font-medium">
                {REASON_LABEL[rev.reason] ?? rev.reason}
              </span>
              <span className="block text-[11px] text-inkMute">{formatWhen(rev.created_at)}</span>
            </div>
            <button
              type="button"
              onClick={() => handleRestore(rev)}
              disabled={restoringId !== null}
              className="px-3 py-1.5 text-xs font-semibold text-ink bg-paper hover:bg-paper/70
                         border border-lineStrong rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {restoringId === rev.id ? 'Відновлюю…' : 'Відновити'}
            </button>
          </div>
        ))}
      </div>
    </details>
  )
}
