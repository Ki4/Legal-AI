// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { TemplateToolbar } from '../TemplateToolbar'

function renderToolbar(over: Partial<Parameters<typeof TemplateToolbar>[0]> = {}) {
  const onStyle = vi.fn()
  const onWrap = vi.fn()
  const onInsert = vi.fn()
  render(<TemplateToolbar onStyle={onStyle} onWrap={onWrap} onInsert={onInsert} {...over} />)
  return { onStyle, onWrap, onInsert }
}

afterEach(cleanup)

describe('TemplateToolbar', () => {
  it('clicking «Праворуч» reports the right-align directive', () => {
    const { onStyle, onWrap, onInsert } = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Праворуч' }))
    expect(onStyle).toHaveBeenCalledWith('{{!style: right}}')
    expect(onWrap).not.toHaveBeenCalled()
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('clicking «Тримати разом» reports the keep-block pair', () => {
    const { onWrap } = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Тримати разом' }))
    expect(onWrap).toHaveBeenCalledWith('{{!style: keep-block}}', '{{!style: /keep-block}}')
  })

  it('clicking «Умовний блок» inserts a valid if-skeleton', () => {
    const { onInsert } = renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Умовний блок' }))
    expect(onInsert).toHaveBeenCalledWith('{{#if поле}}\n…\n{{/if}}')
  })

  it('disables every button when disabled', () => {
    renderToolbar({ disabled: true })
    for (const btn of screen.getAllByRole('button')) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
