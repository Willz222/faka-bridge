import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import worker, { __test } from "../worker/index.js";

test("MD5 matches standard vectors", () => {
  assert.equal(__test.md5(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(__test.md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
});

test("ACG signing is stable and ignores sign/empty top-level values", () => {
  const input = { z: "最后", app_id: "demo", empty: "", sign: "old", a: "hello world" };
  assert.equal(__test.acgSign(input, "secret"), __test.acgSign({ a: "hello world", z: "最后", app_id: "demo" }, "secret"));
  assert.equal(__test.acgSign(input, "secret").length, 32);
});

test("ACG signing and form body follow the documented shared API", () => {
  const input = { app_id: "2552", sku: { "机身颜色": "黑色", "存储容量": "256GB" } };
  const canonical = "app_id=2552&sku[机身颜色]=黑色&sku[存储容量]=256GB&key=secret";
  assert.equal(__test.acgSign(input, "secret"), createHash("md5").update(canonical).digest("hex"));
  const signed = { ...input, sign: __test.acgSign(input, "secret") };
  const wire = __test.acgFormBody(signed).toString();
  assert.equal(wire.includes("app_key="), false);
  assert.deepEqual(__test.parseAcgForm(wire), signed);
});

test("public text redaction removes URLs and control characters", () => {
  const value = __test.cleanText("<b>failed</b> at https://upstream.example/private\ncontact admin@upstream.example or www.upstream.example");
  assert.equal(value.includes("upstream.example"), false);
  assert.equal(value.includes("\n"), false);
  assert.equal(value.includes("<b>"), false);
});

test("status normalization is conservative", () => {
  assert.equal(__test.normalizedStatus("success"), "delivered");
  assert.equal(__test.normalizedStatus("paid"), "pending");
  assert.equal(__test.normalizedStatus("processing"), "pending");
  assert.equal(__test.normalizedStatus("cancelled"), "failed");
});

test("embedded admin client is valid JavaScript", () => {
  const scripts = [...__test.ADMIN_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  const loginScripts = [...__test.LOGIN_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(loginScripts.length);
  for (const script of loginScripts) assert.doesNotThrow(() => new Function(script));
  assert.equal(__test.LOGIN_PAGE.includes("管理员账户"), true);
  assert.equal(__test.LOGIN_PAGE.includes("data-view=\"overview\""), false);
  assert.equal(__test.ADMIN_PAGE.includes("id=\"loginForm\""), false);
  assert.equal(__test.ADMIN_PAGE.includes("上游连接"), true);
  assert.equal(__test.ADMIN_PAGE.includes("商品与定价"), true);
  assert.equal(__test.ADMIN_PAGE.includes("Telegram 通知"), true);
  assert.equal(__test.ADMIN_PAGE.includes("高级手工映射"), false);
  assert.equal(__test.ADMIN_PAGE.includes("刷新已上架商品"), true);
  assert.equal(__test.ADMIN_PAGE.includes("/admin/api/sync/all"), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="catalogBackdrop"'), true);
  assert.equal(__test.ADMIN_PAGE.includes("强制刷新完整商品库"), true);
  assert.equal(__test.ADMIN_PAGE.includes("保存上架选择"), true);
  assert.equal(__test.ADMIN_PAGE.includes("订单与异常核对"), true);
  assert.equal(__test.ADMIN_PAGE.includes("导出 CSV"), true);
  assert.equal(__test.ADMIN_PAGE.includes("待人工核对"), true);
  assert.equal(__test.ADMIN_PAGE.includes("下载诊断报告"), true);
  assert.equal(__test.ADMIN_PAGE.includes("已上架商品刷新间隔"), true);
  assert.equal(__test.ADMIN_PAGE.includes("confirm("), false);
  assert.equal(__test.ADMIN_PAGE.includes("prompt("), false);
  assert.equal(__test.VERSION, "0.2.0");
  assert.equal(__test.ADMIN_PAGE.includes("ADMIN_USERNAME"), true);
  assert.equal(__test.ADMIN_PAGE.includes("ADMIN_PASSWORD"), true);
  assert.equal(__test.LOGIN_PAGE.includes('value="admin"'), false);
  assert.equal(__test.LOGIN_PAGE.includes("ADMIN_USERNAME"), false);
  assert.equal(__test.LOGIN_PAGE.includes("ADMIN_PASSWORD"), false);
  assert.equal(__test.LOGIN_PAGE.includes("管理后台与登录页已分离"), false);
  assert.equal(__test.ADMIN_PAGE.includes("restoreAdminView"), true);
  assert.equal(__test.ADMIN_PAGE.includes("/selection-status"), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="productSearch"'), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="upstreamFilter"'), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="categoryFilter"'), true);
  assert.equal(__test.ADMIN_PAGE.includes("table-layout:fixed"), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="price_protection_enabled"'), false);
  assert.equal(__test.ADMIN_PAGE.includes('name="price_protection_enabled"'), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="configSaveButton"'), true);
  assert.equal(__test.ADMIN_PAGE.includes('id="dialogBackdrop"'), true);
  assert.equal(__test.ADMIN_PAGE.includes("async function enableConnection"), true);
  assert.equal(__test.ADMIN_PAGE.includes("async function deleteConnection"), true);
  assert.equal(__test.ADMIN_PAGE.includes("正在后台刷新已勾选商品"), true);
  assert.equal(__test.ADMIN_PAGE.includes("异次元 → 异次元"), true);
  assert.equal(/\b(?:confirm|prompt|alert)\s*\(/.test(__test.ADMIN_PAGE), false);
});

test("pricing supports percentage, fixed addition, fixed sale price and floor", () => {
  assert.equal(__test.applyPricing("10", "percent", "20"), "12.00");
  assert.equal(__test.applyPricing("10", "fixed", "5"), "15.00");
  assert.equal(__test.applyPricing("10", "set", "18.88"), "18.88");
  assert.equal(__test.applyPricing("10", "none", "0", "12"), "12.00");
});

test("order safety validates quantities and blocks a cost above the safe limit", () => {
  assert.equal(__test.validQuantity("2", 100), 2);
  assert.throws(() => __test.validQuantity("1.5", 100), /INVALID_QUANTITY/);
  assert.throws(() => __test.validQuantity("101", 100), /INVALID_QUANTITY/);
  assert.deepEqual(__test.quoteLimit({ price: "12.00", cost_price: "10.00" }, 2, 0), { saleTotal: 24, maxCost: 20 });
  assert.deepEqual(__test.quoteLimit({ price: "12.00", cost_price: "10.00" }, 2, 10), { saleTotal: 24, maxCost: 22 });
});

test("all four bridge routes use the same fail-closed price ceiling", () => {
  for (const direction of ["next_to_acg", "next_to_next", "acg_to_next", "acg_to_acg"]) {
    const limit = __test.quoteLimit({ price: "15.00", cost_price: "10.00" }, 2, 20);
    assert.equal(limit.saleTotal, 30, direction);
    assert.equal(limit.maxCost, 24, direction);
    assert.equal(24.01 > limit.maxCost, true, direction);
  }
});

test("order reservation is atomic and rejects idempotency conflicts", async () => {
  const rows = new Map();
  const DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async run() {
          if (!sql.startsWith("INSERT OR IGNORE INTO bridge_orders")) return { meta: { changes: 0 } };
          const [id, direction, downstream_order_no, public_product_id, public_sku_id, quantity, amount] = this.args;
          const key = `${direction}:${downstream_order_no}`;
          if (rows.has(key)) return { meta: { changes: 0 } };
          rows.set(key, { id, direction, downstream_order_no, public_product_id, public_sku_id, quantity, amount });
          return { meta: { changes: 1 } };
        },
        async first() { return rows.get(`${this.args[0]}:${this.args[1]}`) || null; },
      };
    },
  };
  const env = { DB };
  const base = { id: "b_1", direction: "next_to_acg", downstream_order_no: "ORDER-1", public_product_id: "100", public_sku_id: "200", quantity: 1, amount: "12.00" };
  assert.equal((await __test.reserveOrder(env, base)).created, true);
  assert.equal((await __test.reserveOrder(env, { ...base, id: "b_2" })).created, false);
  await assert.rejects(__test.reserveOrder(env, { ...base, id: "b_3", quantity: 2 }), /IDEMPOTENCY_CONFLICT/);
});

test("scheduled catalog selection excludes disabled upstreams", async () => {
  let sql = "";
  const DB = { prepare(query) { sql = query; return { bind() { return this; }, async all() { return { results: [] }; } }; } };
  await __test.listConnections({ DB }, "", true);
  assert.match(sql, /WHERE active=1/);
});

test("cron skips upstreams that have no selected products", async () => {
  let sql = "";
  const DB = { prepare(query) { sql = query; return { async all() { return { results: [] }; } }; } };
  assert.deepEqual(await __test.catalogConnectionsWithSelections({ DB }), []);
  assert.match(sql, /c\.active=1/);
  assert.match(sql, /m\.published=1/);
  assert.match(sql, /m\.available=1/);
  assert.match(sql, /EXISTS/);
});

test("catalog sync skips unchanged mappings and writes only real changes", () => {
  const item = { upstream_code: "CODE-1", upstream_race: "", snapshot: { name: "商品", cost_price: "10.00", price: "12.00", stock: 8 } };
  const snapshot_json = JSON.stringify(item.snapshot);
  assert.equal(__test.mappingNeedsWrite({ active: 1, upstream_code: "CODE-1", upstream_race: "", snapshot_json }, item, snapshot_json), false);
  assert.equal(__test.mappingNeedsWrite({ active: 0, upstream_code: "CODE-1", upstream_race: "", snapshot_json }, item, snapshot_json), true);
  assert.equal(__test.mappingNeedsWrite({ active: 1, upstream_code: "CODE-1", upstream_race: "", snapshot_json }, { ...item, snapshot: { ...item.snapshot, stock: 7 } }), true);
});

test("pending fulfillment text is never treated as delivered content", () => {
  assert.equal(__test.findPayload({ secret: "订单待处理，请稍后查询" }), "");
  assert.equal(__test.findPayload({ fulfillment: { payload: "CARD-123" } }), "CARD-123");
});

test("delivered content is immutable after the first successful fulfillment", async () => {
  let deliveryUpdates = 0;
  const DB = { prepare(sql) { return { bind() { return this; }, async first() { return sql.includes("SELECT delivery_hash") ? { delivery_hash: "already-delivered-with-another-hash", status: "delivered" } : null; }, async run() { if (sql.includes("SET status='delivered'")) deliveryUpdates++; return { meta: { changes: 1 } }; } }; } };
  await assert.rejects(__test.deliver({ DB }, { id: "order-1" }, "DIFFERENT-CARD"), /DELIVERY_CONFLICT/);
  assert.equal(deliveryUpdates, 0);
});

test("ACG form parser rejects prototype-pollution fields", () => {
  assert.throws(() => __test.parseAcgForm("__proto__[polluted]=1"), /INVALID_FORM_FIELD/);
  assert.equal({}.polluted, undefined);
});

test("external URLs require safe HTTPS hosts and the standard port", () => {
  assert.equal(__test.externalUrl("https://shop.example.com/callback").hostname, "shop.example.com");
  assert.throws(() => __test.externalUrl("https://127.0.0.1/callback"), /PRIVATE_HOST/);
  assert.throws(() => __test.externalUrl("https://user:pass@shop.example.com/callback"), /URL_CREDENTIALS_DENIED/);
  assert.throws(() => __test.externalUrl("https://shop.example.com:8443/callback"), /HTTPS_PORT_REQUIRED/);
});

test("optional upstream host allowlist blocks every unlisted host", () => {
  const env = { UPSTREAM_ALLOWED_HOSTS: "api.example.com, shop.example.net" };
  assert.equal(__test.assertUpstreamHost(env, new URL("https://api.example.com")).hostname, "api.example.com");
  assert.throws(() => __test.assertUpstreamHost(env, new URL("https://other.example.com")), /UPSTREAM_HOST_NOT_ALLOWED/);
  assert.doesNotThrow(() => __test.assertUpstreamHost({}, new URL("https://other.example.com")));
});

test("CSV export neutralizes spreadsheet formulas", () => {
  assert.equal(__test.csvCell("=HYPERLINK(\"https://bad.example\")"), '"\'=HYPERLINK(""https://bad.example"")"');
  assert.equal(__test.csvCell("normal"), '"normal"');
});

test("blank monetary values are unknown rather than zero", () => {
  assert.equal(__test.moneyValue(""), null);
  assert.equal(__test.moneyValue("  "), null);
  assert.equal(__test.moneyValue("0"), 0);
});

test("login and admin are separate routes", async () => {
  const DB = { async batch() {}, prepare() { return {}; } };
  const admin = await worker.fetch(new Request("https://bridge.example/admin"), { DB }, {});
  assert.equal(admin.status, 302);
  assert.equal(admin.headers.get("location"), "https://bridge.example/login");
  const login = await worker.fetch(new Request("https://bridge.example/login"), { DB }, {});
  assert.equal(login.status, 200);
  assert.equal((await login.text()).includes("管理员账户"), true);
});

test("Dujiao-Next product output follows numeric Open API structure", () => {
  const product = __test.nextProduct([{
    public_product_id: "10001",
    public_sku_id: "20001",
    snapshot_json: JSON.stringify({ name: "测试商品", price: "9.90", stock: 8, category_id: 345678901 }),
    active: 1,
    created_at: "2026-08-19T00:00:00.000Z",
    updated_at: "2026-08-19T00:00:00.000Z",
  }]);
  assert.equal(product.id, 10001);
  assert.equal(product.skus[0].id, 20001);
  assert.equal(product.category_id, 345678901);
  assert.equal(product.skus[0].stock_status, "low_stock");
  assert.deepEqual(product.title, { "zh-CN": "测试商品" });
});

test("Dujiao-Next unlimited stock remains unlimited for both downstream protocols", () => {
  assert.equal(__test.normalizedNextStock("unlimited", -1), -1);
  assert.equal(__test.stockAvailable(-1, 10000), true);
  assert.equal(__test.acgStock(-1), 999999);
  const product = __test.nextProduct([{
    public_product_id: "10001",
    public_sku_id: "20001",
    snapshot_json: JSON.stringify({ name: "无限库存商品", price: "9.90", stock: -1, category_id: 1 }),
    active: 1,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  }]);
  assert.equal(product.skus[0].stock_status, "unlimited");
  assert.equal(product.skus[0].stock_quantity, -1);
});

test("Dujiao-Next upstream orders send numeric SKU IDs", () => {
  assert.equal(__test.upstreamNextSkuId({ upstream_sku_id: "1944336420" }), 1944336420);
  assert.equal(typeof __test.upstreamNextSkuId({ upstream_sku_id: "1944336420" }), "number");
  assert.equal(__test.upstreamNextSkuId({ upstream_product_id: "8:12345", upstream_sku_id: "" }), 12345);
  assert.throws(() => __test.upstreamNextSkuId({ upstream_sku_id: "SKU-4" }), /INVALID_UPSTREAM_SKU/);
});

test("ACG catalog gets stable opaque IDs and sanitized public snapshots", async () => {
  const env = { MASTER_KEY: "test-master-key-that-is-longer-than-32-bytes" };
  const first = await __test.normalizeAcgCatalog(env, [{
    id: 7,
    name: "会员专区",
    children: [{ id: 12, code: "REAL-12", name: "测试商品", description: "来源 https://secret.example/item/12", user_price: "8.80", stock: 6 }],
  }]);
  const second = await __test.normalizeAcgCatalog(env, [{ id: 7, name: "会员专区", children: [{ id: 12, code: "REAL-12", name: "测试商品" }] }]);
  assert.equal(first.items.length, 1);
  assert.match(first.items[0].public_product_id, /^\d+$/);
  assert.match(first.items[0].public_sku_id, /^\d+$/);
  assert.notEqual(first.items[0].public_product_id, "12");
  assert.notEqual(first.items[0].public_sku_id, "12");
  assert.equal(first.items[0].public_product_id, second.items[0].public_product_id);
  const snapshot = JSON.parse(first.items[0].snapshot_json);
  assert.equal(snapshot.price, "8.80");
  assert.equal(snapshot.description.includes("secret.example"), false);
  assert.equal(snapshot.auto_sync, true);
});

test("catalog pricing rules are loaded once per upstream instead of once per product", async () => {
  let ruleQueries = 0;
  const settings = {
    global_markup_mode: "percent",
    global_markup_value: "10",
    global_min_price: "0",
  };
  const DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() {
          if (!sql.includes("FROM settings")) return null;
          const value = settings[this.args[0]];
          return value === undefined ? null : { value, secret: 0 };
        },
        async all() {
          if (sql.includes("FROM settings")) return { results: this.args.map(key => settings[key] === undefined ? null : { key, value: settings[key], secret: 0 }).filter(Boolean) };
          if (sql.includes("FROM price_rules")) ruleQueries++;
          return { results: [] };
        },
      };
    },
  };
  const result = await __test.normalizeAcgCatalog(
    { DB, MASTER_KEY: "test-master-key-that-is-longer-than-32-bytes" },
    [{ id: 1, name: "分类", children: [
      { id: 11, code: "A", name: "A", user_price: "10" },
      { id: 12, code: "B", name: "B", user_price: "20" },
    ] }],
    { id: 7, name: "测试上游", markup_mode: "inherit", markup_value: "0", min_price: "0" },
  );
  assert.equal(ruleQueries, 1);
  assert.equal(result.items[0].snapshot.price, "11.00");
  assert.equal(result.items[1].snapshot.price, "22.00");
});

test("Dujiao-Next catalog is normalized for ACG downstream with opaque IDs and pricing", async () => {
  const settings = { global_markup_mode: "fixed", global_markup_value: "2", global_min_price: "0" };
  const DB = { prepare(sql) { return { args: [], bind(...args) { this.args=args; return this; }, async first() { if (!sql.includes("FROM settings")) return null; const value=settings[this.args[0]]; return value===undefined?null:{value,secret:0}; }, async all() { if (sql.includes("FROM settings")) return { results: this.args.map(key => settings[key] === undefined ? null : { key, value: settings[key], secret: 0 }).filter(Boolean) }; return {results:[]}; } }; } };
  const rows = await __test.normalizeNextCatalog({ DB, MASTER_KEY: "test-master-key-that-is-longer-than-32-bytes" }, {
    categories: [{ id: 3, name: { "zh-CN": "软件" } }],
    items: [{ id: 9, category_id: 3, title: { "zh-CN": "Next 商品" }, price_amount: "10.00", skus: [{ id: 91, sku_code: "一年", price_amount: "10.00", stock_quantity: 7, is_active: true }], is_active: true }],
  }, { id: 8, name: "Next 上游", markup_mode: "inherit", markup_value: "0", min_price: "0" });
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].public_product_id, "9");
  assert.notEqual(rows[0].public_sku_id, "91");
  assert.equal(rows[0].snapshot.price, "12.00");
  assert.equal(rows[0].snapshot.category_name, "软件");
  assert.equal(rows[0].snapshot.pricing_key, "9:91");
});

test("Dujiao-Next SKU display prefers human specification values over SKU codes", () => {
  assert.equal(__test.nextSkuDisplayName({
    sku_code: "SKU-4",
    spec_values: { region: "菲区", plan: "代充Plus-1个月" },
  }), "菲区-代充Plus-1个月");
  assert.equal(__test.nextSkuDisplayName({ sku_code: "SKU-5", spec_values: {} }), "SKU-5");
});

test("safe schema bootstrap adds selection columns without rebuilding order tables", async () => {
  const events = [];
  let hasColumns = false;
  let rebuiltOrders = false;
  let hasSelectionIndex = false;
  const DB = {
    prepare(sql) {
      return {
        async all() {
          if (sql.includes("SELECT published,available") && !hasColumns) throw new Error("no such column: published");
          return { results: [] };
        },
        async first() {
          if (sql.includes("name='bridge_orders'")) return { sql: rebuiltOrders ? "CREATE TABLE bridge_orders (direction TEXT)" : "CREATE TABLE bridge_orders (direction TEXT CHECK(direction IN ('next_to_acg','acg_to_next')))" };
          if (sql.includes("product_mappings_selection_idx")) return hasSelectionIndex ? { name: "product_mappings_selection_idx" } : null;
          return null;
        },
        async run() {
          events.push(sql);
          if (sql.startsWith("ALTER TABLE product_mappings ADD COLUMN available")) hasColumns = true;
          return { meta: { changes: 0 } };
        },
      };
    },
    async exec(sql) {
      events.push(sql);
      if (sql.includes("ALTER TABLE bridge_orders_v6 RENAME TO bridge_orders")) rebuiltOrders = true;
      if (sql.includes("product_mappings_selection_idx")) hasSelectionIndex = true;
    },
  };
  await __test.ensureSchema({ DB });
  const selectionIndexAt = events.findIndex(sql => sql.includes("product_mappings_selection_idx"));
  const availableColumnAt = events.findIndex(sql => sql.startsWith("ALTER TABLE product_mappings ADD COLUMN available"));
  assert.ok(availableColumnAt >= 0);
  assert.ok(selectionIndexAt > availableColumnAt);
  assert.equal(rebuiltOrders, false);
});

test("production schema changes require migration 0006 instead of request-time ALTER", async () => {
  const DB = {
    prepare(sql) {
      return {
        async all() {
          if (sql.includes("SELECT connection_id,submission_state")) throw new Error("no such column: connection_id");
          return { results: [] };
        },
        async first() { return { name: "product_mappings_selection_idx" }; },
        async run() { return { meta: { changes: 0 } }; },
      };
    },
  };
  await assert.rejects(__test.ensureSchema({ DB }), /DB_MIGRATION_REQUIRED_0006/);
});

test("migration 0006 is additive and contains the production safety fields", async () => {
  const sql = await readFile(new URL("../migrations/0006_production_safety_and_operations.sql", import.meta.url), "utf8");
  for (const field of ["connection_id", "submission_state", "upstream_cost", "sync_interval_minutes", "balance_currency"]) assert.equal(sql.includes(field), true);
  assert.equal(/DROP\s+TABLE/i.test(sql), false);
});

test("public ACG catalog fallback groups products and requires a private trade code", () => {
  const groups = __test.buildPublicAcgCatalog(
    [{ id: 9, name: "礼品卡", children: [] }],
    [{ id: 12, category_id: 9, name: "公开商品", price: "9.90", stock: 3 }, { id: 13, category_id: 9, name: "无代码商品" }],
    { "12": { code: "TRADE-CODE-12", description: "详情" }, "13": { description: "详情" } },
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "礼品卡");
  assert.equal(groups[0].children.length, 1);
  assert.equal(groups[0].children[0].code, "TRADE-CODE-12");
});

test("Dujiao-Next ping accepts distinct API Key and API Secret", async () => {
  const key = "test-api-key";
  const secret = "a-different-signing-secret";
  const settings = {
    inbound_next_api_key: { value: key, secret: 0 },
    inbound_next_api_secret: { value: secret, secret: 0 },
  };
  const DB = {
    async batch() {},
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async first() { return sql.includes("FROM settings") ? settings[this.args[0]] ?? null : null; },
        async all() { return sql.includes("FROM settings") ? { results: this.args.map(key => settings[key] ? { key, ...settings[key] } : null).filter(Boolean) } : { results: [] }; },
        async run() { return { meta: { changes: 1 } }; },
      };
    },
  };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyMD5 = createHash("md5").update("").digest("hex");
  const signature = createHmac("sha256", secret)
    .update(`POST\n/api/v1/upstream/ping\n${timestamp}\n${bodyMD5}`)
    .digest("hex");
  const request = new Request("https://bridge.example/api/v1/upstream/ping", {
    method: "POST",
    headers: {
      "Dujiao-Next-Api-Key": key,
      "Dujiao-Next-Timestamp": timestamp,
      "Dujiao-Next-Signature": signature,
    },
  });
  const response = await worker.fetch(request, { DB }, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    site_name: "Faka Bridge",
    protocol_version: "1.0",
    user_id: 1,
    balance: "999999.00",
    currency: "CNY",
    member_level: null,
  });
});

