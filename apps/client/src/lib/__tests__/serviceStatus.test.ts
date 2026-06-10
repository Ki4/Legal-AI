import { describe, it, expect } from 'vitest'
import {
  isServiceStatus,
  toServiceStatus,
  statusActions,
  isPublishedFor,
  STATUS_META,
} from '../serviceStatus'

describe('isServiceStatus', () => {
  it('accepts the three valid statuses', () => {
    expect(isServiceStatus('active')).toBe(true)
    expect(isServiceStatus('needs_review')).toBe(true)
    expect(isServiceStatus('disabled')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isServiceStatus('published')).toBe(false)
    expect(isServiceStatus(true)).toBe(false)
    expect(isServiceStatus(null)).toBe(false)
    expect(isServiceStatus(undefined)).toBe(false)
  })
})

describe('toServiceStatus', () => {
  it('passes valid statuses through', () => {
    expect(toServiceStatus('active')).toBe('active')
    expect(toServiceStatus('needs_review')).toBe('needs_review')
  })

  it('defaults to disabled for invalid / missing values', () => {
    expect(toServiceStatus(null)).toBe('disabled')
    expect(toServiceStatus('whatever')).toBe('disabled')
    expect(toServiceStatus(undefined)).toBe('disabled')
  })
})

describe('statusActions', () => {
  it('active → only disable', () => {
    expect(statusActions('active').map((a) => a.to)).toEqual(['disabled'])
  })

  it('disabled → only activate', () => {
    expect(statusActions('disabled').map((a) => a.to)).toEqual(['active'])
  })

  it('needs_review → confirm (active) or disable', () => {
    expect(statusActions('needs_review').map((a) => a.to)).toEqual(['active', 'disabled'])
  })

  it('confirm action from needs_review is primary', () => {
    const confirm = statusActions('needs_review').find((a) => a.to === 'active')
    expect(confirm?.variant).toBe('primary')
  })
})

describe('isPublishedFor', () => {
  it('is true only for active (mirror of deprecated is_published)', () => {
    expect(isPublishedFor('active')).toBe(true)
    expect(isPublishedFor('needs_review')).toBe(false)
    expect(isPublishedFor('disabled')).toBe(false)
  })
})

describe('STATUS_META', () => {
  it('has a label for every status', () => {
    expect(STATUS_META.active.label).toBeTruthy()
    expect(STATUS_META.needs_review.label).toBeTruthy()
    expect(STATUS_META.disabled.label).toBeTruthy()
  })
})
