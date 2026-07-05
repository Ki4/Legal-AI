import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Guards the GENERATED preview-pay workflow (specs/features/preview-module/ G4):
//   1. it stays in sync with its SSoT (verify-init-data.js) — build --check;
//   2. it never commits real secrets — only YOUR_* placeholders;
//   3. its graph is intact — every connection target is a real node;
//   4. its Code nodes are syntactically valid JS;
//   5. the paid-flip is reachable ONLY from the Is Ready? = true branch
//      (never flip paid without a ready document — requirements §0/§5);
//   6. every business rejection is a 4xx (Respond Error responseCode);
//   7. bot delivery is opt-in (Send PDF gated on deliver_to_bot === true);
//   8. idempotent re-mint: paid_at is written only on the first flip;
//   9. honest delivered_to_bot: derived from the real Telegram send and echoed in the
//      paid response (Finalize Delivery reads Send PDF; #89 deferred).
const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
const wfPath = resolve(repoRoot, 'n8n/workflows/current/preview-pay.json')
const buildScript = resolve(repoRoot, 'scripts/build-preview-pay.mjs')

describe('preview-pay workflow', () => {
  it('is in sync with its SSoT (build --check passes)', () => {
    // Throws (non-zero exit) if the committed JSON drifts from the generator output.
    expect(() => execFileSync('node', [buildScript, '--check'], { cwd: repoRoot })).not.toThrow()
  })

  const wf = JSON.parse(readFileSync(wfPath, 'utf8'))
  const node = (name) => wf.nodes.find((n) => n.name === name)

  it('commits no real secrets — only YOUR_* placeholders', () => {
    const raw = readFileSync(wfPath, 'utf8')
    expect(raw).toContain('YOUR_SUPABASE_SERVICE_ROLE_KEY')
    expect(raw).toContain('YOUR_TELEGRAM_BOT_TOKEN')
    // No Supabase JWT / Telegram bot token material leaked into the committed file.
    expect(/eyJ[A-Za-z0-9_-]{20}/.test(raw)).toBe(false)
    expect(/\d{8,}:[A-Za-z0-9_-]{30,}/.test(raw)).toBe(false)
  })

  it('has intact connections — every target node exists', () => {
    const names = new Set(wf.nodes.map((n) => n.name))
    for (const [from, conn] of Object.entries(wf.connections)) {
      expect(names.has(from)).toBe(true)
      for (const out of conn.main || []) {
        for (const c of out || []) expect(names.has(c.node)).toBe(true)
      }
    }
  })

  it('has syntactically valid Code-node bodies', () => {
    for (const n of wf.nodes) {
      if (n.parameters?.jsCode) {
        expect(() => new Function(n.parameters.jsCode)).not.toThrow()
      }
    }
  })

  it('responds via a response node (webhook responseMode) and exactly one Respond OK / Respond Error', () => {
    expect(node('Webhook').parameters.responseMode).toBe('responseNode')
    expect(wf.nodes.filter((n) => n.type === 'n8n-nodes-base.respondToWebhook')).toHaveLength(2)
  })

  it('flips paid ONLY on the Is Ready? = true branch (never without a ready doc)', () => {
    // Set Paid must be the true (index 0) output of Is Ready?, and must NOT appear on
    // the false (index 1) output, nor be fed from anywhere else.
    const isReady = wf.connections['Is Ready?'].main
    const trueTargets = (isReady[0] || []).map((c) => c.node)
    const falseTargets = (isReady[1] || []).map((c) => c.node)
    expect(trueTargets).toContain('Set Paid')
    expect(falseTargets).toContain('Respond Error')
    expect(falseTargets).not.toContain('Set Paid')

    // No other node connects into Set Paid.
    const feeders = Object.entries(wf.connections)
      .filter(([, conn]) => (conn.main || []).some((out) => (out || []).some((c) => c.node === 'Set Paid')))
      .map(([from]) => from)
    expect(feeders).toEqual(['Is Ready?'])

    // The Assert gate returns _ok:false for not-ready / not-owner / missing case.
    const assert = node('Assert & Decide').parameters.jsCode
    expect(assert).toContain('not_ready')
    expect(assert).toContain('not_owner')
    expect(assert).toContain('case_not_found')
  })

  it('returns a 4xx for every business rejection (Respond Error)', () => {
    const code = node('Respond Error').parameters.options?.responseCode
    expect(code).toBeGreaterThanOrEqual(400)
    expect(code).toBeLessThan(500)
    // Both rejection branches (auth + not-ready) funnel into Respond Error.
    expect((wf.connections['Is Verified?'].main[1] || []).map((c) => c.node)).toContain('Respond Error')
    expect((wf.connections['Is Ready?'].main[1] || []).map((c) => c.node)).toContain('Respond Error')
  })

  it('keeps bot delivery opt-in (Download/Send PDF gated on deliver_to_bot === true)', () => {
    // The bot-delivery path (Download PDF → Send PDF) hangs ONLY off the true
    // output of "Send to bot?"; the false output goes straight to the response.
    const branch = wf.connections['Send to bot?'].main
    expect((branch[0] || []).map((c) => c.node)).toContain('Download PDF')
    expect((branch[1] || []).map((c) => c.node)).not.toContain('Download PDF')
    expect((branch[1] || []).map((c) => c.node)).not.toContain('Send PDF')
    expect((wf.connections['Download PDF'].main[0] || []).map((c) => c.node)).toContain('Send PDF')
    // The delivery flag is set only when the request explicitly opts in.
    expect(node('Verify initData').parameters.jsCode).toContain('deliver_to_bot === true')
    // The IF gates on that flag.
    expect(node('Send to bot?').parameters.conditions.boolean[0].value1).toContain('_deliver')
  })

  it('reports an HONEST delivered_to_bot from the real Telegram send (#89 deferred)', () => {
    // The paid response echoes delivered_to_bot so the client states the delivery FACT
    // rather than a present-continuous guess.
    expect(node('Respond OK').parameters.responseBody).toContain('delivered_to_bot')

    // It is derived from the ACTUAL send result, NOT the opt-in flag. This is the
    // honesty-critical logic, so EXECUTE it (don't string-match): compile the Code body
    // and drive it with a stubbed n8n $(). Contract: keys on Telegram ok===true — a
    // failed sendDocument never returns ok:true — with message_id NOT required (the live
    // happy-path was observed as { ok:true, message_id }); robust to a .body nesting.
    const finalize = node('Finalize Delivery')
    expect(finalize).toBeTruthy()
    expect(finalize.parameters.jsCode).toContain("$('Send PDF')") // reads the right node
    const THROWS = Symbol('unexecuted')
    const runFinalize = (sendPdfJson) => {
      const fn = new Function('$', finalize.parameters.jsCode)
      const $ =
        sendPdfJson === THROWS
          ? () => {
              throw new Error('Referenced node "Send PDF" is unexecuted')
            }
          : () => ({ first: () => ({ json: sendPdfJson }) })
      return fn($)[0].json._delivered_to_bot
    }
    // Confirmed send → true (bare {ok:true} and the real {ok:true,result:{message_id}}).
    expect(runFinalize({ ok: true })).toBe(true)
    expect(runFinalize({ ok: true, result: { message_id: 443 } })).toBe(true)
    // n8n may nest the httpRequest body under .body — unwrap it.
    expect(runFinalize({ body: { ok: true } })).toBe(true)
    // Swallowed 403 (user never pressed Start) → false, never a false «надіслано».
    expect(runFinalize({ ok: false, error_code: 403, description: "can't initiate conversation" })).toBe(false)
    expect(runFinalize({ body: { ok: false } })).toBe(false)
    // Opt-out branch: Send PDF never ran, $('Send PDF') throws → false (no confirmed send).
    expect(runFinalize(THROWS)).toBe(false)
    // Garbage / missing ok → conservative false (never claim an unconfirmed delivery).
    expect(runFinalize({})).toBe(false)
    expect(runFinalize({ ok: 'true' })).toBe(false)

    // Both "Send to bot?" outputs converge on Finalize Delivery → Respond OK, so the
    // opt-out path yields delivered_to_bot=false too (Send PDF never ran there), and the
    // opt-in path still gates Download/Send PDF (honesty must not weaken the opt-in gate).
    const branch = wf.connections['Send to bot?'].main
    expect((branch[0] || []).map((c) => c.node)).toContain('Download PDF')
    expect((branch[1] || []).map((c) => c.node)).toContain('Finalize Delivery')
    expect((wf.connections['Send PDF'].main[0] || []).map((c) => c.node)).toContain('Finalize Delivery')
    expect((wf.connections['Finalize Delivery'].main[0] || []).map((c) => c.node)).toContain('Respond OK')
  })

  it('is idempotent — paid_at written only on the first flip', () => {
    const assert = node('Assert & Decide').parameters.jsCode
    expect(assert).toContain('alreadyPaid')
    // already-paid branch flips paid/status but NOT paid_at; only the fresh branch sets paid_at.
    expect(assert).toMatch(/alreadyPaid[\s\S]*paid_at: nowIso/)
  })

  it('mints the signed URL with the 24h TTL from Global Config', () => {
    expect(node('Global Config').parameters.jsCode).toContain("SIGNED_URL_TTL:       '86400'")
    expect(node('Mint Signed URL').parameters.jsonBody).toContain('expiresIn')
  })
})
