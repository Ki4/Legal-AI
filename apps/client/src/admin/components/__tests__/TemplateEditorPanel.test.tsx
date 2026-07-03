// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TemplateEditorPanel } from '../TemplateEditorPanel'
import { ConfirmProvider } from '../../ui'
import type { FormConfig } from '../../../types/form'
import type { GateResult } from '../../lib/templateGate'

// CodeMirror does not run under jsdom (layout/measure APIs) — the editor is
// stubbed with a textarea implementing the SAME contract (value/onChange/
// onFocus + getSelection/applyText/focus handle). The panel logic under test
// (caret gate, applyEdit wiring, buttons) is editor-agnostic by design;
// CM-specific behaviour is covered by templateTokens tests + live verify.
const { applyTextSpy } = vi.hoisted(() => ({ applyTextSpy: vi.fn() }))
vi.mock('../TemplateCodeEditor', async () => {
  const React = await import('react')
  return {
    TemplateCodeEditor: React.forwardRef(function Stub(
      props: {
        value: string
        onChange: (t: string) => void
        onFocus?: () => void
        placeholder?: string
      },
      ref: React.Ref<unknown>,
    ) {
      const taRef = React.useRef<HTMLTextAreaElement>(null)
      React.useImperativeHandle(ref, () => ({
        getSelection: () => ({
          start: taRef.current?.selectionStart ?? 0,
          end: taRef.current?.selectionEnd ?? 0,
        }),
        applyText: (text: string, caret: number) => applyTextSpy(text, caret),
        focus: () => taRef.current?.focus(),
      }))
      return React.createElement('textarea', {
        ref: taRef,
        value: props.value,
        placeholder: props.placeholder,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value),
        onFocus: props.onFocus,
      })
    }),
  }
})

// The panel is engine-free by design: the gate is injected, so this smoke test
// needs no '@doc-engine' alias (unavailable under `vitest run`).
const FORM: FormConfig = {
  service_id: 'divorce',
  title: 'Т',
  tabs: [{ id: 'g', label: 'Загальне' }],
  steps: [
    { id: 'last_name', tab: 'g', type: 'text', label: 'Прізвище' },
  ],
}

const okGate = (): GateResult => ({ ok: true })

function renderPanel(over: Partial<Parameters<typeof TemplateEditorPanel>[0]> = {}) {
  return render(
    <ConfirmProvider>
      <TemplateEditorPanel
        draft="Позивач: {{last_name}}"
        published="old"
        isNew={false}
        formConfig={FORM}
        validate={okGate}
        onDraftChange={() => {}}
        onSaveDraft={() => {}}
        onPublish={() => {}}
        savingDraft={false}
        publishing={false}
        {...over}
      />
    </ConfirmProvider>,
  )
}

beforeEach(() => applyTextSpy.mockClear())
afterEach(cleanup)

