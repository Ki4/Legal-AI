import { describe, it, expect } from 'vitest'
import {
  CANONICAL_BLOCKS,
  RELATIONS,
  relationOf,
  entryById,
  type RegistryEntry,
} from '../blockRegistry'

const HEX = /^#[0-9a-fA-F]{6}$/

const allEntries: RegistryEntry[] = [...CANONICAL_BLOCKS, ...RELATIONS]

describe('CANONICAL_BLOCKS', () => {
  it('contains exactly the 8 canonical blocks in document order', () => {
    expect(CANONICAL_BLOCKS.map((b) => b.id)).toEqual([
      'court_header',
      'parties',
      'doc_title',
      'circumstances',
      'legal_basis',
      'petition',
      'appendices',
      'signature',
    ])
  })

  it('every block has a non-empty label, help_text and a valid hex color', () => {
    for (const b of CANONICAL_BLOCKS) {
      expect(b.label.trim(), `${b.id} label`).not.toBe('')
      expect(b.help_text.trim(), `${b.id} help_text`).not.toBe('')
      expect(b.color, `${b.id} color`).toMatch(HEX)
    }
  })

  it('blocks carry no authoring primitive (they are detected, not authored)', () => {
    for (const b of CANONICAL_BLOCKS) {
      expect(b.primitives, `${b.id} primitives`).toEqual([])
    }
  })
})

describe('RELATIONS', () => {
  it('contains exactly the two v1 integrity relations', () => {
    expect(RELATIONS.map((r) => r.id)).toEqual(['keep-together', 'page-break-before'])
  })

  it('maps each relation to its engine primitive', () => {
    expect(entryById('keep-together')?.primitives).toEqual(['keep-block'])
    expect(entryById('page-break-before')?.primitives).toEqual(['page-break-before'])
  })

  it('every relation has a non-empty label, help_text and a valid hex color', () => {
    for (const r of RELATIONS) {
      expect(r.label.trim(), `${r.id} label`).not.toBe('')
      expect(r.help_text.trim(), `${r.id} help_text`).not.toBe('')
      expect(r.color, `${r.id} color`).toMatch(HEX)
    }
  })
})

describe('registry integrity', () => {
  it('has unique ids across blocks and relations', () => {
    const ids = allEntries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('declares no "dead" v1 attributes (no widow/orphan, no inter-block glue)', () => {
    const forbidden = ['widow', 'orphan', 'keep-with-prev', 'glue']
    for (const e of allEntries) {
      for (const p of e.primitives) {
        expect(forbidden, `${e.id} primitive "${p}"`).not.toContain(p)
      }
    }
  })

  it('ships no sub-blocks in v1 (type allows nesting, data has none)', () => {
    for (const e of allEntries) {
      expect(e.parent, `${e.id} parent`).toBeUndefined()
    }
  })
})

describe('relationOf', () => {
  it('maps keep-with-next (desugared keep-block) to keep-together', () => {
    expect(relationOf(['keep-with-next'])).toBe('keep-together')
  })

  it('maps page-break-before to itself', () => {
    expect(relationOf(['page-break-before'])).toBe('page-break-before')
  })

  it('returns null for no / undefined / non-integrity keywords', () => {
    expect(relationOf(undefined)).toBeNull()
    expect(relationOf([])).toBeNull()
    expect(relationOf(['center', 'bold'])).toBeNull()
  })

  it('prefers page-break-before when a paragraph carries both', () => {
    expect(relationOf(['keep-with-next', 'page-break-before'])).toBe('page-break-before')
  })
})

describe('entryById', () => {
  it('finds blocks and relations, undefined for unknown', () => {
    expect(entryById('petition')?.label).toBe('ПРОШУ')
    expect(entryById('keep-together')?.label).toBe('Тримати разом')
    expect(entryById('nope')).toBeUndefined()
  })
})
