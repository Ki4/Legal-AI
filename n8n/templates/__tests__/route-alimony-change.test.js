import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load CJS module via new Function (n8n templates use module.exports)
const { route, ROUTE, ABSTAIN_MESSAGES } = (() => {
  const code = readFileSync(resolve(__dirname, '../route-alimony-change.js'), 'utf8')
  const m = { exports: {} }
  const fn = new Function('module', 'exports', code)
  fn(m, m.exports)
  return m.exports
})()

// ─── disabled mode (default — pending Olga's sign-off, test-matrix §6) ───────

describe('route: disabled mode (default) — always PROCEED', () => {
  it('returns PROCEED with no opts, regardless of input', () => {
    expect(route([], 'fixed')).toBe(ROUTE.PROCEED)
    expect(route(['child_needs_up_extraordinary'], 'percent')).toBe(ROUTE.PROCEED)
    expect(route(['cost_of_living_up'], 'fixed')).toBe(ROUTE.PROCEED)
  })

  it('returns PROCEED with enabled: false, even for would-be ABSTAIN inputs', () => {
    expect(route(['child_needs_up_extraordinary'], 'percent', { enabled: false })).toBe(ROUTE.PROCEED)
    expect(route(['cost_of_living_up'], 'fixed', { enabled: false })).toBe(ROUTE.PROCEED)
  })
})

// ─── full mode (enabled: true — test-matrix §2 full table) ───────────────────

describe('route: full mode (enabled: true) — test-matrix §2 / §5', () => {
  it('R1: child_needs_up_extraordinary → ABSTAIN_EXTRAORDINARY (TC5)', () => {
    expect(route(['child_needs_up_extraordinary'], 'percent', { enabled: true }))
      .toBe(ROUTE.ABSTAIN_EXTRAORDINARY)
    // R1 wins even alongside other facts
    expect(route(['payer_income_up', 'child_needs_up_extraordinary'], 'percent', { enabled: true }))
      .toBe(ROUTE.ABSTAIN_EXTRAORDINARY)
  })

  it('R2: fixed + singleton cost_of_living_up → ABSTAIN_INDEXATION (TC6)', () => {
    expect(route(['cost_of_living_up'], 'fixed', { enabled: true })).toBe(ROUTE.ABSTAIN_INDEXATION)
  })

  it('R3: percent + singleton cost_of_living_up → PROCEED (TC7, not indexation)', () => {
    expect(route(['cost_of_living_up'], 'percent', { enabled: true })).toBe(ROUTE.PROCEED)
  })

  it('R2 does not fire when cost_of_living_up is not a singleton', () => {
    expect(route(['cost_of_living_up', 'payer_income_down'], 'fixed', { enabled: true }))
      .toBe(ROUTE.PROCEED)
  })

  it('R5: ordinary facts → PROCEED (TC1-TC4, TC8-TC10)', () => {
    expect(route(['child_needs_up_general', 'payer_income_up'], 'percent', { enabled: true }))
      .toBe(ROUTE.PROCEED) // TC1
    expect(route(['payer_income_down'], 'fixed', { enabled: true })).toBe(ROUTE.PROCEED) // TC2
    expect(route(['payer_new_dependents'], 'fixed', { enabled: true })).toBe(ROUTE.PROCEED) // TC9
  })

  it('empty changed_facts → PROCEED (form validation handles R4, not route())', () => {
    expect(route([], 'fixed', { enabled: true })).toBe(ROUTE.PROCEED)
    expect(route(undefined, 'percent', { enabled: true })).toBe(ROUTE.PROCEED)
  })
})

// ─── ABSTAIN message bundles (requirements §2.4, test-matrix §4) ─────────────

describe('ABSTAIN_MESSAGES', () => {
  it('ABSTAIN_EXTRAORDINARY cites ст.181/185 СК and ст.192', () => {
    const msg = ABSTAIN_MESSAGES[ROUTE.ABSTAIN_EXTRAORDINARY]
    expect(msg.redirect_message).toContain('ст.181, 185 СК')
    expect(msg.redirect_message).toContain('ст.192')
    expect(msg.abstention_reason).toBe('child_needs_up_extraordinary → ст.181/185 СК, інший позов')
  })

  it('ABSTAIN_INDEXATION cites ст.184 СК and ст.192', () => {
    const msg = ABSTAIN_MESSAGES[ROUTE.ABSTAIN_INDEXATION]
    expect(msg.redirect_message).toContain('ст.184 СК')
    expect(msg.redirect_message).toContain('ст.192')
    expect(msg.abstention_reason).toBe('fixed + singleton cost_of_living_up → ст.184 СК, позасудова індексація')
  })
})
