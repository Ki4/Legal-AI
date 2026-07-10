/**
 * form_config → raw JSON Schema for an MCP tool inputSchema (plan D2).
 *
 * Tool params are the RAW form answers — the exact field ids and value formats
 * the Telegram Mini App submits (dates ISO 'YYYY-MM-DD', money as strings,
 * choice = option value, multicheck = option value[]). Descriptions are
 * Ukrainian — they are the interview contract the LLM follows.
 *
 * `required` lists ONLY unconditionally-required fields (required: true and no
 * show_if). Conditionally-required fields, default maxLength caps and format
 * checks are enforced server-side by the validate engine — the schema carries
 * only an explicit field.maxLength.
 */

import type { FieldOption, FormConfig, FormField } from './types.js'
import type { ValidationRule } from './validators.js'
import { resolveValidationRule } from './validators.js'
import { describeCondition } from './describe-condition.js'

/** Same ISO shape DatePickerField submits; interview dates are converted to it. */
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$'
/** Answers carry no JS numbers — the doc-engine parseMoney consumes strings. */
const NUMBER_PATTERN = '^\\d+([.,]\\d+)?$'

/** Human format notes matching the validators the server enforces (plan D2). */
const FORMAT_NOTES: Record<ValidationRule, string> = {
  email: 'Формат: name@example.com.',
  phone: 'Формат: +380XXXXXXXXX або 0XXXXXXXXX.',
  inn: 'Формат: 10 цифр РНОКПП (перевіряється контрольна цифра).',
  name: 'Лише кирилиця, апостроф, дефіс — без латиниці та цифр.',
  passport: 'Формат: АА123456 (книжечка) або 9 цифр (ID-картка).',
  iban: 'Формат: UA + 27 цифр (перевіряється контрольна сума).',
}

const DATE_NOTE = 'Формат: YYYY-MM-DD (користувач зазвичай називає ДД.ММ.РРРР — переконвертуйте).'
const NUMBER_NOTE = 'Число рядком, наприклад "5000" або "5000,50".'

/** End a description part with '.' — without doubling existing terminal punctuation. */
function sentence(part: string): string {
  const trimmed = part.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function optionsNote(options: FieldOption[]): string {
  const pairs = options.map((o) => `${o.value} — ${o.label}`).join('; ')
  return sentence(`Варіанти: ${pairs}`)
}

function buildDescription(field: FormField): string {
  const parts: string[] = [sentence(field.label)]
  if (field.hint) parts.push(sentence(field.hint))
  if (field.explanation) parts.push(sentence(field.explanation))
  if ((field.type === 'choice' || field.type === 'multicheck') && field.options && field.options.length > 0) {
    parts.push(optionsNote(field.options))
  }
  const rule = resolveValidationRule(field)
  if (rule) parts.push(FORMAT_NOTES[rule])
  if (field.type === 'date') parts.push(DATE_NOTE)
  if (field.type === 'number') parts.push(NUMBER_NOTE)
  if (field.show_if) parts.push(`Питати ЛИШЕ якщо: ${describeCondition(field.show_if)}.`)
  return parts.join(' ')
}

function optionValues(field: FormField): string[] {
  return (field.options ?? []).map((o) => o.value)
}

function fieldSchema(field: FormField): Record<string, unknown> {
  const schema: Record<string, unknown> = {}
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'phone':
      schema.type = 'string'
      // Only an explicit cap belongs in the schema — defaults live in the validate engine.
      if (field.maxLength !== undefined) schema.maxLength = field.maxLength
      break
    case 'date':
      schema.type = 'string'
      schema.pattern = DATE_PATTERN
      break
    case 'boolean':
      schema.type = 'boolean'
      break
    case 'choice':
      schema.type = 'string'
      schema.enum = optionValues(field)
      break
    case 'multicheck':
      schema.type = 'array'
      schema.items = { type: 'string', enum: optionValues(field) }
      schema.uniqueItems = true
      break
    case 'number':
      schema.type = 'string'
      schema.pattern = NUMBER_PATTERN
      break
    default: {
      const unreachable: never = field.type
      throw new Error(`Unsupported field type: ${String(unreachable)}`)
    }
  }
  schema.description = buildDescription(field)
  return schema
}

/**
 * Convert a service form_config into the raw JSON Schema used as the MCP tool
 * inputSchema: `{type:'object', properties, required, additionalProperties:false}`.
 */
export function formConfigToJsonSchema(config: FormConfig): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  for (const field of config.steps) {
    properties[field.id] = fieldSchema(field)
  }
  const required = config.steps
    .filter((field) => field.required === true && !field.show_if)
    .map((field) => field.id)
  return { type: 'object', properties, required, additionalProperties: false }
}
