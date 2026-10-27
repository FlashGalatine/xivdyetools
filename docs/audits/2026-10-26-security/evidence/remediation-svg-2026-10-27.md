# A-SVG implementation evidence — 2026-10-27

Scope: FINDING-002's SVG `fitText` companion only, stacked on A-CORE PR #338 at
`f8e16740ce0222a2dd9493d42ee90bd9b8303ae7`. Prepare SVG 4.4.1, Discord 5.9.3 and OpenGraph
2.12.1. No merge, npm publication or production deployment has been performed.

## Recheck and preserved contract

At base `f8e1674`, the repeated join/pop/width measurement in `packages/svg/src/frame.ts`
could do quadratic work on a long label. The planned fix was a single code-point scan using the existing
one-character width helper and original addition order. Preserve the original-content fast
path, first-code-point fallback, post-selection trim, ellipsis, width classes and all public
signatures. The legacy stopping predicate is a negated greater-than comparison; using less-than
or assuming positive sizes would change NaN/negative/infinite cases.

Independent preflight compared the old function to the proposed algorithm in 541,737 cases
with zero mismatches, covering all fonts, Unicode/whitespace and numeric edge classes. This
checked the algorithm; at that preflight stage, actual-source regressions, mutation checks
and review remained required. The completed checks are recorded below.

## Baseline and verification in progress

The SVG/dependents gate passed 35/35 tasks, all cached. The existing SVG suite was then run
fresh: 538 tests across 22 files passed. Root/frame declarations and export names were
captured before edits. Frozen dependency installation used 497 cached packages and changed
no lockfile. Initial Bash shell selection/MSYS permission errors were environmental; the
native Git Bash launcher with elevation ran the unchanged commands successfully.

## Red, green and mutation verification

The actual implementation uses O(n) time and constant scan state: the original width fast
path, one code-point scan, then the selected slice/trim. It calls the existing width helper
for each character; no classifier, public export or arbitrary input cap was added.

| Check | Result |
|---|---|
| New focused tests against original source | Exit 1: one bounded-work failure, 23 passed |
| Intended focused tests | Exit 0: 24 passed, including 21,660 actual legacy-oracle comparisons |
| Mutation: restore old loop | Exit 1: bounded-work test fails, 23 skipped |
| Mutation: replace negated greater-than with less-than-or-equal | Exit 1: NaN literal expects `AB…`, receives `A…`; 23 skipped |
| Final restored SVG suite | Exit 0: 562 tests in 23 files |
| Final build, type-check and lint/knip | Exit 0 each |

The complexity regression counts actual string-iterator visits for a 2,048-code-point mixed
ASCII/CJK/emoji/space input. Its 16,416-visit guard stops the old algorithm deterministically;
it does not depend on a timing threshold or leave a slow process running. The full original
iterator descriptor is restored in `finally`, including on failure. Both mutations restored
the intended source byte-for-byte before the final suite.

The sole lint warning, the missing return type in untouched `preset-swatch.ts:69`, is also
present in the saved baseline. No assertion, lint rule or threshold was weakened. Emitted
root and frame declaration files are byte-identical to baseline; the root exports 125 names.

## Independent review and local package check

Sol/xhigh task review approved specification compliance and quality. A separate actual-source
comparison against the base implementation covered 633,664 cases with zero mismatches,
including all/default fonts, Unicode, random IEEE values and adjacent floating thresholds.
The reviewer confirmed unchanged signatures/width helpers and the linear/constant-state bound.

`pnpm pack` produced a local SVG 4.4.1 artifact with 79 files, unchanged root/frame declarations
and dependencies resolved to core 5.16.0 and types 3.3.0. The new tests are excluded. SHA-256:
`2c545784f2ad1c1a5f9ecf13f81b9f26a4352484028d916e85f4eacae00e48c2`.
Packed JavaScript passes six numeric/Unicode literals and fits a 400,000-code-point mixed
string in the local smoke check. It uses installed worktree dependencies and the existing
tsx JSON loader; this is a local packaging check, not registry publication or a standalone
vanilla-Node compatibility assertion.

