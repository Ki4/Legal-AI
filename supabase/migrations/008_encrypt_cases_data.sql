-- Migration 008: Change encrypted_data from JSONB to TEXT
-- Required for storing AES-256-GCM encrypted strings (v1:<iv>:<authTag>:<ciphertext>)
-- instead of plain JSON with PII data

ALTER TABLE cases ALTER COLUMN encrypted_data TYPE TEXT USING encrypted_data::TEXT;

COMMENT ON COLUMN cases.encrypted_data IS 'AES-256-GCM encrypted PII. Format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>';
