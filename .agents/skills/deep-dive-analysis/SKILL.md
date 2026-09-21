---
name: deep-dive-analysis
description: Use when asked to deep-dive, find hidden bugs, analyze code quality, find refactoring or optimization opportunities, or do a comprehensive analysis (beyond a normal code review) of a xivdyetools package, worker, or app, or to plan remediation sprints for such findings.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
---

# Deep-Dive Analysis (xivdyetools)

Find hidden bugs, refactoring opportunities and optimizations in a deploy unit, document each
with evidence **before any modification**, and hand the catalog to `remediation-planner`
(user-facing integrity first, one deploy unit per sprint, structural refactor last). Runs from
the monorepo root `xivdyetools/`.

Before executing the workflow, read `../audit-shared/model-routing.md` for the Claude/Codex runtime,
model-role, shell, and tool conventions; the primary coordinator applies its routing rules.

## Parameters

| Param | Values |
|---|---|
| SCOPE | deploy unit(s): `apps/presets-api`, `packages/core`, … |
| OUTPUT | default `docs/audits/YYYY-MM-DD-<scope>-deep-dive/` |

## Step 0 — load context

Read `../audit-shared/conventions.md` + `model-routing.md`, `../audit-shared/units.md`, `../audit-shared/traps/shell.md` and
`traps/tests-coverage.md` (+ `traps/knip-and-dead-verdicts.md` when the unit is web-app). In the repo: the unit's `CLAUDE.md`, `DEPRECATIONS.md` (decided consolidations — e.g.
blending-conversion unification was *declined* with recorded deltas; don't re-propose), and the
latest deep-dive / security / dead-code audit README + *Rejected suspicions* for the unit (old
findings carry forward with new IDs, `Supersedes <folder>/<ID>`).

## Step 1 — setup + baseline

After `mkdir`, the rest is fixed commands writing to `evidence/` — assign them to the `collector` role
(`../audit-shared/model-routing.md`) when delegated; it returns the paths, the hot-spot list and the
gate/coverage headline numbers only. Follow the coordinator rules for inline versus delegated execution.

```bash
git rev-parse --short HEAD; git branch --show-current; git status --porcelain -- <scope>
mkdir -p <OUT>/{findings,evidence}
git ls-files <scope> | grep -v -E '/(dist|coverage)/' | xargs wc -l | sort -n | tail -15   # hot spots
git log --since=<last-audit-date> --format='%h %ad %s' --date=short -- <scope> > <OUT>/evidence/commits-since-last-audit.txt
pnpm turbo run type-check lint test --filter=<name> > <OUT>/evidence/gates-baseline.txt 2>&1 || true
pnpm --filter <name> run test:coverage 2>&1 | tail -40 > <OUT>/evidence/coverage-baseline.txt   # uncovered = where hidden bugs live
# lead lists (tracked files only)
git ls-files '<scope>/src/**/*.ts' | grep -v '\.test\.ts$' | xargs grep -n -E 'catch\b|waitUntil|\.batch\(|Promise\.all|setTimeout|JSON\.parse|Date\.now|new Date|fetch\(|parseInt|Number\(|as any|!\.' > <OUT>/evidence/pattern-grep.txt
```
README stub: scope, branch@commit, versions, method, deploy units in scope (from `units.md`).

## Step 2 — hidden bugs (checklist by surface)

Read every non-test file in scope plus the package entry points it calls. Scope > 1 unit → fan
out per `conventions.md` §7 (split by unit, or by layer — handlers / services / middleware+data —
for one large unit) using the `worker` role per §7a; reviewers return `kind | sev | file:line |
claim | why tests miss it | covered by test?`; coordinator verifies each at `file:line` — a
`verifier` role, inline or delegated according to the coordinator rules.

