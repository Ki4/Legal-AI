/**
 * serviceAnatomy.ts — pure, browser-safe analysis of a service's template + form.
 *
 * Powers the read-only "Дзеркало послуги" (service-mirror, slice 1): shows what a
 * service is made of and what's missing, computed in the browser from data we already
 * have (`services.form_config` + `services.document_template`) — no AI, no backend.
 *
 * Two deliberate ports (NOT imports) keep this bundle-safe and decoupled from the n8n
 * Code-node files (CommonJS, render engine), per the spec's stop-condition:
 *   1. A lean tag extractor — mirrors render-document.js tokenizer but only collects
 *      referenced paths (no rendering / no eval). Parity-tested vs real templates.
 *   2. The citation regex — mirrors scripts/lib/citations.mjs. Parity-tested vs goldens.
 *
 * The "computed layer" (PROVIDED_CONTEXT / DERIVED_SOURCES) mirrors render-document.js
 * buildContext(): templates reference computed keys (plaintiff_name, children, court_fee…)
 * that are NOT form fields but derive from them. Without this model, every such field
 * would be a false "unused"/"unmatched". The `unmatchedPlaceholders === []` invariant test
 * on real templates guards against drift here.
 */

import type { FormConfig, FormField, ShowIfCondition, SingleCondition } from '../types/form'

// ───────────────────────────── Citations (port of citations.mjs) ─────────────

export interface LawCitations {
  url: string
  slug: string
  title: string
  articles: string[]
}

interface Law { slug: string; title: string; url: string }

/** Canonical 3-law registry (mirror of scripts/law-registry.mjs LAWS). */
const LAWS: Law[] = [
  { slug: 'simeinyi-kodeks', title: 'Сімейний кодекс України', url: 'https://zakon.rada.gov.ua/laws/show/2947-14' },
  { slug: 'tsyvilnyi-protsesualnyi-kodeks', title: 'Цивільний процесуальний кодекс України', url: 'https://zakon.rada.gov.ua/laws/show/1618-15' },
  { slug: 'pro-sudovyi-zbir', title: 'Закон України «Про судовий збір»', url: 'https://zakon.rada.gov.ua/laws/show/3674-17' },
]

const LAW_NAME_GROUPS: { law: Law; names: string[] }[] = [
  { law: LAWS[0], names: ['Сімейного [Кк]одексу України', 'СК України'] },
  { law: LAWS[1], names: ['Цивільного процесуального кодексу України', 'ЦПК України'] },
  { law: LAWS[2], names: ['Закону України\\s*«Про судовий збір»'] },
]

const LAW_NAME_ALT = LAW_NAME_GROUPS.flatMap((g) => g.names).join('|')
const ARTICLE_SINGLE = '\\d+(?:\\s*[-–]\\s*\\d+)?'
const ARTICLE_LIST = `${ARTICLE_SINGLE}(?:\\s*,\\s*${ARTICLE_SINGLE})*`
const PREFIX = '(?:пп\\.\\s?(?<subpoint>\\d+)\\s*)?(?:п\\.\\s?(?<point>\\d+)\\s*)?(?:ч\\.\\s?(?<part>\\d+)\\s*)?'
const FILLER = '[\\s_]*'

// `single` accepts a comma list too ("ст. 110, 112 СК"), not just one article. The single "ст."
// abbreviation is grammatically meant for one article, but hand-edited templates use it for lists;
// without this they were dropped silently. expandArticleList handles both; "ст.ст." (multi) is
// unchanged, so the existing golden templates (all using "ст.ст.") extract identically.
const CITATION_THEN_LAW_RE = new RegExp(
  `${PREFIX}(?:ст\\.\\s?ст\\.\\s?(?<multi>${ARTICLE_LIST})|ст\\.\\s?(?<single>${ARTICLE_LIST}))${FILLER}(?<law>${LAW_NAME_ALT})`,
  'g',
)
const LAW_THEN_PAREN_RE = new RegExp(
  `(?<law>${LAW_NAME_ALT})\\s*\\(\\s*ст\\.\\s?(?<single>${ARTICLE_LIST})\\s*\\)`,
  'g',
)

function stripHandlebars(text: string): string {
  return text.replace(/\{\{[^}]*\}\}/g, '')
}

