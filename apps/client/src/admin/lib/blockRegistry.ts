// SSoT registry for the document-layout-preview feature (issue #84, G1).
//
// ONE registry feeds three consumers (requirements §1.3): (1) the A4 preview
// (block labels + integrity-highlight colours), (2) the collapsible LayoutGuide
// legend, (3) a future layout editor (#51). No duplication of this data anywhere
// else. Pure data + pure helpers — no I/O, no DB, no migrations, no engine import.
//
// Two kinds of entries share one record shape (RegistryEntry):
//   • CANONICAL_BLOCKS — semantic regions of a claim, fixed by ст.175 ЦПК. They
//     carry no authoring primitive (primitives: []); they are detected from the
//     rendered document's anchors/structure (G2), not authored.
//   • RELATIONS — the two integrity levers a lawyer reasons about. Each maps to an
//     authoring primitive already supported by the engine (keep-block /
//     page-break-before → render-document.js).

/** Shared shape for every registry entry (block or relation). */
export interface RegistryEntry {
  /** Stable machine id (kebab/snake, укр.-free). */
  id: string
  /** Human label for UI (Ukrainian). */
  label: string
  /**
   * Authoring primitive(s) this entry maps to. Empty for canonical blocks
   * (they are semantic regions, not authored). For relations: the DSL macro the
   * engine understands, e.g. ['keep-block'] / ['page-break-before'].
   */
  primitives: string[]
  /** "Why this exists" — used by the LayoutGuide legend (Ukrainian). */
  help_text: string
  /** Highlight / legend colour (hex). */
  color: string
  /**
   * Optional parent block id. The model ALLOWS named sub-blocks (a custom range
   * inside a canonical block, requirements §1.1); v1 ships none, so this stays
   * undefined for every shipped entry — present only so the type permits nesting.
   */
  parent?: string
}

/** Relation ids understood by the v1 preview (the only two integrity levers). */
export type RelationId = 'keep-together' | 'page-break-before'

/**
 * The 8 canonical blocks of a claim (requirements §1.1), in document order.
 * Order is the natural top-to-bottom skeleton of a позов per ст.175 ЦПК.
 */
export const CANONICAL_BLOCKS: RegistryEntry[] = [
  {
    id: 'court_header',
    label: 'Шапка суду',
    primitives: [],
    help_text: 'Найменування суду та реквізити сторін у «шапці» — кому і від кого подається позов.',
    color: '#6366F1', // indigo
  },
  {
    id: 'parties',
    label: 'Сторони',
    primitives: [],
    help_text: 'Позивач і відповідач: ПІБ, адреси, контакти — учасники справи.',
    color: '#0891B2', // cyan
  },
  {
    id: 'doc_title',
    label: 'Назва документа',
    primitives: [],
    help_text: 'Заголовок документа (напр. «ПОЗОВНА ЗАЯВА про розірвання шлюбу»).',
    color: '#7C3AED', // violet
  },
  {
    id: 'circumstances',
    label: 'Обставини',
    primitives: [],
    help_text: 'Фактичні обставини справи — що сталося і чому позивач звертається до суду.',
    color: '#2563EB', // accent blue
  },
  {
    id: 'legal_basis',
    label: 'Правова основа',
    primitives: [],
    help_text: 'Норми права та цитати статей, на яких ґрунтуються вимоги.',
    color: '#059669', // emerald
  },
  {
    id: 'petition',
    label: 'ПРОШУ',
    primitives: [],
    help_text: 'Прохальна частина — конкретні вимоги до суду (пронумеровані пункти).',
    color: '#DB2777', // pink
  },
  {
    id: 'appendices',
    label: 'Додатки',
    primitives: [],
    help_text: 'Перелік доданих документів і доказів.',
    color: '#D97706', // amber
  },
  {
    id: 'signature',
    label: 'Дата та підпис',
    primitives: [],
    help_text: 'Дата складання й підпис позивача — мають лишатися разом з Додатками, не осиротіти.',
    color: '#475569', // slate
  },
]

/**
 * The two integrity relations (requirements §1.2). Each is backed by an engine
 * primitive that already exists, so the preview shows a REAL effect, not a
 * mock-up. v1 has exactly these two — no widow/orphan, no inter-block glue
 * (those are export-only / out of scope; do not add dead attributes).
 */
export const RELATIONS: RegistryEntry[] = [
  {
    id: 'keep-together',
    label: 'Тримати разом',
    primitives: ['keep-block'],
    help_text:
      'Блок не розривається між сторінками — якщо не вміщається, переїжджає на наступну сторінку цілим. Так підпис не лишається сам без Додатків.',
    color: '#16A34A', // green
  },
  {
    id: 'page-break-before',
    label: 'З нової сторінки',
    primitives: ['page-break-before'],
    help_text: 'Блок завжди починається з нової сторінки.',
    color: '#EA580C', // orange
  },
]

/** Map a rendered styleHints keyword to its relation id (internal). */
const KEYWORD_TO_RELATION: Record<string, RelationId> = {
  'keep-with-next': 'keep-together', // keep-block desugars to keep-with-next chains
  'page-break-before': 'page-break-before',
}

/**
 * Map a paragraph's RENDERED style keywords (from renderDocumentWithStyles'
 * styleHints — keep-with-next / page-break-before, after keep-block desugaring)
 * to its integrity relation. Returns null when no integrity hint is present.
 *
 * Precedence: `page-break-before` wins over `keep-together` — a paragraph may
 * carry both (first line of a kept block that also starts a new page), and the
 * structural "new page" signal is the more salient one to surface in v1.
 */
export function relationOf(styleKeywords: string[] | undefined): RelationId | null {
  if (!styleKeywords || styleKeywords.length === 0) return null
  if (styleKeywords.includes('page-break-before')) return 'page-break-before'
  for (const kw of styleKeywords) {
    const rel = KEYWORD_TO_RELATION[kw]
    if (rel) return rel
  }
  return null
}

/** Look up a registry entry (block or relation) by id. */
export function entryById(id: string): RegistryEntry | undefined {
  return CANONICAL_BLOCKS.find((b) => b.id === id) ?? RELATIONS.find((r) => r.id === id)
}
