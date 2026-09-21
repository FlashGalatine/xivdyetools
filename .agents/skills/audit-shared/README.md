# audit-shared (not a skill)

Reference files shared by the xivdyetools skills — audits (`security-audit`, `deep-dive-analysis`,
`dead-code-finder`, `i18n-manager`, `documentation-audit`, `remediation-planner`, `coverage-testing`) and the release/test
skills (`prepare-release`, `changelog-laymans`, `test-resolver`, `unit-test-writer`, `build-resolver`). There is no
`SKILL.md` here on purpose: nothing in this folder is auto-loaded. Each skill names the files to
read at its Step 0, so a run loads only the slices it needs. `model-routing.md` is the one file
**both** groups read before executing a workflow: it holds every runtime-specific convention
(Claude Code, Codex, any other agent), so the skills themselves stay vendor-neutral.

| File | Words | Read it when |
|---|---|---|
| `model-routing.md` | ~1,100 | **Before executing a skill** — `collector` / `worker` / `verifier` roles as capability tiers, mapped per runtime (Claude Code, Codex, any other agent), native tools, coordinator rules, when delegation helps, and what stays with the coordinator |
| `conventions.md` | ~1,040 | Starting any audit — output folder, IDs, finding/report/README skeletons, evidence rules, fan-out contract (+ §7a, the audit short form of model routing), confirmation gate, planner hand-off |
| `units.md` | ~430 | Tagging a finding's deploy unit / exposure class (17 units: filter names, kind, notes) |
| `release-mechanics.md` | ~300 | Writing a sprint's "Ends with" line, deciding a version bump, the standing verification gate (planner, dead-code) |
| `policy-documents.md` | ~650 | Auditing or editing a Privacy policy / Terms of Service: the four documents, the six-language `<STEM>.<locale>.md` convention, what parity means, who files what (security-audit, documentation-audit, i18n-manager) + `scripts/policy-locale-parity.py` |
| `american-english.md` | ~970 | Auditing or writing **any English text** — docs, READMEs, `en` locale values, `/manual`, English policy documents: American English is the standard, the FFXIV terminology glossary wins where it conflicts (Grey, Glamour), the identifier/quotation/non-English carve-outs, and how documentation-audit (`DOC-`) and i18n-manager (`TERM-`) file it + `scripts/american-spelling.mjs` |
| `traps/shell.md` | ~350 | Before shell commands on Windows: explicit Bash vs PowerShell, resource/temp paths, tracked-file search, CJK output, heredoc limits |
| `traps/knip-and-dead-verdicts.md` | ~400 | Before running knip or calling anything "dead"/"unreachable" |
| `traps/tests-coverage.md` | ~150 | Before trusting green tests or a coverage number |
| `traps/i18n-fonts.md` | ~290 | Before touching locale files or fonts |
| `traps/security-git.md` | ~170 | Before filing/fixing security findings or committing cleanup |
| `traps/git-worktrees-and-finishing.md` | ~700 | Before creating/removing a worktree, running "the gates", or finishing a branch (the repo facts a generic worktree / branch-finishing / verification skill does not know) |
| `changelog-contract.md` | ~550 | Editing any CHANGELOG: the two machine-parsed laymans grammars (root/Discord, web-app modal), technical format, version/commit conventions (prepare-release, changelog-laymans) |

## Discovery — where agents find these skills

The canonical, git-tracked files live in the monorepo at `xivdyetools/.agents/skills/` — the
cross-runtime location that Codex, Copilot CLI and Gemini CLI scan natively, from the working
directory up to the repository root. Claude Code scans `.claude/skills/` instead, so
`xivdyetools/.claude/skills` is a **tracked symlink** to `../.agents/skills`. Every agent reads
the same `SKILL.md`, scripts and shared references; edit the `.agents/skills/` files once. The
repo-root `AGENTS.md` points non-Claude agents at the `CLAUDE.md` project context and at
`model-routing.md`. Skills travel with clones and worktrees, so a branch carries the skill
versions that match its code — and a stale branch carries stale skills.

- **Windows:** the symlink needs Developer Mode (or an elevated shell) plus `core.symlinks=true`.
  Without both, git checks it out as a one-line text file and Claude Code finds no skills —
  nothing else breaks. Repair: `git config core.symlinks true`, delete `.claude/skills`, then
  `git checkout -- .claude/skills`.
- **Launching from a parent folder** (the maintainer opens `XIVProjects/`, which is not a git
  repo): nested `.claude/skills` load lazily, only after a file in the repo is touched, and
  Codex scans only upward from its working directory. `XIVProjects/.claude/skills` and
  `XIVProjects/.agents/skills` are therefore local directory junctions to
  `xivdyetools/.agents/skills` — untracked, recreate them if the workspace moves
  (`mklink /J <link> <target>`).
