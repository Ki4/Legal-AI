// Ambient types for the doc-engine, imported via the '@doc-engine' Vite alias
// (n8n/templates/render-document.js — pure JS, 0 Node deps; aliased in
// vite.config.admin.ts). We import the REAL SSoT renderer, not a copy, so the
// admin preview can never drift from what n8n actually produces.
// Picks up the browser-render slice deferred in DECISIONS #66, now that the
// engine is verified dependency-free (session 47).
//
// CJS module (`module.exports = { … }` under a `typeof module` guard) → rollup
// exposes only the default export, so consumers default-import then destructure.
declare module '@doc-engine' {
  interface DocEngine {
    /** Form answers (+ optional AI payload) → render context with computed fields. */
    buildContext(answers: Record<string, unknown>, ai?: Record<string, unknown>): Record<string, unknown>
    /** Render a template against a context; returns text + per-paragraph style hints. */
    renderDocumentWithStyles(
      template: string,
      context: Record<string, unknown>,
    ): { text: string; styleHints: Record<number, string[]> }
    /** Plain render (text only). */
    renderDocument(template: string, context: Record<string, unknown>): string
  }
  const docEngine: DocEngine
  export default docEngine
}
