-- ============================================================
-- Migration 003: law_documents + повний текст + FTS
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. law_documents — повний текст кожного закону
--    Для перегляду юристом і пошуку по всьому тексту
-- ============================================================
CREATE TABLE IF NOT EXISTS law_documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  law_code         text        NOT NULL UNIQUE,   -- '2947-14'
  law_title        text        NOT NULL,           -- 'Сімейний кодекс України'
  source_type      text        NOT NULL DEFAULT 'code',
  authority_weight int         NOT NULL DEFAULT 5,

  -- Повний текст закону (stripped HTML, всі статті)
  full_text        text        NOT NULL DEFAULT '',

  -- Версія
  law_version_date date        NOT NULL,
  is_stale         boolean     NOT NULL DEFAULT false,

  -- Статистика
  article_count    int         NOT NULL DEFAULT 0,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- FTS індекс для пошуку по всьому тексту закону
-- 'simple' — без stemming (підходить для юридичних термінів і власних назв)
ALTER TABLE law_documents
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(full_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS law_documents_fts_idx
  ON law_documents USING gin(fts);

CREATE INDEX IF NOT EXISTS law_documents_code_idx
  ON law_documents (law_code);

-- ============================================================
-- 2. law_chunks — додати full_content та FTS
-- ============================================================

-- full_content = повний текст статті БЕЗ обрізки до 4000 символів
-- content залишається для ембедингу (обрізаний до 4000)
ALTER TABLE law_chunks
  ADD COLUMN IF NOT EXISTS full_content text;

-- FTS на рівні статті
ALTER TABLE law_chunks
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple', coalesce(full_content, content, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS law_chunks_fts_idx
  ON law_chunks USING gin(fts);

-- ============================================================
-- 3. RPC: search_law_chunks_hybrid — vector + keyword combined
--    Використовується при генерації документу в n8n
-- ============================================================
CREATE OR REPLACE FUNCTION search_law_chunks_hybrid(
  query_embedding  halfvec(3072),
  query_text       text,           -- raw text query для keyword пошуку
  target_service   text,
  match_count      int DEFAULT 5,
  vector_weight    float DEFAULT 0.7,  -- скільки важить семантика
  text_weight      float DEFAULT 0.3   -- скільки важить keyword match
)
RETURNS TABLE (
  id               uuid,
  law_title        text,
  article_num      text,
  article_title    text,
  full_content     text,
  source_type      text,
  authority_weight int,
  similarity       float,
  match_type       text   -- 'vector', 'keyword', 'hybrid'
)
LANGUAGE sql
STABLE
AS $$
  WITH
  -- Векторний пошук (семантика)
  vector_matches AS (
    SELECT
      id,
      1 - (embedding <=> query_embedding) AS vec_score
    FROM law_chunks
    WHERE service_slugs @> ARRAY[target_service]
      AND is_stale = false
      AND embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  -- Keyword пошук (FTS)
  text_matches AS (
    SELECT
      id,
      ts_rank(fts, plainto_tsquery('simple', query_text)) AS txt_score
    FROM law_chunks
    WHERE service_slugs @> ARRAY[target_service]
      AND is_stale = false
      AND fts @@ plainto_tsquery('simple', query_text)
    LIMIT match_count * 3
  ),
  -- Об'єднуємо з RRF-подібним злиттям
  combined AS (
    SELECT
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.vec_score, 0) * vector_weight
        + COALESCE(t.txt_score, 0) * text_weight AS combined_score,
      CASE
        WHEN v.id IS NOT NULL AND t.id IS NOT NULL THEN 'hybrid'
        WHEN v.id IS NOT NULL THEN 'vector'
        ELSE 'keyword'
      END AS match_type
    FROM vector_matches v
    FULL OUTER JOIN text_matches t ON v.id = t.id
  )
  SELECT
    c.id,
    lc.law_title,
    lc.article_num,
    lc.article_title,
    COALESCE(lc.full_content, lc.content) AS full_content,
    lc.source_type,
    lc.authority_weight,
    c.combined_score * lc.authority_weight AS similarity,
    c.match_type
  FROM combined c
  JOIN law_chunks lc ON lc.id = c.id
  ORDER BY c.combined_score * lc.authority_weight DESC
  LIMIT match_count;
$$;

-- ============================================================
-- 4. RPC: search_law_text — пошук по повному тексту закону
--    Для адмін-панелі: юрист шукає статтю за ключовим словом
-- ============================================================
CREATE OR REPLACE FUNCTION search_law_text(
  query_text       text,
  target_service   text DEFAULT NULL,  -- NULL = шукати по всіх законах
  match_count      int  DEFAULT 20
)
RETURNS TABLE (
  law_code         text,
  law_title        text,
  article_num      text,
  article_title    text,
  full_content     text,
  source_type      text,
  rank             float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    lc.law_code,
    lc.law_title,
    lc.article_num,
    lc.article_title,
    COALESCE(lc.full_content, lc.content) AS full_content,
    lc.source_type,
    ts_rank(lc.fts, plainto_tsquery('simple', query_text)) AS rank
  FROM law_chunks lc
  WHERE lc.fts @@ plainto_tsquery('simple', query_text)
    AND lc.is_stale = false
    AND (target_service IS NULL OR lc.service_slugs @> ARRAY[target_service])
  ORDER BY ts_rank(lc.fts, plainto_tsquery('simple', query_text)) * lc.authority_weight DESC
  LIMIT match_count;
$$;

-- ============================================================
-- 5. RPC: get_law_articles — всі статті одного закону
--    Для адмін-панелі: юрист переглядає закон повністю
-- ============================================================
CREATE OR REPLACE FUNCTION get_law_articles(
  p_law_code  text
)
RETURNS TABLE (
  article_num      text,
  article_title    text,
  full_content     text,
  law_title        text,
  law_version_date date
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    article_num,
    article_title,
    COALESCE(full_content, content) AS full_content,
    law_title,
    law_version_date
  FROM law_chunks
  WHERE law_code = p_law_code
    AND is_stale = false
  ORDER BY
    -- Сортуємо за номером статті (як число)
    (regexp_replace(article_num, '[^0-9]', '', 'g'))::int;
$$;

-- ============================================================
-- 6. Оновити replace_law_chunks — додати full_content
-- ============================================================
CREATE OR REPLACE FUNCTION replace_law_chunks(
  p_law_code    text,
  p_chunks      jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted  int;
  v_inserted int;
BEGIN
  DELETE FROM law_chunks WHERE law_code = p_law_code;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO law_chunks (
    source_type, law_code, law_title,
    article_num, article_title, content, full_content,
    authority_weight, service_slugs,
    law_version_date, embedding
  )
  SELECT
    COALESCE(chunk->>'source_type', 'code'),
    p_law_code,
    chunk->>'law_title',
    chunk->>'article_num',
    chunk->>'article_title',
    chunk->>'content',           -- обрізаний до 4000 (для ембедингу)
    chunk->>'full_content',      -- повний текст без обрізки
    COALESCE((chunk->>'authority_weight')::int, 5),
    ARRAY(SELECT jsonb_array_elements_text(chunk->'service_slugs')),
    (chunk->>'law_version_date')::date,
    (chunk->>'embedding')::halfvec
  FROM jsonb_array_elements(p_chunks) AS chunk;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'inserted', v_inserted,
    'law_code', p_law_code
  );
END;
$$;

-- ============================================================
-- 7. RPC: upsert_law_document — зберегти повний текст закону
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_law_document(
  p_law_code        text,
  p_law_title       text,
  p_source_type     text,
  p_authority_weight int,
  p_full_text       text,
  p_version_date    date,
  p_article_count   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO law_documents (
    law_code, law_title, source_type, authority_weight,
    full_text, law_version_date, article_count
  )
  VALUES (
    p_law_code, p_law_title, p_source_type, p_authority_weight,
    p_full_text, p_version_date, p_article_count
  )
  ON CONFLICT (law_code) DO UPDATE SET
    law_title        = EXCLUDED.law_title,
    full_text        = EXCLUDED.full_text,
    law_version_date = EXCLUDED.law_version_date,
    article_count    = EXCLUDED.article_count,
    is_stale         = false,
    updated_at       = now();
END;
$$;
