# Image release-readiness implementation plan

> **For agentic workers:** follow project model routing and systematic debugging. Coordinator owns Git, release decisions, evidence/status and outward prose; assigned workers have disjoint files.

**Local status:** source integration, validation and review complete; hosted evaluation remains pending an explicit exception. Git/PR receipts are retained in the readiness ledger.

**Goal:** integrate the approved PR #349 manual companion and settle the remaining image memory acceptance requirements with current-candidate evidence.

**Architecture:** preserve the retained Photon ownership patch, actual worker entry and existing resource/format/caller contracts. Reuse evidence only with explicit source/artifact identity; new experiments use synthetic local fixtures. Separate local correctness/headroom from Cloudflare enforcement and release activation.

**Tech stack:** TypeScript, Photon/Rust/WASM, workerd/Miniflare, Vitest, pnpm.

**Spec:** [Current ownership-patched implementation and limits](../../audits/2026-10-26-security/evidence/remediation-image-owned-buffers-2026-10-28.md), [manual companion](https://github.com/FlashGalatine/xivdyetools/pull/349), and the user's release-readiness request. Base: `316513243bc18ac8e11670013a87b7140756e72c` (adoption PR #362).

## Global constraints

- No npm publication, manual deployment, main merge/push, new live routes, policy/secret/activation change or private report in Git. Existing feature pushes can run automatic beta workflows.
- Preserve 5 MiB encoded input, 8,388,608 pixel/4096 side limits, PNG16 refusal, extraction 16–512/default256, thumbnail640×264, five formats and existing crop/resampling/output semantics.
- Integrate both PR #349 commits without losing H logging tests, higher pending versions or approved locale text. Use a scoped squash so the coordinator can commit only owned paths; record both source commit identities.
- The earlier ownership-patched main-matrix baseline is 78.5625 MiB warm WASM and a 109,961,415-byte diagnostic checkpoint. The new expanded valid-format matrix reaches 110.4375 MiB WASM and a 120,022,986-byte post-response diagnostic sum. A separate three-round 42-request valid mix passes in plain/observed modes but reaches a 146,092,141-byte diagnostic sum despite stable 107.25 MiB WASM; no mix-wide headroom is established. Earlier 142.330 MiB evidence remains historical. Neither checkpoint proves continuous peaks or Cloudflare enforcement.
- The old portable probe substitutes stock WASM and is insufficient for current acceptance. New probes must use configured worker.ts and exactly one retained WASM artifact; preserve compatibility date/flags and full source/config/hash identity.
- No forced-GC pass criterion, threshold/timeout reduction, cap regression or speculative optimization. Verify suspected decoder header/allocation mismatches with bounded real-runtime probes before editing runtime code.

## Tasks

1. [x] Integrate PR #349 source commits `14f859af587cada27456239bd1835d589044b810` and `9e5e6b9208749facb1b6b6f3e71e7e52b158fec9`. Pin six real rendered manual fields, prove a 5→10 mutation fails, and run locale/manual/dispatch/font gates.
2. [x] Recheck current allocation lifetimes, inspector accounting and standalone versus Cloudflare enforcement. Preserve primary-source references and a falsifiable acceptance checklist.
3. [x] Source and independent security review establish decoder canvas/frame allocation gaps. Close them with bounded metadata tests, refusal-before-constructor assertions, six mutations and actual retained-artifact valid-format compatibility. No resource-exhaustion probe is required or claimed.
4. [x] Produce current-candidate local runtime receipts and a concrete reviewed platform acceptance procedure if local enforcement cannot settle the gate. No live test or deployment without explicit authorization overriding the repository restriction.
5. [x] Independent regression and security review, appropriate scoped/full integration gates, package/artifact/manual verification and secret scan. Keep pending versions; record publication, manual-delivery and image-activation order. Commit/push a reviewable feature branch/PR under the standing authorization.

## Review focus

- Nested decoder allocations must remain bounded even when the displayed/container canvas is small.
- Ordinary controls must use actual source and the retained artifact without stock replacement or keep-alive instrumentation.
- Unread response storage and cancellation lifetimes must remain explicit limits of admission.
- All six manual locales must advertise the approved value and preserve quality/font gates.
- A successful local request or post-response checkpoint cannot be relabeled as a production memory guarantee.
