import { useState } from 'react'
import { DocumentPreview } from './DocumentPreview'
import { DocumentLayoutPreview } from './DocumentLayoutPreview'

/**
 * Live preview of the template DRAFT for the editor tab: «Документ» (readable
 * text, default) / «Розкладка» (A4 pages — shows the real effect of
 * page-break-before / keep-together). Both reuse the existing preview components,
 * so what the lawyer sees is exactly what publishing will produce.
 */
export function TemplateDraftPreview({ template, slug }: { template: string | null; slug?: string | null }) {
  const [view, setView] = useState<'document' | 'layout'>('document')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-line flex-shrink-0">
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
        <span className="ml-auto text-[11px] text-inkMute">чернетка</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {view === 'document'
          ? <DocumentPreview template={template} slug={slug} />
          : <DocumentLayoutPreview template={template} slug={slug} />}
      </div>
    </div>
  )
}
