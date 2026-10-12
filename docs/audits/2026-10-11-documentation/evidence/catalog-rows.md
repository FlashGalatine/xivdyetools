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
