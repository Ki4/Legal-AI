import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface ServiceNote {
  id: number
  service_slug: string
  author_email: string | null
  body: string
  status: 'open' | 'done'
  created_at: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Per-service lawyer feedback panel (service-mirror slice 2).
 * The lawyer writes "що добре / погано / незручно"; the dev reads + resolves.
 */
export function ServiceNotes({ serviceSlug, authorEmail }: { serviceSlug: string; authorEmail?: string | null }) {
  const [notes, setNotes] = useState<ServiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase
      .from('service_notes')
      .select('*')
      .eq('service_slug', serviceSlug)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else setNotes((data ?? []) as ServiceNote[])
        setLoading(false)
      })
  }, [serviceSlug])

  async function add() {
    const text = body.trim()
    if (!text || !supabase) return
    setSaving(true)
    setErr(null)
    const { data, error } = await supabase
      .from('service_notes')
      .insert({ service_slug: serviceSlug, author_email: authorEmail ?? null, body: text })
      .select()
      .single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setNotes((prev) => [data as ServiceNote, ...prev])
    setBody('')
  }

  async function toggle(note: ServiceNote) {
    if (!supabase) return
    const next = note.status === 'open' ? 'done' : 'open'
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, status: next } : n)))
    await supabase.from('service_notes').update({ status: next }).eq('id', note.id)
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6">
      <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-1">💬 Коментарі юриста</h2>
      <p className="text-xs text-slate-500 mb-4">Що добре, що погано, чого бракує — для розробника.</p>

      {/* Composer */}
      <div className="mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Напр.: бракує поля «дата шлюбу» у формі…"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200
                     placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          {err ? <span className="text-xs text-red-400">{err}</span> : <span />}
          <button
            onClick={add}
            disabled={saving || !body.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Додаю…' : 'Додати'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading && <div className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />}
      {!loading && notes.length === 0 && (
        <p className="text-xs text-slate-600">Ще немає коментарів.</p>
      )}
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className={`px-3 py-2.5 rounded-xl border ${n.status === 'done' ? 'bg-slate-950/40 border-slate-800/60 opacity-60' : 'bg-slate-800/50 border-slate-800'}`}>
            <div className={`text-sm whitespace-pre-wrap break-words ${n.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>{n.body}</div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
              <span>{n.author_email ?? 'юрист'}</span>
              <span>•</span>
              <span>{fmtDate(n.created_at)}</span>
              <div className="flex-1" />
              <button
                onClick={() => toggle(n)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {n.status === 'open' ? '✓ Вирішено' : '↩ Відкрити'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
