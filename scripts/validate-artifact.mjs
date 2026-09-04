import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/worker/index.js");
const wranglerPath = resolve(projectRoot, "dist/wrangler.jsonc");
const migrationPath = resolve(projectRoot, "dist/migrations/0007_v030_reliability.sql");

const [source, wrangler, migration] = await Promise.all([
  readFile(workerPath, "utf8"),
  readFile(wranglerPath, "utf8"),
  readFile(migrationPath, "utf8"),
]);
JSON.parse(wrangler.replace(/^\s*\/\/.*$/gm, ""));
assert.match(migration, /opaque_id_registry/);
assert.match(migration, /bridge_orders_submission_idx/);
assert.doesNotMatch(migration, /DROP\s+TABLE/i);

// A data URL forces ESM parsing even though the generated output has no package.json.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const workerModule = await import(moduleUrl);
assert.equal(
  typeof workerModule.default?.fetch,
  "function",
  `${pathToFileURL(workerPath)} must export default.fetch`,
);
assert.equal(workerModule.__test.VERSION, "0.3.0");
assert.equal(workerModule.__test.orderDirectionForMapping("next", { direction: "acg_to_next" }), "next_to_next");
assert.equal(workerModule.__test.orderDirectionForMapping("acg", { direction: "next_to_acg" }), "acg_to_acg");
assert.equal(workerModule.__test.ADMIN_PAGE.includes("强制刷新完整商品库"), true);
assert.equal(workerModule.__test.ADMIN_PAGE.includes("高级手工映射"), false);
assert.equal(workerModule.__test.ADMIN_PAGE.includes("订单与异常核对"), true);
assert.equal(workerModule.__test.ADMIN_PAGE.includes("导出 CSV"), true);
assert.equal(workerModule.__test.ADMIN_PAGE.includes("confirm("), false);
assert.equal(workerModule.__test.ADMIN_PAGE.includes("restoreAdminView"), true);
assert.equal(workerModule.__test.LOGIN_PAGE.includes("ADMIN_USERNAME"), false);
assert.equal(workerModule.__test.nextSkuDisplayName({ sku_code: "SKU-4", spec_values: { region: "菲区", plan: "代充Plus-1个月" } }), "菲区-代充Plus-1个月");
assert.equal(workerModule.__test.normalizedNextStock("unlimited", -1), -1);
assert.equal(workerModule.__test.stockAvailable(-1, 999999), true);
assert.equal(workerModule.__test.acgStock(-1), 999999);
assert.equal(workerModule.__test.upstreamNextSkuId({ upstream_sku_id: "123" }), 123);

console.log("Artifact is valid ESM and exports default.fetch");
