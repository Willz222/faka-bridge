CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('next_to_acg', 'acg_to_next')),
  public_product_id TEXT NOT NULL,
  public_sku_id TEXT NOT NULL,
  upstream_product_id TEXT NOT NULL,
  upstream_sku_id TEXT NOT NULL DEFAULT '',
  upstream_code TEXT NOT NULL DEFAULT '',
  upstream_race TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(direction, public_sku_id),
  UNIQUE(direction, upstream_product_id, upstream_sku_id, upstream_race)
);

CREATE INDEX IF NOT EXISTS product_mappings_product_idx
  ON product_mappings(direction, public_product_id, active);

CREATE TABLE IF NOT EXISTS bridge_orders (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL CHECK (direction IN ('next_to_acg', 'acg_to_next')),
  downstream_order_no TEXT NOT NULL,
  upstream_order_id TEXT NOT NULL DEFAULT '',
  upstream_order_no TEXT NOT NULL DEFAULT '',
  public_product_id TEXT NOT NULL DEFAULT '',
  public_sku_id TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  amount TEXT NOT NULL DEFAULT '0.00',
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'creating',
  delivery_cipher TEXT NOT NULL DEFAULT '',
  delivery_hash TEXT NOT NULL DEFAULT '',
  initial_delivery_hash TEXT NOT NULL DEFAULT '',
  callback_url_cipher TEXT NOT NULL DEFAULT '',
  callback_state TEXT NOT NULL DEFAULT 'pending',
  callback_attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT NOT NULL DEFAULT '',
  next_poll_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivered_at TEXT,
  UNIQUE(direction, downstream_order_no)
);

CREATE INDEX IF NOT EXISTS bridge_orders_status_idx
  ON bridge_orders(status, next_poll_at);
CREATE INDEX IF NOT EXISTS bridge_orders_created_idx
  ON bridge_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS callback_events (
  event_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  source TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS callback_events_order_idx
  ON callback_events(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  subject_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  order_id TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL,
  detail_code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
  ON audit_logs(created_at DESC);
