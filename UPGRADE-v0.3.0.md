# Faka Bridge v0.3.0 升级说明

本次升级包含一项安全的 D1 增量迁移。请严格按照“先执行 0007，再替换 Worker 代码”的顺序升级。

## 从 v0.2.0 升级

1. 在 Cloudflare D1 页面为当前数据库创建书签或导出备份。
2. 打开当前 Worker 绑定的 D1 数据库控制台。
3. 完整执行 `migrations/0007_v030_reliability.sql` 一次。
4. 执行下面的检查 SQL：

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table' AND name = 'opaque_id_registry';

SELECT name
FROM sqlite_master
WHERE type = 'index' AND name = 'bridge_orders_submission_idx';
```

正常情况下，两条查询分别返回：

- `opaque_id_registry`
- `bridge_orders_submission_idx`

5. 用 `release/faka-bridge-worker-v0.3.0.txt` 的全部内容替换 Worker 代码并部署。
6. 打开 `/health`，正常结果应包含 `"ok":true` 和 `"version":"0.3.0"`。
7. 登录后台，在“通知与系统”点击“检查运行环境”。
8. 检查价格保护仍为开启状态，再分别测试商品刷新、Telegram 和一笔低价测试订单。

## 本次迁移会做什么

- 新建 `opaque_id_registry`，记录稳定的公开商品与 SKU 编号；若不同商品生成相同编号，系统会自动重新派生。
- 把现有商品和 SKU 的公开编号写入注册表，不修改现有正常编号。
- 新建 `bridge_orders_submission_idx`，供 Cron 快速处理卡在创建阶段的订单。
- 不删除订单、商品、连接、价格规则或密钥。

## Cron 行为

Cron 仍为 `*/2 * * * *`：

- 没有待处理订单时，不请求上游订单接口。
- 不再每两分钟对整张订单表执行统计扫描。
- 预占超过 5 分钟且从未提交的订单会安全标记失败。
- 已经提交超过 10 分钟但没有确定结果的订单会转为“待人工核对”，不会自动重复购买。
- 商品、健康检测和每日清理仍按各自间隔运行。

## 回退

Worker 代码可以临时回退到 v0.2.0，`opaque_id_registry` 表和新增索引可以保留，旧代码会忽略它们。不要删除或重建订单表。
