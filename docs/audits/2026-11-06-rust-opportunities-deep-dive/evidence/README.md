# Audit evidence

## Method and scope

Snapshot `ee4dd0b65375ed994d8ab0dafc3a695b614c1a3d` was checked out from local `origin/main` into `.claude/worktrees/rust-opportunities-20261106` on branch `codex/rust-opportunities-20261106`. This records a repository snapshot, with production and registry state outside the verified scope. The main checkout initially had one unrelated untracked `.claude/dye-name-validation-20261029/` directory.

Repository-specific audit conventions determined the README/report/findings/evidence/plan layout. Review workers were explicitly routed to `gpt-6.1-sol` with `high` reasoning effort for three substantial independent source slices. The coordinator checked the central kernel, caller, platform and release claims against source and official documentation. The review notes retain candidate evidence and rejection reasons. Inventory coverage spans all 17 workspace units, with detailed reads targeted to relevant algorithms, normal callers, imports and release boundaries.

## Evidence index

| File | Meaning |
|---|---|
| [review-core.md](review-core.md) | Core/bot-logic paths, algorithm contracts, sizes, controls and rejected ports |
| [review-image-web.md](review-image-web.md) | Image worker, Discord caller, browser, renderer and SVG review |
| [review-runtime-release.md](review-runtime-release.md) | Other units, runtime adapters, versions and publication/deployment constraints |
| [tracked-files.txt](tracked-files.txt) | Git-tracked scope inventory, excludes untracked/generated coverage pollution |
| [initial-status.txt](initial-status.txt) | Worktree state after creating the audit folder |
| [snapshot.json](snapshot.json) | Commit, package manifests and dated version/dependency snapshot |
| [install.log](install.log) | Frozen offline dependency install with lifecycle scripts disabled |
| [build-core.log](build-core.log) | Initial cached build, whose replayed logs contain historical cache paths |
| [build-core-fresh.log](build-core-fresh.log) | Subsequent forced build, three successful uncached tasks used for measurements |
| [core-tests.log](core-tests.log) | Four existing suites, 334 tests passed |
| [node-version.txt](node-version.txt) | Tool runtime used locally |
| [baseline-node.json](baseline-node.json) | Final serial benchmark, raw samples, CPU/platform/Node and scope |
| [baseline-console.log](baseline-console.log) | Tabular rendering of the same final measurements |
| [scripts/benchmark-baseline.mjs](scripts/benchmark-baseline.mjs) | Reproducible current-implementation timing harness |
| [scripts/validate-audit.mjs](scripts/validate-audit.mjs) | Audit link, citation-location and file-scope validation |
| [validation.json](validation.json) | Result of the final audit-specific validation |
| [verification.md](verification.md) | Independent finding verdicts and corrections incorporated |
| [docs-check-links.log](docs-check-links.log) | Repository living-doc link check, which deliberately excludes audits |
| [docs-check-versions.log](docs-check-versions.log) | Repository canonical version-table check |
| [review-rust-comparison.md](review-rust-comparison.md) | 2026-11-07 addendum: method, results, parity argument, interpretation and limits |
| [rust-comparison-node.json](rust-comparison-node.json) | Addendum raw samples, p95, iteration counts, parity flags, environment and kernel hash |
| [rust-comparison-console.log](rust-comparison-console.log) | Tabular rendering of the same addendum run |
| [rust-kernel/](rust-kernel/src/lib.rs) | Addendum Rust comparison kernel (`Cargo.toml`, `Cargo.lock`, `src/lib.rs`), audit evidence only |
| [scripts/benchmark-rust-comparison.mjs](scripts/benchmark-rust-comparison.mjs) | Addendum harness, which asserts built-core fidelity and exact variant parity before timing |

Captured build and test logs have trailing whitespace and extra end-of-file blank lines normalized for Git; command output and results are otherwise retained.

## Commands used

Run in the isolated repository root using PowerShell or the equivalent native tool invocation.

```powershell
pnpm install --frozen-lockfile --ignore-scripts --offline
git ls-files packages apps scripts .github
pnpm turbo run build --filter=@xivdyetools/core...
pnpm turbo run build --filter=@xivdyetools/core... --force
pnpm --filter @xivdyetools/core exec vitest run src/__tests__/integration/performance-benchmarks.test.ts src/services/__tests__/PaletteService.test.ts src/services/__tests__/DyeSearch.parity.test.ts src/services/__tests__/ColorService.blending-parity.test.ts
node docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/scripts/benchmark-baseline.mjs . docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/baseline-node.json
pnpm docs:check-links
pnpm docs:check-versions
node docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/scripts/validate-audit.mjs .
git diff --check
```

The final benchmark ran after the tests completed. Fixed seed 20261106 generates the uniform RGB input. Seed 91403 resets k-means random draws before each repetition. Five warmups precede 30 measured samples. Cases run in the listed order in one process. Arrays and services are prepared outside timing. Assertions validate populated palette bounds, sample counts and match results after the timed call. The retained JSON field `medianMs` is the upper median, the 16th ordered sample out of 30. The report labels this explicitly. Sample p95 uses the nearest-rank value. Actual k-means iteration counts were not instrumented. The RGBA conversion row benchmarks a synthetic equivalent of the caller loop.

## 2026-11-07 addendum

A Claude Code session ran the addendum on branch `codex/rust-opportunities-20261106` at `3c0f265`, in a Linux container with Node 22.23.4 and rustc 1.97.0. Runtime source at that commit is identical to the snapshot. It installed dependencies with `pnpm install --frozen-lockfile --ignore-scripts`, built core and its dependencies, compiled [the kernel](rust-kernel/src/lib.rs) to `wasm32-unknown-unknown` with build output outside the repository, and ran the [harness](scripts/benchmark-rust-comparison.mjs). Before timing, the harness asserts that built core's `extractPalette` (with `Math.random` replaced by the shared LCG) equals its copy (unreachable guard clauses omitted), and that every variant equals the copy. Exact commands, results and limits are in [review-rust-comparison.md](review-rust-comparison.md). The [validator](scripts/validate-audit.mjs) was re-run afterwards. Its regenerated `snapshot.json` was restored, so the file still records the audited snapshot.

## Interpretation limits

The benchmark measures warmed Node execution of the built TypeScript implementation. It excludes startup, image decode, canvas readback, network/binding calls, card rendering, Rust compilation/instantiation and interop. Input is synthetic, predecoded and mostly uniform random, with a separate four-color case. This is a useful control for a later experiment, not an estimate of typical user latency or a Rust speedup.

The 100,000-sample case is an explicit public API override, while the ordinary adapters use core's 10,000-sample setting. The 65,536-pixel case samples a different subset and may converge differently. Its difference from the 10,000-pixel case cannot be attributed solely to sampling. Five warmups and sequential cases do not remove all JIT, cache, thermal or scheduler effects, particularly on sub-millisecond matching rows. Repeat-process and browser/workerd measurements are required before adoption.

Existing regression thresholds are broad CI checks. Passing them does not establish a user bottleneck, Rust parity, complete-core coverage or production readiness. This audit ran the selected 334 tests and fresh dependency build. It did not run the entire monorepo test/coverage graph, browser E2E or production acceptance because its changes are audit artifacts. Artifact validation separately checks local links and cited file/line existence, while substantive claims rely on source review.

Official sources were checked during this audit and linked next to the supported statements in the report. Source comments and historical notes were reconciled with current code where they diverged, including LAB/RYB behavior and the repository's retained gzip gate versus current Cloudflare size limits.
