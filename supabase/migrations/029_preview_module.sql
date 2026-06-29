-- Migration 029: preview-module (#83) — preview/payment columns + private bucket.
-- Context:
--   Monetisation flow in the Mini App: submit → preview (safe HTML excerpt) →
--   pay (stub) → full document via a server-minted signed URL. The generated
--   full PDF is parked in a PRIVATE bucket; the signed URL is minted server-side
--   (n8n service_role) ONLY after payment is verified — the client is never
--   trusted with `paid` nor a storage key.
--
-- Status/excerpt delivery — DECISION (session 54): the client does NOT read
--   `cases` directly. `form-submit` is a synchronous webhook (it already runs the
--   whole pipeline and the TWA awaits its response); it now returns
--   { case_id, status, preview_excerpt } in that response. So:
--     • `cases` STAYS service_role-only — NO new anon/authenticated RLS policy.
--       (`cases` holds ENCRYPTED CLIENT PII; the public TWA uses the anon key with
--        NO Supabase Auth → there is no auth.uid() to scope an owner policy by, and
--        a blanket USING(true) would expose every client's case. So we add none.)
--     • The private bucket likewise gets NO anon/authenticated policy — only the
--       service_role (which bypasses RLS) uploads and mints signed URLs.
--
-- `status` ALREADY EXISTS on cases (today the Insert Case node writes 'submitted').
--   We REUSE that column for the preview lifecycle and DO NOT add a CHECK
--   constraint: the column has always been free-text and legacy rows carry
--   'submitted' (and possibly other historical values) — a CHECK would (and did)
--   fail on existing data. Canonical lifecycle the code writes from now on:
--     generating → preview_ready → paid → delivered   (| failed)
--   G3 changes the Insert Case default from 'submitted' to 'generating'.
--
-- Rate-limit: NO new column — the Validate node counts
--   `cases WHERE user_id = ? AND created_at > now() - 24h` against a node config
--   limit (requirements §2). `user_id` is the owner column on cases (the Telegram
--   id resolved via Get Profile), NOT profile_id.
--
-- NB: bucket `service-examples` (migration 026) is a DIFFERENT, lawyer-facing
--   bucket — do not conflate. The `protect_delete()` trigger on storage.objects
--   (see memory reference_supabase_storage) blocks DELETE → clean up generated
--   docs via the Storage API / Dashboard, not raw SQL.
-- Idempotent: safe to re-run (IF NOT EXISTS / ON CONFLICT throughout).
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

-- ─── cases: preview / payment state ────────────────────────────────────────────
-- `status` already exists (reused — see note above); add only the new columns.
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS paid              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS preview_excerpt   TEXT;          -- safe excerpt (NO ПРОШУ / citations)
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS doc_storage_path  TEXT;          -- path in private `generated-documents` bucket
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS preview_meta      JSONB;         -- { page_count, service_slug } for UI

-- No CHECK on status: it is intentionally free-text (legacy rows hold 'submitted').

-- Rate-limit query "N cases for this user in the last 24h" stays cheap.
CREATE INDEX IF NOT EXISTS idx_cases_user_created
  ON public.cases (user_id, created_at DESC);

-- cases RLS: already ENABLED + service_role-only since migration 005. We add NO
-- client policy here (see DECISION above). The client can neither set `paid`/
-- `status` nor read other cases — exactly the invariant we want.

-- ─── Private Storage bucket for the generated full document ─────────────────────
-- public=false: objects reachable ONLY via a signed URL minted by the service_role
--   after payment. PDF only (DOCX, if delivered, goes as a bot file — A5). 10 MB cap.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-documents',
  'generated-documents',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: intentionally NO anon/authenticated policy on this bucket → only
--   the service_role (n8n) may upload and createSignedUrl. RLS is already enabled
--   on storage.objects (migration 026); without a matching policy, anon/authenticated
--   are denied, which is the goal (private, server-mediated access only).

-- ─── Verification (run after applying) ─────────────────────────────────────────
-- As service_role:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='cases' AND column_name IN
--       ('status','paid','paid_at','preview_excerpt','doc_storage_path','preview_meta');  -- 6 rows
--   SELECT id, public FROM storage.buckets WHERE id='generated-documents';                 -- public=false
-- As anon (TWA key): a SELECT on cases / a GET of a generated-documents object → denied.
