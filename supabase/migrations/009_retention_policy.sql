-- Migration 009: GDPR consent tracking + retention policy
-- 1. Add consented_at column to cases
-- 2. Auto-delete function for cases older than 90 days

-- Track when user consented to data processing
ALTER TABLE cases ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
COMMENT ON COLUMN cases.consented_at IS 'When user accepted privacy policy / data processing consent';

-- Update expires_at for existing cases (30 days → 90 days from creation)
UPDATE cases SET expires_at = created_at + INTERVAL '90 days' WHERE expires_at IS NOT NULL;

-- Function to delete expired cases
CREATE OR REPLACE FUNCTION delete_expired_cases()
RETURNS TABLE(deleted_count integer) AS $$
DECLARE
  cnt integer;
BEGIN
  DELETE FROM cases
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN QUERY SELECT cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role only (not anon/authenticated)
REVOKE ALL ON FUNCTION delete_expired_cases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_expired_cases() TO service_role;

COMMENT ON FUNCTION delete_expired_cases() IS 'GDPR retention: deletes cases older than 90 days. Call via n8n weekly cron or Supabase SQL Editor.';
