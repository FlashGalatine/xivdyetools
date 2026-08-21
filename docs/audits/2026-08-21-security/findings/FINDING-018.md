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
