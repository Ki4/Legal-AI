// Layer 1 — Catalog. The full "Що на що впливає" layered graph (law → article → service → document),
// ported from the design canvas, plus a Structure / Business overlay toggle.
import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { C, MONO, KIND_STRIPE, KIND_TINT, KIND_LABEL, HEALTH, uah } from '../theme'
import type { NodeKind } from '../theme'
import { KIND_ICON } from '../icons'
import { NODES, EDGES, CHANGES, serviceById, changeImpact } from '../demoData'
import type { VizNode, LawChange } from '../demoData'

const STAGE_W = 1080
const STAGE_H = 560

const NODE_MAP: Record<string, VizNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))

/** All nodes reachable up- and down-stream from `sel` (the highlighted chain). */
function connectedChain(sel: string): Set<string> {
  const set = new Set<string>([sel])
  const walk = (dir: 'up' | 'down') => {
    const stack = [sel]
    while (stack.length) {
      const cur = stack.pop() as string
      EDGES.forEach(([from, to]) => {
        const [a, b] = dir === 'up' ? [to, from] : [from, to]
        if (a === cur && !set.has(b)) {
          set.add(b)
          stack.push(b)
        }
      })
    }
  }
  walk('up')
  walk('down')
  return set
}

type Overlay = 'structure' | 'business'

