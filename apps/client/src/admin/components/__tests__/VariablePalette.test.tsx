// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { VariablePalette } from '../VariablePalette'
import { providedContextKeys } from '../../../lib/serviceAnatomy'
import type { FormConfig } from '../../../types/form'

// Engine-free by design: badges come from the pure serviceAnatomy diff.
const FORM: FormConfig = {
  service_id: 'divorce',
  title: 'Т',
  tabs: [{ id: 'g', label: 'Загальне' }],
  steps: [
    { id: 'last_name', tab: 'g', type: 'text', label: 'Прізвище' },
    { id: 'city', tab: 'g', type: 'text', label: 'Місто' },
  ],
}

afterEach(cleanup)

describe('VariablePalette', () => {
  it('renders a chip per form field with label and id', () => {
    render(<VariablePalette formConfig={FORM} template="{{last_name}}" onInsert={() => {}} />)
    expect(screen.getByText('Прізвище')).toBeTruthy()
    expect(screen.getByText('last_name')).toBeTruthy()
    expect(screen.getByText('Місто')).toBeTruthy()
  })

  it('click inserts the {{id}} token', () => {
    const onInsert = vi.fn()
    render(<VariablePalette formConfig={FORM} template="" onInsert={onInsert} />)
    fireEvent.click(screen.getByText('Прізвище'))
    expect(onInsert).toHaveBeenCalledWith('{{last_name}}')
  })

  it('marks fields the template never uses with «не в шаблоні»', () => {
    render(<VariablePalette formConfig={FORM} template="Позивач: {{last_name}}" onInsert={() => {}} />)
    const badges = screen.getAllByText('не в шаблоні')
    expect(badges).toHaveLength(1)
    // The badge sits inside the chip of the unused field (city), not last_name.
    expect(badges[0].closest('button')?.textContent).toContain('city')
  })

  it('renders the computed-keys group from providedContextKeys()', () => {
    const onInsert = vi.fn()
    render(<VariablePalette formConfig={FORM} template="" onInsert={onInsert} />)
    expect(screen.getByText('Обчислювані поля (рушій)')).toBeTruthy()
    const keys = providedContextKeys()
    expect(keys.length).toBeGreaterThan(0)
    for (const key of ['plaintiff_name', 'children', 'court_fee']) {
      expect(keys).toContain(key)
      expect(screen.getByText(key)).toBeTruthy()
    }
    fireEvent.click(screen.getByText('plaintiff_name'))
    expect(onInsert).toHaveBeenCalledWith('{{plaintiff_name}}')
  })
})
