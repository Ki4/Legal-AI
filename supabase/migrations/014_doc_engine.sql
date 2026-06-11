-- Migration 014: doc-engine — service-agnostic document generation (Issue #34).
-- Context:
--   Document content lived ONLY in hardcoded JS builders inside the n8n
--   "Build Document" node (divorce/alimony, dispatch by slug) — a lawyer could
--   not add a service or edit a document's wording without a dev session.
--   The doc-engine feature splits CODE (one shared render engine,
--   n8n/templates/render-document.js) from CONTENT (a declarative template per
--   service) — mirroring the proven DynamicLegalFormBuilder + form_config pair.
-- What this does:
--   1. services.generation_mode — which generation path Build Document takes:
--        'js'       — legacy hardcoded builder (divorce, alimony initially)
--        'template' — render services.document_template via the shared engine
--      Future modes (hybrid, ai_generate) get added by a separate migration
--      when they are actually implemented — the CHECK stays honest.
--   2. services.document_template — the declarative template (DSL: {{field}},
--      {{#if}}, {{#each}}, helpers; contract in specs/features/doc-engine/).
--      SSoT is the git file n8n/templates/services/<slug>.document.txt; the DB
--      holds the runtime copy (uploaded via scripts/upload-document-template.mjs).
--   3. Backfill everything to 'js' — applying this migration changes NOTHING
--      in behavior. Flipping a service to 'template' is a separate, instantly
--      reversible column update done only after live verification (same
--      pattern as the status kill-switch).
-- Executed: pending (apply via Supabase SQL Editor)

-- ─── 1+2. New columns ──────────────────────────────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'js'
    CHECK (generation_mode IN ('js', 'template')),
  ADD COLUMN IF NOT EXISTS document_template TEXT NULL;

COMMENT ON COLUMN public.services.generation_mode IS
  'Document generation path in n8n Build Document: ''js'' = legacy hardcoded builder; ''template'' = render document_template via the shared engine (doc-engine, #34). Flip is the rollout/rollback switch — no deploy needed.';

COMMENT ON COLUMN public.services.document_template IS
  'Declarative document template (doc-engine DSL). SSoT: n8n/templates/services/<slug>.document.txt in git; upload via scripts/upload-document-template.mjs. Used only when generation_mode = ''template''.';

-- ─── 3. Backfill (explicit, even though DEFAULT covers it) ─────────────────────
UPDATE public.services SET generation_mode = 'js' WHERE generation_mode IS NULL;

-- ─── Verification (run after applying) ─────────────────────────────────────────
-- SELECT slug, generation_mode, (document_template IS NOT NULL) AS has_template
-- FROM public.services ORDER BY slug;
--   expect: every row generation_mode = 'js', has_template = false