/** Expand "105, 110, 112" / "182-184" / "180–184" / "27" into individual article numbers. */
function expandArticleList(raw: string): string[] {
  const out: string[] = []
  for (const piece of raw.split(',')) {
    const m = piece.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/)
    if (!m) continue
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    for (let n = from; n <= to; n++) out.push(String(n))
  }
  return out
}

function lawForName(nameText: string): Law | null {
  for (const group of LAW_NAME_GROUPS) {
    if (group.names.some((n) => new RegExp(`^(?:${n})$`).test(nameText))) return group.law
  }
  return null
}

/** Extract service → laws/articles, deduped + sorted (registry order, articles ascending). */
export function extractArticlesByLaw(text: string): LawCitations[] {
  const stripped = stripHandlebars(String(text || ''))
  const byUrl = new Map<string, Set<string>>()

  const add = (law: Law, articles: string[]) => {
    if (!articles.length) return
    if (!byUrl.has(law.url)) byUrl.set(law.url, new Set())
    const set = byUrl.get(law.url)!
    for (const a of articles) set.add(a)
  }

  for (const m of stripped.matchAll(CITATION_THEN_LAW_RE)) {
    const g = m.groups!
    const law = lawForName(g.law)
    if (law) add(law, expandArticleList(g.multi ?? g.single))
  }
  for (const m of stripped.matchAll(LAW_THEN_PAREN_RE)) {
    const g = m.groups!
    const law = lawForName(g.law)
    if (law) add(law, expandArticleList(g.single))
  }

  const out: LawCitations[] = []
  for (const group of LAW_NAME_GROUPS) {
    const set = byUrl.get(group.law.url)
    if (!set || !set.size) continue
    out.push({
      url: group.law.url,
      slug: group.law.slug,
      title: group.law.title,
      articles: [...set].sort((a, b) => Number(a) - Number(b)),
    })
  }
  return out
}

/** rada doc-id from a law URL (e.g. '2947-14') — matches law_chunks.law_code. */
export function lawCodeFromUrl(url: string): string {
  return String(url || '').replace(/\/+$/, '').split('/').pop() || ''
}

// ───────────────────────── Template path extraction (lean) ───────────────────
// Mirror of render-document.js tokenizer — collects referenced paths only, no eval.

const TAG_RE = /\{\{([\s\S]*?)\}\}/g
const NUM_RE = /^-?\d+(\.\d+)?$/
const KEYWORDS = new Set(['and', 'or', 'not', '==', '!=', '>=', '<=', '>', '<'])

/** Split tag content into bare words and 'quoted literals'. */
function splitWords(s: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue }
    if (s[i] === "'") {
      const end = s.indexOf("'", i + 1)
      if (end === -1) break
      i = end + 1 // literal — ignored
      continue
    }
    let j = i
    while (j < s.length && !/\s/.test(s[j])) j++
    out.push(s.slice(i, j))
    i = j
  }
  return out
}

/** Is `w` a path reference (not an operator, number, literal, this, or @meta)? */
function isPath(w: string): boolean {
  if (!w || KEYWORDS.has(w) || NUM_RE.test(w)) return false
  if (w === 'this' || w === '.' || w.startsWith('@')) return false
  return true
}

export interface TemplateAnalysis {
  /** distinct root-scope dotted paths the template references (for display) */
  referencedPaths: string[]
  /** candidate form-field ids referenced (root-scope, minus provided/computed/specials) */
  fieldRefs: string[]
  /** {{#each X}} paths */
  eachPaths: string[]
  /** referenced computed-layer keys/paths (subset of PROVIDED_CONTEXT or dotted) */
  computedRefs: string[]
  citations: LawCitations[]
  hasTemplate: boolean
}

/**
 * Collect referenced paths from a template. Depth-tracking: tags inside {{#each}}
 * resolve against the loop item, so only depth-0 references are candidate form fields.
 */
