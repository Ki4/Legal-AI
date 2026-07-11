/**
 * doc-engine.ts — typed bridge to the existing CommonJS doc-engine
 * (n8n/templates/render-document.js + validate-checklist.js + preview-excerpt.js).
 *
 * Loading strategy (plan T5):
 *  - render-document.js and preview-excerpt.js are proper CJS modules
 *    (module.exports tails at lines 831 / 124) → `createRequire`.
 *  - validate-checklist.js deliberately has NO require/import of its own: in the
 *    n8n Code Node it is inlined right after render-document.js so parseExpr /
 *    evalExpr resolve as plain in-scope identifiers. We mirror the exact loading
 *    pattern of n8n/templates/__tests__/validate-checklist.test.js
 *    (`loadInlinedWithRenderDocument()`): concatenate both sources into one
 *    `new Function('module', 'exports', …)` body — exactly like production.
 *
 * The engine sources are static repo files (never untrusted input).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { repoRoot } from './env.js'
import type { Answers, Checklist } from './types.js'

/** Shape of render-document.js `renderDocumentWithStyles` (line 450/479). */
export interface RenderResult {
  text: string
  styleHints: unknown
  styleRuns: unknown
}

/** Shape of validate-checklist.js `validateChecklist` (line 42/54). */
export interface ChecklistResult {
  ok: boolean
  missing: { id: string; description: string }[]
  satisfied: { id: string; description: string }[]
}

export interface DocEngine {
  /** render-document.js buildContext(answers, ai): 3-layer render context; ai={} → nominative fallback (guard inside). */
  buildContext(answers: Answers, ai: Record<string, unknown>): Record<string, unknown>
  renderDocumentWithStyles(template: string, ctx: Record<string, unknown>): RenderResult
  /** null/itemless checklist → { ok: true, missing: [], satisfied: [] } (engine tolerates it). */
  validateChecklist(text: string, ctx: Record<string, unknown>, checklist: Checklist | null): ChecklistResult
  /** preview-excerpt.js deriveExcerpt(fullDocText, serviceSlug?) — safe, citation-free excerpt. */
  deriveExcerpt(text: string, slug?: string): string
}

// CJS export surfaces we consume (verified against the sources; full export
// lists are wider — renderDocument, parseTemplate, HELPERS, stem-guard fns, …).
interface RenderDocumentCjs {
  buildContext(answers: Answers, ai: Record<string, unknown>): Record<string, unknown>
  renderDocumentWithStyles(template: string, ctx: Record<string, unknown>): RenderResult
}

interface PreviewExcerptCjs {
  deriveExcerpt(text: string, slug?: string): string
}

type ValidateChecklistFn = (
  text: string,
  ctx: Record<string, unknown>,
  checklist: Checklist | null,
) => ChecklistResult

const templatesDir = path.join(repoRoot, 'n8n', 'templates')

/**
 * Mirror of validate-checklist.test.js `loadInlinedWithRenderDocument()`:
 * both sources concatenated into one Function body so validateChecklist sees
 * parseExpr/evalExpr in scope, then re-exported.
 */
function loadChecklistValidator(): ValidateChecklistFn {
  const renderCode = readFileSync(path.join(templatesDir, 'render-document.js'), 'utf8')
  const checklistCode = readFileSync(path.join(templatesDir, 'validate-checklist.js'), 'utf8')
  const combined = [renderCode, checklistCode, 'module.exports = { validateChecklist };'].join('\n')
  const holder: { exports: Record<string, unknown> } = { exports: {} }
  const factory = new Function('module', 'exports', combined) as (
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void
  factory(holder, holder.exports)
  return holder.exports.validateChecklist as ValidateChecklistFn
}

let cached: DocEngine | null = null

/** Loads (once) and returns the typed doc-engine facade. */
export function loadDocEngine(): DocEngine {
  if (cached) return cached

  const requireCjs = createRequire(import.meta.url)
  const render = requireCjs(path.join(templatesDir, 'render-document.js')) as RenderDocumentCjs
  const excerpt = requireCjs(path.join(templatesDir, 'preview-excerpt.js')) as PreviewExcerptCjs
  const validateChecklist = loadChecklistValidator()

  cached = {
    buildContext: (answers, ai) => render.buildContext(answers, ai),
    renderDocumentWithStyles: (template, ctx) => render.renderDocumentWithStyles(template, ctx),
    validateChecklist,
    deriveExcerpt: (text, slug) => excerpt.deriveExcerpt(text, slug),
  }
  return cached
}
