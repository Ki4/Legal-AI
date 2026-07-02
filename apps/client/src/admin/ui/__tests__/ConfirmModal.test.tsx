// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConfirmModal } from '../ConfirmModal'
import { ConfirmProvider } from '../useConfirm'
import { useConfirm } from '../confirmContext'

afterEach(cleanup)

describe('ConfirmModal (presentational)', () => {
  it('renders title + body when open', () => {
    render(
      <ConfirmModal open title="Видалити послугу?" body="Дію не можна скасувати."
        variant="danger" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByText('Видалити послугу?')).toBeTruthy()
    expect(screen.getByText('Дію не можна скасувати.')).toBeTruthy()
  })

  it('renders nothing when closed', () => {
    render(
      <ConfirmModal open={false} title="Прихована" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByText('Прихована')).toBeNull()
  })

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmModal open title="Ок?" confirmLabel="Так" onConfirm={onConfirm} onCancel={() => {}} />,
    )
    fireEvent.click(screen.getByText('Так'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('fires onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal open title="Ок?" cancelLabel="Ні" onConfirm={() => {}} onCancel={onCancel} />,
    )
    fireEvent.click(screen.getByText('Ні'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('fires onCancel on Escape', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmModal open title="Ок?" onConfirm={() => {}} onCancel={onCancel} />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('focuses the confirm button on open', () => {
    render(
      <ConfirmModal open title="Ок?" confirmLabel="Підтвердити" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(document.activeElement?.textContent).toContain('Підтвердити')
  })
})

// A tiny consumer to exercise the imperative useConfirm() flow through the provider.
function Consumer({ onResult }: { onResult: (r: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button onClick={async () => onResult(await confirm({ title: 'Продовжити?', variant: 'info' }))}>
      ask
    </button>
  )
}

describe('useConfirm (provider)', () => {
  it('resolves true when confirmed', async () => {
    const onResult = vi.fn()
    render(<ConfirmProvider><Consumer onResult={onResult} /></ConfirmProvider>)
    fireEvent.click(screen.getByText('ask'))
    // Modal now open — the dialog title appears
    expect(screen.getByText('Продовжити?')).toBeTruthy()
    fireEvent.click(screen.getByText('Підтвердити'))
    await Promise.resolve()
    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('resolves false when cancelled', async () => {
    const onResult = vi.fn()
    render(<ConfirmProvider><Consumer onResult={onResult} /></ConfirmProvider>)
    fireEvent.click(screen.getByText('ask'))
    fireEvent.click(screen.getByText('Скасувати'))
    await Promise.resolve()
    expect(onResult).toHaveBeenCalledWith(false)
  })
})
