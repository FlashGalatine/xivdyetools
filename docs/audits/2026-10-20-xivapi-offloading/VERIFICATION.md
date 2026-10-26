# Verification record

Date: 2026-10-20. Baseline: `b98c8584a85f5dc50b4b4392c508cc627ef004d6`.

## Independent review

A native read-only verifier ran with `gpt-6.1-sol / xhigh`; two inventory workers used `gpt-6.1-sol / medium`. The selected model and effort are supported by the advertised runtime; no custom-agent model pin was used. No separate runtime model introspection probe was performed.

| ID | Verdict | Evidence / disposition |
|---|---|---|
| V1 | CONFIRMED | Independently recomputed 125 unique rows and four populated locales, all 16 metallic flags, A85/B9/C11 expected consolidated links, and 22 hex differences. |
| V2 | CONFIRMED | Stain.Item[] is captured; StainTransient reports missing sheet at both tested versions. The guide's lines 48/363 are outdated for these versions. |
| V3 | CONFIRMED | Trimmed CSV differences: en0, ja0, de118, fr125. French differences are case-only; German differences include adjectival forms. |
| V4 | REJECTED as initially phrased | Evidence does not establish a positive claim that Stain.Color is an interface swatch or explain rendered-material color. Final report only describes numeric discrepancies and unresolved cause/fidelity. |
| V5 | CONFIRMED | Existing model search, Glasses and icon code plus local resolver policy support retaining the shared integration. |
| V6 | CONFIRMED with scope | Row cache has shape/game version but no schema; chara readers discard staleness. Equipment/Glasses misses lack coalescing. Latest-version discovery already memoizes its Promise; Universalis is a separate path. Final wording narrowed accordingly. |
| V7 | CONFIRMED | Captured API format enum is jpg/png/webp, with no documented raw human.cmp or palette endpoint. |
| V8 | CONFIRMED as recommendation | A pinned report-only maintenance command fits the verified evidence and existing offline build contract. It has not been implemented. |

The verifier reread raw captures and source without making new network requests or running application tests. Coverage is against the known local catalog, not an exhaustive upstream inventory.

## Artifact checks

- 23 saved HTTP response bodies checked against the manifest's SHA-256 and byte counts.
- All 25 JSON files parsed successfully.
- All five research scripts parsed as Python syntax; they are preserved research utilities, not production features.
- New audit relative links checked, including the index target.
- `git diff --check` passed for the tracked index edit.
- Main checkout remains unchanged; research is isolated on `docs/xivapi-offloading-research`.
- Only `docs/audits/index.md` and the new dated audit directory are modified/untracked in that worktree.

No application builds, unit suites or deployment checks were run: there are no application/source-data changes. No commit, push, issue comment, deployment or publication was performed.


## Full-sheet discovery follow-up (2026-10-20)

The same read-only verifier independently confirmed the three discovery response hashes, byte counts, URLs and pagination. Pages contain 100/29/0 rows: 129 unique IDs exactly 0–128, with 125 named nonzero rows equal to the local dye ID set. All four locale names are populated for those 125 rows; there are zero new or missing local candidates. Row 0 is No Color/Terebinth; rows 126–128 are blank in all four languages with zero Item links.

The first request resolves current version/schema from the response; subsequent pages explicitly pin those returned values. Total captured bytes: 48,984. The terminal empty page proves completion for this served snapshot. This does not prove release/obtainability of future unknown rows.

Coordinator checks for the addendum: discovery hashes/bytes and pagination rechecked; six Python research scripts parsed; all audit JSON parsed; all audit relative links resolve. Existing production data and original 25-request captures remain unchanged. No importer, schedule, commit or deployment was added.
