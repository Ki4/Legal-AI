// Layer 2 — one service in depth. Three competing layouts to compare side by side:
// vertical pipeline · radial ego-graph · document blueprint. Pick a service + a variant.
// Data comes from useVizServices() — live `services` (via serviceAnatomy) or demo fallback.
import { useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { C, MONO, KIND_STRIPE, HEALTH } from '../theme'
import type { Health } from '../theme'
import { KIND_ICON } from '../icons'
import type { VizNode, FieldMapping } from '../demoData'
import { useVizServices, type VizService, type VizFieldChip } from '../vizData'

const MAP_COLOR: Record<FieldMapping, { fg: string; bg: string; bd: string; dot: string; label: string }> = {
  used:    { fg: C.okInk,     bg: C.okTint,     bd: C.okBorder,     dot: C.ok,     label: 'у документі' },
  extra:   { fg: C.warnInk,   bg: C.warnTint,   bd: C.warnBorder,   dot: C.warn,   label: 'не в шаблоні' },
  missing: { fg: C.dangerInk, bg: C.dangerTint, bd: C.dangerBorder, dot: C.danger, label: 'бракує у формі' },
}

type Variant = 'pipeline' | 'radial' | 'blueprint'

export function ServiceDetail() {
  const { services, source } = useVizServices()
  const [svcId, setSvcId] = useState<string | null>(null)
  const [variant, setVariant] = useState<Variant>('pipeline')
  const svc = services.find((s) => s.id === svcId) ?? services[0]

  if (!svc) return <div style={{ ...card, color: C.muted }}>Послуг ще немає.</div>

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 18 }}>
        <Seg value={svc.id} onChange={setSvcId} options={services.map((s) => ({ value: s.id, label: s.title }))} />
        <span style={{ flex: 1 }} />
        {source === 'demo' && <span style={{ fontSize: 11.5, color: C.muted }}>демо-дані</span>}
        <Seg
          value={variant}
          onChange={(v) => setVariant(v as Variant)}
          options={[
            { value: 'pipeline', label: 'Пайплайн' },
            { value: 'radial', label: 'Радіальний' },
            { value: 'blueprint', label: 'Blueprint' },
          ]}
        />
      </div>

      <div style={card}>
        {variant === 'pipeline' && <Pipeline svc={svc} />}
        {variant === 'radial' && <Radial svc={svc} />}
        {variant === 'blueprint' && <Blueprint svc={svc} />}
      </div>

      <Legend />
    </div>
  )
}

// ── Variant A: vertical pipeline ─────────────────────────────────────────────
function Pipeline({ svc }: { svc: VizService }) {
  const tabs = svc.tabs.length ? svc.tabs : [{ id: 'main', label: 'Поля' }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <Band title="Правова основа" sub="закони та статті, на яких стоїть послуга">
        {svc.articles.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {svc.articles.map((a) => <NodePill key={a.id} node={a} />)}
          </div>
        ) : <Empty>шаблон не цитує статей</Empty>}
      </Band>
      <Connector />
      <Band title={svc.title} sub={`форма · ${svc.counts.total} полів · ${svc.tabs.length} ${svc.tabs.length === 1 ? 'блок' : 'таби'}`} health={svc.health}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(tabs.length, 4)}, 1fr)`, gap: 12 }}>
          {tabs.map((t) => (
            <div key={t.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.surfaceAlt }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, marginBottom: 9 }}>{t.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {svc.fields.filter((c) => c.tab === t.id).map((c) => <FieldChip key={c.id} chip={c} />)}
              </div>
            </div>
          ))}
        </div>
      </Band>
      <Connector />
      <Band title="Документ" sub={svc.doc ? svc.doc.sub : 'готується'}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
          {svc.doc && <NodePill node={svc.doc} />}
          {svc.counts.missing > 0 && (
            <span style={{ fontSize: 12.5, color: C.dangerInk, background: C.dangerTint, border: `1px solid ${C.dangerBorder}`, borderRadius: 8, padding: '6px 11px' }}>
              ⚠ шаблон чекає {svc.counts.missing} {svc.counts.missing === 1 ? 'поле' : 'поля'}, яких форма не питає
            </span>
          )}
        </div>
      </Band>
    </div>
  )
}

// ── Variant B: radial ego-graph ──────────────────────────────────────────────
function Radial({ svc }: { svc: VizService }) {
  const W = 760, H = 460, cx = W / 2, cy = H / 2
  const articles = svc.articles
  const sats: { node: VizNode; x: number; y: number }[] = []
  articles.forEach((a, i) => {
    const t = articles.length === 1 ? 0.5 : i / (articles.length - 1)
    const ang = Math.PI * (0.62 + t * 0.76) // left side arc
    sats.push({ node: a, x: cx + Math.cos(ang) * 270, y: cy + Math.sin(ang) * 170 })
  })
  if (svc.doc) sats.push({ node: svc.doc, x: cx + 290, y: cy })

  return (
    <div style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {sats.map((s) => (
          <line key={s.node.id} x1={cx} y1={cy} x2={s.x} y2={s.y} stroke={C.borderStrong} strokeWidth={1.6} />
        ))}
      </svg>
      <div style={{ position: 'absolute', left: cx - 80, top: cy - 44, width: 160, height: 88, borderRadius: 16, background: HEALTH[svc.health].tint, border: `1px solid ${HEALTH[svc.health].border}`, borderLeft: `3px solid ${KIND_STRIPE.srv}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(31,30,27,.08)', zIndex: 3, padding: 8, textAlign: 'center' }}>
        {(() => { const I = KIND_ICON.srv; return <I size={20} color={KIND_STRIPE.srv} strokeWidth={1.7} /> })()}
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4, lineHeight: 1.15 }}>{svc.title}</div>
        <div style={{ fontSize: 11, color: C.inkSecondary, marginTop: 2 }}>
          {svc.requestsPerMonth != null ? `${svc.requestsPerMonth} заявок/міс` : `${svc.counts.total} полів`}
        </div>
      </div>
      {sats.map((s) => <div key={s.node.id} style={{ position: 'absolute', left: s.x - 78, top: s.y - 28, zIndex: 2 }}><NodePill node={s.node} /></div>)}
    </div>
  )
}

