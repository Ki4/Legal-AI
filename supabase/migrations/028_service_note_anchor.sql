-- Migration 028: service_notes.anchor — pin a lawyer note to a zone on the service mirror.
-- Context:
--   "Залишити коментар" on the service view (/services/:slug) lets the reviewer drag a
--   rectangle over any part of the page and attach a note to that zone. The note is the same
--   service_notes row as a plain comment; `anchor` just records WHERE on the page it points.
--   Stored as fractions of the content box (x, y, w, h ∈ [0,1]) so the highlight survives
--   different viewport widths — no absolute pixels. NULL anchor = a plain (un-pinned) comment,
--   so existing rows and the bottom feedback list keep working unchanged.
-- RLS: unchanged — the existing authenticated SELECT/INSERT/UPDATE policies (025) already
--   cover the new column; an additive nullable column needs no new policy.
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

ALTER TABLE public.service_notes
  ADD COLUMN IF NOT EXISTS anchor jsonb;

COMMENT ON COLUMN public.service_notes.anchor IS
  'Optional page zone the note points to: {x,y,w,h} as fractions [0,1] of the content box. NULL = plain comment.';

-- ─── Verification (run after applying, as the signed-in lawyer) ────────────────
-- INSERT INTO public.service_notes (service_slug, author_email, body, anchor)
--   VALUES ('divorce', 'me@example.com', 'тут бракує поля',
--           '{"x":0.1,"y":0.2,"w":0.3,"h":0.05}'::jsonb);          -- ok
-- SELECT id, service_slug, anchor FROM public.service_notes WHERE anchor IS NOT NULL;
