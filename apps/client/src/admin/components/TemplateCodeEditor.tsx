// S2 slice A (specs/features/template-editor §5b): CodeMirror 6 replaces the
// textarea. The document IS the DSL string (invariant 1 — no (de)serializer
// between the lawyer and the engine); syntax colours and variable chips are
// decorations only. The imperative handle keeps the toolbar/palette contract
// of the textarea era: pure edit functions get (text, selStart, selEnd) and
// give back (text, caret) — applyText commits both in one transaction, so no
// caret-restore races by construction (the s65 rAF/useLayoutEffect dance is gone).

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, EditorSelection, Compartment } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  templateDecorations,
  templateFolding,
  templateTheme,
  type LabelLookup,
} from '../lib/templateEditorTheme'

export interface TemplateEditorHandle {
  /** Current main selection, in absolute char offsets. */
  getSelection(): { start: number; end: number }
  /** Replace the whole document and place the caret — one transaction. */
  applyText(text: string, caret: number): void
  focus(): void
}

export const TemplateCodeEditor = forwardRef<
  TemplateEditorHandle,
  {
    value: string
    onChange: (text: string) => void
    /** Fired when the editor gains focus (caret-placed gate in the panel). */
    onFocus?: () => void
    /** Fired when the caret moves to another line (0-based) — sync-highlight
     *  of the matching preview paragraph (S2 slice C). */
    onCaretLine?: (line: number) => void
    labelFor: LabelLookup
    placeholder?: string
    ariaLabel?: string
  }
>(function TemplateCodeEditor(
  { value, onChange, onFocus, onCaretLine, labelFor, placeholder, ariaLabel },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const decoCompartment = useRef(new Compartment())
  const lastCaretLine = useRef(-1)
  // Latest callbacks without recreating the view (written in an effect, not
  // during render — react-hooks/refs).
  const onChangeRef = useRef(onChange)
  const onFocusRef = useRef(onFocus)
  const onCaretLineRef = useRef(onCaretLine)
  useEffect(() => {
    onChangeRef.current = onChange
    onFocusRef.current = onFocus
    onCaretLineRef.current = onCaretLine
  }, [onChange, onFocus, onCaretLine])

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          cmPlaceholder(placeholder ?? ''),
          templateTheme,
          templateFolding,
          decoCompartment.current.of(templateDecorations(labelFor)),
          EditorView.contentAttributes.of({
            'aria-label': ariaLabel ?? 'Шаблон документа',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
            if (update.focusChanged && update.view.hasFocus) onFocusRef.current?.()
            if (update.selectionSet || update.docChanged) {
              const line =
                update.state.doc.lineAt(update.state.selection.main.head).number - 1
              if (line !== lastCaretLine.current) {
                lastCaretLine.current = line
                onCaretLineRef.current?.(line)
              }
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The view is created once; value/labelFor changes are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External value change (reset / skeleton / restore) → replace the document.
  // Internal edits already match `value` via the update listener, so this is a no-op for them.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  // Form config changed → rebuild chip labels.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: decoCompartment.current.reconfigure(templateDecorations(labelFor)),
    })
  }, [labelFor])

  useImperativeHandle(ref, () => ({
    getSelection() {
      const view = viewRef.current
      if (!view) return { start: 0, end: 0 }
      const { from, to } = view.state.selection.main
      return { start: from, end: to }
    },
    applyText(text: string, caret: number) {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: EditorSelection.cursor(Math.min(caret, text.length)),
        scrollIntoView: true,
      })
      view.focus()
    },
    focus() {
      viewRef.current?.focus()
    },
  }))

  return (
    // Paper underlay (C5): the DOCUMENT is paper — the editor keeps the Legal
    // Light sheet in BOTH themes (literal colours, not theme tokens), matching
    // the decoration palette which is hardcoded light. In the dark theme the
    // page chrome darkens around a light sheet; in light nothing changes.
    <div
      ref={hostRef}
      className="flex-1 min-h-[220px] w-full bg-[#FBFAF7] border border-[#E0DCD2] rounded-xl
                 overflow-hidden focus-within:border-brand [&_.cm-editor]:h-full"
    />
  )
})
