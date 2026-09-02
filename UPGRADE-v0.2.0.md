# Faka Bridge v0.2.0 升级说明

本次升级包含 D1 结构变更。直接替换 Worker 代码前，必须先备份 D1，并执行 `migrations/0006_production_safety_and_operations.sql`。

## 从 v0.1.0 升级

1. 在 Cloudflare D1 页面为当前数据库创建书签或导出备份。
2. 打开 D1 控制台，完整执行 `migrations/0006_production_safety_and_operations.sql` 一次。
3. 执行下面的检查 SQL，确认新列存在：

```sql
SELECT connection_id, submission_state, upstream_cost
FROM bridge_orders
LIMIT 1;

SELECT balance, balance_currency, sync_interval_minutes
FROM upstream_connections
LIMIT 1;
```

即使两张表暂时没有数据，只要查询没有返回 `no such column` 就表示迁移成功。

4. 用 `release/faka-bridge-worker-v0.2.0.txt` 的全部内容替换 Worker 代码并部署。
5. 打开 `/health`，确认版本为 `0.2.0`。
6. 打开 `/health/ready`，确认 `ok` 为 `true`，数据库状态为 `ready`。
7. 登录后台，检查上游连接、已勾选商品、价格策略和回调主机，然后使用测试商品走一笔完整订单。

迁移不可重复执行。若再次执行出现 `duplicate column name`，不要继续执行后面的语句；先确认数据库实际结构和已经执行到哪一行。

## 可选 Cloudflare 绑定

完整项目的 `wrangler.jsonc` 包含两个限流绑定：

- `API_RATE_LIMITER`：普通目录和查询接口，每分钟 180 次。
- `ORDER_RATE_LIMITER`：关键下单接口，每分钟 30 次。

网页控制台直接粘贴单文件且未配置 `ORDER_RATE_LIMITER` 时，Worker 会自动使用 D1 做关键下单限流，不会绕过保护。

生产环境还可以增加普通变量 `UPSTREAM_ALLOWED_HOSTS`，值为允许访问的上游主机名，多个主机用英文逗号分隔。启用前应把当前所有上游主机都加入，否则对应连接会被拒绝访问。

## Cron 行为

触发器仍为 `*/2 * * * *`。每两分钟只进行轻量调度：

- 没有到期待发货订单：不访问上游订单查询接口。
- 没有失败回调：不发送回调请求。
- 某个上游未到自己的刷新间隔：不读取该上游商品。
- 完整候选商品目录：仅新增连接或手动“强制刷新完整商品库”时读取。
- 健康和余额：最多每 30 分钟检测一次。
- 数据清理：最多每天执行一次，并按小批量删除。

## 回退

Worker 代码可以回退，但 `0006` 新增列无需删除；旧代码会忽略这些列。不要手工删除订单列或重建订单表。若迁移过程中出现异常，应优先使用升级前创建的 D1 书签恢复。
