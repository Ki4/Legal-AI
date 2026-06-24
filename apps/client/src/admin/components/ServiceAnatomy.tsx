// Per-service visual lenses (ported from viz-lab, scoped to ONE service, on real data):
//   • Анатомія — pipeline / radial / blueprint toggle (viz-lab ServiceDetail, locked to this service)
//   • Граф     — single-service law→article→service→document graph (buildCatalogGraph([viz]))
//   • Форма    — the form's show_if branching, derived from the real form_config
// A stat trio (used / extra / missing) sits above the tabs as the at-a-glance summary.
import { useMemo, useState } from 'react'
import { ChevronDown, GitBranch } from 'lucide-react'
import { ServiceDetail } from '../viz/views/ServiceDetail'
import { CatalogGraph } from '../viz/views/CatalogGraph'
import { FormFlow } from '../viz/views/FormFlow'
import { buildCatalogGraph, type VizService } from '../viz/vizData'
import { deriveFormFlow, type FlowStep } from '../../lib/formFlow'
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
  const [formView, setFormView] = useState<'tree' | 'list'>('tree')
  const graph = useMemo(() => buildCatalogGraph([viz]), [viz])
  const flow = useMemo(() => deriveFormFlow(form, diff), [form, diff])

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
      {tab === 'form' && (
        <div>
          <div className="flex justify-end mb-3">
            <div className="inline-flex bg-paperAlt rounded-lg p-1 gap-1">
              {([['tree', 'Дерево'], ['list', 'Список']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setFormView(v)}
                        className={`px-3 py-1 rounded-md text-[12.5px] font-medium transition-colors ${formView === v ? 'bg-paper text-ink shadow-sm' : 'text-inkMute hover:text-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {formView === 'tree' ? <FormFlow steps={flow} /> : <FormList steps={flow} form={form} />}
        </div>
      )}
    </Card>
  )
}

// ── Detailed expandable list — the same derived tree, but rows you drill into ──────────────
function collectGateIds(steps: FlowStep[], acc: string[] = []): string[] {
  for (const s of steps) {
    if (s.kind === 'gate') { acc.push(s.id); if (s.yes) collectGateIds(s.yes, acc) }
  }
  return acc
}

function FormList({ steps, form }: { steps: FlowStep[]; form: FormConfig }) {
  const gateIds = useMemo(() => collectGateIds(steps), [steps])
  const [open, setOpen] = useState<Set<string>>(() => new Set(gateIds))
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const body = steps.filter((s) => s.kind === 'gate' || s.kind === 'field')
  if (body.length === 0) return <p className="text-sm text-inkMute">У формі ще немає полів.</p>
  return (
    <div className="border border-line rounded-2xl bg-paper p-2 md:p-3">
      {body.map((s) => <FormRow key={s.id} step={s} depth={0} form={form} open={open} toggle={toggle} />)}
    </div>
  )
}

function FormRow({ step, depth, form, open, toggle }: {
  step: FlowStep; depth: number; form: FormConfig; open: Set<string>; toggle: (id: string) => void
}) {
  const isOpen = open.has(step.id)
  const indent = { paddingLeft: depth * 18 + 4 }

  if (step.kind === 'gate') {
    return (
      <div>
        <button onClick={() => toggle(step.id)} style={indent}
                className="w-full flex items-center gap-2 py-2 pr-2 text-left rounded-lg hover:bg-paperAlt/60 transition-colors">
          <ChevronDown size={14} strokeWidth={2} className={`text-inkMute transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          <GitBranch size={14} strokeWidth={1.8} className="text-warn flex-none" />
          <span className="text-sm font-semibold text-ink">{step.label}</span>
          <span className="text-[11px] font-semibold text-warn bg-warn/10 border border-warn/20 rounded-full px-2 py-0.5">{step.branch} →</span>
        </button>
        {isOpen && step.yes?.map((c) => <FormRow key={c.id} step={c} depth={depth + 1} form={form} open={open} toggle={toggle} />)}
      </div>
    )
  }

  const f = step.field
  const used = step.flag === 'used'
  return (
    <div>
      <button onClick={() => toggle(step.id)} style={indent}
              className="w-full flex items-center gap-2 py-2 pr-2 text-left rounded-lg hover:bg-paperAlt/60 transition-colors">
        <ChevronDown size={13} strokeWidth={2} className={`text-inkMute/60 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        <span className={`w-2 h-2 rounded-full flex-none ${used ? 'bg-ok' : 'bg-warn'}`} />
        <span className="text-sm text-ink">{step.label}</span>
        {f?.required && <span className="text-danger text-xs" title="Обовʼязкове">*</span>}
        {f && <span className="text-[11px] text-inkMute px-1.5 py-0.5 bg-paperAlt rounded">{fieldTypeLabel(f.type)}</span>}
        {!used && <span className="text-[11px] text-warn/80">не в шаблоні</span>}
      </button>
      {isOpen && f && (
        <div style={{ paddingLeft: depth * 18 + 33 }} className="pb-2 text-[11.5px] text-inkMute space-y-0.5">
          {f.show_if && <div>умова показу: <span className="text-inkSoft">{describeShowIf(f.show_if, form)}</span></div>}
          {f.options && f.options.length > 0 && <div>варіанти: <span className="text-inkSoft">{f.options.map((o) => o.label).join(', ')}</span></div>}
          {f.hint && <div>підказка: <span className="text-inkSoft">{f.hint}</span></div>}
          <div className="font-mono">id: {f.id}{used ? '' : ' · документ не друкує це поле'}</div>
        </div>
      )}
    </div>
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