- Invoke by name: `/<skill-name>` in Claude Code, `$<skill-name>` in Codex. Restart the client if
  a new skill does not appear.

## Audit sequencing

The audit skills are written for concurrent runs merged by `remediation-planner`. When they run
**sequentially with remediation between each**, use this order — it follows each skill's Step 0
inputs and the planner's conflict rules, so no audit files findings the next step would supersede:

| # | Skill | Why here |
|---|---|---|
| 1 | `security-audit` | The only audit with time-sensitive output: Sprint 0 ships out-of-band and rotation precedes any removal commit. Reads no other audit, so nothing is lost by going first; a live vuln never queues behind a cleanup cycle. |
| 2 | `dead-code-finder` | Planner rule: **removal wins over fix/refactor**. Running it before deep-dive/i18n stops them filing `BUG-`/`HC-`/orphan findings in code about to be deleted, and every later audit reads a smaller tree. Its removals legitimately move coverage (ratchet), so it precedes the coverage baseline. |
| 3 | `deep-dive-analysis` | Its Step 0 consumes the latest security + dead-code READMEs and *Rejected suspicions*. Reads every non-test file, so it gains most from the shrunk tree. Its terminal structural refactor moves handler code — exactly what i18n's hardcoded-string and call-site checks target — so i18n must follow it. |
| 4 | `i18n-manager` | **Fonts are always last**: any locale text change (new error strings from security fixes, keys added for hardcoded strings, orphan-key removals) invalidates every CJK subset. Running after all code-changing audits means one re-subset, not three. Cheapest to re-run. |
| 5 | `coverage-testing` | Measurement, not detection. Meaningful only after dead-code removals land and deep-dive's *Untested behaviour* BUGs get tests; becomes the baseline for the next cycle / `unit-test-writer`. |

Run `remediation-planner` after each catalog, passing every still-open catalog so the plan stays
merged. If security finds nothing exploitable-now, steps 1↔2 are interchangeable (the August
2026 cycle ran dead-code → i18n → security and held up). If "sequential" only means *collecting*
catalogs with no remediation in between, order is immaterial beyond step 3's inputs — hand all
catalogs to the planner in merged mode.

## PR pre-merge passes

Whole-unit audits run on `main` **after** open PRs merge (the PRs are the audit surface; findings
pin `branch@commit` + `file:line`; remediation sprints branch off main). Before merging a PR,
run these instead — cheapest and most disqualifying first:

| # | Pass | Tool | Catches |
|---|---|---|---|
| 1 | Gates on the merged tree | `pnpm turbo run build type-check lint test` on a trial merge into current `main` (scratch worktree) | Conflicts with sibling PRs; knip / i18n / font-coverage / bundle-size gate reds CI only shows after push (the add/add file collision, the vite 8.2.2 bundle red) |
| 2 | Correctness review | Native code review (Claude example: `/code-review`) — high effort for workers/auth/D1, medium for UI | Floating promises, KV read-after-write, D1 TOCTOU, `catch {}` → 200, Lit listener leaks (PRs #149/#150/#151 each surfaced 10–15 real defects) |
| 3 | Security review of the diff | Review the diff using the available security review workflow | New routes without authz/rate-limit, PII reaching `writeDataPoint`/logs, secrets in `[vars]`, CORS/CSP regressions — mandatory when the diff touches a worker, `wrangler.toml`, `_headers`, or analytics |
| 4 | Test quality, not just coverage | `coverage-testing` for the unit + "what source edit would make this test fail?" | Vacuous assertions (`typeof x === 'function'`, `not.toThrow()` alone, guarded bodies) — see `traps/tests-coverage.md`; web-app green means little |
| 5 | Simplify | Focused simplification review (Claude example: `/simplify`) | Duplicated helpers that belong in a package, barrel exports hiding subpath intent, magic numbers — cheap now, a deep-dive finding later |
| 6 | Release contract | Manual: changelog in the right grammar (`changelog-contract.md`), version bump where a package/worker changed, `CHANGELOG-laymans.md` block for bot-facing changes | Publishes only fire on a version delta; the laymans file is machine-parsed by `/changelog` |
| 7 | Deploy-target sanity | Read any `wrangler.toml` / workflow change in the diff | Bare `deploy` is production on oauth and live beta on og/discord; vars aren't inheritable across envs |

Docs/locale-only PRs: skip 3. Dependabot bumps: 1 only, plus the bundle gate.

Monorepo facts that already live in the repo are **not** duplicated here — see
`xivdyetools/CLAUDE.md` (dependency flow, service bindings, localization pipeline, deploy hazards)
and `xivdyetools/docs/operations/DEPLOY_ENVIRONMENTS.md`. When a fact here goes stale, fix it
here once — every skill reads it from this folder.
