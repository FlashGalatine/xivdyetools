# Image memory prototype implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. The coordinator owns Git, release metadata, finding status and outward prose.

**Goal:** Test a reproducible minimal Photon ownership patch and prepare bounded image-request admission without activating production.

**Architecture:** Reconstruct and pin a local WASM build, compare an unmodified rebuild with the installed artifact, then measure constructor/crop/resize ownership changes separately. Admit at most one image request per isolate before input acquisition, with no in-memory waiting queue; preserve caller-visible validation and service-failure behavior.

**Tech Stack:** Rust/WASM, wasm-bindgen, Photon, workerd/Miniflare, TypeScript/Hono, Vitest.

**Spec:** [Reviewed investigation and acceptance sequence](../../audits/2026-10-26-security/evidence/remediation-image-investigation-2026-10-28.md), explicitly accepted by the user on 2026-10-28.

## Global Constraints

- Reuse `codex/sprint11-image-20261028` at `a35034bce2288fb47c922f23fe4bacfbe5e25617`; preserve the two uncommitted investigation evidence files.
- Never publish, deploy, merge or push to main. Production activation and corrected-manual prerequisites remain held.
- Keep raw controls and older evidence unchanged. New experiment outputs belong to this plan's ignored workspace.
- Preserve prepared input limits (5 MiB, 8,388,608 pixels, 4096 side, PNG16 rejection), extraction 16–512/default256 and thumbnail640×264.
- Preserve five image-worker formats, existing pixel math/filter/metadata stripping, URL/redirect/timeout validation, service-binding-only surface, logs off and no storage.
- Provision tools only within the ignored plan workspace using task-specific tool homes; no global toolchain or registry changes.
- Do not integrate a fork into production imports until the unmodified rebuild/control parity and patch measurements are understood and independently reviewed.
- No tests, timeouts, coverage thresholds or assertions weakened. No GC/snapshot-dependent passing memory result. Local workerd does not prove production-limit enforcement.
- Each agent writes only its allowlist; commits, pushes, version/changelog/status updates remain with the coordinator.

## Review Focus

- Admission must happen before fetch/body acquisition; a rejected request must not decode, fetch or intentionally buffer its body.
- Permit release must survive validation failure, processing failure, abort and late completion; abort must not release a permit while acquisition/processing still uses it.
- Caller timeout/overload must stay a service failure with existing localization and quota/refund semantics; never become an unsupported-file error.
- An unmodified build may differ because the original full Cargo lock is absent; dependency/toolchain differences must be documented before claiming patch savings.
- Warm/cold, all supported codecs, alpha/metadata, crop rounding and malformed inputs must retain behavior; no legacy full-resolution fallback may bypass the bounds.

### Task 1: Reconstruct and measure Photon variants

**Ownership:** worker owns only this plan workspace's `photon/` directory. Source/dependencies/config outside it are read-only.

**Consumes:** installed Photon0.4.0 WASM SHA256 `f477b87cbea0445c65fc7e580e89050190600379fcd44821cec67403483872b1`; cf-wasm release `a7423d01eacc7ce20359ad0df202d0ce58cf0347`; pinned evidence/provenance in the reviewed investigation receipt.

**Produces:** pinned source/lock/tool versions, local build/run scripts, unchanged baseline and variant artifacts/hashes, output/memory comparison receipts and a concise report. Builds and measurements are experiments, not product imports.

- [x] Acquire pinned source and isolated WASM toolchain, preserving initial errors and exact retry results. Force actual Rust compilation rather than reusing checked-in binaries.
- [x] Resolve and pin dependencies matching embedded known versions; record unavailable original lock/build settings explicitly.
- [x] Rebuild unmodified code and compare dimensions/status/RGBA/WebP with the installed original before any ownership patch. Two clean same-source builds must produce matching artifact hashes or explain nondeterminism.
- [x] Establish a red memory regression/control comparison, then replace constructor conversion copies with ownership transfer. Retain dimensions before consuming the decoded image.
- [x] Measure constructor-only changes. Patch crop's input clone and resize's input clone independently if needed; retain identical operations/owned outputs, safe Rust and explicit frees.
- [x] Compare cold/warm memory and outputs without forced GC. Minimum proposed smoke matrix: six mixed warm requests, all five small supported codecs through both routes, six rejection cases and two recovery requests (24 per variant). Expand only for changed behavior or unresolved risks.
- [x] Record all failures, artifact/source hashes, counters and limitations. Inform coordinator before memory sampling so heavy gates can be kept separate.

### Task 2: Bound admission and preserve caller contracts

**Ownership:** coordinator initially owns design; one assigned worker may own a disjoint admission file/test and route/caller allowlist after design review. No Photon Rust/build edits.

**Consumes:** existing image-worker route/error contracts, Discord service client classification, presets reservation/refund stages and ten-second caller deadlines.

**Produces:** small per-isolate admission control, route wiring, caller compatibility regressions and bounded/error-path tests. One active request and zero queued requests are deliberate initial limits; no timer-based release while work remains active.

- [x] Recheck caller handling and choose existing localized service-unavailable classification for overload; review before code changes.
- [x] Write failing tests: blocked first request, second rejected before fetch/read, health unaffected, success/error release, abort/cancel handling and recovery.
- [x] Implement smallest admission boundary and resource cleanup. Reject overload with HTTP503; preserve existing input-error text/status and avoid raw provider/exception leakage.
- [x] Test real caller status handling, quota/refund classification and timeout behavior; modify callers only when necessary to preserve the intended service-failure contract.
- [x] Mutation-check the guard and release paths; run affected unit gates and obtain independent review.

### Task 3: Integrate only supported outcomes and finish evidence

**Ownership:** coordinator owns implementation selection, metadata/docs and Git; reviewers are read-only; gate collector writes only assigned logs.

- [x] Review reconstruction, parity, allocation changes and admission together. If prototype proof is insufficient, retain it as a prototype and explain the remaining gate; do not silently select managed Images.
- [x] If a product artifact is supported, integrate a pinned auditable artifact/source/build path with licenses and regression gates, preserving current imports/exports where possible.
- [x] Run affected unit/caller tests, meaningful memory/compatibility controls, bundle/dry-run and required repository gates for any production source change.
- [x] Save additive dated evidence and update only current implementation/status/release documentation; preserve archived snapshots. No closure claim or activation without platform acceptance.
- [x] Keep work reviewable and report concrete outcomes and limitations. No production activation or automatic deployment is selected by this plan.
