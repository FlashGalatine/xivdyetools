# FINDING-021: No freshness window on Discord `X-Signature-Timestamp` — captured interactions can be replayed

## Severity
**LOW** — replay requires capturing a signed interaction (TLS-protected) and re-executes a command as that user; effects are bounded (ephemeral replies, idempotent or conditional writes in presets-api). Reviewer IDs: DW-5, PKG-12, MOD-10.

## Category
CWE-294 Authentication Bypass by Capture-replay

## Location
- `packages/auth/src/discord.ts:58-118` — verifies Ed25519 over `timestamp + rawBody` but never compares `timestamp` to `Date.now()`; body fully buffered before the 100 KB check.
- Consumers: `apps/discord-worker/src/index.ts:518`, `apps/moderation-worker/src/index.ts:116-184`.

## Recommendation
Reject interactions whose timestamp is older than ~5 minutes (Discord itself retries within seconds), and check `Content-Length` before buffering.

## References
- Evidence: `../evidence/review-packages.md` (PKG-12), `../evidence/review-discord-worker.md` (DW-5)
