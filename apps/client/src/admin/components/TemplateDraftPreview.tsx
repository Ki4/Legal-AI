import { useEffect, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import type { FormConfig } from '../../types/form'
import { DocumentPreview } from './DocumentPreview'
import { DocumentLayoutPreview } from './DocumentLayoutPreview'

/**
 * Live preview of the template DRAFT for the editor tab: «Документ» (readable
 * text, default) / «Розкладка» (A4 pages — shows the real effect of
 * page-break-before / keep-together). Both reuse the existing preview components,
 * so what the lawyer sees is exactly what publishing will produce.
 *
 * The side-panel copy is cramped, so clicking the preview (or the ⤢ button)
 * opens the same content as a full-screen overlay — Esc / ✕ closes it. Plain
 * conditional render (no AnimatePresence) per the ConfirmModal overlay gotcha.
 */
export function TemplateDraftPreview({
  template,
  slug,
  formConfig,
  caretLine = null,
}: {
  template: string | null
  slug?: string | null
  formConfig?: FormConfig | null
  /** S2 slice C: editor caret line for the caret↔paragraph sync-highlight
   *  («Документ» view only — the layout view has its own pagination). */
  caretLine?: number | null
}) {
  const [view, setView] = useState<'document' | 'layout'>('document')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const tabs = (
    <>
      {([['document', 'Документ'], ['layout', 'Розкладка']] as const).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors ${
            view === v ? 'bg-paperAlt text-ink' : 'text-inkMute hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </>
  )

  const body =
    view === 'document' ? (
      <DocumentPreview
        template={template}
        slug={slug}
        formConfig={formConfig}
        showBlocks
        caretLine={caretLine}
      />
    ) : (
      <DocumentLayoutPreview template={template} slug={slug} />
    )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-line flex-shrink-0">
        {tabs}
        <span className="ml-auto text-[11px] text-inkMute">чернетка</span>
        <button
          type="button"
          title="Відкрити превʼю на весь екран"
          aria-label="Відкрити превʼю на весь екран"
          onClick={() => setFullscreen(true)}
          className="p-1.5 text-inkMute hover:text-ink rounded-lg hover:bg-paperAlt transition-colors"
        >
          <Maximize2 size={14} aria-hidden />
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto p-4 cursor-zoom-in"
        title="Клацніть, щоб відкрити на весь екран"
        onClick={() => setFullscreen(true)}
      >
        {body}
      </div>

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Превʼю документа на весь екран"
          className="fixed inset-0 z-50 bg-paper flex flex-col"
        >
          <div className="flex items-center gap-1 px-6 py-3 border-b border-line flex-shrink-0">
            {tabs}
            <span className="ml-auto text-[11px] text-inkMute mr-2">чернетка</span>
            <button
              type="button"
              title="Закрити (Esc)"
              aria-label="Закрити превʼю"
              onClick={() => setFullscreen(false)}
              className="p-2 text-inkMute hover:text-ink rounded-lg hover:bg-paperAlt transition-colors"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto">{body}</div>
          </div>
        </div>
      )}
    </div>
  )
}
