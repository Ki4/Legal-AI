-- Migration 012: Make services.status the single source of truth for serving.
-- Context:
--   The admin panel wrote services.is_published (boolean), but the whole serving
--   path (n8n form-submit/main-bot guards + TWA App.tsx) reads services.status
--   (active|needs_review|disabled, migration 011). The two were disconnected: a
--   lawyer "publishing" a service set is_published=true while status stayed
--   'disabled' → the toggle published nothing. This migration converges on status.
-- What this does:
--   1. Reconcile is_published once so it mirrors (status = 'active').
--   2. Mark is_published DEPRECATED. status is now authoritative. The column is
--      KEPT (not dropped) so this change is reversible; a later migration drops it
--      once we are confident no reader remains. The admin panel keeps is_published
--      coherent on save (mirror of status='active') during the deprecation window.
-- Executed: 2026-06-10 via Supabase SQL Editor (verified: is_published mirrors
--   status — divorce/alimony=active→true, placeholders=disabled→false)

-- ─── Reconcile the deprecated boolean to the authoritative status ──────────────
UPDATE public.services
SET is_published = (status = 'active');

COMMENT ON COLUMN public.services.is_published IS
  'DEPRECATED (migration 012) — use services.status instead. Kept as a coherent mirror of (status = ''active'') during the deprecation window; nothing on the serving path reads it. Drop in a future migration.';

-- ─── Verification (run after applying) ─────────────────────────────────────────
-- SELECT slug, status, is_published FROM public.services ORDER BY slug;
--   expect: is_published = true  WHERE status = 'active'   (divorce, alimony)
--           is_published = false WHERE status <> 'active'  (placeholders)
