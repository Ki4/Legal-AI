import docEngine from '@doc-engine'
import { toParagraphs, type PreviewParagraph } from './documentStyles'

// CJS module exposes only a default export under rollup — destructure at the boundary.
const { buildContext, renderDocumentWithStyles } = docEngine

export interface PreviewResult {
  ok: boolean
  paragraphs: PreviewParagraph[]
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
    return { ok: true, paragraphs: toParagraphs(text, styleHints) }
  } catch (e) {
    return { ok: false, paragraphs: [], error: e instanceof Error ? e.message : String(e) }
  }
}
