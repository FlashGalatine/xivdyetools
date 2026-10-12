# Documentation audit — whole repo (2026-10-11)

- **Branch/commit:** `claude/documentation-audit-787779` @ `42c35e87` (= `origin/main` after `git fetch`), clean
  except this audit's own output · **Served baseline:** every production app serves `16a6123f` (2026-10-09), which
  differs from HEAD only in the root `CHANGELOG-laymans.md`, which no app bundles; all 7 npm packages match their
  local versions
- **Scope:** all 93 living documents, both frozen-body tiers (148 files), the bot's `/manual` in six languages, and
  the 4 policy documents × 6 languages (24 files)
- **Method:** 2 documentation gates + `manual-check.mjs` (served ref and `origin/main`) + `policy-locale-parity.py` +
  `american-spelling.mjs` (default and `--all`); 26 delegated review lenses (13 living-doc clusters, the frozen tier,
  `/manual`, 6 policy reviews, 2 by-time sweeps over every commit since the last audit, 1 cross-document fact sweep,
  2 mechanical sweeps over commands, paths, env vars, routes and imports) → an Opus verifier on every candidate → a
  second, independent skeptic on every MEDIUM-or-higher → a re-verification of every merged finding at exact
  `file:line` before filing (`evidence/verify-merged-result.json`)
- **Totals:** **79 findings** — 0 HIGH · 30 MEDIUM · 49 LOW (6 of them spelling, one per cluster) · **Act now:** none
  is HIGH, so nothing needs out-of-band action; DOC-001 should be the first correction merged
- **No source file and no existing document was modified by this audit.**

## Baseline and coverage

`evidence/baseline.md` holds the served-revision table and `evidence/baseline-live.txt` the live probes.

| Unit | Production | Evidence | Local |
|---|---|---|---|
| web-app, discord-worker, api-worker, presets-api, moderation-worker, oauth, og-worker, image-worker | `16a6123f` | `headSha` of each `deploy-<app>.yml`'s last successful `main` run (2026-10-09T14:07Z); discord-worker corroborated by `wrangler deployments list --env production` (version created 14:08:57Z, 100 % rollout); health endpoints of discord-worker, presets-api, moderation-worker live; data., developers., og. and the web app answer | same as HEAD |
| 7 published packages | npm `latest` = local | `npm view` 2026-10-11 (types 3.3.0, logger 2.3.0, auth 2.0.2, worker-kit 1.5.0, core 5.10.0, svg 4.4.0, bot-logic 4.8.3) | parity |
| test-utils (private), stoat-worker (parked) | — | source only | — |

| Tier | Files | Result |
|---|---|---|
| Living (`architecture` 7, `projects` 31, `developer-guides` 10, `user-guides` 19, `operations` 9, `maintainer` 3, `specifications` 7, `reference` 3, root 4) | **93** | **93 fully reviewed** — no partial file this time (the 2026-09-21 run had 4). Union of the cluster file lists = the living inventory (`evidence/scripts/clusters.mjs`, exit 0). Per-file rows: `evidence/coverage.md`. |
| Frozen-body (`research` 122, `superpowers` 26) | 148 | Status lines, index tables and anchored links only, per the tier rule. One plan partial (`2026-09-15-sprint-0-webhook-bytes.md`: its "acceptance pending" clause cannot be checked from source). |
| Archive (`audits` 2,512, `historical` 326) | 2,838 | Inventoried as historical context; never edited, not read. |
| Policy documents | 24 | Mechanical parity PASS; all 20 translations read section by section against English (one reviewer per language). |
| Untracked documents | 0 | `evidence/inventory-untracked.txt` is empty. |

## Gates

| Gate | Result |
|---|---|
| `pnpm docs:check-versions` | **exit 0** — 34 version claims across `README.md` + `docs/versions.md` match `package.json` |
| `pnpm docs:check-links` | **exit 0** — 997 relative links across 256 documents resolve. It validates neither `#anchors` nor the 20 localized policy variants; the reviewers checked both by hand |
| `manual-check.mjs --ref 16a6123f` and `--ref origin/main` | **exit 0** both — 18/18 registered commands named in the overview, every locale inside Discord's limits, no missing key |
| `policy-locale-parity.py` | **exit 0 — PASS, 0 problem groups** across 24 files |
| `american-spelling.mjs` | **exit 1** — 438 candidates in 56 files (+24 code-zone extras with `--all`); **473 confirmed** after triage and 17 dictionary misses found by hand, 8 rejected (`evidence/spelling-confirmed.md`) |

