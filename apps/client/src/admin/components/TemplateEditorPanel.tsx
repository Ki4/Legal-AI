import { useCallback, useMemo, useRef, useState } from 'react'
import { analyzeTemplate, diffFormVsTemplate, providedContextKeys } from '../../lib/serviceAnatomy'
import type { FormConfig } from '../../types/form'
import type { GateResult } from '../lib/templateGate'
import { useConfirm } from '../ui'
import { TemplateCodeEditor, type TemplateEditorHandle } from './TemplateCodeEditor'
import { TemplateToolbar } from './TemplateToolbar'
import { VariablePalette } from './VariablePalette'
import { insertSnippet, insertLineBefore, wrapSelection } from '../lib/insertAtCursor'
import type { EditResult } from '../lib/insertAtCursor'
import { CLAIM_SKELETON } from '../lib/templateSkeleton'

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
  const confirm = useConfirm()
  const editorRef = useRef<TemplateEditorHandle>(null)
  // Until the lawyer has placed the caret at least once, the selection is 0 and
  // every toolbar insert would silently land at the very top of the template.
  const [caretPlaced, setCaretPlaced] = useState(false)

  // Toolbar/palette edits: apply a pure edit at the current selection. CodeMirror
  // commits text + caret in ONE transaction (applyText), so there is no caret
  // restore race by construction (the s65 rAF/useLayoutEffect dance is gone).
  const applyEdit = (edit: (text: string, selStart: number, selEnd: number) => EditResult) => {
    const editor = editorRef.current
    if (!editor) return
    const { start, end } = editor.getSelection()
    const { text, caret } = edit(draft, start, end)
    editor.applyText(text, caret)
    onDraftChange(text)
  }

  // Chip labels for {{поле}} decorations: Ukrainian label from the form config;
  // engine-computed context keys (plaintiff_name, court_fee, ai…) get a neutral
  // chip with their own id — amber "unknown" is reserved for true typos (the
  // same semantics as the «немає у формі» warning below).
  const labelFor = useCallback(
    (fieldId: string) => {
      const field = formConfig.steps.find((s) => s.id === fieldId)
      if (field) return field.label || fieldId
      // Each-scope helpers ('@index1', 'this', item props like 'raw') and
      // engine-computed keys are legitimate — neutral chip with their own id.
      if (fieldId.startsWith('@') || fieldId === 'this' || fieldId === 'raw') return fieldId
      return providedContextKeys().includes(fieldId) ? fieldId : undefined
    },
    [formConfig],
  )

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
          {/* One-click discard instead of endless Ctrl+Z (Sergey, s66): draft
              becomes a copy of the published version again. Local state only —
              «Зберегти чернетку» persists it, exactly like a manual edit would. */}
          {published !== null && (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Скинути зміни чернетки?',
                  body: 'Чернетка стане копією чинної опублікованої версії. Поточні правки буде втрачено.',
                  confirmLabel: 'Скинути',
                  variant: 'warn',
                })
                if (ok) onDraftChange(published)
              }}
              disabled={!isDraftDifferent}
              className="px-4 py-2 text-inkSoft hover:text-ink disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors"
            >
              Скинути зміни
            </button>
          )}
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
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs text-inkMute">
            Ця послуга ще не має шаблону. Напишіть текст документа — поля клієнта вставляються як{' '}
            <code className="text-brand">{'{{поле}}'}</code> — або почніть із заготовки.
          </p>
          {/* §5: optional skeleton — 8 canonical blocks with styles + keep-block.
              Placeholder wording only; the lawyer rewrites it before publishing. */}
          <button
            type="button"
            onClick={() => onDraftChange(CLAIM_SKELETON)}
            className="px-3 py-1.5 bg-paperAlt hover:bg-paperAlt/70 text-ink text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            📄 Створити з каркаса
          </button>
        </div>
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

      <TemplateCodeEditor
        ref={editorRef}
        value={draft}
        onChange={onDraftChange}
        onFocus={() => setCaretPlaced(true)}
        labelFor={labelFor}
        placeholder={'До ________ районного суду… {{!style: right}} Позивач: {{plaintiff_name}}'}
        ariaLabel="Шаблон документа"
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
