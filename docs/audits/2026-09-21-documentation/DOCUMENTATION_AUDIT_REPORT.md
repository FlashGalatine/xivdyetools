# Documentation audit — whole repo (2026-09-21)

- **Branch/commit:** `claude/great-bohr-93t3qa` @ `38bb94d`, clean except this audit's own output ·
  **Served baseline:** `main` `59572c0` (2026-09-20), which this branch is 3 commits ahead of
- **Scope:** all 92 living documents, both frozen-body tiers, `/manual`, and the 4 policy documents × 6 languages
- **Method:** 2 documentation gates + `manual-check.mjs` (two refs) + `policy-locale-parity.py` +
  `american-spelling.mjs` (two modes); 5 delegated cluster reviews; every candidate re-verified by the
  coordinator at `file:line` against source before filing
- **Totals:** **22 findings** — 0 HIGH · 13 MEDIUM · 9 LOW · **Act now:** none
- **No source file and no document was modified by this audit.**

## Baseline and coverage

`evidence/baseline.md` carries the served-revision table with its evidence and limits;
`evidence/baseline-npm.txt` the registry comparison. Every app is serving `main`: five at `59572c0`,
three (image-worker, oauth, presets-api) at `0fec18f` because their workflows are path-filtered and
their paths have not changed — that is not drift. All 7 published packages are at parity with `main`;
`bot-logic` local 4.4.1 vs npm 4.4.0 is this branch's own unpublished bump.

| Tier | Files | Result |
|---|---|---|
| Living (`architecture` 7, `projects` 31, `developer-guides` 10, `user-guides` 18, `operations` 9, `maintainer` 3, `specifications` 7, `reference` 3, root 4) | **92** | **92 reviewed.** 4 specification files partial (header/status block + targeted numeric and API claims rather than line-by-line) — named in `evidence/review-ops-entry.md`. |
| Frozen-body (`research` 106, `superpowers` 22) | 128 | Status lines and links only, per the tier rule. Both index tables verified: all 11 plans carry a `**Status:**` line, all 10 research directories are listed. |
| Archive (`audits` 1,726, `historical` 326) | 2,052 | Inventoried as historical context; never edited, not link-checked. |
| Policy documents | 24 | All present; parity PASS. |

## Gates

| Gate | Result |
|---|---|
| `pnpm docs:check-versions` | **exit 0** — 34 version claims across `README.md` + `docs/versions.md` match `package.json` |
| `pnpm docs:check-links` | **exit 0** — 914 relative links across 241 documents resolve |
| `manual-check.mjs` (branch and `origin/main`) | **exit 0** both — 17/17 commands covered, every locale inside Discord's limits, no missing key |
| `policy-locale-parity.py` | **exit 0 — PASS, 0 problem groups** across all 24 files |
| `american-spelling.mjs` | **exit 1** — 421 candidates, 4 rejected, **417 confirmed** across 56 documents |

## Catalog

| ID | Title | Sev | Deploy unit |
|---|---|---|---|
| DOC-007 | api-contracts.md omits the live `POST /auth/revoke` | MEDIUM | oauth |
| DOC-008 | contributing.md's `lint:fix` exists in only 2 of 17 workspaces | MEDIUM | repo-wide |
| DOC-010 | bot FAQ says autocomplete needs 2 characters; it fires on 1 | MEDIUM | discord-worker |
| DOC-011 | commands.md calls all 20 `/budget quick` dyes Cosmic Exploration; 4 are Cosmic Fortunes | MEDIUM | discord-worker |
| DOC-013 | components.md's tool-rail order puts Mixer last; it is 6th | MEDIUM | web-app |
| DOC-014 | components.md quotes "Colour wheel"; the shipped label is "Color wheel" | MEDIUM | web-app |
| DOC-015 | 23 docs call the tool "Community Presets"; the app titles it "Preset Palettes" | MEDIUM | web-app |
| DOC-016 | oauth setup omits `XIVAUTH_CLIENT_SECRET` | MEDIUM | oauth |
| DOC-018 | the moderation runbook never mentions banning an XIVAuth-only author | MEDIUM | moderation-worker |
| DOC-019 | OPEN_ITEMS.md lists cross-identity bans as unshipped; they shipped 2026-09-16 | MEDIUM | repo-wide |
| DOC-020 | the glossary defines "Special Dye" by an acquisition tier the schema lacks | MEDIUM | repo-wide |
| DOC-021 | the multi-color-extraction spec's `PaletteService` signatures no longer compile | MEDIUM | core |
| DOC-001 | web-app docs — 228 British spellings across 14 documents | LOW | web-app |
| DOC-002 | discord-bot docs — 44 across 8 documents | LOW | discord-worker |
| DOC-003 | worker and package docs — 41 across 13 documents | LOW | repo-wide |
| DOC-004 | architecture and developer guides — 27 across 7 documents | LOW | repo-wide |
| DOC-005 | entry, reference, operations, specifications — 63 across 12 documents | LOW | repo-wide |
| DOC-006 | the two web-app policy documents — 14 | LOW | web-app |
| DOC-009 | dependency-graph.md omits `@cloudflare/workers-types` from 3 runtime rows | LOW | repo-wide |
| DOC-012 | two web-app docs say 1,152 locale keys; it is 1,129 | LOW | web-app |
| DOC-017 | moderation-worker's file tree omits `types/modal.ts` | LOW | moderation-worker |
| DOC-022 | glossary says "Marketboard"; the terminology file fixes "Market Board" | LOW | repo-wide |

