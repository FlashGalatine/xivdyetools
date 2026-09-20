# Audit conventions (xivdyetools)

Shared by every audit skill. Read once per audit; the skill tells you which sections it uses.

## 1. Output location

`xivdyetools/docs/audits/YYYY-MM-DD-<scope>-<type>/` — `<scope>` is the deploy unit
(`web-app`, `og-worker`, `discord-worker`…) or omitted for whole-repo runs; `<type>` is
`security` | `deep-dive` | `dead-code` | `i18n` | `documentation`. Examples: `2026-08-21-security`,
`2026-08-20-web-app-i18n`.

```
<folder>/
  README.md            index table + scope/branch/commit/method + top items (replaces any manifest)
  <TYPE>_REPORT.md     the catalog: SECURITY_AUDIT_REPORT | DEEP_DIVE_REPORT | DEAD_CODE_REPORT | I18N_AUDIT_<date>
  findings/<ID>.md     one file per finding (skeleton in §3)
  evidence/            raw tool output, per-unit reviewer returns, scripts actually used
  REMEDIATION_PLAN.md  written by remediation-planner (CLEANUP_PLAN.md for a standalone dead-code run)
```

No manifest, no `by-category/`, no `EXECUTION_TASKS.md`, no ASCII-box summaries — each of
those restated every finding a second or third time. The README carries scope/commit/method.

## 2. Finding IDs

| Skill | Prefixes (independent counters) |
|---|---|
| security-audit | `FINDING-` |
| deep-dive-analysis | `BUG-`, `REFACTOR-`, `OPT-` |
| dead-code-finder | `DEAD-` |
| i18n-manager | `I18N-`, `TERM-`, `HC-`, `FONT-` |
| documentation-audit | `DOC-` |

- Every counter **restarts at 001 in every audit folder**. Never continue from an older audit.
- Outside its own folder an ID is **qualified by folder**: `2026-08-18-og-worker-dead-code/DEAD-014`
  (commit messages, plans that merge folders, cross-references). Bare IDs are fine inside the folder.
- An unresolved finding carried into a new audit gets a **new ID** plus a `Supersedes
  <folder>/<old-id>` line. A regressed security fix is a **new finding**, cross-linked — the
  regression itself is evidence (fix incomplete or no guarding test).
- Assign IDs as findings are confirmed, not retroactively; an un-ID'd finding cannot be scheduled.

## 3. Finding file skeleton (≤ 25 lines)

```markdown
# <ID>: <one-line title naming file/symbol and the defect>
**<Severity|Confidence>:** … · **<Exposure|Blast radius|Impact>:** … · **Deploy unit:** <from units.md> · **<Rotation|Semver|Locale(s)>:** …

## Location
- `path/file.ts:line` — what is there (≤ 3 bullets)

## Evidence
- ≤ 3 bullets: the command/test that proves it + result, or a ≤ 8-line excerpt. Point at `evidence/…` for bulk output.

## Fix
- Direction in ≤ 3 lines (exact steps for removals; what must be rotated for leaks).

## Status
OPEN — or `FIXED <date> <short-sha>` with a half-line of what landed; the report's status table mirrors this.
```

Domain-specific fields go in the bold header line — the skill names them. Do not add
Description/Impact/Why-hidden sections; fold one sentence into the title or Evidence.

## 4. Catalog report skeleton

```markdown
# <Type> — <scope> (<date>)
- **Branch/commit:** … · **Scope:** … · **Method:** gates run + sweeps + verification
- **Totals:** N findings (by severity/tier) · **Sprint 0 (act now):** IDs or "none"

## Catalog
| ID | Title | <Sev/Conf> | <Exposure/Blast/Locale> | Deploy unit | <Rotation/Semver> |   ← one row per finding

## Positive controls          what is already right and should not be re-filed next time (≤ 10 bullets)
## Rejected suspicions        candidates checked and dropped, with the one-line reason (keeps the next audit from re-chasing them)
## Recommendations            guardrails to add (gates, lint rules, tests) — ≤ 8 bullets
## Remediation status         | ID | Status | Commit |   — kept current while fixes land
## Next steps                 link REMEDIATION_PLAN.md
```

## 5. README skeleton

Title line; 2–3 sentence summary with totals and "no source files modified by the audit";
table `| File | Purpose |` for every top-level file/folder; `## Top items` — ≤ 6 numbered
lines, each `**ID (SEV)** — unit: one sentence`.

## 6. Evidence rules

- Raw tool output goes to `evidence/<tool>.<txt|json>`; the report quotes counts, not dumps.
- Every grep that feeds a finding runs over `git ls-files` (see `traps/shell.md`) and the
  command is recorded next to its result.
- Scripts written for the audit are saved under `evidence/scripts/` so the next run can reuse them.
- Never paste exploit detail for an unpatched security finding anywhere outside the audit
  folder until the fix ships.

## 7. Fan-out contract (scope spans > 1 deploy unit)

Use one bounded `worker` assignment per deploy unit when parallel review helps. Choose the
runtime's model/tool via §7a, respect its concurrency limit, and batch small related units
when separate agents would add overhead. Single-unit scopes can run inline except where
the coordinator rules in §7a require delegation. Each delegated prompt contains:

1. The unit path + the skill's checklist section (paste the checklist, not the whole skill).
2. "Read-only. Write exactly one file: `<folder>/evidence/review-<unit>.md` (route/command
   table or module map, positive controls, rejected items, files covered)."
3. The return schema — **≤ 40 lines**:
   `| cand-id | sev | file:line | one-line claim | evidence pointer |` + `POSITIVE:` bullets + `COVERED:` file count.

The coordinator **verifies every candidate at `file:line` before filing** — findings are leads,
not gospel (the 2026-08-16 audit's "unreachable CSS" and three "dead" e2e fixtures were wrong).
Dropped candidates go to *Rejected suspicions*. Subagent IDs (`cand-…`) never leak into the catalog.

## 7a. Model routing

Read [model-routing.md](model-routing.md) for Claude/Codex model selection, runtime tools,
coordinator rules, the *Never delegate* list, and the verification prompt contract. The audit
short form: a `collector` runs noisy command blocks, a `worker` reviews each unit, and a
`verifier` confirms candidates at `file:line` and grades them. Select the model explicitly
when the runtime supports it. Rejected candidates carry their reason into *Rejected suspicions*.

## 8. Confirmation gate

Before any code change: present the catalog **and** the plan; call out Sprint 0 by ID; for
security confirm the rotation checklist with whoever holds the credentials; get an explicit
yes. Fixes then follow the plan sprint by sprint (one commit per task or sprint, verification
gate at every sprint boundary), and each fix updates the finding's `## Status` + the report's
status table.

## 9. Hand-off to the planner

Load `remediation-planner` with `<folder>/<TYPE>_REPORT.md [more catalogs…] [--output <path>]`
using the runtime's skill loader or by reading `../remediation-planner/SKILL.md`.
Pass every catalog that exists for the same codebase so one merged plan is produced. The
planner owns ordering (P0 first, one deploy unit per sprint, domain principles). The skill's
only job is a catalog with `Deploy unit` filled in for every row.
