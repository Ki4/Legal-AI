// Publish flow for the template editor (specs/features/template-editor §2, migration 030).
// Sequence: parse gate → snapshot the WHOLE service row into service_revisions →
// copy draft into document_template. Engine-free: the gate is injected so unit
// tests run without the '@doc-engine' alias.
//
// No DB transaction in v1 (acceptable for a single-admin tool): a failure between
// snapshot and update leaves an extra revision row, never a broken template.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { GateResult } from './templateGate'

export interface PublishDeps {
  supabase: SupabaseClient
  validate: (template: string) => GateResult
}

export interface PublishArgs {
  serviceId: string
  draft: string
  /** auth.users id of the admin performing the publish (audit trail). */
  userId: string | null
}

export type PublishResult = { ok: true } | { ok: false; error: string }

export async function publishTemplate(
  { supabase, validate }: PublishDeps,
  { serviceId, draft, userId }: PublishArgs,
): Promise<PublishResult> {
  const gate = validate(draft)
  if (!gate.ok) return gate

  const { data: svc, error: selErr } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()
  if (selErr || !svc) {
    return { ok: false, error: `Не вдалося прочитати послугу: ${selErr?.message ?? 'не знайдено'}` }
  }

  // Snapshot BEFORE the change — restore point + audit (interview Q8: backups
  // before big changes so neither the lawyer nor Sergey can wreck a service).
  const { error: revErr } = await supabase.from('service_revisions').insert({
    service_id: serviceId,
    snapshot: svc,
    changed_by: userId,
    reason: 'publish_template',
  })
  if (revErr) return { ok: false, error: `Не вдалося зберегти ревізію: ${revErr.message}` }

  // First publish of a template-driven service turns the mode on (interview Q11).
  // Existing 'js' / 'hybrid' services keep their mode untouched.
  const update: Record<string, unknown> = {
    document_template: draft,
    document_template_draft: draft, // draft == published right after a publish
  }
  if (!svc.generation_mode) update.generation_mode = 'template'

  const { error: updErr } = await supabase.from('services').update(update).eq('id', serviceId)
  if (updErr) return { ok: false, error: `Не вдалося опублікувати: ${updErr.message}` }
  return { ok: true }
}
