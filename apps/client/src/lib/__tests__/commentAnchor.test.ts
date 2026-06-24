import { describe, it, expect } from 'vitest'
import { rectToAnchor, isMeaningfulAnchor, anchorStyle } from '../commentAnchor'

describe('rectToAnchor', () => {
  it('maps a pixel rect to fractions of the box', () => {
    expect(rectToAnchor(100, 50, 400, 100, 1000, 500)).toEqual({ x: 0.1, y: 0.1, w: 0.3, h: 0.1 })
  })

  it('normalizes a reversed drag (bottom-right → top-left) to top-left origin', () => {
    expect(rectToAnchor(400, 100, 100, 50, 1000, 500)).toEqual({ x: 0.1, y: 0.1, w: 0.3, h: 0.1 })
  })

  it('clamps a rectangle that runs past the box edges', () => {
    const a = rectToAnchor(800, 400, 1200, 700, 1000, 500)
    expect(a.x).toBe(0.8)
    expect(a.y).toBe(0.8)
    expect(a.x + a.w).toBeLessThanOrEqual(1) // never overflows right
    expect(a.y + a.h).toBeLessThanOrEqual(1) // never overflows bottom
  })

  it('returns a zero anchor for a degenerate box', () => {
    expect(rectToAnchor(10, 10, 20, 20, 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })

  it('returns a zero anchor when either dimension is non-positive', () => {
    expect(rectToAnchor(10, 10, 20, 20, 100, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(rectToAnchor(10, 10, 20, 20, 0, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(rectToAnchor(10, 10, 20, 20, -100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })

  it('clamps a top-left origin that starts off the box (negative pixel)', () => {
    const a = rectToAnchor(-50, -50, 100, 100, 1000, 500)
    expect(a.x).toBe(0) // negative left → clamped to 0
    expect(a.y).toBe(0)
    // width is the raw span (x2-x1)=150 over boxW=1000 → 0.15 (not re-anchored back from 0)
    expect(a.w).toBeCloseTo(0.15, 5)
    expect(a.x + a.w).toBeLessThanOrEqual(1)
  })

  it('produces a zero-area anchor when both points coincide (a click, not a drag)', () => {
    expect(rectToAnchor(300, 200, 300, 200, 1000, 500)).toEqual({ x: 0.3, y: 0.4, w: 0, h: 0 })
  })
})

describe('isMeaningfulAnchor', () => {
  it('rejects an accidental click (no area)', () => {
    expect(isMeaningfulAnchor({ x: 0.5, y: 0.5, w: 0, h: 0 })).toBe(false)
    expect(isMeaningfulAnchor({ x: 0.5, y: 0.5, w: 0.002, h: 0.002 })).toBe(false)
  })

  it('accepts a deliberate drag', () => {
    expect(isMeaningfulAnchor({ x: 0.1, y: 0.1, w: 0.2, h: 0.05 })).toBe(true)
  })

  it('accepts exactly the 0.5% threshold in both axes (inclusive)', () => {
    expect(isMeaningfulAnchor({ x: 0, y: 0, w: 0.005, h: 0.005 })).toBe(true)
  })

  it('rejects when only one axis meets the threshold', () => {
    expect(isMeaningfulAnchor({ x: 0, y: 0, w: 0.005, h: 0.004 })).toBe(false)
    expect(isMeaningfulAnchor({ x: 0, y: 0, w: 0.004, h: 0.005 })).toBe(false)
  })
})

describe('anchorStyle', () => {
  it('renders the anchor as CSS percentages', () => {
    expect(anchorStyle({ x: 0.1, y: 0.2, w: 0.3, h: 0.05 })).toEqual({
      left: '10%', top: '20%', width: '30%', height: '5%',
    })
  })

  it('renders a zero anchor as all-0% (round-trips a degenerate box)', () => {
    expect(anchorStyle({ x: 0, y: 0, w: 0, h: 0 })).toEqual({
      left: '0%', top: '0%', width: '0%', height: '0%',
    })
  })
})
