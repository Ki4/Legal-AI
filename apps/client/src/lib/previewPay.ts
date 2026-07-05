// previewPay.ts — client helpers for the preview-module payment step (#83 G5).
//
// After the form is submitted, form-submit returns the safe excerpt + case_id in
// its EARLY webhook response (G3). The client shows the preview, then calls the
// separate `preview-pay` n8n workflow (G4) to flip the case to `paid` and receive
// a short-lived signed URL to the full document. The pure parts here (URL
// derivation + response classification) are unit-tested; requestPreviewPay wraps
// them with the actual fetch.

/**
 * Derive the preview-pay webhook URL from the form-submit one — they share the
 * same n8n base (…/webhook/form-submit → …/webhook/preview-pay). An explicit
 * override (VITE_N8N_PREVIEW_PAY_URL) always wins.
 */
export function derivePreviewPayUrl(formSubmitUrl: string, override?: string): string {
  if (override) return override
  if (!formSubmitUrl) return ''
  // Replace the trailing `form-submit` path segment only (keep any query/hash).
  return formSubmitUrl.replace(/form-submit(?=$|[/?#])/, 'preview-pay')
}

export type PayOutcome =
  // `deliveredToBot` is the server's HONEST delivery fact (#89/#90 deferred): true only
  // when the user opted in AND Telegram sendDocument was confirmed (Telegram ok===true);
  // false on a swallowed 403 (never pressed Start) / timeout / opt-out / an older
  // workflow that omits the field. Read it as «could not confirm», never «not sent».
  | { kind: 'paid'; signedUrl: string; expiresAt: string; deliveredToBot: boolean }
  | { kind: 'not_ready' }
  | { kind: 'error'; message: string }

const GENERIC_ERROR = 'Технічні труднощі. Спробуйте, будь ласка, пізніше.'

/**
 * Classify a preview-pay response into the three states the UI cares about.
 * - 200 + signed_url  → paid (we have the download URL)
 * - 4xx `not_ready`   → the async document tail hasn't finished yet (retry)
 * - anything else     → a friendly error (never expose raw 500s)
 */
export function classifyPayResponse(status: number, body: unknown): PayOutcome {
  const b = (body ?? {}) as Record<string, unknown>
  if (status === 200 && typeof b.signed_url === 'string' && b.signed_url) {
    return {
      kind: 'paid',
      signedUrl: b.signed_url,
      expiresAt: typeof b.expires_at === 'string' ? b.expires_at : '',
      // Missing / non-boolean (e.g. a not-yet-redeployed workflow) degrades to false —
      // the UI then shows the honest «could not confirm» fallback, never a false claim.
      deliveredToBot: typeof b.delivered_to_bot === 'boolean' ? b.delivered_to_bot : false,
    }
  }
  if (b.error === 'not_ready') return { kind: 'not_ready' }
  return { kind: 'error', message: typeof b.message === 'string' && b.message ? b.message : GENERIC_ERROR }
}

/**
 * Call the preview-pay webhook. `initData` is the raw signed Telegram WebApp
 * string — the server (G4) verifies its HMAC and ownership; we never send a
 * bare user id. A network/parse failure is mapped to a friendly error so the
 * caller only ever deals with a PayOutcome.
 */
export async function requestPreviewPay(
  url: string,
  args: { caseId: string; initData: string; deliverToBot?: boolean },
): Promise<PayOutcome> {
  if (!url) return { kind: 'error', message: GENERIC_ERROR }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // deliver_to_bot is the GDPR opt-in: only when the user explicitly ticks
      // «Надіслати у Telegram» does the server send the PDF to their chat.
      body: JSON.stringify({ case_id: args.caseId, init_data: args.initData, deliver_to_bot: !!args.deliverToBot }),
    })
    let body: unknown = null
    try { body = await res.json() } catch { body = null }
    return classifyPayResponse(res.status, body)
  } catch {
    return { kind: 'error', message: GENERIC_ERROR }
  }
}
