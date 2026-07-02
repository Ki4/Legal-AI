// Single source of truth for service categories (legal verticals) shown in the admin catalog.
// Categories are a FIXED list in code — not a DB enum — so adding a vertical is a one-line
// change here and never risks breaking inserts. `services.category` (migration 030) stores the
// key; NULL means uncategorised. Backfill on 030 set all existing services to 'family'.

export type ServiceCategory = 'family' | 'medical'

export interface ServiceCategoryDef {
  key: ServiceCategory
  label: string      // Ukrainian label shown to the lawyer
}

export const SERVICE_CATEGORIES: ServiceCategoryDef[] = [
  { key: 'family',  label: 'Сімейне право' },
  { key: 'medical', label: 'Медичне право' },
]

const BY_KEY: Record<string, ServiceCategoryDef> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.key, c]),
)

/** Label shown in the "uncategorised" group and the editor's empty option. */
export const UNCATEGORISED_LABEL = 'Без категорії'

export function isServiceCategory(value: unknown): value is ServiceCategory {
  return typeof value === 'string' && value in BY_KEY
}

/** Human label for a category key. Unknown / null keys fall back to «Без категорії». */
export function categoryLabel(key: string | null | undefined): string {
  if (key && key in BY_KEY) return BY_KEY[key].label
  return UNCATEGORISED_LABEL
}

export interface CategoryGroup<T> {
  key: string          // category key, or '' for uncategorised
  label: string
  items: T[]
}

/**
 * Group items by their `category`, ordered by SERVICE_CATEGORIES (uncategorised last).
 * Empty groups are omitted. Unknown/NULL categories fold into the uncategorised group.
 */
export function groupByCategory<T extends { category: string | null }>(items: T[]): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = isServiceCategory(item.category) ? item.category : ''
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }

  const groups: CategoryGroup<T>[] = []
  for (const { key, label } of SERVICE_CATEGORIES) {
    const items = buckets.get(key)
    if (items && items.length) groups.push({ key, label, items })
  }
  const uncategorised = buckets.get('')
  if (uncategorised && uncategorised.length) {
    groups.push({ key: '', label: UNCATEGORISED_LABEL, items: uncategorised })
  }
  return groups
}
