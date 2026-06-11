-- Migration 013: law_change_log review access for the admin panel (lawyer).
-- Context:
--   law_change_log (migration 011) has RLS enabled with NO policies → only service_role
--   (n8n / scripts / future CRON) can touch it; anon AND authenticated are blocked. The
--   admin panel authenticates the lawyer as the `authenticated` role (anon key + session),
--   so to surface the audit and let Olga mark a change reviewed/dismissed we need policies.
-- What this does:
--   1. SELECT for authenticated  → the lawyer can read the audit (review panel).
--   2. UPDATE for authenticated  → the lawyer can set action/reviewed_by/reviewed_at/notes.
--   INSERT / DELETE stay policy-less → blocked for authenticated. Rows are created ONLY by
--   service_role (manual script today, CRON later); the log stays append-only from the UI.
-- Tradeoff (deliberate, solo phase): blanket authenticated, NOT scoped per lawyer. Law
--   changes are global legislative facts (СК/ЦПК affect every service), not per-tenant data,
--   and there is effectively one lawyer today. Per-tenant scoping / a security-definer
--   review RPC (to lock down which columns the lawyer may write) are deferred — IMPROVEMENTS.
-- Executed: <fill on apply via Supabase SQL Editor>

-- ─── SELECT — lawyer reads the audit ──────────────────────────────────────────
DROP POLICY IF EXISTS law_change_log_select_authenticated ON public.law_change_log;
CREATE POLICY law_change_log_select_authenticated
  ON public.law_change_log
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── UPDATE — lawyer marks a change reviewed / dismissed ───────────────────────
DROP POLICY IF EXISTS law_change_log_update_authenticated ON public.law_change_log;
CREATE POLICY law_change_log_update_authenticated
  ON public.law_change_log
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Verification (run after applying) ────────────────────────────────────────
-- As the signed-in lawyer (authenticated):
--   SELECT id, law_slug, action FROM public.law_change_log ORDER BY detected_at DESC;  -- visible
--   INSERT INTO public.law_change_log (law_slug) VALUES ('x');                          -- blocked (no policy)
