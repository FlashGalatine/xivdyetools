# Review: cross-doc facts (by-entity sweep), 2026-10-11

Key `cross-doc-facts`. Baseline: HEAD 42c35e87 == served 16a6123f for all app code. Scope: the 93 living docs in `living-files.txt`
(plus the root `CLAUDE.md`, noted where it carries a fact). Method: for each fact, `git grep` every living-doc mention, then read the
truth from source (HEAD). Overlaps with other reviewers are marked "also filed" so the coordinator can merge.

## Coverage (one row per fact; file = fact name)

| fact | tier | units | sections reviewed | result |
|---|---|---|---|---|
| web-app tool count / names / order | living | web-app router-service.ts ROUTES, v4-app-header.ts TOOL_MENU, en.json tools.* | 20 mentions in overview, index, projects/index, user-guides, components, tools | reviewed (ROUTES order and rail order differ on purpose; each doc matches the one it describes) |
| og-worker tool-card count | living | og-worker index.ts SUPPORTED_TOOLS, wrangler routes | architecture/overview, projects/og-worker/overview, index.md | reviewed, 1 candidate |
| registered bot command count / names | living | discord-worker commands/registry.ts, schemas.ts | 14 mentions + command-reference, commands.md headings, favorites-collections | reviewed (18 registrations, 17 distinct, all match) |
| dye 125 / Facewear 11 / consolidated IDs | living | dyes.json (125; A 85, B 9, C 11, null 20), facewear_colors.json (11), consolidated-ids.ts | ~40 mentions | reviewed (all agree; 136 only in a schema-v2 history sentence) |
| locale count 6 | living | locale files, wrangler/CLAUDE | 20 mentions | reviewed |
| package 8 / app 9 / 17 | living | package.json files, pnpm-workspace.yaml, dependency graph | docs/CLAUDE.md, index, architecture/index, dependency-graph | reviewed |
| harmony types 10 / vision 5 / themes 2 / matching methods 6 | living | core HARMONY_OFFSETS, bot-logic HARMONY_TYPES, web-app HARMONY_TYPE_IDS, VisionType, ThemeName | 25 mentions | reviewed |
| toolchain versions | living | root package.json, workspace package.json files, pnpm-workspace.yaml | contributing, monorepo-setup, testing, local-setup, dependency-graph | reviewed, 2 candidates |
| public hostnames | living | wrangler.toml routes (all 7 workers) | ~200 host mentions | reviewed, 1 candidate (also filed) |
| service/D1/KV/R2 binding names | living | wrangler.toml, service-bindings.md, environment-variables.md | service-bindings, env-vars, overview, per-project docs | reviewed (all match; namespace_ids match the env-vars table) |
| cron schedules | living | presets-api wrangler `crons = ["23 4 * * *"]` | moderation.md, ci notes | reviewed |
| rate-limit numbers | living | wrangler [[ratelimits]], worker-kit configs.ts, rate-limiter.ts, rate-limit-service.ts | commands.md, FAQs, public-api, oauth/presets/api-worker/moderation docs | reviewed, 1 candidate |
| cache TTLs | living | api-worker universalis/config/cache.ts, routes, og renderer, presets categories | data-flow, api-contracts, og overview, specs | reviewed, 1 candidate |
| wrangler version | living | apps/*/package.json (^4.140.0) | local-setup.md:17 | reviewed (no living doc states a version; says devDependency only) |
| JWT / state / nonce lifetimes | living | oauth wrangler JWT_EXPIRY=3600, constants STATE_EXPIRY_SECONDS=600, auth revocation.ts, presets auth.ts | oauth docs, service-bindings, presets endpoints | reviewed (all agree) |

## Candidates

### cand-cross-doc-facts-01 (MEDIUM, inaccurate) og-worker serves ten tool cards, docs say nine
- Docs: `docs/architecture/overview.md:329` ("One 15E band frame for all nine tools"), `:337` ("Routes ... budget" ends at nine, no glamour); `docs/projects/og-worker/overview.md:112` (`SUPPORTED_TOOLS` listed as nine, ends `budget`; the route tables have no `/glamour` and no mention of `/og/glamour/default.png`).
- Truth: `SUPPORTED_TOOLS` has ten entries including `glamour` (`apps/og-worker/src/index.ts:100-111`); a `GET /glamour` handler is registered per entry (`:716-719`); both wrangler envs route `xivdyetools.app/glamour/*` and `beta.xivdyetools.app/glamour/*` (`apps/og-worker/wrangler.toml:38,85`); glamour has no share grammar and takes the default card (`index.ts:741`, `:1083-1086`).
- Not wrong (history): `docs/index.md:260`, `:301`, `docs/versions.md:178,427,704` name the count as shipped at the time.
- Fix: say "all ten tools" at overview.md:329 and add glamour to :337; list ten in og-worker/overview.md:112 and add a row `/glamour | no share parameters; every link takes the Glamour Reader default card`.
- Also filed: cand-architecture-01, cand-oauth-og-0x (og overview). Merge.

### cand-cross-doc-facts-02 (LOW, inaccurate) "app title: Preset Palettes"
- Doc: `docs/user-guides/index.md:33`.
- Truth: `apps/web-app/src/locales/en.json:71` `tools.presets.title` = "Community Presets"; no "Preset Palettes" string in web-app src; changed in 5.12.4 (`apps/web-app/CHANGELOG.md:862-867`).
- Fix: `| **Community Presets** | [Guide](web-app/community-presets.md) | Browse community dye palettes |`.
- Also filed: cand-entry-reference-03. Residue of 2026-09-21-documentation/DOC-015 (the app title moved in web-app 5.12.4; this guide row still carries the old title).

### cand-cross-doc-facts-03 (MEDIUM, inaccurate) presets-api "Production" base URL
- Doc: `docs/specifications/community-presets.md:311` (`https://presets-api.xivdyetools.workers.dev`).
- Truth: presets-api sets `workers_dev = false` and production is the custom domain `api.xivdyetools.app` (`apps/presets-api/wrangler.toml:16,74`); `docs/architecture/api-contracts.md:98` states the right base URL.
- Fix: `Production: https://api.xivdyetools.app`.
- Also filed: cand-specs-presets-01.

### cand-cross-doc-facts-04 (LOW, inaccurate) third-party versions in the dependency graph
- Doc: `docs/architecture/dependency-graph.md:196,209,216` (`hono` ^4.13.5), `:189` (`vite` ^8.2.2).
- Truth: all seven workers declare `hono ^4.13.9` (`apps/*/package.json`, e.g. `apps/api-worker/package.json:27`); web-app declares `vite ^8.3.1` (`apps/web-app/package.json`). The other rows in that section match (lit ^3.3.3, tailwindcss ^4.3.3, @resvg/resvg-wasm ^2.6.2, @cf-wasm/photon ^0.4.0, revolt.js ^7.1.1, discord-interactions ^4.4.0).
- Fix: `^4.13.9` in the three hono rows, `^8.3.1` for vite. Prefer dropping the pinned numbers (versions are meant to live in versions.md).

### cand-cross-doc-facts-05 (LOW, inaccurate) root CLAUDE.md names a Hono floor the manifests no longer carry (outside the 93-file living list)
- Doc: `CLAUDE.md:161` ("Hono (`^4.12.34` floor)"). The coordinator's checklist repeats the same floor.
- Truth: every worker declares `^4.13.9` (`apps/*/package.json`), the lockfile resolves 4.13.9 (`pnpm-lock.yaml:2996`), and worker-kit's optional peer is `^4.13.7` (`packages/worker-kit/package.json:75`). `^4.12.34` was the 2026-08-09 floor (changelog history only).
- Fix: "Hono (`^4.13.9`)". Coordinator decides whether this root file is in scope.

### cand-cross-doc-facts-06 (LOW, missing) discord-bot FAQ rate-limit table omits `/glamour`
- Doc: `docs/user-guides/discord-bot/faq.md:122-128` (the 15/min row lists `/extractor color`, `/harmony`, `/mixer`, `/gradient`, `/comparison`, `/contrast`, `/swatch`, `/stats`), after "Every command has a per-user limit ... nothing is unlimited".
- Truth: `/glamour` has no entry in `DISCORD_COMMAND_LIMITS` so it takes the `default` tier, 15/min (`packages/worker-kit/src/rate-limiter/presets/configs.ts:68-102`, `apps/discord-worker/src/services/rate-limiter.ts:189-191`). The same table in `getting-started.md:249` and `commands.md:67` list it.
- Fix: add `` `/glamour` `` to the 15 row.

### cand-cross-doc-facts-07 (LOW, inaccurate) moderation-worker comparison table says the main bot stores "Favorites, collections"
- Doc: `docs/projects/moderation-worker/overview.md:274` (User storage | Favorites, collections | N/A).
- Truth: `/favorites` and `/collection` and their storage were deleted in 5.0; the bot keeps preset favorites and preferences only (`docs/user-guides/discord-bot/favorites-collections.md:5-12`; `apps/discord-worker/src/services/preset-favorites.ts`, `preferences.ts`; `docs/projects/discord-worker/overview.md:97`).
- Fix: "Preset favorites, preferences".

### cand-cross-doc-facts-08 (LOW, inaccurate) discord-worker bundle size
- Doc: `docs/projects/discord-worker/rendering.md:62` ("after the split it sits at ~2,632 KiB (~14 % headroom)").
- Truth: 5.8.9 grew the gzipped Worker by 343.8 KiB to 2,717.2 KiB, 88.5% of the cap, 354.8 KiB left (`apps/discord-worker/CHANGELOG.md:121-122`; `apps/discord-worker/scripts/subset-cjk-fonts.py:47-48`). The 5.8.x line is in the served build.
- Fix: "~2,717 KiB (~11.5 % headroom) since the item-name font re-cut (5.8.9)", or keep the split-time figure labelled as such. `deployment.md:167` and `troubleshooting.md:110` quote 2,589.70 as the split result; accurate as history.

### cand-cross-doc-facts-09 (LOW, inaccurate) test-suite size and coverage facts
- Docs: `docs/developer-guides/testing.md:7` ("~480 test files"), `:6` ("per-package thresholds (typically 80%+)" (true of apps, understated for packages)); `docs/maintainer/index.md:109` ("Test coverage | Core library | Increase from 85% to 90%").
- Truth: `git ls-files` finds 571 test/spec files (555 excluding `apps/web-app/e2e`); all eight packages enforce 90% on lines/functions/branches/statements (`packages/core/vitest.config.ts:23-28`, same in auth, logger, svg, types, worker-kit, test-utils, bot-logic:22-25); apps range 65-90 (discord-worker 87/80/88/88 at `vitest.config.ts:84-87`, web-app 79/65/76/80 at `:78-81`, oauth 90/85/90/90). Core already enforces the 90% the maintainer row calls a goal.
- Fix: "~570 test files"; "90% on every package, 80-90% on apps"; remove or restate the maintainer row.

### cand-cross-doc-facts-10 (LOW, inaccurate) "PWA" label vs the web-app page saying no service worker / no offline
- Docs: `docs/architecture/overview.md:30`, `docs/projects/index.md:41` ("Light + Dark, PWA").
- Truth: the web-app's own page says "Installable, but not offline ... No service worker" (`docs/projects/web-app/overview.md:172-177`); `apps/web-app/public` has `manifest.json` and no service worker, and no PWA plugin is in `apps/web-app/package.json`. "Installable" is accurate; "PWA" is loose, hence LOW.
- Fix: "installable" instead of "PWA".

### cand-cross-doc-facts-11 (LOW, inaccurate) price cache TTL stated as 10 minutes
- Docs: `docs/specifications/budget-aware-suggestions.md:179` ("TTL: 10 minutes (already configured)") and `:195`; `docs/specifications/feature-roadmap.md:143` ("cache layer (10-minute TTL)").
- Truth: the core, api-worker and discord-worker price caches are all 5 minutes (the web-app MarketBoardService keeps an in-memory map with no TTL, `apps/web-app/src/services/market-board-service.ts`): core `API_CACHE_TTL = 5 * 60 * 1000` (`packages/core/src/constants/index.ts:134`), api-worker aggregated `cacheTtl: 300` + `swrWindow: 120` (`apps/api-worker/src/universalis/config/cache.ts:21-22`; `docs/architecture/data-flow.md:294` is right), discord `CACHE_TTL_SECONDS = 300` (`apps/discord-worker/src/services/budget/price-cache.ts:28`). `RedisCacheBackend` at :178 never existed (roadmap :143 already says so).
- Fix: "5 minutes (+2 min stale-while-revalidate)" at 179 and 143; :195 is a design option, say so.

## Positive controls (agree with source)
- Tools: ten, order and titles match `ROUTES` (`router-service.ts:74-84`), `en.json tools.*.title`; keyboard 1-9,0 table (`getting-started.md:182`, `tools.md:218-227`) equals ROUTES order; tool-rail order (`getting-started.md:32`, `user-guides/index.md:24-33`) equals `TOOL_MENU` (`v4-app-header.ts:54-64`).
- Commands: 18 registrations/17 distinct, per-category lists in `architecture/overview.md:222-229`, `commands.md`, `command-reference.md` all equal `registry.ts:29-57`; stoat prefixes and four commands match.
- Dyes: 125 (A 85, B 9, C 11 = 105 consolidated; 20 Venture Coffer null), 11 Facewear, 52254/55/56 = A/B/C (`consolidated-ids.ts:36-38`); 8 categories (9 locale entries incl. Facewear), 4 acquisitions, locale sections 15 (`ffxiv-terminology.md:524`).
- 10 harmony types, 5 vision types, 2 themes, 6 matching methods, 5 color wheels all consistent in every doc.
- Toolchain: Node >=22.13, pnpm 11.17, Turbo ^2.11, TS ^5.9, ESLint ^10, Prettier ^3, knip ^6, Vitest ^5 match `package.json`.
- Hosts: bot., auth., api., data., proxy., developers., moderation-bot., og., og-beta., beta. all match wrangler routes; `shots.` is the R2 bucket custom domain (`apps/presets-api/wrangler.toml:78` comment), not a wrangler route.
- Rate limits: discord tiers 5/10/15/20/30/70, autocomplete 60+10, moderation 20+5 / 60+10 = 25/70, oauth 10/20/30, presets 100/min + 10/20/10/30 daily, api-worker 65 (60+5) / 240 / 1300 / 30 (dev 60) / 600 (dev 1200), service namespace_ids 1001-1056 all match wrangler.
- TTLs: oauth state 600 s, JWT 3600 s, revoked-jti `exp`+15 min, `botnonce:` 120 s, v2 signature 60 s, first-run flag 180 days, categories 60/30, dye routes 3600/86400, og images 86400/604800, og HTML 3600/86400.
- Cron: single `23 4 * * *` in presets-api production; docs say "once a day".
- Bindings: PRESETS_API/UNIVERSALIS_PROXY/IMAGE_WORKER/DISCORD_WORKER/THUMBNAILS/TOKEN_BLACKLIST/KV/DB/RL_* and D1 names `xivdyetools-presets` / `xivdyetools-users(-dev)`, bucket `xivdyetools-presets-preview-thumbnails` match.

## Rejected suspicions
- Tool rail order differs from ROUTES order (Mixer 6th vs 9th): two different arrays; each doc quotes the right one.
- `docs/index.md:260,301`, `versions.md` "nine tools"/"9 tools": history rows naming the count when shipped.
- `docs/architecture/overview.md:174` "136 entries": schema-v2 history sentence.
- Node "22+" (local-setup, monorepo-setup): root engines `>=22.13.0`; coarse but not wrong. Package engines `>=18` (core overview :130 quotes it correctly).
- "Preset Palettes" in `api-contracts.md:270` and `operations/MODERATION.md`: quote the shipped presets-api / moderation-worker strings (`ban-check.ts:71`, `register-commands.ts:83`), which still say Preset Palettes; the string mismatch is code-side.
- `preset-palettes.md:35` "3-5 dyes": inside the sketch the file's own banner says was not built; shipped limit is 3-6.
- `DOMAIN_DEPRECATION.md:37` "5 Workers", `DEPLOY_ENVIRONMENTS.md:191-202` projectgalatine routes: dated inventory / "as they were moved" narrative, annotated as removed.
- `discord-worker/commands.md:244` "all 125 dyes" `fetchPricesBatched`: wording only; consolidation means three IDs, not worth a candidate.
- `web-app/overview.md:38` "~20 API calls instead of 105": not verifiable without a run.
- Standing rejections not re-filed (Grey, French cells, api-contracts schema colours, tools.md "Colour wheels" heading, research Status lines, /about policies, "deep harbour water").

## Spelling (per document, from the prose seen during this sweep; scanner list `american-spelling.txt`)

| document | confirmed prose misses (lines) |
|---|---|
| docs/architecture/overview.md | 3 (24 diagram, 161, 166) |
| docs/index.md | 1 (184) |
| docs/projects/core/overview.md | 1 (156) |
| docs/projects/web-app/overview.md | 1 (5) |
| docs/projects/discord-worker/commands.md | 1 (244) |
| docs/projects/index.md | 1 (102) |
| docs/reference/ffxiv-terminology.md | 1 (124) |
| docs/reference/index.md | 1 (6) |
| docs/user-guides/web-app/getting-started.md | 3 (50, 64, 113) |
| docs/user-guides/web-app/color-harmony.md | 1 (102) |
| docs/user-guides/web-app/gradient-builder.md | 1 (102 neighbouring) |
| total | 15 |

Dictionary misses (tagged zone `code` by the scanner but English diagram/tree text): `docs/architecture/dependency-graph.md:163,165,177` (colour-wheel / colour sheets / Facewear colours), `docs/projects/index.md:63,64`.
