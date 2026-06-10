-- Migration 011: Service lifecycle — status kill-switch + law_change_log audit
-- Purpose:
--   1. services.status — kill-switch (active|needs_review|disabled). Authoritative
--      control over whether a service is served. Lawyer flips the column, no deploy.
--   2. law_change_log — append-only audit of legislative changes + lawyer review.
-- Relationship to existing schema:
--   - services.needs_law_review (migration 007) is now SUPERSEDED by status as the
--     authoritative serving signal. Kept untouched for now — see IMPROVEMENTS #41.
--   - law_deps stays in services.watched_laws JSONB (reverse index by query) — IMPROVEMENTS #42.
-- Executed: 2026-06-08 via Supabase SQL Editor (verified: divorce/alimony=active,
--   placeholders=disabled, law_change_log RLS blocks anon)

-- ─── 1. services.status — kill-switch ─────────────────────────────────────────

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'disabled';

-- Constrain to the three lifecycle states. needs_review blocks serving like disabled.
ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_status_check;
ALTER TABLE public.services
ADD CONSTRAINT services_status_check
  CHECK (status IN ('active', 'needs_review', 'disabled'));

COMMENT ON COLUMN public.services.status IS
  'Lifecycle kill-switch. active = served; needs_review = blocked (law changed, awaiting lawyer sign-off); disabled = manually off. ONLY active is served. Authoritative over needs_law_review.';

-- Backfill: signed-off live services → active. Everything else keeps the default
-- (disabled), so any stale / placeholder service stays off until explicit sign-off.
-- (military / business / court_search are placeholders → stay disabled.)
UPDATE public.services SET status = 'active' WHERE slug IN ('divorce', 'alimony');

-- Keep the two signals coherent at migration time: an active service has no pending
-- review. Clears the stale divorce.needs_law_review=true leftover (decision 2026-06-08).
-- status is now authoritative; needs_law_review is reference-only (see IMPROVEMENTS #41).
UPDATE public.services SET needs_law_review = false WHERE status = 'active';

-- ─── 2. law_change_log — audit of legislative changes ─────────────────────────
-- Append-only journal: law X changed → which services affected → what the lawyer did.
-- detected_by = 'manual' for now; 'cron' reserved for future automated monitoring.

CREATE TABLE IF NOT EXISTS public.law_change_log (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  law_slug           text NOT NULL,
  law_title          text,
  old_revision_date  date,
  new_revision_date  date,
  detected_at        timestamptz NOT NULL DEFAULT now(),
  detected_by        text NOT NULL DEFAULT 'manual'
                       CHECK (detected_by IN ('manual', 'cron')),
  affected_services  text[] NOT NULL DEFAULT '{}',
  action             text NOT NULL DEFAULT 'flagged'
                       CHECK (action IN ('flagged', 'reviewed', 'dismissed')),
  reviewed_by        text,
  reviewed_at        timestamptz,
  notes              text
);

COMMENT ON TABLE public.law_change_log IS
  'Audit of watched-law changes and lawyer review. One row per detected change. Drives needs_review / status on affected services.';

CREATE INDEX IF NOT EXISTS law_change_log_law_slug_idx ON public.law_change_log (law_slug);
CREATE INDEX IF NOT EXISTS law_change_log_action_idx   ON public.law_change_log (action);

-- ─── 3. RLS — service_role only (same posture as cases / identities) ───────────
-- No public policy → anon / authenticated blocked. n8n uses service_role → bypasses RLS.

ALTER TABLE public.law_change_log ENABLE ROW LEVEL SECURITY;

-- ─── Verification (run after applying) ────────────────────────────────────────
-- SELECT slug, status FROM public.services ORDER BY slug;
--   expect: divorce=active, alimony=active, everything else=disabled
-- SELECT count(*) FROM public.law_change_log;   -- expect: 0