export function analyzeTemplate(tpl: string): TemplateAnalysis {
  const template = String(tpl || '')
  const rootPaths = new Set<string>()   // depth-0 dotted paths
  const eachPaths = new Set<string>()
  let depth = 0

  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(template)) !== null) {
    const content = m[1].trim()
    if (!content) continue
    if (content.startsWith('!')) continue                 // comment / {{!style:}}
    if (content === '/if' || content === 'else') continue
    if (content === '/each') { if (depth > 0) depth--; continue }

    if (content.startsWith('#each ')) {
      const path = content.slice(6).trim()
      if (depth === 0 && isPath(path)) { rootPaths.add(path); eachPaths.add(path) }
      depth++
      continue
    }

    let words: string[]
    if (content.startsWith('#if ')) words = splitWords(content.slice(4))
    else if (content.startsWith('else if ')) words = splitWords(content.slice(8))
    else {
      // interpolation or helper: strip a trailing |raw, drop a leading helper name
      const stripped = content.replace(/\s*\|\s*raw\s*$/, '')
      words = splitWords(stripped)
      if (words.length > 1) words = words.slice(1) // helper name is not a path
    }

    if (depth > 0) continue // loop-item scope — not a form field
    for (const w of words) if (isPath(w)) rootPaths.add(w)
  }

  // The render context's computed/escape-hatch keys — NOT form fields.
  const referencedPaths = [...rootPaths].sort()
  const computedRefs: string[] = []
  const fieldRefs = new Set<string>()
  for (const p of referencedPaths) {
    const root = p.split('.')[0]
    if (PROVIDED_CONTEXT.has(root)) { computedRefs.push(p); continue }
    fieldRefs.add(root)
  }

  return {
    referencedPaths,
    fieldRefs: [...fieldRefs].sort(),
    eachPaths: [...eachPaths].sort(),
    computedRefs,
    citations: extractArticlesByLaw(template),
    hasTemplate: template.trim().length > 0,
  }
}

// ─────────────────────── Computed layer (mirror of buildContext) ──────────────
// Keep in sync with n8n/templates/render-document.js buildContext(). The
// "unmatchedPlaceholders === []" test on real templates guards this mapping.

/** Top-level render-context keys provided by the engine (not asked on the form). */
const PROVIDED_CONTEXT = new Set<string>([
  'ai', 'ai_raw', 'answers',
  'plaintiff_name', 'plaintiff_gender', 'defendant_name', 'defendant_gender',
  'children', 'has_children', 'n_children', 'first_child_gender',
  'monthly_delta', 'price_of_claim', 'court_fee', 'court_fee_is_floor',
])

/**
 * Engine-computed context keys for the variable palette (template-editor §4b).
 * Exposed as a sorted copy — the Set itself stays private to this module.
 */
export function providedContextKeys(): string[] {
  return [...PROVIDED_CONTEXT].sort()
}

/** Computed key / ai sub-path → the form fields it derives from. */
const DERIVED_SOURCES: Record<string, string[]> = {
  plaintiff_name: ['last_name', 'first_name', 'middle_name'],
  plaintiff_gender: ['middle_name'],
  defendant_name: ['defendant_last_name', 'defendant_first_name', 'defendant_middle_name', 'spouse_last_name', 'spouse_first_name', 'spouse_middle_name'],
  defendant_gender: ['defendant_middle_name', 'spouse_middle_name'],
  children: ['children_details'],
  has_children: ['children_details'],
  n_children: ['children_details'],
  first_child_gender: ['children_details'],
  monthly_delta: ['prior_alimony_value', 'prior_alimony_type', 'requested_alimony_value', 'requested_alimony_type'],
  price_of_claim: ['prior_alimony_value', 'prior_alimony_type', 'requested_alimony_value', 'requested_alimony_type'],
  court_fee: ['prior_alimony_value', 'prior_alimony_type', 'requested_alimony_value', 'requested_alimony_type', 'change_direction'],
  court_fee_is_floor: ['prior_alimony_value', 'prior_alimony_type', 'requested_alimony_value', 'requested_alimony_type'],
  'ai.plaintiff_instrumental': ['last_name', 'first_name', 'middle_name'],
  'ai.plaintiff_genitive': ['last_name', 'first_name', 'middle_name'],
  'ai.defendant_instrumental': ['defendant_last_name', 'defendant_first_name', 'defendant_middle_name', 'spouse_last_name', 'spouse_first_name', 'spouse_middle_name'],
  'ai.defendant_genitive': ['defendant_last_name', 'defendant_first_name', 'defendant_middle_name', 'spouse_last_name', 'spouse_first_name', 'spouse_middle_name'],
  'ai.spouse_instrumental': ['spouse_last_name', 'spouse_first_name', 'spouse_middle_name'],
  'ai.spouse_genitive': ['spouse_last_name', 'spouse_first_name', 'spouse_middle_name'],
  'ai.marriage_place_locative': ['marriage_place'],
  'ai.children_genitive': ['children_details'],
  // ai.reasoning — LLM-generated, no form source
}

