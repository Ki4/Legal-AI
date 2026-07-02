import { useMemo } from 'react'
import {
  analyzeTemplate,
  diffFormVsTemplate,
  providedContextKeys,
} from '../../lib/serviceAnatomy'
import type { FormConfig } from '../../types/form'

/**
 * Variable palette for the template editor (specs/features/template-editor §4b).
 * Engine-free: badges reuse the pure serviceAnatomy diff, insertion is delegated
 * to the panel via onInsert('{{id}}').
 */

const CHIP =
  'inline-flex items-center gap-1.5 max-w-full px-2 py-1 text-xs text-left ' +
  'bg-paperAlt hover:bg-paperAlt/70 border border-line rounded-lg transition-colors'

export function VariablePalette({
  formConfig,
  template,
  onInsert,
}: {
  formConfig: FormConfig
  template: string
  onInsert: (token: string) => void
}) {
  const unused = useMemo(() => {
    const diff = diffFormVsTemplate(formConfig, analyzeTemplate(template))
    return new Set(diff.unusedFields)
  }, [formConfig, template])

  const fields = formConfig.steps ?? []
  const computed = providedContextKeys()

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <button
            key={f.id}
            type="button"
            title={`Вставити {{${f.id}}}`}
            onClick={() => onInsert(`{{${f.id}}}`)}
            className={CHIP}
          >
            <span className="text-ink truncate">{f.label || f.id}</span>
            <code className="text-[11px] text-inkMute font-mono">{f.id}</code>
            {unused.has(f.id) && (
              <span className="text-[10px] font-semibold text-warn bg-warn/10 border border-warn/20 rounded-full px-1.5 py-px whitespace-nowrap">
                не в шаблоні
              </span>
            )}
          </button>
        ))}
        {fields.length === 0 && (
          <p className="text-xs text-inkMute">Форма ще не має полів.</p>
        )}
      </div>

      <details>
        <summary className="text-xs font-semibold text-inkSoft cursor-pointer select-none">
          Обчислювані поля (рушій)
        </summary>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {computed.map((key) => (
            <button
              key={key}
              type="button"
              title={`Вставити {{${key}}} — обчислюється рушієм з відповідей`}
              onClick={() => onInsert(`{{${key}}}`)}
              className={CHIP}
            >
              <code className="text-[11px] text-brand font-mono">{key}</code>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
