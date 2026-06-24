import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowDown, Eye, Pencil, ChevronDown } from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { ServiceNotes } from '../components/ServiceNotes'
import { CommentLayer } from '../components/CommentLayer'
import { Card, SectionLabel, Chip, Button, Badge, type BadgeTone } from '../ui'
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
  const counts = { used: diff.usedFields.length, extra: diff.unusedFields.length, missing: diff.unmatchedPlaceholders.length }
  const needsTemplate = svc.generation_mode === null || svc.generation_mode === 'template' || svc.generation_mode === 'hybrid'

  // Plain-language one-liner instead of a per-field bullet wall (the field detail lives in the chips below).
  const summary = useMemo(() => {
    if (health.level === 'green') return 'Форма, шаблон і цитати узгоджені — послуга готова збирати документ.'
    const parts: string[] = []
    if (needsTemplate && !analysis.hasTemplate) parts.push('документ ще не має шаблону')
    if (counts.missing) parts.push(`шаблон очікує ${counts.missing} ${plural(counts.missing, 'поле', 'поля', 'полів')}, яких форма не питає`)
    if (counts.extra) parts.push(`${counts.extra} ${plural(counts.extra, 'поле', 'поля', 'полів')} форма питає, але документ не друкує`)
    return parts.length ? capitalize(parts.join('; ')) + '.' : 'Є структурні зауваження — дивіться нижче.'
  }, [health.level, needsTemplate, analysis.hasTemplate, counts.missing, counts.extra])

  // Only categorical issues (no per-field enumeration — that became the colored chips).
  const issues: { tone: 'danger' | 'warn'; text: string }[] = []
  if (needsTemplate && !analysis.hasTemplate) issues.push({ tone: 'danger', text: 'Документ не має шаблону — послуга не згенерує документ' })
  if (brokenShowIf.length) issues.push({ tone: 'danger', text: `${brokenShowIf.length} ${plural(brokenShowIf.length, 'поле', 'поля', 'полів')} з умовою показу на неіснуюче поле` })
  if (svc.generation_mode === 'js') issues.push({ tone: 'warn', text: 'Генерація через legacy-білдер (не шаблон)' })
  if (staleCitations.length) issues.push({ tone: 'warn', text: `Змінені / застарілі закони: ${staleCitations.join(', ')}` })
  if (emptyLabels.length) issues.push({ tone: 'warn', text: `${emptyLabels.length} ${plural(emptyLabels.length, 'поле', 'поля', 'полів')} без підпису` })

  const fieldsByTab = (tab: string): FormField[] => form.steps.filter((s) => s.tab === tab)

  return (
    <AdminLayout>
      <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
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

          {/* Health light — concise summary + categorical issues only */}
          <div className="mt-5 pt-4 border-t border-line">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${hi.dot}`} />
              <span className={`text-sm font-semibold ${hi.text}`}>Стан: {hi.label}</span>
            </div>
            <p className="text-[12.5px] text-inkSoft leading-relaxed">{summary}</p>
            {issues.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {issues.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-none ${it.tone === 'danger' ? 'bg-danger' : 'bg-warn'}`} />
                    <span className="text-inkSoft">{it.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Technical details — jargon out of the way */}
          <TechDetails slug={svc.slug} mode={svc.generation_mode} id={svc.id} />
        </Card>

        {/* Document anatomy — stat trio + law→form→document pipeline (ported from viz-lab) */}
        <Card className="p-5 md:p-6">
          <SectionLabel>Анатомія: як збирається документ</SectionLabel>
          <p className="text-[12.5px] text-inkMute mt-2 mb-4">Правова основа → форма клієнта → готовий документ. Колір поля показує, чи доходить воно до документа.</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard n={counts.used} label="використано" tone="ok" />
            <StatCard n={counts.extra} label="не в шаблоні" tone="warn" />
            <StatCard n={counts.missing} label="бракує" tone="danger" />
          </div>
          <ServicePipeline svc={svc} form={form} analysis={analysis} diff={diff} healthDot={hi.dot} />
          <Legend />
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

        {/* Zone-anchored comments overlay (migration 028) */}
        <CommentLayer serviceSlug={svc.slug} authorEmail={authorEmail} />
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

// ── Ukrainian pluralization + small text helpers ──────────────────────────────────────────
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

