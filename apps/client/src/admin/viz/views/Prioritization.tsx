// Layer 5 — Prioritization. Structure laid over money: a demand × health × revenue bubble chart
// plus a sortable table and a "biggest lever" insight (fixing what unblocks the most).
import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, Zap } from 'lucide-react'
import { C, HEALTH, uah, num } from '../theme'
import { SERVICES, NODES } from '../demoData'
import type { ServiceMetrics } from '../demoData'

const healthScore = (s: ServiceMetrics): number =>
  Math.round(({ ok: 90, warn: 55, problem: 15 }[s.health]) + s.conversion * 8)

const recommendation = (s: ServiceMetrics): string => {
  if (s.fields.missing > 0 && s.status === 'draft') return `зібрати форму (${s.fields.missing} полів)`
  if (s.fields.missing > 0) return `додати ${s.fields.missing} поля у форму`
  if (s.fields.extra > 0) return `прибрати ${s.fields.extra} зайвих поля`
  return '—'
}

export function Prioritization() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <LeverInsight />
      <div style={card}>
        <Bubble />
      </div>
      <div style={card}>
        <Table />
      </div>
    </div>
  )
}

// ── biggest-lever insight ────────────────────────────────────────────────────
function LeverInsight() {
  const lever = useMemo(() => {
    const arts = NODES.filter((n) => n.kind === 'art')
    const scored = arts.map((a) => {
      const svcs = SERVICES.filter((s) => s.articles.includes(a.id))
      return { art: a, count: svcs.length, revenue: svcs.reduce((sum, s) => sum + s.revenue, 0), services: svcs }
    })
    scored.sort((x, y) => y.count - x.count || y.revenue - x.revenue)
    return scored[0]
  }, [])

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', border: `1px solid ${C.accentBorder}`, background: C.accentTint, borderRadius: 16, padding: '18px 22px' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: C.surface, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap size={19} color={C.accent} strokeWidth={1.8} />
      </span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>Найбільший важіль</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
          {lever.art.label} «{lever.art.sub}» живить {lever.count} послуги
        </div>
        <div style={{ fontSize: 13, color: C.inkSecondary }}>
          Виправлення на цьому вузлі впливає на {lever.services.map((s) => s.title).join(', ')} —
          сукупно <b>{uah(lever.revenue)}/міс</b>. Один фікс — найбільший охоплений дохід.
        </div>
      </div>
    </div>
  )
}

// ── bubble chart ─────────────────────────────────────────────────────────────
function Bubble() {
  const W = 720, H = 380
  const padL = 52, padB = 44, padT = 16, padR = 20
  const plotW = W - padL - padR, plotH = H - padT - padB
  const maxX = 40 // requests/mo
  const x = (v: number) => padL + (v / maxX) * plotW
  const y = (v: number) => padT + (1 - v / 100) * plotH
  const r = (rev: number) => 10 + Math.sqrt(rev) / 7 // area ~ revenue

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Попит × Здоровʼя × Виручка</div>
      <p style={{ fontSize: 12.5, color: C.muted, margin: '0 0 12px' }}>
        Вісь X — попит (заявки/міс), вісь Y — здоровʼя послуги, площа кола — виручка. Правий-нижній кут =
        попит є, а послуга зламана → чинити першою.
      </p>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        {/* quadrant tint: high demand / low health */}
        <rect x={x(maxX / 2)} y={y(50)} width={plotW / 2} height={plotH / 2} fill={C.dangerTint} opacity={0.5} />
        <text x={x(maxX) - 8} y={y(6)} textAnchor="end" fontSize={11} fill={C.dangerInk} opacity={0.8}>чинити першими</text>

        {/* gridlines */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padL} y1={y(g)} x2={W - padR} y2={y(g)} stroke={C.hair} />
            <text x={padL - 8} y={y(g) + 3} textAnchor="end" fontSize={10.5} fill={C.muted}>{g}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40].map((g) => (
          <text key={g} x={x(g)} y={H - padB + 16} textAnchor="middle" fontSize={10.5} fill={C.muted}>{g}</text>
        ))}
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={C.borderStrong} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={C.borderStrong} />
        <text x={padL - 36} y={padT + plotH / 2} textAnchor="middle" fontSize={11} fill={C.inkSecondary} transform={`rotate(-90 ${padL - 36} ${padT + plotH / 2})`}>здоровʼя, %</text>
        <text x={padL + plotW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={C.inkSecondary}>попит, заявок/міс</text>

        {/* bubbles */}
        {SERVICES.map((s) => {
          const h = HEALTH[s.health]
          const cx = x(s.requestsPerMonth), cy = y(healthScore(s)), rr = r(s.revenue)
          return (
            <g key={s.id}>
              <circle cx={cx} cy={cy} r={rr} fill={h.tint} stroke={h.dot} strokeWidth={1.8} />
              <circle cx={cx} cy={cy} r={3} fill={h.dot} />
              <text x={cx} y={cy - rr - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.ink}>{s.title}</text>
              <text x={cx} y={cy - rr + 9} textAnchor="middle" fontSize={10.5} fill={C.muted}>{s.revenue ? uah(s.revenue) + '/міс' : 'не запущена'}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── sortable table ───────────────────────────────────────────────────────────
type Key = 'title' | 'requestsPerMonth' | 'revenue' | 'conversion' | 'abandoned' | 'health'
interface Col { key: Key; label: string; align?: 'right' }
const COLS: Col[] = [
  { key: 'title', label: 'Послуга' },
  { key: 'requestsPerMonth', label: 'Заявки/міс', align: 'right' },
  { key: 'revenue', label: 'Виручка/міс', align: 'right' },
  { key: 'conversion', label: 'Конверсія', align: 'right' },
  { key: 'abandoned', label: 'Покинуто', align: 'right' },
  { key: 'health', label: 'Стан' },
]
const HEALTH_RANK: Record<string, number> = { problem: 0, warn: 1, ok: 2 }

function Table() {
  const [sortKey, setSortKey] = useState<Key>('requestsPerMonth')
  const [dir, setDir] = useState<1 | -1>(-1)

  const rows = useMemo(() => {
    const val = (s: ServiceMetrics): number | string =>
      sortKey === 'title' ? s.title : sortKey === 'health' ? HEALTH_RANK[s.health] : (s[sortKey] as number)
    return [...SERVICES].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
  }, [sortKey, dir])

  function sortBy(k: Key) {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(k); setDir(k === 'title' ? 1 : -1) }
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Послуги за пріоритетом</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => sortBy(c.key)}
                  style={{ textAlign: c.align ?? 'left', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.muted, fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
                    {c.label}
                    {sortKey === c.key && (dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
              ))}
              <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${C.border}`, color: C.muted, fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>Що чинити</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const h = HEALTH[s.health]
              return (
                <tr key={s.id}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{s.title}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{num(s.requestsPerMonth)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{uah(s.revenue)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{s.conversion ? Math.round(s.conversion * 100) + '%' : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: s.abandoned > 12 ? C.dangerInk : C.inkSecondary }}>{num(s.abandoned)}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: h.ink, background: h.tint, border: `1px solid ${h.border}`, padding: '3px 10px', borderRadius: 999 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: h.dot }} />{h.label}
                    </span>
                  </td>
                  <td style={{ ...td, color: recommendation(s) === '—' ? C.faint : C.ink }}>{recommendation(s)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 18, padding: 24,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
const td: React.CSSProperties = { padding: '11px 12px', borderBottom: `1px solid ${C.hair}`, color: C.inkSecondary, whiteSpace: 'nowrap' }
