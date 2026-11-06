# Rust evaluation and adoption plan

This proposed plan covers the five findings in [the catalog](DEEP_DIVE_REPORT.md). Each finding has one primary evaluation stage below. Consumer adoption stages are dependencies of a successful evaluation, and require their own release review. All implementation stages remain pending. Prior security, identity, moderation, retention and image-resource work retains its existing release plan.

## Stage 0 — Baseline recorded

The audit records a fresh three-package build, 334 passing tests and a reproducible synthetic Node baseline. Production traces, mobile/browser traces, Rust comparisons, peak isolate memory, artifact startup and npm registry state remain open measurements. See [evidence](evidence/README.md).

## Stage 1 — Core compatibility contract

**Primary finding REFACTOR-001. Primary unit packages/core. Priority P3.**

Document the facade, packed internal representation, runtime loaders and supported inputs before publishing a kernel. Define which paths retain TS fallback and how callers opt in. Inventory external subpaths/declarations and keep old persisted IDs, custom databases, errors, warnings and result identities. Freeze numerical fixtures and seeded k-means inputs before changing implementations. Make rounding rules explicit, including JS `Math.round`, f64 precision, ties and unusual numeric inputs.

Ends with a reviewed contract and tarball/load test matrix. An internal pilot can stay private. A new public backend package, prerelease dist-tag or mandatory initializer needs its own release design because the publisher has a package allowlist and no alternate tag path. [Publishing implementation](../../../scripts/publish-packages.ts)

## Stage 2 — Core palette experiment

**Primary finding OPT-001. Primary unit packages/core. Priority P3, first Rust experiment.**

Compare existing code, TS counts/sums with packed inputs, and a Rust/WASM implementation that uses one coarse call. Keep algorithms and input samples identical for the first comparison. Include packing/copies, initialization, results conversion and warmed calls. Test the existing general RGB[] facade separately from optimized byte input. Use real screenshots and flat, noisy, low-opacity and near-tie fixtures in addition to the audit's synthetic data. Record convergence counts and exact output differences.

Ends with a go/no-go result based on total work and parity. A promising private module proceeds to packed-artifact smoke tests. If a public core change is selected, it gets its own build/type-check/lint/test and compatibility checks, version decision and controlled publication stage. The actual version is selected when implementation starts.

## Stage 3 — Browser responsiveness evaluation

**Primary finding OPT-003. Primary unit apps/web-app. Priority P3.**

Compare the current path, a lazy TS module worker with transferred buffers, and an analysis-readback variant where supported. Measure long tasks and memory through file load, count changes, clear and replacement. Add Rust only as a separate measured variant after Stage 2. Preserve client-side image processing, UI output, share links, clipboard behavior, loupe and fallback. An analysis resize requires an explicit image-quality comparison against current sampling.

Ends with browser E2E, stale-result/cancellation tests, served CSP tests, bundle checks including WASM assets, and desktop/mobile phase measurements. Adoption is one web-app release. Current beta service bindings and production-data exposure must be checked before any hosted acceptance.

## Stage 4 — Image-worker fusion evaluation

**Primary finding OPT-002. Primary unit apps/image-worker. Priority P3, conditional on Stage 2 and current resource acceptance.**

Use an additive palette endpoint for the experiment. Compare TS fusion within this service against a fused Rust extension of Photon. Preserve `/extract` and `/thumbnail` contracts and artifact ownership provenance. The experiment must measure admission occupancy, busy responses, abort cleanup, thumbnail throughput, cold starts and total isolate memory under mixed traffic. Test retained dimensions, encoded-size limits and malformed headers. A second independent WASM heap/copy must appear in the memory budget if that design is used.

Ends with local workerd correctness/resource evidence and a separately approved provider acceptance exercise. The existing A-IMAGE hold remains a prerequisite for production activation. The audit's Node timings do not close that hold. [Image release constraints](../../../docs/operations/REMEDIATION_RELEASE_2026_10.md)

## Stage 5 — Exact matching batch evaluation

**Primary finding OPT-004. Primary unit packages/core. Priority P3, deferred.**

Require a real repeated-query workload or production profile first. Compare cached/prepared TS coordinates and shared filters with batched f64 WASM. Cover custom datasets, rebuilt databases, malformed queries, ties, threshold inclusivity and all supported metrics. Retain the sequential exclusion behavior of gradient callers. A 125-query synthetic result alone is insufficient justification.

Ends with either a documented rejection or a separately reviewed additive batch API and core release. Spectral endpoint reuse and cached gamut/ring calculations remain profiling leads outside these five scheduled findings.

## Proposed decision criteria

These thresholds are suggested review criteria, not observed results or already accepted product budgets.

- Require exact IDs, ordering, shapes and diagnostic behavior at public boundaries. Freeze seeded palettes for the parity corpus. Any proposed quality/model change needs a separate decision and semver assessment. Permit numerical tolerance only where the existing contract permits it and prove that tolerance does not flip visible results.
- For a user-latency case, target at least a 20% and 5 ms p95 total improvement on the affected interaction, repeated across representative inputs. For a server-resource case, a material measured CPU or peak-memory reduction can justify adoption independently. Agree the relevant budget before implementing a production kernel.
- Include cold load, startup, bundle transfer, decoding, readback, marshalling, binding calls and rendering. A fast isolated kernel must also help the complete path.
- Require no material regressions in default/small inputs, startup, memory stability, thumbnail success rate or unsupported-browser fallback. Repeat measurements when differences approach normal run-to-run noise.
- Retain the simpler tested implementation if the packed TS control meets the target with comparable resource use. Record maintenance cost for Cargo/WASM tooling, adapters and binary releases.

## Conditional release dependencies

| Stage after a successful experiment | Unit and completion condition |
|---|---|
| Publish shared artifact if chosen | packages/core or separately approved package, exact tarball validation and trusted publication |
| Adopt fused route | apps/image-worker, its own resource and endpoint acceptance |
| Adopt new image route | apps/discord-worker, exact retry/error envelope, deferred response and card parity, rollback through old route |
| Adopt core behavior in public HTTP routes if needed | apps/api-worker, route/schema/metric parity and its own deployment |
| Adopt in shared command library if API changes are needed | packages/bot-logic, declaration/results parity and its own publication |
| Adopt in rendering callers if affected | packages/svg publication, then separate apps/og-worker adoption, only when their inputs/imports change |
| Adopt UI kernel | apps/web-app, Stage 3 evidence and its own deployment |
| Adopt shared command dependency elsewhere if affected | apps/moderation-worker and apps/stoat-worker separately, with Stoat remaining deferred under current policy |

The rows describe dependency order, not permission to activate the release. Package-path merges can enqueue app deployments using workspace source before npm publication. Verify effective workflow holds and path-trigger fanout before integration. A pending registry publication does not isolate production. Root changelog announcement behavior is a separate trigger. [Release runbook](../../../docs/operations/REMEDIATION_RELEASE_2026_10.md), [workflow review](evidence/review-runtime-release.md)

For each eventual release, apply the unit/dependent build, type-check, lint and test gates, packed ESM/runtime smoke tests, relevant bundle checks and the root documentation/dead-code checks. Keep major API removals in their separately gated release work. Update each finding only when its evaluation or adopted change has concrete evidence.
