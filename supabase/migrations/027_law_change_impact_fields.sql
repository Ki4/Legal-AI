-- Migration 027: law-change-impact — AI "what changed" draft fields on law_change_log.
-- Feature: specs/features/law-change-impact/ (Tier 2).
-- Purpose:
--   Extend the append-only law_change_log audit (migration 011) with two layers:
--     1. article_diffs — DETERMINISTIC revision diff, snapshot by the Node monitor at detect
--        time (before law_chunks/law_documents are flagged is_stale). Ground truth, no LLM;
--        shown to the lawyer even when the agent abstains.
--     2. ai_* columns — the PRELIMINARY agent draft ("що змінилось" + per-service impact),
--        written later by the n8n law-change-digest workflow. NULL until the digest runs and
--        NULL forever when the agent abstains. The lawyer's `notes` (migration 011) stays the
--        human source of truth — the agent NEVER writes `notes`.
-- Safety: additive only (ADD COLUMN IF NOT EXISTS); all nullable except ai_status (default
--   'pending'). Existing rows are untouched and keep working exactly as before; the digest
--   simply has nothing to write until these columns exist. Fully reversible.
-- RLS: inherits law_change_log policies (migration 011/013) — service_role writes (n8n),
--   authenticated reads (lawyer). Column-scoped write restriction is deferred (IMPROVEMENTS).
-- Executed: <fill on apply via Supabase SQL Editor>

-- ─── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.law_change_log
  ADD COLUMN IF NOT EXISTS article_diffs   jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary      text,
  ADD COLUMN IF NOT EXISTS ai_impact       jsonb,
  ADD COLUMN IF NOT EXISTS ai_confidence   real,
  ADD COLUMN IF NOT EXISTS ai_status       text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_model        text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz;

-- Lifecycle of the agent draft, INDEPENDENT of the lawyer's `action`:
--   pending   = monitor wrote the deterministic diff; digest hasn't run yet
--   drafted   = digest produced an ai_summary + ai_impact
--   abstained = digest ran but withheld a draft (low confidence / failed critics) → diff only
--   error     = digest failed; the deterministic diff still stands
ALTER TABLE public.law_change_log
  DROP CONSTRAINT IF EXISTS law_change_log_ai_status_check;
ALTER TABLE public.law_change_log
  ADD CONSTRAINT law_change_log_ai_status_check
    CHECK (ai_status IN ('pending', 'drafted', 'abstained', 'error'));

COMMENT ON COLUMN public.law_change_log.article_diffs IS
  'Deterministic revision diff (L1), snapshot at detect time before is_stale. Ground truth shown to the lawyer even when the AI abstains. No LLM.';
COMMENT ON COLUMN public.law_change_log.ai_summary IS
  'Preliminary AI plain-language "what changed" draft (L3). NULL until the digest runs / when abstained. Advisory — the lawyer edits notes, not this.';
COMMENT ON COLUMN public.law_change_log.ai_impact IS
  'Preliminary per-service impact hypotheses (L3): [{slug, severity, confidence, articles[], hypothesis, evidence}].';
COMMENT ON COLUMN public.law_change_log.ai_status IS
  'Agent draft lifecycle: pending|drafted|abstained|error. Independent of the lawyer action (flagged|reviewed|dismissed).';

-- ─── 2. Pending-queue index ───────────────────────────────────────────────────
-- The digest polls "what needs an AI draft" by this column → a small partial index.
CREATE INDEX IF NOT EXISTS law_change_log_ai_status_idx
  ON public.law_change_log (ai_status)
  WHERE ai_status = 'pending';

-- ─── Verification (run after applying) ────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'law_change_log'
--     AND (column_name = 'article_diffs' OR column_name LIKE 'ai_%')
--   ORDER BY column_name;
--   expect: ai_confidence(real), ai_generated_at(timestamptz), ai_impact(jsonb),
--           ai_model(text), ai_status(text), ai_summary(text), article_diffs(jsonb)
-- Existing rows pick up the default:
-- SELECT id, ai_status FROM public.law_change_log;   -- all 'pending' (skipped: no article_diffs)
