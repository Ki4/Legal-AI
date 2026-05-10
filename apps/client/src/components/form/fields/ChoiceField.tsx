import type { FieldOption } from '../../../types/form'
import { hapticSelection } from '../../../lib/telegram'

interface Props {
  id: string
  options: FieldOption[]
  value: string | null
  onChange: (val: string) => void
}

export function ChoiceField({ id, options, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 mt-1" role="radiogroup" aria-labelledby={id}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`w-full py-3.5 px-4 rounded-btn border-2 text-sm font-medium text-left transition-all duration-200 ${
            value === opt.value
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => { hapticSelection(); onChange(opt.value) }}
        >
          <span className="flex items-center gap-3">
            <span
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                value === opt.value ? 'border-primary-600' : 'border-gray-300'
              }`}
            >
              {value === opt.value && (
                <span className="w-2 h-2 rounded-full bg-primary-600" />
              )}
            </span>
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  )
}
