/**
 * Validation engine over (form_config, raw tool input) — plan D3, task T4.
 *
 * Semantics MIRROR the client exactly (the client is the source of truth):
 *  - `isAnswered` — verbatim port of apps/client/src/lib/form-utils.ts
 *    isAnswered (null / '' / [] are unanswered; boolean false IS answered).
 *  - hidden-field cleanup mirrors form-utils `clearStaleAnswers`: a SINGLE
 *    in-order pass over the MUTATING answers snapshot — nulling an earlier
 *    field feeds the visibility of later fields within the same pass; there is
 *    no fixpoint re-iteration (the client converges by re-running the pass on
 *    every change; the server takes one shot with the same function shape).
 *  - required-only-for-visible mirrors form-utils `validateForm`.
 *  - format checks only for VISIBLE fields mirrors form-utils `validateFormats`
 *    (hidden fields get only the hidden_by_condition warning + a nulled value);
 *    `validateValue` messages are reused VERBATIM (see ./validators.ts).
 *  - default string caps mirror apps/client/src/components/form/FormField.tsx:
 *    `field.maxLength ?? 200` (text input) / `?? 2000` (textarea).
 *  - children_details line format mirrors n8n/templates/render-document.js
 *    `parseChildrenDetails` (line = "ПІБ, дата, свідоцтво…", split on comma +
 *    optional spaces, parts[1] = birth date) + `ageFromBirthDate`, whose date
 *    token regex is /^\d{1,2}\.\d{1,2}\.\d{4}$/.
 *
 * Server-only additions the client cannot produce by construction (enforced
 * here because the LLM caller is unconstrained): unknown_field, invalid_type,
 * invalid_option (enum), ISO-date shape, number shape, length caps.
 */

import type {
  Answers,
  FormConfig,
  FormField,
  ProblemCode,
  ValidationIssue,
} from './types.js'
import { isVisible } from './conditions.js'
import { describeCondition } from './describe-condition.js'
import type { ValidationRule } from './validators.js'
import { resolveValidationRule, validateValue } from './validators.js'

// ── Fixed public API (plan D3 — other modules code against this) ─────────────

export const MAX_FIELD_CHARS = 4000
export const MAX_ARRAY_ITEMS = 100

export interface MissingRequired {
  field: string
  label: string
}

export interface ValidationReport {
  /** errors.length === 0 — warnings and missingRequired never flip it */
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  /** Known fields only; hidden-field values nulled (clearStaleAnswers mirror). */
  cleaned: Answers
  /** partial mode: informational; strict mode: mirrors the missing_required errors. */
  missingRequired: MissingRequired[]
}

// ── Ukrainian messages / format constants ────────────────────────────────────

/** FormField.tsx hard caps: `field.maxLength ?? 200` / `?? 2000`. */
const TEXT_DEFAULT_MAX = 200
const TEXTAREA_DEFAULT_MAX = 2000

const MISSING_REQUIRED_MESSAGE = "Обов'язкове поле не заповнено"
const DATE_MESSAGE = 'Дата має бути у форматі YYYY-MM-DD (наприклад 1990-03-15)'
const NUMBER_MESSAGE = 'Число має бути рядком у форматі 5000 або 5000,50'

/** Short "expected" statements per client validator rule (plan D3 contract). */
const RULE_EXPECTED: Record<ValidationRule, string> = {
  email: 'email формату name@example.com',
  phone: 'номер телефону +380XXXXXXXXX або 0XXXXXXXXX',
  inn: '10 цифр РНОКПП з коректною контрольною цифрою',
  name: 'лише кирилиця, апостроф і дефіс (без цифр і латиниці)',
  passport: 'АА123456 (книжечка) або 9 цифр (ID-картка)',
  iban: 'UA + 27 цифр з коректною контрольною сумою',
}

