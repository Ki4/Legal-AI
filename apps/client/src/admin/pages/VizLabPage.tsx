// Visualization lab — a standalone light canvas (the design Sergey likes) to compare ways of
// showing how services are built: catalog graph · service detail · technical pipeline ·
// form-branching algorithm · prioritization. Demo data only; route: /viz-lab.
import { useState } from 'react'
import { Network, Briefcase, Workflow, GitBranch, BarChart3, Landmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { C, FONT } from '../viz/theme'
import { CatalogGraph } from '../viz/views/CatalogGraph'
import { ServiceDetail } from '../viz/views/ServiceDetail'
import { TechnicalView } from '../viz/views/TechnicalView'
import { FormBranching } from '../viz/views/FormBranching'
import { Prioritization } from '../viz/views/Prioritization'

interface ViewDef {
  id: string
  num: string
  label: string
  desc: string
  icon: LucideIcon
  Component: () => React.ReactElement
}

const VIEWS: ViewDef[] = [
  { id: 'catalog',  num: '01', label: 'Каталог',          desc: 'Що на що впливає — усі послуги', icon: Network,   Component: CatalogGraph },
  { id: 'service',  num: '02', label: 'Послуга детально', desc: 'Розбір однієї послуги · 3 макети', icon: Briefcase, Component: ServiceDetail },
  { id: 'tech',     num: '03', label: 'Технічна',         desc: 'Як реалізовано: форма → PDF',     icon: Workflow,  Component: TechnicalView },
  { id: 'flow',     num: '04', label: 'Алгоритм форми',   desc: 'Розгалуження за відповідями',     icon: GitBranch, Component: FormBranching },
  { id: 'priority', num: '05', label: 'Пріоритизація',    desc: 'Що чинити першим · ROI',          icon: BarChart3, Component: Prioritization },
]

const GEIST_FONT = `
@font-face{font-family:'Geist';font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/cyrillic-400-normal.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}
@font-face{font-family:'Geist';font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-400-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122;}
@font-face{font-family:'Geist';font-weight:600;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/cyrillic-600-normal.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}
@font-face{font-family:'Geist';font-weight:600;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-600-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122;}
@font-face{font-family:'Geist Mono';font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-mono@latest/cyrillic-400-normal.woff2) format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}
@font-face{font-family:'Geist Mono';font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/fontsource/fonts/geist-mono@latest/latin-400-normal.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+2122;}
`

export function VizLabPage() {
  const [active, setActive] = useState('catalog')
  const view = VIEWS.find((v) => v.id === active) as ViewDef

  return (
    <div style={{ minHeight: '100vh', background: C.canvas, color: C.ink, fontFamily: FONT, WebkitFontSmoothing: 'antialiased' }}>
      <style>{GEIST_FONT}</style>

      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(250,249,245,.82)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0E4D6E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Landmark size={17} strokeWidth={1.7} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em' }}>Legal AI</span>
              <span style={{ fontSize: 11, color: C.muted }}>Карта звʼязків · viz-lab</span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: C.muted }}>демо-дані · прототип</span>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '0 32px 80px' }}>
        {/* intro */}
        <section style={{ padding: '40px 0 24px' }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', margin: '0 0 8px' }}>Як влаштовані послуги</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.inkSecondary, margin: 0, maxWidth: 720 }}>
            П'ять способів подивитися на одне й те саме: від карти всіх послуг до алгоритму однієї форми та
            пріоритизації за грошима. Обери шар і порівняй.
          </p>
        </section>

        {/* view switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 28 }}>
          {VIEWS.map((v) => {
            const on = v.id === active
            const Icon = v.icon
            return (
              <button
                key={v.id}
                onClick={() => setActive(v.id)}
                style={{
                  textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '14px 15px',
                  background: on ? C.surface : 'transparent',
                  border: `1px solid ${on ? C.accentBorder : C.border}`,
                  boxShadow: on ? '0 4px 16px rgba(37,99,235,.10)' : 'none',
                  transition: 'all .15s ease', fontFamily: FONT,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon size={17} color={on ? C.accent : C.muted} strokeWidth={1.8} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: on ? C.accent : C.muted, fontFamily: 'monospace' }}>{v.num}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: on ? C.ink : C.inkSecondary, marginBottom: 2 }}>{v.label}</div>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.35 }}>{v.desc}</div>
              </button>
            )
          })}
        </div>

        {/* active view */}
        <section style={{ paddingBottom: 24 }}>
          <view.Component />
        </section>
      </main>
    </div>
  )
}
