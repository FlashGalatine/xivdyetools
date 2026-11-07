# Rust opportunities audit — 2026-11-06

The strongest Rust experiment is a packed palette-clustering kernel, followed conditionally by integration into the existing Photon image pipeline. This assessment records four optimization candidates and one compatibility finding across the 17 workspace units, with local TypeScript measurements and an evaluation plan. All five findings remain OPEN for evaluation.

The source snapshot is `ee4dd0b65375ed994d8ab0dafc3a695b614c1a3d`, from local `origin/main`, reviewed on branch `codex/rust-opportunities-20261106`. Scope covers algorithm paths, caller workloads, existing Rust dependencies, runtime integration and release contracts. Production performance and deployed versions require separate verification.

**Addendum 2026-11-07.** A Node comparison measured the palette kernel in Rust/WASM at 1.2–1.4× faster than equivalent packed TypeScript, with exact output parity. A TypeScript squared-distance change measured 1.35–1.6× faster than current code on its own. After that change, Rust saved under 5 ms per representative extraction. The addendum recommends the TypeScript change first and defers Rust. If Rust is adopted later, land it first in image-worker as a separate module. See [the comparison](evidence/review-rust-comparison.md) and the [report addendum](DEEP_DIVE_REPORT.md#addendum-2026-11-07--measured-rust-comparison).

| File | Purpose |
|---|---|
| [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md) | Ranked recommendations, measured baseline, whole-project disposition and semver analysis |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Conditional evaluation stages and consumer rollout dependencies |
| [TODO.md](TODO.md) | Draft follow-up checklist with the audit PR attached |
| [findings/](findings/) | Five concise findings with source locations and verification requirements |
| [evidence/README.md](evidence/README.md) | Method, commands, limitations and evidence index |
| [evidence/review-rust-comparison.md](evidence/review-rust-comparison.md) | 2026-11-07 addendum: measured Rust/WASM and TypeScript kernel comparison |

## Top items

1. **[OPT-001](findings/OPT-001.md)** — core palette clustering merits a Rust/WASM comparison against a TypeScript implementation with fewer allocations. *Compared 2026-11-07: land the TypeScript squared-distance change, defer Rust.*
2. **[OPT-002](findings/OPT-002.md)** — image-worker could return palette clusters directly, subject to transfer, throughput and aggregate-memory measurements. *2026-11-07: the preferred first landing site if Rust is adopted.*
3. **[OPT-003](findings/OPT-003.md)** — the browser currently performs full canvas readback and clustering on the UI thread. Worker offloading is the first control experiment.
4. **[OPT-004](findings/OPT-004.md)** — batched exact color matching is a secondary candidate if a real caller demonstrates sufficient volume.
5. **[REFACTOR-001](findings/REFACTOR-001.md)** — optional runtime adapters and a stable TypeScript facade reduce the risk of forcing a package major release.

The deliverables are documentation and audit evidence. Runtime source, package versions and deployment configuration have no audit changes.