const DATE_EXPECTED = 'дата у форматі YYYY-MM-DD'
const NUMBER_EXPECTED = 'число рядком, наприклад "5000" або "5000,50"'
const CHILDREN_LINE_EXPECTED =
  'кожен рядок: ПІБ, дата народження (ДД.ММ.РРРР), свідоцтво № ... від ...'

const CHILDREN_DETAILS_ID = 'children_details'

/** Same ISO shape the client DatePickerField submits and form-schema advertises. */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
/** Same shape form-schema.ts advertises (D2); the doc-engine parseMoney consumes it. */
const NUMBER_RE = /^\d+([.,]\d+)?$/
/** Birth-date token accepted by render-document.js ageFromBirthDate. */
const CHILD_BIRTH_DATE_RE = /^\d{1,2}\.\d{1,2}\.\d{4}$/

// ── Small helpers ─────────────────────────────────────────────────────────────

/** Verbatim semantics of client form-utils `isAnswered`. */
function isAnswered(value: Answers[string] | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true // boolean true/false are both "answered"
}

/** Structural check: can this raw value live in the client `Answers` type? */
function isAnswersValue(v: unknown): v is boolean | string | string[] | null {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return true
  return Array.isArray(v) && v.every((item: unknown) => typeof item === 'string')
}

/** True when the string is YYYY-MM-DD AND a real calendar date (no 1990-02-30). */
function isIsoCalendarDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Effective length cap: explicit maxLength, else the FormField.tsx default, hard-capped at MAX_FIELD_CHARS. */
function lengthCap(field: FormField): number {
  const base =
    field.maxLength ??
    (field.type === 'text'
      ? TEXT_DEFAULT_MAX
      : field.type === 'textarea'
        ? TEXTAREA_DEFAULT_MAX
        : MAX_FIELD_CHARS)
  return Math.min(base, MAX_FIELD_CHARS)
}

function reaskHint(label: string): string {
  return `Перепитайте користувача точне значення поля «${label}» і викличте інструмент повторно.`
}

function askHint(label: string): string {
  return `Запитайте у користувача значення поля «${label}» і викличте інструмент повторно.`
}

function fieldIssue(
  field: FormField,
  problem: ProblemCode,
  message: string,
  expected: string,
): ValidationIssue {
  return { field: field.id, label: field.label, problem, message, expected, hint: reaskHint(field.label) }
}

// ── unknown_field typo suggestions ────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev: number[] = []
  for (let j = 0; j <= b.length; j++) prev.push(j)
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr.push(Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost))
    }
    prev = curr
  }
  return prev[b.length]
}

/** Up to 2 known field ids within edit distance 2 — cheap typo suggestions. */
function closestFieldIds(key: string, config: FormConfig): string[] {
  return config.steps
    .map((f) => ({ id: f.id, d: levenshtein(key, f.id) }))
    .filter((c) => c.d > 0 && c.d <= 2)
    .sort((x, y) => x.d - y.d)
    .slice(0, 2)
    .map((c) => c.id)
}

function unknownFieldIssue(key: string, config: FormConfig): ValidationIssue {
  const suggestions = closestFieldIds(key, config)
  const generic = 'Використовуйте лише ідентифікатори полів зі схеми інструмента.'
  const hint =
    suggestions.length > 0
      ? `Можливо, малося на увазі: ${suggestions.map((s) => `«${s}»`).join(' або ')}? ${generic}`
      : generic
  return {
    field: key,
    label: null,
    problem: 'unknown_field',
    message: `Невідоме поле «${key}» — у формі послуги такого поля немає.`,
    hint,
  }
}

// ── Per-value checks (visible fields only — validateFormats parity) ──────────

