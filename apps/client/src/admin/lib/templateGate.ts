// Parse gate for the template editor (specs/features/template-editor §2.2).
// Engine-free on purpose: the render function is INJECTED, so unit tests load the
// real doc-engine via createRequire (no '@doc-engine' alias under `vitest run`),
// while the UI binds the aliased engine in documentPreview.validateDraft.

export type GateResult = { ok: true } | { ok: false; error: string }

// The engine throws English parser messages (render-document.js). Translate the
// known patterns here, in the UI layer — the engine itself is legally-critical
// shared code and stays untouched. Unknown messages fall through verbatim.
const ENGINE_ERROR_UK: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    /^Unclosed (\{\{#?\S+?\}\}) opened at line (\d+)$/,
    (m) => `блок ${m[1]} відкрито в рядку ${m[2]}, але він не закритий — додайте закривальний тег`,
  ],
  [
    /^Unknown helper "(.+?)" at line (\d+)$/,
    (m) => `невідомий тег "${m[1]}" у рядку ${m[2]} — підтримуються {{#if}}, {{#each}} та {{поле}}`,
  ],
  [
    /^Unexpected (\{\{.+?\}\}) at line (\d+)(?: \(inside (\S+) from line (\d+)\))?$/,
    (m) =>
      `зайвий тег ${m[1]} у рядку ${m[2]}` +
      (m[3] ? ` (всередині ${m[3]}, відкритого в рядку ${m[4]})` : ''),
  ],
  [
    /^\{\{else if\}\} after \{\{else\}\} at line (\d+)$/,
    (m) => `{{else if}} стоїть після {{else}} у рядку ${m[1]} — {{else}} має бути останнім`,
  ],
  [/^Duplicate \{\{else\}\} at line (\d+)$/, (m) => `повторний {{else}} у рядку ${m[1]}`],
  [
    /^Unterminated string literal in "(.+?)" at line (\d+)$/,
    (m) => `незакриті лапки у "${m[1]}" (рядок ${m[2]})`,
  ],
  [
    /^(?:Incomplete expression|Unexpected ".+?" in expression) "(.+?)" at line (\d+)$/,
    (m) => `помилка в умові "${m[1]}" (рядок ${m[2]}) — перевірте вираз`,
  ],
  [
    /^\{\{#each\}\} without a path at line (\d+)$/,
    (m) => `{{#each}} без назви списку у рядку ${m[1]}`,
  ],
  [/^Empty tag \{\{\}\} at line (\d+)$/, (m) => `порожній тег {{}} у рядку ${m[1]}`],
]

/** Translate a raw engine parser message to Ukrainian (verbatim if unknown). */
export function localizeEngineError(msg: string): string {
  for (const [re, uk] of ENGINE_ERROR_UK) {
    const m = msg.match(re)
    if (m) return uk(m)
  }
  return msg
}

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
    return { ok: false, error: `Помилка в шаблоні: ${localizeEngineError(msg)}` }
  }
}
