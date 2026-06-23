import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { ServiceNote } from '../components/ServiceNotes'

interface ServiceRef { id: string; slug: string; title: string }

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Dev inbox — all lawyer feedback across services (service-mirror slice 2). */
export function NotesInboxPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<ServiceNote[]>([])
  const [services, setServices] = useState<Record<string, ServiceRef>>({})
  const [loading, setLoading] = useState(true)
  const [onlyOpen, setOnlyOpen] = useState(true)

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('services').select('id, slug, title').then(({ data }) => {
      const map: Record<string, ServiceRef> = {}
      for (const s of (data ?? []) as ServiceRef[]) map[s.slug] = s
      setServices(map)
    })
    supabase.from('service_notes').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setNotes((data ?? []) as ServiceNote[])
      setLoading(false)
    })
  }, [user])

  const visible = useMemo(() => onlyOpen ? notes.filter((n) => n.status === 'open') : notes, [notes, onlyOpen])
  const openCount = useMemo(() => notes.filter((n) => n.status === 'open').length, [notes])

  async function toggle(note: ServiceNote) {
    if (!supabase) return
    const next = note.status === 'open' ? 'done' : 'open'
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, status: next } : n)))
    await supabase.from('service_notes').update({ status: next }).eq('id', note.id)
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink">Коментарі</h1>
            <p className="text-inkSoft text-xs md:text-sm mt-1 hidden sm:block">Фідбек юриста по всіх послугах.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-inkSoft cursor-pointer select-none">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-brand w-4 h-4" />
            <span>Лише відкриті{openCount > 0 && <span className="ml-1 text-warn font-semibold">({openCount})</span>}</span>
          </label>
        </div>

        {loading && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-paper border border-line rounded-2xl animate-pulse" />)}</div>}

        {!loading && visible.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-ink mb-2">{onlyOpen ? 'Немає відкритих коментарів' : 'Коментарів ще немає'}</h3>
            <p className="text-inkMute text-sm">Юрист залишає їх на сторінці перегляду послуги.</p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map((n) => {
            const svc = services[n.service_slug]
            return (
              <div key={n.id} className={`bg-paper border border-line rounded-2xl p-4 ${n.status === 'done' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => svc && navigate(`/services/${svc.id}`)}
                    className="text-xs font-semibold text-brand hover:text-brand"
                  >
                    {svc?.title ?? n.service_slug} →
                  </button>
                </div>
                <div className={`text-sm whitespace-pre-wrap break-words ${n.status === 'done' ? 'line-through text-inkMute' : 'text-ink'}`}>{n.body}</div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-inkMute">
                  <span>{n.author_email ?? 'юрист'}</span>
                  <span>•</span>
                  <span>{fmtDate(n.created_at)}</span>
                  <div className="flex-1" />
                  <button onClick={() => toggle(n)} className="px-2 py-0.5 rounded-md bg-paperAlt hover:bg-paperAlt text-inkSoft transition-colors">
                    {n.status === 'open' ? '✓ Вирішено' : '↩ Відкрити'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
