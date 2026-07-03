import {
  AlignCenter,
  AlignRight,
  ArrowDownToLine,
  Bold,
  GitBranch,
  Group,
  IndentIncrease,
  Repeat,
  Braces,
} from 'lucide-react'

/**
 * Toolbar for the template editor (specs/features/template-editor §4a).
 * Purely presentational and engine-free: every button reports the exact DSL
 * text to insert; the panel owns the textarea and caret logic.
 */

const STYLE_BUTTONS: { label: string; title: string; directive: string; Icon: typeof Bold }[] = [
  { label: 'Центр', title: 'Вирівняти абзац по центру', directive: '{{!style: center}}', Icon: AlignCenter },
  { label: 'Праворуч', title: 'Вирівняти абзац праворуч', directive: '{{!style: right}}', Icon: AlignRight },
  { label: 'Жирний', title: 'Зробити абзац жирним', directive: '{{!style: bold}}', Icon: Bold },
  { label: 'Відступ', title: 'Абзац із відступом першого рядка', directive: '{{!style: indent}}', Icon: IndentIncrease },
  { label: 'З нової сторінки', title: 'Почати абзац з нової сторінки', directive: '{{!style: page-break-before}}', Icon: ArrowDownToLine },
]

const LOGIC_BUTTONS: { label: string; title: string; snippet: string; Icon: typeof Bold }[] = [
  { label: 'Умовний блок', title: 'Текст, що зʼявляється лише за умовою', snippet: '{{#if поле}}\n…\n{{/if}}', Icon: GitBranch },
  { label: 'Повтор', title: 'Повторити текст для кожного елемента (напр., дітей)', snippet: '{{#each children}}\n…\n{{/each}}', Icon: Repeat },
  { label: 'Поле', title: 'Вставити значення поля форми', snippet: '{{поле}}', Icon: Braces },
]

const BTN =
  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-inkSoft hover:text-ink ' +
  'bg-paperAlt hover:bg-paperAlt/70 border border-line rounded-lg transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none'

// Buttons must not steal focus from the textarea on mousedown — otherwise the
// selection collapses before onClick reads it and the caret restore has nothing
// to restore to.
const keepTextareaFocus = (e: { preventDefault: () => void }) => e.preventDefault()

export function TemplateToolbar({
  onStyle,
  onWrap,
  onInsert,
  disabled,
}: {
  onStyle: (directive: string) => void
  onWrap: (open: string, close: string) => void
  onInsert: (snippet: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STYLE_BUTTONS.map(({ label, title, directive, Icon }) => (
        <button
          key={directive}
          type="button"
          title={title}
          disabled={disabled}
          onMouseDown={keepTextareaFocus}
          onClick={() => onStyle(directive)}
          className={BTN}
        >
          <Icon size={13} aria-hidden />
          {label}
        </button>
      ))}

      <span className="w-px h-4 bg-lineStrong mx-0.5" aria-hidden />

      <button
        type="button"
        title="Не розривати виділені абзаци між сторінками"
        disabled={disabled}
        onMouseDown={keepTextareaFocus}
        onClick={() => onWrap('{{!style: keep-block}}', '{{!style: /keep-block}}')}
        className={BTN}
      >
        <Group size={13} aria-hidden />
        Тримати разом
      </button>

      <span className="w-px h-4 bg-lineStrong mx-0.5" aria-hidden />

      {LOGIC_BUTTONS.map(({ label, title, snippet, Icon }) => (
        <button
          key={label}
          type="button"
          title={title}
          disabled={disabled}
          onMouseDown={keepTextareaFocus}
          onClick={() => onInsert(snippet)}
          className={BTN}
        >
          <Icon size={13} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
