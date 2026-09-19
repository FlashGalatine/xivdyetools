# Frozen-body review — docs/research/ + docs/superpowers/

Scope: every `.md` file under `docs/research/` and `docs/superpowers/` (107 files; the folders also
hold 21 non-`.md` probe/script/log/pdf files with no status banner, not individually itemized below).
Per `docs/CLAUDE.md`'s tier rule, these two trees are **frozen-body**: body content is never
fact-checked or flagged for describing old behaviour. Only `Status:` lines/banners, index coverage
(`docs/research/index.md`, `docs/superpowers/README.md`), and relative links were checked.

Reference point: `origin/main` @ `0fec18f4`, 2026-09-18. Known merged PRs used for cross-checks
(all confirmed via `git log --oneline --all --grep`): #123 (monorepo 2.0), #149, #150, #157, #164,
#167, #168, #169, #170, #183, #184, #185, #186, #187, #188.

## Coverage table

| folder | files (status line read) | result |
|---|---|---|
| docs/research/ (index.md) | 1 | reviewed |
| docs/research/2026-09-03-algorithm-fact-check/ | 7 | reviewed |
| docs/research/2026-09-04-harmony-color-wheels/ | 10 | reviewed |
| docs/research/api/ | 9 | reviewed |
| docs/research/chara-equipment-resolution/ | 1 | reviewed |
| docs/research/color-matching/ | 3 | reviewed |
| docs/research/color-mixing/ | 2 | reviewed |
| docs/research/discord-alternatives/ | 16 | reviewed |
| docs/research/monorepo-2.0/ | 23 | reviewed |
| docs/research/monorepo-consolidation/ | 11 | reviewed |
| docs/research/patch-7.5/ | 2 | reviewed |
| docs/superpowers/ (README.md) | 1 | reviewed |
| docs/superpowers/plans/ | 11 | reviewed |
| docs/superpowers/specs/ | 10 | reviewed |
| **Total** | **107** | |

Method: read the top ~30 lines of every `.md` file (`head -n 30` + status-keyword grep, then full
read where a hit or ambiguity existed) to locate a `Status:` banner; cross-checked each banner that
made a shipped/planned/pending claim against `git log`, current package.json versions, and whether
the described source/route/file still exists. Ran a mechanical relative-`.md`-link resolver over
all 107 files (157 links checked, `dirname` + `os.path.normpath` + `test -f`) — 0 broken. Folder
membership in `docs/research/index.md` and `docs/superpowers/README.md` was diffed against
`find`/`git ls-files` — both indexes list every folder/plan-spec pair that exists, with one
exception (cand-4).