## Catalog

| ID | Title | Sev | Deploy unit | Supersedes (2026-09-21) |
|---|---|---|---|---|
| [DOC-001](findings/DOC-001.md) | all 24 policy documents send deletion, appeal and contact requests to an expired Discord invite | MEDIUM | web-app, discord-worker | — |
| [DOC-002](findings/DOC-002.md) | deployment.md says `db:migrate` applies D1 migrations; it only re-runs schema.sql, so numbered migrations never get applied | MEDIUM | repo-wide (presets-api, oauth) | — |
| [DOC-003](findings/DOC-003.md) | the web FAQ and favorites guide give collection export/import steps through a Manage Collections button the app no longer renders | MEDIUM | web-app | — |
| [DOC-004](findings/DOC-004.md) | web-app user guides misstate privacy facts: deletion via public GitHub issues, an incomplete stored-data list, a stale sign-in quote | MEDIUM | web-app | — |
| [DOC-005](findings/DOC-005.md) | the bot FAQ sends deletion requests to public GitHub issues and calls usage statistics anonymous | MEDIUM | discord-worker | — |
| [DOC-006](findings/DOC-006.md) | the Glamour Reader guide says Facewear always starts blank, uses a retired item as its twins example, and omits the retired-family note | MEDIUM | web-app | — |
| [DOC-007](findings/DOC-007.md) | dye-mixer.md's mixing-mode table says RYB Blue + Yellow = Olive and gives mode names the UI does not show | MEDIUM | web-app | — |
| [DOC-008](findings/DOC-008.md) | components.md and tools.md name nine symbols the web app does not have | MEDIUM | web-app | — |
| [DOC-009](findings/DOC-009.md) | the bot guides promise a web-app share link on every reply; only five commands carry one | MEDIUM | discord-worker | — |
| [DOC-010](findings/DOC-010.md) | discord-worker's overview and rendering examples call functions that do not exist and omit the required locale | MEDIUM | discord-worker | — |
| [DOC-011](findings/DOC-011.md) | the docs say og-worker renders nine tool cards; it serves ten, and the Glamour Reader route is undocumented | MEDIUM | og-worker | — |
| [DOC-012](findings/DOC-012.md) | api-worker's bindings documentation omits three rate-limiter bindings, their KV prefixes and the /v1/chara/resolve service-binding caller | MEDIUM | api-worker | — |
| [DOC-013](findings/DOC-013.md) | presets-api's moderation docs say a missing PERSPECTIVE_API_KEY lets the word list decide alone; every submission is queued instead | MEDIUM | presets-api | — |
| [DOC-014](findings/DOC-014.md) | api-contracts.md's OAuth section omits the live `POST /auth/revoke` and the three XIVAuth routes | MEDIUM | oauth | DOC-007 |
| [DOC-015](findings/DOC-015.md) | security-trade-offs.md credits the KV rate limiter with conflict detection, backoff and read-after-write checks that were removed | MEDIUM | worker-kit | — |
| [DOC-016](findings/DOC-016.md) | eight code examples import type-only names with a plain `import`, a compile error under verbatimModuleSyntax | MEDIUM | repo-wide (types, core docs) | — |
| [DOC-017](findings/DOC-017.md) | algorithms.md gives `classifyBandTier` the wrong parameter order | MEDIUM | core | — |
| [DOC-018](findings/DOC-018.md) | deployment.md's Convention A lists og-worker as a routeless -dev worker; its bare deploy is the live routed beta | MEDIUM | repo-wide | — |
| [DOC-019](findings/DOC-019.md) | versions.md says production 'always' needs the :production script; oauth's bare deploy is production | MEDIUM | repo-wide | — |
| [DOC-020](findings/DOC-020.md) | contributing.md tells contributors to run `lint:fix`, which 15 of 17 workspaces do not define | MEDIUM | repo-wide | DOC-008 |
| [DOC-021](findings/DOC-021.md) | local-setup.md's single-test example points at a path that matches no test file | MEDIUM | repo-wide | — |
| [DOC-022](findings/DOC-022.md) | the moderation runbook describes a web review queue that does not exist and the wrong ban/unban option syntax | MEDIUM | moderation-worker | DOC-018 |
| [DOC-023](findings/DOC-023.md) | the moderation runbook misstates what a ban shows and keeps | MEDIUM | moderation-worker | — |
| [DOC-024](findings/DOC-024.md) | the glossary still defines 'Special Dye' by acquisition sources the schema does not have | MEDIUM | repo-wide | DOC-020 |
| [DOC-025](findings/DOC-025.md) | the superpowers and research indexes still list shipped Glamour work as in progress or proposed | MEDIUM | repo-wide | — |
| [DOC-026](findings/DOC-026.md) | the community-presets spec's API section gives a dead base URL, wrong vote/moderation paths, a wrong page-size cap and an incomplete route list | MEDIUM | presets-api | — |
| [DOC-027](findings/DOC-027.md) | the community-presets spec describes bot-only Bearer auth and a three-secret list; production uses HMAC v2 + nonce and web JWTs | MEDIUM | presets-api | — |
| [DOC-028](findings/DOC-028.md) | the community-presets spec presents a multi-language filter with language detection as shipped moderation | MEDIUM | presets-api | — |
| [DOC-029](findings/DOC-029.md) | the multi-color-extraction spec still shows PaletteService signatures that do not compile and a `/match_image` bot section | MEDIUM | core | DOC-021 |
| [DOC-030](findings/DOC-030.md) | feature-roadmap.md says the F and C dye-card shortcuts never shipped; both work | MEDIUM | web-app | — |
| [DOC-031](findings/DOC-031.md) | web-app docs quote UI labels and strings the app no longer shows | LOW | web-app | DOC-014 |
| [DOC-032](findings/DOC-032.md) | web-app docs leave the Glamour Reader out of tool lists and tables | LOW | web-app | — |
| [DOC-033](findings/DOC-033.md) | web-app developer docs carry stale figures: the bundle limit, the locale key count, a removed CSS rule and the deploy path filter | LOW | web-app | DOC-012 |
| [DOC-034](findings/DOC-034.md) | five tool guides list seven Dye Filters toggles; the panel has nine | LOW | web-app | — |
| [DOC-035](findings/DOC-035.md) | the web-app docs never mention the About modal's Policies row, the only in-app route to the policies | LOW | web-app | — |
| [DOC-036](findings/DOC-036.md) | bot user guides: autocomplete needs 2 characters, the rate-limit table omits /glamour, /preset submit always goes to moderation | LOW | discord-worker | DOC-010 |
| [DOC-037](findings/DOC-037.md) | discord-worker project docs: /budget quick picks, unread clan/gender prefs, ENVIRONMENT readers, autocomplete source and a stale bundle size | LOW | discord-worker | DOC-011 |
| [DOC-038](findings/DOC-038.md) | discord-worker docs omit GET /health, the dye-emoji system, the /glamour card, releases after 5.0 and the bundle-size gate | LOW | discord-worker | — |
| [DOC-039](findings/DOC-039.md) | api-worker endpoints.md: incomplete .chara response shape, wrong upstream-status rule, stale tool name, undocumented strict parsing | LOW | api-worker | — |
| [DOC-040](findings/DOC-040.md) | presets-api docs omit migration 0015, the daily retention cron and two moderation actions, and say the policies 'will publish' retention | LOW | presets-api | — |
| [DOC-041](findings/DOC-041.md) | moderation-worker overview: file tree misses types/modal.ts, Quick Start sets dev-only secrets, and it credits discord-worker with removed storage | LOW | moderation-worker | DOC-017 |
| [DOC-042](findings/DOC-042.md) | architecture docs show every duplicate preset as 409 and omit the preview-upload 429 | LOW | presets-api | — |
| [DOC-043](findings/DOC-043.md) | oauth overview's setup blocks omit XIVAUTH_CLIENT_SECRET and end with `npm run deploy` from the root | LOW | oauth | DOC-016 |
| [DOC-044](findings/DOC-044.md) | oauth error, rate-limit and parameter tables are incomplete | LOW | oauth | — |
| [DOC-045](findings/DOC-045.md) | the oauth project docs never describe the users database or its hand-run migration (only apps/oauth/CLAUDE.md does) | LOW | oauth | — |
| [DOC-046](findings/DOC-046.md) | og-worker overview misdescribes its analytics datapoints and omits /health, / and the crawler 404 | LOW | og-worker | — |
| [DOC-047](findings/DOC-047.md) | core service docs: getCategories order, cache count, Brettel steps and getLabel's return type are wrong | LOW | core | — |
| [DOC-048](findings/DOC-048.md) | core and types API references omit published exports | LOW | core, types | — |
| [DOC-049](findings/DOC-049.md) | dependency-graph.md omits @cloudflare/workers-types from three runtime rows and pins stale hono/vite ranges | LOW | repo-wide | DOC-009 |
| [DOC-050](findings/DOC-050.md) | two architecture docs say presets-api calls oauth to verify JWTs; it verifies locally | LOW | presets-api | — |
| [DOC-051](findings/DOC-051.md) | two overview diagrams call the web app a PWA; it has a manifest but no service worker | LOW | web-app | — |
| [DOC-052](findings/DOC-052.md) | env-var docs miss ENVIRONMENT's second gate and the 32-character webhook secret; SECRET_ROTATION calls it an HMAC key | LOW | repo-wide | — |
| [DOC-053](findings/DOC-053.md) | contributing.md's CI description and PR checklist leave out the repo-wide gates, including workers:check-logs | LOW | repo-wide | — |
| [DOC-054](findings/DOC-054.md) | deployment.md cites the register-commands steps at the wrong workflow lines | LOW | repo-wide | — |
| [DOC-055](findings/DOC-055.md) | testing.md's test-file count and thresholds and the maintainer coverage row are stale | LOW | repo-wide | — |
| [DOC-056](findings/DOC-056.md) | adding-dyes.md's schema sample has the wrong stainID and Step 2 describes the retired color workflow | LOW | core | — |
| [DOC-057](findings/DOC-057.md) | logging-standards.md never says Workers Logs are off, and repeats a heading | LOW | repo-wide | — |
| [DOC-058](findings/DOC-058.md) | OPEN_ITEMS.md still lists cross-identity bans as unfinished and carries other stale lines | LOW | repo-wide | DOC-019 |
| [DOC-059](findings/DOC-059.md) | DEPLOY_ENVIRONMENTS.md says beta deploys fail 'right now', gives the beta bot a D1, and shows a bare `pnpm deploy` | LOW | repo-wide | — |
| [DOC-060](findings/DOC-060.md) | security-remediation-2026-09-15.md reads as a live procedure and stops before migration 0015 | LOW | presets-api | — |
| [DOC-061](findings/DOC-061.md) | SECRET_ROTATION.md's date is stale and it files incidents in a folder that does not exist | LOW | repo-wide | — |
| [DOC-062](findings/DOC-062.md) | DOMAIN_DEPRECATION.md cites stale line numbers, leaves a finished row unstruck and keeps a 'deploys paused' section | LOW | repo-wide | — |
| [DOC-063](findings/DOC-063.md) | versions.md's header says logger and worker-kit await publication, and its compatibility table stops at core 5.7.0 | LOW | repo-wide | — |
| [DOC-064](findings/DOC-064.md) | user-guides/index.md still says the presets tool's app title is 'Preset Palettes' | LOW | web-app | — |
| [DOC-065](findings/DOC-065.md) | ffxiv-terminology.md gives the wrong Japanese name for Metallic Silver | LOW | core | — |
| [DOC-066](findings/DOC-066.md) | glossary.md lists jobs it does not cover, defines only five of ten tools under a v4 heading, and spells Marketboard | LOW | repo-wide | DOC-022 |
| [DOC-067](findings/DOC-067.md) | index.md's Recent Updates stops at 2026-09-05 and misses the Glamour Reader | LOW | repo-wide | — |
| [DOC-068](findings/DOC-068.md) | community-presets spec: a ticked owner-DM item that was deleted, a stale schema description and unlabelled design-era sections | LOW | presets-api | — |
| [DOC-069](findings/DOC-069.md) | three Implemented specs cite pre-monorepo repo paths without the caveat feature-roadmap.md carries | LOW | repo-wide | — |
| [DOC-070](findings/DOC-070.md) | feature-roadmap.md lists extractor pieces that do not exist | LOW | web-app | — |
| [DOC-071](findings/DOC-071.md) | collections.md describes an instance API, a name character rule, a rename suffix and a shortcut that the code does not have | LOW | web-app | — |
| [DOC-072](findings/DOC-072.md) | preset-palettes.md's type, service and file sections describe the design, not the shipped shapes | LOW | core | — |
| [DOC-073](findings/DOC-073.md) | localized policy variants cross-link the English sibling policies, except one Korean link that points at its locale | LOW | web-app, discord-worker | — |
| [DOC-074](findings/DOC-074.md) | web-app docs are British English — 229 spellings across 14 documents | LOW | web-app | DOC-001 |
| [DOC-075](findings/DOC-075.md) | discord-bot docs are British English — 48 spellings across 8 documents | LOW | discord-worker | DOC-002 |
| [DOC-076](findings/DOC-076.md) | worker and package docs are British English — 52 spellings across 15 documents | LOW | repo-wide (api-worker, presets-api, moderation-worker, oauth, og-worker, core, types, logger) | DOC-003 |
| [DOC-077](findings/DOC-077.md) | architecture, developer and maintainer guides are British English — 44 spellings across 11 documents | LOW | repo-wide | DOC-004 |
| [DOC-078](findings/DOC-078.md) | entry, reference, operations and specification docs are British English — 83 spellings across 12 documents | LOW | repo-wide | DOC-005 |
| [DOC-079](findings/DOC-079.md) | the two English web-app policy documents are British English — 17 spellings | LOW | web-app | DOC-006 |

