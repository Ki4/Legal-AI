import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FormField as FormFieldType, Answers } from '../../types/form'
import { isVisible } from '../../lib/conditions'
import { cleanPhoneInput, PHONE_MAX_LENGTH } from '../../lib/form-utils'
import { FieldLabel } from './FieldLabel'
import { BooleanField } from './fields/BooleanField'
import { ChoiceField } from './fields/ChoiceField'
import { MultiCheckField } from './fields/MultiCheckField'
import { DatePickerField } from './fields/DatePickerField'

interface Props {
  field: FormFieldType
  answers: Answers
  onChange: (id: string, value: Answers[string]) => void
}

const slideDown = {
  initial: { opacity: 0, height: 0, marginTop: 0 },
  animate: { opacity: 1, height: 'auto', marginTop: 0 },
  exit: { opacity: 0, height: 0, marginTop: 0 },
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export function FormFieldRenderer({ field, answers, onChange }: Props) {
  const visible = isVisible(field, answers)
  const value = answers[field.id]
  // Only animate conditional fields; always-visible fields mount instantly
  const isConditional = !!field.show_if
  const variant = field.animation === 'fade-in' ? fadeIn : slideDown
  const fieldRef = useRef<HTMLDivElement>(null)

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key={field.id}
          ref={fieldRef}
          {...(isConditional ? variant : {})}
          initial={isConditional ? variant.initial : false}
          animate={isConditional ? variant.animate : undefined}
          exit={isConditional ? variant.exit : { opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
          onAnimationComplete={(definition) => {
            if (isConditional && definition === 'animate' && fieldRef.current) {
              setTimeout(() => {
                fieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }, 50)
            }
          }}
        >
          <div className="bg-white rounded-card shadow-card p-4 mb-3">
            <FieldLabel
              fieldId={field.id}
              label={field.label}
              required={field.required}
              hint={field.hint}
              explanation={field.explanation}
            />

            {field.type === 'text' && (
              <input
                id={field.id}
                type="text"
                className="form-input mt-1"
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
              />
            )}

            {field.type === 'phone' && (
              <input
                id={field.id}
                type="tel"
                inputMode="tel"
                className="form-input mt-1"
                placeholder={field.placeholder ?? '+380 XX XXX XX XX'}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(field.id, cleanPhoneInput(e.target.value))}
                maxLength={PHONE_MAX_LENGTH}
              />
            )}

            {field.type === 'number' && (
              <input
                id={field.id}
                type="number"
                className="form-input mt-1"
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
              />
            )}

            {field.type === 'date' && (
              <DatePickerField
                id={field.id}
                value={(value as string) ?? ''}
                onChange={(v) => onChange(field.id, v)}
                placeholder="ДД.ММ.РРРР"
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                id={field.id}
                className="form-input mt-1 resize-none"
                rows={3}
                placeholder={field.placeholder}
                value={(value as string) ?? ''}
                onChange={(e) => onChange(field.id, e.target.value)}
              />
            )}

            {field.type === 'boolean' && (
              <BooleanField
                id={field.id}
                value={value === true ? true : value === false ? false : null}
                onChange={(v) => onChange(field.id, v)}
              />
            )}

            {field.type === 'choice' && field.options && (
              <ChoiceField
                id={field.id}
                options={field.options}
                value={(value as string) ?? null}
                onChange={(v) => onChange(field.id, v)}
              />
            )}

            {field.type === 'multicheck' && field.options && (
              <MultiCheckField
                id={field.id}
                options={field.options}
                value={(value as string[]) ?? []}
                onChange={(v) => onChange(field.id, v)}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
