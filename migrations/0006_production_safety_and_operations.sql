ALTER TABLE bridge_orders ADD COLUMN connection_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bridge_orders ADD COLUMN upstream_platform TEXT NOT NULL DEFAULT '';
ALTER TABLE bridge_orders ADD COLUMN upstream_request_no TEXT NOT NULL DEFAULT '';
ALTER TABLE bridge_orders ADD COLUMN submission_state TEXT NOT NULL DEFAULT 'reserved';
ALTER TABLE bridge_orders ADD COLUMN upstream_cost TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE bridge_orders ADD COLUMN upstream_currency TEXT NOT NULL DEFAULT 'CNY';
ALTER TABLE bridge_orders ADD COLUMN submitted_at TEXT;
ALTER TABLE bridge_orders ADD COLUMN reconciled_at TEXT;
ALTER TABLE bridge_orders ADD COLUMN reconciliation_note TEXT NOT NULL DEFAULT '';

ALTER TABLE upstream_connections ADD COLUMN balance TEXT NOT NULL DEFAULT '';
ALTER TABLE upstream_connections ADD COLUMN balance_currency TEXT NOT NULL DEFAULT 'CNY';
ALTER TABLE upstream_connections ADD COLUMN balance_updated_at TEXT;
ALTER TABLE upstream_connections ADD COLUMN sync_interval_minutes INTEGER NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS bridge_orders_connection_idx
ON bridge_orders(connection_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS bridge_orders_callback_idx
ON bridge_orders(callback_state, next_poll_at)
WHERE status = 'delivered';

CREATE INDEX IF NOT EXISTS audit_logs_created_idx
ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS callback_events_created_idx
ON callback_events(created_at);

UPDATE bridge_orders
SET connection_id = COALESCE((
  SELECT CAST(json_extract(m.snapshot_json, '$.connection_id') AS INTEGER)
  FROM product_mappings m
  WHERE m.public_sku_id = bridge_orders.public_sku_id
    AND m.direction = CASE
      WHEN bridge_orders.direction = 'next_to_next' THEN 'acg_to_next'
      WHEN bridge_orders.direction = 'acg_to_acg' THEN 'next_to_acg'
      ELSE bridge_orders.direction
    END
  ORDER BY m.id DESC
  LIMIT 1
), 0),
upstream_platform = CASE
  WHEN direction IN ('next_to_next', 'acg_to_next') THEN 'next'
  WHEN direction IN ('next_to_acg', 'acg_to_acg') THEN 'acg'
  ELSE ''
END,
upstream_request_no = id,
submission_state = CASE
  WHEN status = 'creating' THEN 'unknown'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'accepted'
END,
reconciliation_note = CASE
  WHEN status = 'creating' THEN 'UPGRADED_CREATING_ORDER_REQUIRES_REVIEW'
  ELSE ''
END;

PRAGMA optimize;
