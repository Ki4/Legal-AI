// S2 slice A: CodeMirror decorations for the template DSL. Decorations are
// PURELY visual (invariant 2 — worst failure mode is ugly rendering, the text
// underneath is untouched). Colour coding by tag kind follows the HotDocs
// pattern (variables vs logic vs directives); a plain {{поле}} renders as an
// atomic-looking chip with the field's Ukrainian label — unless the cursor or
// selection touches it, in which case the raw tag is shown (Obsidian
// Live-Preview pattern), so editing is always over honest source text.

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { scanTemplateTokens } from './templateTokens'

/** Chip label lookup: field id → Ukrainian label. Kept outside CM state so the
 *  panel can rebuild the extension when the form config changes. */
export type LabelLookup = (fieldId: string) => string | undefined

class VarChipWidget extends WidgetType {
  private readonly label: string
  private readonly known: boolean

  constructor(label: string, known: boolean) {
    super()
    this.label = label
    this.known = known
  }

  override eq(other: VarChipWidget): boolean {
    return other.label === this.label && other.known === this.known
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-tpl-chip' + (this.known ? '' : ' cm-tpl-chip-unknown')
    el.textContent = this.label
    return el
  }

  override ignoreEvent(): boolean {
    // Let CodeMirror handle clicks: a click on the chip places the cursor at
    // the tag, which immediately expands it to raw source for editing.
    return false
  }
}

const MARK_CLASS: Record<string, Decoration> = {
  comment: Decoration.mark({ class: 'cm-tpl-comment' }),
  style: Decoration.mark({ class: 'cm-tpl-style' }),
  logic: Decoration.mark({ class: 'cm-tpl-logic' }),
  helper: Decoration.mark({ class: 'cm-tpl-helper' }),
  var: Decoration.mark({ class: 'cm-tpl-var' }),
}

function buildDecorations(view: EditorView, labelFor: LabelLookup): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const text = view.state.doc.toString()
  const ranges = view.state.selection.ranges
  for (const token of scanTemplateTokens(text)) {
    if (token.kind === 'var') {
      // Cursor/selection touching the tag (boundaries inclusive) → raw source.
      const touched = ranges.some((r) => r.from <= token.to && r.to >= token.from)
      if (touched) {
        builder.add(token.from, token.to, MARK_CLASS.var)
      } else {
        const label = token.name ? labelFor(token.name) : undefined
        builder.add(
          token.from,
          token.to,
          Decoration.replace({
            widget: new VarChipWidget(label ?? token.name ?? '?', label !== undefined),
          }),
        )
      }
    } else {
      builder.add(token.from, token.to, MARK_CLASS[token.kind])
    }
  }
  return builder.finish()
}

/** The decoration plugin. Rebuilds on doc, selection or focus changes. */
export function templateDecorations(labelFor: LabelLookup) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, labelFor)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          this.decorations = buildDecorations(update.view, labelFor)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/** Editor chrome + tag colours, aligned with the admin "Legal Light" palette. */
export const templateTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    height: '100%',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.65',
  },
  '.cm-content': { padding: '12px 4px', caretColor: '#1E293B' },
  '&.cm-focused': { outline: 'none' },
  '.cm-line': { padding: '0 8px' },
  '.cm-tpl-comment': { color: '#94A3B8', fontStyle: 'italic' }, // slate-400
  '.cm-tpl-style': { color: '#7C3AED' }, // violet — style directives
  '.cm-tpl-logic': { color: '#DB2777', fontWeight: '600' }, // pink — if/each
  '.cm-tpl-helper': { color: '#0891B2' }, // cyan — helper calls
  '.cm-tpl-var': { color: '#2563EB', fontWeight: '600' }, // brand — raw variable
  '.cm-tpl-chip': {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 1px',
    borderRadius: '6px',
    backgroundColor: '#EFF6FF', // blue-50
    border: '1px solid #BFDBFE', // blue-200
    color: '#1D4ED8', // blue-700
    fontSize: '11.5px',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    verticalAlign: 'baseline',
    cursor: 'text',
  },
  '.cm-tpl-chip-unknown': {
    backgroundColor: '#FFFBEB', // amber-50
    borderColor: '#FDE68A', // amber-200
    color: '#B45309', // amber-700
  },
})
