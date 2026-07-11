/**
 * Shared types for the MCP document server.
 *
 * The form-config section is copied verbatim from apps/client/src/types/form.ts —
 * drift is guarded behaviorally by src/__tests__/parity.test.ts (validators/conditions
 * copies must match the client originals on the same inputs).
 */

// ── form_config types (verbatim from apps/client/src/types/form.ts) ──────────

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

/** Optional format check applied to a field's value (see validators.ts) */
export type ValidationRule = 'email' | 'phone' | 'inn' | 'name' | 'passport' | 'iban'

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
  /** Hard cap on input length; if omitted, a sensible default per field type */
  maxLength?: number
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

// ── Services catalog (Supabase `services` row subset the server consumes) ────

export type ServiceStatus = 'active' | 'needs_review' | 'disabled'

export interface ChecklistItem {
  id: string
  description: string
  appliesIf?: string
  mustMatchAny: string[]
}

export interface Checklist {
  slug?: string
  items?: ChecklistItem[]
}

export interface ServiceRow {
  slug: string
  title: string
  description: string | null
  status: ServiceStatus
  generation_mode: 'js' | 'template' | 'hybrid'
  form_config: FormConfig
  document_template: string | null
  required_checklist: Checklist | null
  price: number | null
}

// ── Validation / tool-result contracts (plan D3/D5) ──────────────────────────

export type ProblemCode =
  | 'missing_required'
  | 'invalid_format'
  | 'invalid_option'
  | 'invalid_type'
  | 'unknown_field'
  | 'hidden_by_condition'
  | 'service_unavailable'
  | 'checklist_failed'
  | 'internal_error'

export interface ValidationIssue {
  /** Field id, or null for service-level problems */
  field: string | null
  /** Human label from form_config (Ukrainian), when known */
  label: string | null
  problem: ProblemCode
  message: string
  expected?: string
  hint?: string
}

export interface ErrorPayload {
  ok: false
  service: string
  error_type: 'validation' | 'service_unavailable' | 'checklist_failed' | 'internal_error'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  next_action: string
}

export interface ToolContent {
  type: 'text'
  text: string
}

export interface ToolResult {
  isError: boolean
  content: ToolContent[]
}

/** Transport-agnostic tool registration — the seam reused by the Phase-2 web agent loop. */
export interface RegisteredTool {
  name: string
  description: string
  /** Raw JSON Schema (generated from form_config) — deliberately NOT Zod: our engine owns validation. */
  inputSchema: Record<string, unknown>
  execute(args: Record<string, unknown>): Promise<ToolResult>
}
