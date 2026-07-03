// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ConfirmProvider } from '../../ui'
import { TemplateRevisionHistory } from '../TemplateRevisionHistory'

// Engine- and network-free: supabase is a stub object (the component only
// checks truthiness and passes it through), the gate module is mocked away
// (no '@doc-engine' alias under vitest), and the data layer is mocked.
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../lib/documentPreview', () => ({ validateDraft: () => ({ ok: true }) }))
vi.mock('../../lib/serviceTemplate', () => ({
  listRevisions: vi.fn(),
  restoreTemplate: vi.fn(),
}))

import { listRevisions, restoreTemplate } from '../../lib/serviceTemplate'

const REVISIONS = [
  {
    id: 'rev-2',
    reason: 'restore',
    created_at: '2026-07-03T09:30:00Z',
    snapshot: { document_template: 'v2' },
  },
  {
    id: 'rev-1',
    reason: 'publish_template',
    created_at: '2026-07-01T10:00:00Z',
    snapshot: { document_template: 'v1' },
  },
]

function renderHistory(onRestored = vi.fn()) {
  render(
    <ConfirmProvider>
      <TemplateRevisionHistory
        serviceId="svc-1"
        userId="u1"
        refreshToken={0}
        onRestored={onRestored}
      />
    </ConfirmProvider>,
  )
  return onRestored
}

beforeEach(() => {
  vi.mocked(listRevisions).mockResolvedValue({ ok: true, revisions: REVISIONS })
  vi.mocked(restoreTemplate).mockResolvedValue({ ok: true, template: 'v1' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TemplateRevisionHistory', () => {
  it('lists revisions with Ukrainian reason labels and a count', async () => {
    renderHistory()
    expect(await screen.findByText('Історія змін (2)')).toBeTruthy()
    expect(screen.getByText('Публікація шаблону')).toBeTruthy()
    expect(screen.getByText('Відновлення версії')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Відновити' })).toHaveLength(2)
  })

  it('renders nothing at all for a service with no revisions yet', async () => {
    vi.mocked(listRevisions).mockResolvedValue({ ok: true, revisions: [] })
    const { container } = render(
      <ConfirmProvider>
        <TemplateRevisionHistory serviceId="svc-1" userId="u1" refreshToken={0} onRestored={vi.fn()} />
      </ConfirmProvider>,
    )
    await waitFor(() => expect(vi.mocked(listRevisions)).toHaveBeenCalled())
    expect(container.querySelector('details')).toBeNull()
  })

  it('restores only after the confirm dialog is accepted', async () => {
    const onRestored = renderHistory()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Відновити' }))[1])
    // Nothing happens until the ConfirmModal is accepted.
    expect(vi.mocked(restoreTemplate)).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Так, відновити' }))
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith('v1'))
    const args = vi.mocked(restoreTemplate).mock.calls[0][1]
    expect(args.revision.id).toBe('rev-1')
    expect(args.userId).toBe('u1')
  })

  it('does nothing when the confirm dialog is cancelled', async () => {
    const onRestored = renderHistory()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Відновити' }))[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Так, відновити' })).toBeNull(),
    )
    expect(vi.mocked(restoreTemplate)).not.toHaveBeenCalled()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('shows the restore error inline when the flow fails', async () => {
    vi.mocked(restoreTemplate).mockResolvedValue({ ok: false, error: 'Не вдалося опублікувати: boom' })
    renderHistory()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Відновити' }))[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Так, відновити' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Не вдалося опублікувати')
  })
})
