# Deep-dive analysis — whole monorepo, preview of the 2026-10-04 batch merge (2026-10-04)

**175 findings:**
- **156 BUG:** 1 HIGH, 35 MEDIUM, 120 LOW; 17 of them are untested behaviour;
- **9 REFACTOR** and **10 OPT.**

**Where they come from:**
- **Origin:** 8 were introduced by open PRs (#224, #225, #229, and one refactor spanning #224/#225/#227); all are LOW or refactor. The other 167 are already on `main`.
- **Blocking:** **no finding blocks tomorrow's batch merge.**
- **No source files were modified by the audit.**

**What was read:** a **local, never-pushed preview branch**, `preview/integration-2026-10-04@80262a2f`. It is `main@8ecb878f` with the 13 PRs open on 2026-10-04 merged in, plus the dead-code audit's two Sprint 0 fixes. So it is the code that will be on `main` after the batch merge.

**How:**
- 27 slice reviewers and 4 cross-PR contract reviewers.
- A verifier on every candidate.
- An independent skeptic on every bug graded MEDIUM or above. It refuted none, kept 1 HIGH and 47 MEDIUM, and moved 22 MEDIUM to LOW.
- A completeness critic and a gap sweep: 266 verdicts in all.

[REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) is **one merged plan** for this catalog and the 2026-10-04 dead-code catalog, and it supersedes that audit's `CLEANUP_PLAN.md`.

| File | Purpose |
|---|---|
| [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md) | Decide-before-merge list, BUG / REFACTOR / OPT catalogs, positive controls, rejected suspicions, recommendations, status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint 0 (before the merge); 21 one-unit sprints (packages in dependency order); 4 terminal structural sprints, each a publish plus its consumers' deploys; superseded items; KEEP register |
| [findings/](findings/) | 175 finding records |
| [evidence/](evidence/) | Each item lists its files: |

**Evidence files:**

| Kind | Files |
|---|---|
| Baseline | `baseline.md`; gate, coverage and bundle logs |
| Review inputs | the reviewer brief; the 27 slice lists |
| Reviews | the per-slice, per-contract and gap reviews (`review-*.md`) |
| Verdicts | every verdict with its skeptic view (`verdicts.tsv`, `workflow-result.json`) |
| Lead lists | the files and commits changed since the last deep dive, and the scripts used |

## Top items

1. **BUG-001 (HIGH)** — web-app: in Swatch, changing an unrelated sidebar setting (max results, a display option) switches the palette, race and gender to the config controller's defaults and drops the selection. Each later change repeats it.
2. **BUG-029 (MEDIUM)** — web-app: the Presets tool marks live saved community presets "Removed by its author" after a swallowed API failure, for saved local palettes, or against a stale filtered response.
3. **BUG-021 (MEDIUM)** — web-app: a language switch empties or hides the results of the Harmony, Mixer, Comparison and Accessibility tools.
4. **BUG-004 / BUG-003 (MEDIUM)** — discord-worker:
   - a preset submitted through the bot gets two moderation posts;
   - the webhook posts every flagged edit as a new preset, with no diff or Revert button.
5. **BUG-007 (MEDIUM)** — oauth: the `/auth/*` rate limiter keys on the raw percent-encoded path while Hono routes on the decoded one.
6. **BUG-010 (MEDIUM)** — presets-api: repeated dye ids pass validation, bypassing the 3-dye floor and the duplicate-preset signature.

## Versions at snapshot (preview branch)

| Unit | Version | Unit | Version |
|---|---|---|---|
| apps/api-worker | 0.16.1 | packages/auth | 2.0.2 |
| apps/discord-worker | 5.8.0 | packages/bot-logic | 4.5.0 |
| apps/image-worker | 1.3.3 | packages/core | 5.8.0 |
| apps/moderation-worker | 1.8.0 | packages/logger | 2.2.1 |
| apps/oauth | 3.1.2 | packages/svg | 4.3.0 |
| apps/og-worker | 2.11.1 | packages/test-utils | 2.0.1 |
| apps/presets-api | 2.4.0 | packages/types | 3.2.0 |
| apps/stoat-worker | 0.3.2 | packages/worker-kit | 1.4.1 |
| apps/web-app | 5.14.0 | | |
