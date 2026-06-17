-- Required-clause checklist validator (issue #4 / IMPROVEMENTS #39).
-- Deterministic post-render check, no LLM — see specs/features/checklist-validator/.

-- SSoT: n8n/templates/services/<slug>.checklist.json in git; upload via
-- scripts/upload-document-checklist.mjs. Empty '{}' = no checklist configured,
-- Build Document footer skips validation entirely (no behavior change until
-- a checklist is uploaded for a service).
ALTER TABLE services ADD COLUMN IF NOT EXISTS required_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN services.required_checklist IS
  'Required-clause checklist ({slug, items: [{id, description, appliesIf, mustMatchAny}]}). SSoT: n8n/templates/services/<slug>.checklist.json in git; upload via scripts/upload-document-checklist.mjs. Empty object = validation skipped.';

-- Whether the checklist validator found at least one missing applicable item.
-- NULL  = no checklist configured for this service (required_checklist empty)
-- false = checklist configured, all applicable items satisfied
-- true  = checklist configured, at least one applicable item missing
ALTER TABLE cases ADD COLUMN IF NOT EXISTS checklist_failed BOOLEAN DEFAULT NULL;

-- Index for dashboard checklist-failure queries (cases in last 30 days)
CREATE INDEX IF NOT EXISTS idx_cases_checklist_failed_created_at
  ON cases (checklist_failed, created_at)
  WHERE checklist_failed IS NOT NULL;
