-- Migration 005: Enable RLS on all tables
-- Executed: 2026-03-23 via Supabase SQL Editor
-- Strategy:
--   cases, identities      → blocked for anon (only service_role, used by n8n)
--   law_chunks, law_docs   → SELECT public (read-only legal data)
--   services, courts,
--   lawyers                → SELECT public (read-only reference data)
-- Note: n8n uses service_role key → bypasses RLS, workflow unaffected.
-- Note: user-level RLS (user_id = auth.uid()) requires Supabase Auth → future session.

-- 1. CASES — personal encrypted data, service_role only
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- 2. IDENTITIES — Telegram IDs, service_role only
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;

-- 3. LAW_CHUNKS — public legal data, read-only
ALTER TABLE law_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "law_chunks_public_read" ON law_chunks
  FOR SELECT TO anon, authenticated USING (true);

-- 4. LAW_DOCUMENTS — public legal data, read-only
ALTER TABLE law_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "law_documents_public_read" ON law_documents
  FOR SELECT TO anon, authenticated USING (true);

-- 5. SERVICES — service configs, read-only
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read" ON services
  FOR SELECT TO anon, authenticated USING (true);

-- 6. COURTS — court directory, read-only
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courts_public_read" ON courts
  FOR SELECT TO anon, authenticated USING (true);

-- 7. LAWYERS — lawyer directory, read-only
ALTER TABLE lawyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lawyers_public_read" ON lawyers
  FOR SELECT TO anon, authenticated USING (true);

-- TODO (after Supabase Auth implementation):
-- CREATE POLICY "users_own_cases" ON cases
--   FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY "lawyers_own_services" ON services
--   FOR ALL USING (lawyer_id = auth.uid() OR lawyer_id IS NULL);
