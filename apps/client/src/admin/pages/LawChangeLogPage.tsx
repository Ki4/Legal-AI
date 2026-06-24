import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { ReviewItem } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  type LawChangeAction,
  type LawChangeLogRow,
  type ArticleDiffs,
  toLawChangeAction,
  toAiStatus,
  isPending,
  pendingCount,
  reviewActions,
  formatRevision,
  confidencePct,
  ACTION_META,
  SEVERITY_META,
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
      .select('id, law_slug, law_title, old_revision_date, new_revision_date, detected_at, detected_by, affected_services, action, reviewed_by, reviewed_at, notes, article_diffs, ai_summary, ai_impact, ai_confidence, ai_status, ai_model, ai_generated_at')
      .order('detected_at', { ascending: false })
      .then(({ data }) => {
        // Pre-migration-027 the select errors → data is null → graceful empty list (no crash).
        const list = (data ?? []).map((r) => ({
          ...r,
          action: toLawChangeAction(r.action),
          ai_status: toAiStatus(r.ai_status),
        })) as LawChangeLogRow[]
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
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink">Зміни законів</h1>
            <p className="text-inkSoft text-xs md:text-sm mt-1 hidden sm:block">
              Зафіксовані зміни відстежуваних законів. Переглянь і підтверди, що шаблони актуальні.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-inkSoft cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="accent-brand w-4 h-4"
            />
            <span>Лише очікують{pending > 0 && <span className="ml-1 text-warn font-semibold">({pending})</span>}</span>
          </label>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-paper border border-line rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && visible.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-ink mb-2">
              {onlyPending ? 'Немає змін, що очікують ревʼю' : 'Журнал змін порожній'}
            </h3>
            <p className="text-inkMute text-sm max-w-xs mx-auto">
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
              <LawChangeRow
                key={row.id}
                row={row}
                noteDraft={notesDraft[row.id] ?? row.notes ?? ''}
                onNoteChange={(text) => setNotesDraft((d) => ({ ...d, [row.id]: text }))}
                onReview={review}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

// ─── One law-change as a review-queue item ───────────────────────────────────
// Pending: revision + meta + affected services + AI draft + notes in the body, the review
// transitions (Переглянуто / Відхилити) as the explicit action row. Resolved (reviewed/
// dismissed): dims, collapses the detail behind «Показати», badge shows the actual outcome,
// «Повернути в очікування» re-opens it.
export function LawChangeRow({
  row, noteDraft, onNoteChange, onReview,
}: {
  row: LawChangeLogRow
  noteDraft: string
  onNoteChange: (text: string) => void
  onReview: (row: LawChangeLogRow, next: LawChangeAction) => void
}) {
  const resolved = !isPending(row.action)

  const actions = !resolved ? (
    <>
      {reviewActions(row.action).map((a) => (
        <button
          key={a.to}
          onClick={() => onReview(row, a.to)}
          className={a.variant === 'primary'
            ? 'inline-flex items-center text-[13px] font-medium text-white bg-brand rounded-[9px] px-3.5 py-1.5 hover:bg-brand/90 transition-colors'
            : 'text-[13px] font-medium text-inkSoft rounded-[9px] px-3 py-1.5 hover:bg-paperAlt hover:text-ink transition-colors'}
        >
          {a.label}
        </button>
      ))}
    </>
  ) : undefined

  return (
    <ReviewItem
      title={row.law_title || row.law_slug}
      timestamp={`🕓 ${formatDate(row.detected_at)}`}
      resolved={resolved}
      resolvedLabel={ACTION_META[row.action].label}
      resolvedTone={row.action === 'reviewed' ? 'ok' : 'neutral'}
      reopenLabel="Повернути в очікування"
      onReopen={resolved ? () => onReview(row, 'flagged') : undefined}
      actions={actions}
    >
      <div className="space-y-3 mb-3.5">
        {/* Revision */}
        <p className="text-inkMute text-xs font-mono">{formatRevision(row.old_revision_date, row.new_revision_date)}</p>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-inkMute">
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
            <span className="text-xs text-inkMute">Зачеплені послуги:</span>
            {row.affected_services.map((slug) => (
              <span key={slug} className="px-2 py-0.5 rounded-md bg-paperAlt text-inkSoft text-xs font-medium">
                {slug}
              </span>
            ))}
          </div>
        )}

        {/* AI draft (law-change-impact agent) — read-only; lawyer decides */}
        <AiDraftCard row={row} onInsert={onNoteChange} />

        {/* Notes */}
        <textarea
          value={noteDraft}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Нотатка ревʼю (необовʼязково)…"
          rows={2}
          className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink
                     placeholder:text-inkMute focus:outline-none focus:border-lineStrong resize-none"
        />

        {!resolved && row.affected_services.length > 0 && (
          <p className="text-xs text-inkMute">Після ревʼю активуй послуги на «Мої послуги»</p>
        )}
      </div>
    </ReviewItem>
  )
}

