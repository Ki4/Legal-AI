// Pure helpers for the «Показати змінні» preview mode (template-editor §4c,
// interview Q7 — digitalved parity): unfilled form variables render as labeled
// chips instead of '________'. Kept engine-free so it is unit-testable without
// the '@doc-engine' alias; the integration test (annotatedContext.test.ts)
// loads the REAL engine via createRequire and checks the Proxy contract
// against the actual resolvePath.

/**
 * Sentinel delimiters for unfilled form-field markers in rendered text.
 * ⦃ / ⦄ (U+2983 / U+2984) never appear in legal templates, so a rendered line
 * can be split back into text/chip parts without any escaping scheme.
 */
export const SENTINEL_OPEN = '⦃'
export const SENTINEL_CLOSE = '⦄'

/**
 * Wrap a doc-engine context so UNFILLED top-level form fields resolve to a
 * `⦃field_id⦄` sentinel instead of falling through to the engine's
 * '________' fallback.
 *
 * Engine contract this must satisfy (render-document.js resolvePath): it does
 * `segs[0] in item` first, then walks properties — so the Proxy `has` trap
 * must claim every known field root, and the `get` trap must return the
 * sentinel string when the base value is absent/empty. Only TOP-LEVEL
 * form-field roots are annotated; computed engine values (plaintiff_name,
 * court_fee, …) and nested paths keep engine behavior ('________').
 *
 * Documented side effect: the sentinel is a truthy non-empty string, so
 * {{#if field}} takes the truthy branch in this mode (unlike the empty
 * render). Accepted — the mode shows WHERE fields go, not branch logic.
 */
export function makeAnnotatedContext(
  baseCtx: Record<string, unknown>,
  knownFieldIds: Set<string>,
): Record<string, unknown> {
  return new Proxy(baseCtx, {
    has(target, prop) {
      return Reflect.has(target, prop) || (typeof prop === 'string' && knownFieldIds.has(prop))
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (
        typeof prop === 'string' &&
        knownFieldIds.has(prop) &&
        (value === undefined || value === null || value === '')
      ) {
        return `${SENTINEL_OPEN}${prop}${SENTINEL_CLOSE}`
      }
      return value
    },
  })
}

/** One piece of a rendered line: plain text or a field chip (value = field id). */
export interface AnnotatedPart {
  kind: 'text' | 'chip'
  value: string
}

const SENTINEL_RE = new RegExp(`${SENTINEL_OPEN}([^${SENTINEL_CLOSE}]*)${SENTINEL_CLOSE}`, 'g')

/** Split a rendered line by ⦃…⦄ sentinels into text / chip parts. */
export function splitAnnotated(text: string): AnnotatedPart[] {
  const parts: AnnotatedPart[] = []
  let last = 0
  for (const m of text.matchAll(SENTINEL_RE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push({ kind: 'text', value: text.slice(last, idx) })
    parts.push({ kind: 'chip', value: m[1] })
    last = idx + m[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}
