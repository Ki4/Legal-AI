import { describe, it, expect } from 'vitest'
import { evalSingle, evalCondition, isVisible } from '../conditions'
import type { Answers, SingleCondition, ShowIfCondition } from '../../types/form'

// ─── evalSingle ──────────────────────────────────────────────────────────────

describe('evalSingle', () => {
  // --- operator: == ---

  it('returns true when string value matches', () => {
    const cond: SingleCondition = { field: 'gender', operator: '==', value: 'male' }
    expect(evalSingle(cond, { gender: 'male' })).toBe(true)
  })

  it('returns false when string value does not match', () => {
    const cond: SingleCondition = { field: 'gender', operator: '==', value: 'male' }
    expect(evalSingle(cond, { gender: 'female' })).toBe(false)
  })

  it('returns true when boolean value matches (true)', () => {
    const cond: SingleCondition = { field: 'has_children', operator: '==', value: true }
    expect(evalSingle(cond, { has_children: true })).toBe(true)
  })

  it('returns true when boolean value matches (false)', () => {
    const cond: SingleCondition = { field: 'has_children', operator: '==', value: false }
    expect(evalSingle(cond, { has_children: false })).toBe(true)
  })

  it('returns false when boolean field is missing (undefined vs false)', () => {
    const cond: SingleCondition = { field: 'has_children', operator: '==', value: false }
    // undefined !== false in strict comparison
    expect(evalSingle(cond, {})).toBe(false)
  })

  it('returns false when field is null and value is empty string', () => {
    const cond: SingleCondition = { field: 'name', operator: '==', value: '' }
    expect(evalSingle(cond, { name: null })).toBe(false)
  })

  // --- operator: != ---

  it('!= returns true when values differ', () => {
    const cond: SingleCondition = { field: 'status', operator: '!=', value: 'married' }
    expect(evalSingle(cond, { status: 'single' })).toBe(true)
  })

  it('!= returns false when values match', () => {
    const cond: SingleCondition = { field: 'status', operator: '!=', value: 'married' }
    expect(evalSingle(cond, { status: 'married' })).toBe(false)
  })

  it('!= returns true when field is missing (undefined != value)', () => {
    const cond: SingleCondition = { field: 'status', operator: '!=', value: 'married' }
    expect(evalSingle(cond, {})).toBe(true)
  })

  // --- operator: > ---

  it('> compares numeric values correctly', () => {
    const cond: SingleCondition = { field: 'age', operator: '>', value: 18 }
    expect(evalSingle(cond, { age: '25' })).toBe(true)
    expect(evalSingle(cond, { age: '18' })).toBe(false)
    expect(evalSingle(cond, { age: '10' })).toBe(false)
  })

  it('> handles string numbers (form values come as strings)', () => {
    const cond: SingleCondition = { field: 'children_count', operator: '>', value: '0' }
    expect(evalSingle(cond, { children_count: '2' })).toBe(true)
    expect(evalSingle(cond, { children_count: '0' })).toBe(false)
  })

  // --- operator: < ---

  it('< compares numeric values correctly', () => {
    const cond: SingleCondition = { field: 'age', operator: '<', value: 18 }
    expect(evalSingle(cond, { age: '10' })).toBe(true)
    expect(evalSingle(cond, { age: '18' })).toBe(false)
    expect(evalSingle(cond, { age: '25' })).toBe(false)
  })

  // --- edge cases ---

  it('returns true for unknown operator (defensive fallback)', () => {
    // TypeScript would catch this, but at runtime the data comes from JSON
    const cond = { field: 'x', operator: '>=', value: 5 } as unknown as SingleCondition
    expect(evalSingle(cond, { x: '10' })).toBe(true)
  })

  it('handles null answer value with == operator', () => {
    const cond: SingleCondition = { field: 'spouse', operator: '==', value: 'yes' }
    expect(evalSingle(cond, { spouse: null })).toBe(false)
  })
})

// ─── evalCondition ───────────────────────────────────────────────────────────

