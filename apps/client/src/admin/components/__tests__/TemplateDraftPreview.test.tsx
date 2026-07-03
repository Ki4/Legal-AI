// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// The child previews pull the '@doc-engine' alias (unavailable under
// `vitest run`) — the fullscreen/tab logic under test doesn't need them.
vi.mock('../DocumentPreview', () => ({
  DocumentPreview: () => <div data-testid="doc-preview" />,
}))
vi.mock('../DocumentLayoutPreview', () => ({
  DocumentLayoutPreview: () => <div data-testid="layout-preview" />,
}))

import { TemplateDraftPreview } from '../TemplateDraftPreview'

afterEach(cleanup)

describe('TemplateDraftPreview — fullscreen overlay', () => {
  it('opens fullscreen via the ⤢ button and closes via ✕', () => {
    render(<TemplateDraftPreview template="Текст" />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /на весь екран/ }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Закрити превʼю' }))
    expect(screen.queryByRole('dialog')).toBeNull() // fully unmounted, no dead overlay
  })

  it('opens fullscreen by clicking the preview area and closes on Escape', () => {
    render(<TemplateDraftPreview template="Текст" />)
    fireEvent.click(screen.getByTitle(/Клацніть, щоб відкрити/))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the selected view (Розкладка) inside fullscreen', () => {
    render(<TemplateDraftPreview template="Текст" />)
    fireEvent.click(screen.getByRole('button', { name: 'Розкладка' }))
    expect(screen.getByTestId('layout-preview')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /на весь екран/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('[data-testid="layout-preview"]')).toBeTruthy()
  })

  it('accepts controlled fullscreen state (S2 slice D: focus mode owns the Esc precedence)', () => {
    const onFullscreenChange = vi.fn()
    const { rerender } = render(
      <TemplateDraftPreview template="Текст" fullscreen={false} onFullscreenChange={onFullscreenChange} />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()

    // Clicking ⤢ reports the intent via the callback instead of opening itself
    fireEvent.click(screen.getByRole('button', { name: /на весь екран/ }))
    expect(onFullscreenChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('dialog')).toBeNull() // parent hasn't re-rendered with fullscreen=true yet

    rerender(<TemplateDraftPreview template="Текст" fullscreen onFullscreenChange={onFullscreenChange} />)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onFullscreenChange).toHaveBeenCalledWith(false)
  })
})
