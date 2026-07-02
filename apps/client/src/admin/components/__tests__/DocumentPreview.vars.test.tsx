// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DocumentPreview } from '../DocumentPreview'
import type { FormConfig } from '../../../types/form'

// The engine-backed module is mocked away (no '@doc-engine' alias under
// `vitest run`); splitAnnotated + chip rendering run for real. The annotated
// render itself is covered against the REAL engine in annotatedContext.test.ts.
vi.mock('../../lib/documentPreview', () => ({
  renderPreview: () => ({
    ok: true,
    paragraphs: [{ text: 'Позивач: ________', className: '' }],
  }),
  renderAnnotatedPreview: () => ({
    ok: true,
    paragraphs: [{ text: 'Позивач: ⦃last_name⦄', className: '' }],
  }),
}))

const formConfig: FormConfig = {
  service_id: 'test',
  title: 'Тест',
  tabs: [{ id: 'main', label: 'Основне' }],
  steps: [{ id: 'last_name', tab: 'main', type: 'text', label: 'Прізвище' }],
}

afterEach(cleanup)

describe('DocumentPreview — «Показати змінні» mode', () => {
  it('renders unfilled fields as chips labeled with the Ukrainian field label', () => {
    render(<DocumentPreview template="tpl" slug={null} formConfig={formConfig} />)
    fireEvent.click(screen.getByText('Показати змінні'))
    expect(screen.getByText('Прізвище')).toBeTruthy()
    expect(screen.getByText(/Позивач:/)).toBeTruthy()
    // explanatory copy for the mode
    expect(screen.getByText(/поля форми, які заповнить клієнт/)).toBeTruthy()
  })

  it('falls back to the field id when the form has no label for it', () => {
    const noLabel: FormConfig = {
      ...formConfig,
      steps: [{ id: 'last_name', tab: 'main', type: 'text', label: '' }],
    }
    render(<DocumentPreview template="tpl" slug={null} formConfig={noLabel} />)
    fireEvent.click(screen.getByText('Показати змінні'))
    expect(screen.getByText('last_name')).toBeTruthy()
  })

  it('does not offer the mode without a form config', () => {
    render(<DocumentPreview template="tpl" slug={null} />)
    expect(screen.queryByText('Показати змінні')).toBeNull()
  })
})
