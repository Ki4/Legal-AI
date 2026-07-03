import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { analyzeTemplate, diffFormVsTemplate } from '../../lib/serviceAnatomy'
import type { FormConfig } from '../../types/form'
import type { GateResult } from '../lib/templateGate'
import { TemplateToolbar } from './TemplateToolbar'
import { VariablePalette } from './VariablePalette'
import { insertSnippet, insertLineBefore, wrapSelection } from '../lib/insertAtCursor'
import type { EditResult } from '../lib/insertAtCursor'

/**
 * Left panel of the «Шаблон документа» tab (specs/features/template-editor §2.1):
 * monospace textarea + draft/publish controls + validation messages. The parse
 * gate is INJECTED (validate prop) so this component stays engine-free and
 * unit-testable without the '@doc-engine' alias; live preview renders in the
 * page's right panel (TemplateDraftPreview) from the same draft state.
 */
export function TemplateEditorPanel({
  draft,
  published,
  isNew,
  formConfig,
  validate,
  onDraftChange,
  onSaveDraft,
  onPublish,
  savingDraft,
  publishing,
}: {
  draft: string
  published: string | null
  isNew: boolean
  formConfig: FormConfig
  validate: (template: string) => GateResult
  onDraftChange: (v: string) => void
  onSaveDraft: () => void
  onPublish: () => void
  savingDraft: boolean
  publishing: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  // Until the lawyer has placed the caret at least once, selectionStart is 0 and
  // every toolbar insert would silently land at the very top of the template.
  const [caretPlaced, setCaretPlaced] = useState(false)

  // Toolbar/palette edits: apply a pure edit at the current selection, push the
  // new text up; the caret is restored in useLayoutEffect below — synchronously
  // with the commit that re-renders the controlled value (rAF is paused in
  // background windows and can lose the race with scroll/focus).
  const applyEdit = (edit: (text: string, selStart: number, selEnd: number) => EditResult) => {
    const el = textareaRef.current
    if (!el) return
    const { text, caret } = edit(draft, el.selectionStart, el.selectionEnd)
    pendingCaret.current = caret
    onDraftChange(text)
  }

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (pendingCaret.current === null || !el) return
    el.focus()
    el.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [draft])

  const gate = useMemo<GateResult>(
    () => (draft.trim() ? validate(draft) : { ok: true }),
    [draft, validate],
  )
  // Unknown-variable warning (§2.2): reuse the existing template↔form diff — the
  // engine's computed fields are already whitelisted there (PROVIDED_CONTEXT).
  const unmatched = useMemo(() => {
    if (!draft.trim() || !gate.ok) return []
    return diffFormVsTemplate(formConfig, analyzeTemplate(draft)).unmatchedPlaceholders
  }, [draft, gate.ok, formConfig])

  if (isNew) {
    return (
      <div className="text-center py-12 text-inkMute text-sm">
        Спочатку збережіть нову послугу — тоді зʼявиться редактор шаблона.
      </div>
    )
  }

  const isDraftDifferent = draft !== (published ?? '')
  const canPublish = gate.ok && draft.trim().length > 0 && isDraftDifferent && !publishing

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">Шаблон документа</h2>
          <p className="text-inkSoft text-sm">
            Правки зберігаються у чернетку. Клієнти отримують документ лише з опублікованої версії.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSaveDraft}
            disabled={savingDraft}
            className="px-4 py-2 bg-paperAlt hover:bg-paperAlt/70 disabled:opacity-50 text-ink text-sm font-semibold rounded-xl transition-colors"
          >
            {savingDraft ? 'Зберігаю…' : 'Зберегти чернетку'}
          </button>
          <button
            onClick={onPublish}
            disabled={!canPublish}
            title={gate.ok ? undefined : 'Виправте помилку в шаблоні, щоб опублікувати'}
            className="px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {publishing ? 'Публікую…' : 'Опублікувати'}
          </button>
        </div>
      </div>

      {/* Status line: parse error > draft-vs-published state */}
      {!gate.ok ? (
        <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl px-3 py-2.5">
          {gate.error}
          <span className="block text-xs text-inkMute mt-1">
            Чернетку можна зберегти й повернутися пізніше — але опублікувати з помилкою не можна.
          </span>
        </div>
      ) : published === null && !draft.trim() ? (
        <p className="text-xs text-inkMute">
          Ця послуга ще не має шаблону. Напишіть текст документа — поля клієнта вставляються як{' '}
          <code className="text-brand">{'{{поле}}'}</code>.
        </p>
      ) : (
        <p className={`text-xs ${isDraftDifferent ? 'text-warn' : 'text-inkMute'}`}>
          {isDraftDifferent
            ? '● Чернетка відрізняється від опублікованої версії'
            : '✓ Чернетка збігається з опублікованою версією'}
        </p>
      )}

      {unmatched.length > 0 && (
        <div className="text-xs text-warn bg-warn/10 border border-warn/30 rounded-xl px-3 py-2.5">
          ⚠ Шаблон використовує змінні, яких немає у формі: {unmatched.join(', ')}. Документ
          надрукує «________» замість них.
        </div>
      )}

      <TemplateToolbar
        disabled={isNew || !caretPlaced}
        onStyle={(directive) => applyEdit((t, s) => insertLineBefore(t, s, directive))}
        onWrap={(open, close) => applyEdit((t, s, e) => wrapSelection(t, s, e, open, close))}
        onInsert={(snippet) => applyEdit((t, s, e) => insertSnippet(t, s, e, snippet))}
      />
      {!caretPlaced && (
        <p className="text-xs text-inkMute -mt-1.5">
          Клацніть у текст шаблону — тоді кнопки стилів застосуються до абзацу під курсором.
        </p>
      )}

      <textarea
        ref={textareaRef}
        value={draft}
        onFocus={() => setCaretPlaced(true)}
        onChange={(e) => onDraftChange(e.target.value)}
        spellCheck={false}
        className="flex-1 min-h-[320px] w-full px-4 py-3 bg-paperAlt border border-lineStrong rounded-xl
                   text-ink text-[13px] font-mono leading-relaxed focus:outline-none focus:border-brand resize-none"
        placeholder={'До ________ районного суду…\n{{!style: right}}\nПозивач: {{plaintiff_name}}'}
      />

      {/* Collapsed by default — the editor needs the vertical space more. */}
      <details>
        <summary className="text-sm font-semibold text-ink cursor-pointer select-none">
          Змінні форми
        </summary>
        <div className="mt-2">
          <VariablePalette
            formConfig={formConfig}
            template={draft}
            disabled={!caretPlaced}
            onInsert={(token) => applyEdit((t, s, e) => insertSnippet(t, s, e, token))}
          />
        </div>
      </details>
    </div>
  )
}