// ── Anatomy stat card — big tinted number (used / extra / missing) ─────────────────────────
function StatCard({ n, label, tone }: { n: number; label: string; tone: 'ok' | 'warn' | 'danger' }) {
  const cls = {
    ok: 'bg-ok/10 border-ok/20 text-ok',
    warn: 'bg-warn/10 border-warn/20 text-warn',
    danger: 'bg-danger/10 border-danger/20 text-danger',
  }[tone]
  return (
    <div className={`border rounded-xl px-3 py-3 ${cls}`}>
      <div className="text-2xl font-bold leading-none">{n}</div>
      <div className="text-[11.5px] text-inkSoft mt-1">{label}</div>
    </div>
  )
}

// ── Service pipeline — law → form → document, ported from the viz-lab per-service view ──────
function ServicePipeline({
  svc, form, analysis, diff, healthDot,
}: {
  svc: ServiceRow
  form: FormConfig
  analysis: ReturnType<typeof analyzeTemplate>
  diff: FieldDiff
  healthDot: string
}) {
  const tabs = form.tabs.length ? form.tabs : [{ id: '__all', label: 'Поля' }]
  const usedSet = new Set(diff.usedFields)
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Band 1 — legal basis */}
      <Band title="Правова основа" sub="закони та статті, на яких стоїть послуга">
        {analysis.citations.length === 0
          ? <PipelineEmpty>шаблон не цитує статей</PipelineEmpty>
          : (
            <div className="flex flex-col gap-2.5">
              {analysis.citations.map((law) => (
                <div key={law.url} className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-inkSoft">{law.title}</span>
                  {law.articles.map((a) => (
                    <span key={a} className="font-mono text-[11.5px] px-2 py-0.5 rounded-md bg-paperAlt text-inkSoft border border-line">ст. {a}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
      </Band>
      <ArrowDown size={18} strokeWidth={1.8} className="text-inkMute my-0.5" />
      {/* Band 2 — the form the client fills */}
      <Band title={svc.title || 'Форма'} sub={`форма · ${form.steps.length} ${plural(form.steps.length, 'поле', 'поля', 'полів')} · ${tabs.length} ${plural(tabs.length, 'таб', 'таби', 'табів')}`} dot={healthDot}>
        {form.steps.length === 0
          ? <PipelineEmpty>у формі ще немає полів</PipelineEmpty>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tabs.map((t) => {
                const here = form.steps.filter((s) => t.id === '__all' || s.tab === t.id)
                if (here.length === 0) return null
                return (
                  <div key={t.id} className="border border-line rounded-xl p-3 bg-paperAlt/50">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-inkMute mb-2">{t.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {here.map((f) => <Chip key={f.id} tone={usedSet.has(f.id) ? 'used' : 'extra'}>{f.id}</Chip>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </Band>
      <ArrowDown size={18} strokeWidth={1.8} className="text-inkMute my-0.5" />
      {/* Band 3 — the generated document */}
      <Band title="Документ" sub={analysis.hasTemplate ? 'збирається з шаблону' : 'готується'}>
        {!analysis.hasTemplate
          ? <PipelineEmpty>шаблон документа ще не завантажено</PipelineEmpty>
          : diff.unmatchedPlaceholders.length === 0
            ? <div className="flex items-center gap-2 text-[13px] text-ok"><span className="w-2 h-2 rounded-full bg-ok flex-none" /> усі дані для документа форма збирає</div>
            : (
              <div>
                <div className="text-[12.5px] text-danger mb-2">⚠ шаблон чекає {diff.unmatchedPlaceholders.length} {plural(diff.unmatchedPlaceholders.length, 'поле', 'поля', 'полів')}, яких форма не питає:</div>
                <div className="flex flex-wrap gap-1.5">{diff.unmatchedPlaceholders.map((p) => <Chip key={p} tone="missing">{p}</Chip>)}</div>
              </div>
            )}
      </Band>
    </div>
  )
}

function Band({ title, sub, dot, children }: { title: string; sub: string; dot?: string; children: React.ReactNode }) {
  return (
    <div className="w-full border border-line rounded-2xl bg-paper p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {dot && <span className={`w-2.5 h-2.5 rounded-full flex-none ${dot}`} />}
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs text-inkMute">· {sub}</span>
      </div>
      {children}
    </div>
  )
}

const PipelineEmpty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-inkMute italic text-center py-1">{children}</p>
)

function Legend() {
  const items: [string, string][] = [['bg-ok', 'у документі'], ['bg-warn', 'не в шаблоні'], ['bg-danger', 'бракує у формі']]
  return (
    <div className="flex flex-wrap gap-4 mt-4 text-xs text-inkSoft">
      {items.map(([dot, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
      ))}
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