// ── Variant C: document blueprint ────────────────────────────────────────────
// Sections are the form tabs; each lists the fields the client fills there.
function Blueprint({ svc }: { svc: VizService }) {
  const tabs = svc.tabs.length ? svc.tabs : [{ id: 'main', label: 'Поля' }]
  return (
    <div style={{ maxWidth: 620, margin: '0 auto', border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, boxShadow: '0 8px 30px rgba(31,30,27,.06)', overflow: 'hidden' }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 22px', textAlign: 'center', background: C.surfaceAlt }}>
        <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted }}>Макет документа</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3 }}>Позовна заява · {svc.title}</div>
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tabs.map((t) => {
          const here = svc.fields.filter((c) => c.tab === t.id)
          return (
            <div key={t.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{here.length} {here.length === 1 ? 'поле' : 'полів'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {here.length > 0 ? here.map((c) => <FieldChip key={c.id} chip={c} />)
                  : <span style={{ fontSize: 12, color: C.faint, fontStyle: 'italic' }}>—</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────
function NodePill({ node }: { node: VizNode }) {
  const I = KIND_ICON[node.kind]
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${KIND_STRIPE[node.kind]}`, borderRadius: 11, padding: '9px 13px', boxShadow: '0 1px 2px rgba(31,30,27,.05)', minWidth: 150 }}>
      <I size={16} color={KIND_STRIPE[node.kind]} strokeWidth={1.7} />
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.1 }}>{node.label}</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>{node.sub}</div>
      </div>
    </div>
  )
}

function FieldChip({ chip }: { chip: VizFieldChip }) {
  const m = MAP_COLOR[chip.map]
  return (
    <span style={{ fontFamily: MONO, fontSize: 11.5, color: m.fg, background: m.bg, border: `1px solid ${m.bd}`, padding: '4px 9px', borderRadius: 7 }}>
      {chip.id.length < 24 ? chip.id : chip.label}
    </span>
  )
}

function Band({ title, sub, health, children }: { title: string; sub: string; health?: Health; children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', maxWidth: 760, border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, padding: 18, boxShadow: '0 1px 2px rgba(31,30,27,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        {health && <span style={{ width: 9, height: 9, borderRadius: 999, background: HEALTH[health].dot, flex: 'none' }} />}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12, color: C.muted }}>· {sub}</span>
      </div>
      {children}
    </div>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12.5, color: C.faint, fontStyle: 'italic', textAlign: 'center' }}>{children}</div>
)

const Connector = () => <ArrowDown size={20} color={C.faint} style={{ margin: '2px 0' }} />

function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, fontSize: 12.5, color: C.inkSecondary }}>
      {(Object.keys(MAP_COLOR) as FieldMapping[]).map((k) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: MAP_COLOR[k].dot }} />
          {MAP_COLOR[k].label}
        </span>
      ))}
    </div>
  )
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F0EEE7', borderRadius: 10, padding: 3, gap: 2, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 13px', fontSize: 13, fontWeight: 500, background: value === o.value ? C.surface : 'transparent', color: value === o.value ? C.ink : C.inkSecondary, boxShadow: value === o.value ? '0 1px 2px rgba(31,30,27,.08)' : 'none' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const card: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 18, padding: 28,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
