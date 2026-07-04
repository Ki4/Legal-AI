-- Migration 032: resync services.id sequence — new-service creation was fully broken.
-- Context:
--   The `services` table predates the migrations dir (created via the Supabase dashboard,
--   so services.id is a plain INTEGER serial — see the note in 031). Several rows were
--   seeded with EXPLICIT ids (divorce=1, alimony=2, and the placeholder verticals
--   military=3 / business=4 / court_search=5) without advancing the owned sequence.
--   As a result the sequence's nextval still points inside the used range, so every
--   `INSERT INTO services` that omits id (which is exactly what the admin "Нова послуга"
--   flow does — ServiceEditPage.handleSave) fails with:
--       duplicate key value violates unique constraint "services_pkey"
--   i.e. a lawyer currently cannot create ANY new service from the admin panel.
--   Discovered live on 2026-07-04 while verifying the generation_mode fix.
--
-- Fix: fast-forward the owned sequence to MAX(id). Non-destructive — touches no rows,
--   only the sequence counter. pg_get_serial_sequence resolves the right sequence name
--   whether id is a classic serial or an IDENTITY column; guarded for the (unexpected)
--   case where the column owns no sequence.
--
-- Verify after apply:
--   SELECT nextval(pg_get_serial_sequence('public.services','id'));  -- expect MAX(id)+1

DO $$
DECLARE
  seq text := pg_get_serial_sequence('public.services', 'id');
BEGIN
  IF seq IS NOT NULL THEN
    PERFORM setval(seq, (SELECT COALESCE(MAX(id), 1) FROM public.services), true);
  ELSE
    RAISE NOTICE 'services.id owns no sequence — insert failure has a different cause; investigate.';
  END IF;
END $$;
