import { describe, it, expect } from 'vitest'
import { derivePreviewPayUrl, classifyPayResponse } from '../previewPay'

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
