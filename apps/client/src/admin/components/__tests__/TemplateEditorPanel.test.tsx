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
      // eslint-disable-next-line react-hooks/refs -- test mock: forwards its ref to the textarea while exposing an imperative handle
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

  // ── Publish gate against structural '________' holes (#88 §1/§3/§7) ────────
  describe('dead-ref publish gate', () => {
    it('blocks publish and shows the danger banner for an unknown variable', () => {
      renderPanel({ draft: 'Хтось: {{totally_unknown_var}}' })
      const banner = screen.getByRole('alert')
      expect(banner.textContent).toContain('Опублікувати неможливо')
      expect(banner.textContent).toContain('{{totally_unknown_var}}')
      // the draft-is-safe exit line (parse-error idiom)
      expect(banner.textContent).toContain('Чернетку можна зберегти')
      const publish = screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement
      expect(publish.disabled).toBe(true)
      expect(publish.title).toContain('немає у формі')
      // never lose work: draft save stays enabled
      const save = screen.getByRole('button', { name: 'Зберегти чернетку' }) as HTMLButtonElement
      expect(save.disabled).toBe(false)
    })

    it('blocks the computed/ai layer too: declension typo + sources-less computed key', () => {
      renderPanel({ draft: '{{ai.defendant_dative}} і {{plaintiff_name}}' })
      const banner = screen.getByRole('alert')
      expect(banner.textContent).toContain('{{ai.defendant_dative}}')
      // FORM has only last_name → plaintiff_name alive; use a form without sources
      cleanup()
      renderPanel({
        draft: '{{plaintiff_name}}',
        formConfig: { ...FORM, steps: [{ id: 'other', tab: 'g', type: 'text', label: 'Інше' }] },
      })
      expect(screen.getByRole('alert').textContent).toContain('потребує хоча б одного з полів')
      expect((screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('|raw does not bypass the gate (silent-empty is still a structural hole)', () => {
      renderPanel({ draft: '{{ghost_field|raw}}' })
      expect((screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement).disabled).toBe(true)
    })

    it('js-mode (dormant draft): informational amber, publish NOT blocked by dead refs', () => {
      renderPanel({ draft: 'Хтось: {{totally_unknown_var}}', generationMode: 'js' })
      expect(screen.queryByRole('alert')).toBeNull() // no danger banner
      expect(screen.getByText(/не впливає/).textContent).toContain('{{totally_unknown_var}}')
      const publish = screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement
      expect(publish.disabled).toBe(false)
    })

    it('clean template with known fields and computed keys → no banner, publish enabled', () => {
      renderPanel({ draft: '{{last_name}} {{plaintiff_name}} {{#if ai.reasoning}}x{{/if}}' })
      expect(screen.queryByRole('alert')).toBeNull()
      expect((screen.getByRole('button', { name: 'Опублікувати' }) as HTMLButtonElement).disabled).toBe(false)
    })
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

  it('shows a «Фокус-режим» button when onToggleFocus is provided, hidden otherwise', () => {
    const onToggleFocus = vi.fn()
    renderPanel({ onToggleFocus })
    const focusBtn = screen.getByRole('button', { name: 'Фокус-режим' })
    fireEvent.click(focusBtn)
    expect(onToggleFocus).toHaveBeenCalledTimes(1)

    cleanup()
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Фокус-режим' })).toBeNull()
  })

  it('focus mode swaps the title+description header for a slim action row with exit + preview toggle', () => {
    const onToggleFocus = vi.fn()
    const onTogglePreviewVisible = vi.fn()
    renderPanel({
      focusMode: true,
      onToggleFocus,
      previewVisible: true,
      onTogglePreviewVisible,
    })
    expect(screen.queryByText('Шаблон документа')).toBeNull() // title chrome gone
    expect(screen.queryByRole('button', { name: 'Фокус-режим' })).toBeNull() // enter-button gone

    fireEvent.click(screen.getByRole('button', { name: 'Закрити фокус-режим' }))
    expect(onToggleFocus).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Сховати превʼю' }))
    expect(onTogglePreviewVisible).toHaveBeenCalledTimes(1)

    // Publish/save/reset stay available in focus mode (decision 6)
    expect(screen.getByRole('button', { name: 'Опублікувати' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Зберегти чернетку' })).toBeTruthy()
  })

  it('focus mode preview toggle reflects hidden state', () => {
    renderPanel({ focusMode: true, previewVisible: false, onTogglePreviewVisible: () => {} })
    expect(screen.getByRole('button', { name: 'Показати превʼю' })).toBeTruthy()
  })

  it('«Жирний» is dual-mode: selection → inline {{#bold}} run, caret → paragraph directive', () => {
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

    // Non-empty selection over {{last_name}} → exact inline wrap (styleHints v2)
    textarea.setSelectionRange(9, 22)
    fireEvent.click(screen.getByRole('button', { name: 'Жирний' }))
    const wrapped = 'Позивач: {{#bold}}{{last_name}}{{/bold}}'
    expect(applyTextSpy).toHaveBeenLastCalledWith(wrapped, 22 + '{{#bold}}{{/bold}}'.length)
    expect(textarea.value).toBe(wrapped)

    // Collapsed caret → whole-paragraph directive, exactly as before
    textarea.setSelectionRange(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Жирний' }))
    expect(applyTextSpy).toHaveBeenLastCalledWith(
      '{{!style: bold}}\n' + wrapped,
      3 + '{{!style: bold}}\n'.length,
    )
  })
})
