# A-CORE implementation evidence — 2026-10-27

This sprint prepares core 5.16.0 MINOR, web 5.16.1 PATCH and Discord 5.9.2 PATCH on the
A-WORKER-KIT branch's accepted source. Registry checks returned core 5.15.0, bot-logic
4.11.0 and worker-kit 1.5.0. No package was published and no production merge was performed.

## Scope and compatibility

- DEAD-002/003: refresh facade comments, current docs and npm attribution; remove the seven
  stale barrel tags while preserving exported names. Already-correct shader/entrypoint text
  stays intact.
- DEAD-020/021: move the 8,192-byte limit and nine live type contracts into independent
  modules. Preserve root exports, legacy reexports and type shapes. The /chara runtime
  closure must not reach the legacy parser or palette data.
- DEAD-024 phase 1: deprecate six legacy symbols in 5.16.0, retain their implementations,
  signatures, values and host/library parity tests. Core 6 removal remains gated by a
  published MINOR, consumer acceptance and bot-logic oracle migration.
- BUG-003: producer/nickname labels retain at most 256 UTF-16 units without splitting a
  surrogate pair. No ellipsis or filename change; A-WEB retains its separate filename task.
- FINDING-002 core companion: process whitespace runs linearly, replacing only those that
  contain CR/LF. Preserve internal non-newline whitespace, trimming and ring-name equality.
  API body/name bounds and SVG fitting remain outstanding; the finding remains open.

## Red, green and mutation verification

The forced baseline passed 3,395 tests across 75 files. New focused regressions failed
against the original code, and the intended implementation passes 3,418 tests. Baseline
and changed-suite sandbox attempts hit the existing stain-audit temporary-directory rename
test with EPERM; identical elevated retries passed. No assertion or limit was weakened.

Mutation probes restored raw label slicing, the original quadratic regex and the facade's
legacy-parser constant import in turn. Each corresponding regression failed, then the intended
source was restored byte-for-byte. The old regex timed out and its isolated child was killed
at about 10 seconds on one million internal spaces; the corrected actual-source probe took
350 ms for the child and 2.17 ms for formatting in the recorded focused run.

| Check | Actual result |
|---|---|
| New focused regressions on original source | Exit 1: 3 failed, 145 passed |
| Original-regex bounded source probe | Exit 1: killed with ETIMEDOUT after 10,021 ms |
| Intended targeted source | Exit 0: 149 tests in four files |
| Final full core suite after mutation restoration | Exit 0: 3,418 tests in 76 files |
| Final core build, type-check and lint/knip | Exit 0 each; two existing lint warnings match baseline |
| Mutation: raw label slice | Exit 1: both crossing-surrogate tests failed, 87 passed |
| Mutation: original quadratic regex | Exit 1: killed with ETIMEDOUT after 10,011 ms |
| Mutation: legacy-parser constant import | Exit 1: actual-entry closure failed, nine tests passed |

Emitted declarations retain 196 root exports and six /chara exports. The 22 compared
declaration shapes are preserved, including the equivalent direct Race | null spelling.
The eight legacy-parser and eight legacy-resolver exported names remain; all ten parser and
eight resolver function bodies match the base after comment removal. Four unused old-resolver
type reexports carry documented compatibility tags while root/live consumers use the new module.

## Broader gates and package verification

The first sandbox graph attempt stopped at the existing core rename restriction, leaving
downstream package artifacts unavailable. The identical elevated
`pnpm turbo run build type-check lint test --concurrency=2` passed **62/62 tasks, 30 cached**.
Its 17 test summaries total **16,333 passing tests: 13,522 executed and 2,811 replayed from
cache**. A later exact-command replay also passed 62/62 with all tasks cached. No Turbo
`--force` flag was added to these two runs.

All five affected app bundle gates passed after completing that graph:

