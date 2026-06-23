// Layer 4 — Form branching (algorithm). The conditional logic of the form as a decision tree:
// which fields/tabs appear depending on answers. Mirrors the show_if rules in demoData.
import { Flag, GitBranch, Play, FileCheck2 } from 'lucide-react'
import { C } from '../theme'
import { DIVORCE_FLOW } from '../demoData'
import type { FlowStep, FieldMapping } from '../demoData'

const FLAG: Record<FieldMapping, { dot: string; ink: string; tint: string; bd: string; note: string }> = {
  used:    { dot: C.ok,     ink: C.okInk,     tint: C.okTint,     bd: C.okBorder,     note: '' },
  extra:   { dot: C.warn,   ink: C.warnInk,   tint: C.warnTint,   bd: C.warnBorder,   note: 'не в шаблоні' },
  missing: { dot: C.danger, ink: C.dangerInk, tint: C.dangerTint, bd: C.dangerBorder, note: 'бракує у формі' },
}

export function FormBranching() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 18px', maxWidth: 640 }}>
        Алгоритм форми «Розірвання шлюбу»: ромб — питання-розгалуження, гілка «так» відкриває додаткові
        поля. Так видно справжню складність послуги та де поле висить на гілці, якої немає в шаблоні.
      </p>

      <div style={card}>
        <Spine steps={DIVORCE_FLOW} depth={0} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, fontSize: 12.5, color: C.inkSecondary }}>
        <Lg color={C.accent} label="Старт / документ" />
        <Lg color={C.inkSecondary} label="Поле завжди" />
        <Lg color={C.warn} label="Розгалуження (ромб)" />
        <Lg color={C.danger} label="Поле, якого бракує у формі" />
      </div>
    </div>
  )
}

function Spine({ steps, depth }: { steps: FlowStep[]; depth: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {steps.map((s, i) => (
        <Step key={s.id} step={s} last={i === steps.length - 1} depth={depth} />
      ))}
    </div>
  )
}

function Step({ step, last, depth }: { step: FlowStep; last: boolean; depth: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <Node step={step} />
        {step.kind === 'gate' && step.yes && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.ok, background: C.okTint, border: `1px solid ${C.okBorder}`, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>так →</span>
            <div style={{ borderLeft: `2px dashed ${C.borderStrong}`, paddingLeft: 16 }}>
              <Spine steps={step.yes} depth={depth + 1} />
            </div>
          </div>
        )}
      </div>
      {!last && <div style={{ width: 2, height: 18, background: C.borderStrong, marginLeft: step.kind === 'gate' ? 16 : 22 }} />}
    </div>
  )
}

function Node({ step }: { step: FlowStep }) {
  if (step.kind === 'gate') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: C.warnTint, border: `1px solid ${C.warnBorder}`, borderRadius: 11, padding: '10px 14px', boxShadow: '0 1px 2px rgba(31,30,27,.05)' }}>
        <GitBranch size={15} color={C.warnInk} strokeWidth={1.8} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.warnInk }}>{step.label}</span>
      </div>
    )
  }
  if (step.kind === 'field') {
    const f = FLAG[step.flag ?? 'used']
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: f.tint, border: `1px solid ${f.bd}`, borderRadius: 9, padding: '7px 12px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: f.dot, flex: 'none' }} />
        <span style={{ fontSize: 13, color: f.ink, fontWeight: 500 }}>{step.label}</span>
        {f.note && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: f.ink, opacity: 0.85 }}>
            <Flag size={11} strokeWidth={2} /> {f.note}
          </span>
        )}
      </div>
    )
  }
  // start / always / end
  const terminal = step.kind === 'start' || step.kind === 'end'
  const Icon = step.kind === 'start' ? Play : step.kind === 'end' ? FileCheck2 : null
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: terminal ? C.accentTint : C.surface, border: `1px solid ${terminal ? C.accentBorder : C.border}`, borderRadius: 11, padding: '10px 14px', boxShadow: '0 1px 2px rgba(31,30,27,.05)' }}>
      {Icon && <Icon size={15} color={C.accent} strokeWidth={1.9} />}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: terminal ? C.accent : C.ink, lineHeight: 1.1 }}>{step.label}</div>
        {step.hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{step.hint}</div>}
      </div>
    </div>
  )
}

const Lg = ({ color, label }: { color: string; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
    <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
    {label}
  </span>
)

const card: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 18, padding: 28,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
