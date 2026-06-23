// Catalog focus mode — the subgraph of ONE service only: its laws → its articles → the
// service → its document, nothing else. Reached by clicking a service in the full catalog
// graph ("show only this service", IMPROVEMENTS #87).
//
// Unlike the full catalog (hand-laid coordinates), this view AUTO-LAYS-OUT its nodes: each
// of the four columns is centred vertically and evenly spaced, computed from the node count.
// So it stays clean for any service regardless of how many articles it touches — and it
// doubles as a preview of the auto-layout answer to "what if the structure gets huge" (#90).
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { C, KIND_STRIPE, KIND_LABEL, HEALTH, uah } from '../theme'
import type { NodeKind } from '../theme'
import { KIND_ICON } from '../icons'
import { NODES, EDGES, CHANGES, serviceById } from '../demoData'
import type { VizNode } from '../demoData'

const NODE_MAP: Record<string, VizNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))
// Articles touched by a pending law change — flagged with a "змінено" dot in this view.
const CHANGED_ARTICLES = new Set(CHANGES.map((c) => c.article))

type Overlay = 'structure' | 'business'

// ─── Subgraph + auto-layout ───────────────────────────────────────────────────
interface Placed extends VizNode {
  px: number
  py: number
  pw: number
  ph: number
}

const COL: Record<NodeKind, { x: number; w: number }> = {
  law: { x: 12, w: 186 },
  art: { x: 252, w: 200 },
  srv: { x: 514, w: 202 },
  doc: { x: 766, w: 168 },
}
const NODE_H: Record<NodeKind, number> = { law: 64, art: 58, srv: 90, doc: 62 }
const GAP = 20
const STAGE_W = 946

/** The connected slice for one service: laws → its articles → service → its document(s). */
function subgraphFor(serviceId: string) {
  const articles = EDGES
    .filter(([, to]) => to === serviceId)
    .map(([from]) => NODE_MAP[from])
    .filter((n): n is VizNode => n?.kind === 'art')
  const articleIds = new Set(articles.map((a) => a.id))

  const laws = NODES.filter(
    (n) => n.kind === 'law' && EDGES.some(([from, to]) => from === n.id && articleIds.has(to)),
  )
  const docs = EDGES
    .filter(([from]) => from === serviceId)
    .map(([, to]) => NODE_MAP[to])
    .filter((n): n is VizNode => n?.kind === 'doc')

  const service = NODE_MAP[serviceId]
  return { laws, articles, service, docs }
}

const groupHeight = (kind: NodeKind, n: number) => (n <= 0 ? 0 : n * NODE_H[kind] + (n - 1) * GAP)

