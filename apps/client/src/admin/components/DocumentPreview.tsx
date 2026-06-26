import { useMemo, useState } from 'react'
import { renderPreview } from '../lib/documentPreview'
import { sampleAnswersFor } from '../lib/sampleAnswers'
import { Card } from '../ui'

/**
 * Live preview of the REAL court-ready document, rendered in-browser via the
 * doc-engine (SSoT, '@doc-engine' alias). Two modes:
 *   • «Заповнений приклад» (default when a sample exists) — realistic answers so
 *     the lawyer sees the finished document, not a skeleton (A5, session 48).
 *   • «Порожній шаблон» — answers stripped → '________' placeholders, showing the
 *     raw template shape.
 * One renderer (doc-engine), so the preview can never drift from n8n output.
 */
export function DocumentPreview({ template, slug }: { template: string | null; slug?: string | null }) {
  const sample = useMemo(() => sampleAnswersFor(slug), [slug])
  const [mode, setMode] = useState<'sample' | 'empty'>(sample ? 'sample' : 'empty')

  const answers = mode === 'sample' && sample ? sample : {}
  const result = useMemo(() => (template ? renderPreview(template, answers) : null), [template, answers])

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[12.5px] text-inkMute">
          {mode === 'sample'
            ? 'Приклад документа на вигаданих даних — так його побачить клієнт. Збирається рушієм генерації з відповідей форми.'
            : 'Порожній шаблон — поля показані як «________». Реальний документ збирається з відповідей форми тим самим рушієм.'}
        </p>
        {sample && (
          <div className="inline-flex bg-paperAlt rounded-lg p-1 gap-1 flex-none">
            {([['sample', 'Заповнений приклад'], ['empty', 'Порожній шаблон']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                      className={`px-3 py-1 rounded-md text-[12.5px] font-medium transition-colors ${mode === m ? 'bg-paper text-ink shadow-sm' : 'text-inkMute hover:text-ink'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <Card className="bg-paper p-8 md:p-10 max-h-[70vh] overflow-y-auto shadow-card">
        <div className="mx-auto max-w-[680px] font-serif text-[13px] leading-relaxed text-ink">
          {result?.paragraphs.map((p, i) => (
            <div key={i} className={p.className || undefined}>{p.text || ' '}</div>
          ))}
        </div>
      </Card>
    </div>
  )
}
