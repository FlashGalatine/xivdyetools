# Spelling — confirmed per document (2026-10-11)

Source: each cluster reviewer confirmed its slice of `american-spelling.txt` (+ `--all` extras) at file:line and read for dictionary misses; each verifier spot-checked at least 5 rows. Counts are the reviewers' confirmed totals.

| Cluster | Document | Confirmed |
|---|---|---|
| web-app-core | `docs/projects/web-app/tools.md` | 40 |
| web-app-core | `docs/projects/web-app/components.md` | 19 |
| web-app-core | `docs/user-guides/web-app/accessibility.md` | 19 |
| web-app-core | `docs/user-guides/web-app/getting-started.md` | 12 |
| web-app-core | `docs/user-guides/web-app/favorites-collections.md` | 7 |
| web-app-core | `docs/user-guides/web-app/faq.md` | 3 |
| web-app-core | `docs/projects/web-app/overview.md` | 2 |
| web-app-tools | `docs/user-guides/web-app/palette-extractor.md` | 28 |
| web-app-tools | `docs/user-guides/web-app/swatch-matcher.md` | 27 |
| web-app-tools | `docs/user-guides/web-app/color-harmony.md` | 18 |
| web-app-tools | `docs/user-guides/web-app/dye-mixer.md` | 15 |
| web-app-tools | `docs/user-guides/web-app/budget-suggestions.md` | 13 |
| web-app-tools | `docs/user-guides/web-app/dye-comparison.md` | 13 |
| web-app-tools | `docs/user-guides/web-app/gradient-builder.md` | 13 |
| discord-worker | `docs/projects/discord-worker/commands.md` | 14 |
| discord-worker | `docs/user-guides/discord-bot/getting-started.md` | 11 |
| discord-worker | `docs/user-guides/discord-bot/command-reference.md` | 8 |
| discord-worker | `docs/projects/discord-worker/overview.md` | 6 |
| discord-worker | `docs/user-guides/discord-bot/faq.md` | 4 |
| discord-worker | `docs/projects/discord-worker/interactions.md` | 3 |
| discord-worker | `docs/projects/discord-worker/rendering.md` | 1 |
| discord-worker | `docs/user-guides/discord-bot/favorites-collections.md` | 1 |
| api-worker | `docs/projects/api-worker/endpoints.md` | 10 |
| api-worker | `docs/user-guides/public-api.md` | 7 |
| api-worker | `docs/projects/api-worker/overview.md` | 3 |
| presets-moderation | `docs/projects/presets-api/endpoints.md` | 1 |
| presets-moderation | `docs/projects/moderation-worker/overview.md` | 1 |
| oauth-og | `docs/projects/og-worker/overview.md` | 4 |
| oauth-og | `docs/projects/oauth/endpoints.md` | 1 |
| oauth-og | `docs/projects/oauth/jwt.md` | 1 |
| packages | `docs/projects/core/types.md` | 6 |
| packages | `docs/projects/core/algorithms.md` | 5 |
| packages | `docs/projects/index.md` | 4 |
| packages | `docs/projects/core/overview.md` | 3 |
| packages | `docs/projects/core/services.md` | 3 |
| packages | `docs/projects/types/overview.md` | 2 |
| packages | `docs/projects/logger/overview.md` | 1 |
| architecture | `docs/architecture/overview.md` | 19 |
| architecture | `docs/architecture/api-contracts.md` | 3 |
| architecture | `docs/architecture/dependency-graph.md` | 3 |
| architecture | `docs/architecture/service-bindings.md` | 2 |
| architecture | `docs/architecture/data-flow.md` | 1 |
| devguides-maintainer | `docs/maintainer/adding-dyes.md` | 7 |
| devguides-maintainer | `docs/developer-guides/contributing.md` | 4 |
| devguides-maintainer | `docs/developer-guides/environment-variables.md` | 2 |
| devguides-maintainer | `docs/developer-guides/monorepo-setup.md` | 1 |
| devguides-maintainer | `docs/developer-guides/release-process.md` | 1 |
| devguides-maintainer | `docs/developer-guides/troubleshooting.md` | 1 |
| operations | `docs/operations/IMAGE_WORKER_SPLIT.md` | 3 |
| operations | `docs/operations/OPEN_ITEMS.md` | 1 |
| operations | `docs/operations/ANALYTICS_QUERIES.md` | 1 |
| entry-reference | `docs/versions.md` | 50 |
| entry-reference | `docs/index.md` | 10 |
| entry-reference | `docs/reference/glossary.md` | 5 |
| entry-reference | `docs/reference/ffxiv-terminology.md` | 2 |
| entry-reference | `docs/reference/index.md` | 1 |
| specs-presets | `docs/specifications/index.md` | 2 |
| specs-other | `docs/specifications/feature-roadmap.md` | 4 |
| specs-other | `docs/specifications/collections.md` | 2 |
| specs-other | `docs/specifications/multi-color-extraction.md` | 1 |
| policy-en | `apps/web-app/PRIVACY.md` | 8 |
| policy-en | `apps/web-app/TERMS_OF_SERVICE.md` | 9 |

**Total confirmed: 472** (+1 found by the specs-other verifier: `docs/specifications/feature-roadmap.md:197` favourited).

## Rejected candidates

| Cluster | Location | Why |
|---|---|---|
| oauth-og | docs/projects/og-worker/overview.md:218 | Grey in dye names Slate Grey / Ash Grey is a game-term carve-out |
| architecture | docs/architecture/api-contracts.md:444 | verbatim presets-api schema.sql seed value (standing rejection) |
| entry-reference | docs/reference/ffxiv-terminology.md:133 | Grey Facewear row, standing rejection |
| entry-reference | docs/reference/ffxiv-terminology.md:241 | French Analogue cell |
| entry-reference | docs/reference/ffxiv-terminology.md:289 | French centre de donnees cell |
| entry-reference | docs/reference/ffxiv-terminology.md:301 | same French term in running note |
| specs-presets | docs/specifications/community-presets.md:104 | verbatim DB seed string from schema.sql |
| specs-other | docs/specifications/collections.md:451 | CANCELLED is an accepted US variant |

## Dictionary misses found by hand (add to american-spelling.mjs)

| Cluster | Location | Word |
|---|---|---|
| discord-worker | docs/projects/discord-worker/commands.md:59 | canonicalises |
| discord-worker | docs/projects/discord-worker/commands.md:374 | canonicalises |
| discord-worker | docs/projects/discord-worker/commands.md:454 | favourited |
| discord-worker | docs/user-guides/discord-bot/getting-started.md:8 | favourited |
| discord-worker | docs/projects/discord-worker/overview.md:183 | canonicalised |
| discord-worker | docs/projects/discord-worker/interactions.md:88 | memoised |
| oauth-og | docs/projects/og-worker/overview.md:168 | unparameterised |
| oauth-og | docs/projects/og-worker/overview.md:272 | unrecognised |
| packages | docs/projects/core/types.md:63 | capitalised |
| packages | docs/projects/core/algorithms.md:340 | capitalised |
| operations | docs/operations/IMAGE_WORKER_SPLIT.md:198 | rasterisation |
| operations | docs/operations/ANALYTICS_QUERIES.md:74 | unrecognised |
| entry-reference | docs/versions.md:79 (x2) | unrecognised |
| entry-reference | docs/versions.md:92 | mislabelled |
| specs-other | docs/specifications/collections.md:96 | favourited |
| specs-other | docs/specifications/collections.md:298 | favourited |
| policy-en | apps/web-app/TERMS_OF_SERVICE.md:87 | unauthorised |
