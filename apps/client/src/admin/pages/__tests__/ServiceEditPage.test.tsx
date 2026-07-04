// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Heavy children (CodeMirror editor, doc-engine preview) are stubbed — what's
// under test is the page's tab logic (#88 §3/§4), which is child-agnostic.
const { USER, dbState } = vi.hoisted(() => {
  const USER = { id: 'lawyer-1', email: 'olga@example.com' }
  const dbState = {
    service: { data: null as Record<string, unknown> | null, error: null as { message: string } | null },
  }
  return { USER, dbState }
})
// Full hook surface — the REAL AdminLayout renders in these tests and
// destructures signOut for the «Вийти» button.
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: USER,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
  }),
}))
vi.mock('../../../lib/supabase', () => {
  function thenable(getResult: () => unknown) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'not', 'gte', 'update', 'insert', 'delete', 'single']) {
      b[m] = () => b
    }
    b.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve().then(() => onFulfilled(getResult()))
    return b
  }
  return { supabase: { from: () => thenable(() => dbState.service) } }
})

function stubModule(names: string[]) {
  return async () => {
    const React = await import('react')
    const mod: Record<string, unknown> = {}
    for (const n of names) mod[n] = () => React.createElement('div', null, `${n}-stub`)
    return mod
  }
}
vi.mock('../../components/FormBuilder', stubModule(['FormBuilder']))
vi.mock('../../components/TemplateEditorPanel', stubModule(['TemplateEditorPanel']))
vi.mock('../../components/TemplateDraftPreview', stubModule(['TemplateDraftPreview']))
vi.mock('../../components/TemplateRevisionHistory', stubModule(['TemplateRevisionHistory']))
vi.mock('../../components/Splitter', stubModule(['Splitter']))
vi.mock('../../../components/DynamicLegalFormBuilder', stubModule(['DynamicLegalFormBuilder']))
// documentPreview pulls the '@doc-engine' alias (unavailable under vitest) —
// the page only passes validateDraft through to stubbed children.
vi.mock('../../lib/documentPreview', () => ({ validateDraft: () => ({ ok: true }) }))
vi.mock('../../lib/serviceTemplate', () => ({ publishTemplate: vi.fn() }))

import { ServiceEditPage } from '../ServiceEditPage'
import { ConfirmProvider } from '../../ui'

beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)

function serviceRow(generation_mode: string | null) {
  return {
    id: 1,
    slug: 'divorce',
    title: 'Розлучення',
    form_config: {
      service_id: 'divorce',
      title: 'Розлучення',
      tabs: [{ id: 'g', label: 'Загальне' }],
      steps: [],
    },
    ai_prompt: 'Склади документ.',
    document_template: 'Текст шаблону',
    document_template_draft: 'Текст шаблону',
    generation_mode,
    icon: '⚖️',
    description: '',
    price: 0,
    category: null,
    status: 'active',
  }
}

function renderEdit(path = '/services/1/edit') {
  return render(
    <ConfirmProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/services/new" element={<ServiceEditPage />} />
          <Route path="/services/:id/edit" element={<ServiceEditPage />} />
        </Routes>
      </MemoryRouter>
    </ConfirmProvider>,
  )
}

describe('ServiceEditPage — AI-prompt tab visibility (#88 §4)', () => {
  it('hides the AI tab for a template-driven service (services.ai_prompt is dead there)', async () => {
    dbState.service = { data: serviceRow('template'), error: null }
    renderEdit()
    expect(await screen.findByText('Розлучення')).toBeTruthy()
    expect(screen.queryByText('AI-промпт')).toBeNull()
    // the other tabs are untouched
    expect(screen.getByText('Конструктор форми')).toBeTruthy()
    expect(screen.getByText('Шаблон документа')).toBeTruthy()
    expect(screen.getByText('Налаштування')).toBeTruthy()
  })

  it('hides the AI tab for a new service (template-driven from birth)', () => {
    renderEdit('/services/new')
    expect(screen.getByText('Нова послуга')).toBeTruthy()
    expect(screen.queryByText('AI-промпт')).toBeNull()
  })

  // The predicate must stay templateDrivesGeneration (template|hybrid|null) —
  // a page-level regression to `=== 'template'` would resurrect the dead tab
  // on the live hybrid service while every 'template' test stays green.
  it('hides the AI tab for a hybrid service (production alimony-change case)', async () => {
    dbState.service = { data: serviceRow('hybrid'), error: null }
    renderEdit()
    expect(await screen.findByText('Розлучення')).toBeTruthy()
    expect(screen.queryByText('AI-промпт')).toBeNull()
  })

  it('hides the AI tab when generation_mode is null (first publish auto-flips to template)', async () => {
    dbState.service = { data: serviceRow(null), error: null }
    renderEdit()
    expect(await screen.findByText('Розлучення')).toBeTruthy()
    expect(screen.queryByText('AI-промпт')).toBeNull()
  })

  it('keeps the AI tab for a legacy js service, with an honest "prompt is inert" banner', async () => {
    dbState.service = { data: serviceRow('js'), error: null }
    renderEdit()
    expect(await screen.findByText('Розлучення')).toBeTruthy()
    const aiTab = screen.getByText('AI-промпт')
    fireEvent.click(aiTab)
    expect(screen.getByText(/вбудованим кодом/)).toBeTruthy()
    expect(screen.getByDisplayValue('Склади документ.')).toBeTruthy()
  })
})

describe('ServiceEditPage — dead quality checklist removed (#88 §3)', () => {
  it('renders no inert checkboxes on the AI tab', async () => {
    dbState.service = { data: serviceRow('js'), error: null }
    const { container } = renderEdit()
    await screen.findByText('Розлучення')
    fireEvent.click(screen.getByText('AI-промпт'))
    expect(screen.queryByText('Чеклист якості документу')).toBeNull()
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0)
  })
})