test("Next downstream catalog and order lookup include Next upstream mappings", async () => {
  const nextRow = { id: 9, direction: "acg_to_next", public_sku_id: "9001", snapshot_json: "{}", active: 1 };
  const queries = [];
  const DB = { prepare(sql) { queries.push(sql); return { bind() { return this; }, async first() { return nextRow; }, async all() { return { results: [nextRow] }; } }; } };
  const env = { DB };
  assert.equal((await __test.nextDownstreamMapping(env, "9001")).id, 9);
  assert.equal((await __test.nextDownstreamMappings(env)).length, 1);
  assert.equal(__test.orderDirectionForMapping("next", nextRow), "next_to_next");
  assert.equal((await __test.mappingForOrder(env, { direction: "next_to_next", public_sku_id: "9001" })).direction, "acg_to_next");
  assert.equal(queries.some(sql => sql.includes("direction IN ('next_to_acg','acg_to_next')")), true);
  assert.equal(queries.some(sql => sql.includes("direction=?") && sql.includes("public_sku_id=?")), true);
});

test("Next downstream records distinct routes for ACG and Next upstreams", () => {
  assert.equal(__test.orderDirectionForMapping("next", { direction: "next_to_acg" }), "next_to_acg");
  assert.equal(__test.orderDirectionForMapping("next", { direction: "acg_to_next" }), "next_to_next");
  assert.equal(__test.orderDirectionForMapping("acg", { direction: "acg_to_next" }), "acg_to_next");
  assert.equal(__test.orderDirectionForMapping("acg", { direction: "next_to_acg" }), "acg_to_acg");
});

