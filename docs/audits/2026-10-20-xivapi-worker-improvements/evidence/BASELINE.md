# Planning evidence — API-worker XIVAPI follow-up

**Verified:** 2026-10-20 (America/New_York).

**Code baseline:** `0cf9d00c79f4d669fc76e72a0d39ecd46e071f69`.

**Method:** Read current source/tests, compare with issue #322 research, refresh primary documentation and make one small read-only context probe. No load test, production traffic measurement or implementation was performed.

## Source references

Paths below are relative to the repository at the baseline.

| ID | Evidence |
|---|---|
| XIVAPI-001 | `apps/api-worker/src/chara/cache.ts:38-46`: shape version 5 plus game-only prefix. `xivapi.ts:281-315`: game-only memo/last good key and another namespace resolution while building request params. `router.ts:213-254`: cache construction, batched misses and later Glasses request. |
| XIVAPI-002 | `apps/api-worker/src/chara/xivapi.ts:116-121,395-396`: asset URL has path/format but no version. `router.ts:49,297-299,348`: unversioned default-cache key, query stripping and 30-day immutable header. |
| XIVAPI-003 | `router.ts:301-355`: no retained-validator/freshness branch; current streamed body cap and PNG guard at lines 322-338. `src/universalis/services/cache-service.ts:128-157,178-183` shows the existing separate freshness/retention pattern, but it stores JSON and should not be modified for icon transport. |
| XIVAPI-004 | `router.ts:223,254`: each request fetches its own misses. `xivapi.ts:151,281-298`: context/version discovery already shares a Promise. `src/universalis/services/request-coalescer.ts` is a separate existing path, not evidence that chara already coalesces. |

Exact source extraction used:
```powershell
$planSources = git ls-files -- apps/api-worker/src/chara/cache.ts apps/api-worker/src/chara/xivapi.ts apps/api-worker/src/chara/router.ts apps/api-worker/src/chara/types.ts apps/api-worker/docs/reference/chara.md apps/api-worker/src/universalis/services/cache-service.ts
rg -n 'SHAPE_VERSION|gameVersion|prefix =|cacheNamespace\(|versionKeyMemo|lastResolvedKey|VERSION_KEY_TTL|VERSION_KEY_FAILURE|VERSION_LOOKUP_TIMEOUT|async params|async searchItems|async getGlasses|iconAssetUrl\(|async fetchIcon|ICON_CACHE_CONTROL|MAX_ICON_BYTES|const cache =|client.searchItems|client.getGlasses|url.search|caches.default|readBoundedBytes|isPng\(|isStale|X-Cached-At|max-age|version: string' -- $planSources
```

Current `router.test.ts` covers cached replay, Glasses, truncated search, body limits, PNG validation, canonical icon IDs and version movement. Current `xivapi.test.ts` covers version TTL/failure fallback, schema parameters, redirect refusal, timeout and search truncation. It does not prove the proposed cross-request context or coalescing behavior.

The planning worktree is based on origin/main. `git diff --stat origin/main -- apps/api-worker` was empty before writing the plan. The prior research worktree's API-worker source also matches this baseline, despite its additional core/audit changes.

## Small context probe

Request:
```powershell
Invoke-WebRequest -Uri 'https://v2.xivapi.com/api/sheet/Item/1?fields=Name' -Headers @{ 'User-Agent' = 'XIVDyeTools/1.0 (+https://xivdyetools.app; planning-read-only)' } -TimeoutSec 10 -MaximumRedirection 0 -UseBasicParsing
```

HTTP **200** returned [context-probe.json](context-probe.json). It includes row 1 (`Gil`), canonical game key `0874aee069e1e7c4`, and canonical schema `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`. This verifies the proposed discovery shape for this snapshot only, not all pins, versions, fields or future service behavior. The implementation must validate the response and retain an uncached failure path; this is not a proposed production pin.

The web research tool could read documentation but could not retrieve the API JSON URL; the one successful API read above used the shell with a descriptive User-Agent. No credentials or character data were sent.

## Primary documentation checked

- [XIVAPI stability/pinning](https://v2.xivapi.com/docs/guides/pinning/): game and schema selectors are distinct; response schema is canonical, and full EXDSchema revisions are canonical specifiers. This supports capturing both before caching.
- [XIVAPI assets](https://v2.xivapi.com/docs/guides/assets/): asset endpoints provide ETag and honor If-None-Match. This supports the conditional refresh proposal.
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/): cache storage is local to a data center and honors cache response headers. This limits the proposal's coordination claims.
- [Cloudflare context](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil): waitUntil extends bounded work after response/disconnect; it is not durable scheduling.
- [Cloudflare cross-request I/O errors](https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request): do not share streams, request/response bodies or other invocation-owned I/O objects; share decoded data instead.

The pinning page's derived summary is limited to the context decision above; the exact full identifiers come from our API probe. Planned timeout/TTL/cap choices are project decisions, not XIVAPI quota/SLA claims.

## Delivery status

Issue #322 is open. [PR #324](https://github.com/FlashGalatine/xivdyetools/pull/324) is open and unmerged at verification time, with head `e0e48bf5813d53addccd6084af6725868139c1c1`. It delivers the completed dye audit, not these worker changes. Live state can change after this snapshot.

The worker's baseline package version is 0.20.1. `.github/workflows/deploy-api-worker.yml` deploys production from main when its path filter matches, builds the static docs and performs health/docs smoke checks. This plan does not trigger that workflow.

## Planning verification

- Installed the locked dependencies in the isolated worktree with `pnpm install --frozen-lockfile`; no lockfile or product changes.
- `pnpm docs:check-versions`: 34 version claims matched their package files.
- `pnpm docs:check-links`: 1,018 links in 257 documents resolved. This gate excludes the archive; an additional local check verified all eight relative links in this new folder against tracked paths.
- Parsed the captured JSON and checked its canonical identity forms, four task headings, exactly one sprint assignment per selected ID, absence of placeholders, and the archive table row.
- Inline self-review checked design coverage, interface/result consistency, fallback ownership, icon retention versus public headers, and scope. The plan carries identity metadata through the loader and a cache-update value from icon loading to the route's own execution context.
- Final staged whitespace check is required before the local milestone commit. Product/runtime gates are specified for implementation and were not run for this documentation-only change.