## Whole graph, root and affected-app gates

`pnpm turbo run build type-check lint test --concurrency=2` passed 62/62 tasks, 33 cached.
The 17 workspace test summaries total 16,357 passing tests across 570 files: 10,128 executed
and 6,229 valid cached replays. Standalone script tests passed 167/167; script type-check,
dead-code, docs links/versions and worker logging gates all exited 0. Documentation checks
covered 1,041 links across 258 documents and 34 version claims. Dead-code scanned 620
production and 599 test files; all seven worker log configurations passed.

All five affected app bundle gates exited 0:

| App/check | Result |
|---|---|
| Web `build:check` | One-locale JS 2.17/2.20 MB; all-locales JS 2.46/2.73 MB; budgets pass |
| Discord `check-bundle-size` | 2,734.3/3,072 KiB gzip; 337.7 KiB headroom |
| API production Wrangler dry run | 715.77 KiB gzip; prerequisite docs build passed |
| OpenGraph production Wrangler dry run | 1,953.61 KiB gzip |
| Moderation production Wrangler dry run | 57.79 KiB gzip |

Wrangler commands used `--env production --dry-run`; no live deploy command was run.
All commands passed without retries. Whitespace and working-diff secret scanning passed.
Final Astra/high review approved code semantics and release preparation, with no Critical or
Important issue; its minor historical-evidence wording correction is applied here.

## Automatic beta verification after feature push

The unchanged feature workflows deployed source commit
`ac8c9892e794ac78964f35b8be8f3cb0e2fac7d9`:

- [Beta Discord run 40501338239](https://github.com/FlashGalatine/xivdyetools/actions/runs/40501338239)
  succeeded, including the actual worker deployment and guild-scoped command registration.
- [Beta OpenGraph run 40501338038](https://github.com/FlashGalatine/xivdyetools/actions/runs/40501338038)
  succeeded, including actual deployment, health smoke and emitted-card-URL resolution.
- [Beta web run 40501338022](https://github.com/FlashGalatine/xivdyetools/actions/runs/40501338022)
  succeeded, including bundle budget, beta-build identity check, Pages beta deployment and
  fresh-deployment/domain smoke test.

Job/step readbacks distinguish successful deployments from skipped missing-token guards.
PR [CI run 40501426325](https://github.com/FlashGalatine/xivdyetools/actions/runs/40501426325)
succeeded, including lint, types, scripts, package tests/build, bundle/logging checks,
secret scanning, production-dependency audit and Playwright Chromium E2E. Top-level run
readbacks confirm success for CI and all three beta workflows. The report-only full-tree
audit still lists five development-tool advisories (one high, three moderate, one low);
its exit-1 annotation is nonblocking under the existing `continue-on-error` configuration.
Dependency remediation remains outside A-SVG. The subsequent receipt-only documentation
commit leaves the verified package/app source unchanged.

## Versions and rollout

Fresh npm checks returned SVG 4.4.0, core 5.15.0 and bot-logic 4.11.0. The local stack prepares
core 5.16.0; it must be published before SVG 4.4.1, whose packed core dependency resolves to
that local version. Package preparation and automatic workspace app deployment are distinct.

SVG filters trigger production web, Discord, API, OpenGraph and moderation. The feature push
can replace the shared web, Discord and OpenGraph betas under their existing guards. Retain
those workflows and validate all five affected app bundles. Discord and OpenGraph execute the
changed fitter; API/web consume glyphs and moderation uses bot helpers. Parked Stoat also
calls a generator before discarding its SVG, without an automatic deployment in this sprint.

Discord 5.9.3 follows the separate core/Discord 5.9.2 deployment in the release sequence;
OpenGraph 2.12.1 identifies the runtime hardening. Security-only changes stay out of all
player-facing changelogs. The [draft PR #339](https://github.com/FlashGalatine/xivdyetools/pull/339)
is stacked on #338. These receipts are automatic beta actions; registry publication and
production acceptance remain separate release work.

FINDING-002 stays OPEN: API response/name bounds and production release verification remain
separate work. No fixed-ID count is increased by this source preparation.