function checkProvidedValue(field: FormField, raw: unknown, errors: ValidationIssue[]): void {
  if (field.type === 'boolean') {
    if (typeof raw !== 'boolean') {
      errors.push(
        fieldIssue(
          field,
          'invalid_type',
          'Невірний тип значення — очікується логічне значення (true або false)',
          'true або false',
        ),
      )
    }
    return
  }

  if (field.type === 'multicheck') {
    const items: unknown[] | null = Array.isArray(raw) ? raw : null
    if (items === null || items.some((item) => typeof item !== 'string')) {
      errors.push(
        fieldIssue(
          field,
          'invalid_type',
          'Невірний тип значення — очікується масив рядків (значення обраних опцій)',
          'масив рядків, наприклад ["value1", "value2"]',
        ),
      )
      return
    }
    if (items.length > MAX_ARRAY_ITEMS) {
      errors.push(
        fieldIssue(
          field,
          'invalid_format',
          `Забагато елементів (максимум ${MAX_ARRAY_ITEMS})`,
          `не більше ${MAX_ARRAY_ITEMS} елементів`,
        ),
      )
      return
    }
    const allowed = (field.options ?? []).map((o) => o.value)
    if (allowed.length > 0) {
      const bad = items.filter((item): item is string => typeof item === 'string' && !allowed.includes(item))
      if (bad.length > 0) {
        errors.push(
          fieldIssue(
            field,
            'invalid_option',
            `Недопустимі значення: ${bad.map((b) => `«${b}»`).join(', ')}`,
            `Допустимі значення: ${allowed.join(', ')}`,
          ),
        )
      }
    }
    return
  }

  // Remaining field types (text/textarea/phone/date/choice/number) carry strings.
  if (typeof raw !== 'string') {
    errors.push(
      fieldIssue(field, 'invalid_type', 'Невірний тип значення — очікується рядок', 'рядок (string)'),
    )
    return
  }

  const trimmed = raw.trim()
  // Emptiness is required-ness, not a format problem (client validators skip empties).
  if (trimmed.length === 0) return

  // Enum check is server-owned — the client UI constrains choices by construction.
  if (field.type === 'choice') {
    const allowed = (field.options ?? []).map((o) => o.value)
    if (allowed.length > 0 && !allowed.includes(raw)) {
      errors.push(
        fieldIssue(
          field,
          'invalid_option',
          `Недопустиме значення «${raw}»`,
          `Допустимі значення: ${allowed.join(', ')}`,
        ),
      )
      return
    }
  }

  // (a) client validators — message reused VERBATIM (validateFormats parity).
  const message = validateValue(field, raw)
  if (message !== null) {
    const rule = resolveValidationRule(field)
    errors.push(
      fieldIssue(field, 'invalid_format', message, rule ? RULE_EXPECTED[rule] : 'коректний формат значення'),
    )
    return
  }

  // (b) server-owned ISO date shape + real-calendar check.
  if (field.type === 'date' && !isIsoCalendarDate(trimmed)) {
    errors.push(fieldIssue(field, 'invalid_format', DATE_MESSAGE, DATE_EXPECTED))
    return
  }

  // (c) server-owned number shape (Answers carry no JS numbers — parseMoney eats strings).
  if (field.type === 'number' && !NUMBER_RE.test(trimmed)) {
    errors.push(fieldIssue(field, 'invalid_format', NUMBER_MESSAGE, NUMBER_EXPECTED))
    return
  }

  // (d) length caps — FormField.tsx defaults + the global MAX_FIELD_CHARS cap.
  const cap = lengthCap(field)
  if (raw.length > cap) {
    errors.push(
      fieldIssue(
        field,
        'invalid_format',
        `Значення задовге (максимум ${cap} символів)`,
        `не більше ${cap} символів`,
      ),
    )
  }
}

// ── children_details heuristic (warning only) ─────────────────────────────────