test("ACG downstream catalog includes products from both upstream protocols", async () => {
  const acgRow = { id: 7, direction: "next_to_acg", public_product_id: "7001", public_sku_id: "7002", snapshot_json: "{}", active: 1 };
  const nextRow = { id: 8, direction: "acg_to_next", public_product_id: "8001", public_sku_id: "8002", snapshot_json: "{}", active: 1 };
  const DB = { prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, async first() { return acgRow; }, async all() { return { results: sql.includes("public_sku_id=? OR public_product_id=?") ? [acgRow] : [acgRow, nextRow] }; } }; } };
  assert.equal((await __test.acgDownstreamMapping({ DB }, "7001")).direction, "next_to_acg");
  assert.deepEqual((await __test.acgDownstreamMappings({ DB })).map(row => row.direction), ["next_to_acg", "acg_to_next"]);
  assert.equal((await __test.mappingForOrder({ DB }, { direction: "acg_to_acg", public_sku_id: "7002" })).direction, "next_to_acg");
});

test("routine upstream refresh selects only published and available products", async () => {
  let query = "";
  const DB = { prepare(sql) { query = sql; return { bind() { return this; }, async all() { return { results: [] }; } }; } };
  await __test.selectedMappingsForConnection({ DB }, { id: 6, platform: "acg" });
  assert.match(query, /published=1/);
  assert.match(query, /available=1/);
  assert.match(query, /upstream_product_id LIKE/);
});

