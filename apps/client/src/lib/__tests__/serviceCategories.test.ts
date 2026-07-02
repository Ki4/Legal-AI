import { describe, it, expect } from 'vitest'
import {
  categoryLabel,
  isServiceCategory,
  groupByCategory,
  UNCATEGORISED_LABEL,
} from '../serviceCategories'

describe('categoryLabel', () => {
  it('maps known keys to Ukrainian labels', () => {
    expect(categoryLabel('family')).toBe('Сімейне право')
    expect(categoryLabel('medical')).toBe('Медичне право')
  })
  it('falls back to «Без категорії» for null/unknown', () => {
    expect(categoryLabel(null)).toBe(UNCATEGORISED_LABEL)
    expect(categoryLabel(undefined)).toBe(UNCATEGORISED_LABEL)
    expect(categoryLabel('bogus')).toBe(UNCATEGORISED_LABEL)
  })
})

describe('isServiceCategory', () => {
  it('accepts known keys, rejects others', () => {
    expect(isServiceCategory('family')).toBe(true)
    expect(isServiceCategory('medical')).toBe(true)
    expect(isServiceCategory('bogus')).toBe(false)
    expect(isServiceCategory(null)).toBe(false)
    expect(isServiceCategory(42)).toBe(false)
  })
})

describe('groupByCategory', () => {
  const svc = (id: string, category: string | null) => ({ id, category })

  it('orders groups by SERVICE_CATEGORIES, uncategorised last', () => {
    const groups = groupByCategory([
      svc('a', 'medical'),
      svc('b', 'family'),
      svc('c', null),
    ])
    expect(groups.map((g) => g.key)).toEqual(['family', 'medical', ''])
    expect(groups[2].label).toBe(UNCATEGORISED_LABEL)
  })

  it('folds unknown categories into the uncategorised group', () => {
    const groups = groupByCategory([svc('a', 'bogus'), svc('b', 'family')])
    expect(groups.map((g) => g.key)).toEqual(['family', ''])
    expect(groups[1].items.map((i) => i.id)).toEqual(['a'])
  })

  it('omits empty groups', () => {
    const groups = groupByCategory([svc('a', 'family'), svc('b', 'family')])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
  })

  it('returns [] for no items', () => {
    expect(groupByCategory([])).toEqual([])
  })

  it('preserves item order within a group', () => {
    const groups = groupByCategory([svc('a', 'family'), svc('b', 'family'), svc('c', 'family')])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})
