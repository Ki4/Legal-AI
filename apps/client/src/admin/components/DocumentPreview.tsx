import { useMemo } from 'react'
import { renderPreview } from '../lib/documentPreview'
import { Card } from '../ui'

/**
 * Live preview of the REAL court-ready document, rendered in-browser via the
 * doc-engine (SSoT, '@doc-engine' alias). Empty answers → skeleton with '________'
 * placeholders — faithful to what n8n produces, no second renderer to drift.
 * Picks up the slice deliberately deferred in DECISIONS #66 (now that the engine
 * is verified pure-JS, session 47).
 */
export function DocumentPreview({ template }: { template: string | null }) {
  const result = useMemo(() => (template ? renderPreview(template) : null), [template])

  if (!template) {
    return (
      <div className="text-center py-12 text-inkMute text-sm">
        Ця послуга ще не має шаблону документа — превʼю недоступне.
      </div>
    )
  }

  if (result && !result.ok) {
    return (
      <div className="text-center py-12 text-danger text-sm">
        Не вдалося відрендерити превʼю: {result.error}
      </div>
    )
  }

  return (
    <div>
      <p className="text-[12.5px] text-inkMute mb-3">
        Превʼю порожнього шаблону — поля показані як «________». Реальний документ збирається з
        відповідей форми клієнта тим самим рушієм.
      </p>
      <Card className="bg-paper p-8 md:p-10 max-h-[70vh] overflow-y-auto shadow-card">
        <div className="mx-auto max-w-[680px] font-serif text-[13px] leading-relaxed text-ink">
          {result?.paragraphs.map((p, i) => (
            <div key={i} className={p.className || undefined}>{p.text || ' '}</div>
          ))}
        </div>
      </Card>
    </div>
  )
}
