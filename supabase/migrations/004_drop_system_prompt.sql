-- Migration 004: Remove deprecated system_prompt column
-- The system_prompt column was replaced by ai_prompt (same purpose, cleaner name).
-- n8n workflow uses services.ai_prompt since 2026-03-21.
-- Run this AFTER verifying that ai_prompt is used everywhere.

-- Step 1: Copy any data from system_prompt to ai_prompt (safety net)
UPDATE services
SET ai_prompt = system_prompt
WHERE ai_prompt IS NULL AND system_prompt IS NOT NULL;

-- Step 2: Drop the deprecated column
ALTER TABLE services DROP COLUMN IF EXISTS system_prompt;
