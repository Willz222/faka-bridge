CREATE TABLE IF NOT EXISTS opaque_id_registry (
  label TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO opaque_id_registry(label, public_id, created_at)
SELECT CASE
  WHEN direction = 'next_to_acg' THEN
    'next_to_acg:' || substr(upstream_product_id, 1, instr(upstream_product_id, ':') - 1) ||
    ':product:' || substr(upstream_product_id, instr(upstream_product_id, ':') + 1)
  ELSE
    'acg_to_next:' || substr(upstream_product_id, 1, instr(upstream_product_id, ':') - 1) ||
    ':product:' || json_extract(snapshot_json, '$.pricing_key')
END,
public_product_id,
COALESCE(created_at, datetime('now'))
FROM product_mappings
WHERE direction IN ('next_to_acg', 'acg_to_next')
  AND instr(upstream_product_id, ':') > 0
  AND public_product_id <> ''
  AND (direction = 'next_to_acg' OR COALESCE(json_extract(snapshot_json, '$.pricing_key'), '') <> '');

INSERT OR IGNORE INTO opaque_id_registry(label, public_id, created_at)
SELECT CASE
  WHEN direction = 'next_to_acg' THEN
    'next_to_acg:' || substr(upstream_product_id, 1, instr(upstream_product_id, ':') - 1) ||
    ':sku:' || substr(upstream_product_id, instr(upstream_product_id, ':') + 1) || ':default'
  ELSE
    'acg_to_next:' || substr(upstream_product_id, 1, instr(upstream_product_id, ':') - 1) ||
    ':sku:' || json_extract(snapshot_json, '$.pricing_key')
END,
public_sku_id,
COALESCE(created_at, datetime('now'))
FROM product_mappings
WHERE direction IN ('next_to_acg', 'acg_to_next')
  AND instr(upstream_product_id, ':') > 0
  AND public_sku_id <> ''
  AND (direction = 'next_to_acg' OR COALESCE(json_extract(snapshot_json, '$.pricing_key'), '') <> '');

CREATE INDEX IF NOT EXISTS bridge_orders_submission_idx
ON bridge_orders(submission_state, updated_at)
WHERE status = 'creating';

PRAGMA optimize;
