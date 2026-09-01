# Security Policy

## Supported version

The latest public release receives security fixes. Validate every configured bridge direction with test products before production use.

## Reporting a vulnerability

Please do not publish credentials, delivery contents, customer information, or an exploitable proof of concept in a public issue. Contact the repository maintainer privately and include the affected version, impact, and minimal reproduction steps with secrets removed.

## Deployment checklist

- Store `ADMIN_PASSWORD`, `SESSION_SECRET`, and `MASTER_KEY` only as Cloudflare Worker Secrets.
- Put Cloudflare Access or an equivalent identity gate in front of `/admin*`.
- Use HTTPS for every upstream and callback endpoint.
- Use exact downstream callback host allowlists; do not add wildcards.
- Keep the异次元 server clock synchronized and protect the callback plugin files from modification.
- Rotate bridge credentials after suspected exposure. Rotation invalidates the previous credential immediately.
- Do not log request bodies on API or callback routes at the reverse proxy layer.
- Keep bidirectional price protection enabled. A live quote failure or a cost above the configured safe limit must block the order instead of falling back to a stale cache.
- Apply every database migration before deployment. The rate-limit and job-lock tables are required for persistent protection across Worker isolates.

## Security model

The bridge prevents accidental disclosure to downstream buyers by translating all public product and order identifiers. Each mapping carries only an internal encrypted/opaque connection reference, so multi-upstream routing does not expose the selected upstream. Secrets and undelivered fulfillment payloads are encrypted with AES-GCM before D1 storage. Telegram messages are sanitized and exclude delivery payloads, credentials, upstream URLs, customer contacts, and upstream identifiers. API and callback requests are signed, rate-limited, replay-limited where the protocol provides a nonce or order number, and returned errors are intentionally generic. Order rows are reserved atomically before any upstream purchase call, so concurrent duplicate requests cannot create two upstream orders.

An administrator with Worker configuration access, an attacker controlling either upstream platform, or compromised origin application code remains inside the trusted boundary. This project does not replace host hardening, database backups, Cloudflare account MFA, or application updates.
