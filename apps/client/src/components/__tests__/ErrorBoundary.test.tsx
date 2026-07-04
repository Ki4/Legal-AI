// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

let consoleErr: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // React logs caught render errors to console.error — silence + assert it.
  consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  consoleErr.mockRestore()
  cleanup()
})

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>всё добре</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('всё добре')).toBeTruthy()
  })

  it('renders the Ukrainian fallback and the raw message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Щось пішло не так')).toBeTruthy()
    expect(screen.getByText('Оновити')).toBeTruthy()
    // raw message kept for screenshot diagnosis
    expect(screen.getByText('kaboom')).toBeTruthy()
    // Pin OUR componentDidCatch log (React logs to console.error too, so a bare
    // toHaveBeenCalled() would be a false-green for our handler running).
    expect(consoleErr).toHaveBeenCalledWith('[TWA ErrorBoundary]', expect.anything(), expect.anything())
  })

  it('reloads the page when «Оновити» is pressed', () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByText('Оновити'))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
