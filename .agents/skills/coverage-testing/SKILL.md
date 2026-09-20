---
name: coverage-testing
description: Use when asked to measure, baseline, or report test coverage (statement, branch, function, line) for a xivdyetools app or package, or to check coverage against a threshold.
allowed-tools: Bash, Read, Glob, Grep, Agent
---

# Coverage Testing (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Every workspace runs **Vitest + @vitest/coverage-v8** with `json-summary`/`text` reporters;
coverage output lands in `<unit>/coverage/` (gitignored). Runs from the monorepo root.

## Parameters

| Param | Values |
|---|---|
| FOCUS | `statement` · `branch` · `function` · `line` (column to judge) — `unit`/`integration`/`e2e` just select which suite to run |
| PROJECT | deploy unit (`apps/og-worker`, `packages/core`); multiple → run each. pnpm filter names: apps are `xivdyetools-<dir>` (oauth = `xivdyetools-oauth-worker`), packages `@xivdyetools/<dir>` — full table in `../audit-shared/units.md` |
| BASELINE | % threshold; default = the unit's own `vitest.config.ts` thresholds (verify there — as of 2026-08: api-worker/moderation-worker 90/80/90/90, oauth 90/85/90/90, discord-worker 84/77/88/85, og/image/presets/stoat 85/80/85/85, web-app **ratchet** 71/55/65/72 — never lower; packages declare none → aggregator's 90 %) |

## Steps

**Routing (`../audit-shared/model-routing.md`):** Steps 1–2 are a fixed command list whose
output is a multi-thousand-line vitest log. When delegated, use `collector` assignments per
PROJECT within the runtime's concurrency limit; return only the per-file table, the TOTAL line,
and any failing test names. Follow the shared coordinator rules for inline/delegated execution.
Step 3 (reading zero-hit sites) and recommendations use the `worker` role, inline when permitted
or delegated per unit when several units are below baseline.

```bash
git rev-parse --short HEAD; git branch --show-current
# 1. run (turbo rebuilds stale dependency dists first; set -o pipefail so a threshold miss shows)
set -o pipefail; pnpm turbo run test:coverage --filter=<name> 2>&1 | tee "<TMP>/<log-id>-coverage.log"
# fallback: pnpm --filter <name> run test:coverage        (web-app: vitest --coverage)
# 2. per-file table for the FOCUS column, worst first (path.relative — backslash regexes get mangled by the Bash tool; skip 0/0 files)
node -e 'const p=require("path"),s=require("./<unit>/coverage/coverage-summary.json"),k="<branches|statements|functions|lines>";
const rows=Object.entries(s).filter(([f,c])=>f!=="total"&&c[k].total>0).map(([f,c])=>[p.relative(process.cwd(),f),c[k]]).sort((a,b)=>a[1].pct-b[1].pct);
for(const [f,c] of rows)console.log(String(c.pct.toFixed(1)).padStart(5)+"%",(c.covered+"/"+c.total).padStart(9),f);
console.log("TOTAL",s.total[k].pct+"%",s.total[k].covered+"/"+s.total[k].total)'
# 3. ONLY if some file is below baseline: its zero-hit sites from coverage-final.json (branches: c.b / branchMap; functions: c.f / fnMap; lines: c.s / statementMap)
# 4. ONLY if asked for the whole-repo view: node scripts/coverage-report.ts   (Node 22 runs the .ts directly; other units' coverage/ dirs may be stale — read only the rows you ran)
```

Verdict: PASS ≥ baseline · WARNING within 5 points below · FAIL otherwise. A failing *test* is
reported before any coverage number (vitest exits non-zero either way — read the log).
**Stop at the verdict when it is PASS** — no per-file deep dives, no source reading; name the
three lowest files in one line and finish. Step 3 and test recommendations exist for files
*below* baseline only.

## Report (plain markdown, no boxes)

```
Unit <name> @ <commit> · focus <col> · baseline <n>% · actual <m>% · <PASS|WARN|FAIL>
| File | <col> % | covered/total | status |      ← files below baseline only (PASS: one line naming the 3 lowest + count of the rest)
Failing tests: <none | list>
Recommendations: only for below-baseline files — zero-hit lines/branches + one concrete test per cluster; PASS → "none required"
```

## Notes that change the verdict

- CI (`ci.yml`) runs `turbo run test` **without** `--coverage` — thresholds are enforced only by
  local `test:coverage` and by this skill.
- A coverage drop with no source change is usually a constant-valued mock crossing a component
  threshold; bisect with historical test files before blaming the runner.
- Removing fully-covered dead code lowers aggregate coverage legitimately — report it as such.
- When recommending tests, reject shapes that cannot fail (`typeof x === 'function'`,
  `not.toThrow()` alone, guarded bodies, pre-captured values) — see `../audit-shared/traps/tests-coverage.md`.
- CI runs ~5× slower than local; perf benchmarks in core time the CIEDE2000 linear scan, not the
  k-d tree — check the path before adjusting a budget.
