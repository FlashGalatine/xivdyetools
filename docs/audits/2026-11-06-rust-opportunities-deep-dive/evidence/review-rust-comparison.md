# Rust/WASM palette-kernel comparison — 2026-11-07 addendum

This addendum runs the kernel-level part of [Stage 2](../REMEDIATION_PLAN.md#stage-2--core-palette-experiment) for [OPT-001](../findings/OPT-001.md). It compares the shipped TypeScript k-means, a packed TypeScript rewrite, and a Rust port compiled to WASM. The comparison runs in Node on synthetic inputs, without browser, workerd, mobile or real-screenshot measurements. The source commit is `3c0f265e147b54f43cc1bcfaaa1bb109d099e441`, whose runtime source is identical to the audit snapshot `ee4dd0b`. Commits since the snapshot touch only `docs/audits/`.

## Result

- **Parity is achievable.** With the same injected random draws, built core's `extractPalette` and a verbatim copy of its k-means produced identical palettes. Packed TS, both Rust builds and the squared-distance variants reproduced the copy's centroids and cluster sizes exactly. This held on every case, including fractional channels.
- **Rust is a constant factor, not a step change.** The Rust kernel measured 1.2–1.4× faster than equivalent packed TS, and 1.4–1.6× faster when both use squared distances. Rust with squared distances measured 2.0–2.5× faster than current code. A `+simd128` build gained nothing, because the per-sample argmin is branchy and was not auto-vectorized.
- **Most of the gain is available in TypeScript.** Packed counts/sums alone measured 1.2–1.4× faster than current code; adding squared-distance assignment made it 1.35–1.6×. That needs no new toolchain, loader or publication path.
- **After the TS fix, the remaining Rust saving is small.** Compared with packed TS using squared distances, the representative clustered inputs saved 0.9 ms (4 colors) and 3.5 ms (10 colors) in the kernel alone, and uniform 4-color input saved 3.9 ms. Whole-interaction savings can only be smaller. All three fall under the plan's proposed 5 ms bar. Only uniform-noise and fractional 10-color inputs (6.3–6.5 ms) and the 100,000-sample stress case (53 ms) cleared it.
- **Startup and size are not the obstacle.** The kernel is 25,013 bytes, uses a raw `extern "C"` ABI with no wasm-bindgen glue, and compiled and instantiated in a 0.24 ms median. The integration costs in [REFACTOR-001](../findings/REFACTOR-001.md) remain the obstacle.
- **Iteration count moves cost more than language.** The baseline's 10,000-pixel default case converged after 8 iterations. The same input took 25 iterations (the cap) for ten colors, and 26 iterations under the 100-iteration cap. That explains why the baseline's 25- and 100-cap rows are nearly equal. With this addendum's seed, the uniform 4-color case ran to the cap, taking 16.7 ms against the baseline's 4.75 ms.

## Measurements

Upper median of 30 samples after 5 warmups, in milliseconds ([raw samples and p95](rust-comparison-node.json), [console](rust-comparison-console.log)). Times cover the k-means kernel only. "Built core" also includes `extractPalette`'s option handling and result shaping.

| Case | Iterations | Built core | Current copy | Packed TS | Packed TS, squared | Rust/WASM | Rust/WASM, squared |
|---|---:|---:|---:|---:|---:|---:|---:|
| Blobs, 10k, 4 colors | 5 | 3.91 | 3.99 | 2.95 | 2.60 | 2.37 | 1.72 |
| Blobs, 10k, 10 colors | 16 | 14.23 | 14.81 | 12.23 | 10.99 | 8.85 | 7.46 |
| Uniform, 10k, 4 colors | 25 | 17.05 | 16.72 | 12.12 | 10.67 | 9.74 | 6.75 |
| Uniform, 10k, 10 colors | 25 | 24.48 | 25.19 | 20.98 | 18.38 | 16.58 | 12.10 |
| Fractional, 10k, 10 colors | 25 | 26.51 | 27.47 | 22.00 | 19.28 | 17.72 | 12.81 |
| Uniform, 100k, 10 colors | 23 | 265.05 | 277.25 | 198.37 | 172.37 | 152.22 | 119.63 |

Packing `RGB[]` into a `Float64Array` added up to 3 ms at 10,000 samples and 1–4 ms at 100,000 in the same run ([JSON](rust-comparison-node.json) `packedTSFromRGB`, `wasmFromRGB`), mostly within run-to-run noise. The JS-to-linear-memory copy is inside every WASM figure. "Blobs" means eight weighted color clusters plus 10% uniform noise. It stands in for a screenshot and does not replace the real-image corpus the plan requires. Integer inputs use the full 0–255 range.

## What each variant changes

- **Current copy** is `rgbDistance`, `rgbMean`, `kMeansPlusPlusInit`, `assignToClusters`, `updateCentroids`, `countDistinctColors` and the iteration loop from `packages/core/src/services/PaletteService.ts:117`, copied with `Math.random` replaced by a parameter. Before timing, the harness asserts that its palette equals built core's under the same draws.
- **Packed TS** reads interleaved `Float64Array` channels and keeps per-cluster counts and input-order sums instead of member arrays. It allocates nothing per pass and keeps every square root.
- **Squared** variants compare `dr² + dg² + db²` in the assignment loop only (`packages/core/src/services/PaletteService.ts:230`). K-means++ weights (`:169`) and centroid movement (`:263`) keep their square roots, so the random-draw path and the `< 1.0` convergence test are unchanged. For integer channels in 0–255, every centroid is an input pixel or a `Math.round` mean, so every squared distance is an integer no larger than 195,075. Square roots of distinct such integers differ by more than 10⁻³, far above double-precision spacing. Ordering and strict-`<` ties are therefore identical. Fractional `RGB[]` input matched on this seed but carries no such guarantee, so a core change should keep square roots or add a differential test for non-integer channels.
- **Rust/WASM** ([source](rust-kernel/src/lib.rs)) mirrors packed TS with one coarse call per extraction. JS `Math.round` is ported as ties-toward-+∞ with an explicit fractional test, because `(x + 0.5).floor()` differs at values such as 0.49999999999999994.

## Interpretation for the findings

- **OPT-001.** Land the TS control in core first: packed counts/sums plus squared-distance assignment, with seeded parity tests. Defer Rust. The measured Rust margin after that fix does not meet the plan's proposed bar on representative inputs. Reconsider with real-screenshot, browser and workerd evidence, or a larger workload such as full-resolution sampling or higher color counts.
- **OPT-002.** If a Rust kernel is ever adopted, image-worker is a cheaper first landing site than core. It is private and binding-only, runs on one runtime, already loads WASM, and has no npm publication or browser CSP. Use a separate module rather than extending the vendored Photon build, which is reproduced on Windows only, outside CI (`apps/image-worker/vendor/photon/README.md:33`), against 280 retained inputs (`:44`). A separate module pays one JS copy of the default ≤256 KiB RGBA, which is small next to the measured kernel. It duplicates the algorithm across two languages, so this harness's seeded parity check should become a test. The shared admission-slot concern is unchanged.
- **OPT-003.** Kernel language moves clustering cost by 1.2–2.5×, while a module worker removes all of it, and potentially the readback, from the UI thread. The worker remains the responsiveness fix whichever language computes the clusters.
- **REFACTOR-001.** A 25 KB raw-ABI kernel has negligible startup cost. The adoption cost is the loader matrix, publication path and browser CSP. `apps/web-app/public/_headers:31` sets `script-src 'self'` without a WASM compilation allowance such as `'wasm-unsafe-eval'`. A private-app landing defers those costs until a published kernel is justified.

## Commands

Run from the repository root. Cargo writes build output outside the repository.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm turbo run build --filter=@xivdyetools/core...
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown --manifest-path docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/rust-kernel/Cargo.toml --target-dir "$TMP/rk"
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target wasm32-unknown-unknown --manifest-path docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/rust-kernel/Cargo.toml --target-dir "$TMP/rk-simd"
node docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/scripts/benchmark-rust-comparison.mjs . "$TMP/rk/wasm32-unknown-unknown/release/palette_kmeans_comparison.wasm" docs/audits/2026-11-06-rust-opportunities-deep-dive/evidence/rust-comparison-node.json "$TMP/rk-simd/wasm32-unknown-unknown/release/palette_kmeans_comparison.wasm"
```

## Limits

- One Linux container (Intel Xeon at 2.10 GHz, 4 logical CPUs, shared), Node 22.23.4 with V8 and rustc 1.97.0. Different hardware from the Windows baseline, so compare ratios across the two runs, not absolute times.
- Rows ran in sequence in one process, so JIT, cache and scheduler effects remain. An exploratory run earlier the same day put packed TS at 1.1–1.2× over current code and Rust at 1.3–1.5× over packed TS. The conclusions above hold across both runs.
- Times cover the kernel only. Decode, readback, sampling, binding transfer, matching and rendering are excluded, as are peak memory, browser long tasks, workerd and mobile. Whole-interaction savings are bounded above by the kernel figures.
- Inputs are synthetic, and the comparison uses a single k-means seed per case.
- The kernel is audit evidence: it has no fallback, no loader adapters and no tests beyond the harness's parity assertions.
