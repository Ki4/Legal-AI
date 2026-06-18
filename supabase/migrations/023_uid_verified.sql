-- Track whether the submitting user's Telegram identity was HMAC-verified (#56).
-- NULL  = case predates this column (cases created before this migration)
-- true  = Telegram WebApp initData signature verified against TELEGRAM_BOT_TOKEN
-- false = no/invalid initData — fell back to trusting the raw uid (dev/web-fallback path)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS uid_verified BOOLEAN DEFAULT NULL;

-- Index for an admin audit query: "how many real submissions came in unverified?"
CREATE INDEX IF NOT EXISTS idx_cases_uid_verified_created_at
  ON cases (uid_verified, created_at)
  WHERE uid_verified IS NOT NULL;
