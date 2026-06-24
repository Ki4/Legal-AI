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
})

describe('isMeaningfulAnchor', () => {
  it('rejects an accidental click (no area)', () => {
    expect(isMeaningfulAnchor({ x: 0.5, y: 0.5, w: 0, h: 0 })).toBe(false)
    expect(isMeaningfulAnchor({ x: 0.5, y: 0.5, w: 0.002, h: 0.002 })).toBe(false)
  })

  it('accepts a deliberate drag', () => {
    expect(isMeaningfulAnchor({ x: 0.1, y: 0.1, w: 0.2, h: 0.05 })).toBe(true)
  })
})

describe('anchorStyle', () => {
  it('renders the anchor as CSS percentages', () => {
    expect(anchorStyle({ x: 0.1, y: 0.2, w: 0.3, h: 0.05 })).toEqual({
      left: '10%', top: '20%', width: '30%', height: '5%',
    })
  })
})