test("scheduled product sync is adaptive while order polling can stay frequent", async () => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  const old = new Date(Date.now() - 11 * 60_000).toISOString();
  const envFor = value => ({ DB: { prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, async all() { return { results: sql.includes("FROM settings") ? [{ key: this.args[0], value, secret: 0 }] : [] }; } }; } } });
  assert.equal(await __test.scheduledCatalogDue(envFor(recent)), false);
  assert.equal(await __test.scheduledCatalogDue(envFor(old)), true);
});

test("stable healthy checks do not write D1 every two minutes", async () => {
  const DB = { prepare() { throw new Error("unexpected D1 write"); } };
  const result = await __test.updateHealth({ DB }, {
    id: 1,
    name: "Next 上游",
    health_status: "healthy",
    consecutive_failures: 0,
    consecutive_successes: 2,
    last_error_code: "",
    last_checked_at: new Date().toISOString(),
  }, true, "", 30);
  assert.equal(result.written, false);
});

test("Next catalog reads one cached page instead of scanning every mapping", async () => {
  const queries = [];
  const payload = { id: 101, title: { "zh-CN": "缓存商品" }, skus: [] };
  const DB = { prepare(sql) { queries.push(sql); return { args: [], bind(...args) { this.args = args; return this; }, async first() { return sql.includes("COUNT(*)") ? { total: 240 } : null; }, async all() { if (sql.includes("FROM settings")) return { results: [] }; if (sql.includes("SELECT payload_json")) return { results: [{ payload_json: JSON.stringify(payload) }] }; return { results: [] }; }, async run() { return { meta: { changes: 1 } }; } }; } };
  const page = await __test.nextCatalogPage({ DB }, 3, 20);
  assert.equal(page.total, 240);
  assert.deepEqual(page.items, [payload]);
  assert.equal(queries.some(sql => sql.includes("LIMIT ? OFFSET ?")), true);
  assert.equal(queries.some(sql => sql.includes("FROM product_mappings")), false);
});

