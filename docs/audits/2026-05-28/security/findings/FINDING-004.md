# [FINDING-004]: discord-worker applies wildcard CORS to all routes

## Severity
LOW

## Category
CWE-942: Permissive Cross-domain Policy

## Location
- File: `apps/discord-worker/src/index.ts`
- Line: 79 — `app.use('*', cors());`

## Description
The discord-worker mounts Hono's `cors()` middleware with **no configuration**, which
defaults to `Access-Control-Allow-Origin: *` for every route — including the webhook
endpoints (`/webhooks/preset-submission`, `/webhooks/github`) and the Discord interactions
endpoint (`POST /`).

By contrast, `presets-api`, `oauth`, and `universalis-proxy` all use explicit origin
allowlists.

## Impact
**Not directly exploitable today.** Every sensitive endpoint on this worker is protected by
a *cryptographic* check that CORS has no bearing on:
- `POST /` — Ed25519 signature (Discord).
- `/webhooks/preset-submission` — Bearer `INTERNAL_WEBHOOK_SECRET` (timing-safe).
- `/webhooks/github` — HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET`).

CORS protects browser-initiated cross-origin reads; these endpoints are server-to-server
(Discord, GitHub, sibling workers) and carry no ambient browser credentials. So wildcard
CORS does not grant an attacker anything. It is flagged as a hardening/consistency item.

## Recommendation
If no browser on an arbitrary origin needs to call this worker, drop the wildcard or scope
it to known origins, matching the other workers:
```typescript
app.use('*', cors({ origin: [env.APP_ORIGIN], allowMethods: ['POST', 'GET', 'OPTIONS'] }));
```
If a browser *does* legitimately need cross-origin access (e.g. a health check from the web
app), restrict to that origin explicitly rather than `*`.

## References
- CWE-942; MDN CORS
