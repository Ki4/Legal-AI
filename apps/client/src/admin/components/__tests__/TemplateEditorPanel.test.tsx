// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TemplateEditorPanel } from '../TemplateEditorPanel'
import type { FormConfig } from '../../../types/form'
import type { GateResult } from '../../lib/templateGate'

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
    />,
  )
}

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

  it('restores focus and caret into the textarea after a toolbar insert', () => {
    // Stateful host: the caret is restored in useLayoutEffect on the commit
    // that re-renders the controlled value — needs a real state round-trip.
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
    render(<Host />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.focus(textarea)
    textarea.setSelectionRange(3, 3)
    fireEvent.click(screen.getByRole('button', { name: 'Праворуч' }))
    expect(textarea.value).toBe('{{!style: right}}\nПозивач: {{last_name}}')
    // insertLineBefore keeps the caret at its text position, shifted by the insert
    const expected = 3 + '{{!style: right}}\n'.length
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe(expected)
    expect(textarea.selectionEnd).toBe(expected)
  })
})
