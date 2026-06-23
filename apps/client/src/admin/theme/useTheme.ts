import { useCallback, useState } from 'react'
import { getStoredTheme, storeTheme, type Theme } from './theme'

/** React access to the admin theme: current value + toggle/set (persists + applies). */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next)
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return { theme, toggle, setTheme }
}