describe('evalCondition', () => {
  const answers: Answers = {
    has_children: true,
    children_count: '2',
    gender: 'female',
    consent: true,
  }

  // --- single condition (no all/any wrapper) ---

  it('evaluates a single condition without wrapper', () => {
    const cond: ShowIfCondition = { field: 'has_children', operator: '==', value: true }
    expect(evalCondition(cond, answers)).toBe(true)
  })

  // --- all (AND logic) ---

  it('all: returns true when ALL conditions match', () => {
    const cond: ShowIfCondition = {
      all: [
        { field: 'has_children', operator: '==', value: true },
        { field: 'children_count', operator: '>', value: '0' },
      ],
    }
    expect(evalCondition(cond, answers)).toBe(true)
  })

  it('all: returns false when ONE condition fails', () => {
    const cond: ShowIfCondition = {
      all: [
        { field: 'has_children', operator: '==', value: true },
        { field: 'gender', operator: '==', value: 'male' },  // false
      ],
    }
    expect(evalCondition(cond, answers)).toBe(false)
  })

  it('all: returns true for empty array (vacuous truth)', () => {
    const cond: ShowIfCondition = { all: [] }
    expect(evalCondition(cond, answers)).toBe(true)
  })

  // --- any (OR logic) ---

  it('any: returns true when at least ONE condition matches', () => {
    const cond: ShowIfCondition = {
      any: [
        { field: 'gender', operator: '==', value: 'male' },    // false
        { field: 'has_children', operator: '==', value: true }, // true
      ],
    }
    expect(evalCondition(cond, answers)).toBe(true)
  })

  it('any: returns false when NO conditions match', () => {
    const cond: ShowIfCondition = {
      any: [
        { field: 'gender', operator: '==', value: 'male' },
        { field: 'consent', operator: '==', value: false },
      ],
    }
    expect(evalCondition(cond, answers)).toBe(false)
  })

  it('any: returns false for empty array (nothing to match)', () => {
    const cond: ShowIfCondition = { any: [] }
    expect(evalCondition(cond, answers)).toBe(false)
  })
})

// ─── isVisible ───────────────────────────────────────────────────────────────

describe('isVisible', () => {
  const answers: Answers = {
    has_children: true,
    court_type: 'district',
  }

  it('returns true when show_if is undefined (field always visible)', () => {
    expect(isVisible({}, answers)).toBe(true)
  })

  it('returns true when show_if is undefined explicitly', () => {
    expect(isVisible({ show_if: undefined }, answers)).toBe(true)
  })

  it('returns true when show_if condition is met', () => {
    expect(
      isVisible(
        { show_if: { field: 'has_children', operator: '==', value: true } },
        answers,
      ),
    ).toBe(true)
  })

  it('returns false when show_if condition is NOT met', () => {
    expect(
      isVisible(
        { show_if: { field: 'has_children', operator: '==', value: false } },
        answers,
      ),
    ).toBe(false)
  })

  it('works with complex all condition', () => {
    expect(
      isVisible(
        {
          show_if: {
            all: [
              { field: 'has_children', operator: '==', value: true },
              { field: 'court_type', operator: '==', value: 'district' },
            ],
          },
        },
        answers,
      ),
    ).toBe(true)
  })

  // --- real-world divorce form scenario ---

  it('scenario: show children_count only when has_children == true', () => {
    const childrenCountField = {
      show_if: { field: 'has_children', operator: '==', value: true } as ShowIfCondition,
    }

    // Parent says "yes, I have children"
    expect(isVisible(childrenCountField, { has_children: true })).toBe(true)

    // Parent says "no"
    expect(isVisible(childrenCountField, { has_children: false })).toBe(false)

    // Parent hasn't answered yet
    expect(isVisible(childrenCountField, {})).toBe(false)
  })

  it('scenario: show alimony field only when has_children AND children_count > 0', () => {
    const alimonyField = {
      show_if: {
        all: [
          { field: 'has_children', operator: '==', value: true },
          { field: 'children_count', operator: '>', value: '0' },
        ],
      } as ShowIfCondition,
    }

    // Has children and count > 0
    expect(isVisible(alimonyField, { has_children: true, children_count: '2' })).toBe(true)

    // Has children but count is 0 (edge case: adopted out?)
    expect(isVisible(alimonyField, { has_children: true, children_count: '0' })).toBe(false)

    // No children
    expect(isVisible(alimonyField, { has_children: false, children_count: '0' })).toBe(false)

    // Not answered yet
    expect(isVisible(alimonyField, {})).toBe(false)
  })
})
