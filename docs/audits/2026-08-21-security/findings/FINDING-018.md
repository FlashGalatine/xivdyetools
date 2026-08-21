# FINDING-018: Rejected/deleted preview images remain in edge and browser caches for up to a year (`immutable`, no purge on takedown)

## Severity
**LOW** — content a moderator removed stays reachable at its old URL via caches; the UUID key prevents reuse but not retention. Reviewer ID: PAPI-4. Coordinator-verified (`preview-image-service.ts:80-90`).

## Category
CWE-459 Incomplete Cleanup · content-takedown hygiene

## Location
- `apps/presets-api/src/services/preview-image-service.ts:80-96` — `cacheControl: 'public, max-age=31536000, immutable'` on every R2 object.
- `apps/presets-api/src/handlers/moderation.ts:242-255` — reject/delete removes the R2 object but does not purge the edge cache (`shots.xivdyetools.app`).

## Recommendation
Use a shorter `s-maxage` (e.g. 1 day) with `stale-while-revalidate`, or call the Cloudflare cache-purge API for the image URL on reject/delete; keep `immutable` for browser cache only if the edge TTL is short.

## References
- Evidence: `../evidence/review-presets-api.md` (PAPI-4)

## Status
**FIXED 2026-08-21** (presets-api 2.1.0; purge is opt-in via two secrets)
- presets-api 2.1.0: preview images served with `public, max-age=31536000, immutable, s-maxage=86400` (edge TTL 1 day); `purgePreviewImageCache()` single-file Cloudflare purge when the optional `CACHE_PURGE_ZONE_ID` / `CACHE_PURGE_API_TOKEN` secrets are set (5 s timeout, never throws); `deletePreviewImage` = R2 delete then purge on reject / author delete / preset delete / replace. Deploy note: set the two optional secrets on production (post-merge checklist).
