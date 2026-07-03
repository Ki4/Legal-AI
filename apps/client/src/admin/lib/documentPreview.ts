import docEngine from '@doc-engine'
import { makeAnnotatedContext } from './annotatedContext'
import { toParagraphs, type PreviewParagraph } from './documentStyles'
import { runParseGate, type GateResult } from './templateGate'

// CJS module exposes only a default export under rollup — destructure at the boundary.
const { buildContext, renderDocumentWithStyles } = docEngine

export interface PreviewResult {
  ok: boolean
  paragraphs: PreviewParagraph[]
  /** Raw rendered text + per-paragraph style keywords — paragraphs map 1:1 to
   *  text lines, so block detection (detectBlocks) can index into them. */
  text?: string
  styleHints?: Record<number, string[]>
  error?: string
}

/**
 * Render a document template against form answers using the REAL doc-engine (SSoT).
 * Empty / partial answers render the skeleton with '________' fallbacks — a faithful
 * "this is the document" preview without re-implementing the engine (so it can never
 * drift from n8n output). Render failures are caught and surfaced, never thrown.
 */
export function renderPreview(template: string, answers: Record<string, unknown> = {}): PreviewResult {
  try {
    const ctx = buildContext(answers, {})
    const { text, styleHints } = renderDocumentWithStyles(template, ctx)
    return { ok: true, paragraphs: toParagraphs(text, styleHints), text, styleHints }
  } catch (e) {
    return { ok: false, paragraphs: [], error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * «Показати змінні» mode (template-editor §4c): render with EMPTY answers but
 * mark unfilled top-level form fields as ⦃field_id⦄ sentinels — the component
 * turns them into labeled chips via splitAnnotated. Caveat (documented in the
 * UI copy): computed engine values (plaintiff_name, суми, …) are not form
 * fields, so they still render '________' in this mode.
 */
export function renderAnnotatedPreview(template: string, fieldIds: string[]): PreviewResult {
  try {
    const ctx = makeAnnotatedContext(buildContext({}, {}), new Set(fieldIds))
    const { text, styleHints } = renderDocumentWithStyles(template, ctx)
    return { ok: true, paragraphs: toParagraphs(text, styleHints), text, styleHints }
  } catch (e) {
    return { ok: false, paragraphs: [], error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Parse gate for the template editor (specs/features/template-editor §2.2):
 * renders the draft against empty answers with the REAL engine. Publication is
 * blocked while this fails; saving the draft itself is always allowed.
 */
export function validateDraft(template: string): GateResult {
  return runParseGate((tpl) => renderDocumentWithStyles(tpl, buildContext({}, {})), template)
}

export interface LayoutRenderResult {
  ok: boolean
  /** Raw rendered document text (paragraphs joined by '\n'). */
  text: string
  /** Per-paragraph style keywords keyed by 0-based line index. */
  styleHints: Record<number, string[]>
  error?: string
}

/**
 * Like renderPreview but returns the raw text + styleHints (not display-mapped
 * paragraphs) — the layout-preview feature (#84) needs them to detect blocks and
 * paginate. Same single renderer, so layout can never drift from n8n output.
 */
export function renderLayout(template: string, answers: Record<string, unknown> = {}): LayoutRenderResult {
  try {
    const ctx = buildContext(answers, {})
    const { text, styleHints } = renderDocumentWithStyles(template, ctx)
    return { ok: true, text, styleHints }
  } catch (e) {
    return { ok: false, text: '', styleHints: {}, error: e instanceof Error ? e.message : String(e) }
  }
}