## The 2026-09-21 findings

Twenty of the previous audit's 22 findings are still present and carried forward under new IDs (the `Supersedes`
column above). Two are fixed:

| 2026-09-21 | Now |
|---|---|
| DOC-013 (tool-rail order) | **FIXED** — `components.md:46` matches `TOOL_MENU` in `v4-app-header.ts:54-65` |
| DOC-015 (Community Presets name) | **FIXED** 2026-09-21 (web-app 5.12.4); one leftover note filed as DOC-064 |
| DOC-001…006 (spelling) | Still present, 417 → 473: nothing gates it (see Recommendations) |
| DOC-019 (OPEN_ITEMS cross-identity bans) | Partly fixed — the presets-api half is credited, the shipped moderation-worker half is still "follows in Sprint 4" (DOC-058) |
| the other 13 | Unchanged at HEAD; each new finding names its predecessor |

## Positive controls — verified correct, do not re-chase

- **`/manual` is consistent end to end:** 18/18 commands including `/glamour`; the schema's 6 topic choices =
  `TOPIC_KEYS` (5) + the `match_image` branch = core `MANUAL_TOPICS` (6); every locale inside Discord's limits; the en
  `/manual` strings are already American English (0 candidates). The two `/manual`-adjacent defects found live in
  `docs/` (DOC-036, DOC-037), not in the bot.
