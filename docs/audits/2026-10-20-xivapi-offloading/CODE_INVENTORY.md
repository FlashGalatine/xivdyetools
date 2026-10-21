# Current implementation inventory

Baseline: `b98c8584a85f5dc50b4b4392c508cc627ef004d6`. Paths/line numbers refer to that revision. Recommendations are in [README.md](README.md).

## Core and bots

| Responsibility | Source evidence |
|---|---|
| 125 standard dyes, seven stored fields | `packages/core/src/data/dyes.json:1-1127`; `docs/maintainer/adding-dyes.md:16-36` |
| stainID canonical; runtime itemID/id compatibility remains legacyItemID ?? stainID | `packages/core/src/services/dye/DyeDatabase.ts:202-217` |
| Derived RGB/HSV, acquisition cost/currency and classification flags | `DyeDatabase.ts:219-272`; `packages/core/src/config/dye-vocabulary.ts:50-72` |
| Consolidated market IDs A=52254, B=52255, C=52256 | `packages/core/src/config/consolidated-ids.ts:35-38,94-116` |
| Existing Item name fetch, four languages, legacy IDs only | `packages/core/scripts/fetch_dye_names.py:32-50,62-85,163-199`; request has no game/schema pin |
| Fetch timeout/retries; intermediate CSV still written with failures, nonzero exit | `fetch_dye_names.py:41-43,87-145,202-232,273-309` |
| Source CSV + YAML → six local JSON files; validation before writes | `packages/core/scripts/build-locales.ts:86-214,225-288,498-524`; locale keys preserve legacy compatibility |
| Local package and locale imports | `packages/core/src/index.ts:294-300,369`; `src/services/localization/LocaleLoader.ts:13-29,57-70`; `packages/core/package.json:8-41` |
| Separate 11 facewear colors and frozen legacy negative IDs | `packages/core/src/data/facewear_colors.json`; `src/config/facewear.ts:1-44` |
| Character palette extraction; interface versus shader halves | `packages/core/scripts/build-character-colors.ts:1-26,82-106,131-159` |
| Bot dye search and locale caches use local core | `packages/bot-logic/src/input-resolution.ts:11-17,81-100`; `src/localization.ts:16-90`; `src/commands/dye-info.ts:109-137,224-233` |

Core's `APIService` is a Universalis client, not a generic XIVAPI adapter. Neither bot UI translations nor color-science functions are sheet-data replacements.

## API worker, browser and Discord

| Responsibility | Source evidence |
|---|---|
| Shared resolve route, per-key cache, batched Item search, separate Glasses lookup | `apps/api-worker/src/chara/router.ts:197-276` |
| Projected names/models/slot/wear rules; partial-page handling | `src/chara/xivapi.ts:59-81,225-245,358-391` |
| Local candidate filtering, twins and off-hand interpretation | `src/chara/resolver.ts:88-159,187-205` |
| Icon proxy validation, 1 MiB cap, PNG verification, 30-day cache | `src/chara/router.ts:282-355`; `src/chara/xivapi.ts:115-121,394-396` |
| Cache shape5 + game-version key; seven-day fresh + one-day stale window | `src/chara/cache.ts:22-91`; stale flag discarded at reads |
| Production latest, ten-minute resolution cache, one-minute failure retry, three-second version timeout | `src/chara/xivapi.ts:140-157,281-317`; `apps/api-worker/wrangler.toml:116`; no production XIVAPI_SCHEMA configured |
| Per-upstream timeout ten seconds; redirect refusal; unavailable errors | `src/chara/xivapi.ts:320-346`; client abort not passed through |
| Browser memory/session cache, 12-second timeout + caller abort, EN fallback | `apps/web-app/src/services/chara-resolve-service.ts:123-139,158-232`; `components/glamour-block.ts:267,329,342-345` |
| Discord shared binding transport and 12-second timeout | `apps/discord-worker/src/handlers/commands/glamour.ts:41-96` |
| Stoat has no corresponding transport in inspected source | `apps/stoat-worker/src`; current `CLAUDE.md:7-11` limits implemented commands |

## Acquisition and regional names

`apps/api-worker/scripts/build-acquisition.ts:1-20,44-63,104-118` defines the pinned, manual update workflow; `--pinned` reuses recorded revisions. Source families and conservative selection are in `scripts/acquisition/sources.ts:9-24`, `inputs.ts:13-36,165-194`, and `select.ts:109-145,170-173`. Runtime reads the generated table in `src/chara/acquisition.ts:14-45`.

The actual metadata file, `src/chara/data/acquisition.meta.json:2-10`, records 2026-10-11 generation, Teamcraft `acc77d406cc50a78caf0210f805ec7b069607af0`, XIVAPI `541c0c12e07da325`, 29,058 equippable items, 24,922 emitted lines, 61 facewear unlock items, 732 variants, and 316 sources without an emitted line. Counts in older prose are not substituted for these generated facts.

Facewear unlocks follow relationships and validate membership (`scripts/acquisition/facewear.ts:1-36`). Current main drops unresolved currency modes; the open Poetics PR #321 must not be treated as shipped (`inputs.ts:114-117,187-193`; `select.ts:120-123`).

The acquisition fetch helper has limited HTTP-5xx retries but no explicit timeout, 429 retry or network-exception retry (`build-acquisition.ts:69-101`). Treat improving it as later implementation work.

Regional tables are loaded once on use (`src/chara/regional-names.ts:1-66`), omit unknown names and allow caller EN fallback. `scripts/build-item-names.mjs:56-71,127-144,195-205` uses Teamcraft ko/zh JSON and global datamining for the Japanese font-support table. Reusing a global client ID is not proof that a regional client has released the item.

## Measured source-file sizes

These are uncompressed repository bytes, not built bundles, network transfers or Worker billing measurements.

| Resource | Bytes |
|---|---:|
| dyes.json (125 entries) | 24,280 |
| facewear_colors.json (11 entries) | 767 |
| dyenames.csv | 12,130 |
| facewear-names.csv | 639 |
| Six core locale JSONs combined | 47,494 |
| Character-color subtree (12 files) | 2,190,185 |
| acquisition.en.json | 1,389,980 |
| item-names.ko.json | 1,103,611 |
| item-names.zh.json | 899,454 |
| item-names.ja.json (font support; not imported by regional-names.ts) | 1,508,629 |

The small dye/name resources are poor candidates for runtime size savings. The larger regional and palette resources lack an equivalent verified global XIVAPI replacement.
