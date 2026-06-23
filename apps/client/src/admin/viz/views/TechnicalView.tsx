// Layer 3 — Technical. How a service is actually implemented end to end:
// form → n8n → Supabase → template → PDF, with a health dot per stage.
import { ChevronRight } from 'lucide-react'
import { C, MONO, HEALTH } from '../theme'
import { DIVORCE_PIPELINE } from '../demoData'

export function TechnicalView() {
  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 18px', maxWidth: 640 }}>
        Технічний конвеєр послуги «Розірвання шлюбу»: від форми клієнта до готового PDF. Жовтий вузол —
        де ланцюг провисає (шаблон чекає поля, яких форма не збирає).
      </p>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {DIVORCE_PIPELINE.map((s, i) => {
            const h = HEALTH[s.status]
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 196, flex: 'none', border: `1px solid ${s.status === 'ok' ? C.border : h.border}`, background: s.status === 'ok' ? C.surface : h.tint, borderRadius: 14, padding: 16, boxShadow: '0 1px 2px rgba(31,30,27,.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: h.dot, flex: 'none' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted }}>{`0${i + 1}`}</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.accent, marginBottom: 8 }}>{s.tech}</div>
                  <div style={{ fontSize: 12.5, color: C.inkSecondary, lineHeight: 1.4 }}>{s.detail}</div>
                </div>
                {i < DIVORCE_PIPELINE.length - 1 && (
                  <ChevronRight size={22} color={C.faint} style={{ margin: '0 6px', flex: 'none' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        {(['ok', 'warn', 'problem'] as const).map((k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: C.inkSecondary }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: HEALTH[k].dot }} />
            {HEALTH[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  border: `1px solid ${C.border}`, background: C.surface, borderRadius: 18, padding: 24,
  boxShadow: '0 1px 3px rgba(31,30,27,.04)',
}
