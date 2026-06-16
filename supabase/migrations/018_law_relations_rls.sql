-- Migration 018: RLS for law_relations (G2, Issue #37).
-- Applied manually in Supabase SQL Editor after migration 017.
-- Pattern mirrors law_chunks (005_enable_rls.sql): public read, no direct writes.
-- Writes go exclusively through upsert_law_relation() RPC (SECURITY DEFINER,
-- EXECUTE granted only to service_role in migration 017).

ALTER TABLE law_relations ENABLE ROW LEVEL SECURITY;

-- Public read: graph edges are non-sensitive legal metadata (same as law_chunks).
-- GraphRAG queries run via n8n service_role key → bypass RLS anyway,
-- but this policy enables direct SELECT from authenticated admin panels.
CREATE POLICY "law_relations_public_read" ON law_relations
  FOR SELECT TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policy → blocked for all non-service_role callers.
-- service_role key (n8n, seeding scripts) bypasses RLS entirely.
