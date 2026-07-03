import { useMemo, useState } from 'react'
import type { FormConfig } from '../../types/form'
import { splitAnnotated } from '../lib/annotatedContext'
import { detectBlocks, type DetectedBlock } from '../lib/detectBlocks'
import { renderAnnotatedPreview, renderPreview } from '../lib/documentPreview'
import { sampleAnswersFor } from '../lib/sampleAnswers'
import { Card } from '../ui'

/**
 * Live preview of the REAL court-ready document, rendered in-browser via the
 * doc-engine (SSoT, '@doc-engine' alias). Three modes:
 *   • «Заповнений приклад» (default when a sample exists) — realistic answers so
 *     the lawyer sees the finished document, not a skeleton (A5, session 48).
 *   • «Порожній шаблон» — answers stripped → '________' placeholders, showing the
 *     raw template shape.
 *   • «Показати змінні» (template-editor §4c, only when formConfig has steps) —
 *     unfilled form fields render as gray inline chips labeled with the field's
 *     Ukrainian label, digitalved-parity. Computed values stay '________'.
 * One renderer (doc-engine), so the preview can never drift from n8n output.
 */

type Mode = 'sample' | 'empty' | 'vars'

const MODE_HINT: Record<Mode, string> = {
  sample:
    'Приклад документа на вигаданих даних — так його побачить клієнт. Збирається рушієм генерації з відповідей форми.',
  empty:
    'Порожній шаблон — поля показані як «________». Реальний документ збирається з відповідей форми тим самим рушієм.',
  vars:
    'Сірі позначки — поля форми, які заповнить клієнт. Обчислювані значення (ПІБ разом, суми) тут показані як ________.',
}

/** One rendered line in «Показати змінні» mode: text parts + labeled field chips. */
function AnnotatedLine({ text, labelById }: { text: string; labelById: Map<string, string> }) {
  const parts = splitAnnotated(text)
  if (parts.length === 0) return <>{' '}</>
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'chip' ? (
          <span
            key={i}
            className="inline-block align-baseline bg-paperAlt border border-line rounded px-1.5 py-0 text-[11px] text-inkSoft font-sans whitespace-nowrap"
          >
            {labelById.get(part.value) ?? part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  )
}

export function DocumentPreview({
  template,
  slug,
  formConfig,
  showBlocks = false,
}: {
  template: string | null
  slug?: string | null
  formConfig?: FormConfig | null
  /** Template-editor §5: read-only block labels (blockRegistry colours) at the
   *  start of each detected canonical block. On a parse error the whole render
   *  fails, so the labels honestly disappear with it. */
  showBlocks?: boolean
}) {
  const sample = useMemo(() => sampleAnswersFor(slug), [slug])
  const hasVars = !!formConfig && formConfig.steps.length > 0
  const [rawMode, setMode] = useState<Mode>(sample ? 'sample' : 'empty')
  // If the form config loses its fields while 'vars' is selected, degrade to 'empty'.
  const mode: Mode = rawMode === 'vars' && !hasVars ? 'empty' : rawMode

  const result = useMemo(() => {
    if (!template) return null
    if (mode === 'vars' && formConfig) {
      return renderAnnotatedPreview(template, formConfig.steps.map((s) => s.id))
    }
    return renderPreview(template, mode === 'sample' && sample ? sample : {})
  }, [template, mode, sample, formConfig])

  // Chip label = the form field's Ukrainian label; fallback to the raw id.
  const labelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of formConfig?.steps ?? []) map.set(f.id, f.label || f.id)
    return map
  }, [formConfig])

  // Block labels (§5): detect canonical blocks on the SAME render the paragraphs
  // came from (paragraphs ↔ text lines are 1:1). Unknown spans get no label —
  // fail-closed, same as the layout preview.
  const blockAtLine = useMemo(() => {
    const map = new Map<number, DetectedBlock>()
    if (!showBlocks || !result?.ok || result.text === undefined) return map
    for (const b of detectBlocks(result.text, result.styleHints ?? {})) {
      if (b.id !== 'unknown') map.set(b.startPara, b)
    }
    return map
  }, [showBlocks, result])

  const modeOptions: Array<[Mode, string]> = []
  if (sample) modeOptions.push(['sample', 'Заповнений приклад'])
  modeOptions.push(['empty', 'Порожній шаблон'])
  if (hasVars) modeOptions.push(['vars', 'Показати змінні'])

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
        <p className="text-[12.5px] text-inkMute">{MODE_HINT[mode]}</p>
        {modeOptions.length > 1 && (
          <div className="inline-flex bg-paperAlt rounded-lg p-1 gap-1 flex-none">
            {modeOptions.map(([m, label]) => (
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
          {result?.paragraphs.map((p, i) => {
            const block = blockAtLine.get(i)
            return (
              <div key={i}>
                {block && (
                  <div className="select-none font-sans mt-4 mb-1 first:mt-0" aria-hidden>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: block.color }}
                    >
                      <span className="w-2 h-2 rounded-full flex-none" style={{ background: block.color }} />
                      {block.label}
                    </span>
                  </div>
                )}
                <div className={p.className || undefined}>
                  {mode === 'vars' ? (
                    <AnnotatedLine text={p.text} labelById={labelById} />
                  ) : p.segments ? (
                    // Inline runs (styleHints v2): {{#bold}}…{{/bold}} renders bold
                    // right in the preview; segments concatenate back to p.text.
                    p.segments.map((s, j) => (
                      <span key={j} className={s.className || undefined}>
                        {s.text}
                      </span>
                    ))
                  ) : (
                    p.text || ' '
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
