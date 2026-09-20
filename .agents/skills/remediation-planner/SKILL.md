---
name: remediation-planner
description: Use after an audit catalog exists (security-audit, deep-dive-analysis, dead-code-finder, i18n-manager) or when asked to plan sprints, schedule findings, build a remediation/cleanup plan, or merge several audits into one plan for xivdyetools.
allowed-tools: Bash, Read, Write, Glob, Grep, Agent
---

# Remediation Planner (xivdyetools)

Turn one or more findings catalogs into **one** `REMEDIATION_PLAN.md` where every finding sits
in exactly one sprint, sprints are clustered by deploy unit, and each sprint ends in one
coordinated release or verification gate. The audit skills detect; this skill schedules —
planning is global (release topology), so it lives in one place.

Before executing the workflow, read `../audit-shared/model-routing.md` for the Claude/Codex runtime,
model-role, shell, and tool conventions; the primary coordinator applies its routing rules.

**Routing:** Phases 2–5 are pure judgment — tiering, ordering, and conflict resolution across catalogs
— so use the `verifier` role, inline or delegated according to the coordinator rules. Give a delegated
verifier the extracted Phase-1 rows plus `units.md` + `release-mechanics.md`, and have it return the
sprint assignment (`ID → sprint`, conflicts resolved, terminal sprint named). Phase 1 extraction across
many catalogs may go to the `collector` role, which returns the row table. The coordinator keeps Phase 6
writing.

## Inputs

`<catalog-or-folder> [<catalog-or-folder> ...] [--output <path>]`

| Source | Catalog file | ID prefixes |
|---|---|---|
| deep-dive-analysis | `DEEP_DIVE_REPORT.md` | `BUG-`, `REFACTOR-`, `OPT-` |
| security-audit | `SECURITY_AUDIT_REPORT.md` | `FINDING-` |
| dead-code-finder | `DEAD_CODE_REPORT.md` | `DEAD-` |
| documentation-audit | `DOCUMENTATION_AUDIT_REPORT.md` | `DOC-` |
| i18n-manager | `I18N_AUDIT_*.md` (+ optional `HARDCODED_STRINGS.md`, `TERMINOLOGY_VIOLATIONS.md`, `FONT_SUBSET_AUDIT.md`) | `I18N-`, `TERM-`, `HC-`, `FONT-` |

Output defaults to `<catalog folder>/REMEDIATION_PLAN.md` (shared parent folder when merging;
`--output …/CLEANUP_PLAN.md` is what a standalone dead-code run passes). **Prefer merged mode**
whenever more than one open catalog covers the same codebase — separate plans collide on
release scheduling and overwrite each other.

## Phase 1 — load

Read `../audit-shared/units.md` + `release-mechanics.md` (units, release mechanics, version rule, exposure classes) and
`../audit-shared/conventions.md` §2 (ID qualification). Then for each catalog extract: ID,
title, severity/priority, **Deploy unit**, and the domain fields: security `Exposure` +
`Rotation` + `Policy` (CORRECT/AMEND against a privacy policy or the ToS); dead-code `Confidence`/`Blast`/`Semver`/`Recommendation`; i18n `Locale(s)` +
generated-vs-hand-edited; deep-dive `Tested?`. Missing deploy unit → infer from paths
(`units.md`) before continuing. Catalogs from **different dated folders** → prefix every
ID with its folder in the plan (`2026-08-18-og-worker-dead-code/DEAD-014`); one folder → bare IDs.
Findings already marked FIXED in their `## Status` go to *Status basis*, not a sprint.

## Phase 2 — normalize to a tier

| Tier | Meaning | Typical |
|---|---|---|
| **P0** | actively harmful now | exploitable vuln; duplicate locale keys destroying translations; data-corrupting bug |
| **P1** | wrong behaviour with a real path | HIGH bugs; INTERNET-AUTH vulns; untranslated/raw-key strings shipping in UI |
| **P2** | degraded but contained | MEDIUM bugs/vulns; missing locale keys; MEDIUM-confidence removals |
| **P3** | preventative/cosmetic | hardening, INFO, optimizations, cleanup, LOW-risk removals |

## Phase 3 — ordering principles

Universal: **one deploy unit per sprint** (ends in one publish or one deploy or one verification
gate); **every finding lands in exactly one sprint** (only dead-code KEEP goes to the register).