export function CatalogGraph() {
  const [sel, setSel] = useState<string | null>(null)
  const [impact, setImpact] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>('structure')

  const chain = useMemo(() => (sel ? connectedChain(sel) : null), [sel])
  const hi = impact ? C.impact : C.accent
  const ring = impact ? C.impactRing : C.accentRing

  const selNode = sel ? NODE_MAP[sel] : null
  const depends = sel ? EDGES.filter(([, t]) => t === sel).map(([f]) => NODE_MAP[f]) : []
  const affects = sel ? EDGES.filter(([f]) => f === sel).map(([, t]) => NODE_MAP[t]) : []
  const svc = selNode?.kind === 'srv' ? serviceById(selNode.id) : undefined

  function pickNode(id: string) {
    setSel(id)
    setImpact(false)
  }
  function pickChange(c: LawChange) {
    setSel(c.article)
    setImpact(true)
  }
  function reset() {
    setSel(null)
    setImpact(false)
  }

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <SegToggle
          value={overlay}
          onChange={setOverlay}
          options={[
            { value: 'structure', label: 'Структура' },
            { value: 'business', label: 'Бізнес-оверлей' },
          ]}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5, color: C.inkSecondary }}>
          {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: KIND_STRIPE[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: C.muted }}>
          {sel ? 'Підсвічено ланцюг звʼязків' : 'Натисніть вузол, щоб підсвітити звʼязки'}
        </span>
        <button onClick={reset} style={ghostBtn}>
          <RotateCcw size={14} /> Скинути
        </button>
      </div>

      {overlay === 'business' && (
        <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 14px' }}>
          Послуги пофарбовано за станом (health), товщина звʼязку — за попитом (заявки/міс). Видно, де
          попит є, а послуга зламана.
        </p>
      )}

      {/* stage */}
      <div style={stageWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '195px 215px 205px 165px', width: STAGE_W, margin: '0 auto 6px', padding: '0 6px' }}>
          {['Закони', 'Статті', 'Послуги', 'Форма → документ'].map((h, i) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, paddingLeft: [0, 36, 38, 48][i] }}>
              {h}
            </span>
          ))}
        </div>

        <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H, margin: '0 auto' }}>
          {/* edges */}
          <svg width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {EDGES.map(([f, t]) => {
              const a = NODE_MAP[f]
              const b = NODE_MAP[t]
              const x1 = a.x + a.w
              const y1 = a.y + a.h / 2
              const x2 = b.x
              const y2 = b.y + b.h / 2
              const mx = (x1 + x2) / 2
              const lit = chain ? chain.has(f) && chain.has(t) : false
              const dim = chain ? !lit : false
              // business overlay: thickness by demand of whichever endpoint is a service
              let sw = 1.6
              if (overlay === 'business') {
                const s = serviceById(f) ?? serviceById(t)
                if (s) sw = 1.2 + (s.requestsPerMonth / 32) * 3
              }
              return (
                <path
                  key={`${f}-${t}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={lit ? hi : dim ? C.border : '#DAD6CC'}
                  strokeWidth={lit ? sw + 0.8 : sw}
                  strokeOpacity={dim ? 0.55 : 1}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {/* nodes */}
          {NODES.map((n) => {
            const Icon = KIND_ICON[n.kind]
            const stripe = KIND_STRIPE[n.kind]
            const service = serviceById(n.id)
            const inChain = chain ? chain.has(n.id) : true
            const dim = chain ? !inChain : false

            let bg: string = C.surface
            let metaText: string | undefined = n.meta
            if (overlay === 'business' && service) {
              bg = HEALTH[service.health].tint
              metaText = service.revenue ? uah(service.revenue) + '/міс' : 'не запущена'
            }

            return (
              <div
                key={n.id}
                onClick={() => pickNode(n.id)}
                style={{
                  position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
                  background: bg, border: `1px solid ${inChain && chain ? hi : '#E8E6DF'}`,
                  borderLeft: `3px solid ${overlay === 'business' && service ? HEALTH[service.health].dot : stripe}`,
                  borderRadius: 12, padding: '10px 13px', boxSizing: 'border-box', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  transition: 'all .18s ease', zIndex: inChain && chain ? 4 : 2,
                  boxShadow: inChain && chain ? `0 0 0 3px ${ring}, 0 8px 20px rgba(31,30,27,.09)` : '0 1px 2px rgba(31,30,27,.05)',
                  opacity: dim ? 0.32 : 1, filter: dim ? 'saturate(.4)' : 'none',
                  transform: n.id === sel ? 'translateY(-1px) scale(1.012)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: stripe, flex: 'none', display: 'inline-flex' }}>
                    <Icon size={n.kind === 'srv' ? 18 : 16} strokeWidth={1.7} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.15 }}>{n.label}</span>
                </div>
                <div style={{ fontSize: 12, color: C.inkSecondary, lineHeight: 1.3, marginTop: 3 }}>{n.sub}</div>
                {metaText && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: C.faint }} />
                    {metaText}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* detail + law changes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        <div style={{ ...card, minHeight: 240 }}>
          {selNode ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 4 }}>
                <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', background: KIND_TINT[selNode.kind], color: KIND_STRIPE[selNode.kind] }}>
                  {(() => { const I = KIND_ICON[selNode.kind]; return <I size={18} strokeWidth={1.7} /> })()}
                </span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.09em', textTransform: 'uppercase', color: C.muted }}>{KIND_LABEL[selNode.kind]}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.01em' }}>{selNode.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: C.inkSecondary, margin: '4px 0 18px' }}>{selNode.sub}</div>

              {svc && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                  <Stat n={svc.fields.used} label="використано" tone="ok" />
                  <Stat n={svc.fields.extra} label="не в шаблоні" tone="warn" />
                  <Stat n={svc.fields.missing} label="бракує" tone="danger" />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <RelList title="Залежить від" items={depends} />
                <RelList title="Впливає на" items={affects} />
              </div>
            </div>
          ) : (
            <EmptyDetail />
          )}
        </div>

        {/* law changes */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Зміни законів</span>
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 16px' }}>
            Натисніть зміну — на графі підсвітяться зачеплені послуги та порахується виручка під ризиком.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CHANGES.map((c) => {
              const active = sel === c.article && impact
              const sev = c.severity === 'warn'
                ? { fg: C.warnInk, bg: C.warnTint, bd: C.warnBorder }
                : { fg: '#1B6CA8', bg: '#E8F0F7', bd: '#CFE0EE' }
              const { services, revenueAtRisk } = changeImpact(c)
              return (
                <div
                  key={c.id}
                  onClick={() => pickChange(c)}
                  style={{
                    border: `1px solid ${active ? '#E3B25C' : C.border}`,
                    background: active ? '#FCF6E8' : C.surface,
                    borderRadius: 11, padding: '13px 15px', cursor: 'pointer', transition: 'all .15s ease',
                    boxShadow: active ? '0 0 0 3px rgba(200,136,28,.14)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>{c.ref}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sev.fg, background: sev.bg, border: `1px solid ${sev.bd}`, padding: '2px 9px', borderRadius: 999, flex: 'none', whiteSpace: 'nowrap' }}>
                      {c.severity === 'warn' ? 'Потребує ревʼю' : 'Інформативно'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.4, marginBottom: 6 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    Зачеплено: {services.map((s) => s.title).join(', ')}
                    {revenueAtRisk > 0 && <> · <b style={{ color: C.warnInk }}>{uah(revenueAtRisk)}/міс під ризиком</b></>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── small building blocks ────────────────────────────────────────────────────
function Stat({ n, label, tone }: { n: number; label: string; tone: 'ok' | 'warn' | 'danger' }) {
  const m = {
    ok: { fg: C.okInk, bg: '#F1F8F3', bd: C.okBorder },
    warn: { fg: C.warnInk, bg: '#FCF6E8', bd: C.warnBorder },
    danger: { fg: C.dangerInk, bg: '#FBEFEC', bd: C.dangerBorder },
  }[tone]
  return (
    <div style={{ flex: 1, border: `1px solid ${m.bd}`, background: m.bg, borderRadius: 10, padding: '11px 12px' }}>
      <div style={{ fontSize: 20, fontWeight: 600, color: m.fg }}>{n}</div>
      <div style={{ fontSize: 11.5, color: C.inkSecondary }}>{label}</div>
    </div>
  )
}

function RelList({ title, items }: { title: string; items: VizNode[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>—</div>}
        {items.map((d) => (
          <div key={d.id} style={{ fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{d.label}</span> <span style={{ color: C.muted }}>· {d.sub}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyDetail() {
  return (
    <div style={{ height: '100%', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: C.muted }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.inkSecondary }}>Оберіть вузол</div>
      <div style={{ fontSize: 13, maxWidth: 280, marginTop: 5 }}>
        Натисніть закон, статтю, послугу чи документ, щоб побачити деталі та підсвітити весь ланцюг.
      </div>
    </div>
  )
}

function SegToggle<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F0EEE7', borderRadius: 10, padding: 3, gap: 2 }}>
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
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 16, padding: 24,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, background: C.surface,
  border: `1px solid ${C.borderStrong}`, borderRadius: 9, padding: '7px 13px',
  fontSize: 12.5, fontWeight: 500, color: C.inkSecondary, cursor: 'pointer',
}