- **The policy amendments of 2026-10-04/05 reached every language intact.** Six reviewers read all 20 translations
  against English and found **no** softened, dropped or added privacy claim — every translation issue is register or
  terminology (handed to i18n-manager). Parity PASS; the About modal links the viewer's locale with an English
  fallback (`about-modal.ts` `policyDocFile()`).
- **Every app is serving `main`**, and for the first time one served revision is corroborated by a live deployment
  record rather than inferred (discord-worker, `wrangler deployments list`).
- **`DEPLOY_ENVIRONMENTS.md` still gets the two dangerous traps right** — oauth's inversion and og-worker's routed beta.
  Only peripheral lines are stale (DOC-059).
- **The `MODERATION.md` prerequisites and secrets section** matches `env.ts` and `wrangler.toml` (seven secrets,
  `--env production`).
- **The version tables** (`README.md`, `docs/versions.md`) match all 17 `package.json` files; the only stale text in
  `versions.md` is header prose and the compatibility table (DOC-063).
- **All 93 living documents were read in full**, and the coverage union check passed before any review started.
- Seeds checked and right: `docs/CLAUDE.md:32` "17 Active Projects"; `projects/web-app/overview.md:121` "nine of the
  ten tools" (the nine imperative ones); `docs/index.md:260,301` "nine tools" (dated history rows).

