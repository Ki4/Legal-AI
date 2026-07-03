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

/**
 * Shared tail of publish/restore: gate the template, snapshot the current
 * service row into service_revisions (invariant 3 — snapshot BEFORE the change;
 * interview Q8: backups so neither the lawyer nor Sergey can wreck a service),
 * then set document_template (+draft) to the new text.
 */
async function gateSnapshotAndSet(
  { supabase, validate }: PublishDeps,
  serviceId: string,
  template: string,
  userId: string | null,
  reason: 'publish_template' | 'restore',
): Promise<PublishResult> {
  const gate = validate(template)
  if (!gate.ok) return gate

  const { data: svc, error: selErr } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()
  if (selErr || !svc) {
    return { ok: false, error: `Не вдалося прочитати послугу: ${selErr?.message ?? 'не знайдено'}` }
  }

  const { error: revErr } = await supabase.from('service_revisions').insert({
    service_id: serviceId,
    snapshot: svc,
    changed_by: userId,
    reason,
  })
  if (revErr) return { ok: false, error: `Не вдалося зберегти ревізію: ${revErr.message}` }

  // First publish of a template-driven service turns the mode on (interview Q11).
  // Existing 'js' / 'hybrid' services keep their mode untouched.
  const update: Record<string, unknown> = {
    document_template: template,
    document_template_draft: template, // draft == published right after a publish
  }
  if (!svc.generation_mode) update.generation_mode = 'template'

  const { error: updErr } = await supabase.from('services').update(update).eq('id', serviceId)
  if (updErr) return { ok: false, error: `Не вдалося опублікувати: ${updErr.message}` }
  return { ok: true }
}

export async function publishTemplate(
  deps: PublishDeps,
  { serviceId, draft, userId }: PublishArgs,
): Promise<PublishResult> {
  return gateSnapshotAndSet(deps, serviceId, draft, userId, 'publish_template')
}

// ── «Історія змін» (specs/features/template-editor §5) ──────────────────────

/** One row of the revision archive, as listed in the history panel. */
export interface RevisionRow {
  id: string
  reason: string
  created_at: string
  /** Full services-row snapshot taken BEFORE the change that created this revision. */
  snapshot: Record<string, unknown>
}

export type ListRevisionsResult =
  | { ok: true; revisions: RevisionRow[] }
  | { ok: false; error: string }

export async function listRevisions(
  supabase: SupabaseClient,
  serviceId: string,
): Promise<ListRevisionsResult> {
  const { data, error } = await supabase
    .from('service_revisions')
    .select('id, reason, created_at, snapshot')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return { ok: false, error: `Не вдалося завантажити історію: ${error.message}` }
  return { ok: true, revisions: (data ?? []) as RevisionRow[] }
}

/**
 * «Відновити» — publish-like flow (§5): the revision's document_template goes
 * back through the SAME gate → snapshot(reason='restore') → set sequence, so a
 * restore is just as audited and just as parse-safe as a publish.
 */
export async function restoreTemplate(
  deps: PublishDeps,
  { serviceId, revision, userId }: { serviceId: string; revision: RevisionRow; userId: string | null },
): Promise<PublishResult & { template?: string }> {
  const template = revision.snapshot?.document_template
  if (typeof template !== 'string' || !template.trim()) {
    return { ok: false, error: 'У цій ревізії немає шаблону — відновлювати нічого.' }
  }
  const result = await gateSnapshotAndSet(deps, serviceId, template, userId, 'restore')
  return result.ok ? { ok: true, template } : result
}
