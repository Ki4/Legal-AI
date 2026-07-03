-- Migration 031: template-editor (specs/features/template-editor) — draft column + revisions archive.
-- (Renamed from 030: the number collided with 030_service_categories.sql from a parallel session.)
-- Context:
--   The admin template editor lets the lawyer edit services.document_template in the
--   UI (previously SQL-only). Safety model decided in the 2026-07-02 interview:
--     • Edits go to a DRAFT column; n8n/bot generation reads ONLY document_template,
--       so an unfinished edit can never reach a paying client.
--     • "Опублікувати" copies draft → document_template AFTER a parse gate
--       (@doc-engine renderDocumentWithStyles) and AFTER snapshotting the whole
--       service row into service_revisions (append-only audit + one-click restore).
--   service_revisions is deliberately a WHOLE-SERVICE snapshot (not just the template):
--   Sergey asked for a general "backup before big changes/deletions" safety net, so the
--   same table will back future destructive ops (service delete, big form_config edits).
--
-- Append-only is enforced at the app layer in v1 (the UI never UPDATEs/DELETEs
-- revisions); no DB trigger yet — revisit if non-admin writers ever appear.
-- Idempotent: safe to re-run (IF NOT EXISTS throughout).
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

-- ─── services: draft template ──────────────────────────────────────────────────
-- NULL = no draft started (editor seeds from document_template). Generation
-- pipelines (n8n form-submit) keep reading document_template and are untouched.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS document_template_draft TEXT;

-- ─── service_revisions: append-only whole-service snapshots ────────────────────
CREATE TABLE IF NOT EXISTS public.service_revisions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- services.id is INTEGER (the table predates the migrations dir — created via
  -- the dashboard). A UUID FK failed on first apply; see docs/architecture/GOTCHAS.md.
  service_id INTEGER NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  -- Full services row as JSON at the moment BEFORE the change (title, slug,
  -- form_config, ai_prompt, document_template, document_template_draft, status,
  -- price, icon, description, generation_mode, ...).
  snapshot   JSONB NOT NULL,
  -- Admin (auth.users id) who triggered the change; NULL if unknown.
  changed_by UUID,
  -- Why the snapshot was taken: 'publish_template' | 'restore' | future reasons.
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "History for one service, newest first" is the only query pattern.
CREATE INDEX IF NOT EXISTS idx_service_revisions_service_created
  ON public.service_revisions (service_id, created_at DESC);

-- ─── RLS: admin-only (same trust boundary as services editing) ─────────────────
ALTER TABLE public.service_revisions ENABLE ROW LEVEL SECURITY;

-- Admin panel runs under Supabase Auth (authenticated); the public TWA uses the
-- anon key and must see nothing here (snapshots may embed unpublished drafts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_revisions'
      AND policyname = 'service_revisions_admin_select'
  ) THEN
    CREATE POLICY service_revisions_admin_select ON public.service_revisions
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_revisions'
      AND policyname = 'service_revisions_admin_insert'
  ) THEN
    CREATE POLICY service_revisions_admin_insert ON public.service_revisions
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
-- No UPDATE/DELETE policies on purpose → append-only for authenticated;
-- service_role (n8n/maintenance) bypasses RLS as usual.

-- ─── Verification (run after applying) ─────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='services' AND column_name='document_template_draft';        -- 1 row
-- SELECT relrowsecurity FROM pg_class WHERE relname='service_revisions';          -- t
-- SELECT policyname FROM pg_policies WHERE tablename='service_revisions';         -- 2 rows (select+insert)
-- As anon (TWA key): SELECT on service_revisions → denied / 0 rows.
