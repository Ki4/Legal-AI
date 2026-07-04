// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// What's under test is the route/guard wiring, not the pages — every page is
// stubbed to a marker div (also keeps CodeMirror etc. out of jsdom).
const { authState } = vi.hoisted(() => ({
  authState: { user: null as { id: string } | null, loading: false },
}))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => authState }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

// Plain export objects only — a get-trap Proxy is a thenable (its `then` is a
// function), so an async mock factory resolving one NEVER settles and vitest
// deadlocks at collection; vitest 4 also validates exports via `in`/ownKeys.
function pageStub(exportName: string, marker: string) {
  return async () => {
    const React = await import('react')
    return { [exportName]: () => React.createElement('div', null, marker) }
  }
}
vi.mock('../pages/LoginPage', pageStub('LoginPage', 'login-page'))
vi.mock('../pages/ForgotPasswordPage', pageStub('ForgotPasswordPage', 'forgot-password-page'))
vi.mock('../pages/ResetPasswordPage', pageStub('ResetPasswordPage', 'reset-password-page'))
vi.mock('../pages/DashboardPage', pageStub('DashboardPage', 'dashboard-page'))
vi.mock('../pages/ServiceEditPage', pageStub('ServiceEditPage', 'service-edit-page'))
vi.mock('../pages/ServiceViewPage', pageStub('ServiceViewPage', 'service-view-page'))
vi.mock('../pages/NotesInboxPage', pageStub('NotesInboxPage', 'notes-page'))
vi.mock('../pages/ServiceRequestsPage', pageStub('ServiceRequestsPage', 'requests-page'))
vi.mock('../pages/LawChangeLogPage', pageStub('LawChangeLogPage', 'law-changes-page'))
vi.mock('../pages/DesignKitPage', pageStub('DesignKitPage', 'design-kit-page'))

import { AdminApp } from '../AdminApp'

beforeEach(() => {
  authState.user = null
  authState.loading = false
})
afterEach(cleanup)

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminApp — /design is auth-guarded (#88 §2)', () => {
  it('redirects an anonymous visitor from /design to the login page', () => {
    authState.user = null
    renderAt('/design')
    expect(screen.getByText('login-page')).toBeTruthy()
    expect(screen.queryByText('design-kit-page')).toBeNull()
  })

  it('renders the design kit for an authenticated user', () => {
    authState.user = { id: 'u1' }
    renderAt('/design')
    expect(screen.getByText('design-kit-page')).toBeTruthy()
  })

  it('still redirects anonymous visitors from a regular guarded route (regression)', () => {
    authState.user = null
    renderAt('/services')
    expect(screen.getByText('login-page')).toBeTruthy()
  })

  it('shows neither the page nor the login redirect while auth is still loading', () => {
    // Every hard refresh renders the guard once with {user: null, loading: true};
    // redirecting here would bounce every authenticated admin to /login.
    authState.user = null
    authState.loading = true
    renderAt('/design')
    expect(screen.queryByText('login-page')).toBeNull()
    expect(screen.queryByText('design-kit-page')).toBeNull()
  })
})
