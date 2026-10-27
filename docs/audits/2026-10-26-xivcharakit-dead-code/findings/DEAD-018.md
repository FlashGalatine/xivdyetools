# DEAD-018: Redundant status === 503 test in XivapiClient.get
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker (app, unpublished; 0.21.0) · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: it simplifies a production condition in the api-worker XivapiClient (internal app code, behavior identical).

## Location
- `apps/api-worker/src/chara/xivapi.ts:399`

## Evidence
- sed -n 370,402p xivapi.ts: line 399 reads `if (response.status === 503 || response.status >= 500 || response.status === 429)`; Response.status is a number, so 503 always satisfies `>= 500` and the `=== 503` disjunct can never change the outcome or the thrown UpstreamUnavailableError(status, ...). git log -S: clause introduced in 1d13e4c2 with the feature, no separate rationale. git grep -w "status === 503": only other hit is scripts/build-acquisition.ts:73 (independent retry logic, untouched). Tests xivapi.test.ts:300/442, lookup-loader.test.ts:201/277, router.test.ts:365 exercise 503 and stay green since behavior is identical. The 503 re-indexing case is still documented in the docblock at xivapi.ts:14-17.
- Pure boolean redundancy: `x === 503` implies `x >= 500`, so removing the disjunct is behavior-identical for every possible status. No consumer can observe the difference; the app is not published. Value is readability only (0 lines removed, one expression simplified).

## Fix
- **REMOVE** — Edit apps/api-worker/src/chara/xivapi.ts:399 to `if (response.status >= 500 || response.status === 429) {` (one-line modification, no deletions elsewhere; keep the docblock at lines 14-17 that explains the search re-indexing 503). No barrel, test, or data changes. Gate: pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker. Can be bundled with any api-worker release; no version bump needed for this alone.
- Cascade: None. The 503-specific semantics (XIVAPI search re-indexing) remain documented in the file header comment at xivapi.ts:14-17 and covered by existing 503 tests.

## Status
OPEN — source prepared in A-API: remove only the redundant `status === 503` disjunct, retaining `>= 500`, 429 handling and the re-indexing explanation; [API evidence](../../2026-10-26-security/evidence/remediation-api-2026-10-27.md). Merge and production acceptance remain pending.
