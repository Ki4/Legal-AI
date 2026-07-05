import { describe, it, expect, vi, afterEach } from 'vitest'
import { derivePreviewPayUrl, classifyPayResponse, requestPreviewPay } from '../previewPay'

describe('derivePreviewPayUrl', () => {
  it('swaps the form-submit segment for preview-pay (same n8n base)', () => {
    expect(derivePreviewPayUrl('https://x.ngrok.dev/webhook/form-submit'))
      .toBe('https://x.ngrok.dev/webhook/preview-pay')
  })

  it('preserves a trailing query string', () => {
    expect(derivePreviewPayUrl('https://x/webhook/form-submit?test=1'))
      .toBe('https://x/webhook/preview-pay?test=1')
  })

  it('prefers an explicit override', () => {
    expect(derivePreviewPayUrl('https://x/webhook/form-submit', 'https://y/hook'))
      .toBe('https://y/hook')
  })

  it('returns empty for an empty base (dev mode)', () => {
    expect(derivePreviewPayUrl('')).toBe('')
  })

  it('does not touch an unrelated URL', () => {
    expect(derivePreviewPayUrl('https://x/webhook/other')).toBe('https://x/webhook/other')
  })
})

describe('classifyPayResponse', () => {
  it('maps 200 + signed_url to paid', () => {
    const out = classifyPayResponse(200, { success: true, signed_url: 'https://s/doc.pdf', expires_at: '2026-07-01T00:00:00Z' })
    expect(out).toEqual({ kind: 'paid', signedUrl: 'https://s/doc.pdf', expiresAt: '2026-07-01T00:00:00Z' })
  })

  it('maps a not_ready rejection to not_ready (retryable)', () => {
    expect(classifyPayResponse(422, { success: false, error: 'not_ready' })).toEqual({ kind: 'not_ready' })
  })

  it('maps not_owner / other business errors to a friendly error', () => {
    const out = classifyPayResponse(422, { success: false, error: 'not_owner', message: 'Технічні труднощі. Спробуйте, будь ласка, пізніше.' })
    expect(out.kind).toBe('error')
    if (out.kind === 'error') expect(out.message).toContain('Технічні труднощі')
  })

  it('never treats a 200 without signed_url as paid', () => {
    expect(classifyPayResponse(200, { success: true }).kind).toBe('error')
  })

  it('falls back to a generic message when none is provided', () => {
    const out = classifyPayResponse(500, null)
    expect(out.kind).toBe('error')
    if (out.kind === 'error') expect(out.message).toMatch(/Технічні труднощі/)
  })
})

describe('requestPreviewPay — GDPR wire contract (deliver_to_bot)', () => {
  const paidBody = { success: true, signed_url: 'https://s/doc.pdf', expires_at: '' }
  function stubFetch(res: { status?: number; body?: unknown } = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      status: res.status ?? 200,
      json: async () => res.body ?? paidBody,
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const bodyOf = (fetchMock: ReturnType<typeof vi.fn>) =>
    JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)

  afterEach(() => vi.unstubAllGlobals())

  it('posts deliver_to_bot:false when the opt-in is omitted (privacy default)', async () => {
    const fetchMock = stubFetch()
    await requestPreviewPay('https://n8n/webhook/preview-pay', { caseId: 'c1', initData: 'signed' })
    const body = bodyOf(fetchMock)
    expect(body.deliver_to_bot).toBe(false)
    expect(body).toMatchObject({ case_id: 'c1', init_data: 'signed' })
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })

  it('posts deliver_to_bot:false when the opt-in is explicitly false', async () => {
    const fetchMock = stubFetch()
    await requestPreviewPay('https://n8n/webhook/preview-pay', { caseId: 'c1', initData: 's', deliverToBot: false })
    expect(bodyOf(fetchMock).deliver_to_bot).toBe(false)
  })

  it('posts deliver_to_bot:true only when the user opts in', async () => {
    const fetchMock = stubFetch()
    await requestPreviewPay('https://n8n/webhook/preview-pay', { caseId: 'c1', initData: 's', deliverToBot: true })
    expect(bodyOf(fetchMock).deliver_to_bot).toBe(true)
  })

  it('classifies a paid 200 response into a paid outcome', async () => {
    stubFetch({ status: 200, body: paidBody })
    const out = await requestPreviewPay('https://n8n/webhook/preview-pay', { caseId: 'c1', initData: 's' })
    expect(out).toEqual({ kind: 'paid', signedUrl: 'https://s/doc.pdf', expiresAt: '' })
  })

  it('maps a network failure to a friendly error (never leaks)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const out = await requestPreviewPay('https://n8n/webhook/preview-pay', { caseId: 'c1', initData: 's' })
    expect(out.kind).toBe('error')
  })

  it('returns an error without calling fetch when the URL is empty', async () => {
    const fetchMock = stubFetch()
    const out = await requestPreviewPay('', { caseId: 'c1', initData: 's', deliverToBot: true })
    expect(out.kind).toBe('error')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
