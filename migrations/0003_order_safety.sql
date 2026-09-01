-- Persistent rate limiting and atomic background-job locks.
-- Order idempotency uses the existing UNIQUE(direction, downstream_order_no)
-- constraint, so this migration does not rewrite existing order data.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  subject_hash TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS job_locks (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
