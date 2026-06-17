-- Track whether the hybrid AI pipeline abstained for each case.
-- NULL  = non-hybrid service (template / js mode)
-- false = hybrid pipeline ran and AI reasoning was accepted
-- true  = hybrid pipeline abstained (RED span detected or L3 parse failure)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS abstained BOOLEAN DEFAULT NULL;

-- Index for dashboard abstention rate queries (hybrid cases in last 30 days)
CREATE INDEX IF NOT EXISTS idx_cases_abstained_created_at
  ON cases (abstained, created_at)
  WHERE abstained IS NOT NULL;
