import { Tooltip } from './Tooltip'
import { ExplanationBlock } from './ExplanationBlock'

interface Props {
  label: string
  required?: boolean
  hint?: string
  explanation?: string
  fieldId: string
}

export function FieldLabel({ label, required, hint, explanation, fieldId }: Props) {
  return (
    <div className="mb-2">
      <div className="flex items-center">
        <label htmlFor={fieldId} className="text-sm font-semibold text-gray-800">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {hint && <Tooltip text={hint} />}
      </div>
      {explanation && <ExplanationBlock text={explanation} />}
    </div>
  )
}
