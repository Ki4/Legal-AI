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
import type { Range } from '@codemirror/state'
import { codeFolding, foldGutter, foldService } from '@codemirror/language'
import {
  matchTemplateBlocks,
  matchTemplateRuns,
  scanTemplateTokens,
  styleKeywordsOf,
} from './templateTokens'

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

/** Ukrainian pill labels for {{!style:…}} keywords (A2 — icons over raw tags). */
const STYLE_LABELS: Record<string, string> = {
  center: '⇔ центр',
  right: '→ праворуч',
  bold: 'Ж жирний',
  italic: 'К курсив',
  indent: '⇥ відступ',
  'page-break-before': '⤓ з нової сторінки',
  'keep-with-next': '⇊ не відривати',
  'keep-block': '▼ тримати разом',
  '/keep-block': '▲ кінець «разом»',
}

class StyleChipWidget extends WidgetType {
  private readonly keywords: string[]

  constructor(keywords: string[]) {
    super()
    this.keywords = keywords
  }

  override eq(other: StyleChipWidget): boolean {
    return other.keywords.join(' ') === this.keywords.join(' ')
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-tpl-stylechip'
    el.textContent = this.keywords.map((k) => STYLE_LABELS[k] ?? k).join(' · ')
    el.title = 'Директива стилю абзацу — клацніть, щоб редагувати'
    return el
  }

  override ignoreEvent(): boolean {
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

const BLOCK_LINE = Decoration.line({ class: 'cm-tpl-blockline' })

// Inline runs (styleHints v2, slice C): the text INSIDE {{#bold}}…{{/bold}}
// renders bold in the editor too, matching the preview («применил — сразу
// видишь»). Purely visual, tolerant of half-written pairs (matchTemplateRuns).
const RUN_MARK: Record<string, Decoration> = {
  bold: Decoration.mark({ class: 'cm-tpl-run-bold' }),
  italic: Decoration.mark({ class: 'cm-tpl-run-italic' }),
  underline: Decoration.mark({ class: 'cm-tpl-run-underline' }),
}

function buildDecorations(view: EditorView, labelFor: LabelLookup): DecorationSet {
  const out: Range<Decoration>[] = []
  const text = view.state.doc.toString()
  const doc = view.state.doc
  const ranges = view.state.selection.ranges
  const touchedBy = (from: number, to: number) =>
    ranges.some((r) => r.from <= to && r.to >= from)

  for (const token of scanTemplateTokens(text)) {
    if (token.kind === 'var') {
      // Cursor/selection touching the tag (boundaries inclusive) → raw source.
      if (touchedBy(token.from, token.to)) {
        out.push(MARK_CLASS.var.range(token.from, token.to))
      } else {
        const label = token.name ? labelFor(token.name) : undefined
        out.push(
          Decoration.replace({
            widget: new VarChipWidget(label ?? token.name ?? '?', label !== undefined),
          }).range(token.from, token.to),
        )
      }
    } else if (token.kind === 'style') {
      const keywords = styleKeywordsOf(text, token)
      // An empty {{!style:}} would collapse into an invisible pill (s67 finding)
      // — keep the raw tag visible so the lawyer can see and fix/delete it.
      if (keywords.length === 0 || touchedBy(token.from, token.to)) {
        out.push(MARK_CLASS.style.range(token.from, token.to))
      } else {
        out.push(
          Decoration.replace({
            widget: new StyleChipWidget(keywords),
          }).range(token.from, token.to),
        )
      }
    } else {
      out.push(MARK_CLASS[token.kind].range(token.from, token.to))
    }
  }

  // Bold/italic/underline the text between run tags — same look as the preview.
  for (const run of matchTemplateRuns(text)) {
    if (run.openTo < run.closeFrom) {
      out.push(RUN_MARK[run.style].range(run.openTo, run.closeFrom))
    }
  }

  // Colour stripe on the lines INSIDE every {{#if}}/{{#each}} block, so the
  // conditional span is visible even with the fold gutter untouched.
  for (const block of matchTemplateBlocks(text)) {
    const first = doc.lineAt(block.openFrom).number + 1
    const last = doc.lineAt(block.closeFrom).number - 1
    for (let n = first; n <= last; n++) {
      out.push(BLOCK_LINE.range(doc.line(n).from))
    }
  }

  return Decoration.set(out, true)
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

/**
 * Folding for {{#if}}/{{#each}} blocks (A2): the fold keeps the opening and
 * closing tags visible and hides the interior lines. Tolerant matcher — while
 * the lawyer is mid-edit the service simply offers no fold for broken pairs.
 */
export const templateFolding = [
  codeFolding({
    placeholderText: '… згорнуто …',
  }),
  foldGutter({
    openText: '▾',
    closedText: '▸',
  }),
  foldService.of((state, lineFrom, lineTo) => {
    const text = state.doc.toString()
    for (const block of matchTemplateBlocks(text)) {
      if (block.openFrom >= lineFrom && block.openFrom <= lineTo) {
        const openLine = state.doc.lineAt(block.openFrom)
        const closeLine = state.doc.lineAt(block.closeFrom)
        const from = openLine.to
        const to = closeLine.from - 1 // end of the line before the closing tag
        if (closeLine.number > openLine.number && from < to) return { from, to }
      }
    }
    return null
  }),
]

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
  '.cm-tpl-stylechip': {
    display: 'inline-block',
    padding: '0 6px',
    margin: '0 1px',
    borderRadius: '6px',
    backgroundColor: '#F5F3FF', // violet-50
    border: '1px solid #DDD6FE', // violet-200
    color: '#6D28D9', // violet-700
    fontSize: '11px',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    whiteSpace: 'nowrap',
    cursor: 'text',
  },
  '.cm-tpl-run-bold': { fontWeight: '700' },
  '.cm-tpl-run-italic': { fontStyle: 'italic' },
  '.cm-tpl-run-underline': { textDecoration: 'underline' },
  '.cm-tpl-blockline': {
    borderLeft: '3px solid #FBCFE8', // pink-200 — inside an {{#if}}/{{#each}}
    paddingLeft: '5px !important',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94A3B8',
  },
  '.cm-foldGutter .cm-gutterElement': { cursor: 'pointer', padding: '0 4px' },
  '.cm-foldPlaceholder': {
    backgroundColor: '#FDF2F8', // pink-50
    border: '1px solid #FBCFE8',
    borderRadius: '6px',
    color: '#BE185D',
    padding: '0 8px',
    margin: '0 4px',
  },
})
