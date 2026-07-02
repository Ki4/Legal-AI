-- Migration 030: services.category — group services by legal vertical in the admin catalog.
-- Context:
--   The "Мої послуги" catalog is a flat grid. As we scale beyond family law (medical vertical,
--   M1+), the lawyer needs to group and filter services by category. `category` is a soft text
--   key whose allowed values live in code (apps/client/src/lib/serviceCategories.ts) — NOT a DB
--   enum/CHECK, so adding a new vertical is a one-line code change and never breaks inserts.
--   NULL = uncategorised (rendered in a "Без категорії" group at the bottom of the catalog).
--   Existing services are backfilled to 'family' (Сімейне право) — divorce + alimony are all
--   family-law today. Client TWA catalog will read this later; for now it is admin-only.
-- RLS: unchanged — additive nullable column is covered by existing services policies.
-- Executed: <fill on apply via Supabase SQL Editor / supabase db push>

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.services.category IS
  'Legal-vertical grouping key (values in code: serviceCategories.ts). NULL = uncategorised.';

-- Backfill: everything that exists today is family law.
UPDATE public.services
  SET category = 'family'
  WHERE category IS NULL;

-- ─── Verification (run after applying, as the signed-in lawyer) ────────────────
-- SELECT slug, title, category FROM public.services ORDER BY category, title;
--   → divorce/alimony rows should show category = 'family'.
