import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { ServiceNotes } from '../components/ServiceNotes'
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
  green: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Готова' },
  amber: { dot: 'bg-amber-400',   text: 'text-amber-400',   label: 'Є зауваження' },
  red:   { dot: 'bg-red-400',     text: 'text-red-400',     label: 'Потребує уваги' },
}

function emptyConfig(): FormConfig {
  return { service_id: '', title: '', tabs: [], steps: [] }
}

export function ServiceViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [svc, setSvc] = useState<ServiceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staleCodes, setStaleCodes] = useState<Set<string>>(new Set())
  const [pendingChanges, setPendingChanges] = useState<{ law_title: string }[]>([])

  useEffect(() => {
    if (!supabase || !user || !id) return
    supabase
      .from('services')
      .select('id, slug, title, description, icon, price, status, generation_mode, document_template, form_config')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return }
        setSvc({ ...data, status: toServiceStatus(data.status) } as ServiceRow)
        setLoading(false)
      })
  }, [id, user])

  const form = svc?.form_config && Array.isArray(svc.form_config.steps) ? svc.form_config : emptyConfig()
  const analysis = useMemo(() => analyzeTemplate(svc?.document_template ?? ''), [svc?.document_template])
  const diff: FieldDiff = useMemo(() => diffFormVsTemplate(form, analysis), [form, analysis])
  const brokenShowIf = useMemo(() => collectBrokenShowIf(form), [form])
  const emptyLabels = useMemo(() => collectEmptyLabelFields(form), [form])

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

  const staleCitations = useMemo(() => {
    const labels = new Set<string>()
    for (const law of analysis.citations) if (staleCodes.has(lawCodeFromUrl(law.url))) labels.add(law.title)
    for (const c of pendingChanges) labels.add(c.law_title)
    return [...labels]
  }, [analysis.citations, staleCodes, pendingChanges])

  const health = useMemo(() => serviceHealth({
    generationMode: svc?.generation_mode ?? null,
    hasTemplate: analysis.hasTemplate,
    diff,
    brokenShowIf,
    emptyLabelFields: emptyLabels,
    staleCitations,
  }), [svc?.generation_mode, analysis.hasTemplate, diff, brokenShowIf, emptyLabels, staleCitations])

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-4">
          <div className="h-10 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !svc) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-24 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Послугу не знайдено</h3>
          <p className="text-slate-500 text-sm mb-6">{error ?? 'Спробуйте повернутися до каталогу.'}</p>
          <button onClick={() => navigate('/services')} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl">
            ← До каталогу
          </button>
        </div>
      </AdminLayout>
    )
  }

  const hi = HEALTH_UI[health.level]
  const fieldsByTab = (tab: string): FormField[] => form.steps.filter((s) => s.tab === tab)

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/services')} className="text-slate-400 hover:text-white text-sm flex-shrink-0">← Назад</button>
          <div className="flex-1" />
          <a href={`/?service=${svc.slug}`} target="_blank" rel="noreferrer"
             className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">
            👁 Форма клієнта
          </a>
          <button onClick={() => navigate(`/services/${svc.id}/edit`)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors">
            ✏️ Редагувати
          </button>
        </div>

        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
              {svc.icon || '⚖️'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-white">{svc.title || 'Без назви'}</h1>
              <p className="text-slate-400 text-sm mt-0.5">{svc.description || 'Опис не вказано'}</p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-500">
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium ${STATUS_META[svc.status].badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[svc.status].dot}`} />
                  {STATUS_META[svc.status].label}
                </span>
                <span>🧩 режим: <span className="text-slate-300">{svc.generation_mode ?? '—'}</span></span>
                <span>📋 {form.steps.length} полів</span>
                <span>🗂 {form.tabs.length} табів</span>
                {svc.price ? <span>💰 {svc.price}₴</span> : null}
                <span className="font-mono text-slate-600">/{svc.slug}</span>
              </div>
            </div>
          </div>

          {/* Health light */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hi.dot}`} />
              <span className={`text-sm font-semibold ${hi.text}`}>Стан: {hi.label}</span>
            </div>
            <ul className="space-y-1">
              {health.reasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-slate-600">•</span><span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Document anatomy */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-1">🔬 Анатомія документа</h2>
          <p className="text-xs text-slate-500 mb-4">Як поля форми зіставляються з тим, що друкує документ.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnatomyBox title="Використовуються" tone="ok" items={diff.usedFields}
                        hint="форма питає → документ друкує" />
            <AnatomyBox title="Не в шаблоні" tone="warn" items={diff.unusedFields}
                        hint="форма питає, шаблон не друкує (могло живити AI)" />
            <AnatomyBox title="Бракує у формі" tone="bad" items={diff.unmatchedPlaceholders}
                        hint="документ чекає дані, форма не питає" />
          </div>
        </section>

        {/* Citations */}
        {analysis.citations.length > 0 && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-1">🔗 Закони</h2>
            <p className="text-xs text-slate-500 mb-4">Статті, на які посилається документ.</p>
            {pendingChanges.length > 0 && (
              <button onClick={() => navigate('/law-changes')}
                      className="w-full text-left mb-4 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 hover:bg-amber-500/15 transition-colors">
                ⚠ Закон цієї послуги змінено ({pendingChanges.map((c) => c.law_title).join(', ')}) — переглянь у «Зміни законів» →
              </button>
            )}
            <div className="space-y-3">
              {analysis.citations.map((law) => {
                const stale = staleCodes.has(lawCodeFromUrl(law.url))
                return (
                  <div key={law.url}>
                    <div className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-2">
                      {law.title}
                      {stale && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium">застаріло</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {law.articles.map((a) => (
                        <a key={a}
                           href={`https://zakon.rada.gov.ua/laws/show/${lawCodeFromUrl(law.url)}#n${a}`}
                           target="_blank" rel="noreferrer"
                           className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${stale
                             ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                             : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                          ст. {a}
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Form as-is */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-1">📋 Форма як є</h2>
          <p className="text-xs text-slate-500 mb-4">Що бачить і заповнює клієнт.</p>
          {form.steps.length === 0 && <p className="text-slate-500 text-sm">У формі ще немає полів.</p>}
          <div className="space-y-5">
            {form.tabs.map((tab) => {
              const fields = fieldsByTab(tab.id)
              if (fields.length === 0) return null
              return (
                <div key={tab.id}>
                  <div className="text-xs font-semibold text-blue-400 mb-2">{tab.label} <span className="text-slate-600">({fields.length})</span></div>
                  <div className="space-y-1.5">
                    {fields.map((f) => <FieldLine key={f.id} field={f} form={form} used={diff.usedFields.includes(f.id)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Lawyer feedback (slice 2) */}
        <ServiceNotes serviceSlug={svc.slug} authorEmail={user?.email} />
      </div>
    </AdminLayout>
  )
}

// ── Anatomy column ────────────────────────────────────────────────────────────
function AnatomyBox({ title, tone, items, hint }: { title: string; tone: 'ok' | 'warn' | 'bad'; items: string[]; hint: string }) {
  const head = tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : 'text-red-400'
  const chip = tone === 'ok' ? 'bg-emerald-500/10 text-emerald-300'
    : tone === 'warn' ? 'bg-amber-500/10 text-amber-300' : 'bg-red-500/10 text-red-300'
  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3">
      <div className={`text-xs font-semibold ${head} flex items-center gap-1.5`}>
        {title} <span className="text-slate-600 font-normal">{items.length}</span>
      </div>
      <p className="text-[11px] text-slate-600 mb-2">{hint}</p>
      {items.length === 0
        ? <p className="text-xs text-slate-600">—</p>
        : <div className="flex flex-wrap gap-1">
            {items.map((i) => <span key={i} className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${chip}`}>{i}</span>)}
          </div>}
    </div>
  )
}

// ── Field row (read-only) ─────────────────────────────────────────────────────
function FieldLine({ field, form, used }: { field: FormField; form: FormConfig; used: boolean }) {
  const [tech, setTech] = useState(false)
  return (
    <div className="px-3 py-2.5 bg-slate-800/60 rounded-xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-white">{field.label || <span className="text-amber-400 italic">без підпису</span>}</span>
        {field.required && <span className="text-red-400 text-xs" title="Обов'язкове">*</span>}
        <span className="text-[11px] text-slate-500 px-1.5 py-0.5 bg-slate-900 rounded">{fieldTypeLabel(field.type)}</span>
        {!used && <span className="text-[11px] text-amber-400/80" title="Шаблон документа не друкує це поле (могло живити AI)">⚠ не в шаблоні</span>}
      </div>
      {field.options && field.options.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {field.options.map((o) => <span key={o.value} className="text-[11px] text-slate-400 px-1.5 py-0.5 bg-slate-900 rounded">{o.label}</span>)}
        </div>
      )}
      {field.show_if && (
        <div className="mt-1.5 text-[11px] text-yellow-500/90">⚡ {describeShowIf(field.show_if, form)}</div>
      )}
      <button onClick={() => setTech((t) => !t)} className="mt-1.5 text-[11px] text-slate-600 hover:text-slate-400">
        {tech ? '▼' : '▶'} технічні деталі
      </button>
      {tech && (
        <div className="mt-1 text-[11px] text-slate-500 font-mono">id: {field.id}{field.hint ? ` · hint: ${field.hint}` : ''}</div>
      )}
    </div>
  )
}
