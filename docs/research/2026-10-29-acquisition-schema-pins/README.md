# Acquisition schema-pin verification

**Date:** 2026-10-29. **Status:** implemented; full unchanged-data replay, local gates and independent source review passed. Awaiting PR integration.

Implements the approved follow-up from [issue #322](https://github.com/FlashGalatine/xivdyetools/issues/322) and [PR #372](https://github.com/FlashGalatine/xivdyetools/pull/372). See the [design](../../superpowers/specs/2026-10-29-acquisition-schema-pins-design.md), [plan](../../superpowers/plans/2026-10-29-acquisition-schema-pins.md) and [maintainer instructions](../../maintainer/acquisition-generation.md).

## Data preservation and provenance

The actual generator captured public inputs under Teamcraft commit `acc77d406cc50a78caf0210f805ec7b069607af0`, game version `0874aee069e1e7c4`, and explicitly selected schema `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`. It reproduced 29,058 equipment items, 24,922 acquisition lines and 732 facewear variants. A second complete run read only the cache, with inherited `NODE_OPTIONS` overriding fetch to throw `LIVE_FETCH_FORBIDDEN`.

The [normalized receipt](replay-receipt.json) compares baseline Git blobs, working-tree sources, live-capture candidates and offline replay outputs. Acquisition data (1,329,924 bytes) and facewear mapping (8,678 bytes) have identical SHA256 values across all four copies. Replay metadata equals the original metadata after removing the newly verified `xivapiSchema` field. No game-version, Teamcraft-commit, generation-date, count, acquisition-text, vendor-rule or translation-data refresh is included.

The 430 cache entries contain 411 XIVAPI requests and 19 Teamcraft files. Every full-URL hash and immutable source selector was checked; every XIVAPI request/response carries the same canonical game/schema pair. This includes all 58 equipment search cursor pages. Raw responses remain temporary local maintenance inputs rather than committed datasets. This receipt does not make them permanently archived or guarantee that upstream will reproduce them indefinitely.

The added schema field records this successful regeneration and offline replay. It does not establish the schema used by the historical run, whose metadata omitted it.

## Failure controls

- Before integration, the legacy `--pinned` CLI lacked a schema preflight and attempted 18 Teamcraft requests; a fetch blocker recorded the URLs and stopped the run without making external requests. It now rejects incomplete/invalid pin selections before any HTTP; unit tests retain legacy-metadata coverage after the verified schema enrollment.
- Output-order tests failed against the previous write-before-review sequence, then passed when the review moved before adoption.
- A final-review `Item`/`Name,Description` cache response was changed to a conflicting schema. The actual generator, running offline with fetch blocked, exited 1 with a fixed-pin conflict. Existing acquisition, facewear and metadata sentinel files all remained unchanged. The original cached bytes were restored afterward.
- The transport suite exercises discovery, response conflicts, cursor identities, malformed/missing cache entries, independent schema cache namespaces, 429/503 failures, bounded 5xx retries, stalled fetch/body deadlines and body caps. CLI subprocess tests prove no live fallback on preflight errors/offline misses and preserve both candidate and production outputs.

Source files for acquisition selection/formatting were not changed. The maintained terminology guide now records the user's rule that XIVAPI's corresponding localized game-data field is authoritative. Applying a separate translation-data update remains outside this maintenance implementation.

## Verification commands

Run from the repository root:

```powershell
pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition --coverage.enabled=false
pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker --concurrency=1
pnpm type-check:scripts
pnpm test:scripts
pnpm dead-code:check
pnpm docs:check-versions
pnpm docs:check-links
pnpm workers:check-logs
```

The focused integration run passed 188 acquisition tests across ten files. The full affected API graph passed 11/11 tasks and 895 tests across 45 files, with enforced coverage; lint had no errors and nine existing warnings. Root script tests passed 167/167; script types, reachability, 34 version claims and seven Workers Logs configurations passed. Final documentation validation resolved 1,038 links across 262 files. Independent Sol xhigh source review passed after correcting the preflight evidence wording above. No package publication, deployment, production activation or migration was performed.