## Rejected suspicions

| Suspicion | Why dropped |
|---|---|
| `/manual` `/glamour` line ("each dyed piece … the full list") overstates the card | The embed's GPOSERS list names every piece; the five-row card cap is a detail a one-line summary may omit. |
| zh `服务器` for an FFXIV World in `PRIVACY.zh.md:38,80` | `docs/reference/ffxiv-terminology.md:288` makes 服务器 the official ZH term and the web UI uses it (`所有服务器`). The Korean equivalent at `PRIVACY.ko.md:80` *was* handed off, because there 서버 also names the Discord server two lines away. |
| `budget-aware-suggestions.md` "existing APIs" `findClosestDyes`, `PriceService` + `RedisCacheBackend`, 10-minute TTL; `feature-roadmap.md:143` | **Split verdict, coordinator decided.** Two verifiers confirmed, one rejected. Rejected: the body sits under a banner dated "Design last updated: December 5, 2025" that already says the optional core enhancement was never built and points to the as-shipped summary; the roadmap row is a record of the deleted `/match` era. Unlike the specs filed here, it makes no false "as shipped" claim. |
| og-worker / moderation-worker / image-worker `GET /health` undocumented | The three app READMEs (living tier) list it. The og-worker overview's full route table still lacks it, so that part stays in DOC-046. |
| `commands.md` "20 Cosmic Exploration dyes" matches the section comments | Overruled: `quick-picks.ts` holds 16 Cosmic Exploration and 4 Cosmic Fortunes dyes (DOC-037). |
| French variants cross-linking the English policies is a "house choice" | Filed as DOC-073 for a maintainer decision instead: the Korean variant already breaks the pattern once. `policy-documents.md` governs linking *surfaces*, not links inside the documents. |
| Welcome modal lists nine tools; presets-api / moderation-worker still say "Preset Palettes" | App behavior, not documentation — recorded in `evidence/handoffs.md`. |
| Standing rejections re-confirmed | `ffxiv-terminology.md` Grey row and French cells; schema-seed quotes at `api-contracts.md:444` and `community-presets.md:104`; `collections.md:451` CANCELLED (an accepted US spelling); og-worker `overview.md:218` Slate/Ash Grey (dye names). |