/**
 * Pipeline-injected ids that are neither form fields nor buildContext-computed
 * (delivered by an upstream n8n node). Add here when the invariant test surfaces one.
 */
const PIPELINE_PROVIDED = new Set<string>([])

// ───────────────────────────── Form ↔ template diff ──────────────────────────

export interface FieldDiff {
  /** form fields the document consumes (directly or via a computed key) */
  usedFields: string[]
  /** form fields the document never uses (form asks, doc ignores) */
  unusedFields: string[]
  /** template references with no matching form field / provider (broken template) */
  unmatchedPlaceholders: string[]
}

export function diffFormVsTemplate(form: FormConfig, a: TemplateAnalysis): FieldDiff {
  const fieldIds = new Set((form.steps ?? []).map((s) => s.id))

  // A field is used if: referenced directly; OR it sources a referenced computed key;
  // OR its id collides with a referenced computed key (e.g. a `has_children` form field
  // whose value the engine recomputes from children_details — the template names it, so
  // it's not "unused", though the form answer is shadowed; see IMPROVEMENTS).
  const used = new Set<string>()
  const computedRoots = new Set(a.computedRefs.map((r) => r.split('.')[0]))
  for (const id of fieldIds) {
    if (a.fieldRefs.includes(id) || computedRoots.has(id)) used.add(id)
  }
  for (const ref of a.computedRefs) {
    const sources = DERIVED_SOURCES[ref] ?? DERIVED_SOURCES[ref.split('.')[0]]
    if (sources) for (const s of sources) if (fieldIds.has(s)) used.add(s)
  }

  const unused = [...fieldIds].filter((id) => !used.has(id))
  const unmatched = a.fieldRefs.filter((r) => !fieldIds.has(r) && !PIPELINE_PROVIDED.has(r))

  return {
    usedFields: [...used].sort(),
    unusedFields: unused.sort(),
    unmatchedPlaceholders: unmatched.sort(),
  }
}

// ───────────────────────────── show_if introspection ─────────────────────────

function conditionsOf(cond: ShowIfCondition): SingleCondition[] {
  if ('all' in cond) return cond.all
  if ('any' in cond) return cond.any
  return [cond]
}

/** Field ids whose show_if references a field that doesn't exist in the form. */
export function collectBrokenShowIf(form: FormConfig): string[] {
  const ids = new Set((form.steps ?? []).map((s) => s.id))
  const broken: string[] = []
  for (const f of form.steps ?? []) {
    if (!f.show_if) continue
    if (conditionsOf(f.show_if).some((c) => !ids.has(c.field))) broken.push(f.id)
  }
  return broken
}

/** Fields with an empty/whitespace label (a quality signal). */
export function collectEmptyLabelFields(form: FormConfig): string[] {
  return (form.steps ?? []).filter((f) => !f.label || !f.label.trim()).map((f) => f.id)
}

const OP_LABEL: Record<SingleCondition['operator'], string> = {
  '==': 'дорівнює', '!=': 'не дорівнює', '>': 'більше', '<': 'менше',
}

function valueLabel(v: SingleCondition['value']): string {
  if (v === true) return 'Так'
  if (v === false) return 'Ні'
  return `«${String(v)}»`
}

/** Human-readable rendering of a show_if condition, using field labels. */
export function describeShowIf(cond: ShowIfCondition, form: FormConfig): string {
  const byId = new Map((form.steps ?? []).map((s) => [s.id, s] as const))
  const one = (c: SingleCondition): string => {
    const field = byId.get(c.field)
    const name = field ? field.label || c.field : `${c.field} ⚠ (поле не існує)`
    return `«${name}» ${OP_LABEL[c.operator]} ${valueLabel(c.value)}`
  }
  if ('all' in cond) return cond.all.map(one).join(' і ')
  if ('any' in cond) return cond.any.map(one).join(' або ')
  return one(cond)
}

// ───────────────────────────── Health light ──────────────────────────────────

export type HealthLevel = 'green' | 'amber' | 'red'
export interface ServiceHealth { level: HealthLevel; reasons: string[] }

const TEMPLATE_MODES = new Set(['template', 'hybrid'])

