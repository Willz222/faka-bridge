-- Compact read model for Dujiao-Next catalog pages.
-- Product mappings remain the source of truth. This table stores one rendered
-- row per public product so downstream pagination no longer scans every SKU.

CREATE TABLE IF NOT EXISTS next_catalog_products (
  public_product_id TEXT PRIMARY KEY,
  source_direction TEXT NOT NULL,
  connection_id INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  category_id INTEGER NOT NULL DEFAULT 1,
  category_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_key INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS next_catalog_products_page_idx
  ON next_catalog_products(active, sort_key DESC);

CREATE INDEX IF NOT EXISTS next_catalog_products_connection_idx
  ON next_catalog_products(connection_id, source_direction, active);

-- A Dujiao-Next retry must stay idempotent even when the selected SKU points
-- to a different upstream platform. The downstream order number is unique
-- across both Next routes, not separately per upstream type.
CREATE UNIQUE INDEX IF NOT EXISTS bridge_orders_next_request_unique
  ON bridge_orders(downstream_order_no)
  WHERE direction IN ('next_to_acg', 'next_to_next');
