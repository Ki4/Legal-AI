// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Splitter } from '../Splitter'

const KEY = 'test-splitter-ratio'

function firstPaneWidth() {
  return (screen.getByText('First').parentElement as HTMLElement).style.width
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function renderSplitter() {
  render(<Splitter storageKey={KEY} first={<div>First</div>} second={<div>Second</div>} />)
}

describe('Splitter', () => {
  it('renders both panes at the default 50/50 ratio', () => {
    renderSplitter()
    expect(screen.getByText('First')).toBeTruthy()
    expect(screen.getByText('Second')).toBeTruthy()
    expect(firstPaneWidth()).toBe('50%')
  })

  it('restores a persisted ratio on mount', () => {
    localStorage.setItem(KEY, '0.3')
    renderSplitter()
    expect(firstPaneWidth()).toBe('30%')
  })

  it('ignores an out-of-range or corrupt stored ratio and falls back to 50/50', () => {
    localStorage.setItem(KEY, '0.99')
    renderSplitter()
    expect(firstPaneWidth()).toBe('50%')
    localStorage.setItem(KEY, 'not-a-number')
    cleanup()
    renderSplitter()
    expect(firstPaneWidth()).toBe('50%')
  })

  it('double-click resets the ratio to 50/50 and persists it', () => {
    localStorage.setItem(KEY, '0.3')
    renderSplitter()
    fireEvent.doubleClick(screen.getByRole('separator'))
    expect(firstPaneWidth()).toBe('50%')
    expect(localStorage.getItem(KEY)).toBe('0.5')
  })

  it('drag updates the ratio and persists it, clamped to the min/max bounds', () => {
    renderSplitter()
    const container = screen.getByRole('separator').parentElement as HTMLElement
    container.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect

    fireEvent.mouseDown(screen.getByRole('separator'))
    fireEvent.mouseMove(window, { clientX: 700 })
    expect(firstPaneWidth()).toBe('70%')

    // Past the max bound clamps to 80%
    fireEvent.mouseMove(window, { clientX: 950 })
    expect(firstPaneWidth()).toBe('80%')

    fireEvent.mouseUp(window)
    expect(localStorage.getItem(KEY)).toBe('0.8')

    // No longer dragging — further mousemove has no effect
    fireEvent.mouseMove(window, { clientX: 100 })
    expect(firstPaneWidth()).toBe('80%')
  })

  it('keyboard arrows nudge the ratio on the focused handle', () => {
    renderSplitter()
    const handle = screen.getByRole('separator')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(firstPaneWidth()).toBe('52%')
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(firstPaneWidth()).toBe('48%')
  })
})
