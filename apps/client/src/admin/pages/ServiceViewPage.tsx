import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Pencil, ChevronDown } from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { ServiceNotes } from '../components/ServiceNotes'
import { Card, SectionLabel, Chip, Button, Badge, type BadgeTone, type ChipTone } from '../ui'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { FormConfig, FormField } from '../../types/form'
import { type ServiceStatus, toServiceStatus, STATUS_META } from '../../lib/serviceStatus'
import {
  analyzeTemplate,
  diffFormVsTemplate,
  collectBrokenShowIf,
  collectEmptyLabelFields,
  describeShowIf,
  serviceHealth,
  fieldTypeLabel,
  lawCodeFromUrl,
  type FieldDiff,
  type ServiceHealth,
} from '../../lib/serviceAnatomy'

interface ServiceRow {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  price: number | null
  status: ServiceStatus
  generation_mode: string | null
  document_template: string | null
  form_config: FormConfig | null
}

const HEALTH_UI: Record<ServiceHealth['level'], { dot: string; text: string; label: string }> = {
  green: { dot: 'bg-ok',     text: 'text-ok',     label: 'Готова' },
  amber: { dot: 'bg-warn',   text: 'text-warn',   label: 'Є зауваження' },
  red:   { dot: 'bg-danger', text: 'text-danger', label: 'Потребує уваги' },
}

// services.status → design-system Badge tone (STATUS_META colours predate the tokens).
const STATUS_TONE: Record<ServiceStatus, BadgeTone> = {
  active: 'ok', needs_review: 'warn', disabled: 'neutral',
}

function emptyConfig(): FormConfig {
  return { service_id: '', title: '', tabs: [], steps: [] }
}

export function ServiceViewPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [svc, setSvc] = useState<ServiceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staleCodes, setStaleCodes] = useState<Set<string>>(new Set())
  const [pendingChanges, setPendingChanges] = useState<{ law_title: string }[]>([])

  useEffect(() => {
    if (!supabase || !user || !slug) return
    supabase
      .from('services')
      .select('id, slug, title, description, icon, price, status, generation_mode, document_template, form_config')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return }
        setSvc({ ...data, status: toServiceStatus(data.status) } as ServiceRow)
        setLoading(false)
      })
  }, [slug, user])

  const analysis = useMemo(() => analyzeTemplate(svc?.document_template ?? ''), [svc?.document_template])

  // Stale / changed legal citations (G3): law_chunks.is_stale + pending law_change_log.
  useEffect(() => {
    if (!supabase || !svc) return
    const codes = [...new Set(analysis.citations.map((l) => lawCodeFromUrl(l.url)))]
    if (codes.length) {
      supabase.from('law_chunks').select('law_code').eq('is_stale', true).in('law_code', codes)
        .then(({ data }) => setStaleCodes(new Set((data ?? []).map((r) => r.law_code as string))))
    }
    supabase.from('law_change_log').select('law_title').eq('action', 'flagged').contains('affected_services', [svc.slug])
      .then(({ data }) => setPendingChanges((data ?? []) as { law_title: string }[]))
  }, [svc, analysis])

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-4">
          <div className="h-10 bg-paper border border-line rounded-xl animate-pulse" />
          <div className="h-44 bg-paper border border-line rounded-2xl animate-pulse" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !svc) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-24 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-ink mb-2">Послугу не знайдено</h3>
          <p className="text-inkMute text-sm mb-6">{error ?? 'Спробуйте повернутися до каталогу.'}</p>
          <Button variant="primary" onClick={() => navigate('/services')}>← До каталогу</Button>
        </div>
      </AdminLayout>
    )
  }

  return (
    <ServiceViewBody
      svc={svc}
      analysis={analysis}
      staleCodes={staleCodes}
      pendingChanges={pendingChanges}
      authorEmail={user?.email}
    />
  )
}

