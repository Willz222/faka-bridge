<?php
declare(strict_types=1);

return [
    // 与 Worker 后台“插件回调密钥”完全一致，至少 32 个字符。
    'callback_secret' => 'replace-with-the-secret-generated-by-worker',

    // 只写 Worker 域名或完整 HTTPS 地址，不要带回调路径。
    'worker_host' => 'bridge.example.workers.dev',

    // 允许的服务器时钟偏差（秒），建议保持 300。
    'max_skew' => 300,
];
