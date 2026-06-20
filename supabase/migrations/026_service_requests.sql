-- Migration 026: service_requests + service-examples Storage bucket
--   (service-mirror slice 3, #66).
-- Context:
--   Slice 1 let the lawyer SEE a service (read-only mirror); slice 2 added per-service
--   feedback (service_notes). Slice 3 closes the intake loop: the lawyer can request a
--   NEW service the catalog doesn't have yet — a title, a description, the laws it leans on,
--   and (the real brief) an EXAMPLE document they upload. The dev reads the inbox and, from
--   these concrete examples, learns the patterns that will later drive the builder.
-- The example file is a TEMPLATE sample written by the lawyer — NOT client PII (unlike
--   `cases`, which we never touch). It lives in a PRIVATE bucket, reachable only by an
--   authenticated session via a short-lived signed URL.
-- RLS mirrors migration 025 / 013: SELECT/INSERT/UPDATE for `authenticated`
--   (create a request, read the inbox, mark it done); DELETE stays policy-less → service_role
--   only. Blanket (not per-lawyer) — solo phase, one lawyer.
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

-- ─── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_requests (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  laws_text         TEXT,                       -- free text: relevant articles / links
  example_file_path TEXT,                       -- object path in the `service-examples` bucket
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  requested_by_email TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inbox query "all open requests" stays cheap.
CREATE INDEX IF NOT EXISTS idx_service_requests_open
  ON public.service_requests (created_at DESC) WHERE status = 'open';

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- SELECT — lawyer/dev read the inbox
DROP POLICY IF EXISTS service_requests_select_authenticated ON public.service_requests;
CREATE POLICY service_requests_select_authenticated
  ON public.service_requests FOR SELECT TO authenticated USING (true);

-- INSERT — lawyer files a request
DROP POLICY IF EXISTS service_requests_insert_authenticated ON public.service_requests;
CREATE POLICY service_requests_insert_authenticated
  ON public.service_requests FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE — mark open ↔ done
DROP POLICY IF EXISTS service_requests_update_authenticated ON public.service_requests;
CREATE POLICY service_requests_update_authenticated
  ON public.service_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── Private Storage bucket for example documents ──────────────────────────────
-- Private (public=false): objects are reachable only via a signed URL minted by an
--   authenticated session. 10 MB cap; PDF + DOC/DOCX only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-examples',
  'service-examples',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: only authenticated users may upload to / read from this bucket.
DROP POLICY IF EXISTS service_examples_insert ON storage.objects;
CREATE POLICY service_examples_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-examples');

DROP POLICY IF EXISTS service_examples_select ON storage.objects;
CREATE POLICY service_examples_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-examples');

-- ─── Verification (run after applying, as the signed-in lawyer) ────────────────
-- INSERT INTO public.service_requests (title, description, requested_by_email)
--   VALUES ('Поділ майна', 'Потрібен позов про поділ', 'me@example.com');     -- ok
-- SELECT id, title, status FROM public.service_requests;                       -- visible
-- DELETE FROM public.service_requests WHERE title = 'Поділ майна';             -- blocked
