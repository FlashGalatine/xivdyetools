# Verifier verdicts — web-app, specifications, versions, frozen-body (2026-09-18)

Verified at `0fec18f4` (= `origin/main` = the revision every production deploy workflow last
succeeded on). Candidate ids are the reviewers' working ids; the catalog in
`../DOCUMENTATION_AUDIT_REPORT.md` maps them to `DOC-` ids.

| cand | verdict | sev | location (corrected) | decisive evidence |
|---|---|---|---|---|
| WAP-01 | CONFIRMED | MEDIUM | `docs/projects/web-app/tools.md:58` | Doc: "the tool has no share button and reads no params". `extractor-tool.ts:1166-1169` creates `v4-share-button` with `tool = 'extractor'`; `:2237 getShareParams()`, `:2280 getShareParamsFromCurrentUrl()` — restored by `3eaca5a7` (BUG-002, PR #188). |
| WAP-02 | CONFIRMED | MEDIUM | `docs/projects/web-app/components.md:74`; `tools.md:167,169` | Neither `item-links-menu.ts` nor `glamour-list-actions.ts` is named; both are live (`chara-import.ts:498`, `:1422`). No tracked doc outside audit evidence mentions either. |
| WAP-03 | CONFIRMED | MEDIUM | `docs/projects/web-app/overview.md:242` | Doc: "Every backend the app calls enforces an origin allowlist". `apps/api-worker/src/index.ts:100-103` is `cors({ origin: '*' })`; the page's own table at `:250` says so. |
| ES-01 | CONFIRMED | MEDIUM | `docs/specifications/community-presets.md:1246` | Doc: "Submit preset \| 10 per hour per user". `rate-limit-service.ts:23-24` `DAILY_SUBMISSION_LIMIT = 10` ("per user per day"); `specifications/index.md:34` already says per day. |
| ES-02 | REJECTED | — | `docs/specifications/multi-color-extraction.md:216-224` | The page's own Overview (`:9`) carries an "As shipped" sentence giving the 3-10 range and `/extractor image colors:`, repeated at `:203` and `:230`. |
| ES-03 | CONFIRMED | LOW | `docs/specifications/multi-color-extraction.md:198` | File table names `color-matcher-tool.ts`; the component is `extractor-tool.ts`. |
| ES-04 | CONFIRMED | MEDIUM | `docs/specifications/budget-aware-suggestions.md:3,53,102` | Describes budget as controls on Color Matcher and a `max_price` option on `/match`. It shipped as `budget-tool.ts` and a standalone `/budget` (`registry.ts:48`); `feature-roadmap.md:325` says so. The only sibling spec with no `> Feature Status:` / as-shipped banner. |
| ES-05 | CONFIRMED | MEDIUM | `docs/versions.md:10` | "auth 2.0.2 still needs npm publication" — npm `latest` is 2.0.2 (`npm-versions.txt`). The sentence never names the four packages that are ahead of npm: logger 2.2.1/2.2.0, worker-kit 1.4.0/1.3.0, core 5.3.0/5.2.0, bot-logic 4.3.0/4.2.0. The rest of the paragraph is still true. |
| FB-01 | CONFIRMED | MEDIUM | `docs/research/monorepo-2.0/README.md:5` | "Status: Research phase. No code changes…" — PR #123 merged 2026-08-28 (`2790344a`); `research/index.md:18` says "Shipped". |
| FB-02 | CONFIRMED | MEDIUM | `docs/superpowers/specs/2026-08-29-web-analytics-design.md:3-4` | "approved design, awaiting implementation plan" — the plan exists and reads "shipped — PR #149"; `superpowers/README.md:20` agrees. |
| FB-03 | CONFIRMED | MEDIUM | `docs/superpowers/plans/2026-09-15-sprint-0-webhook-bytes.md:3` | "merge, deployment … remain pending" — PR #184 merged 2026-09-16 (`20d63756`); `read-text-capped.ts` is in the tree. |
| FB-04 | REJECTED | — | `docs/research/2026-09-03-algorithm-fact-check/04-proposed-changes.md:3` | "no code changed in this pass", pinned to base `876cfc2f`, is pass-scoped and claims nothing about the present — the frozen-body carve-out. `research/index.md:14` carries the current state. |
| FB-05 | CONFIRMED | LOW | `docs/superpowers/README.md:9-22` | 11 plan files tracked, 10 linked; `plans/2026-09-15-sprint-0-webhook-bytes.md` is the one missing. |
| FB-06 | CONFIRMED | LOW | `docs/superpowers/specs/2026-08-10-pages-smoke-test-design.md:4` | "Status: approved" while its plan and the README say shipped; README `:27` requires the bump. LOW because nobody is misled about whether the feature exists. |
| WUG-01 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/swatch-matcher.md:169-174` | Table uses 0-1 / 2-10 / 10+ bands. `band-vocabulary.ts:95` cuts are `[5, 10, 20]` → SAME/CLOSE/NEAR/FAR (`result-card.ts:1035`). Four sibling guides already print the right table. |
| WUG-02 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/swatch-matcher.md:63` | Lists 4 inspect targets and 2 external sites; `result-card.ts:1835` adds Swatch, `:1886`/`:1893` add TeamCraft and Saddlebag Exchange. The "Swatch" omission is arguable, the two sites are not. |
| WUG-03 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/swatch-matcher.md:123` | "the three closest swatches" — `swatch-tool.ts:631-645`: "the hardcoded top-3 is cut", `scored.slice(0, this.maxResults)` (1–6). |
| WUG-04 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/swatch-matcher.md:89-113` | Never says a gear row is clickable; `chara-import.ts:481-509 attachItemLinks()` opens the five-database item-links menu (PR #173). |
| WUG-05 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/swatch-matcher.md:115-117` | Never names **Copy list** / **Export .md**; `chara-import.ts:1384-1405 renderListActions()` (PR #187). |
| WUG-06 | CONFIRMED | MEDIUM | `docs/user-guides/web-app/getting-started.md:110` | "seven of the nine tools have a Share button … Palette Extractor and Community Presets do not" — it is eight of nine since `3eaca5a7`. |

**Shared root causes.** WAP-01 + WUG-06: one commit (`3eaca5a7`) restored the Extractor's share link.
WAP-02 + WUG-04 + WUG-05: PRs #173 and #187 shipped with no documentation anywhere under `docs/`.
