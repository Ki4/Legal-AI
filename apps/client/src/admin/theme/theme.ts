// Admin design-system theme. Light ("canvas") is the default; dark is optional. The choice is
// persisted in localStorage and applied as <html data-theme="..."> so the CSS-variable token
// palette (src/index.css) flips every token at once. Components reference semantic Tailwind
// tokens (bg-canvas / text-ink / border-line / bg-warn ...), never raw colours.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'admin-theme'

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* localStorage unavailable (private mode) — apply for this session only */
  }
  applyTheme(theme)
}

// Apply the stored theme as soon as this module is imported, before the first paint.
applyTheme(getStoredTheme())
