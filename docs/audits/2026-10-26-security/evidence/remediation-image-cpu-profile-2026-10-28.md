# A-IMAGE local thumbnail CPU profile and preview-budget investigation — 2026-10-28

**Result: local hotspot evidence accepted; the effective numeric preview CPU budget remains UNVERIFIED. Production activation and further hosted testing remain held.** This follows the [failed hosted attempt](remediation-image-hosted-preview-2026-10-28.md). The user authorized local profiling and budget investigation; no new hosted request or production change was made.

## Bounded local method and identity

The candidate is `4df8e32d66149ff3a0137a9a32996d6579a82e49`. Run the exact first four entries of the reviewed sequence once in each of two fresh local Miniflare isolates: one control without the inspector, one with CPU sampling around only the fourth request, the valid 4096×2048 1-bpp BMP thumbnail. The preceding GIF extraction, near-5 MiB PNG thumbnail and WebP extraction preserve the hosted request order. There are **eight responses total**, no extra health requests, confirmation pairs or fallback instrumentation.

Both modes use actual configured `worker.ts`, the reviewed canary wrapper and retained WASM. Only the fresh local deadline/environment token differs from the earlier hosted preparation. The paired modes use identical JS/WASM bytes; profiler enablement differs. The WASM remains SHA256 `f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`. Compatibility remains `2024-12-01` plus `enable_request_signal`, with one initializer and one artifact. No phase hooks, product-source transform, algorithm/filter/cap change, limit override, GC forcing or artifact substitution was needed.

All **8/8 outputs** match existing expected hashes, lengths and dimensions. The BMP result remains the 144-byte 640×264 WebP. Boot identity is stable within each prefix; all **65 source/config/lock/artifact/template identities** and computed Git blobs match before/after. Real egress attempts are **zero**, and both runtimes and the inspector were disposed. The [normalized receipt](remediation-image-cpu-profile-2026-10-28.json) pins 29 verified raw script/profile/receipt files. Raw material remains in ignored readiness storage, without publishing credentials or local absolute paths.

## What the samples show

Requested interval is **1,000 µs**. The protocol accepts it but does not return an actual fixed interval. Observed spacing has median **1,521 µs**, mean **1,618.502 µs**, p95 **2,006 µs**, and range **16–15,311 µs**. There are **273 samples**, a **441,983 µs** profile window, **441,851 µs** of summed deltas and **132 µs** of unsampled tail.

These are **timeDelta-weighted local sample estimates**, not exact stage CPU milliseconds or Cloudflare CPU charges. Every leaf receives exactly one category: idle/GC markers first, then the nearest existing JS phase boundary and its WASM descendants. Parent and child totals are never added together. Explicit remaining buckets retain wrapper, native and unattributed work.

| Exclusive bucket | Samples | Weighted sample ms | Share of non-idle weight |
|---|---:|---:|---:|
| Constructor/input transfer, decode and RGBA conversion | 19 | 30.009 | 7.11% |
| Crop and its transitive WASM/allocation work | 137 | 211.467 | 50.12% |
| Lanczos3 resize | 104 | 163.501 | 38.75% |
| WebP export/encoding/readback/freeing | 1 | 1.498 | 0.36% |
| Direct canary wrapper JS | 3 | 4.393 | 1.04% |
| Named native work outside phase boundaries | 2 | 4.527 | 1.07% |
| GC | 2 | 3.503 | 0.83% |
| Unattributed/program/unlabeled | 2 | 3.048 | 0.72% |
| Idle | 3 | 19.905 | Excluded; 4.50% of all sample weight |

The non-idle denominator is **421.946 weighted sample ms**. Crop and resize together account for **88.87%** in this run, identifying the main local hotspots. The crop bucket does not separate allocation from pixel-copy work, and the constructor does not separate transfer, decoding and RGBA conversion. WebP has only one sample and particularly coarse uncertainty. These boundaries identify attention areas, not isolated algorithm timings or the stage responsible for the hosted failure.

BMP request wall time is **443.390 ms** without profiling and **424.867 ms** with profiling. The single-pair difference, **−18.522 ms / −4.18%**, includes JIT, scheduling, bridge and inspector variation; it is neither negative CPU overhead nor a speed improvement. Profiler start/stop round trips are 16.297/3.505 ms outside that request timer. No exact stage durations are derived from synchronous worker clocks, and no statistical run-to-run error is estimated from one pair.

## Effective preview budget: the missing server-side fact

Installed **Wrangler 4.152.0** has two inspected remote-preview upload builders that omit numeric `limits`, at bundled CLI lines 185995 and 370186. The same behavior is visible in [pinned official source](https://github.com/cloudflare/workers-sdk/blob/707cb6f22bd8685bce7d1dfa0b53853057200eee/packages/wrangler/src/dev/remote.ts#L247). This establishes no transmitted user-configured limit. It does **not** mean unlimited runtime, identify a default ceiling, or show that setting `limits.cpu_ms` would affect this path.

The temporary legacy `edge-preview` session differs from normal production deployments and modern branch/version preview products. [Official legacy remote-development documentation](https://developers.cloudflare.com/workers/local-development/#wrangler-dev---remote-legacy) specifies temporary code upload but no numeric invocation CPU allowance. The [general CPU-limit documentation](https://developers.cloudflare.com/workers/platform/limits/#cpu-time) describes production plan limits and overrun flexibility; it does not explicitly map those values to this session. Generic Free/Paid defaults therefore cannot be assigned as this preview's measured or configured budget.

The preview implementation's `PREVIEW_API_TIMEOUT_MS = 30_000` concerns individual control-plane API calls, not invocation CPU. Likewise the client's 60-second wall timeout and wrapper's 15-minute admission deadline are not CPU allowances. Accepting a configuration field, local completion time or a CPU-limit error does not establish an effective numeric ceiling.

A read-only production image-worker settings query returns no explicit CPU-limit override and `usage_model: standard`; neither identifies the temporary preview budget or the billing plan. Account subscriptions are unavailable through the connected OAuth integration because that endpoint requires Billing Read/Write API-token access. No credentials were requested or changed. Even billing-plan identification alone would not prove the legacy-preview mapping.

The investigated public sources and installed code do not establish a defensible numeric allowance. To close this part of the gate, obtain authoritative Cloudflare session-policy metadata or vendor confirmation explicitly identifying the **enforced per-invocation CPU ceiling in milliseconds** for the current legacy remote-preview backend/account, its overrun grace, and its relationship to production. CPU duration or an `exceededCpu` outcome without that policy does not identify the ceiling.

## Release decision

Independent escalated review accepts the local attribution and output/identity controls. It does not establish the hosted failure's precise CPU stage, effective preview budget, aggregate-memory headroom or production adequacy. The earlier 146,092,141-byte local memory diagnostic remains unresolved. FINDING-020 remains **PARTIAL / OPEN**, with verified manual delivery and production activation still held.

Prioritize crop/resize investigation locally while preserving pixel-output contracts. No implementation change or replacement hosted test is selected by this evidence. Another hosted experiment must first have a known applicable budget, a concrete reviewed scope and explicit authorization. The existing one-test exception is not reused.
