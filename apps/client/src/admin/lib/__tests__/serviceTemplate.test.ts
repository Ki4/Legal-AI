import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publishTemplate } from '../serviceTemplate'
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
