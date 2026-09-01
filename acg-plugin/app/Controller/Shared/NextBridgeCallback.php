<?php
declare(strict_types=1);

namespace App\Controller\Shared;

use App\Controller\Base\API\Shared;
use App\Interceptor\Waf;
use App\Model\Order;
use Illuminate\Database\Capsule\Manager as DB;
use Kernel\Annotation\Interceptor;
use Kernel\Exception\JSONException;

/**
 * Dujiao-Next 人工发货完成后，由 Faka Bridge 调用此接口覆盖订单卡密。
 *
 * 安全边界：不接受浏览器会话、不信任订单号、不记录卡密；请求必须通过
 * HMAC、时间窗口、一次性 nonce、订单来源域名四项校验。
 */
#[Interceptor(Waf::class, Interceptor::TYPE_API)]
class NextBridgeCallback extends Shared
{
    private const MAX_BODY_BYTES = 1048576;

    /** @throws JSONException */
    public function deliver(): array
    {
        $configFile = BASE_PATH . '/app/Plugin/NextBridge/Config/Config.php';
        if (!is_file($configFile)) {
            throw new JSONException('bridge callback unavailable');
        }
        $config = require $configFile;
        $secret = (string)($config['callback_secret'] ?? '');
        $allowedHost = strtolower((string)($config['worker_host'] ?? ''));
        $maxSkew = max(30, min(600, (int)($config['max_skew'] ?? 300)));
        if (strlen($secret) < 32 || $allowedHost === '') {
            throw new JSONException('bridge callback unavailable');
        }

        $raw = (string)file_get_contents('php://input');
        if ($raw === '' || strlen($raw) > self::MAX_BODY_BYTES) {
            throw new JSONException('invalid callback');
        }
        $timestamp = (string)($_SERVER['HTTP_BRIDGE_TIMESTAMP'] ?? '');
        $nonce = (string)($_SERVER['HTTP_BRIDGE_NONCE'] ?? '');
        $signature = strtolower((string)($_SERVER['HTTP_BRIDGE_SIGNATURE'] ?? ''));
        if (!ctype_digit($timestamp) || abs(time() - (int)$timestamp) > $maxSkew
            || !preg_match('/^[a-f0-9-]{20,80}$/i', $nonce)
            || !preg_match('/^[a-f0-9]{64}$/', $signature)) {
            throw new JSONException('invalid callback');
        }
        $expected = hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . hash('sha256', $raw), $secret);
        if (!hash_equals($expected, $signature)) {
            throw new JSONException('invalid callback');
        }

        $body = json_decode($raw, true);
        $eventId = (string)($body['event_id'] ?? '');
        $tradeNo = (string)($body['order_no'] ?? '');
        $payload = (string)($body['payload'] ?? '');
        if (($body['status'] ?? '') !== 'delivered'
            || !preg_match('/^evt_[a-zA-Z0-9]{16,80}$/', $eventId)
            || $tradeNo === '' || strlen($tradeNo) > 128
            || $payload === '' || strlen($payload) > self::MAX_BODY_BYTES) {
            throw new JSONException('invalid callback');
        }

        DB::transaction(function () use ($eventId, $nonce, $tradeNo, $payload, $allowedHost): void {
            // event_id 与 nonce 均唯一；重复回调安全地返回成功。
            if (DB::table('next_bridge_event')->where('event_id', $eventId)->exists()) {
                return;
            }
            if (DB::table('next_bridge_event')->where('nonce', $nonce)->exists()) {
                throw new JSONException('invalid callback');
            }

            /** @var Order|null $order */
            $order = Order::query()->with('commodity.shared')
                ->where('trade_no', $tradeNo)->lockForUpdate()->first();
            if (!$order || (int)$order->status !== 1 || !$order->commodity || !$order->commodity->shared) {
                throw new JSONException('order unavailable');
            }

            // 只能更新“上游地址正是本 Worker”的共享商品订单。
            $sourceHost = strtolower((string)parse_url((string)$order->commodity->shared->domain, PHP_URL_HOST));
            $configuredHost = strtolower((string)(parse_url($allowedHost, PHP_URL_HOST) ?: $allowedHost));
            if ($sourceHost === '' || !hash_equals($configuredHost, $sourceHost)) {
                throw new JSONException('order unavailable');
            }

            $order->secret = $payload;
            $order->delivery_status = 1;
            $order->save();
            DB::table('next_bridge_event')->insert([
                'event_id' => $eventId,
                'nonce' => $nonce,
                'order_id' => (int)$order->id,
                'body_hash' => hash('sha256', $payload),
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        });

        return $this->json(200, 'success', []);
    }
}