/**
 * Is the stored `document_template` what actually generates the document?
 * `generation_mode='js'` services render via the legacy JS builder — their template
 * column is a dormant draft, so a form↔template diff is informational only and must
 * not raise health alarms (the alimony 37/18 false-red, issue #86).
 */
export function isTemplateAuthoritative(generationMode: string | null): boolean {
  return generationMode !== 'js'
}
const TYPE_LABEL: Record<FormField['type'], string> = {
  text: 'Текст', textarea: 'Великий текст', date: 'Дата', boolean: 'Так / Ні',
  choice: 'Вибір (один)', multicheck: 'Вибір (кілька)', number: 'Число', phone: 'Телефон',
}

/** Human label for a field type (used by the view page). */
export function fieldTypeLabel(type: FormField['type']): string {
  return TYPE_LABEL[type] ?? type
}

export interface HealthInput {
  generationMode: string | null
  hasTemplate: boolean
  diff: FieldDiff
  brokenShowIf: string[]
  emptyLabelFields: string[]
  /** human article labels flagged stale/changed, e.g. ["ст.192 СК"] */
  staleCitations: string[]
}

/**
 * Service health light (requirements §3.4):
 *   🔴 — can't generate correctly (no template / broken placeholder / broken show_if)
 *   🟡 — works but worth attention (unused field / stale citation / empty label)
 *   🟢 — otherwise
 * legacy `generation_mode='js'` is exempt from the "needs a template" red, and its
 * dormant template's form↔template diff folds into ONE amber note instead of
 * per-field red/amber (the diff describes a draft, not the live generation).
 */
export function serviceHealth(i: HealthInput): ServiceHealth {
  const red: string[] = []
  const amber: string[] = []
  const needsTemplate = i.generationMode === null || TEMPLATE_MODES.has(i.generationMode)
  const authoritative = isTemplateAuthoritative(i.generationMode)

  if (needsTemplate && !i.hasTemplate) red.push('Документ не має шаблону — послуга не згенерує документ')
  if (i.generationMode === 'js') amber.push('Генерація через legacy-білдер (не шаблон)')

  if (authoritative) {
    for (const p of i.diff.unmatchedPlaceholders) red.push(`Шаблон очікує дані «${p}», яких форма не питає`)
  } else if (i.hasTemplate && (i.diff.unmatchedPlaceholders.length || i.diff.unusedFields.length)) {
    amber.push(
      `Чернетка шаблону розходиться з формою (бракує ${i.diff.unmatchedPlaceholders.length}, ` +
      `не використано ${i.diff.unusedFields.length}) — на генерацію не впливає`,
    )
  }
  for (const id of i.brokenShowIf) red.push(`Поле «${id}»: умова показу посилається на неіснуюче поле`)

  if (authoritative) for (const id of i.diff.unusedFields) amber.push(`Поле «${id}» не використовується в документі`)
  for (const c of i.staleCitations) amber.push(`Стаття ${c} позначена як змінена/застаріла`)
  for (const id of i.emptyLabelFields) amber.push(`Поле «${id}» без підпису`)

  if (red.length) return { level: 'red', reasons: red.concat(amber) }
  if (amber.length) return { level: 'amber', reasons: amber }
  return { level: 'green', reasons: ['Шаблон, поля та цитати узгоджені'] }
}

// ───────────────────────────── One-shot bundler ──────────────────────────────

export interface ServiceAnalysis {
  analysis: TemplateAnalysis
  diff: FieldDiff
  health: ServiceHealth
}

/**
 * Analyze a whole service in one call — used by both the catalog (structural health,
 * staleCitations=[]) and the detail page (full health with stale/changed citations).
 */
export function analyzeService(
  form: FormConfig | null | undefined,
  template: string | null | undefined,
  generationMode: string | null,
  staleCitations: string[] = [],
): ServiceAnalysis {
  const safeForm: FormConfig = form && Array.isArray(form.steps)
    ? form
    : { service_id: '', title: '', tabs: [], steps: [] }
  const analysis = analyzeTemplate(template ?? '')
  const diff = diffFormVsTemplate(safeForm, analysis)
  const health = serviceHealth({
    generationMode,
    hasTemplate: analysis.hasTemplate,
    diff,
    brokenShowIf: collectBrokenShowIf(safeForm),
    emptyLabelFields: collectEmptyLabelFields(safeForm),
    staleCitations,
  })
  return { analysis, diff, health }
}
