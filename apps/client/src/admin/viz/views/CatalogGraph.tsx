// "Карта" — the full "Що на що впливає" layered graph (law → article → service → document),
// fed by real data (nodes/edges built in vizData.buildCatalogGraph). Click a node to highlight
// its dependency chain; click a service to open its mirror; click a law change to light up the
// services it touches. Structure only — the business/revenue overlay is deferred (no metrics source).
import { useMemo, useState } from 'react'
import { RotateCcw, ArrowUpRight } from 'lucide-react'
import { C, KIND_STRIPE, KIND_TINT, KIND_LABEL, HEALTH } from '../theme'
import type { NodeKind } from '../theme'
import { KIND_ICON } from '../icons'
import type { VizNode } from '../demoData'
import type { VizService } from '../vizData'

export interface CatalogChange {
  id: string
  lawTitle: string
  date: string
  affectedSlugs: string[]
}

const STAGE_W = 1080

/** All nodes reachable up- and down-stream from `sel` along `edges` (the highlighted chain). */
function connectedChain(sel: string, edges: [string, string][]): Set<string> {
  const set = new Set<string>([sel])
  const walk = (dir: 'up' | 'down') => {
    const stack = [sel]
    while (stack.length) {
      const cur = stack.pop() as string
      edges.forEach(([from, to]) => {
        const [a, b] = dir === 'up' ? [to, from] : [from, to]
        if (a === cur && !set.has(b)) { set.add(b); stack.push(b) }
      })
    }
  }
  walk('up'); walk('down')
  return set
}

