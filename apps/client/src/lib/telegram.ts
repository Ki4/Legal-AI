/** Telegram WebApp helpers — centralised access to TG SDK */

function getTg() {
  return window.Telegram?.WebApp
}

// ── Haptic Feedback ──────────────────────────────────────────────────────────

export function hapticSelection() {
  getTg()?.HapticFeedback?.selectionChanged()
}

export function hapticSuccess() {
  getTg()?.HapticFeedback?.notificationOccurred('success')
}

export function hapticError() {
  getTg()?.HapticFeedback?.notificationOccurred('error')
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  getTg()?.HapticFeedback?.impactOccurred(style)
}

// ── Back Button ──────────────────────────────────────────────────────────────

export function showBackButton(callback: () => void) {
  const tg = getTg()
  if (!tg?.BackButton) return
  tg.BackButton.show()
  tg.BackButton.onClick(callback)
}

export function hideBackButton() {
  getTg()?.BackButton?.hide()
}

// ── Closing Confirmation ─────────────────────────────────────────────────────

export function enableClosingConfirmation() {
  getTg()?.enableClosingConfirmation?.()
}

export function disableClosingConfirmation() {
  getTg()?.disableClosingConfirmation?.()
}

// ── Viewport ─────────────────────────────────────────────────────────────────

/** Returns Telegram viewport height or falls back to window.innerHeight */
export function getViewportHeight(): number {
  return getTg()?.viewportStableHeight ?? window.innerHeight
}
