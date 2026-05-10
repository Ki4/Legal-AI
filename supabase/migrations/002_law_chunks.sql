-- ============================================================
-- Migration 002: law_chunks — векторна база юридичних джерел
-- Run in Supabase SQL Editor
-- ============================================================

-- Увімкнути pgvector (якщо ще не увімкнено)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Таблиця law_chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS law_chunks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Джерело
  source_type      text        NOT NULL DEFAULT 'code',
  -- 'code'          — кодекс (СК, ЦПК, ЦК, ГК)
  -- 'law'           — закон України
  -- 'regulation'    — постанова КМУ, указ Президента
  -- 'court'         — рішення Верховного Суду
  -- 'clarification' — лист міністерства, роз'яснення

  law_code         text        NOT NULL,   -- '2947-14'
  law_title        text        NOT NULL,   -- 'Сімейний кодекс України'
  article_num      text        NOT NULL,   -- 'Стаття 110'
  article_title    text,                   -- 'Право на пред'явлення позову...'
  content          text        NOT NULL,   -- повний текст статті

  -- Пріоритет при ранжуванні: code=5, law=4, regulation=3, court=2, clarification=1
  authority_weight int         NOT NULL DEFAULT 5,

  -- Прив'язка до послуг (масив slugів)
  service_slugs    text[]      NOT NULL DEFAULT '{}',
  -- Приклад: ARRAY['divorce', 'alimony']

  -- Версіонування — для моніторингу змін
  law_version_date date        NOT NULL,
  is_stale         boolean     NOT NULL DEFAULT false,

  -- halfvec(3072) = Gemini Embedding 2 (gemini-embedding-exp-03-07)
  -- halfvec = 16-bit float замість 32-bit → вдвічі менше місця, майже та сама точність
  -- ivfflat/hnsw підтримує до 4000 вимірів для halfvec (vs 2000 для vector)
  embedding        halfvec(3072),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT law_chunks_unique UNIQUE (law_code, article_num)
);

-- Індекс HNSW для векторного пошуку
-- hnsw = краща точність ніж ivfflat, підходить для < 1M рядків
-- halfvec_cosine_ops = косинусна схожість для halfvec типу
CREATE INDEX IF NOT EXISTS law_chunks_embedding_idx
  ON law_chunks USING hnsw (embedding halfvec_cosine_ops);

-- Індекс для швидкої фільтрації за послугою
CREATE INDEX IF NOT EXISTS law_chunks_service_slugs_idx
  ON law_chunks USING gin (service_slugs);

-- Індекс для перевірки версій (моніторинг змін)
CREATE INDEX IF NOT EXISTS law_chunks_version_idx
  ON law_chunks (law_code, law_version_date);

-- ============================================================
-- RPC: atomic replace — видаляємо старе, вставляємо нове
-- Гарантує що після оновлення закону немає застарілих чанків
-- ============================================================
CREATE OR REPLACE FUNCTION replace_law_chunks(
  p_law_code    text,
  p_chunks      jsonb   -- масив об'єктів з полями нижче
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted  int;
  v_inserted int;
BEGIN
  -- Видалити ВСЕ старе для цього закону (включно з видаленими статтями)
  DELETE FROM law_chunks WHERE law_code = p_law_code;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Вставити нові чанки
  INSERT INTO law_chunks (
    source_type, law_code, law_title,
    article_num, article_title, content,
    authority_weight, service_slugs,
    law_version_date, embedding
  )
  SELECT
    COALESCE(chunk->>'source_type', 'code'),
    p_law_code,
    chunk->>'law_title',
    chunk->>'article_num',
    chunk->>'article_title',
    chunk->>'content',
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
-- RPC: search_law_chunks — пошук релевантних статей для RAG
-- ============================================================
CREATE OR REPLACE FUNCTION search_law_chunks(
  query_embedding  halfvec(3072),
  target_service   text,
  match_count      int DEFAULT 5
)
RETURNS TABLE (
  id               uuid,
  law_title        text,
  article_num      text,
  article_title    text,
  content          text,
  source_type      text,
  authority_weight int,
  similarity       float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    law_title,
    article_num,
    article_title,
    content,
    source_type,
    authority_weight,
    1 - (embedding <=> query_embedding) AS similarity
  FROM law_chunks
  WHERE service_slugs @> ARRAY[target_service]
    AND is_stale = false
    AND embedding IS NOT NULL
  ORDER BY
    -- Враховуємо і схожість, і авторитетність джерела
    (1 - (embedding <=> query_embedding)) * authority_weight DESC
  LIMIT match_count;
$$;

-- ============================================================
-- RPC: get_law_versions — для моніторингу змін (cron)
-- ============================================================
CREATE OR REPLACE FUNCTION get_law_versions()
RETURNS TABLE (
  law_code         text,
  law_title        text,
  law_version_date date,
  chunk_count      bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    law_code,
    MAX(law_title)        AS law_title,
    MAX(law_version_date) AS law_version_date,
    COUNT(*)              AS chunk_count
  FROM law_chunks
  WHERE is_stale = false
  GROUP BY law_code
  ORDER BY law_code;
$$;