describe('TemplateEditorPanel', () => {
  it('renders the editor with publish enabled for a valid changed draft', () => {
    renderPanel()
    expect(screen.getByRole('textbox')).toBeTruthy()
    const publish = screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement
    expect(publish.disabled).toBe(false)
  })

  it('disables publish and shows the error on a parse failure — draft save stays enabled', () => {
    const failing = vi.fn((): GateResult => ({ ok: false, error: 'Помилка в шаблоні: тест' }))
    renderPanel({ validate: failing })
    const publish = screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByRole('alert').textContent).toContain('Помилка в шаблоні')
    const save = screen.getByRole('button', { name: 'Зберегти чернетку' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
  })

  it('disables publish when the draft equals the published version', () => {
    renderPanel({ draft: 'same', published: 'same' })
    const publish = screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement
    expect(publish.disabled).toBe(true)
    expect(screen.getByText(/збігається з опублікованою/i)).toBeTruthy()
  })

  it('warns about template variables the form does not ask', () => {
    renderPanel({ draft: 'Хтось: {{totally_unknown_var}}' })
    expect(screen.getByText(/немає у формі/).textContent).toContain('totally_unknown_var')
  })

  it('resets the draft to the published version after the confirm dialog', async () => {
    const onDraftChange = vi.fn()
    renderPanel({ onDraftChange }) // draft differs from published
    fireEvent.click(screen.getByRole('button', { name: 'Скинути зміни' }))
    expect(onDraftChange).not.toHaveBeenCalled() // waits for the modal
    fireEvent.click(await screen.findByRole('button', { name: 'Скинути' }))
    await vi.waitFor(() => expect(onDraftChange).toHaveBeenCalledWith('old'))
  })

  it('keeps the draft when the reset dialog is cancelled', async () => {
    const onDraftChange = vi.fn()
    renderPanel({ onDraftChange })
    fireEvent.click(screen.getByRole('button', { name: 'Скинути зміни' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Скинути' })).toBeNull(),
    )
    expect(onDraftChange).not.toHaveBeenCalled()
  })

  it('disables reset when the draft equals the published version, hides it with none', () => {
    renderPanel({ draft: 'same', published: 'same' })
    const reset = screen.getByRole('button', { name: 'Скинути зміни' }) as HTMLButtonElement
    expect(reset.disabled).toBe(true)
    cleanup()
    renderPanel({ draft: '', published: null }) // nothing published yet — nothing to reset to
    expect(screen.queryByRole('button', { name: 'Скинути зміни' })).toBeNull()
  })

  it('offers «Створити з каркаса» only while the service has no template at all', async () => {
    const { CLAIM_SKELETON } = await import('../../lib/templateSkeleton')
    const onDraftChange = vi.fn()
    renderPanel({ draft: '', published: null, onDraftChange })
    fireEvent.click(screen.getByRole('button', { name: /Створити з каркаса/ }))
    expect(onDraftChange).toHaveBeenCalledWith(CLAIM_SKELETON)
  })

  it('hides the skeleton button once a template exists', () => {
    renderPanel() // draft + published are set
    expect(screen.queryByRole('button', { name: /Створити з каркаса/ })).toBeNull()
  })

  it('shows the save-first hint for a brand-new service', () => {
    renderPanel({ isNew: true })
    expect(screen.getByText(/Спочатку збережіть нову послугу/)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('toolbar style button inserts the directive into the draft via onDraftChange', () => {
    const onDraftChange = vi.fn()
    renderPanel({ draft: 'Позивач: {{last_name}}', onDraftChange })
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.focus(textarea) // unlock the toolbar (caret-placed guard)
    textarea.setSelectionRange(3, 3) // caret inside the only paragraph
    fireEvent.click(screen.getByRole('button', { name: 'Праворуч' }))
    expect(onDraftChange).toHaveBeenCalledWith('{{!style: right}}\nПозивач: {{last_name}}')
  })

  it('locks toolbar and palette until the caret is placed in the textarea', () => {
    const onDraftChange = vi.fn()
    renderPanel({ onDraftChange })
    const style = screen.getByRole('button', { name: 'Праворуч' }) as HTMLButtonElement
    const chip = screen.getByRole('button', { name: /Прізвище/ }) as HTMLButtonElement
    expect(style.disabled).toBe(true)
    expect(chip.disabled).toBe(true)
    expect(screen.getByText(/Клацніть у текст шаблону/)).toBeTruthy()
    fireEvent.click(style)
    expect(onDraftChange).not.toHaveBeenCalled() // nothing lands at position 0

    fireEvent.focus(screen.getByRole('textbox'))
    expect(style.disabled).toBe(false)
    expect(chip.disabled).toBe(false)
    expect(screen.queryByText(/Клацніть у текст шаблону/)).toBeNull()
  })

  it('applies toolbar edits at the editor selection as ONE text+caret transaction', () => {
    // Stateful host: applyEdit reads the selection from the editor handle,
    // computes the pure edit and commits text+caret via applyText.
    function Host() {
      const [draft, setDraft] = useState('Позивач: {{last_name}}')
      return (
        <TemplateEditorPanel
          draft={draft}
          published="old"
          isNew={false}
          formConfig={FORM}
          validate={okGate}
          onDraftChange={setDraft}
          onSaveDraft={() => {}}
          onPublish={() => {}}
          savingDraft={false}
          publishing={false}
        />
      )
    }
    render(
      <ConfirmProvider>
        <Host />
      </ConfirmProvider>,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.focus(textarea)
    textarea.setSelectionRange(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Праворуч' }))
    const expectedText = '{{!style: right}}\nПозивач: {{last_name}}'
    // insertLineBefore keeps the caret at its text position, shifted by the insert
    const expectedCaret = 3 + '{{!style: right}}\n'.length
    expect(applyTextSpy).toHaveBeenCalledWith(expectedText, expectedCaret)
    expect(textarea.value).toBe(expectedText) // host state updated via onDraftChange
  })
})
