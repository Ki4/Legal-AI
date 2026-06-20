export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'boolean'
  | 'choice'
  | 'multicheck'
  | 'number'
  | 'phone'

export type AnimationType = 'slide-down' | 'fade-in'

/** Optional format check applied to a field's value (see lib/validators.ts) */
export type ValidationRule = 'email' | 'phone' | 'inn'

export interface FieldOption {
  value: string
  label: string
}

export interface SingleCondition {
  field: string
  operator: '==' | '!=' | '>' | '<'
  value: boolean | string | number
}

// Supports: single condition, AND (all), OR (any)
export type ShowIfCondition =
  | SingleCondition
  | { all: SingleCondition[] }
  | { any: SingleCondition[] }

export interface FormField {
  id: string
  tab: string
  type: FieldType
  label: string
  placeholder?: string
  hint?: string
  explanation?: string
  required?: boolean
  options?: FieldOption[]
  show_if?: ShowIfCondition
  animation?: AnimationType
  /** Explicit format check; if omitted, inferred from field type/id */
  validation?: ValidationRule
}

export interface FormTab {
  id: string
  label: string
}

export interface FormConfig {
  service_id: string
  title: string
  subtitle?: string
  tabs: FormTab[]
  steps: FormField[]
}

export type Answers = Record<string, boolean | string | string[] | null>
