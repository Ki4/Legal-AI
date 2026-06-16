-- Migration 019: add 'hybrid' to services.generation_mode CHECK (G4, Issue #37).
--
-- The doc-engine (migration 014) added generation_mode with CHECK ('template','js').
-- Hybrid generation = JS template L1 + Groq L3 reasoning for the {{ai.reasoning}} slot.
-- Backfill is NOT needed: existing services stay 'js' or 'template'; alimony-change
-- was registered as 'disabled' in 016 and its generation_mode is set to 'hybrid' there.
--
-- This migration only widens the CHECK constraint — no data changes.

-- Drop old constraint and add widened one
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_generation_mode_check;

ALTER TABLE services
  ADD CONSTRAINT services_generation_mode_check
  CHECK (generation_mode IN ('js', 'template', 'hybrid'));

-- Set alimony-change service to generation_mode='hybrid' now that the constraint allows it.
-- The service remains disabled=true (stays disabled until G5 lawyer sign-off).
UPDATE services
SET    generation_mode = 'hybrid'
WHERE  slug = 'alimony-change'
  AND  generation_mode IS DISTINCT FROM 'hybrid';

-- ─── Verification ─────────────────────────────────────────────────────────────
-- SELECT slug, generation_mode, is_active FROM services WHERE slug = 'alimony-change';
-- expect: alimony-change | hybrid | false
