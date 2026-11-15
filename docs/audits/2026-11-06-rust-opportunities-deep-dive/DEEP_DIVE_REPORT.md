# Rust opportunities deep dive

Audit date 2026-11-06. Source `ee4dd0b65375ed994d8ab0dafc3a695b614c1a3d`. Five OPEN evaluation findings, comprising four optimizations and one compatibility concern. Sprint 0 has no shipped implementation. Source locations below refer to this commit.

**Addendum 2026-11-07.** A Node comparison of the palette kernel ran after the audit, against packed TypeScript and a Rust/WASM port. It recommends the TypeScript squared-distance change first and defers Rust adoption. The [addendum section](#addendum-2026-11-07--measured-rust-comparison) summarizes it, and the sections before it are unchanged.

## Recommendation

Start with a bounded comparison of the palette-clustering kernel. It repeatedly processes thousands of pixels and creates temporary arrays on every iteration. Rust could improve data locality and allocation behavior here. First establish an equivalent packed TypeScript baseline, then compare a single batched WebAssembly call including its input/output costs. The existing Node baseline places ordinary synthetic clustering in the single-to-double-digit millisecond range, so browser responsiveness and total interaction latency should decide whether adoption pays for its maintenance.

The image-worker is already a Rust host through Photon. Discord and OpenGraph rendering already use Rust through resvg. Extending the existing image kernel is more promising than replacing those libraries. The HTTP, authentication, database, localization and UI layers have substantial integration contracts and little source-backed reason for a language migration. These judgments combine source inspection with the limited local measurements described below. [Detailed core review](evidence/review-core.md), [image and browser review](evidence/review-image-web.md), [runtime and release review](evidence/review-runtime-release.md)

## Catalog

Potential impact is a hypothesis about user benefit. Confidence applies to the observed code path. A Rust speedup remains unmeasured for every row.

| ID | Candidate | Priority and potential | Primary unit | Effort and risk | Version implication |
|---|---|---|---|---|---|
| [OPT-001](findings/OPT-001.md) | Packed palette clustering | First Rust experiment, medium potential, high source confidence | packages/core | Medium experiment, high parity sensitivity | Compatible internal change or additive minor API, major if initialization or current sync API changes |
| [OPT-002](findings/OPT-002.md) | Fused decode/resize/palette path | Conditional follow-on, medium potential | apps/image-worker | High, shared admission and memory risk | Additive route can coexist, replacing raw-pixel protocol breaks callers |
| [OPT-003](findings/OPT-003.md) | Browser palette worker and readback | First browser responsiveness experiment, medium potential | apps/web-app | Medium for TS worker, higher for WASM | App-internal change can preserve public behavior |
| [OPT-004](findings/OPT-004.md) | Exact distance batches | Lower priority, low at ordinary volumes | packages/core | Medium, high numerical compatibility risk | Additive batch API minor, replacement scalar contract potentially major |
| [REFACTOR-001](findings/REFACTOR-001.md) | Stable facade with explicit runtime adapters | Required design work before a published kernel | packages/core | High across consumers and CI | Mandatory async initialization, narrowed support or removed exports requires major review |

## Measured TypeScript baseline

A fresh build of core, types and logger succeeded. Four existing test files passed all 334 tests, covering palette behavior, matching parity, blending facade parity and performance regression limits. The benchmark below ran subsequently, in a separate Node process with five warmups and 30 timed iterations per case. Inputs and k-means random draws use fixed seeds. Timing excludes generating the input arrays, module import, image decode, canvas readback, network, rendering and any Rust loading. The final run replaced the exploratory timing output after the test processes finished. [Raw measurements](evidence/baseline-node.json), [reproduction script](evidence/scripts/benchmark-baseline.mjs), [test log](evidence/core-tests.log)

| Operation | Upper median ms | Sample p95 ms | Interpretation |
|---|---:|---:|---|
| 10,000 synthetic pixels, four colors, default iterations | 4.75 | 5.16 | Ordinary core default configuration |
| 10,000 pixels, ten colors, 25-iteration cap | 23.60 | 24.50 | Larger ordinary palette request |
| 10,000 pixels, ten colors, 100-iteration cap | 24.44 | 25.28 | Higher cap on the same seeded input. Actual iteration counts were not recorded |
| 65,536 input pixels, core samples 10,000, four colors | 8.18 | 8.60 | Different sampled data and convergence path, not an isolated sampling-cost measurement |
| 10,000 pixels containing four flat colors | 0.75 | 1.00 | Distribution materially changes work |
| Explicit 100,000 samples, ten colors | 173.53 | 192.47 | Public API stress configuration, ordinary adapters use 10,000 samples |
| One CIEDE2000 nearest-dye query | 0.67 | 0.78 | Warm local synthetic scalar measurement |
| Ten CIEDE2000 nearest-dye queries | 2.00 | 2.36 | Similar query count to a large palette |
| 125 CIEDE2000 nearest-dye queries | 31.45 | 42.51 | Synthetic batch, a measured production caller of this size was not established |
| 125 RGB nearest-dye queries | 0.26 | 0.53 | Existing k-d-tree path |
| Synthetic 256-square RGBA-to-RGB object conversion | 0.90 | 3.40 | Equivalent caller loop, excludes decode and transport |

These are observations from one Windows machine and one process, with small samples and warmed caches. JIT and cache state differ between cases, so the rows do not establish linear scaling. They establish neither production latency nor an expected Rust multiplier. Peak isolate memory and mobile long tasks remain unmeasured. The benchmark has result-count assertions but is not a differential Rust correctness test. [Method and limitations](evidence/README.md)

## Where the work happens

### Palette kernel

`packages/core/src/services/PaletteService.ts:217` allocates an assignment array and cluster arrays for each pass. Its callers discard the assignments, and the mean calculation traverses the clusters again. `:302` repeats assignment/update and performs a final assignment for counts. The default sample count is 10,000. Color count is bounded to 1–10 and iterations to 1–100, while finite public sample overrides have no upper cap. At 10,000 samples, ten colors and 25 iterations, the assignment passes alone can reach 2.6 million distance evaluations including the final pass. The loop can stop sooner when centroid movement falls below the threshold.

Preserve k-means++ nearest-distance caching, first/last sample inclusion, alpha ≥128, the order of filtering and sampling, rounded centroids and dominance, stable ties, and the distinction between zero pixels and a rounded 0% share. Public RGB inputs can contain fractional channels. A byte-only replacement would narrow that contract. Counts/sums in input order and a final count-only pass are useful TS controls. Replacing square roots with squared comparisons also needs differential tests because seed selection, rounding and ties can change. [Core evidence](evidence/review-core.md)

### Image service boundary

Discord's normal image route calls image-worker, receives RGBA, creates RGB objects, samples and clusters, matches the small palette, and renders the card. Default resized output is at most 256² pixels, or 256 KiB of RGBA. The explicit 512² ceiling permits 1 MiB. A fused palette route could keep decoded pixels in Photon's linear memory and return at most ten cluster records. Matching and localization can stay with the caller.

Compare four variants on the same inputs: current code, packed TS in Discord, packed TS inside image-worker returning clusters, and a fused Rust kernel. A separate WASM module fed through JavaScript may add another pixel copy. Both `/extract` and `/thumbnail` share a one-request admission slot per isolate, so longer clustering inside image-worker can increase thumbnail rejections even if aggregate CPU falls. Preserve exact busy errors, the caller's one retry and shared deadline, cleanup on actual completion, and the raw extraction endpoint for rollback. The existing Photon artifact includes ownership patches with retained provenance. [Image evidence](evidence/review-image-web.md)

### Browser extraction

`apps/web-app/src/components/extractor-tool.ts:2165` yields a frame, then synchronously calls full-canvas `getImageData`, samples a grid and invokes core. The grid aims for about 100,000 candidates, with a floored stride, before core samples 10,000. A 3840×2160 RGBA readback alone represents about 31.6 MiB. Moving clustering to a module worker helps responsiveness, but readback still blocks if performed on the main thread first.

Measure a TS worker with transferred packed buffers, plus an analysis-canvas or worker-readback variant where supported. Resizing changes sample colors and requires a deliberate quality comparison. Preserve the full-resolution display/loupe, image privacy, replacement/clear behavior and stale-result rejection. Test cold and repeated extraction on mobile as well as desktop. Browser workers can run computation off the UI thread and transfer an ArrayBuffer's ownership. [Browser evidence](evidence/review-image-web.md), [MDN workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)

### Exact distance batches

`packages/core/src/services/dye/DyeSearch.ts:197` deliberately uses exact scans for perceptual metrics after an RGB-radius shortcut missed correct winners. The bundled catalog has 125 dyes. Palette requests produce at most ten matches, Discord gradient accepts 2–12 steps, mixer uses five ratios, and public match routes accept one target. These sizes limit the case for a new runtime. Public library callers can supply larger/custom data and gradient counts, so a future batch use case remains possible.

Benchmark reusable prepared coordinates and shared filtering first. A candidate WASM call should process a whole batch and return indexes/distances that the host maps to existing Dye objects. Preserve custom databases, their rebuild/mutation behavior, exact metric, inclusive thresholds, ordering, exclusions and malformed-input handling. The web gradient's exclusion set evolves between steps, so independent parallel queries would change its result. [Core evidence](evidence/review-core.md)

## Whole-project disposition

| Unit | Recommended disposition and reason |
|---|---|
| packages/core | Evaluate palette kernel, conditionally batch exact distances. Retain host facade, locale/data/API services and scalar conversions |
| packages/bot-logic | Keep TS command orchestration, filters, translations and results. Adopt a core kernel through existing calls if justified |
| packages/svg | Keep synchronous SVG strings, XML escaping, layout and glyph exports. Rasterization already occurs in resvg |
| packages/types | Keep TS types and runtime guards used by consumers. Generate a narrow binding declaration if a kernel is introduced |
| packages/logger | Keep existing logger/redaction behavior and runtime adapters |
| packages/auth | Keep Web Crypto-based verification and encoding contracts. Moving the wrapper supplies no demonstrated CPU benefit |
| packages/worker-kit | Keep Hono middleware, rate limits and binding integration. Storage consistency rules remain host/platform concerns |
| packages/test-utils | Keep test factories and platform mocks. Add a narrow parity harness only when a kernel exists |
| apps/web-app | Evaluate worker/readback changes, then optional palette WASM. Retain Lit UI and normal services |
| apps/image-worker | Best existing Rust integration point, conditional on its resource gate and comparative results |
| apps/discord-worker | Keep interactions, acknowledgement, retries, localization and card flow. Adopt a versioned palette endpoint if proved |
| apps/og-worker | Keep route/cache/SVG orchestration. Existing resvg handles rasterization |
| apps/api-worker | Keep public routes, schemas, cache and proxy. Revisit batching only after measured traffic/call sizes justify it |
| apps/presets-api | Keep D1/R2 transactions, moderation and identity behavior. Photon already handles thumbnails |
| apps/oauth | Keep Web Crypto, D1 and OAuth/provider flow. Network, transaction and identity contracts dominate scope |
| apps/moderation-worker | Keep command authorization, confirmation and preset service calls |
| apps/stoat-worker | Retain parked Node integration. Adopt shared library improvements transitively when its release is justified |

This is an architecture and selected-path review across all units. Detailed read notes identify the paths inspected. It is not an exhaustive bug/security audit of every source file. [Runtime review](evidence/review-runtime-release.md), [tracked inventory](evidence/tracked-files.txt)

## Runtime and packaging constraints

Cloudflare runs Rust through WASM and JavaScript bindings. Its current documentation supports SIMD and excludes Worker threading. Rust native threads or Rayon are therefore unsuitable assumptions for this target. Use coarse calls with explicit ownership. Normal wasm-bindgen boxed numeric slices copy between JS and WASM memory, so typed arrays alone do not eliminate transfer costs. [Cloudflare WASM](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [Rust support](https://developers.cloudflare.com/workers/languages/rust/), [wasm-bindgen slices](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/boxed-number-slices.html)

On the research date, Cloudflare documents 128 MB per isolate including JS and WASM, a one-second startup limit, and 64 MiB uncompressed Worker size with no compressed-size cap. The repository's 3,072 KiB gzip check is still a project gate. Its historical rationale must be distinguished from the current provider limit. Provider CPU/resource acceptance for the existing image release remains separately recorded as held. [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/), [release runbook](../../../docs/operations/REMEDIATION_RELEASE_2026_10.md)

The browser's checked-in `script-src 'self'` lacks a WASM compilation allowance. A proposed browser kernel needs CSP review and real-browser tests under served headers. Its budget must count `.wasm` bytes as well as JS, while preserving lazy loading. Worker startup, browser async loading and Node loading need distinct tested adapters. Core declares ESM and Node ≥18.0.0, while repository tooling requires a newer Node. Its root artifact already uses JSON import attributes (`packages/core/src/index.ts:386`), which Node 18 added in 18.20.0. Verify declared and effective floors against the existing packed artifact before judging a pilot or changing supported runtimes. [Browser evidence](evidence/review-image-web.md), [CSP behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src), [runtime evidence](evidence/review-runtime-release.md), [Node import attributes](https://nodejs.org/download/release/latest-v18.x/docs/api/esm.html#import-attributes)

A Rust package adds compiler/target, Cargo lockfile, generated JS/types, optimization tools, license notices, binary provenance, reproducible artifact checks and vulnerability maintenance. Prefer reproducible prebuilt WASM in the npm tarball, tested from the packed artifact. The existing isolated publisher disables lifecycle scripts, so compilation must happen in the controlled build stage. Measure that extra maintenance against saved latency, memory or CPU. [Publishing evidence](evidence/review-runtime-release.md)

## Major version implications

The implementation language alone does not require a major increment. Package contracts and supported behavior determine the bump. The project's release convention treats compatible internal improvements as patches and additive functionality as minors. Incompatible public changes require a major. [Semantic Versioning](https://semver.org/), [repository release mechanics](../../../.agents/skills/audit-shared/release-mechanics.md)

| Proposed change | Likely release treatment |
|---|---|
| Internal kernel preserving initialization, sync calls, exports, platforms, values and errors | Compatible patch candidate, subject to package policy and full verification |
| New opt-in packed/batch method or separate entry/package | Minor on an established package, independent initial version for a new package |
| Existing sync methods become Promise-returning or require explicit `init()` | Core major |
| Existing RGB[] API accepts only byte buffers or requires a narrower runtime | Core major |
| Formula, rounding, tie order, distance units or output structure intentionally changes | Major compatibility review, with demonstrated bug corrections assessed individually |
| SVG generators require async loading or return Rust-managed wrappers | SVG major |
| Bot result discriminants/fields or shared command contracts change | Bot-logic major |
| Internal image route added alongside existing routes | Backward-compatible service addition with separate consumer adoption |
| Existing raw RGBA route replaced with JSON clusters | Breaking service protocol requiring migration/version coexistence |
| Dependency adopts a major while consumer's own API remains compatible | Reassess consumer contract, no automatic major bump for every dependent |

Core's planned 6.0 legacy character API removal and bot-logic's planned 5.0 removal of `SwatchResult.character` already have specific prerequisites. Rust does not satisfy those prerequisites. Keep their migrations independently reviewable and select actual version numbers against the release state at implementation time. [Recorded deprecations](../../../DEPRECATIONS.md), [release analysis](evidence/review-runtime-release.md)

## Positive controls and rejected candidates

- Photon already supplies Rust decoding, resizing and thumbnail encoding, with ownership work specifically retained in its vendored artifact.
- resvg already supplies Rust rasterization, and consumers free renderer/image objects.
- K-means initialization caches nearest distances, sample count defaults to 10,000 and distinct-color counting stops at K.
- Exact perceptual matching corrects a previous approximate-search defect. Retain its oracle and tie behavior.
- The character parser uses exact-pinned xivcharakit, bounded inputs and a browser inspection worker. A replacement reader has low prospective throughput benefit and high diagnostic parity cost.
- Scalar color and ordinary harmony operations operate on small inputs and caches. The OKLCH fixed-lightness ring already caches its last count.
- Spectral repeated-endpoint processing is a future profiling lead. A replacement spectral model risks visible changes, and endpoint reuse in TS is the first control.
- Historical LAB/RYB duplication notes are partly superseded by current implementation and equivalence tests. Current mixer facades delegate to common blending code. Remaining precision, unit and case differences are part of the migration review.
- A full Rust backend would retain provider waits, D1/R2 consistency obligations and protocol handling. No production trace in this audit establishes those wrappers as CPU bottlenecks.

Evidence and exact locations for these controls are retained in the three review notes.

## Addendum 2026-11-07 — measured Rust comparison

The kernel-level part of Stage 2 ran in Node on synthetic inputs. Built core, a copy of its k-means, packed TypeScript and a Rust/WASM port of the same algorithm all produced identical centroids and cluster sizes under the same injected random draws. This held on every case, including fractional channels, so numerical parity is achievable. [Comparison evidence](evidence/review-rust-comparison.md), [raw measurements](evidence/rust-comparison-node.json), [kernel source](evidence/rust-kernel/src/lib.rs), [harness](evidence/scripts/benchmark-rust-comparison.mjs)

| Case (upper median ms) | Iterations | Current | Packed TS, squared | Rust/WASM | Rust/WASM, squared |
|---|---:|---:|---:|---:|---:|
| Blobs, 10k, 4 colors | 5 | 3.99 | 2.60 | 2.37 | 1.72 |
| Blobs, 10k, 10 colors | 16 | 14.81 | 10.99 | 8.85 | 7.46 |
| Uniform, 10k, 10 colors | 25 | 25.19 | 18.38 | 16.58 | 12.10 |
| Uniform, 100k, 10 colors | 23 | 277.25 | 172.37 | 152.22 | 119.63 |

- Rust/WASM measured 1.2–1.4× faster than equivalent packed TS. With squared distances in both, the margin was 1.4–1.6×. A `+simd128` build gained nothing.
- Packed TS with squared-distance assignment measured 1.35–1.6× faster than current code, with no new toolchain. The substitution keeps square roots in k-means++ and centroid movement. It is provably order-preserving for integer channels, which every in-repo caller supplies.
- After that TypeScript change, Rust saved 0.9–3.5 ms on clustered (blob) inputs and 3.9 ms on uniform 4-color input, in the kernel alone. Whole-interaction savings should be no larger. By upper median these fall under the plan's proposed 5 ms bar, which the plan defines on p95. Uniform-noise and fractional 10-color inputs (6.3–6.5 ms) and the explicit 100,000-sample stress case (53 ms) exceed it by median. At p95 only the fractional (12.9 ms) and 100k (42 ms) cases do.
- The 25 KB kernel compiled and instantiated in a 0.24 ms median over 10 repeated compiles in one process, which is not a cold-start figure. Startup and size are not the obstacle; [REFACTOR-001](findings/REFACTOR-001.md)'s loader, publication and CSP work is.
- Iteration count moves cost more than language. Replaying the original baseline's inputs and seed shows 8 iterations for its default four-color row, 25 for the ten-color row, and 26 under the 100-iteration cap. That explains why the baseline's 25- and 100-cap rows nearly match.

**Revised ordering.** First, land the packed counts/sums and squared-distance assignment in core with seeded parity tests. That is a compatible internal change and a patch candidate. Second, run the browser worker experiment ([OPT-003](findings/OPT-003.md)), which fixes responsiveness whichever language clusters. Defer a Rust kernel until real-screenshot, browser or workerd evidence, or a larger workload, shows a margin above the agreed bar. If one is adopted, land it first in image-worker as a separate module ([OPT-002](findings/OPT-002.md)), not in published core and not inside the vendored Photon build. Image-worker is private, runs on one runtime, already loads WASM, and has no npm publication or browser CSP. These measurements are one Linux container, kernel only. They exclude decode, readback, transfer, matching, rendering, memory, browsers, workerd and mobile.

## Status and next decision

| Finding | Status | Commit implementing change |
|---|---|---|
| OPT-001 | OPEN — Node comparison recorded 2026-11-07, TS squared-distance change recommended, Rust deferred | — |
| OPT-002 | OPEN — conditional evaluation, preferred first Rust landing site | — |
| OPT-003 | OPEN — evaluation proposed, worker first regardless of kernel language | — |
| OPT-004 | OPEN — deferred pending real batch profile | — |
| REFACTOR-001 | OPEN — compatibility design required for adoption | — |

The [evaluation plan](REMEDIATION_PLAN.md) proposes measurable go/no-go criteria, correctness fixtures and staged consumer adoption. Benchmark thresholds are proposals for review. This audit's evidence supports choosing an experiment, while adoption remains conditional on its results. The 2026-11-07 addendum completes the Node kernel comparison only. The browser, workerd, real-screenshot and agreed-budget steps remain open.