## Hand-offs

`evidence/handoffs.md` lists them with locations. **security-audit (2):** the bot's first-run flag is written for every
user, not only those shown the notice (`PRIVACY_POLICY.md:30` vs `index.ts:881`); the web Privacy Guide's "Manage
Collections → Delete Collection" route is unreachable (same root as DOC-003). **i18n-manager (18):** register,
terminology and typography in the ja/de/fr/ko/zh policies and the de/fr `/manual` decimal separator. **web-app owner
(5):** the orphaned collection manager, a live meta description naming retired tools, the nine-tool Welcome modal, a
stale og-worker comment, and "Preset Palettes" still emitted by two workers.

## Release drift and verification gaps

- **Drift:** none that is a defect. HEAD is one commit ahead of production and that commit is the root player
  changelog, which no app bundles. npm and local agree for every package. The one doc that describes a release state
  that has since changed is the `versions.md` header (DOC-063).
- **Gap — served revisions other than discord-worker's are inferred** from the deploy run's `headSha`; none of the
  other workers exposes a version stamp.
- **Gap — whether presets-api migration 0015 was applied to production** cannot be told from the repository (DOC-060
  asks for an OPEN_ITEMS line to confirm it).
- **Gap — the archive tier** (2,838 files) was inventoried, not read; one frozen-tier plan is partial (above).
- **Severity split — DOC-002.** The first verifier graded the `db:migrate` advice HIGH, the independent skeptic
  MEDIUM; the coordinator kept MEDIUM. Running `db:migrate` itself is harmless (`CREATE … IF NOT EXISTS`); the harm
  is the omission — a migration never applied — and the real procedure is already stated in `docs/operations/index.md`,
  `apps/presets-api/CLAUDE.md` and `README.md`, so an operator has a second chance to find it. A planner may
  reasonably treat it as the first operational fix.
- **Gap — external figures** in `security-trade-offs.md` (CVE/CVSS scores, Durable Object costs) were not checked.
- **Process note:** the first verification pass accepted 12 cited line numbers that lie past the end of their files.
  Every merged finding was therefore re-verified at exact lines before filing; all 73 held, 11 narrowed.

## Prioritized corrections

1. **DOC-001, DOC-004, DOC-005** — the privacy routes users are told to follow: an expired Discord invite in all 24
   policy files, and two FAQs that send deletion requests to the public GitHub issues the policy forbids. DOC-001 is a
   content change to the policies (bump all six dates per document).
2. **DOC-002, DOC-018, DOC-019** — operational instructions that would misfire: migrations that never apply, and two
   statements of which deploy is safe that are wrong for og-worker and oauth.
3. **DOC-003, DOC-006, DOC-007, DOC-009** — user guides describing behavior the app or bot does not have.
4. **DOC-013, DOC-014, DOC-015, DOC-022, DOC-023** — operator and security references (moderation, auth contract,
   rate-limit trade-offs).
