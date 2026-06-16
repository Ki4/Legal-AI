-- Migration 017: law_relations — граф юридичних зв'язків (G2, Issue #37).
--
-- Creates the law_relations table for GraphRAG: explicit legal edges between
-- law_chunks rows (requires / exception_if / overrides / clarifies / references).
-- Also adds upsert_law_chunk RPC — a non-destructive per-article alternative to
-- replace_law_chunks that merges service_slugs instead of wiping the whole law.
--
-- Companion seeding script: scripts/seed-alimony-change-laws.mjs
-- Reference:               docs/architecture/GRAPHRAG-GUIDE.md

-- ─── law_relations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS law_relations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  from_chunk_id uuid        NOT NULL REFERENCES law_chunks(id) ON DELETE CASCADE,
  to_chunk_id   uuid        NOT NULL REFERENCES law_chunks(id) ON DELETE CASCADE,

  relation_type text        NOT NULL CHECK (relation_type IN (
    'requires',       -- A не діє без B (процедурна вимога)
    'exception_if',   -- якщо умова → застосовується B замість/разом з A
    'overrides',      -- B скасовує або замінює A
    'clarifies',      -- B пояснює або деталізує A
    'references'      -- м'яке посилання (A згадує B)
  )),

  -- Human-readable condition text for exception_if edges.
  -- Use machine-checkable format where possible:
  --   "change_direction == 'increase'"
  --   "has_children == true"
  condition     text,

  confidence    float       NOT NULL DEFAULT 1.0,  -- 0–1; < 1 for AI-extracted edges
  note          text,                              -- юридичний коментар
  verified_by   text,                              -- email юриста або 'auto'
  verified_at   timestamptz,
  created_by    text        NOT NULL DEFAULT 'auto',
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT law_relations_unique UNIQUE (from_chunk_id, to_chunk_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_law_relations_from
  ON law_relations (from_chunk_id);

CREATE INDEX IF NOT EXISTS idx_law_relations_to
  ON law_relations (to_chunk_id);

CREATE INDEX IF NOT EXISTS idx_law_relations_verified
  ON law_relations (verified_by)
  WHERE verified_by IS NOT NULL;

-- ─── upsert_law_chunk ─────────────────────────────────────────────────────────
-- Non-destructive alternative to replace_law_chunks:
-- - INSERT new article if (law_code, article_num) doesn't exist.
-- - On conflict: merge service_slugs (union, no duplicates), update content
--   and law_version_date if the incoming version is equal or newer.
-- Returns the chunk's uuid.

CREATE OR REPLACE FUNCTION upsert_law_chunk(p_chunk jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO law_chunks (
    source_type,
    law_code,
    law_title,
    article_num,
    article_title,
    content,
    authority_weight,
    service_slugs,
    law_version_date,
    embedding
  ) VALUES (
    COALESCE(p_chunk->>'source_type', 'code'),
    p_chunk->>'law_code',
    p_chunk->>'law_title',
    p_chunk->>'article_num',
    p_chunk->>'article_title',
    p_chunk->>'content',
    COALESCE((p_chunk->>'authority_weight')::int, 5),
    ARRAY(SELECT jsonb_array_elements_text(p_chunk->'service_slugs')),
    (p_chunk->>'law_version_date')::date,
    -- embedding may be null; filled later by the Gemini seeding script
    CASE WHEN p_chunk->>'embedding' IS NULL THEN NULL
         ELSE (p_chunk->>'embedding')::halfvec
    END
  )
  ON CONFLICT (law_code, article_num) DO UPDATE SET
    -- Merge service_slugs: union of existing + incoming, deduped, sorted
    service_slugs    = ARRAY(
      SELECT DISTINCT s ORDER BY s
      FROM unnest(law_chunks.service_slugs || ARRAY(
        SELECT jsonb_array_elements_text(p_chunk->'service_slugs')
      )) AS s
    ),
    -- Update content and date only if incoming version is same or newer
    content          = CASE
      WHEN (p_chunk->>'law_version_date')::date >= law_chunks.law_version_date
      THEN p_chunk->>'content'
      ELSE law_chunks.content
    END,
    article_title    = CASE
      WHEN (p_chunk->>'law_version_date')::date >= law_chunks.law_version_date
      THEN p_chunk->>'article_title'
      ELSE law_chunks.article_title
    END,
    law_version_date = GREATEST(law_chunks.law_version_date,
                                (p_chunk->>'law_version_date')::date),
    -- Overwrite embedding only if a new one is provided
    embedding        = CASE
      WHEN p_chunk->>'embedding' IS NOT NULL
      THEN (p_chunk->>'embedding')::halfvec
      ELSE law_chunks.embedding
    END,
    updated_at       = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── upsert_law_relation ──────────────────────────────────────────────────────
-- Insert or update a law_relations edge by the natural key.
-- Returns the relation's uuid.

CREATE OR REPLACE FUNCTION upsert_law_relation(p_relation jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO law_relations (
    from_chunk_id,
    to_chunk_id,
    relation_type,
    condition,
    confidence,
    note,
    verified_by,
    verified_at,
    created_by
  ) VALUES (
    (p_relation->>'from_chunk_id')::uuid,
    (p_relation->>'to_chunk_id')::uuid,
    p_relation->>'relation_type',
    p_relation->>'condition',
    COALESCE((p_relation->>'confidence')::float, 1.0),
    p_relation->>'note',
    p_relation->>'verified_by',
    CASE WHEN p_relation->>'verified_at' IS NOT NULL
         THEN (p_relation->>'verified_at')::timestamptz
         ELSE NULL
    END,
    COALESCE(p_relation->>'created_by', 'auto')
  )
  ON CONFLICT (from_chunk_id, to_chunk_id, relation_type) DO UPDATE SET
    condition    = COALESCE(EXCLUDED.condition,    law_relations.condition),
    confidence   = GREATEST(EXCLUDED.confidence,   law_relations.confidence),
    note         = COALESCE(EXCLUDED.note,         law_relations.note),
    verified_by  = COALESCE(EXCLUDED.verified_by,  law_relations.verified_by),
    verified_at  = COALESCE(EXCLUDED.verified_at,  law_relations.verified_at)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ─── Verification ─────────────────────────────────────────────────────────────
-- SELECT count(*) FROM law_relations;                  -- expect 0 before seeding
-- SELECT * FROM law_relations LIMIT 5;                 -- after: see alimony-change edges
-- SELECT id FROM law_chunks WHERE law_code='2947-14' AND article_num='Стаття 192';