// ─── AI draft card (law-change-impact agent) ─────────────────────────────────
// Read-only. Shows the agent's PRELIMINARY "what changed + per-service impact" above the
// lawyer's notes. The lawyer decides — "Вставити в нотатку" only seeds the editable draft.
// Renders for drafted/abstained rows; pending/error rows show nothing here (just the diff).
function AiDraftCard({ row, onInsert }: { row: LawChangeLogRow; onInsert: (text: string) => void }) {
  if (row.ai_status !== 'drafted' && row.ai_status !== 'abstained') return null
  const abstained = row.ai_status === 'abstained'
  const pct = confidencePct(row.ai_confidence)
  const impact = row.ai_impact ?? []

  return (
    <div className="rounded-xl border border-line bg-canvas/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-inkSoft">
          🤖 {abstained ? 'AI утримався' : 'AI-чернетка'}
        </span>
        {!abstained && pct && (
          <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[11px] font-medium">
            впевненість {pct}
          </span>
        )}
      </div>

      {abstained ? (
        <p className="text-sm text-inkSoft">
          AI утримався від висновку — потрібен ручний аналіз. Нижче — точний текст змін.
        </p>
      ) : (
        <>
          {row.ai_summary && <p className="text-sm text-ink">{row.ai_summary}</p>}
          {impact.length > 0 && (
            <ul className="mt-2.5 space-y-2">
              {impact.map((it) => (
                <li key={it.slug} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_META[it.severity].dot}`} />
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{it.slug}</span>
                    <span className={`ml-1.5 ${SEVERITY_META[it.severity].text}`}>{SEVERITY_META[it.severity].label}</span>
                    {it.articles.length > 0 && (
                      <span className="ml-1.5 text-inkMute font-mono">ст. {it.articles.join(', ')}</span>
                    )}
                    {it.hypothesis && <span className="block text-inkSoft mt-0.5">{it.hypothesis}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {row.article_diffs && <DiffDetails diffs={row.article_diffs} />}

      <div className="flex flex-wrap items-center gap-3 mt-3">
        {!abstained && row.ai_summary && (
          <button
            onClick={() => onInsert(row.ai_summary as string)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-paperAlt text-inkSoft hover:bg-paperAlt"
          >
            Вставити в нотатку
          </button>
        )}
        <span className="text-[11px] text-inkMute">Попередня оцінка AI. Рішення — за юристом.</span>
      </div>
    </div>
  )
}

// Collapsible raw diff (ground truth) + a link to verify against the rada revision.
function DiffDetails({ diffs }: { diffs: ArticleDiffs }) {
  return (
    <details className="mt-2.5">
      <summary className="text-xs text-inkMute cursor-pointer select-none">
        Текст змін (diff){diffs.truncated ? ' · обрізано' : ''}
      </summary>
      <div className="mt-2 space-y-2">
        {diffs.source_url && (
          <a href={diffs.source_url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
            Звірити з редакцією rada ↗
          </a>
        )}
        {diffs.hunks.map((h, i) => (
          <div key={i} className="rounded-md bg-paper border border-line p-2 font-mono text-[11px] leading-snug overflow-x-auto">
            {h.article_num && <div className="text-inkMute mb-1">ст. {h.article_num}</div>}
            {h.removed.map((l, j) => <div key={`r${j}`} className="text-danger/80 whitespace-pre-wrap">− {l}</div>)}
            {h.added.map((l, j) => <div key={`a${j}`} className="text-ok/80 whitespace-pre-wrap">+ {l}</div>)}
          </div>
        ))}
      </div>
    </details>
  )
}
