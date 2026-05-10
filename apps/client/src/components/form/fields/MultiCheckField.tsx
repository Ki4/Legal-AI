import { Check } from 'lucide-react'
import type { FieldOption } from '../../../types/form'
import { hapticSelection } from '../../../lib/telegram'

interface Props {
  id: string
  options: FieldOption[]
  value: string[]
  onChange: (val: string[]) => void
}

export function MultiCheckField({ id, options, value, onChange }: Props) {
  const toggle = (v: string) => {
    hapticSelection()
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v))
    } else {
      onChange([...value, v])
    }
  }

  return (
    <div className="flex flex-col gap-2 mt-1" role="group" aria-labelledby={id}>
      {options.map((opt) => {
        const checked = value.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            className={`w-full py-3 px-4 rounded-btn border-2 text-sm font-medium text-left transition-all duration-200 ${
              checked
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => toggle(opt.value)}
          >
            <span className="flex items-center gap-3">
              <span
                className={`w-4.5 h-4.5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  checked ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                }`}
                style={{ width: 18, height: 18 }}
              >
                {checked && <Check size={11} strokeWidth={3} className="text-white" />}
              </span>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
