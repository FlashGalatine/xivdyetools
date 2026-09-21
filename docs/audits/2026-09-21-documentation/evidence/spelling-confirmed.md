# American-English spelling — confirmed candidates by document

Source: `evidence/american-spelling.txt` (script: `audit-shared/scripts/american-spelling.mjs`, exit 1).
421 raw candidates; **4 rejected** (below); **417 confirmed** across 56 documents.

## Rejected — the glossary and non-English cells win

| Location | Word | Why rejected |
|---|---|---|
| `docs/reference/ffxiv-terminology.md:116` | Grey | The dictionary's own Facewear row (`` `grey` `` → Grey). The FFXIV glossary wins — this is the game's spelling. |
| `docs/reference/ffxiv-terminology.md:183` | Analogue | The **French** cell of the `analogous` harmony row, not English prose. |
| `docs/reference/ffxiv-terminology.md:231` | centre | The **French** cell (`centre de données`) of the Data Center row. |
| `docs/architecture/api-contracts.md:436` | colours | Quotes a live DB seed value verbatim — `apps/presets-api/schema.sql:24`. Correcting it would make the document misquote the database. |

## Confirmed, by document

| Document | Candidates |
|---|---|
| `docs/projects/web-app/tools.md` | 35 |
| `docs/user-guides/web-app/swatch-matcher.md` | 31 |
| `docs/versions.md` | 28 |
| `docs/user-guides/web-app/palette-extractor.md` | 28 |
| `docs/user-guides/web-app/accessibility.md` | 19 |
| `docs/projects/web-app/components.md` | 19 |
| `docs/user-guides/web-app/color-harmony.md` | 18 |
| `docs/architecture/overview.md` | 16 |
| `docs/user-guides/web-app/dye-mixer.md` | 15 |
| `docs/user-guides/web-app/gradient-builder.md` | 13 |
| `docs/user-guides/web-app/dye-comparison.md` | 13 |
| `docs/user-guides/web-app/budget-suggestions.md` | 13 |
| `docs/user-guides/web-app/getting-started.md` | 12 |
| `docs/projects/discord-worker/commands.md` | 12 |
| `docs/user-guides/discord-bot/getting-started.md` | 10 |
| `docs/projects/api-worker/endpoints.md` | 10 |
| `docs/user-guides/discord-bot/command-reference.md` | 9 |
| `docs/index.md` | 9 |
| `apps/web-app/TERMS_OF_SERVICE.md` | 8 |
| `docs/user-guides/web-app/favorites-collections.md` | 7 |
| `docs/maintainer/adding-dyes.md` | 7 |
| `apps/web-app/PRIVACY.md` | 6 |
| `docs/user-guides/public-api.md` | 5 |
| `docs/reference/glossary.md` | 5 |
| `docs/reference/ffxiv-terminology.md` | 2 |
| `docs/projects/discord-worker/overview.md` | 5 |
| `docs/projects/core/algorithms.md` | 5 |
| `docs/user-guides/discord-bot/faq.md` | 4 |
| `docs/specifications/feature-roadmap.md` | 4 |
| `docs/projects/og-worker/overview.md` | 4 |
| `docs/developer-guides/contributing.md` | 4 |
| `docs/user-guides/web-app/faq.md` | 3 |
| `docs/projects/core/services.md` | 3 |
| `docs/projects/core/overview.md` | 3 |
| `docs/projects/api-worker/overview.md` | 3 |
| `docs/architecture/api-contracts.md` | 3 |
| `docs/specifications/index.md` | 2 |
| `docs/projects/web-app/overview.md` | 2 |
| `docs/projects/index.md` | 2 |
| `docs/projects/discord-worker/interactions.md` | 2 |
| `docs/projects/core/types.md` | 2 |
| `docs/operations/IMAGE_WORKER_SPLIT.md` | 2 |
| `docs/developer-guides/environment-variables.md` | 2 |
| `docs/user-guides/discord-bot/favorites-collections.md` | 1 |
| `docs/specifications/multi-color-extraction.md` | 1 |
| `docs/specifications/collections.md` | 1 |
| `docs/reference/index.md` | 1 |
| `docs/projects/types/overview.md` | 1 |
| `docs/projects/presets-api/endpoints.md` | 1 |
| `docs/projects/oauth/jwt.md` | 1 |
| `docs/projects/oauth/endpoints.md` | 1 |
| `docs/projects/discord-worker/rendering.md` | 1 |
| `docs/operations/OPEN_ITEMS.md` | 1 |
| `docs/developer-guides/troubleshooting.md` | 1 |
| `docs/developer-guides/release-process.md` | 1 |
| `docs/architecture/data-flow.md` | 1 |