/** Place each column's nodes, vertically centred within a common stage height. */
function layout(serviceId: string) {
  const { laws, articles, service, docs } = subgraphFor(serviceId)
  const columns: [NodeKind, VizNode[]][] = [
    ['law', laws],
    ['art', articles],
    ['srv', service ? [service] : []],
    ['doc', docs],
  ]
  const stageH = Math.max(260, ...columns.map(([k, ns]) => groupHeight(k, ns.length)))

  const placed: Placed[] = []
  for (const [kind, ns] of columns) {
    const startY = (stageH - groupHeight(kind, ns.length)) / 2
    ns.forEach((n, i) => {
      placed.push({
        ...n,
        px: COL[kind].x,
        py: startY + i * (NODE_H[kind] + GAP),
        pw: COL[kind].w,
        ph: NODE_H[kind],
      })
    })
  }
  const ids = new Set(placed.map((p) => p.id))
  const edges = EDGES.filter(([from, to]) => ids.has(from) && ids.has(to))
  const placedMap: Record<string, Placed> = Object.fromEntries(placed.map((p) => [p.id, p]))
  return { placed, placedMap, edges, stageH }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ServiceFocusGraph({
  initialServiceId,
  initialOverlay = 'structure',
  onBack,
}: {
  initialServiceId: string
  initialOverlay?: Overlay
  onBack: () => void
}) {
  const [svcId, setSvcId] = useState(initialServiceId)
  const [overlay, setOverlay] = useState<Overlay>(initialOverlay)

  const { placed, placedMap, edges, stageH } = useMemo(() => layout(svcId), [svcId])
  const svc = serviceById(svcId)
  const services = NODES.filter((n) => n.kind === 'srv')

  return (
    <div>
      {/* toolbar: back · service picker · overlay */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <button onClick={onBack} style={ghostBtn}>
          <ArrowLeft size={14} /> Усі послуги
        </button>
        <SegToggle value={svcId} onChange={setSvcId} options={services.map((s) => ({ value: s.id, label: s.label }))} />
        <span style={{ flex: 1 }} />
        <SegToggle
          value={overlay}
          onChange={setOverlay}
          options={[
            { value: 'structure', label: 'Структура' },
            { value: 'business', label: 'Бізнес-оверлей' },
          ]}
        />
      </div>

      {/* service summary header */}
      {svc && (
        <div style={{ ...card, padding: 18, marginBottom: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 220 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: HEALTH[svc.health].dot, flex: 'none' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{svc.title}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{HEALTH[svc.health].label}</div>
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <MiniStat n={svc.fields.used} label="у документі" tone="ok" />
          <MiniStat n={svc.fields.extra} label="не в шаблоні" tone="warn" />
          <MiniStat n={svc.fields.missing} label="бракує" tone="danger" />
          <div style={{ width: 1, alignSelf: 'stretch', background: C.border }} />
          <MiniStat n={svc.requestsPerMonth} label="заявок/міс" tone="plain" />
          <div style={{ minWidth: 110 }}>
            <div style={{ fontSize: 19, fontWeight: 600, color: svc.revenue ? C.ink : C.faint }}>
              {svc.revenue ? uah(svc.revenue) : '—'}
            </div>
            <div style={{ fontSize: 11.5, color: C.inkSecondary }}>виручка/міс</div>
          </div>
        </div>
      )}

      {/* legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, fontSize: 12.5, color: C.inkSecondary }}>
        {(['law', 'art', 'srv', 'doc'] as NodeKind[]).map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: KIND_STRIPE[k] }} />
            {KIND_LABEL[k]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: C.impact }} />
          змінено законом
        </span>
      </div>

      {/* auto-laid-out subgraph */}
      <div style={stageWrap}>
        <div style={{ position: 'relative', width: STAGE_W, height: stageH, margin: '0 auto' }}>
          <svg width={STAGE_W} height={stageH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {edges.map(([from, to]) => {
              const a = placedMap[from]
              const b = placedMap[to]
              const x1 = a.px + a.pw
              const y1 = a.py + a.ph / 2
              const x2 = b.px
              const y2 = b.py + b.ph / 2
              const mx = (x1 + x2) / 2
              // business overlay: thicken whichever edge touches the service, by its demand
              let sw = 1.7
              if (overlay === 'business' && svc && (from === svcId || to === svcId)) {
                sw = 1.4 + (svc.requestsPerMonth / 32) * 3
              }
              return (
                <path
                  key={`${from}-${to}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={C.accent}
                  strokeWidth={sw}
                  strokeOpacity={0.5}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {placed.map((n) => {
            const Icon = KIND_ICON[n.kind]
            const stripe = KIND_STRIPE[n.kind]
            const isService = n.kind === 'srv'
            const changed = n.kind === 'art' && CHANGED_ARTICLES.has(n.id)

            let bg: string = C.surface
            let metaText: string | undefined
            if (overlay === 'business' && isService && svc) {
              bg = HEALTH[svc.health].tint
              metaText = svc.revenue ? uah(svc.revenue) + '/міс' : 'не запущена'
            } else if (isService) {
              metaText = n.meta
            }

            return (
              <div
                key={n.id}
                style={{
                  position: 'absolute', left: n.px, top: n.py, width: n.pw, height: n.ph,
                  background: bg,
                  border: `1px solid ${changed ? C.impactRing : '#E8E6DF'}`,
                  borderLeft: `3px solid ${overlay === 'business' && isService && svc ? HEALTH[svc.health].dot : stripe}`,
                  borderRadius: 12, padding: '10px 13px', boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  boxShadow: isService ? '0 8px 20px rgba(31,30,27,.09)' : '0 1px 2px rgba(31,30,27,.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: stripe, flex: 'none', display: 'inline-flex' }}>
                    <Icon size={isService ? 18 : 16} strokeWidth={1.7} />
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.15 }}>{n.label}</span>
                  {changed && (
                    <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 999, background: C.impact, flex: 'none' }} title="Зачеплено зміною закону" />
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.inkSecondary, lineHeight: 1.3, marginTop: 3 }}>{n.sub}</div>
                {metaText && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{metaText}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: C.muted, marginTop: 14 }}>
        Підграф лише цієї послуги — закони та статті, на яких вона стоїть, і документ, що вона
        генерує. Розкладка рахується автоматично, тож лишається чистою за будь-якої кількості статей.
      </p>
    </div>
  )
}

// ─── small building blocks ────────────────────────────────────────────────────
function MiniStat({ n, label, tone }: { n: number; label: string; tone: 'ok' | 'warn' | 'danger' | 'plain' }) {
  const fg = { ok: C.okInk, warn: C.warnInk, danger: C.dangerInk, plain: C.ink }[tone]
  return (
    <div style={{ minWidth: 78 }}>
      <div style={{ fontSize: 19, fontWeight: 600, color: n === 0 && tone !== 'plain' ? C.faint : fg }}>{n}</div>
      <div style={{ fontSize: 11.5, color: C.inkSecondary }}>{label}</div>
    </div>
  )
}

function SegToggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F0EEE7', borderRadius: 10, padding: 3, gap: 2, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 13px', fontSize: 13, fontWeight: 500,
            background: value === o.value ? C.surface : 'transparent',
            color: value === o.value ? C.ink : C.inkSecondary,
            boxShadow: value === o.value ? '0 1px 2px rgba(31,30,27,.08)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const stageWrap: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 18,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)', padding: 20, overflowX: 'auto',
}
const card: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 16,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, background: C.surface,
  border: `1px solid ${C.borderStrong}`, borderRadius: 9, padding: '7px 13px',
  fontSize: 12.5, fontWeight: 500, color: C.inkSecondary, cursor: 'pointer',
}
