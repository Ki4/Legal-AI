// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mirror of PreviewPage's internal polling constants (not exported).
const RETRY_DELAY_MS = 2500
const MAX_ATTEMPTS = 24

// The pure URL/response helpers have their own unit tests (previewPay.test.ts);
// here we mock the whole module so we drive the component's state machine
// (delivery choice → pay → paid/error) without touching the network.
const { requestPreviewPay, derivePreviewPayUrl } = vi.hoisted(() => ({
  requestPreviewPay: vi.fn(),
  derivePreviewPayUrl: vi.fn(() => 'https://n8n.example/webhook/preview-pay'),
}))
vi.mock('../../lib/previewPay', () => ({ requestPreviewPay, derivePreviewPayUrl }))

// Haptics are fire-and-forget; stub them so we can also assert the choice buzzes.
const { hapticSelection, hapticImpact, hapticSuccess, hapticError } = vi.hoisted(() => ({
  hapticSelection: vi.fn(),
  hapticImpact: vi.fn(),
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
}))
vi.mock('../../lib/telegram', () => ({ hapticSelection, hapticImpact, hapticSuccess, hapticError }))

import { PreviewPage } from '../PreviewPage'

const PROPS = { serviceTitle: 'Розлучення', caseId: 'case-123', excerpt: 'Текст витягу…' }

function renderPage() {
  return render(<PreviewPage {...PROPS} />)
}

const radios = () => screen.getAllByRole('radio') as HTMLInputElement[]

beforeEach(() => {
  vi.clearAllMocks()
  derivePreviewPayUrl.mockReturnValue('https://n8n.example/webhook/preview-pay')
})
afterEach(cleanup)

describe('PreviewPage — prominent 2-card delivery choice (#88 UX pack)', () => {
  it('renders both delivery cards with the privacy-first option preselected', () => {
    renderPage()
    expect(screen.getByText('Захищене посилання')).toBeTruthy()
    expect(screen.getByText('Також у Telegram')).toBeTruthy()
    expect(screen.getByText('Рекомендовано')).toBeTruthy()
    const [secure, telegram] = radios()
    expect(secure.checked).toBe(true) // default OFF → secure-link selected
    expect(telegram.checked).toBe(false)
  })

  it('pays with deliver_to_bot=false by default and shows no chat-delivery line', async () => {
    requestPreviewPay.mockResolvedValue({ kind: 'paid', signedUrl: 'https://dl/x.pdf', expiresAt: '' })
    renderPage()
    fireEvent.click(screen.getByText('Сплатити'))

    await screen.findByText('Отримати документ')
    expect(requestPreviewPay).toHaveBeenCalledWith(
      'https://n8n.example/webhook/preview-pay',
      expect.objectContaining({ caseId: 'case-123', deliverToBot: false }),
    )
    expect(screen.queryByText('Копію також надсилаємо у ваш чат')).toBeNull()
    expect(hapticSuccess).toHaveBeenCalled()
  })

  it('selecting «Також у Telegram» buzzes, flips the opt-in, and pays with deliver_to_bot=true', async () => {
    requestPreviewPay.mockResolvedValue({ kind: 'paid', signedUrl: 'https://dl/x.pdf', expiresAt: '' })
    renderPage()

    fireEvent.click(radios()[1])
    expect(hapticSelection).toHaveBeenCalledTimes(1)
    expect(radios()[1].checked).toBe(true)
    expect(radios()[0].checked).toBe(false)

    fireEvent.click(screen.getByText('Сплатити'))
    await screen.findByText('Отримати документ')
    expect(requestPreviewPay).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ deliverToBot: true }),
    )
    // opt-in on → the paid screen surfaces the (in-progress) chat delivery
    expect(screen.getByText('Копію також надсилаємо у ваш чат')).toBeTruthy()
  })

  it('re-selecting the already-selected card does not re-buzz', () => {
    renderPage()
    fireEvent.click(radios()[0]) // secure is already selected
    expect(hapticSelection).not.toHaveBeenCalled()
  })
})

describe('PreviewPage — error / retry states', () => {
  it('shows a technical error + «Спробувати ще раз» on a hard failure, and retries', async () => {
    requestPreviewPay.mockResolvedValue({ kind: 'error', message: 'Технічні труднощі.' })
    renderPage()

    fireEvent.click(screen.getByText('Сплатити'))
    const retry = await screen.findByText('Спробувати ще раз')
    expect(screen.getByText('Технічні труднощі.')).toBeTruthy()
    expect(hapticError).toHaveBeenCalled()

    requestPreviewPay.mockResolvedValueOnce({ kind: 'paid', signedUrl: 'https://dl/x.pdf', expiresAt: '' })
    fireEvent.click(retry)
    await screen.findByText('Отримати документ')
    expect(requestPreviewPay).toHaveBeenCalledTimes(2)
  })

  it('surfaces a technical error without hitting the network when the webhook URL is missing', async () => {
    derivePreviewPayUrl.mockReturnValue('')
    renderPage()

    fireEvent.click(screen.getByText('Сплатити'))
    await screen.findByText('Спробувати ще раз')
    expect(screen.getByText(/Сервіс тимчасово недоступний/)).toBeTruthy()
    expect(requestPreviewPay).not.toHaveBeenCalled()
  })

  it('shows the «still preparing» copy + «Перевірити ще раз» after the retry ceiling', async () => {
    vi.useFakeTimers()
    requestPreviewPay.mockResolvedValue({ kind: 'not_ready' })
    renderPage()
    fireEvent.click(screen.getByText('Сплатити'))

    // Drive the 24 × 2.5s polling loop: advanceTimersByTimeAsync flushes the
    // awaited requestPreviewPay microtask between each faked sleep.
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * (MAX_ATTEMPTS + 1))
    vi.useRealTimers() // findByText polls on real timers

    expect(await screen.findByText('Перевірити ще раз')).toBeTruthy()
    expect(screen.getByText(/Документ ще готується/)).toBeTruthy()
  }, 20000)
})
