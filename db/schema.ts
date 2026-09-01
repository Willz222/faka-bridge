// This file documents the logical D1 schema for hosting systems that inspect
// source trees. Deployable SQL lives in migrations/.
export const tables = {
  settings: ["key", "value", "secret", "updated_at"],
  productMappings: ["direction", "public_product_id", "public_sku_id"],
  bridgeOrders: ["id", "direction", "downstream_order_no", "status"],
  callbackEvents: ["event_id", "order_id", "source"],
  auditLogs: ["action", "order_id", "result", "created_at"],
  upstreamConnections: ["id", "name", "platform", "base_url", "health_status"],
  priceRules: ["connection_id", "product_key", "mode", "value", "min_price"],
  priceChanges: ["connection_id", "public_product_id", "old_cost", "new_cost", "old_price", "new_price"],
  nextCatalogProducts: ["public_product_id", "source_direction", "connection_id", "payload_json", "active"],
};
