// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Stable user reference — DashboardPage's fetch effect depends on [user]; a
// fresh object per render would re-fire it forever.
const { USER, dbState } = vi.hoisted(() => {
  const USER = { id: 'lawyer-1', email: 'olga@example.com' }
  const dbState = {
    services: { data: [] as unknown[], error: null as { message: string } | null },
    cases: { data: null as unknown[] | null, error: null as { message: string } | null },
    servicesCalls: 0,
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
  // Chainable thenable: every builder method returns itself; awaiting resolves
  // to the table's CURRENT dbState (so a retry can see different data).
  function thenable(getResult: () => unknown) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'not', 'gte', 'update', 'delete', 'single']) {
      b[m] = () => b
    }
    b.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve().then(() => onFulfilled(getResult()))
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'services') {
          dbState.servicesCalls += 1
          return thenable(() => dbState.services)
        }
        return thenable(() => dbState.cases)
      },
    },
  }
})

import { DashboardPage } from '../DashboardPage'
import { ConfirmProvider } from '../../ui'

beforeEach(() => {
  localStorage.clear()
  dbState.services = { data: [], error: null }
  dbState.cases = { data: null, error: null }
  dbState.servicesCalls = 0
})
afterEach(cleanup)

const SERVICE_ROW = {
  id: 1,
  slug: 'divorce',
  title: 'Розлучення',
  description: 'Позовна заява',
  icon: '⚖️',
  price: 0,
  status: 'active',
  category: null,
  generation_mode: 'template',
  document_template: null,
  form_config: null,
}

function renderPage() {
  return render(
    <ConfirmProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ConfirmProvider>,
  )
}

describe('DashboardPage — load failure is an error, not an empty catalog (#88 §5)', () => {
  it('shows the error panel with the message and a retry button', async () => {
    dbState.services = { data: [], error: { message: 'permission denied for table services' } }
    renderPage()
    expect(await screen.findByText('Не вдалося завантажити послуги')).toBeTruthy()
    expect(screen.getByText('permission denied for table services')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeTruthy()
    // The failure must never read as «Ще немає послуг» — that invites the
    // lawyer to recreate services that actually exist.
    expect(screen.queryByText('Ще немає послуг')).toBeNull()
  })

  it('retry refetches and renders the catalog after a transient failure', async () => {
    dbState.services = { data: [], error: { message: 'network error' } }
    renderPage()
    await screen.findByText('Не вдалося завантажити послуги')

    dbState.services = { data: [SERVICE_ROW], error: null }
    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))

    expect(await screen.findByText('Розлучення')).toBeTruthy()
    expect(screen.queryByText('Не вдалося завантажити послуги')).toBeNull()
    expect(dbState.servicesCalls).toBe(2)
  })

  it('still shows the real empty state on a successful empty response (regression)', async () => {
    renderPage()
    expect(await screen.findByText('Ще немає послуг')).toBeTruthy()
    expect(screen.queryByText('Не вдалося завантажити послуги')).toBeNull()
  })
})

describe('DashboardPage — abstention strip wording (#88 §6)', () => {
  it('uses the lawyer-facing Ukrainian label instead of «Abstention rate»', async () => {
    dbState.services = { data: [SERVICE_ROW], error: null }
    dbState.cases = { data: [{ abstained: true }, { abstained: false }], error: null }
    renderPage()
    expect(await screen.findByText(/Складні справи \(AI передав юристу\):/)).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.queryByText(/Abstention rate/)).toBeNull()
  })
})
