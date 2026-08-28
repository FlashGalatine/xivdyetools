# FINDING-033: discord-worker hardening — `/swatch` attachment fetch without timeout/host check, `/stats summary` exempt from rate limiting, `/budget` world override bypasses `validateWorld()`

## Severity
**LOW** — the attachment object comes from Discord's `resolved.attachments` (not a free-form user URL), the stats path is read-only KV scans, and the world string only reaches api-worker's validated proxy; each is a robustness gap rather than a break. Reviewer IDs: DW-4, DW-7, DW-9. Coordinator-verified at the cited lines.

## Category
CWE-400 · CWE-20

## Location
- `apps/discord-worker/src/handlers/commands/swatch.ts:54-62, 92, 104` — `fetch(attachment.url)` with no timeout, no Discord-CDN host assertion, and trust in `attachment.size` (no post-download cap).
- `apps/discord-worker/src/index.ts:632` + `handlers/commands/stats.ts:144-188` + `services/analytics.ts:221-290` — public `/stats summary` is exempt from the per-user limiter yet runs paginated KV `list()` scans.
- `apps/discord-worker/src/handlers/commands/budget.ts:136, 167, 419, 431` — `world:` option used directly (`worldOverride ?? prefs.world`); only `set_world` calls `validateWorld()`.

## Recommendation
`AbortSignal.timeout(10_000)` + host allowlist (`cdn.discordapp.com`, `media.discordapp.net`) + bounded read for `/swatch`; apply the standard limiter to `/stats`; run `validateWorld()` on every `world:` input.

## References
- Evidence: `../evidence/review-discord-worker.md` (DW-4, DW-7, DW-9)

## Status
**FIXED 2026-08-21** (discord-worker 5.0.0)
- discord-worker 5.0.0: `/swatch` attachment fetch — HTTPS + host allowlist (`cdn.discordapp.com`, `media.discordapp.net`) before deferring, `redirect:'error'`, 10 s timeout, Content-Length pre-check + streamed 1 MiB cap; `/stats` no longer exempt from the per-user rate limiter; `/budget` `world:` override goes through `validateWorld()` (canonical name, `worldNotFound`). Not done (INFO, out of brief): `BOT_VERSION` constant, `/preferences set world:` validation, `copy.ts` custom_id echo.
