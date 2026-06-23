import { useTheme } from './useTheme'

/** Light/dark switch (☀/☾). Shows the icon of the theme it will switch TO. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Перемкнути на темну тему' : 'Перемкнути на світлу тему'}
      title={theme === 'light' ? 'Темна тема' : 'Світла тема'}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-btn border border-line bg-paper
                  text-inkSoft hover:text-ink hover:border-lineStrong transition-colors ${className}`}
    >
      {theme === 'light' ? '☾' : '☀'}
    </button>
  )
}
