# FINDING-014: Bot→API HMAC signs only `timestamp:userId:userName` — no method/path/body binding, ambiguous `:` delimiter, ~6-minute replay window, no nonce

## Severity
**LOW** — exploitation requires `BOT_API_SECRET` (bearer) plus a captured signed tuple, or network position inside Cloudflare; design weakness rather than a live break. Reviewer IDs: PKG-1, PAPI-7, DW-11, MOD-11. Coordinator-verified at `hmac.ts:237-277`.

## Category
CWE-347 Improper Verification of Cryptographic Signature (insufficient binding) · CWE-294 Authentication Bypass by Capture-replay

## Location
- `packages/auth/src/hmac.ts:237-277` — `verifyBotSignature()` message = `` `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}` ``; `maxAgeMs` 5 min + 60 s skew; `(123,"a:b")` and `("123:a","b")` collide.
- `apps/presets-api/src/middleware/auth.ts:177-206` — consumer; `apps/discord-worker/src/services/preset-api.ts:52-60`, `apps/moderation-worker/src/services/preset-api.ts:76-86` — producers.

## Recommendation
Sign a canonical string with unambiguous encoding: `method\npath\nsha256(body)\ntimestamp\nnonce\nuserId\nuserName` (length-prefix or JSON-encode fields), keep a short nonce cache (KV/memory) to reject replays, and shrink the window to ~60 s. Both producers and the consumer live in this repo, so the change can ship atomically.

## References
- Evidence: `../evidence/review-packages.md` (PKG-1), `../evidence/review-presets-api.md` (PAPI-7)

## Status
**FIXED 2026-08-21** — `fix(packages,bots,presets-api): bot signature v2, interaction freshness, logger/svg/core hardening, Discord sanitiser (FINDING-014/021/026/027/028)`: `@xivdyetools/auth` 1.4.0 `createBotSignatureV2`/`verifyBotSignatureV2` (length-prefixed canonical string over method/path/body-hash/timestamp/nonce/identity, 60 s window); presets-api verifies v2 whenever present (no downgrade to v1), v1 kept for rollover; discord-worker + moderation-worker send `X-Request-Signature-V2` + `X-Request-Nonce`. Residual: nonce is bound but not cached for strict single-use (documented); v1 acceptance to be removed after both bots deploy.
