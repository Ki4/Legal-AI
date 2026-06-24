// Geometry for zone-anchored service notes (see migration 028).
// A note's anchor is stored as fractions of the page content box so a highlight drawn at one
// viewport width re-renders correctly at another — we never persist absolute pixels.

export interface CommentAnchor {
  x: number // left,   fraction [0,1] of content box width
  y: number // top,    fraction [0,1] of content box height
  w: number // width,  fraction [0,1]
  h: number // height, fraction [0,1]
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

/**
 * Build a normalized anchor from two pixel points within a box of `boxW`×`boxH` px.
 * Points may be given in any order (drag up-left or down-right) — the result is normalized
 * to top-left origin and clamped so the rectangle stays inside the box.
 */
export function rectToAnchor(ax: number, ay: number, bx: number, by: number, boxW: number, boxH: number): CommentAnchor {
  if (boxW <= 0 || boxH <= 0) return { x: 0, y: 0, w: 0, h: 0 }
  const x1 = Math.min(ax, bx), y1 = Math.min(ay, by)
  const x2 = Math.max(ax, bx), y2 = Math.max(ay, by)
  const x = clamp01(x1 / boxW)
  const y = clamp01(y1 / boxH)
  return {
    x,
    y,
    w: Math.min(clamp01((x2 - x1) / boxW), 1 - x),
    h: Math.min(clamp01((y2 - y1) / boxH), 1 - y),
  }
}

/** A drag big enough to be a deliberate zone, not an accidental click (≥0.5% in each axis). */
export function isMeaningfulAnchor(a: CommentAnchor): boolean {
  return a.w >= 0.005 && a.h >= 0.005
}

/** CSS percentage box for rendering an anchor over its content box (no measuring needed). */
export function anchorStyle(a: CommentAnchor): { left: string; top: string; width: string; height: string } {
  return { left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }
}
