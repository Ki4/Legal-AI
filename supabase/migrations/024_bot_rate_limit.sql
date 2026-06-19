-- 024_bot_rate_limit.sql — off-topic abuse throttle for the Telegram dispatcher (#78).
--
-- Keyed by the Telegram user id (always available in main-bot), independent of
-- `profiles` — so the guard needs no profile-id lookup and works the same for
-- brand-new and existing users. Replaces the earlier n8n-static-data prototype:
-- a real table is queryable in the admin panel (ties to #79 cost visibility).
--
-- The bot reads/writes with the service role (bypasses RLS). RLS is enabled with
-- no anon/authenticated policy → the table is not publicly readable.

CREATE TABLE IF NOT EXISTS bot_rate_limit (
  external_id     TEXT PRIMARY KEY,            -- Telegram user id
  off_topic_count INTEGER NOT NULL DEFAULT 0,
  paused_until    TIMESTAMPTZ,                 -- NULL = not paused
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin query: "who is currently paused / how much off-topic abuse"
CREATE INDEX IF NOT EXISTS idx_bot_rate_limit_paused
  ON bot_rate_limit (paused_until) WHERE paused_until IS NOT NULL;

ALTER TABLE bot_rate_limit ENABLE ROW LEVEL SECURITY;
