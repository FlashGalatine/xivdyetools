# Sweep E — CHANGELOGs

Scope: root `CHANGELOG.md` and `CHANGELOG-laymans.md`; every workspace `CHANGELOG.md`;
`apps/discord-worker/CHANGELOG-laymans.md`; `apps/web-app/CHANGELOG-laymans.md`. Method: for each
workspace, the commit that introduced the top `## [x.y.z]` heading was found with `git log -S`, then
every later non-merge commit touching the workspace was listed and matched against the entry text;
the last three entries of each file were spot-checked against the code they describe.

Baseline: `1eb57cda` (= `origin/main`, 2026-09-05). Pre-verified: every workspace's `package.json`
version equals its top CHANGELOG heading.

## Coverage

15 of 19 changelog-bearing workspaces had zero undocumented post-entry commits. The exceptions:

| Workspace | Undocumented commit | Disposition |
|---|---|---|
| `apps/web-app` 5.7.0 | `2128e0d3` — only a share link resets the wheel; in-app dye hand-offs keep it | Added to the 5.7.0 entry; the "from a deep link" claim on the pin-clearing bullet corrected to "from a share link" |
| root `CHANGELOG.md` 2.1.0 | `2085aae4` (`deploy-api-worker.yml` gains `packages/svg/**`), `7c4d923a` (`knip.jsonc` excludes the `.vitepress/env.d.ts` shim) | Recorded in the new 2.2.0 entry |
| `apps/web-app` | `05a99d51` / `7cff6fab` add `scripts/generate-api-docs-icons.mjs` | Already documented at `apps/api-worker/CHANGELOG.md` 0.13.0 (the surface it serves) — no change |

## Hygiene

| ID | File | Issue | Disposition |
|---|---|---|---|
| H-1 | `apps/web-app/CHANGELOG.md` | Two different `## [2.0.0] - 2025-11-18` entries plus a `## [2.0.0] - 2025-11-16` | Left as historical record (renumbering a 2025 release would invent history) |
| H-2 | `apps/og-worker/CHANGELOG.md` | Trailing `## Planned` block listing shipped features (comparison / accessibility / budget cards, caching) | Removed |
| H-3 | root, `apps/stoat-worker`, `packages/bot-logic`, `packages/svg` | `[x.y.z]: …/compare/vA...vB` footers pointing at tags — the repository has no tags at all, and the root footer stopped at 1.14.0 | Removed |
| H-4 | root `CHANGELOG.md` 2.0.0 | Dated 2026-08-16 but lists auth 2.0.0, test-utils 1.3.0, stoat-worker 0.2.3 (2026-08-31) and logger 2.1.1 (2026-08-30) | Re-dated to the merge, 2026-08-28, with the branch-cut date noted |
| H-5 | root `CHANGELOG-laymans.md` archive comment | "(#158/#159/#160, #162, #163)" omitted #161, the source of the entry's own hand-off section | Corrected to "(#158–#163)" |
| H-6 | `packages/worker-kit/CHANGELOG.md` | 1.0.0 / 1.1.0 / 1.2.0 appear twice | Not a defect — the second set sits under the explicit "Predecessor history: worker-middleware" divider |
| H-7 | `apps/discord-worker/src/services/changelog-parser.test.ts` | The root layman's file gets a weaker parse gate than the bot's own (no all-headings / ordering / budget checks) | Not changed in this audit (test code); recorded as a follow-up |

Clean: no `## [Unreleased]` anywhere; every heading dated except four deliberate structural ones;
all 19 files in descending version order; no entry attributed to the wrong workspace.

## Layman's changelog gaps (standing rule: all three files cover every user-visible change)

Added to the root file's `[5.1.1]` archive block: Swatch share previews unfurling the generic card
(og-worker 2.5.0), share links dropping the sharer's locale (og-worker 2.7.0), 4K / ultrawide
screenshots refused at the pixel gate (image-worker 1.3.0), the web-app 5.0.1 leftover-English
fixes and 5.0.2 fixes, and the bot's 5.1.2 batch. Added to the bot's file under `[5.1.2]`: the empty
image-file message (5.1.3) and the 4K screenshot fix. The root file's newest entry is unchanged, so
the announcement webhook (which renders only `parseAll(content)[0]`, already memoised for 5.4.0)
does not fire again.

PR #167/#168/#169 coverage: every affected workspace has an entry (types 3.2.0, core 5.2.0, svg
4.1.0, bot-logic 4.2.0, web-app 5.7.0, discord-worker 5.5.0, og-worker 2.10.0, api-worker 0.13.0 +
0.14.0) and the three layman's files cover #167. #168/#169 have no layman's entry by design — neither
changes a player surface.

## Web-app What's New parser rule (for the record)

`apps/web-app/vite-plugin-changelog-parser.ts`: a release header must match
`## … Version X.Y.Z …` (not the Keep-a-Changelog `## [x.y.z] - date` form); a block is cut at the
first `---`; sections split on `### ` with a headerless implicit section since 5.6.1; a release with
zero sections is dropped silently; 50-release cap. The current file conforms (26 headers, all with a
`### ` section, newest 5.7.0 = `package.json`).

## Wrong facts inside recent entries

Only the two corrected above (the "deep link" wording and the PR list). Every PR number, finding id,
sibling-version requirement and file path sampled from 2026-08-28 onward resolved.
