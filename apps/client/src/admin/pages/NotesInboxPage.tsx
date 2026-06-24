import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { ReviewItem } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { ServiceNote } from '../components/ServiceNotes'

interface ServiceRef { id: string; slug: string; title: string }

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * One comment as a review-queue item. The service it's about is the title (tap «Відкрити
 * послугу»), the comment is the body, author + date the byline. «Позначити вирішеним» is an
 * explicit button (via ReviewItem) — fixes the session-42 «✓ Вирішено reads like a badge» debt.
 */
export function NoteRow({
  note, service, onToggle, onOpen,
}: {
  note: ServiceNote
  service?: ServiceRef
  onToggle: (n: ServiceNote) => void
  onOpen?: (serviceId: string) => void
}) {
  const resolved = note.status === 'done'
  return (
    <ReviewItem
      title={service?.title ?? note.service_slug}
      timestamp={`${note.author_email ?? 'юрист'} · ${fmtDate(note.created_at)}`}
      body={note.body}
      resolved={resolved}
      openLabel="Відкрити послугу"
      onResolve={() => onToggle(note)}
      onReopen={() => onToggle(note)}
      onOpen={service && onOpen ? () => onOpen(service.slug) : undefined}
    />
  )
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

        {loading && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-paper border border-line rounded-xl animate-pulse" />)}</div>}

        {!loading && visible.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-lg font-semibold text-ink mb-2">{onlyOpen ? 'Немає відкритих коментарів' : 'Коментарів ще немає'}</h3>
            <p className="text-inkMute text-sm">Юрист залишає їх на сторінці перегляду послуги.</p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              service={services[n.service_slug]}
              onToggle={toggle}
              onOpen={(id) => navigate(`/services/${id}`)}
            />
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
