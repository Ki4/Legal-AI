import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CANONICAL_BLOCKS, RELATIONS } from '../lib/blockRegistry'

/**
 * Collapsible legend for the document-layout-preview (#84, §3). Explains the
 * colours: every canonical block + every integrity relation, straight from the
 * SSoT registry (blockRegistry) — no duplicated copy. Default collapsed so it
 * never overwhelms; the lawyer opens it to learn "how this works".
 */
function LegendRow({ color, label, help }: { color: string; label: string; help: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-0.5 w-3.5 h-3.5 rounded-[4px] flex-none border border-black/10"
        style={{ backgroundColor: color }}
      />
      <span className="text-[12.5px] leading-snug">
        <span className="font-semibold text-ink">{label}</span>
        <span className="text-inkMute"> — {help}</span>
      </span>
    </li>
  )
}

export function LayoutGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 border border-line rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-paperAlt hover:bg-paperAlt/70 transition-colors"
      >
        <span className="text-[12.5px] font-semibold text-inkSoft">Як це працює — легенда</span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`text-inkMute transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 py-3.5 bg-paper grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-inkMute mb-2">
              Зв'язки цілісності
            </p>
            <ul className="space-y-2">
              {RELATIONS.map((r) => (
                <LegendRow key={r.id} color={r.color} label={r.label} help={r.help_text} />
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-inkMute mb-2">
              Блоки документа
            </p>
            <ul className="space-y-2">
              {CANONICAL_BLOCKS.map((b) => (
                <LegendRow key={b.id} color={b.color} label={b.label} help={b.help_text} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
