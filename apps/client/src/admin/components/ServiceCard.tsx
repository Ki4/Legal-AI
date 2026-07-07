// Service card in the Claude Design canvas language (icon tile · health dot · status pill ·
// Lucide icon actions · hover lift). Presentational — DashboardPage feeds it computed props.
import { Briefcase, Eye, Pencil, Trash2 } from 'lucide-react'
import type { ServiceStatus } from '../../lib/serviceStatus'
import { STATUS_META, statusActions } from '../../lib/serviceStatus'

export interface ServiceCardProps {
  title: string
  description: string
  fields: number
  tabs: number
  price: number
  healthDot: string   // tailwind bg-* token for the health dot
  healthTitle: string
  status: ServiceStatus
  formHref: string
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onStatus: (to: ServiceStatus) => void
}

export function ServiceCard(p: ServiceCardProps) {
  const meta = STATUS_META[p.status]
  return (
    <div className="bg-paper border border-line rounded-[14px] p-5 flex flex-col gap-4
                    hover:border-lineStrong hover:shadow-card-hover transition-all">
      {/* header: icon tile + title + description */}
      <button onClick={p.onOpen} className="flex items-start gap-3.5 text-left group/h" title="Переглянути анатомію послуги">
        <div className="w-[42px] h-[42px] flex-shrink-0 rounded-[11px] bg-brand/10 border border-brand/20
                        text-brand flex items-center justify-center">
          <Briefcase size={21} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink leading-tight truncate group-hover/h:text-brand transition-colors">
            {p.title || 'Без назви'}
          </h3>
          <p className="text-[13.5px] text-inkSoft leading-snug mt-0.5 line-clamp-2">
            {p.description || 'Опис не вказано'}
          </p>
        </div>
      </button>

      {/* meta: health dot + counts (no emoji) */}
      <div className="flex items-center gap-4 text-[12.5px] text-inkMute">
        <span className="inline-flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${p.healthDot}`} title={p.healthTitle} />
          {p.healthTitle.split(' — ')[0]}
        </span>
        <span>{p.fields} полів</span>
        <span>{p.tabs} таби</span>
        {p.price > 0 && <span>{p.price} ₴</span>}
      </div>

      {/* footer: status pill + lifecycle actions + icon buttons.
          flex-wrap so a crowded row (e.g. needs_review = pill + 2 actions + 3 icons)
          drops the icon group to a new line instead of overflowing the card edge. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-4 border-t border-line">
        <span className={`inline-flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-semibold whitespace-nowrap ${meta.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>

        {statusActions(p.status).map((a) => (
          <button
            key={a.to}
            onClick={() => p.onStatus(a.to)}
            className={`px-2.5 py-1 rounded-lg text-[12.5px] font-medium whitespace-nowrap flex-shrink-0 transition-colors
              ${a.variant === 'primary' ? 'bg-brand/10 text-brand hover:bg-brand/20' : 'text-inkSoft hover:bg-paperAlt'}`}
          >
            {a.label}
          </button>
        ))}

        <div className="flex items-center gap-1 text-inkMute ml-auto">
          <a href={p.formHref} target="_blank" rel="noreferrer" title="Переглянути форму"
             className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-paperAlt hover:text-ink transition-colors">
            <Eye size={16} strokeWidth={1.7} />
          </a>
          <button onClick={p.onEdit} title="Редагувати"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-paperAlt hover:text-ink transition-colors">
            <Pencil size={15} strokeWidth={1.7} />
          </button>
          <button onClick={p.onDelete} title="Видалити"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 hover:text-danger transition-colors">
            <Trash2 size={15} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </div>
  )
}
