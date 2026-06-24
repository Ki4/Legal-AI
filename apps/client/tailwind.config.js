import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'admin.html'),
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        surface: '#F8FAFC',
        card: '#FFFFFF',
        // ── design-system semantic tokens (light default / dark via [data-theme="dark"]) ──
        // Defined as CSS variables in src/index.css so one toggle flips the whole admin.
        canvas:     'rgb(var(--c-canvas) / <alpha-value>)',
        paper:      'rgb(var(--c-paper) / <alpha-value>)',
        paperAlt:   'rgb(var(--c-paper-alt) / <alpha-value>)',
        line:       'rgb(var(--c-line) / <alpha-value>)',
        lineStrong: 'rgb(var(--c-line-strong) / <alpha-value>)',
        ink:        'rgb(var(--c-ink) / <alpha-value>)',
        inkSoft:    'rgb(var(--c-ink-soft) / <alpha-value>)',
        inkMute:    'rgb(var(--c-ink-mute) / <alpha-value>)',
        brand:      'rgb(var(--c-brand) / <alpha-value>)',
        ok:         'rgb(var(--c-ok) / <alpha-value>)',
        warn:       'rgb(var(--c-warn) / <alpha-value>)',
        danger:     'rgb(var(--c-danger) / <alpha-value>)',
      },
      borderRadius: {
        card: '14px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(31,30,27,0.04)',
        'card-hover': '0 4px 16px rgba(31,30,27,0.06)',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
