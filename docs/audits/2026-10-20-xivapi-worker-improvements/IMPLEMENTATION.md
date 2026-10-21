# Implementation handoff — XIVAPI worker improvements

**Issue:** [#322](https://github.com/FlashGalatine/xivdyetools/issues/322)

**Plan/design:** [Implementation plan](REMEDIATION_PLAN.md), [design](README.md)

**Status:** Four implementation tasks and the final review fix committed; verification complete.

**Execution:** Native implementation, one commit per significant step.

**Baseline:** 0cf9d00c79f4d669fc76e72a0d39ecd46e071f69.

**Reviewed implementation head:** d1d46ad5222b6967f3e7196137226b368e494b03.

**Verified fix head:** c1ddc96825e23f99423a1f3c2b1a1f19e09e8cde.

**Release:** API worker 0.21.0; no package publish or consumer changes.

## Delivered

| Recommendation | Commit | Result |
|---|---|---|
| XIVAPI-001 | 1b3fabd4 | Captured canonical base/game/schema context for cache reads and Item/Glasses requests; last-complete-context fallback or uncached bootstrap |
| XIVAPI-002 | 4b03e9e8 | Versioned asset fetch/cache identity, optional canonical icon version query, independent public/storage cache policies |
| XIVAPI-003 | a272ee91 | Retained validated PNG/ETag refresh; safe 304 reuse and validation of changed 200 bodies |
| XIVAPI-004 | d1d46ad5 | Bounded parsed-data coalescing, overlapping-key batching, request-owned lifetime and local workerd disconnect checks |
| Final review | c1ddc968 | Reject independently known version/schema conflicts during uncached bootstrap; missing metadata alone remains an available, uncached response |

The planning snapshot remains frozen. Its original draft status/unchecked boxes record when it was written; this handoff records execution.

## Behavior and compatibility

- Moving selectors resolve together through one bounded Item/1 metadata probe: ten-minute success memo, one-minute retry on failure, three-second timeout and 32-KiB decoded cap. Complete canonical pins skip discovery. A request never re-resolves its context between cache access and data fetch.
- Row caches include normalized upstream base, canonical game/schema and row shape 5. Failed refresh retains the last complete context; a first failure uses configured selectors without shared reads/writes or in-flight joining.
- Existing icon URLs remain valid and use a five-minute browser policy. An explicit canonical 16-hex game-version query uses a 30-day immutable policy. Old browser entries retain their previously delivered immutable lifetime; a server change cannot revoke them.
- Internal PNGs are seven days fresh and retained for 30 days. Conditional 304 responses reuse retained validated bytes as ordinary 200 PNGs; changed bodies pass the existing one-MiB streamed and signature checks. Failures do not extend freshness or silently serve stale success.
- Item/Glasses registries hold at most 256 pending keys in one isolate. Overflow fetches normally. Only decoded values are shared; request/response streams and execution contexts remain with their owner. Joined lookups report MISS. Completed entries are removed, so the asynchronous cache-write gap can still yield another miss.
- No global deduplication, row background refresh or new end-to-end latency bound is claimed. Row freshness/stale-serving headroom and resolve JSON, including fully cached version:null, are unchanged.
- All six locales, canonical dye/facewear identities, color algorithms, palettes and generated acquisition tables remain unchanged. No dependency, binding, scheduled job, direct browser-to-XIVAPI request or production pin was added.

## Verification

[Durable verification record](evidence/IMPLEMENTATION_VERIFICATION.md) includes commands, results and the scanner checksum.

- API-worker suite: **42 files, 840 tests passed**.
- Affected build/type/lint/test gate: **11/11 tasks passed**; the existing nine lint warnings remain.
- Full repository build/type/lint/test graph: **62/62 tasks passed**, serialized.
- Real local workerd ownership tests: **2/2 passed**, with local fixture upstreams and owner disconnects for both data and context discovery.
- Six root script/reachability/documentation/logging gates passed.
- Built docs contain one optional icon-version input plus the browser-policy, refresh and coalescing copy.
- Secret scan of the six outgoing implementation commits passed; the final handoff is scanned separately before push.

Two concurrency-2 graph runs hit the unchanged moderation-worker RL_COMMAND environment-validation test's 5000-ms timeout. The exact file passed 7/7 and its full unit suite passed 757/757 in isolation; the full graph then passed serialized. No moderation source, assertion or timeout was changed.

## Review and rulings

A fresh read-only verifier reviewed the whole branch with the project-resolved ordinary verification pair **gpt-6.1-sol / xhigh**. No custom model/effort pin overrode that assignment. The review found no Critical or Minor issues and one Important issue: a missing version could hide a known schema conflict during bootstrap fallback.

The coordinator confirmed the finding with failing route regressions. They also exposed a false rejection when one schema was absent but known versions matched. The fix compares independently known coordinates. Five assertions failed before the fix; all seven new cases and the full 840-test suite then passed. The affected gate, full graph and real workerd checks passed again. No second review was dispatched.

All execution rulings, including the reviewer's six areas left to coordinator judgment, are preserved below. There are no deferred minor findings.

- Task 2: Ruling: CharaIconCache has no ExecutionContext constructor argument - the route alone owns and schedules cache.put, as the design requires; an unused context would add no behavior - cost if wrong: internal constructor adjustment, no public API impact.
- Final: Ruling: End-to-end deadlines/cancellation - existing per-call bounds remain, without a new total resolve deadline; no 12-second promise is made - cost if wrong: a slow upstream can still delay a resolve across multiple calls.
- Final: Ruling: Global coordination - coalescing is intentionally per isolate, so separate isolates can fetch the same family independently - cost if wrong: more upstream calls than globally coordinated storage would make.
- Final: Ruling: Row background refresh and icon coalescing - existing row aging and independent icon refresh calls stand; these are separate follow-ups - cost if wrong: rows age within existing retention and concurrent icon misses can duplicate upstream calls.
- Final: Ruling: Dye, locale, acquisition and palette changes - this branch changes only worker transport/cache behavior; the dye-discovery PR and canonical data workflow remain separate - cost if wrong: runtime data changes still need separate delivery.
- Final: Ruling: Revoking previously delivered immutable browser entries - existing cached responses cannot be revoked by this server change; their prior 30-day lifetime is documented - cost if wrong: some browsers can display an older icon until that entry expires.
- Final: Ruling: Production latency/request-volume improvement - synthetic correctness and call-count checks support behavior only; no production performance claim is made - cost if wrong: measured benefit may differ from expectation and needs production observation.

The six later candidates in the design remain separate work. The completed dye-discovery delivery in [PR #324](https://github.com/FlashGalatine/xivdyetools/pull/324) is independent.

## Delivery

Delivery target: a PR from docs/xivapi-worker-improvements-plan into main, with the execution record and verification evidence included. The worktree is retained for PR feedback. No merge, manual deployment, package publication or main push was performed.
