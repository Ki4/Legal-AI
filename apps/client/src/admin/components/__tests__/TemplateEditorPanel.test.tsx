// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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

  it('shows the save-first hint for a brand-new service', () => {
    renderPanel({ isNew: true })
    expect(screen.getByText(/Спочатку збережіть нову послугу/)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
