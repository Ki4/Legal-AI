import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listRevisions, publishTemplate, restoreTemplate, type RevisionRow } from '../serviceTemplate'
import type { GateResult } from '../templateGate'

// Minimal supabase mock recording call order — publishTemplate must snapshot the
// service into service_revisions BEFORE updating document_template (invariant 3).
function makeSupabase(serviceRow: Record<string, unknown>) {
  const calls: Array<{ op: string; table: string; payload?: unknown }> = []
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  calls.push({ op: 'select', table })
                  return { data: serviceRow, error: null }
                },
              }
            },
          }
        },
        insert(payload: unknown) {
          calls.push({ op: 'insert', table, payload })
          return Promise.resolve({ error: null })
        },
        update(payload: unknown) {
          return {
            eq() {
              calls.push({ op: 'update', table, payload })
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

const okGate = (): GateResult => ({ ok: true })
const failGate = (): GateResult => ({ ok: false, error: 'Помилка в шаблоні: тест' })

const SERVICE = {
  id: 'svc-1',
  slug: 'divorce',
  document_template: 'old text',
  document_template_draft: 'new text',
  generation_mode: 'template',
}

describe('publishTemplate', () => {
  it('blocks on a parse error and touches nothing in the DB', async () => {
    const { client, calls } = makeSupabase(SERVICE)
    const r = await publishTemplate(
      { supabase: client, validate: failGate },
      { serviceId: 'svc-1', draft: 'broken', userId: 'u1' },
    )
    expect(r.ok).toBe(false)
    expect(calls).toEqual([]) // no select/insert/update — gate fires first
  })

  it('snapshots to service_revisions BEFORE updating the template', async () => {
    const { client, calls } = makeSupabase(SERVICE)
    const r = await publishTemplate(
      { supabase: client, validate: okGate },
      { serviceId: 'svc-1', draft: 'new text', userId: 'u1' },
    )
    expect(r).toEqual({ ok: true })
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual([
      'select:services',
      'insert:service_revisions',
      'update:services',
    ])
    const rev = calls[1].payload as Record<string, unknown>
    expect(rev.service_id).toBe('svc-1')
    expect(rev.reason).toBe('publish_template')
    expect(rev.changed_by).toBe('u1')
    expect(rev.snapshot).toEqual(SERVICE) // whole-row snapshot (interview Q8)
    const upd = calls[2].payload as Record<string, unknown>
    expect(upd.document_template).toBe('new text')
    expect(upd.document_template_draft).toBe('new text') // draft == published after publish
    expect('generation_mode' in upd).toBe(false) // existing mode untouched
  })

  it("sets generation_mode='template' on first publish of a mode-less service", async () => {
    const { client, calls } = makeSupabase({ ...SERVICE, generation_mode: null })
    await publishTemplate(
      { supabase: client, validate: okGate },
      { serviceId: 'svc-1', draft: 'new text', userId: null },
    )
    const upd = calls[2].payload as Record<string, unknown>
    expect(upd.generation_mode).toBe('template')
  })
})

const REVISION: RevisionRow = {
  id: 'rev-1',
  reason: 'publish_template',
  created_at: '2026-07-01T10:00:00Z',
  snapshot: { ...SERVICE, document_template: 'restored text' },
}

describe('restoreTemplate', () => {
  it('restores the snapshot template through the same gated flow with reason=restore', async () => {
    const { client, calls } = makeSupabase(SERVICE)
    const validate = vi.fn(okGate)
    const r = await restoreTemplate(
      { supabase: client, validate },
      { serviceId: 'svc-1', revision: REVISION, userId: 'u1' },
    )
    expect(r).toEqual({ ok: true, template: 'restored text' })
    expect(validate).toHaveBeenCalledWith('restored text') // gate runs on the OLD template
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual([
      'select:services',
      'insert:service_revisions',
      'update:services',
    ])
    const rev = calls[1].payload as Record<string, unknown>
    expect(rev.reason).toBe('restore') // the restore itself is audited (invariant 3)
    expect(rev.snapshot).toEqual(SERVICE) // snapshot of the CURRENT row, not the revision
    const upd = calls[2].payload as Record<string, unknown>
    expect(upd.document_template).toBe('restored text')
    expect(upd.document_template_draft).toBe('restored text')
  })

  it('refuses a revision whose snapshot has no template — DB untouched', async () => {
    const { client, calls } = makeSupabase(SERVICE)
    const r = await restoreTemplate(
      { supabase: client, validate: okGate },
      {
        serviceId: 'svc-1',
        revision: { ...REVISION, snapshot: { ...SERVICE, document_template: null } },
        userId: 'u1',
      },
    )
    expect(r.ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('blocks when the old template no longer passes the gate — DB untouched', async () => {
    const { client, calls } = makeSupabase(SERVICE)
    const r = await restoreTemplate(
      { supabase: client, validate: failGate },
      { serviceId: 'svc-1', revision: REVISION, userId: 'u1' },
    )
    expect(r.ok).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('listRevisions', () => {
  it('returns rows newest-first from service_revisions', async () => {
    const rows = [REVISION]
    const captured: Record<string, unknown> = {}
    const client = {
      from(table: string) {
        captured.table = table
        return {
          select(cols: string) {
            captured.cols = cols
            return {
              eq(col: string, val: string) {
                captured.eq = [col, val]
                return {
                  order(col2: string, opts: unknown) {
                    captured.order = [col2, opts]
                    return {
                      limit: async () => ({ data: rows, error: null }),
                    }
                  },
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient
    const r = await listRevisions(client, 'svc-1')
    expect(r).toEqual({ ok: true, revisions: rows })
    expect(captured.table).toBe('service_revisions')
    expect(captured.eq).toEqual(['service_id', 'svc-1'])
    expect(captured.order).toEqual(['created_at', { ascending: false }])
  })

  it('surfaces a load error in Ukrainian', async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({ limit: async () => ({ data: null, error: { message: 'boom' } }) }),
          }),
        }),
      }),
    } as unknown as SupabaseClient
    const r = await listRevisions(client, 'svc-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Не вдалося завантажити історію')
  })
})