| Surface | Look for |
|---|---|
| **Workers / Hono** | floating promises (side effects without `waitUntil`/await); module-scope caches or counters shared across requests; KV read-after-write assumptions (eventual consistency); D1 COUNT-then-INSERT TOCTOU, missing `.batch()`/transactions, `RETURNING` misuse; middleware ordering (auth after handler, rate-limit after work); error handler swallowing (`catch {}` → 200), opaque 500s from schema drift (schema.sql vs `migrations/`); fetch without timeout/AbortSignal (Universalis, XIVAPI, Perspective); cache key collisions; `ctx.executionCtx` casts; env validation latched once per isolate |
| **Discord interactions** | 3-second ack vs deferred path; 15-minute interaction-token expiry on long jobs; component/custom_id state limits; 25-choice autocomplete cap; embed/field length limits; locale fallback (`Translator.t()` returns the key, never falsy → dead `|| 'x'`); `/stats`/`/preset` translator bypass history |
| **Lit / web-app** | listeners added in `connectedCallback` without removal; `innerHTML =` re-render dropping listeners/state; shadow-DOM CSS boundary (tool CSS must be shadow-side); controllers with stale closures; rAF/`setTimeout(0)` timing; `LanguageService.t()` fallbacks; storage parsing without guards; OAuth `state` round-trip |
| **Color / dye math (core)** | ΔE aliases (`ciede2000` canonical, `cie2000` normalized — `===` traps); k-d tree vs linear-scan code paths and their benchmarks; `getMarketItemID`/`CONSOLIDATED_DYES` mapping (105/125 dyes share 3 itemIDs); facewear legacy IDs frozen; `itemID > 0` (never null-checks); hex/branded-type validation; float equality; empty collections |
| **Generic** | off-by-one, null/undefined through optional chains, swallowed rejections, inverted conditions, unreachable branches, stale caches/invalidation, integer parsing of user input |
| **Tests that cannot fail** | `typeof x === 'function'`, `not.toThrow()` alone, guarded `if (count >= 2)` bodies, asserting a value captured before the action, arithmetic the test computed itself — file as BUG (type *Untested behavior*): the hidden bug is whatever that test was supposed to catch |

## Step 3 — refactoring + optimization (short lists)

**REFACTOR-**: functions > 50 lines / files > 800 lines on the hot-spot list; duplicated helpers
across apps that belong in a package (check DEPRECATIONS.md + Monorepo 2.0 decisions first);
barrel exports hiding subpath intent; magic numbers for limits/timeouts; layer violations
(handler doing SQL); inconsistent error shapes across routes.
**OPT-**: N+1 D1 queries, missing `.batch()`; repeated expensive color math without memo; unbounded
`O(n²)` over the 125-dye set is fine — flag only per-request `O(n³)`/string growth; missing edge
cache / `Cache-Control`; bundle size (discord-worker gzip limit 3,072 KiB — ~14 % headroom; web-app
`build:check` budget; CJK subsets); eager loading in the SPA (lazy chunks).

## Step 4 — findings (`findings/<PREFIX>-XXX.md`, skeleton `conventions.md` §3)

| Prefix | Header fields |
|---|---|
| `BUG-` | **Severity** CRITICAL/HIGH/MEDIUM/LOW · **Type** (Race, Edge case, Resource, Error handling, Logic, State, Untested behavior) · **Deploy unit** · **Covered by test?** yes/no — Evidence includes the reproduction scenario in one line |
| `REFACTOR-` | **Priority** · **Effort** LOW/MEDIUM/HIGH · **Risk** · **Deploy unit** (primary + others if cross-cutting) |
| `OPT-` | **Impact** · **Category** (Algorithm, Memory, I/O, Caching, Bundle) · **Deploy unit** · **Expected gain** (quantified) · **Benchmark** (how to measure) |

## Step 5 — `DEEP_DIVE_REPORT.md` (skeleton `conventions.md` §4)

Three catalog tables (bugs `| ID | Title | Sev | Type | Deploy unit | Tested? |`, refactors
`| ID | Title | Pri | Effort | Deploy unit |`, opts `| ID | Title | Impact | Category | Deploy unit |`),
*Status basis* (fixed during analysis vs outstanding), *Positive controls*, *Rejected suspicions*,
*Recommendations* (guardrails: a test per BUG, lint rule, gate).

## Step 6 — hand off + confirm

Hand off to `remediation-planner` through the available skill loader (or read its `SKILL.md` if no
loader is available), passing `<OUT>/DEEP_DIVE_REPORT.md` (+ other open catalogs
for a merged plan — a bug fix in code a dead-code audit marks REMOVE is superseded). Planner rules
this audit relies on: correctness before performance, refactors ride with the bugs they prevent,
structural refactor last, Sprint 0 = ship what was already fixed. Then the confirmation gate
(`conventions.md` §8).

## Rules

- Documentation before modification; every finding verified at `file:line`; every finding tagged
  with a deploy unit (the planner cannot schedule without it).
- Practical over exhaustive: distinguish "should fix" from "nice to have"; consider the 5.0 launch
  state and the unit's age.
- A finding whose fix needs a new package version is two sprints (publish, then consumer deploys) —
  say so in `## Fix`.