| App / check | Result |
|---|---|
| Web `build:check` | Exit 0; one-locale JS 2.17/2.20 MB, all-locales JS 2.46/2.73 MB; all bundle budgets pass |
| Discord `check-bundle-size` | Exit 0; 2,734.2/3,072 KiB gzip, 337.8 KiB headroom |
| API production Wrangler dry run | Exit 0; 715.77 KiB gzip |
| OpenGraph production Wrangler dry run | Exit 0; 1,953.55 KiB gzip |
| Moderation production Wrangler dry run | Exit 0; 57.79 KiB gzip |

API's docs build passed as a local prerequisite for its production dry run. Initial
missing-artifact and sandbox Wrangler log-write failures remain in the local logs beside
the successful elevated results. All Wrangler commands used `--dry-run`; no live deploy
command was run. Dead-code checks passed over 620 production and 598 test files; documentation
checks passed for 1,041 links across 258 documents and 34 version claims. All seven worker
logging configurations passed. Whitespace and uncommitted-diff secret scanning passed.

`pnpm pack` produced a local core 5.16.0 artifact with 250 files, the unchanged exports map,
the new limits/types modules, README/NOTICE attribution and published dependency specifiers
logger 2.3.0, types 3.3.0 and xivcharakit exactly 0.1.0-beta.4. SHA-256:
`f541bef1c14cb056d062ab43b5c619d7ebed87520505fef9506ca99dec364163`.
Packed-JavaScript smoke checks pass for both entry points, retained legacy functions/constants,
surrogate boundaries and the million-space output. The harness uses the worktree's installed
dependencies and existing tsx JSON loader; it is a local package check, not a registry publish
or a standalone vanilla-Node compatibility claim.

Independent Sol/xhigh review approved the implementation and public API. Its actual-source
comparison found identical GPOSERS public groups/ring behavior in 22,621 cases, and the label
function matched a separate code-point oracle in 1,728 boundary cases. It independently checked
the nine relocated contracts, 22 declaration shapes and legacy implementations. A separate
Astra/high final security/public-API review found no Critical, Important or Minor issue.

## Automatic beta verification after branch push

The existing feature-branch workflows deployed source commit
`33c5abc7de1a9bc27d43942692b8a4687c0e0636`:

- [Beta web run 40483082880](https://github.com/FlashGalatine/xivdyetools/actions/runs/40483082880)
  succeeded, including beta-build identity verification, bundle budget, the actual Cloudflare
  Pages deployment and its fresh-deployment/domain smoke test.
- [Beta Discord run 40483082783](https://github.com/FlashGalatine/xivdyetools/actions/runs/40483082783)
  succeeded, including the actual deployment and guild-scoped command registration.
- [Beta OpenGraph run 40483082809](https://github.com/FlashGalatine/xivdyetools/actions/runs/40483082809)
  succeeded, including deployment, health smoke and emitted-card-URL smoke checks.

Job/step readbacks distinguish these actual deployments from skipped missing-token guard jobs.
PR [CI run 40483159301](https://github.com/FlashGalatine/xivdyetools/actions/runs/40483159301)
succeeded: audit, lint/type-check/test/build, secret scanning and Playwright E2E all passed.
Top-level run readbacks confirm success for CI and all three beta workflows. These receipts
describe automatic beta workflows, not a manual or production deployment. The subsequent
receipt-only documentation commit leaves the verified package/app source unchanged.

## Rollout and remaining work

Existing workspace consumers bundle local core source. A core-path merge triggers web,
Discord, API, OpenGraph and moderation production workflows independently of npm. Feature
pushes can replace the shared web, Discord and OpenGraph betas. The maintainer selected
retaining those workflows with validation of affected apps. No manual deployment is planned.

The [draft PR #338](https://github.com/FlashGalatine/xivdyetools/pull/338) is stacked on #337.
Registry publication and production acceptance remain separate release actions. Audit IDs remain open while their
source is prepared; the plan's fixed-ID count is unchanged. Private upstream correspondence
is outside this repository and is not part of the change.
