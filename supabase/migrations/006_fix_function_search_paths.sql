-- Migration 006: Fix Function Search Path Mutable warnings
-- Executed: 2026-03-25
-- Reason: Supabase Security Advisor warning "Function Search Path Mutable"
-- All public functions must have a fixed search_path to prevent search_path injection attacks.

ALTER FUNCTION public.get_law_versions     SET search_path = 'public';
ALTER FUNCTION public.search_law_text      SET search_path = 'public';
ALTER FUNCTION public.replace_law_chunks   SET search_path = 'public';
ALTER FUNCTION public.get_law_articles     SET search_path = 'public';
ALTER FUNCTION public.upsert_law_document  SET search_path = 'public';
ALTER FUNCTION public.search_law_chunks_hybrid SET search_path = 'public';
ALTER FUNCTION public.search_law_chunks    SET search_path = 'public';

-- Note: "Extension in Public" warning for public.vector (pgvector) is expected behavior
-- and does not require action — pgvector is intentionally installed in public schema.
