// Design tokens ported from the "Legal AI — дизайн-система" canvas (the HTML Sergey likes).
// Every viz-lab view references THIS single palette, so tweaking a colour is a one-line change here.

export const C = {
  // neutral paper base
  canvas: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFAF7',
  border: '#ECEAE3',
  borderStrong: '#E0DCD2',
  hair: '#F2F0EA',
  ink: '#1F1E1B',
  inkSecondary: '#6B6862',
  muted: '#9B978E',
  faint: '#C9C3B6',

  // brand accent (single blue)
  accent: '#2563EB',
  accentHover: '#1D4FD7',
  accentTint: '#EEF3FE',
  accentBorder: '#DBE6FD',

  // status semantics (muted, never neon)
  ok: '#2E7D5B',
  okTint: '#E7F2EB',
  okBorder: '#CFE6D8',
  okInk: '#256B4D',
  warn: '#B7791F',
  warnTint: '#FBF1DD',
  warnBorder: '#ECDBB6',
  warnInk: '#9A6512',
  danger: '#BC4334',
  dangerTint: '#F8E7E4',
  dangerBorder: '#ECCBC5',
  dangerInk: '#A23A2D',

  // impact highlight (law-change ripple)
  impact: '#C8881C',
  impactRing: 'rgba(200,136,28,.18)',
  accentRing: 'rgba(37,99,235,.16)',
} as const

export const FONT = "'Geist','Segoe UI',system-ui,-apple-system,sans-serif"
export const MONO = "'Geist Mono','SF Mono',ui-monospace,monospace"

// ─── Node-type ladder: law → article → service → document ────────────────────
export type NodeKind = 'law' | 'art' | 'srv' | 'doc'

export const KIND_STRIPE: Record<NodeKind, string> = {
  law: '#0E4D6E', art: '#1B6CA8', srv: '#2563EB', doc: '#7FA8D0',
}
export const KIND_TINT: Record<NodeKind, string> = {
  law: '#E6EEF3', art: '#E8F0F7', srv: '#EEF3FE', doc: '#EDF3F9',
}
export const KIND_LABEL: Record<NodeKind, string> = {
  law: 'Закон', art: 'Стаття', srv: 'Послуга', doc: 'Документ',
}

// ─── Service health "traffic light" ──────────────────────────────────────────
export type Health = 'ok' | 'warn' | 'problem'

export const HEALTH: Record<
  Health,
  { dot: string; ink: string; tint: string; border: string; label: string }
> = {
  ok:      { dot: C.ok,     ink: C.okInk,     tint: C.okTint,     border: C.okBorder,     label: 'Готова до роботи' },
  warn:    { dot: C.warn,   ink: C.warnInk,   tint: C.warnTint,   border: C.warnBorder,   label: 'Потребує уваги' },
  problem: { dot: C.danger, ink: C.dangerInk, tint: C.dangerTint, border: C.dangerBorder, label: 'Проблема' },
}

// money + number formatting (UAH, Ukrainian grouping)
export const uah = (n: number): string =>
  n === 0 ? '—' : '₴' + n.toLocaleString('uk-UA')
export const num = (n: number): string => n.toLocaleString('uk-UA')