5. **DOC-008, DOC-010, DOC-011, DOC-012, DOC-016, DOC-017, DOC-020, DOC-021, DOC-024** — developer references whose
   examples do not compile or name things that do not exist.
6. **DOC-025…030** — frozen-tier status lines and the Implemented specs.
7. The LOW findings, cheapest first: DOC-054, DOC-061, DOC-062, DOC-064, DOC-065 are one-line edits.
8. **DOC-074…079** — spelling, mechanical with the sweep's `--fix`, each in its own commit; DOC-079 must not bump
   the policy dates.

## Recommendations

1. **Gate the spelling.** The backlog grew from 417 to 473 because nothing stops it. Run `american-spelling.mjs`
   beside `docs:check-links` in CI with the standing rejections as an allow-list, and add the 17 hand-found misses
   (`evidence/spelling-confirmed.md`) to its dictionary first.
2. **Extend `docs:check-links`** to `#anchors` and to the 20 localized policy variants, which it skips today.
3. **Type-check documentation code blocks** that import `@xivdyetools/*` (extract the `ts` fences, `tsc --noEmit`
   against the workspace). DOC-010, 016, 017 and 029 are all examples that would fail to compile.
4. **Stop quoting volatile numbers and line numbers** — bundle sizes, locale-key and test-file counts, dependency
   ranges, `file:line` references into workflows and configs. DOC-033, 037, 049, 054, 055 and 062 are all this.
5. **When a tool or command is added, grep the docs for the old count** ("nine", "9 tools", "17 commands"). The
   Glamour Reader produced DOC-011, DOC-032 and parts of DOC-038 and DOC-066.
6. **Keep one source for the support invite.** Every surface except the policies reads
   `packages/core/src/config/product-links.ts`; the policies hard-coded a different invite, and it expired.
7. **Update `docs/superpowers/README.md` statuses in the merging PR** (its own rule at :30), which DOC-025 shows lapsed.
8. **The `documentation-audit` skill** should make a merged-finding re-verification at exact `file:line` a standard
   step: reviewer line numbers were unreliable in this run even after a first verifier pass. (Suggested, not applied —
   the skill was not changed by this audit.)

## Remediation status

| ID | Status | Commit |
|---|---|---|
| Sprint 1 | FIXED: DOC-079, DOC-001, DOC-073 — PR [#287](https://github.com/FlashGalatine/xivdyetools/pull/287) | `d6eb816d` `133c677f` |
| Sprint 2 | FIXED: DOC-004, DOC-005 — PR [#288](https://github.com/FlashGalatine/xivdyetools/pull/288) | `67591833` `39b50bdc` |
| Sprint 3 | FIXED: DOC-002, DOC-018, DOC-020, DOC-021, DOC-052, DOC-053, DOC-054, DOC-055, DOC-056, DOC-057; PARTIAL: DOC-019 — PR [#289](https://github.com/FlashGalatine/xivdyetools/pull/289) | `0cbbd858` `0e63a056` `01dc7cd5` `a9dfd9d3` `6a5db29e` `c2c56672` `d3df795e` `15ed5315` `a0ef4b80` `3af15721` `a4e04bb2` |
| Sprint 4 | FIXED: DOC-022, DOC-023, DOC-058, DOC-059, DOC-060, DOC-061, DOC-062 — PR [#290](https://github.com/FlashGalatine/xivdyetools/pull/290) | `2fa2a691` `6eb0f153` `16a6e769` `73618156` `7ea6ca86` `76ccefda` `aeaf56fb` |
| Sprint 5 | PARTIAL: DOC-003; FIXED: DOC-006, DOC-007, DOC-008, DOC-031, DOC-032, DOC-033, DOC-034, DOC-035, DOC-064, DOC-074 — PR [#291](https://github.com/FlashGalatine/xivdyetools/pull/291) | `a3b7401a` `bffe3f45` `1466c3ab` `66280ba2` `194842ee` `485475e4` `d8c2015f` `b0531dce` `53296079` `9d51743e` `a1c4a125` |
| remaining 45 | OPEN | — |

## Next steps

[`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) schedules all 79 findings: a decisions-first Sprint 0, then 13 sprints.
The only sprint whose merge deploys is Sprint 1 (the policy documents, which live under `apps/*/`); every other
sprint is `docs/`-only. The hand-offs in `evidence/handoffs.md` stay with security-audit and i18n-manager; Sprint 0
says where two of them must land.
