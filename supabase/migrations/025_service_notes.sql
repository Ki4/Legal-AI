-- Migration 025: service_notes — lawyer feedback on a service (service-mirror slice 2, #66).
-- Context:
--   The admin "Дзеркало послуги" (read-only) lets the lawyer SEE a service. Slice 2 adds
--   a feedback channel: the lawyer writes notes ("що добре / погано / незручно") per service;
--   the developer reads them (per-service panel + a global inbox) and acts. This is the
--   intake that turns "look at the mirror" into "tell us what's missing" → future builder.
-- Keyed by `slug` (services' stable natural key — see ON CONFLICT (slug) in 016) so a note
--   survives a service row re-create and reads human-friendly.
-- RLS: the lawyer authenticates as `authenticated` (anon key + session). SELECT/INSERT/UPDATE
--   for authenticated (read, create, mark resolved); DELETE stays policy-less → service_role
--   only. Blanket (not per-lawyer) — solo phase, one lawyer; per-tenant scoping deferred
--   (same tradeoff as migration 013 / law_change_log).
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

CREATE TABLE IF NOT EXISTS public.service_notes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_slug TEXT NOT NULL REFERENCES public.services(slug) ON DELETE CASCADE,
  author_email TEXT,
  body         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_notes_slug
  ON public.service_notes (service_slug, created_at DESC);

-- Inbox query "all open feedback" stays cheap.
CREATE INDEX IF NOT EXISTS idx_service_notes_open
  ON public.service_notes (created_at DESC) WHERE status = 'open';

ALTER TABLE public.service_notes ENABLE ROW LEVEL SECURITY;

-- ─── SELECT — lawyer/dev read notes ───────────────────────────────────────────
DROP POLICY IF EXISTS service_notes_select_authenticated ON public.service_notes;
CREATE POLICY service_notes_select_authenticated
  ON public.service_notes FOR SELECT TO authenticated USING (true);

-- ─── INSERT — lawyer adds a note ──────────────────────────────────────────────
DROP POLICY IF EXISTS service_notes_insert_authenticated ON public.service_notes;
CREATE POLICY service_notes_insert_authenticated
  ON public.service_notes FOR INSERT TO authenticated WITH CHECK (true);

-- ─── UPDATE — mark open ↔ done ────────────────────────────────────────────────
DROP POLICY IF EXISTS service_notes_update_authenticated ON public.service_notes;
CREATE POLICY service_notes_update_authenticated
  ON public.service_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── Verification (run after applying, as the signed-in lawyer) ────────────────
-- INSERT INTO public.service_notes (service_slug, author_email, body)
--   VALUES ('divorce', 'me@example.com', 'тест');                 -- ok
-- SELECT id, service_slug, status, body FROM public.service_notes; -- visible
-- DELETE FROM public.service_notes WHERE service_slug = 'divorce'; -- blocked (no policy)
