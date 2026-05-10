import { hapticSelection } from '../../../lib/telegram'

interface Props {
  id: string
  value: boolean | null
  onChange: (val: boolean) => void
}

export function BooleanField({ id, value, onChange }: Props) {
  return (
    <div className="flex gap-3 mt-1" role="group" aria-labelledby={id}>
      <button
        type="button"
        className={`btn-choice ${value === true ? 'selected' : ''}`}
        onClick={() => { hapticSelection(); onChange(true) }}
      >
        Так
      </button>
      <button
        type="button"
        className={`btn-choice ${value === false ? 'selected' : ''}`}
        onClick={() => { hapticSelection(); onChange(false) }}
      >
        Ні
      </button>
    </div>
  )
}
