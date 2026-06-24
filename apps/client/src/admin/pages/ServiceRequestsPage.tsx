import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminLayout } from '../components/AdminLayout'
import { ReviewItem } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  validateExampleFile,
  buildExamplePath,
} from '../../lib/serviceRequestFile'

const BUCKET = 'service-examples'

interface ServiceRequest {
  id: number
  title: string
  description: string | null
  laws_text: string | null
  example_file_path: string | null
  status: 'open' | 'done'
  requested_by_email: string | null
  created_at: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function uniqueId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 12)
}

/**
 * One service request as a review-queue item: requested service is the title, description the
 * body, the laws + the example document (the actual brief for a future template) live in the
 * ReviewItem children. "Позначити вирішеним" is an explicit button (via ReviewItem).
 */
export function RequestRow({
  req, onToggle, onOpenExample,
}: {
  req: ServiceRequest
  onToggle: (r: ServiceRequest) => void
  onOpenExample: (path: string) => void
}) {
  const extras = (req.laws_text || req.example_file_path) ? (
    <div className="space-y-2 mb-3.5">
      {req.laws_text && (
        <p className="text-xs text-inkSoft whitespace-pre-wrap break-words">
          <span className="text-inkMute">Закони: </span>{req.laws_text}
        </p>
      )}
      {req.example_file_path && (
        <button
          onClick={() => onOpenExample(req.example_file_path!)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand bg-brand/10 hover:bg-brand/20 rounded-lg px-2.5 py-1 transition-colors"
        >
          📄 Приклад документа
        </button>
      )}
    </div>
  ) : null

  return (
    <ReviewItem
      title={req.title}
      timestamp={`${req.requested_by_email ?? 'юрист'} · ${fmtDate(req.created_at)}`}
      body={req.description ?? undefined}
      resolved={req.status === 'done'}
      onResolve={() => onToggle(req)}
      onReopen={() => onToggle(req)}
    >
      {extras}
    </ReviewItem>
  )
}

/**
 * Lawyer files a request for a NEW service (title + laws + an example document),
 * the dev reads the inbox (service-mirror slice 3, #66). One page: composer + list.
 */
export function ServiceRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyOpen, setOnlyOpen] = useState(true)

  // Composer state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lawsText, setLawsText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return }
    supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else setRequests((data ?? []) as ServiceRequest[])
        setLoading(false)
      })
  }, [user])

  const visible = useMemo(() => onlyOpen ? requests.filter((r) => r.status === 'open') : requests, [requests, onlyOpen])
  const openCount = useMemo(() => requests.filter((r) => r.status === 'open').length, [requests])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)
    const f = e.target.files?.[0] ?? null
    if (f) {
      const msg = validateExampleFile(f)
      if (msg) { setErr(msg); e.target.value = ''; setFile(null); return }
    }
    setFile(f)
  }

  function resetComposer() {
    setTitle(''); setDescription(''); setLawsText(''); setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function submit() {
    const t = title.trim()
    if (!t || !supabase) return
    setSaving(true)
    setErr(null)

    let path: string | null = null
    if (file) {
      const key = buildExamplePath(file.name, uniqueId())
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: false })
      if (upErr) { setErr(`Не вдалося завантажити файл: ${upErr.message}`); setSaving(false); return }
      path = key
    }

    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        title: t,
        description: description.trim() || null,
        laws_text: lawsText.trim() || null,
        example_file_path: path,
        requested_by_email: user?.email ?? null,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { setErr(error.message); return }
    setRequests((prev) => [data as ServiceRequest, ...prev])
    resetComposer()
  }

  async function toggle(req: ServiceRequest) {
    if (!supabase) return
    const next = req.status === 'open' ? 'done' : 'open'
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: next } : r)))
    await supabase.from('service_requests').update({ status: next }).eq('id', req.id)
  }

  async function openExample(path: string) {
    if (!supabase) return
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (error || !data) { setErr(error?.message ?? 'Не вдалося відкрити файл'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink">Заявки на послугу</h1>
            <p className="text-inkSoft text-xs md:text-sm mt-1 hidden sm:block">Замовте нову послугу й додайте приклад документа.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-inkSoft cursor-pointer select-none">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-brand w-4 h-4" />
            <span>Лише відкриті{openCount > 0 && <span className="ml-1 text-warn font-semibold">({openCount})</span>}</span>
          </label>
        </div>

        {/* Composer */}
        <section className="bg-paper border border-line rounded-2xl p-5 md:p-6 mb-6">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wide mb-1">➕ Нова заявка</h2>
          <p className="text-xs text-inkMute mb-4">Що за послуга, на яких законах тримається, і приклад готового документа.</p>

          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Назва послуги (напр.: Поділ майна подружжя)"
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-inkMute focus:outline-none focus:border-brand"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Опис: кому потрібно, у якій ситуації…"
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-inkMute focus:outline-none focus:border-brand resize-none"
            />
            <textarea
              value={lawsText}
              onChange={(e) => setLawsText(e.target.value)}
              rows={2}
              placeholder="Закони / статті (напр.: ст. 60, 70 СК; посилання на zakon.rada)…"
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-inkMute focus:outline-none focus:border-brand resize-none"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="px-3 py-1.5 bg-paperAlt hover:bg-paperAlt text-ink text-sm font-medium rounded-lg cursor-pointer transition-colors">
                📎 Приклад документа
                <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={pickFile} className="hidden" />
              </label>
              {file && <span className="text-xs text-inkSoft truncate max-w-[12rem]">{file.name}</span>}
              <span className="text-[11px] text-inkMute">PDF або DOC/DOCX, до 10 МБ</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              {err ? <span className="text-xs text-danger">{err}</span> : <span />}
              <button
                onClick={submit}
                disabled={saving || !title.trim()}
                className="px-4 py-1.5 bg-brand hover:bg-brand/90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Надсилаю…' : 'Надіслати заявку'}
              </button>
            </div>
          </div>
        </section>

        {/* Inbox */}
        {loading && <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-24 bg-paper border border-line rounded-2xl animate-pulse" />)}</div>}

        {!loading && visible.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-ink mb-2">{onlyOpen ? 'Немає відкритих заявок' : 'Заявок ще немає'}</h3>
            <p className="text-inkMute text-sm">Заповніть форму вище, щоб замовити нову послугу.</p>
          </div>
        )}

        <div className="space-y-3">
          {visible.map((r) => (
            <RequestRow key={r.id} req={r} onToggle={toggle} onOpenExample={openExample} />
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