| Source | Leads with | Sprint 0 | Terminal |
|---|---|---|---|
| security | **Severity × Exposure** (INTERNET-UNAUTH MEDIUM > LOCAL HIGH) | exploitable now — ships **individually, out-of-band**, never batched | hardening / defence-in-depth |
| deep-dive | user-facing integrity before performance | ship what the analysis already fixed | the big structural refactor (reshapes files other fixes touch) |
| dead-code | **Confidence × Blast** — safest first to prove the gates catch breakage | zero-risk hygiene (comments, unused devDeps, snapshots) | MAJOR-semver removals isolated; cascades never share their trigger's sprint; dep pruning last within a unit |
| i18n | **data loss** first (duplicate keys), then wrong text before missing text | dedupe + JSON validity, no translation changes | **fonts last, always** — any locale text change invalidates every subset |

Cross-domain: refactors ride with the bugs they prevent · **fix the generator, not the artifact**
(core locales are built from `dyenames.csv`/`build-locales.ts`) · rotation is not a code fix ·
a `Policy` edit is not a code fix either — it rides with the sprint of the unit owning the document
and never lands before the code change it describes; AMEND rows need their own line at the gate ·
a package change = one publish sprint, then one sprint per consumer deploy (see `release-mechanics.md`).

## Phase 4 — conflicts (merged mode)

| Conflict | Resolution |
|---|---|
| fix vs `REMOVE` on the same code | removal wins, fix superseded — **unless P0** (never hold a live vuln for a cleanup) |
| refactor vs `REMOVE` | removal wins |
| fix vs `KEEP` | fix stands |
| structural refactor vs fixes in the same files | fixes first, refactor last |
| locale text change vs fonts | fonts follow, last |
| two audits, same unit | one sprint — that is the point |

Every superseded ID is listed with its superseder; silent drops read as oversights.

## Phase 5 — cluster

1. KEEP → register. 2. All P0 → Sprint 0 (name which items ship out-of-band). 3. Group the rest
by deploy unit; order groups by highest tier. 4. Within a sprint: tier, then the source's own
principle. 5. Extract MAJOR removals and the structural refactor into their own sprints. 6. Tail:
hardening → structural → fonts (last of all). 7. Cascades after their trigger. 8. Verify no
orphan: every non-KEEP, non-superseded ID appears once.

## Phase 6 — write the plan

```markdown
# Remediation Plan — <date>
**Sources:** <catalogs + counts> · **Status basis:** N total — n fixed, m outstanding, s superseded, k KEEP, r need rotation
**Ordering:** 1. one deploy unit per sprint 2. P0 first 3. <dominant domain principle> 4. terminal work last (<what>)

## Sprint 0 — Emergency & prerequisites            (say which ship out-of-band; rotation checklist: rotate BEFORE pushing the removal commit)
| ID | Source | Tier | Action |

## Sprint 1 — <deploy unit>: <theme>               (1–3 sentences: what clusters here, anchor finding, the single release it ends with)
| ID | Source | Sev/Pri | Item |                   (single-source keeps native columns: Exposure · Conf/Blast · Semver · Locale(s))
**Ends with:** <exact step from release-mechanics.md — e.g. `pnpm --filter xivdyetools-og-worker run type-check lint test` → merge → deploy-og-worker.yml; or bump @xivdyetools/core → Actions publish>

## Sprint N — <terminal>
## Superseded findings  | ID | Superseded by | Why |
## KEEP register        | ID | Item | Reason | Revisit trigger |
## Standing guidance
- Verify each finding's evidence against the code before fixing — findings are leads.
- One commit per task (or per sprint when tiny); gate at every sprint boundary (release-mechanics.md → Standing verification gate); stage only your own paths.
- A ROTATE finding stays open until the credential is rotated, whatever the code says.
- Re-run the source audit's gates after each sprint; removals/fixes unlock new findings.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
```

Rows are task-shaped (one row = one commit-sized action with a fix direction) so the plan can be
executed directly with an available plan-execution skill; if optional superpowers are unavailable,
read the relevant skill's `SKILL.md` or use the host workflow — **no separate EXECUTION_TASKS document**.
Merged mode uses `| ID | Source | Sev/Pri | Item |` and folds
domain detail into `Sev/Pri` (`MED / INTERNET-AUTH`, `HIGH/NONE · MINOR`).

## Rules

- Every finding: exactly one sprint, or the KEEP register, or the superseded table.
- P0 security ships out-of-band even inside a merged plan; rotate before pushing removals.
- Fonts never re-subset before locale text is final; cascades never share their trigger's
  sprint; MAJOR removals isolated.
- `Ends with:` names the concrete command/workflow from `release-mechanics.md` — never "deploy
  everything"; remember bare `wrangler deploy` is production on `oauth` and live beta on
  `og-worker`/`discord-worker`.
- No exploit detail for unpatched findings outside the audit folder.
