import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  type LawChangeAction,
  type LawChangeLogRow,
  toLawChangeAction,
  isPending,
  pendingCount,
  reviewActions,
  formatRevision,
  ACTION_META,
  DETECTED_BY_LABEL,
} from '../../lib/lawChangeLog'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uk-UA')
}

export function LawChangeLogPage() {
  const [rows, setRows]       = useState<LawChangeLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyPending, setOnlyPending] = useState(true)
  const [notesDraft, setNotesDraft]   = useState<Record<number, string>>({})
  const { user } = useAuth()

  useEffect(() => {
    if (!supabase || !user) return
    supabase
      .from('law_change_log')
      .select('id, law_slug, law_title, old_revision_date, new_revision_date, detected_at, detected_by, affected_services, action, reviewed_by, reviewed_at, notes')
      .order('detected_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []).map((r) => ({ ...r, action: toLawChangeAction(r.action) })) as LawChangeLogRow[]
        setRows(list)
        setLoading(false)
      })
  }, [user])

  const visible = useMemo(
    () => (onlyPending ? rows.filter((r) => isPending(r.action)) : rows),
    [rows, onlyPending],
  )
  const pending = pendingCount(rows)

  async function review(row: LawChangeLogRow, next: LawChangeAction) {
    if (!supabase) return
    const resolved = next !== 'flagged'
    const patch = {
      action: next,
      notes: (notesDraft[row.id] ?? row.notes ?? '') || null,
      // Stamp who/when on resolve; clear the trace when re-opening to pending.
      reviewed_by: resolved ? (user?.email ?? 'lawyer') : null,
      reviewed_at: resolved ? new Date().toISOString() : null,
    }
    await supabase.from('law_change_log').update(patch).eq('id', row.id)
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Зміни законів</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 hidden sm:block">
              Зафіксовані зміни відстежуваних законів. Переглянь і підтверди, що шаблони актуальні.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            <span>Лише очікують{pending > 0 && <span className="ml-1 text-amber-400 font-semibold">({pending})</span>}</span>
          </label>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && visible.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {onlyPending ? 'Немає змін, що очікують ревʼю' : 'Журнал змін порожній'}
            </h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              {onlyPending
                ? 'Усі зафіксовані зміни законів переглянуто.'
                : 'Зміни зʼявляться тут, коли буде зафіксовано оновлення відстежуваного закону.'}
            </p>
          </div>
        )}

        {/* List */}
        {!loading && visible.length > 0 && (
          <div className="space-y-3">
            {visible.map((row) => (
              <div
                key={row.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3"
              >
                {/* Top: law + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm">{row.law_title || row.law_slug}</h3>
                    <p className="text-slate-500 text-xs mt-0.5 font-mono">{formatRevision(row.old_revision_date, row.new_revision_date)}</p>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 ${ACTION_META[row.action].badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${ACTION_META[row.action].dot}`} />
                    {ACTION_META[row.action].label}
                  </span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>🕓 {formatDate(row.detected_at)}</span>
                  <span>•</span>
                  <span>{DETECTED_BY_LABEL[row.detected_by] ?? row.detected_by}</span>
                  {row.reviewed_by && (
                    <>
                      <span>•</span>
                      <span>✅ {row.reviewed_by}, {formatDate(row.reviewed_at)}</span>
                    </>
                  )}
                </div>

                {/* Affected services */}
                {row.affected_services.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500">Зачеплені послуги:</span>
                    {row.affected_services.map((slug) => (
                      <span
                        key={slug}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-medium"
                      >
                        {slug}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <textarea
                  value={notesDraft[row.id] ?? row.notes ?? ''}
                  onChange={(e) => setNotesDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                  placeholder="Нотатка ревʼю (необовʼязково)…"
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200
                             placeholder:text-slate-600 focus:outline-none focus:border-slate-600 resize-none"
                />

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                  {reviewActions(row.action).map((action) => (
                    <button
                      key={action.to}
                      onClick={() => review(row, action.to)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                        ${action.variant === 'primary'
                          ? 'bg-blue-600/15 text-blue-400 hover:bg-blue-600/25'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      {action.label}
                    </button>
                  ))}
                  {isPending(row.action) && row.affected_services.length > 0 && (
                    <span className="text-xs text-slate-600 ml-auto">
                      Після ревʼю активуй послуги на «Мої послуги»
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
