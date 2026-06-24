// Zone-anchored comments over the service mirror (migration 028).
// Toggle the floating button → drag a rectangle over any part of the page → write a note.
// The note pins to that zone (fractions of the content box) and re-renders as a marker the
// reviewer can reopen and resolve. Mounts as an absolute overlay inside a `relative` parent;
// the highlight boxes are visual-only (pointer-events:none) so they never block the page —
// only the small markers, the composer, and (while adding) the capture surface take clicks.
import { useEffect, useRef, useState } from 'react'
import { MessageSquarePlus, X, Check, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ServiceNote } from './ServiceNotes'
import { rectToAnchor, isMeaningfulAnchor, anchorStyle, type CommentAnchor } from '../../lib/commentAnchor'

interface Pt { x: number; y: number }

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CommentLayer({ serviceSlug, authorEmail }: { serviceSlug: string; authorEmail?: string | null }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<ServiceNote[]>([])
  const [mode, setMode] = useState(false)            // adding a zone?
  const [start, setStart] = useState<Pt | null>(null) // drag origin (px in overlay box)
  const [dragBox, setDragBox] = useState<CommentAnchor | null>(null) // live drag preview (fractions)
  const [draft, setDraft] = useState<CommentAnchor | null>(null) // finished zone, composing
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState<number | null>(null) // opened existing marker
  const [err, setErr] = useState<string | null>(null)

  // Load this service's pinned notes.
  useEffect(() => {
    if (!supabase) return
    supabase.from('service_notes').select('*').eq('service_slug', serviceSlug).not('anchor', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data ?? []) as ServiceNote[]))
  }, [serviceSlug])

  // Track the drag on the window so it keeps working past the capture surface / while scrolling.
  // Reading the ref is fine here — these run in event callbacks, not during render.
  useEffect(() => {
    if (!start) return
    const anchorAt = (e: MouseEvent): CommentAnchor | null => {
      const r = overlayRef.current?.getBoundingClientRect()
      return r ? rectToAnchor(start.x, start.y, e.clientX - r.left, e.clientY - r.top, r.width, r.height) : null
    }
    const move = (e: MouseEvent) => { const a = anchorAt(e); if (a) setDragBox(a) }
    const up = (e: MouseEvent) => {
      const a = anchorAt(e)
      if (a && isMeaningfulAnchor(a)) { setDraft(a); setBody(''); setErr(null) }
      setStart(null); setDragBox(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [start])

  function beginDrag(e: React.MouseEvent) {
    const r = overlayRef.current?.getBoundingClientRect()
    if (!r) return
    e.preventDefault()
    setActive(null)
    setStart({ x: e.clientX - r.left, y: e.clientY - r.top })
    setDragBox(null)
  }

  async function save() {
    const text = body.trim()
    if (!text || !draft) return
    setSaving(true); setErr(null)
    if (!supabase) { // preview / offline — keep it local so the UI still demoes
      setNotes((p) => [{ id: -Date.now(), service_slug: serviceSlug, author_email: authorEmail ?? null, body: text, status: 'open', created_at: new Date().toISOString(), anchor: draft }, ...p])
      setSaving(false); setDraft(null); setBody(''); setMode(false); return
    }
    const { data, error } = await supabase.from('service_notes')
      .insert({ service_slug: serviceSlug, author_email: authorEmail ?? null, body: text, anchor: draft })
      .select().single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setNotes((p) => [data as ServiceNote, ...p])
    setDraft(null); setBody(''); setMode(false)
  }

  async function toggleStatus(n: ServiceNote) {
    const next = n.status === 'open' ? 'done' : 'open'
    setNotes((p) => p.map((x) => (x.id === n.id ? { ...x, status: next } : x)))
    if (supabase) await supabase.from('service_notes').update({ status: next }).eq('id', n.id)
  }

  const cancelDraft = () => { setDraft(null); setBody(''); setErr(null) }
  const activeNote = notes.find((n) => n.id === active) ?? null

  return (
    <>
      {/* Overlay — pointer-events:none so the page stays usable; children opt back in. */}
      <div ref={overlayRef} className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {/* Capture surface — only while adding; sits under the markers so existing ones stay clickable. */}
        {mode && !draft && (
          <div onMouseDown={beginDrag}
               className="absolute inset-0 pointer-events-auto cursor-crosshair bg-brand/[0.03]" />
        )}

        {/* Live drag preview */}
        {dragBox && (
          <div className="absolute border-2 border-dashed border-brand bg-brand/10 rounded" style={anchorStyle(dragBox)} />
        )}

        {/* Existing zones — highlight is visual-only; the numbered marker takes the click. */}
        {notes.map((n, i) => n.anchor ? (
          <div key={n.id} className="absolute" style={anchorStyle(n.anchor)}>
            <div className={`w-full h-full rounded ${n.status === 'done' ? 'border border-line/70 bg-ink/[0.02]' : 'border-2 border-warn/50 bg-warn/10'}`} />
            <button
              onClick={() => setActive((cur) => (cur === n.id ? null : n.id))}
              className={`pointer-events-auto absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full text-[11px] font-bold text-white shadow flex items-center justify-center
                          ${n.status === 'done' ? 'bg-inkMute' : 'bg-warn'} hover:scale-110 transition-transform`}
              title="Коментар">
              {n.status === 'done' ? '✓' : i + 1}
            </button>
          </div>
        ) : null)}

        {/* Draft composer — anchored under the freshly drawn zone */}
        {draft && (
          <div className="pointer-events-auto absolute z-30 w-[280px] max-w-[90%] bg-paper border border-line rounded-xl shadow-lg p-3"
               style={{ left: `min(${draft.x * 100}%, calc(100% - 290px))`, top: `calc(${(draft.y + draft.h) * 100}% + 8px)` }}>
            <div className="text-[12px] font-semibold text-ink mb-1.5">Коментар до зони</div>
            <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                      placeholder="Що тут не так?"
                      className="w-full bg-canvas border border-line rounded-lg px-2.5 py-2 text-sm text-ink placeholder:text-inkMute focus:outline-none focus:border-brand resize-none" />
            {err && <div className="text-[11px] text-danger mt-1">{err}</div>}
            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={cancelDraft} className="px-2.5 py-1 text-xs text-inkSoft hover:text-ink">Скасувати</button>
              <button onClick={save} disabled={saving || !body.trim()}
                      className="px-3 py-1 bg-brand hover:bg-brand/90 disabled:opacity-40 text-white text-xs font-semibold rounded-lg">
                {saving ? 'Зберігаю…' : 'Зберегти'}
              </button>
            </div>
          </div>
        )}

        {/* Opened existing comment */}
        {activeNote && activeNote.anchor && (
          <div className="pointer-events-auto absolute z-30 w-[280px] max-w-[90%] bg-paper border border-line rounded-xl shadow-lg p-3"
               style={{ left: `min(${activeNote.anchor.x * 100}%, calc(100% - 290px))`, top: `calc(${(activeNote.anchor.y + activeNote.anchor.h) * 100}% + 8px)` }}>
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-ink whitespace-pre-wrap break-words">{activeNote.body}</p>
              <button onClick={() => setActive(null)} className="text-inkMute hover:text-ink flex-shrink-0"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[11px] text-inkMute">
              <span>{activeNote.author_email ?? 'юрист'}</span><span>•</span><span>{fmtDate(activeNote.created_at)}</span>
              <div className="flex-1" />
              <button onClick={() => toggleStatus(activeNote)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-paperAlt hover:bg-paperAlt text-inkSoft">
                {activeNote.status === 'open' ? <><Check size={12} /> Вирішено</> : <><RotateCcw size={12} /> Відкрити</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating toggle — fixed to the viewport, above everything. */}
      <button
        onClick={() => { setMode((m) => !m); cancelDraft(); setActive(null) }}
        className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold transition-colors
                    ${mode ? 'bg-ink text-white hover:bg-ink/90' : 'bg-brand text-white hover:bg-brand/90'}`}>
        {mode ? <><X size={16} /> Завершити</> : <><MessageSquarePlus size={16} /> Залишити коментар</>}
      </button>
      {mode && !draft && (
        <div className="fixed bottom-[4.75rem] right-6 z-50 px-3 py-1.5 bg-ink/90 text-white text-xs rounded-lg shadow">
          Виділи зону на сторінці
        </div>
      )}
    </>
  )
}
