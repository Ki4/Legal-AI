// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminLayout } from '../AdminLayout'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function renderLayout() {
  return render(
    <MemoryRouter>
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>
    </MemoryRouter>,
  )
}

describe('AdminLayout — sidebar rail (issue #87 decision 7)', () => {
  it('starts expanded by default, with the collapse button and nav labels visible', () => {
    renderLayout()
    expect(screen.getByText('Мої послуги')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Згорнути меню' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Розгорнути меню' })).toBeNull()
  })

  it('collapses on click and persists the choice to localStorage', () => {
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Згорнути меню' }))
    expect(screen.getByRole('button', { name: 'Розгорнути меню' })).toBeTruthy()
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('1')
    // Nav labels stay in the DOM (hidden via CSS at md:, not unmounted) — a tooltip title survives.
    expect(screen.getByTitle('Мої послуги')).toBeTruthy()
  })

  it('restores the collapsed state from localStorage on mount', () => {
    localStorage.setItem('admin-sidebar-collapsed', '1')
    renderLayout()
    expect(screen.getByRole('button', { name: 'Розгорнути меню' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Згорнути меню' })).toBeNull()
  })

  it('expands again on click and persists the choice', () => {
    localStorage.setItem('admin-sidebar-collapsed', '1')
    renderLayout()
    fireEvent.click(screen.getByRole('button', { name: 'Розгорнути меню' }))
    expect(screen.getByRole('button', { name: 'Згорнути меню' })).toBeTruthy()
    expect(localStorage.getItem('admin-sidebar-collapsed')).toBe('0')
  })
})
