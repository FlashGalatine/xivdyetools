# Independent verification

The final read-only review used `gpt-6.1-sol` with `xhigh` reasoning effort, following the repository's ordinary verifier policy. The reviewer confirmed each of the five findings as an evaluation proposal. The coordinator incorporated the corrections below before final validation.

| Finding | Verdict | Source basis |
|---|---|---|
| OPT-001 | CONFIRMED | `packages/core/src/services/PaletteService.ts:217` allocates per-pass arrays, `:325` repeats assignment and mean calculation, `:336` performs final assignment |
| OPT-002 | CONFIRMED | `apps/image-worker/src/photon.ts:176` and `apps/discord-worker/src/handlers/commands/extractor.ts:535` establish RGBA handoff, `apps/image-worker/src/admission.ts:18` establishes shared admission |
| OPT-003 | CONFIRMED | `apps/web-app/src/components/extractor-tool.ts:2165` yields before synchronous readback and clustering, `:2223` implements the sampled grid |
| OPT-004 | CONFIRMED | `packages/core/src/services/dye/DyeSearch.ts:182` distinguishes tree/exact matching, `apps/web-app/src/components/gradient-tool.ts:1568` preserves sequential exclusions |
| REFACTOR-001 | CONFIRMED | `packages/core/package.json:7` exposes ESM, `packages/core/src/services/PaletteService.ts:416` is synchronous, `scripts/publish-packages.ts:243` participates in controlled publication |

Corrections applied include explicit upper-median labeling for the retained 30-sample data, removing an unsupported inference about observed convergence iterations, describing the TS proposal as avoiding per-pass assignment/member arrays, and separating core's declared Node floor from its current JSON import-attribute syntax. The source uses import attributes at `packages/core/src/index.ts:386`. The packed-artifact compatibility floor remains a future validation requirement.

The reviewer also confirmed the current math equivalence evidence and official Cloudflare constraints. The five findings remain OPEN because the proposed experiments and adoption work have not run. The measured baseline covers the current TypeScript implementation.

Final audit-specific validation checks local links, cited source paths/line bounds, finding format and the tracked change allowlist. Its machine-readable result is [validation.json](validation.json). Repository checks passed 1,238 living-doc links and 34 canonical version claims. The selected core suites passed 334 tests across four files. These checks have their individual logs in this directory.

## 2026-11-07 addendum verification

An independent read-only review of the addendum ran in a separate verifier context under the repository's ordinary verifier routing. It recomputed every figure from [rust-comparison-node.json](rust-comparison-node.json). It reproduced the original baseline's 8, 25 and 26 iterations from its inputs and seed. It checked the TypeScript copy and the Rust port against `packages/core/src/services/PaletteService.ts:117`, and re-derived the squared-distance ordering argument. The recommendation was unaffected by its review.

| Check | Verdict |
|---|---|
| Timings, ratios, savings, iteration counts, kernel size and startup against the raw JSON | CONFIRMED |
| Baseline iteration counts (8 / 25 / 26) | CONFIRMED, reproduced |
| Copy and Rust port fidelity: distinct counting, k-means++ walk, strict-`<` ties, rounding, empty clusters, final pass | CONFIRMED. The copy omits guard clauses these inputs never reach, and the built-core assertion covers that. |
| Squared-distance ordering for integer channels; square roots kept in initialization and movement | CONFIRMED |
| Source citations | CONFIRMED. The k-means++ weight citation was widened to `:169`, `:177` and `:189`. |
| Overreach | OVERSTATED, corrected. The plan's 5 ms bar is defined on p95; at p95 the uniform 10-color saving is 3.67 ms. Language-only and whole-rewrite factors had been merged. The 0.24 ms startup is a warm repeated-compile figure. The SIMD explanation is unverified. A cross-machine absolute-time comparison was replaced by iteration counts. |
| Consistency across README, report, findings, plan and TODO | OVERSTATED, corrected. "Representative" inputs now consistently mean the clustered (blob) cases, with uniform 4-color stated separately. |

The corrections are in the addendum's follow-up commit. They make the deferral of Rust stronger, not weaker.
