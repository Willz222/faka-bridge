CREATE TABLE IF NOT EXISTS upstream_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_id_cipher TEXT NOT NULL DEFAULT '',
  api_secret_cipher TEXT NOT NULL DEFAULT '',
  catalog_mode TEXT NOT NULL DEFAULT 'auto',
  active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  markup_mode TEXT NOT NULL DEFAULT 'inherit',
  markup_value TEXT NOT NULL DEFAULT '0',
  min_price TEXT NOT NULL DEFAULT '0',
  health_status TEXT NOT NULL DEFAULT 'unknown',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  last_ok_at TEXT,
  last_error_code TEXT NOT NULL DEFAULT '',
  response_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL,
  product_key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'inherit',
  value TEXT NOT NULL DEFAULT '0',
  min_price TEXT NOT NULL DEFAULT '0',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(connection_id, product_key)
);

CREATE TABLE IF NOT EXISTS price_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL,
  public_product_id TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  old_cost TEXT NOT NULL DEFAULT '0.00',
  new_cost TEXT NOT NULL DEFAULT '0.00',
  old_price TEXT NOT NULL DEFAULT '0.00',
  new_price TEXT NOT NULL DEFAULT '0.00',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS upstream_connections_active_idx
  ON upstream_connections(platform, active, priority);
CREATE INDEX IF NOT EXISTS price_changes_created_idx
  ON price_changes(created_at DESC);