test("Next catalog repairs a stale cached total after an upstream is deleted", async () => {
  let repairedValue = "";
  const payloads = Array.from({ length: 27 }, (_, index) => ({ payload_json: JSON.stringify({ id: index + 1, skus: [] }) }));
  const DB = { prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, async all() { if (sql.includes("FROM settings")) return { results: [{ key: "next_catalog_product_count", value: "637", secret: 0 }] }; if (sql.includes("SELECT payload_json")) return { results: payloads }; return { results: [] }; }, async first() { return sql.includes("COUNT(*)") ? { total: 27 } : null; }, async run() { if (sql.startsWith("INSERT INTO settings")) repairedValue = String(this.args[1]); return { meta: { changes: 1 } }; } }; } };
  const page = await __test.nextCatalogPage({ DB }, 1, 100);
  assert.equal(page.items.length, 27);
  assert.equal(page.total, 27);
  assert.equal(repairedValue, "27");
});

test("unchanged catalog sync does not scan or rewrite the rendered cache table", async () => {
  const queries = [];
  const DB = { prepare(sql) { queries.push(sql); return { bind() { return this; }, async first() { return { ok: 1 }; } }; } };
  const result = await __test.buildNextCatalogCache({ DB }, "acg_to_next", { id: 8 }, [{
    public_product_id: "1001",
    public_sku_id: "2001",
    snapshot: { name: "测试", price: "10.00", cost_price: "8.00", stock: 9, category_id: 1, category_name: "分类" },
  }], new Date().toISOString(), new Set());
  assert.equal(result.statements.length, 0);
  assert.equal(result.written, 0);
  assert.equal(queries.some(sql => /SELECT \*/.test(sql)), false);
  assert.equal(queries.some(sql => sql.includes("LIMIT 1")), true);
});
