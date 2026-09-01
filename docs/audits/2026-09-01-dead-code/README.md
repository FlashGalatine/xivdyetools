# Dead-code audit — whole monorepo, 2026-09-01

A dead-code pass over all 17 deploy units at `main` @ `8ca1bb09`: the five workers that had never been audited (api-worker, moderation-worker, presets-api, oauth, image-worker), plus a drift re-check of the three units cleaned in August and all eight packages. **34 findings — ≈2,690 non-test source lines, 82 CSS lines, ≈1,840 test lines, 2 dependencies and 3 orphaned scripts recommended for removal; 5 kept with a revisit trigger.** No source file was modified by this audit and nothing has been removed.

The theme: the largest tier is the one no gate in this repo can see. knip counts test files as entries and knip 6 has no `classMembers` rule, so a module imported only by tests, or a public method with no caller, reads as live — that blind spot holds 1,240 lines of orphaned web-app modules and 37 dead service methods, in the unit audited most recently. Two removals gated in `POST_MERGE_CHECKLIST.md` §3 also became actionable when the stainID migration completed on 2026-08-28, with nothing to signal it.

| File | Purpose |
|---|---|
| `DEAD_CODE_REPORT.md` | The catalog: 34 rows with confidence/blast/semver/deploy unit, quick wins, KEEP register, dependency verdicts, positive controls, rejected suspicions, recommended guardrails |
| `findings/DEAD-001.md` … `DEAD-034.md` | One file per finding — location at `file:line`, the command that proves it, and the exact removal steps with its gate |
| `evidence/` | Raw tool output: knip (root + both app configs + `--production`), `tsc-unused.txt`, per-unit `symrefs-*.txt` and `exports-*.txt`, `members.txt`, `test-only-modules.txt`, `orphans.txt`, `bindings.txt`, `deps-unreferenced.txt`, `shim-usage.txt`, `dead-css.txt`, the i18n resolutions, and the measured line spans |
| `evidence/scripts/` | Every script this pass used, reusable next time — `symrefs.sh`, `members.py`, `test-only-modules.sh`, `recheck-nonsrc.sh`, `bindings.py`, `deps.py`, `shim-usage.py`, `dead-css.sh`, `i18n-resolve-helpers.mjs`, `measure*.py` |

## Top items

1. **DEAD-001 (HIGH)** — web-app: `dye-action-dropdown.ts`, 570 lines with zero production importers; eight tool test files `vi.mock` a module their subject never imports.
2. **DEAD-002 (HIGH)** — web-app: `tooltip-service.ts` (475 lines) plus the 77 lines of `globals.css` only it consumes, while `services/index.ts` logs "✅ TooltipService ready" for a service that is never constructed.
3. **DEAD-005 (HIGH)** — web-app: 37 public service methods across 13 classes with no non-test caller (352 lines) — invisible to knip 6 by design.
4. **DEAD-014 (HIGH)** — moderation-worker: 13 test-only exports (191 lines) across six files copied from discord-worker, including a `createTranslator` the worker replaced with `createUserTranslator`.
5. **DEAD-009 (HIGH)** — presets-api: `notifyModerators` (74 lines) with no caller, keeping four `Env` fields and three production secrets alive — the §3 "gate: none" row.
6. **DEAD-028 (HIGH)** — discord-worker: `scripts/test-font-rendering.ts` is unreferenced *and* wrong since the 2026-08-29 static-font swap; run today it reports two required fonts missing and exits 1.

## Next step

`Skill(skill: "remediation-planner", args: "docs/audits/2026-09-01-dead-code/DEAD_CODE_REPORT.md --output docs/audits/2026-09-01-dead-code/CLEANUP_PLAN.md")` — then the confirmation gate before any deletion.