export function CatalogGraph({ nodes, edges, changes, services, onOpenService, hideChanges = false }: {
  nodes: VizNode[]
  edges: [string, string][]
  changes: CatalogChange[]
  services: VizService[]
  onOpenService: (slug: string) => void
  hideChanges?: boolean
}) {
  const [sel, setSel] = useState<string | null>(null)
  const [activeChange, setActiveChange] = useState<string | null>(null)

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])) as Record<string, VizNode>, [nodes])
  const svcMap = useMemo(() => new Map(services.map((s) => [s.slug, s])), [services])
  const stageH = useMemo(() => Math.max(560, ...nodes.map((n) => n.y + n.h)) + 24, [nodes])

  const chain = useMemo<Set<string> | null>(() => {
    if (activeChange) {
      const c = changes.find((x) => x.id === activeChange)
      if (!c) return null
      const set = new Set<string>()
      for (const slug of c.affectedSlugs) for (const id of connectedChain(slug, edges)) set.add(id)
      return set
    }
    return sel ? connectedChain(sel, edges) : null
  }, [sel, activeChange, changes, edges])

  const hi = activeChange ? C.impact : C.accent
  const ring = activeChange ? C.impactRing : C.accentRing

  const selNode = sel ? nodeMap[sel] : null
  const depends = sel ? edges.filter(([, t]) => t === sel).map(([f]) => nodeMap[f]).filter(Boolean) : []
  const affects = sel ? edges.filter(([f]) => f === sel).map(([, t]) => nodeMap[t]).filter(Boolean) : []
  const svc = selNode?.kind === 'srv' ? svcMap.get(selNode.id) : undefined

  const pickNode = (id: string) => { setSel(id); setActiveChange(null) }
  const pickChange = (c: CatalogChange) => { setActiveChange(c.id); setSel(null) }
  const reset = () => { setSel(null); setActiveChange(null) }

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 16 }}>
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
          {chain ? 'Підсвічено ланцюг звʼязків' : 'Натисніть вузол, щоб підсвітити звʼязки'}
        </span>
        <button onClick={reset} style={ghostBtn}><RotateCcw size={14} /> Скинути</button>
      </div>

      {/* stage */}
      <div style={stageWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '195px 215px 205px 165px', width: STAGE_W, margin: '0 auto 6px', padding: '0 6px' }}>
          {['Закони', 'Статті', 'Послуги', 'Форма → документ'].map((h, i) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.muted, paddingLeft: [0, 36, 38, 48][i] }}>
              {h}
            </span>
          ))}
        </div>

        <div style={{ position: 'relative', width: STAGE_W, height: stageH, margin: '0 auto' }}>
          {/* edges */}
          <svg width={STAGE_W} height={stageH} viewBox={`0 0 ${STAGE_W} ${stageH}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            {edges.map(([f, t]) => {
              const a = nodeMap[f]; const b = nodeMap[t]
              if (!a || !b) return null
              const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2
              const mx = (x1 + x2) / 2
              const lit = chain ? chain.has(f) && chain.has(t) : false
              const dim = chain ? !lit : false
              return (
                <path key={`${f}-${t}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                      fill="none" stroke={lit ? hi : dim ? C.border : '#DAD6CC'}
                      strokeWidth={lit ? 2.4 : 1.6} strokeOpacity={dim ? 0.55 : 1} strokeLinecap="round" />
              )
            })}
          </svg>

          {/* nodes */}
          {nodes.map((n) => {
            const Icon = KIND_ICON[n.kind]
            const service = svcMap.get(n.id)
            const isSrv = n.kind === 'srv' && service
            const inChain = chain ? chain.has(n.id) : true
            const dim = chain ? !inChain : false
            const stripe = isSrv ? HEALTH[service!.health].dot : KIND_STRIPE[n.kind]
            const bg = isSrv ? HEALTH[service!.health].tint : C.surface
            return (
              <div key={n.id} onClick={() => pickNode(n.id)} style={{
                position: 'absolute', left: n.x, top: n.y, width: n.w, height: n.h,
                background: bg, border: `1px solid ${inChain && chain ? hi : '#E8E6DF'}`,
                borderLeft: `3px solid ${stripe}`, borderRadius: 12, padding: '10px 13px', boxSizing: 'border-box', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'all .18s ease',
                zIndex: inChain && chain ? 4 : 2,
                boxShadow: inChain && chain ? `0 0 0 3px ${ring}, 0 8px 20px rgba(31,30,27,.09)` : '0 1px 2px rgba(31,30,27,.05)',
                opacity: dim ? 0.32 : 1, filter: dim ? 'saturate(.4)' : 'none',
                transform: n.id === sel ? 'translateY(-1px) scale(1.012)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: KIND_STRIPE[n.kind], flex: 'none', display: 'inline-flex' }}>
                    <Icon size={n.kind === 'srv' ? 18 : 16} strokeWidth={1.7} />
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.15 }}>{n.label}</span>
                </div>
                <div style={{ fontSize: 12, color: C.inkSecondary, lineHeight: 1.3, marginTop: 3 }}>{n.sub}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* detail + law changes */}
      <div style={{ display: 'grid', gridTemplateColumns: hideChanges ? '1fr' : '1fr 1fr', gap: 24, marginTop: 24 }}>
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
                  <Stat n={svc.counts.used} label="використано" tone="ok" />
                  <Stat n={svc.counts.extra} label="не в шаблоні" tone="warn" />
                  <Stat n={svc.counts.missing} label="бракує" tone="danger" />
                </div>
              )}

              {svc && (
                <button onClick={() => onOpenService(svc.slug)} style={focusBtn}>
                  <ArrowUpRight size={14} /> Відкрити дзеркало послуги
                </button>
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
        {!hideChanges && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>Зміни законів</span>
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 16px' }}>
            Натисніть зміну — на графі підсвітяться зачеплені послуги.
          </p>
          {changes.length === 0 && <div style={{ fontSize: 13, color: C.faint }}>Немає змін, що потребують перегляду.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {changes.map((c) => {
              const active = activeChange === c.id
              const touched = c.affectedSlugs.map((s) => svcMap.get(s)?.title ?? s)
              return (
                <div key={c.id} onClick={() => pickChange(c)} style={{
                  border: `1px solid ${active ? '#E3B25C' : C.border}`, background: active ? '#FCF6E8' : C.surface,
                  borderRadius: 11, padding: '13px 15px', cursor: 'pointer', transition: 'all .15s ease',
                  boxShadow: active ? '0 0 0 3px rgba(200,136,28,.14)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{c.lawTitle}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.warnInk, background: C.warnTint, border: `1px solid ${C.warnBorder}`, padding: '2px 9px', borderRadius: 999, flex: 'none', whiteSpace: 'nowrap' }}>
                      Потребує ревʼю
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {touched.length ? <>Зачеплено: {touched.join(', ')}</> : 'Послуги не визначено'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}
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
const focusBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
  background: C.accentTint, border: `1px solid ${C.accentBorder}`, borderRadius: 10,
  padding: '9px 13px', marginBottom: 18, fontSize: 13, fontWeight: 600, color: C.accent, cursor: 'pointer',
}