## Positive controls — verified correct, do not re-chase

- **`DEPLOY_ENVIRONMENTS.md` is fully accurate** against all 7 `apps/*/wrangler.toml`, including the two
  traps: oauth's inversion (no `[env.production]`, so a bare `deploy` **is** production) and og-worker's
  bare `deploy` hitting the routed live beta. This was the highest-risk document in scope and it holds.
- **`/manual` is consistent end to end**: 17/17 commands covered, and the three topic rosters agree —
  `schemas.ts` choices (6) = `TOPIC_KEYS` (5) + the `match_image` branch = core `MANUAL_TOPICS` (6).
- **The policy documents are in full parity** across 24 files, and the web-app About modal links the
  viewer's locale variant with an English fallback (`about-modal.ts:90` `policyDocFile()`).
- **`ffxiv-terminology.md`'s locale-derived tables match `core`'s shipped data key for key** (races 8,
  clans 16, harmony types 10, vision types 5, color wheels 5, Facewear 11, categories 9, acquisitions 7).
- **`universalis-proxy/overview.md` correctly documents a retired unit** as merged into api-worker —
  the audit went looking for a stale live-unit doc and did not find one.
- **The specifications self-annotate** shipped-vs-proposed ("As shipped:", "Not shipped.") rather than
  going stale silently — DOC-021 is the one place that lapsed.
- **The two discord-worker policy documents are already American English**, as is `og-strings.ts`.

## Rejected suspicions

| Suspicion | Why dropped |
|---|---|
| 8 registered commands absent from the `/manual` overview | **Stale `origin/main`.** The clone's ref was 159 commits behind (`fb8c10e`, 2026-09-07). After `git fetch origin main`, none absent. |
| `/limbal`, `/gender`, `/shiny`, `/exact` named in `/manual` but unregistered | The slash inside ordinary prose — "tattoo/limbal ring", "clan/gender", "metallic/shiny", "precise/exact". A loose regex; it also invented `tring` from a `string` literal. |
| `ffxiv-terminology.md:116` "Grey" | The dictionary's own Facewear row. The FFXIV glossary wins — that is the game's spelling. |
| `ffxiv-terminology.md:183` "Analogue", `:231` "centre" | The **French** cells of the `analogous` and Data Center rows, not English prose. |
| `api-contracts.md:436` "colours" | Quotes a live DB seed value verbatim (`apps/presets-api/schema.sql:24`). Correcting it would make the document misquote the database. |
| `tools.md:31` "**Colour wheels.**" | A generic heading, not a quoted control label — ordinary British spelling, so it belongs to DOC-001, not to DOC-014. |
| `research/` files mostly lack a `Status:` line (6 of 106) | Not the convention: `research/index.md` tracks outcome per directory; only `superpowers/plans/` carries per-file status, and all 11 do. |
| The bot's `/about` does not link its policies | Real, but **not a documentation defect** — no living document claims it does. Recorded as an observation in `evidence/policy-review.md`; reachability is a product question. |

## Release drift and verification gaps

- **Drift:** none that is a defect. image-worker / oauth / presets-api serve `0fec18f` rather than
  `59572c0` purely because their deploy workflows are path-filtered.
- **Gap — served revision is inferred, not observed.** Every app's served revision comes from the
  `headSha` of its last successful deploy run, not from fetching a live asset and reading a version
  stamp. A deploy that succeeded but did not take effect would look identical.
- **Gap — 4 specification files reviewed partially** (named in `evidence/review-ops-entry.md`).
- **Gap — the archive tier was inventoried, not read.** 2,052 files, by the tier rule.

## Recommendations

1. **Gate the spelling.** `american-spelling.mjs` exits non-zero and takes seconds; adding it beside
   `docs:check-links` in CI would stop DOC-001…006 from ever recurring. It needs the four documented
   rejections carried as an allow-list first, or it will fail on the dictionary's own `Grey` row.
2. **Drop the locale key count from prose** (DOC-012). It goes stale on every key change and the parity
   gate already asserts the six files agree.
3. **Decide the presets tool's name once** (DOC-015) and make `apps/web-app/CLAUDE.md`'s Title column
   match `tools.presets.title`, whichever way it goes.
4. **Four corrections were made to the `documentation-audit` skill itself**, because this run proved them
   wrong: the `I18N-010` citation described a finding that closed 2026-09-20; the policy step assumed the
   bot's `/about` links a policy; "one `DOC-` per document" collides with conventions §3's three-bullet
   Location cap at 56 documents (hence the per-cluster filing here); and `--ref origin/main` now carries
   a **`git fetch` first** instruction, without which this audit would have filed a false HIGH.

## Next steps

No `REMEDIATION_PLAN.md` — scheduling was not requested. Run `remediation-planner` with this folder to
get one. The cheapest first pass is DOC-012, DOC-017, DOC-022 and the six spelling findings, which are
mechanical; DOC-015 needs a maintainer decision before either side moves.