// ── Presentational body (pure: no data fetching) — also rendered in the design preview ────
export function ServiceViewBody({
  svc, analysis, staleCodes, pendingChanges, authorEmail,
}: {
  svc: ServiceRow
  analysis: ReturnType<typeof analyzeTemplate>
  staleCodes: Set<string>
  pendingChanges: { law_title: string }[]
  authorEmail?: string | null
}) {
  const navigate = useNavigate()
  const form = svc.form_config && Array.isArray(svc.form_config.steps) ? svc.form_config : emptyConfig()
  const diff: FieldDiff = useMemo(() => diffFormVsTemplate(form, analysis), [form, analysis])
  const brokenShowIf = useMemo(() => collectBrokenShowIf(form), [form])
  const emptyLabels = useMemo(() => collectEmptyLabelFields(form), [form])

  const staleCitations = useMemo(() => {
    const labels = new Set<string>()
    for (const law of analysis.citations) if (staleCodes.has(lawCodeFromUrl(law.url))) labels.add(law.title)
    for (const c of pendingChanges) labels.add(c.law_title)
    return [...labels]
  }, [analysis.citations, staleCodes, pendingChanges])

  const health = useMemo(() => serviceHealth({
    generationMode: svc.generation_mode ?? null,
    hasTemplate: analysis.hasTemplate,
    diff,
    brokenShowIf,
    emptyLabelFields: emptyLabels,
    staleCitations,
  }), [svc.generation_mode, analysis.hasTemplate, diff, brokenShowIf, emptyLabels, staleCitations])

  const hi = HEALTH_UI[health.level]
  const fieldsByTab = (tab: string): FormField[] => form.steps.filter((s) => s.tab === tab)

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/services')}
                  className="inline-flex items-center gap-1.5 text-inkSoft hover:text-ink text-sm flex-shrink-0">
            <ArrowLeft size={16} strokeWidth={1.8} /> Назад
          </button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => window.open(`/?service=${svc.slug}`, '_blank', 'noopener')}>
            <Eye size={16} strokeWidth={1.7} /> Форма клієнта
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/services/${svc.id}/edit`)}>
            <Pencil size={15} strokeWidth={1.7} /> Редагувати
          </Button>
        </div>

        {/* Header card: identity + health + technical details */}
        <Card className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-paperAlt flex items-center justify-center text-2xl flex-shrink-0">
              {svc.icon || '⚖️'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg md:text-xl font-bold text-ink">{svc.title || 'Без назви'}</h1>
                <Badge tone={STATUS_TONE[svc.status]} className="flex-shrink-0">{STATUS_META[svc.status].label}</Badge>
              </div>
              <p className="text-inkSoft text-sm mt-1">{svc.description || 'Опис не вказано'}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-inkMute">
                <span>{form.steps.length} полів</span>
                <span>{form.tabs.length} табів</span>
                <span>{svc.price ? `${svc.price} ₴` : 'безкоштовно'}</span>
              </div>
            </div>
          </div>

          {/* Health light */}
          <div className="mt-5 pt-4 border-t border-line">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hi.dot}`} />
              <span className={`text-sm font-semibold ${hi.text}`}>Стан: {hi.label}</span>
            </div>
            <ul className="space-y-1">
              {health.reasons.map((r, i) => (
                <li key={i} className="text-xs text-inkSoft flex gap-2">
                  <span className="text-inkMute">•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Technical details — jargon out of the way */}
          <TechDetails slug={svc.slug} mode={svc.generation_mode} id={svc.id} />
        </Card>

        {/* Document anatomy */}
        <Card className="p-5 md:p-6">
          <SectionLabel>Анатомія документа</SectionLabel>
          <p className="text-[12.5px] text-inkMute mt-2 mb-4">Як поля форми зіставляються з тим, що друкує документ.</p>
          <div className="flex flex-col gap-4">
            <AnatomyGroup dot="bg-ok" tone="used" title="Використовуються" hint="форма питає → документ друкує" items={diff.usedFields} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnatomyGroup dot="bg-warn" tone="extra" title="Не в шаблоні" hint="форма питає, шаблон не друкує (могло живити AI)" items={diff.unusedFields} />
              <AnatomyGroup dot="bg-danger" tone="missing" title="Бракує у формі" hint="документ чекає дані, форма не питає" items={diff.unmatchedPlaceholders} />
            </div>
          </div>
        </Card>

        {/* Citations */}
        {analysis.citations.length > 0 && (
          <Card className="p-5 md:p-6">
            <SectionLabel>Закони</SectionLabel>
            <p className="text-[12.5px] text-inkMute mt-2 mb-4">Статті, на які посилається документ.</p>
            {pendingChanges.length > 0 && (
              <button onClick={() => navigate('/law-changes')}
                      className="w-full text-left mb-4 px-3 py-2.5 bg-warn/10 border border-warn/30 rounded-xl text-xs text-warn hover:bg-warn/15 transition-colors">
                ⚠ Закон цієї послуги змінено ({pendingChanges.map((c) => c.law_title).join(', ')}) — переглянь у «Зміни законів» →
              </button>
            )}
            <div className="space-y-3.5">
              {analysis.citations.map((law) => {
                const stale = staleCodes.has(lawCodeFromUrl(law.url))
                return (
                  <div key={law.url}>
                    <div className="text-[13px] font-semibold text-inkSoft mb-1.5 flex items-center gap-2">
                      {law.title}
                      {stale && <Badge tone="warn">застаріло</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {law.articles.map((a) => (
                        <a key={a}
                           href={`https://zakon.rada.gov.ua/laws/show/${lawCodeFromUrl(law.url)}#n${a}`}
                           target="_blank" rel="noreferrer"
                           className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${stale
                             ? 'bg-warn/10 text-warn hover:bg-warn/20'
                             : 'bg-paperAlt text-inkSoft hover:text-ink'}`}>
                          ст. {a}
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Form as-is */}
        <Card className="p-5 md:p-6">
          <SectionLabel>Форма як є</SectionLabel>
          <p className="text-[12.5px] text-inkMute mt-2 mb-4">Що бачить і заповнює клієнт.</p>
          {form.steps.length === 0 && <p className="text-inkMute text-sm">У формі ще немає полів.</p>}
          <div className="space-y-5">
            {form.tabs.map((tab) => {
              const fields = fieldsByTab(tab.id)
              if (fields.length === 0) return null
              return (
                <div key={tab.id}>
                  <div className="text-xs font-semibold text-brand mb-2">{tab.label} <span className="text-inkMute">({fields.length})</span></div>
                  <div className="space-y-1.5">
                    {fields.map((f) => <FieldLine key={f.id} field={f} form={form} used={diff.usedFields.includes(f.id)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Lawyer feedback (slice 2) */}
        <ServiceNotes serviceSlug={svc.slug} authorEmail={authorEmail} />
      </div>
    </AdminLayout>
  )
}

// ── Technical details (collapsible) — keeps slug / mode / id out of the lawyer's way ──────
function TechDetails({ slug, mode, id }: { slug: string; mode: string | null; id: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <button onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-inkMute hover:text-ink transition-colors">
        <ChevronDown size={13} strokeWidth={2} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        технічні деталі
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-inkMute font-mono">
          <span>slug: /{slug}</span>
          <span>режим: {mode ?? '—'}</span>
          <span>id: {id}</span>
        </div>
      )}
    </div>
  )
}

// ── Anatomy group — header + field chips (Claude Design canvas) ───────────────────────────
function AnatomyGroup({ dot, tone, title, hint, items }: { dot: string; tone: ChipTone; title: string; hint: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span className={`w-2 h-2 rounded-full ${dot}`} /> {title}
        <span className="text-inkMute font-normal">{items.length}</span>
      </div>
      <p className="text-[11.5px] text-inkMute mt-0.5 mb-2">{hint}</p>
      {items.length === 0
        ? <p className="text-xs text-inkMute">—</p>
        : <div className="flex flex-wrap gap-1.5">{items.map((i) => <Chip key={i} tone={tone}>{i}</Chip>)}</div>}
    </div>
  )
}

// ── Field row (read-only) — id/hint hidden behind «технічні деталі» ───────────────────────
function FieldLine({ field, form, used }: { field: FormField; form: FormConfig; used: boolean }) {
  const [tech, setTech] = useState(false)
  return (
    <div className="px-3 py-2.5 bg-paperAlt/60 rounded-xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-ink">{field.label || <span className="text-warn italic">без підпису</span>}</span>
        {field.required && <span className="text-danger text-xs" title="Обов'язкове">*</span>}
        <span className="text-[11px] text-inkMute px-1.5 py-0.5 bg-paper rounded">{fieldTypeLabel(field.type)}</span>
        {!used && <span className="text-[11px] text-warn/80" title="Шаблон документа не друкує це поле (могло живити AI)">⚠ не в шаблоні</span>}
      </div>
      {field.options && field.options.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {field.options.map((o) => <span key={o.value} className="text-[11px] text-inkSoft px-1.5 py-0.5 bg-paper rounded">{o.label}</span>)}
        </div>
      )}
      {field.show_if && (
        <div className="mt-1.5 text-[11px] text-warn/90">⚡ {describeShowIf(field.show_if, form)}</div>
      )}
      <button onClick={() => setTech((t) => !t)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-inkMute hover:text-inkSoft transition-colors">
        <ChevronDown size={12} strokeWidth={2} className={`transition-transform ${tech ? '' : '-rotate-90'}`} />
        технічні деталі
      </button>
      {tech && (
        <div className="mt-1 text-[11px] text-inkMute font-mono">id: {field.id}{field.hint ? ` · hint: ${field.hint}` : ''}</div>
      )}
    </div>
  )
}
