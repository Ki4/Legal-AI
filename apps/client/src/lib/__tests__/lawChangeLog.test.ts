import { describe, it, expect } from 'vitest'
import {
  isLawChangeAction,
  toLawChangeAction,
  isPending,
  pendingCount,
  reviewActions,
  formatRevision,
  ACTION_META,
  toAiStatus,
  confidencePct,
  SEVERITY_META,
} from '../lawChangeLog'

describe('isLawChangeAction', () => {
  it('accepts the three valid actions', () => {
    expect(isLawChangeAction('flagged')).toBe(true)
    expect(isLawChangeAction('reviewed')).toBe(true)
    expect(isLawChangeAction('dismissed')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isLawChangeAction('pending')).toBe(false)
    expect(isLawChangeAction(null)).toBe(false)
    expect(isLawChangeAction(undefined)).toBe(false)
  })
})

describe('toLawChangeAction', () => {
  it('passes valid actions through', () => {
    expect(toLawChangeAction('reviewed')).toBe('reviewed')
    expect(toLawChangeAction('dismissed')).toBe('dismissed')
  })

  it('defaults to flagged (pending) for invalid / missing values', () => {
    expect(toLawChangeAction(null)).toBe('flagged')
    expect(toLawChangeAction('whatever')).toBe('flagged')
  })
})

describe('isPending / pendingCount', () => {
  it('only flagged is pending', () => {
    expect(isPending('flagged')).toBe(true)
    expect(isPending('reviewed')).toBe(false)
    expect(isPending('dismissed')).toBe(false)
  })

  it('counts only flagged rows', () => {
    const rows = [
      { action: 'flagged' as const },
      { action: 'reviewed' as const },
      { action: 'flagged' as const },
      { action: 'dismissed' as const },
    ]
    expect(pendingCount(rows)).toBe(2)
  })

  it('is zero for an empty list', () => {
    expect(pendingCount([])).toBe(0)
  })
})

describe('reviewActions', () => {
  it('flagged → review or dismiss', () => {
    expect(reviewActions('flagged').map((a) => a.to)).toEqual(['reviewed', 'dismissed'])
  })

  it('review action from flagged is primary', () => {
    const review = reviewActions('flagged').find((a) => a.to === 'reviewed')
    expect(review?.variant).toBe('primary')
  })

  it('resolved rows can be re-opened to flagged', () => {
    expect(reviewActions('reviewed').map((a) => a.to)).toEqual(['flagged'])
    expect(reviewActions('dismissed').map((a) => a.to)).toEqual(['flagged'])
  })
})

describe('formatRevision', () => {
  it('shows both dates when old is known', () => {
    expect(formatRevision('2026-01-01', '2026-03-04')).toBe('2026-01-01 → 2026-03-04')
  })

  it('omits the old date when unknown', () => {
    expect(formatRevision(null, '2026-03-04')).toBe('→ 2026-03-04')
  })

  it('falls back to ? for an unknown new date', () => {
    expect(formatRevision('2026-01-01', null)).toBe('2026-01-01 → ?')
  })
})

describe('ACTION_META', () => {
  it('has a label for every action', () => {
    expect(ACTION_META.flagged.label).toBeTruthy()
    expect(ACTION_META.reviewed.label).toBeTruthy()
    expect(ACTION_META.dismissed.label).toBeTruthy()
  })
})

describe('toAiStatus', () => {
  it('passes through valid statuses', () => {
    expect(toAiStatus('drafted')).toBe('drafted')
    expect(toAiStatus('abstained')).toBe('abstained')
    expect(toAiStatus('error')).toBe('error')
    expect(toAiStatus('pending')).toBe('pending')
  })

  it('defaults unknown / missing values to pending', () => {
    expect(toAiStatus(undefined)).toBe('pending')
    expect(toAiStatus('garbage')).toBe('pending')
  })
})

describe('confidencePct', () => {
  it('renders a 0–100% label', () => {
    expect(confidencePct(0.7)).toBe('70%')
    expect(confidencePct(1)).toBe('100%')
  })
  it('returns null when confidence is absent', () => {
    expect(confidencePct(null)).toBeNull()
  })
})

describe('SEVERITY_META', () => {
  it('has a label + colours for every severity', () => {
    for (const s of ['high', 'medium', 'low'] as const) {
      expect(SEVERITY_META[s].label).toBeTruthy()
      expect(SEVERITY_META[s].dot).toMatch(/^bg-/)
      expect(SEVERITY_META[s].text).toMatch(/^text-/)
    }
  })
})