function warnChildrenLines(field: FormField, value: string, warnings: ValidationIssue[]): void {
  const lines = value
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  for (const line of lines) {
    const parts = line.split(/,\s*/)
    const birthDate = (parts[1] ?? '').trim()
    if (CHILD_BIRTH_DATE_RE.test(birthDate)) continue
    const shown = line.length > 60 ? `${line.slice(0, 60)}…` : line
    warnings.push({
      field: field.id,
      label: field.label,
      problem: 'invalid_format',
      message:
        `Рядок «${shown}» не містить дати народження другим елементом. ` +
        'Очікуваний формат рядка: «ПІБ, дата народження, свідоцтво № ... від ...» (дата — ДД.ММ.РРРР).',
      expected: CHILDREN_LINE_EXPECTED,
      hint: `Уточніть у користувача дані дитини (поле «${field.label}») і викличте інструмент повторно.`,
    })
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function validateAnswers(
  config: FormConfig,
  input: Record<string, unknown>,
  mode: 'strict' | 'partial',
): ValidationReport {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const knownIds = new Set(config.steps.map((f) => f.id))

  // 1) unknown_field + known-key snapshot. Values that cannot live in Answers
  //    (numbers, objects, mixed arrays) are nulled here; invalid_type for them
  //    is reported in step 3 when the field is visible. Unknown keys are NOT
  //    copied into `cleaned`.
  const cleaned: Answers = {}
  for (const [key, raw] of Object.entries(input)) {
    if (raw === undefined) continue // JSON never carries undefined — treat as absent
    if (!knownIds.has(key)) {
      errors.push(unknownFieldIssue(key, config))
      continue
    }
    cleaned[key] = isAnswersValue(raw) ? raw : null
  }

  // 2) hidden-field cleanup — clearStaleAnswers mirror: single in-order pass
  //    over the mutating snapshot (earlier nulling feeds later visibility; no
  //    fixpoint). Only fields WITH show_if whose key is present are touched.
  for (const field of config.steps) {
    if (!field.show_if) continue
    if (isVisible(field, cleaned)) continue
    if (!(field.id in cleaned)) continue
    const provided = input[field.id]
    if (provided !== null && provided !== undefined) {
      warnings.push({
        field: field.id,
        label: field.label,
        problem: 'hidden_by_condition',
        message: `Поле приховане умовою (${describeCondition(field.show_if)}) — значення проігноровано.`,
      })
    }
    cleaned[field.id] = null
  }

  // 3) per-value checks — VISIBLE fields only (validateFormats parity); hidden
  //    fields already got the warning + null above.
  for (const field of config.steps) {
    if (!(field.id in cleaned)) continue
    const raw = input[field.id]
    if (raw === null) continue // explicit "no answer"
    if (!isVisible(field, cleaned)) continue
    // Value discarded by the cleanup cascade while the field flipped back to
    // visible under the final snapshot — treat as unanswered, like the client
    // (its submit-time checks read the already-nulled answers state).
    if (cleaned[field.id] === null && isAnswersValue(raw)) continue
    checkProvidedValue(field, raw, errors)
  }

  // 4) missing_required — required + visible + unanswered over the CLEANED
  //    snapshot (validateForm parity: boolean false counts as answered).
  //    strict: errors mirroring missingRequired; partial: informational only.
  const missingRequired: MissingRequired[] = []
  for (const field of config.steps) {
    if (!field.required) continue
    if (!isVisible(field, cleaned)) continue
    if (isAnswered(cleaned[field.id])) continue
    missingRequired.push({ field: field.id, label: field.label })
    if (mode === 'strict') {
      errors.push({
        field: field.id,
        label: field.label,
        problem: 'missing_required',
        message: MISSING_REQUIRED_MESSAGE,
        expected: field.hint ?? field.placeholder,
        hint: askHint(field.label),
      })
    }
  }

  // 5) children_details heuristic — only when answered (hidden/empty values
  //    are null by now and skip naturally). Warning, never an error.
  for (const field of config.steps) {
    if (field.id !== CHILDREN_DETAILS_ID) continue
    const value = cleaned[field.id]
    if (typeof value !== 'string' || !isAnswered(value)) continue
    warnChildrenLines(field, value, warnings)
  }

  return { ok: errors.length === 0, errors, warnings, cleaned, missingRequired }
}
