// Parse gate for the template editor (specs/features/template-editor §2.2).
// Engine-free on purpose: the render function is INJECTED, so unit tests load the
// real doc-engine via createRequire (no '@doc-engine' alias under `vitest run`),
// while the UI binds the aliased engine in documentPreview.validateDraft.

export type GateResult = { ok: true } | { ok: false; error: string }

/**
 * Run the injected renderer as a parse gate: any throw → { ok: false } with a
 * plain-Ukrainian message (the audience is a lawyer, not a developer). The gate
 * uses the SAME renderer as production, so a template that passes here parses
 * in n8n too — no re-implemented validation rules to drift.
 */
export function runParseGate(
  render: (template: string) => unknown,
  template: string,
): GateResult {
  try {
    render(template)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Помилка в шаблоні: ${msg}` }
  }
}
