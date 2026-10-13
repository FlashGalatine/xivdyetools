# Review: frozen-body tier (docs/research/**, docs/superpowers/**)

Run 2026-10-11, HEAD 42c35e87 (== served 16a6123f for app code). Scope: Status lines, README/index accuracy, anchors, planned-vs-shipped wording. Bodies not rewritten; no spelling checks in this tier.

## Candidates
- cand-frozen-body-01 (MEDIUM, inaccurate/drift): superpowers/README.md:24-25, plans/2026-09-27-glamour-acquisition.md:3, specs/2026-09-27-glamour-acquisition-design.md Status say "In progress, PR A (api-worker 0.15.0) open". Truth: shipped. PR #207 (feat/glamour-acquisition) merged (git log cfc82df3); api-worker is 0.18.0 and serves apps/api-worker/src/chara/acquisition.ts + data/acquisition.en.json; web-app uses it (Glamour Reader #208 merged). Fix: set to "Shipped, api-worker 0.15.0 (PR #207), web-app half with the Glamour Reader (#208)" in all three places (conventions line says update all in the same PR).
- cand-frozen-body-02 (MEDIUM, inaccurate/drift): superpowers/README.md:25 says Glamour Reader "Approved 2026-09-27, in progress (PRs B-D)". Its own spec Status says "implemented 2026-09-27, #208/#209/#210" and the plan says "executed 2026-09-27"; merges e24741c6 (#208), 5925c499 (#209), 6982e0d5 (#210) are on main, and web-app/glamour-tool.ts exists. Fix: "Shipped, PRs #208/#209/#210 (web-app 5.13.0)".
- cand-frozen-body-03 (LOW, drift): research/index.md:14 outcome for 2026-09-27-glamour-acquisition reads "Design proposed: ...", but the design shipped (acquisition table served by api-worker; see 01). The dir README itself says "research complete; design in spec" (fine). Fix: "Shipped, build-time Teamcraft + XIVAPI table served by api-worker 0.15.0 (spec link)".
- cand-frozen-body-04 (MEDIUM, drift): research/index.md:10 says character-sheet labels "Not yet applied to core / web-app / bot". Truth: partly applied. packages/core/scripts/build-locales.ts:1111 (de highlightColors 'Strähnen'), :1114 tattooColors 'Tattoo / Äußere Iris'; core locales de.json:220 'Strähnen'; web-app locales de/fr/ja contain the client terms. en.json:223 still 'Tattoo/Limbal' (house choice). Not verified per-locale for ko/zh/bot-logic, so cite as "partly applied; confirm remainder". Fix: "Applied to core's generator and web-app in part; see TERM-003/004/021 status" or reword to what remains.

## Positive controls
- All 13 plans/* carry exactly one `**Status:**` line (line 3); 11 are true at HEAD (beta deploy: deploy-web-app-beta.yml + check-beta-build.js exist; smoke-test-pages.js exists; presets-api migrations 0009/0010 exist; local-presets PARKED true: git grep LocalPresetService in apps/packages returns nothing; harmony wheels, web/bot analytics, dead-code guardrails, sprint-0 webhook bytes merged).
- superpowers/README.md indexes all 13 plans and 12 specs (13 rows; image-worker and webhook rows have no spec by design; audit-CI spec has no plan, marked Superseded). Spec Status lines match README except the two glamour rows.
- research/index.md lists all 15 directories (every research/* dir has a row). Other outcome lines checked true: color-matching vocabulary matches packages/core/src/types/index.ts:38; patch-7.5, monorepo-2.0, chara-equipment-resolution, discord-alternatives status lines consistent.
- Anchors: 22 anchored relative links across all 148 frozen files plus the two indexes; all resolve (script, headings slugified; includes ffxiv-terminology.md#character-creation-color-sheets).

## Rejected suspicions
- Plan 2026-09-15 sprint-0 says "authenticated moderation acceptance still pending": operational acceptance, not checkable from source; README says Shipped (merge is true). Left unverified, not filed.
- No per-file Status in research/*: standing rejection.
- Plan 2026-09-04 line 3248 mentions `**Status:**` as an instruction inside the body: body text, not a second status line.

## Coverage
| path | tier | units | sections reviewed | result |
|---|---|---|---|---|
| superpowers/README.md | frozen-body index | 1 | whole | reviewed (cand 01, 02) |
| superpowers/specs/* | frozen-body | 12 | Status lines, link anchors | reviewed (acquisition spec in cand 01; reader spec true) |
| superpowers/plans/2026-08-09-beta-web-app-deployment.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-09-image-worker-split.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-10-pages-smoke-test.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-10-preset-preview-images.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-11-preset-categories-and-image-editing.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-16-local-presets-5-1.md | frozen | 1 | Status | reviewed, true (still parked) |
| plans/2026-08-29-bot-analytics-tier-a.md | frozen | 1 | Status | reviewed, true |
| plans/2026-08-29-web-analytics.md | frozen | 1 | Status | reviewed, true |
| plans/2026-09-01-dead-code-guardrails.md | frozen | 1 | Status | reviewed, true |
| plans/2026-09-04-harmony-color-wheels.md | frozen | 1 | Status | reviewed, true |
| plans/2026-09-15-sprint-0-webhook-bytes.md | frozen | 1 | Status | partial, acceptance clause unverifiable |
| plans/2026-09-27-glamour-acquisition.md | frozen | 1 | Status | reviewed, STALE (cand 01) |
| plans/2026-09-27-glamour-reader.md | frozen | 1 | Status | reviewed, true |
| research/index.md | frozen index | 1 | whole | reviewed (cand 03, 04) |
| research/2026-09-03-algorithm-fact-check, 2026-09-04-harmony-color-wheels, api, color-matching, color-mixing, monorepo-2.0, monorepo-consolidation, patch-7.5, chara-equipment-resolution, discord-alternatives, 2026-09-28-*, 2026-10-08-acquisition-gaps | frozen | ~130 | README heads/status, outcome vs index, anchors | historical context |
| research/2026-09-27-glamour-acquisition, 2026-10-05-character-sheet-terms | frozen | 4 | head + outcome | reviewed (cand 03, 04) |

## Spelling per document
Not in scope for this tier: 0 filed for every document.
