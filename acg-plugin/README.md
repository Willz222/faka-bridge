# 异次元回调插件

这个插件只做一件事：Next 管理员人工发货后，接收 Faka Bridge 的签名回调，并把卡密写回对应的异次元订单。它没有单独的发货后台。

## 安装

1. 把 `app/Controller/Shared/NextBridgeCallback.php` 复制到异次元同路径。
2. 把 `app/Plugin/NextBridge` 文件夹复制到异次元同路径。
3. 将 `Config.example.php` 复制为 `Config.php`，填入 Worker 后台生成的回调密钥和 Worker 域名。
4. 导入 `install.sql`。如果你的数据库表前缀不是 `acg_`，先替换 SQL 中的前缀。
5. Worker 后台的“异次元插件回调地址”填写：
   `https://你的异次元域名/shared/nextBridgeCallback/deliver`

请保持服务器时间同步。插件校验 HMAC-SHA256、5 分钟时间窗、一次性 nonce 和订单共享来源，不会把卡密写进日志。
