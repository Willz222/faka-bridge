-- Selective product publishing and ACG -> ACG order idempotency.

ALTER TABLE product_mappings
  ADD COLUMN published INTEGER NOT NULL DEFAULT 1;

ALTER TABLE product_mappings
  ADD COLUMN available INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS product_mappings_selection_idx
  ON product_mappings(direction, published, available, active);

-- The original v0.1 table limited direction to two values with a CHECK.
-- SQLite cannot alter that CHECK in place, so preserve every order while
-- replacing the table with the four-route schema.
DROP TABLE IF EXISTS bridge_orders_v6;
CREATE TABLE bridge_orders_v6 (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
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

INSERT INTO bridge_orders_v6 (
  id, direction, downstream_order_no, upstream_order_id, upstream_order_no,
  public_product_id, public_sku_id, quantity, amount, currency, status,
  delivery_cipher, delivery_hash, initial_delivery_hash, callback_url_cipher,
  callback_state, callback_attempts, last_error_code, next_poll_at, created_at,
  updated_at, delivered_at
)
SELECT
  id, direction, downstream_order_no, upstream_order_id, upstream_order_no,
  public_product_id, public_sku_id, quantity, amount, currency, status,
  delivery_cipher, delivery_hash, initial_delivery_hash, callback_url_cipher,
  callback_state, callback_attempts, last_error_code, next_poll_at, created_at,
  updated_at, delivered_at
FROM bridge_orders;

DROP TABLE bridge_orders;
ALTER TABLE bridge_orders_v6 RENAME TO bridge_orders;

CREATE INDEX IF NOT EXISTS bridge_orders_status_idx
  ON bridge_orders(status, next_poll_at);
CREATE INDEX IF NOT EXISTS bridge_orders_created_idx
  ON bridge_orders(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bridge_orders_next_request_unique
  ON bridge_orders(downstream_order_no)
  WHERE direction IN ('next_to_acg', 'next_to_next');
CREATE UNIQUE INDEX IF NOT EXISTS bridge_orders_acg_request_unique
  ON bridge_orders(downstream_order_no)
  WHERE direction IN ('acg_to_acg', 'acg_to_next');
