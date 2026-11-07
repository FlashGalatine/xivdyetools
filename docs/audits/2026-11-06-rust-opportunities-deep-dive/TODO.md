# Draft TODO — evaluate Rust adoption

**Status:** Draft; evaluation and implementation work is pending.

**Attached PR:** [#435 — Rust opportunities audit](https://github.com/FlashGalatine/xivdyetools/pull/435)

Use the [audit report](DEEP_DIVE_REPORT.md) and [evaluation plan](REMEDIATION_PLAN.md) as the source of detail. The recorded TypeScript baseline is available in [evidence](evidence/README.md). This checklist tracks proposed follow-up work; the attached PR delivers the audit and this draft.

## 1. Agree the first experiment

- [ ] Review the five findings and select the initial evaluation scope. Start with the core palette kernel unless profiling identifies a stronger target.
- [ ] Agree representative screenshots, supported runtimes, performance/resource budgets, and go/no-go criteria before adopting a production kernel. The plan's thresholds are proposals.
- [ ] Record how much time and maintenance cost a Rust/WASM toolchain is worth for the measured benefit.

## 2. Define compatibility before implementation

- [ ] Freeze public results, IDs, ordering, errors, custom datasets, seeded palette fixtures, numeric rounding, precision, and tie behavior.
- [ ] Define an optional backend boundary, packed inputs, loading, and TypeScript fallback. Specify Node, browser, and Cloudflare Workers artifact/load tests.
- [ ] Inventory published exports and current registry versions when implementation begins. Decide whether changed initialization, async APIs, types, outputs, or supported runtimes require a major release for each affected component.
- [ ] Keep existing core 6.0 and bot-logic 5.0 deprecation proposals in their separately reviewed release scope; a Rust implementation alone does not require a major version.

## 3. Compare core palette implementations

- [x] Compare current TypeScript, packed TypeScript counts/sums, and a private Rust/WASM kernel using identical algorithms, seeds, samples, and inputs. *Node, synthetic inputs, 2026-11-07 — [comparison](evidence/review-rust-comparison.md).*
- [ ] Measure the full path including packing, copies, initialization, result conversion, warm calls, and memory. Record convergence counts and output differences. *Done for Node: packing, the JS-to-WASM copy, compile/instantiate, warm calls, iteration counts and exact parity. Open: memory, browser, workerd and the steps outside the kernel.*
- [ ] Cover real screenshots, flat/noisy images, opacity, near ties, default/small workloads, and explicit larger inputs. *Synthetic blob, uniform, fractional and 100k-sample inputs only so far.*
- [ ] Record a go/no-go decision with parity evidence and repeatable timings. Retain the simpler implementation when its results meet the agreed budget. *Provisional: go for the TypeScript change, no-go for Rust until browser/workerd or real-image evidence shows a margin above the agreed bar.*
- [ ] Land packed counts/sums and squared-distance assignment in core, keeping square roots in k-means++ and centroid movement, with seeded parity tests against current output. Keep square roots or a differential test for fractional `RGB[]` input.

## 4. Evaluate consumers conditionally

- [ ] Browser: measure a lazy TypeScript module worker and reduced readback first; compare Rust after a successful core experiment. Cover mobile/desktop long tasks, cancellation, stale results, CSP, fallback, and asset size.
- [ ] Image worker: compare service-local TypeScript fusion with a Photon-based fused palette route. Preserve existing endpoints; measure cold starts, aggregate isolate memory, admission occupancy, abort cleanup, and thumbnail throughput. *2026-11-07: if Rust is adopted, land it here first as a separate module rather than extending the vendored Photon build.*
- [ ] Preserve the existing image-resource production hold until its separate acceptance requirements are satisfied.
- [ ] Defer exact perceptual batch matching until a real repeated-query workload justifies it; preserve custom-dataset and sequential-exclusion behavior.

## 5. Prepare a release only after a positive decision

- [ ] Select affected components and exact version increments from the approved public contract and then-current registry state.
- [ ] Validate packed artifacts, runtime support, dependent build/type-check/lint/test gates, relevant browser/workerd checks, and rollback behavior.
- [ ] Review package publication allowlists, deploy path fanout, workflow holds, and announcement triggers before integration.
- [ ] Create implementation/release PRs with their own acceptance evidence and update the audit findings with the outcome, including any rejected rewrites.

Completion means a documented adoption or rejection decision backed by representative end-to-end evidence, with an explicit compatibility and release plan for any selected change.
