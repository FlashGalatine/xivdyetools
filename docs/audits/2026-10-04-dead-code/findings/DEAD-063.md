# DEAD-063: presets-api GET /presets/featured and /presets/rate-limit have no in-repo client once the dead web-app methods go; documented public API, so KEEP (~35 route lines)
**Confidence:** MEDIUM · **Blast radius:** HIGH · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/presets-api/src/handlers/presets.ts:266` — GET /api/v1/presets/featured (:262-271) and GET /api/v1/presets/rate-limit (:302-326)

## Evidence
- Grep finds no in-repo caller in any worker, web-app (src/e2e/functions), package, or stoat-worker once the dead web-app methods go. Both routes are on the routed custom domain api.xivdyetools.app and documented as a contract, so like /moderation/:id/history they are kept and not cleaned up.
  - Commands: git grep 'presets/featured|presets/rate-limit' -> only presets-api routes/tests/docs, web-app dead methods, msw/e2e mocks; no service-binding caller; wrangler.toml [env.production] routes api.xivdyetools.app; docs: api-contracts.md:178 ('Public'),201; endpoints.md:119,204; overview.md:89; README:16,18; CLAUDE.md:223,235; spec community-presets.md:370
- Origin: At 8ecb878f the only clients (web-app getFeaturedPresets / getRemainingSubmissions) already had zero production callers, with the same grep counts. f1b54a0f (#224) touched handlers/presets.ts but did not add or remove these routes or their clients.

## Fix
**KEEP.** Revisit trigger: an explicit presets-api API deprecation decision (a v2 or major contract change) that updates api-contracts.md, endpoints.md, overview.md, the README, CLAUDE.md and community-presets.md, and/or Workers analytics showing zero external traffic. /rate-limit is the weaker keep: it needs a user JWT, and POST / already returns remaining_submissions (:1120). Separately, README.md:16 says 'Curated' but CLAUDE.md:223 says there is no is_curated filter. That is a doc fix, not dead code.

Steps: No removal. Optional doc fix: apps/presets-api/README.md:16 change 'Curated featured presets' to 'Top 10 approved presets by vote count', then pnpm docs:check-links. If a deprecation is later approved, remove the routes at handlers/presets.ts:262-271 and :302-326, the server tests (presets.test.ts:215-~234, :282-~310, :3741-3750), and the getFeaturedPresets service and its test. Keep getRemainingSubmissions, because POST / uses its own count. Update all 6 docs, then run pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api && pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
