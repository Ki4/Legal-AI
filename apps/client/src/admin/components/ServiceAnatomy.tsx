// Per-service visual lenses (ported from viz-lab, scoped to ONE service, on real data):
//   • Анатомія — pipeline / radial / blueprint toggle (viz-lab ServiceDetail, locked to this service)
//   • Граф     — single-service law→article→service→document graph (buildCatalogGraph([viz]))
//   • Форма    — the form's show_if branching, derived from the real form_config
// A stat trio (used / extra / missing) sits above the tabs as the at-a-glance summary.
import { useMemo, useState } from 'react'
import { ArrowDown, Zap } from 'lucide-react'
import { ServiceDetail } from '../viz/views/ServiceDetail'
import { CatalogGraph } from '../viz/views/CatalogGraph'
import { buildCatalogGraph, type VizService } from '../viz/vizData'
import { describeShowIf, fieldTypeLabel, type FieldDiff } from '../../lib/serviceAnatomy'
import type { FormConfig } from '../../types/form'
import { Card, SectionLabel } from '../ui'

type Tab = 'anatomy' | 'graph' | 'form'
const TABS: { id: Tab; label: string }[] = [
  { id: 'anatomy', label: 'Анатомія' },
  { id: 'graph', label: 'Граф звʼязків' },
  { id: 'form', label: 'Алгоритм форми' },
]

export function ServiceAnatomy({ viz, form, diff }: { viz: VizService; form: FormConfig; diff: FieldDiff }) {
  const [tab, setTab] = useState<Tab>('anatomy')
  const graph = useMemo(() => buildCatalogGraph([viz]), [viz])

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionLabel>Як влаштована послуга</SectionLabel>
        <div className="inline-flex bg-paperAlt rounded-xl p-1 gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${tab === t.id ? 'bg-paper text-ink shadow-sm' : 'text-inkMute hover:text-ink'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* at-a-glance: how form fields map to the document */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard n={diff.usedFields.length} label="використано" tone="ok" />
        <StatCard n={diff.unusedFields.length} label="не в шаблоні" tone="warn" />
        <StatCard n={diff.unmatchedPlaceholders.length} label="бракує" tone="danger" />
      </div>

      {tab === 'anatomy' && <ServiceDetail service={viz} />}
      {tab === 'graph' && (
        <CatalogGraph nodes={graph.nodes} edges={graph.edges} changes={[]} services={[viz]} onOpenService={() => {}} hideChanges />
      )}
      {tab === 'form' && <FormAlgorithm form={form} diff={diff} />}
    </Card>
  )
}

// ── Stat card — big tinted number (used / extra / missing) ─────────────────────────────────
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

// ── Form algorithm — the real show_if branching (Старт → таби/поля з умовами → Документ) ────
function FormAlgorithm({ form, diff }: { form: FormConfig; diff: FieldDiff }) {
  const usedSet = new Set(diff.usedFields)
  const tabs = form.tabs.length ? form.tabs : [{ id: '__all', label: 'Поля' }]
  if (form.steps.length === 0) return <p className="text-sm text-inkMute">У формі ще немає полів.</p>

  return (
    <div className="flex flex-col items-center gap-1">
      <FlowEnd label="Старт форми" sub="клієнт відкриває форму" tone="brand" />
      {tabs.map((t) => {
        const here = form.steps.filter((s) => t.id === '__all' || s.tab === t.id)
        if (here.length === 0) return null
        return (
          <div key={t.id} className="contents">
            <ArrowDown size={16} strokeWidth={1.8} className="text-inkMute my-0.5" />
            <div className="w-full border border-line rounded-2xl bg-paper p-4 md:p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-3">{t.label}</div>
              <div className="flex flex-col gap-2">
                {here.map((f) => {
                  const used = usedSet.has(f.id)
                  return (
                    <div key={f.id} className={f.show_if ? 'pl-3 border-l-2 border-warn/40' : ''}>
                      {f.show_if && (
                        <div className="flex items-center gap-1.5 text-[11px] text-warn mb-1">
                          <Zap size={12} strokeWidth={2} /> якщо {describeShowIf(f.show_if, form)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-2 h-2 rounded-full flex-none ${used ? 'bg-ok' : 'bg-warn'}`} />
                        <span className="text-sm text-ink">{f.label || <span className="font-mono text-inkMute">{f.id}</span>}</span>
                        {f.required && <span className="text-danger text-xs" title="Обовʼязкове">*</span>}
                        <span className="text-[11px] text-inkMute px-1.5 py-0.5 bg-paperAlt rounded">{fieldTypeLabel(f.type)}</span>
                        {!used && <span className="text-[11px] text-warn/80">не в шаблоні</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
      <ArrowDown size={16} strokeWidth={1.8} className="text-inkMute my-0.5" />
      <FlowEnd label="Готовий документ" sub="збирається з заповнених полів" tone="ok" />
    </div>
  )
}

function FlowEnd({ label, sub, tone }: { label: string; sub: string; tone: 'brand' | 'ok' }) {
  const cls = tone === 'brand' ? 'border-brand/30 bg-brand/5' : 'border-ok/30 bg-ok/5'
  const dot = tone === 'brand' ? 'bg-brand' : 'bg-ok'
  return (
    <div className={`inline-flex items-center gap-2.5 border rounded-xl px-4 py-2.5 ${cls}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-[11.5px] text-inkMute">{sub}</div>
      </div>
    </div>
  )
}
