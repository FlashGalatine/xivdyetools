# XIVAPI worker improvements — proposed design

**Date:** 2026-10-20 (America/New_York)

**Status:** Draft for review; planning only. No runtime, data, configuration or version changes.

**Issue:** [#322](https://github.com/FlashGalatine/xivdyetools/issues/322)

**Baseline:** `0cf9d00c79f4d669fc76e72a0d39ecd46e071f69` (`origin/main`).

**Planning branch:** `docs/xivapi-worker-improvements-plan`.

Make the existing optional equipment, facewear and icon enrichment more consistent across upstream updates, and reduce duplicate requests during concurrent imports. Keep local character parsing, dyes, all six supported locales, acquisition interpretation and the public resolve envelope as they are.

This is a separate proposal from [PR #324](https://github.com/FlashGalatine/xivdyetools/pull/324), which implements the completed maintenance-time dye audit. That PR remains open at planning time. Its archived research is the source for this follow-up; its core tooling is not a runtime prerequisite.

| File | Purpose |
|---|---|
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Four implementation tasks, test cases, commit boundaries and one API-worker release gate |
| [evidence/BASELINE.md](evidence/BASELINE.md) | Current source evidence, one small live probe and primary references |

## Scope and priority

| ID | Priority | Current behavior | Proposed result |
|---|---|---|---|
| XIVAPI-001 | P2 | Rows include shape and game version in their keys, but omit upstream base and schema. A request can resolve the moving alias again while fetching its data. | Capture one immutable upstream context before cache access and reuse it throughout the request. Namespace rows by base, canonical game version and canonical schema. |
| XIVAPI-002 | P2 | Icon upstream URLs and edge keys omit game version; the unversioned public URL is immutable for 30 days. | Pin upstream assets and internal keys to a game version; add an optional canonical `version` query. Use a short browser lifetime for the moving URL. |
| XIVAPI-003 | P3 | Once an icon expires from edge storage, there is no retained body/validator to refresh conditionally. | Retain validated PNGs long enough to revalidate with `If-None-Match`; a 304 reuses the body, and a changed 200 must pass the existing validation again. |
| XIVAPI-004 | P3 | Concurrent Item/Glasses misses repeat upstream calls; latest-version discovery already coalesces its Promise. | Coalesce overlapping row-family and Glasses misses within one isolate while retaining the current per-request batch search. |

These IDs qualify the recommendations in this folder; they are not claims of newly discovered security vulnerabilities. No emergency sprint is needed.

## Alternatives considered

1. **Recommended: improve the current Cache API integration in one API-worker release.** One upstream context, explicit icon policy and small in-flight registries fit the existing resolver. Benefits are local to an isolate/edge location.
2. **Only add configured schema text to today's key.** Smallest change, but an omitted/moving schema can still change under the same key, and re-resolving `latest` can still split a request. It does not meet the context requirement above.
3. **Use Durable Objects/KV or generate a complete equipment index.** Could broaden coordination or remove runtime lookups, but needs new storage, cost/size measurements and a separate migration. There is no evidence yet that it is needed.

## Proposed design

### One context for row reads and fetches

Replace the game-only `cacheNamespace()` discovery with a context containing normalized upstream base, canonical game key and canonical schema specifier. Resolve moving inputs through a small `GET /api/sheet/Item/1?fields=Name&version=...` request, including configured `schema` when present. A live read verified that this returns both canonical identifiers; [the evidence](evidence/BASELINE.md) records the exact result. Both identifiers are documented independently in [XIVAPI's pinning guide](https://v2.xivapi.com/docs/guides/pinning/).

Keep the existing ten-minute success memo, one-minute retry after discovery failure and three-second discovery timeout, keyed by all configured inputs. Reuse the last complete canonical context after a failed refresh. If no context has ever resolved, retain availability by using the configured upstream selectors **without reading/writing shared row or icon caches and without joining in-flight data requests**. This replaces persistent entries under the literal `latest` alias with an uncached fallback.

Capture the context once per HTTP request, registering pending discovery with that invocation's `waitUntil` before awaiting it so an owner disconnect does not strand other discovery waiters. Item search and Glasses calls receive it explicitly, including the schema, and must not resolve aliases again. Verify returned identity metadata before persisting successful responses; reject a mismatch as upstream unavailable. A cold fallback with both Item and Glasses results must also reject conflicting observed identities instead of combining different snapshots. A documented Glasses 404 is a negative result under a verified request context, not an identity-bearing JSON response.

Use a full canonical pair directly when both configuration values already have canonical syntax. Other selectors require discovery. This avoids an extra discovery call for a fully pinned deployment. Do not hard-code this audit's live pin into production configuration.

### Icon compatibility and refresh

Continue to serve `GET /v1/chara/icon/:iconId`. Add optional `?version=<canonical-game-key>`: exactly one lower-case, 16-hex-character value. Reject malformed/repeated versions before network access; preserve existing behavior of ignoring unrelated query parameters. A caller cannot supply an upstream base, path, schema or arbitrary URL.

Internal icon keys include a fixed synthetic origin, normalized upstream base, game key, icon ID and an icon-policy shape version. Assets receive that same game key; schema does not affect texture bytes. An explicit valid version needs no schema discovery. Unversioned requests use the context's resolved game key; unresolved bootstrap requests bypass shared storage.

For versioned public URLs, retain `public, max-age=2592000, immutable`. For moving, unversioned URLs use `public, max-age=300, must-revalidate`. This lets existing web and bot consumers continue using the current URL without a cross-unit rollout. Previously delivered immutable browser responses can remain cached for their original 30-day lifetime; a server change cannot revoke them. A later client release can adopt versioned URLs if immediate cache busting becomes necessary.

Store icons in a dedicated named edge cache with a seven-day freshness timestamp and a 30-day physical retention. Return an independently constructed response so the browser policy is never copied from the internal retention policy. Keep upstream ETag and cache timestamps internal; do not expose storage headers. These durations are product choices, not an asserted upstream TTL or service guarantee.

When an entry is stale but retained, revalidate synchronously with its validator. A 304 is usable only with the matching retained validated body. A 200 replaces it only after the existing one-MiB streamed cap and PNG signature checks. If no validator exists, fetch unconditionally. A 304 without a retained body is a 503, with no retry. Failures preserve the old entry's original timestamp but return the existing error/placeholder behavior; this proposal does not add stale-if-error icon serving or row background refresh.

[XIVAPI documents conditional asset requests](https://v2.xivapi.com/docs/guides/assets/). The separate internal timestamp/retention is necessary because an expired Cache API object may no longer be available for revalidation; [Cloudflare documents Cache API behavior](https://developers.cloudflare.com/workers/runtime-apis/cache/).

### Coalesce parsed data within an isolate

Reserve pending row-family keys synchronously before starting the owner request's single batched Item search. Concurrent requests await already-reserved keys and batch only their own new keys. Glasses uses a separate operation/id key. Both namespaces include the complete verified upstream context and row shape. Independent keys must remain independent.

Store only promises for decoded data, never shared Request/Response/stream objects or a Hono context. Each invocation creates its own response and uses its own execution context for cache operations. Keep the owner's bounded upstream work alive with `waitUntil` so a disconnected owner does not cancel other waiters. Cross-request I/O objects are [unsupported by Workers](https://developers.cloudflare.com/workers/observability/errors/#cannot-perform-io-on-behalf-of-a-different-request).

Cap the registry at 256 pending lookup keys per isolate. When full, fetch that request's unreserved keys normally rather than waiting, evicting a live owner or returning incomplete data. Remove each entry on success, rejection or timeout; an old completion may remove only its own entry. Errors are not negative results. A truncated search may satisfy current waiters with its partial result, but no family from it is persisted, preserving today's conservative rule.

Coalescing lasts only while upstream work is pending; it is not a second TTL cache. A request after settlement but before the asynchronous edge write can miss again. No global or cross-isolate deduplication is promised: the [Cache API is local to a data center](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Acceptance boundary

All four items ship through `apps/api-worker` only. Existing consumers need no code change. No new dependencies, bindings, timers/cron jobs, scheduled refreshes, automatic dye edits, locale changes, generated acquisition changes, analytics products or direct browser-to-XIVAPI calls are included.

Keep the current eight-KiB resolve-body limit, canonical icon IDs, one-MiB icon cap, PNG-only responses, redirect refusal, identifier-only upstream payloads, per-request locale handling, negative-result rules and truncated-result protection. Keep resolve JSON and fully cached `version: null` semantics. Explain `X-Cache` as data lookup reuse: discovery is not counted; joining a pending data request is a MISS.

The [implementation plan](REMEDIATION_PLAN.md) is ready for review. Implementation starts only after this proposal is accepted. Preserve the user's native execution preference, commit each significant task, then obtain one fresh final review before opening the implementation PR.

## Later register

| Candidate | Why separate | Revisit trigger |
|---|---|---|
| Row stale-while-revalidate | The current seven-day fresh/one-day stale headroom remains unchanged; a refresh scheduler would add request volume and background ownership. | Measure stale hit frequency and useful metadata changes inside a version/schema pin. |
| End-to-end timeout/cancellation | Callers cap resolution at 12 seconds; discovery is up to three seconds and each data call up to ten seconds. This plan does not claim a 12-second end-to-end bound. | Record full-path timing before choosing a separate shared deadline and cancellation policy. |
| Icon in-flight coalescing | The selected coalescing scope is Item and Glasses. Asset refresh has its own cache/validator lifecycle. | Observe concurrent cold/stale asset refresh volume. |
| Adopt dye color/name discrepancies | Requires client/rendering/naming decisions and six-locale/consumer validation. | Separate approval after reviewing the dye audit report. |
| Broader acquisition/palette offloading | No verified drop-in source for regional acquisition interpretation or human.cmp palettes. | New upstream capability backed by primary evidence. |
| Global coordination/new storage | Per-isolate coalescing cannot prevent every duplicate across Cloudflare locations. | Measure upstream pressure before adding a coordination service. |