## Candidates

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---|---|---|---|---|---|
| FB-1 | MEDIUM | PLANNED-VS-SHIPPED | docs/research/monorepo-2.0/README.md:5 | Status says "Research phase. No code changes are made by these documents" — but Monorepo 2.0 / Web-App 5.0 shipped (8 packages exist today, no `apps/maintainer`, matching the file's own "Decisions Already Made" table) | `git log --oneline --all --grep "#123"` → `2790344a Merge pull request #123 from FlashGalatine/monorepo-2.0-prep` (2026-08-28); `ls packages/` → 8 dirs, no `apps/maintainer`; contradicted by the same repo's own docs/research/index.md:18 ("Shipped 2026-08-28 (PR #123)") |
| FB-2 | MEDIUM | PLANNED-VS-SHIPPED | docs/superpowers/specs/2026-08-29-web-analytics-design.md:3 | Status says "approved design, awaiting implementation plan" — but the paired plan and the index already record it shipped | docs/superpowers/plans/2026-08-29-web-analytics.md:3 ("shipped — PR #149 …"); docs/superpowers/README.md:20 ("Shipped — PR #149, api-worker 0.9.0 `POST /v1/telemetry`"); `git log --oneline --all --grep "#149"` → `4c213248 feat: make the web-app's Enable Analytics toggle real … (#149)` (2026-08-29) |
| FB-3 | MEDIUM | PLANNED-VS-SHIPPED | docs/superpowers/plans/2026-09-15-sprint-0-webhook-bytes.md:3 | Status says "merge, deployment and authenticated moderation acceptance remain pending" — but the branch it describes was merged | `git log --oneline --all --grep "#184"` → `20d63756 Merge pull request #184 from FlashGalatine/fix/sprint-0-webhook-bytes` (2026-09-16), touching `apps/discord-worker/src/index.ts`, `apps/discord-worker/src/utils/github-verify.ts` exactly as the plan's Task 2 describes |
| FB-4 | MEDIUM | PLANNED-VS-SHIPPED | docs/research/2026-09-03-algorithm-fact-check/04-proposed-changes.md:3 | Status says "proposal only — no code changed in this pass" — but the proposal was implemented | `git log --oneline --all --grep "#164"` → `282808db Merge pull request #164 …fix spectral mixing (P0), collapse duplicate RYB, harden correctness` (2026-09-04), bumping `packages/core/package.json`, `apps/og-worker/…`, `apps/web-app/src/components/swatch-tool.ts`; also stated shipped by docs/research/color-mixing/README.md:3-6 ("both were fixed in PR #164 (core 4.4.0 and 5.0.0)") |
| FB-5 | LOW | MISSING | docs/superpowers/README.md (table, lines 10-22) | `docs/superpowers/plans/2026-09-15-sprint-0-webhook-bytes.md` exists (created by the same PR #184 above) but is not linked from the Feature/Spec/Plan/Status table — every one of the other 10 files in `plans/` is linked, this one alone is not | `grep -oE '\(plans/[^)]+\)' docs/superpowers/README.md` → 10 rows, missing `plans/2026-09-15-sprint-0-webhook-bytes.md`; file exists at that path |
| FB-6 | LOW | STALE-STATUS | docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md:4 | Status says only "approved" — never updated to "implemented"/"shipped" per the repo's own convention, while the paired plan and index already say "Shipped" | docs/superpowers/plans/2026-08-10-pages-smoke-test.md:3 ("shipped — `apps/web-app/scripts/smoke-test-pages.js`…"); docs/superpowers/README.md:14 ("Shipped — …"); convention stated at docs/superpowers/README.md:27 ("When a feature ships, update the spec's Status line… in the same PR") |

## Positive controls (checked and correct — do not re-chase)

- docs/research/patch-7.5/README.md:3-5 — `CONSOLIDATED_DYES`, `getMarketItemID()` still exist and are tested: `packages/core/src/config/__tests__/consolidated-ids.test.ts:4,6,57,66`.
- docs/research/color-mixing/README.md:3 — the six blending modes it lists match `packages/core/src/blending/types.ts:8` (`'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral'`) exactly, including the RYB/spectral fix-in-PR-#164 note.
- docs/research/chara-equipment-resolution/README.md:8 — `POST /v1/chara/resolve` and `GET /v1/chara/icon/:id` both still exist and are tested: `apps/api-worker/src/chara/router.test.ts:55,88,270,290`.
- docs/superpowers/plans/2026-08-16-local-presets-5-1.md:3 / specs/2026-08-16-local-presets-5-1-design.md:4 — still correctly PARKED: `git grep -l "LocalPresetService" apps/web-app/src` returns nothing.
- docs/superpowers/plans/2026-09-01-dead-code-guardrails.md:3 and specs/2026-09-01-dead-code-guardrails-design.md:4 — PR #157 confirmed merged (`e7ac4042 Merge pull request #157: dead-code audit remediation + guardrails`, 2026-09-02); `knip.jsonc` and `scripts/check-dead-code.ts` both exist in the tree.
- docs/superpowers/plans/2026-09-04-harmony-color-wheels.md:3 / specs/…-design.md:5 — PR #167 confirmed merged (`95337727`, 2026-09-05), agreeing with docs/research/index.md:11.

## Rejected items (looked wrong, were right)

- docs/research/color-matching/COLOR_MATCHING_ALGORITHMS.md:5 ("Status: Complete - Ready for Implementation") — read as a claim about the *feature's* deploy state at first glance, but it's a claim about the *research document's* own completeness (finished researching, ready to hand off), which remains true regardless of what later shipped. Not a candidate.
- docs/research/color-mixing/color-spaces-research.md:3 ("Status: Research Document") — same reasoning; it labels the document type, not a shipped/planned claim. The per-feature "✅/❌" table below it is body content (frozen, not fact-checked per the task's own kind rules).
- docs/superpowers/specs/2026-08-09-beta-web-app-deployment-design.md:4 ("approved; Cloudflare-side setup complete") — does not assert the code is unshipped (unlike FB-2/FB-6's specs), so it isn't actively contradicted by the plan's "shipped" status; left as a rejected near-miss rather than a candidate.
- `apps/discord-worker/register-commands` / npm-publish "owed by hand" items from memory were **not** re-checked here — out of this cluster's scope (they aren't in docs/research/ or docs/superpowers/).
- Mechanical link scan (157 relative `.md` links across all 107 files) found 0 broken links — no BROKEN-LINK candidates in this cluster.
