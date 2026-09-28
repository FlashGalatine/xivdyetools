# Glamour export — automatic Acquisition line

**Date:** 2026-09-27 · **Scope:** `api-worker` (build script, data table, one new field on
`POST /v1/chara/resolve`, public docs) then `web-app` (the Glamour Reader's export sheet) ·
**Status:** in progress — PR A (api-worker 0.15.0) open; the web-app half ships with the Glamour Reader. Approved 2026-09-27 (Native execution), amended the same day by the Glamour Reader designs —
see [Amendments](#amendments-2026-09-27-glamour-reader-designs) · **Research:** [`docs/research/2026-09-27-glamour-acquisition/`](../../research/2026-09-27-glamour-acquisition/README.md) ·
**Branch:** `feat/glamour-acquisition`

## Problem

The glamour export (`apps/web-app/src/shared/glamour-markdown.ts`) writes the GPOSERS submission
template. It knows each piece and its dyes, but its `Acquisition:` line is always blank: the player
looks up where every piece comes from and types it in the format the GPOSERS guide prescribes
("Obtained Order & Format Reference", October 2025). The research shows the data to fill most of
those lines exists — in the game data (XIVAPI) and in Teamcraft's data files — and that a real
glamour written by hand to the guide can be reproduced line for line.

## Goals

1. Fill the `Acquisition:` line automatically, in the guide's exact wording and order, for every piece
   the data supports.
2. **Blank beats wrong.** A piece whose sources the data cannot format correctly keeps today's blank
   line for the player to fill. No guessed, partial or misleading lines.
3. No request-time dependency on Teamcraft, Garland Tools or new XIVAPI searches: everything is
   computed at build time.

## Non-goals (this version)

- The guide's categories that no data source carries: Ceremony of Eternal Bonding, Hall of the Novice,
  Event Name (20XX), PvP Series Rewards, preorder / Collector's Edition / Encyclopaedia Eorzea items.
  Pieces whose only sources are these stay blank.
- Facewear (the `Glasses` sheet): stays blank.
- Localized acquisition lines (see D2).
- ~~Showing acquisition anywhere in the glamour block's UI; it is export text only.~~ Superseded: the
  Glamour Reader's export sheet (design 2c) shows each line, editable, before it is copied or saved.

## Decisions

The user delegated these ("proceed with your best recommendations"); each is reviewable.

| # | Decision | Why |
|---|---|---|
| D1 | A **build-time table in the api-worker**, attached to each item in the `POST /v1/chara/resolve` response as `acquisition` | The web-app already calls resolve when a file loads, so the line arrives with the item names at no extra request. The worker already ships two build-time tables of this size (ko/zh names, 1.1 and 0.9 MB). A web-app chunk would blow the 60 KB default chunk budget; runtime calls to Teamcraft/Garland would lean on unofficial or bulk-only sources per request. |
| D2 | **English only** | GPOSERS is an English-language submission format, and the guide's wording ("Crafted (WVR Lvl. 92)", "Gil", plural currency names) is English-specific. `glamour-markdown.ts` already keeps its labels English for the same reason. Item names in the export still follow the app language. |
| D3 | The line describes **the item the export names**. *Amended:* the Glamour Reader lets the player pick any twin, and its default is no longer the lowest `row_id`, so the resolve answer carries `acquisition` on the named item **and on every alternate**; the web-app writes the picked twin's line only | The line must match the name next to it. |
| D4 | **Pin the inputs per build:** resolve Teamcraft `staging` to a commit SHA once and fetch every file at that SHA; record the SHA and the XIVAPI version key in `acquisition.meta.json` | Files fetched minutes apart from a moving branch can disagree; the meta file makes a build reproducible. (`build-item-names.mjs` reads `staging` unpinned; it is not changed here.) |
| D5 | **Savage:** list only the encounters, never the book exchange or book count (user rule). The encounters are every duty where the item, its fixed coffer, or its token drops | User rule, 2026-09-27; reproduces the example's Edenmorn line exactly. |
| D6 | **Other duty tokens** (normal and alliance raids, Extreme trials) follow the same rule as Savage — **recommendation, needs confirmation**. A cost item counts as a duty token when Teamcraft lists it in `instance-sources` and its UI category is neither "Other" (63: gil, seals, marks, tomestones, MGP) nor "Currency" (100: scrips, crystals, gemstones); the rule applies only when **every** cost of the exchange is a token, so an upgrade that also takes a base item keeps the upgrade format | Consistent with the guide putting duties first and with the example; the alternative is a vendor line the example suggests GPOSERS does not use. Implemented as recommended behind one constant in `select.mjs`, so reversing it is a one-line change. **Confirmed** by the user's answers on design 2c ("token gear lists encounters only, like Savage"). |
| D7 | **Random ("gacha") containers only when they are the item's only source** (user rule) — detected with a reviewed list seeded from description and name signals | The game data does not mark them; see research §6. |
| D8 | **Repurchase shops are ignored** (gil shops whose English name starts "Repurchase", run by the Calamity/journeyman salvagers) | They sell back only what the player already owned, so they are not an acquisition route. |
| D9 | **Vendor choice** when several NPCs sell a piece: an NPC in Old or New Gridania; else the NPC in the lowest-level zone players can reach — a zone's level is its lowest FATE level, and a zone without FATEs (a city) takes its expansion's starting level (1, 50, 60, 70, 80, 90); ties → lowest NPC id. NPCs in duty or housing maps are skipped; an NPC in a zone missing from the table still qualifies but ranks after every listed zone (and is counted in the meta, so a new patch's zones get added). A vendor with no known position is left out of the line | User rule plus determinism; a vendor line without a zone is not in the guide's format. |
| D10 | **Outpost segment** only for the wilderness, Ul'dah and Ishgard (guide). A zone counts as wilderness when FATEs happen there — the game's own "overworld" flag also covers hubs such as Wolves' Den Pier, whose example line has no outpost — except Ishgard's districts, where the district is the outpost ("Ishgard - The Firmament", whose fêtes are FATEs). Wilderness: the nearest map area label within 3.0 map units, else no outpost segment. Ishgard districts get an "Ishgard - " prefix; Ul'dah's place names already carry "Ul'dah - " | Research §7; the guide says the outpost is not the nearest aetheryte. |
| D11 | **Relic sagas** are computed each build from `relic-sagas.json` rules: the game's relic sheets (`RelicItem`, `AnimaWeaponItem`, `AnimaWeapon5` by Item link; `ResistanceWeaponAdjust`, `MandervilleWeaponEnhance` keyed by item id), relic-shop name patterns (Phantom Weapons…, Bozjan / Law's Order gear, Skysteel and Splendorous replicas, Eureka weapon replicas), vendor zones (the four Eureka zones), tool-only shop patterns (Cosmic Exploration exchanges), plus reviewed `include` / `exclude` lists. Known-answer spot checks (Nirvana Zeta, Curtana Zenith, Animated Hauteclaire, Augmented Law's Order Bastard Sword, Majestic Manderville Fists, Phantom Cleavers Penumbrae) fail the build if they stop matching. A relic gets only its saga line | The guide says "regardless of step". Rules over data keep up with patches; the lists only correct them. |
| D12 | **Seasonal events are not formatted in v1:** event quests (journal section "Seasonal Events") and event shops (`SpecialShop.RequiredFestival` ≠ 0) are dropped as sources | Their guide format needs the event name and year, which no source carries; dropping them keeps Goal 2 ("blank beats wrong"). |
| D13 | **Two pull requests.** PR 1: api-worker (this branch, off `main`). PR 2: web-app, stacked on PR #206 until it merges. *Amended:* PR 2 is the Glamour Reader web tool, whose export sheet carries the line ([spec](2026-09-27-glamour-reader-design.md)) | #206 rewrites the glamour block the web-app change touches; the api-worker half is independent and deployable first. The web-app ignores an absent field, so deploy order is safe either way. |

## Architecture

```
build time (by hand after each patch)                        request time
─────────────────────────────────────                        ────────────
Teamcraft files @ pinned SHA ─┐                               web-app loads a .chara
XIVAPI (quest types, FATE     ├─► scripts/build-acquisition.mjs     │  POST /v1/chara/resolve
  zones, map labels, plurals, │     sources → select → format        ▼
  desynth classes)            │            │                  api-worker resolver.pickItem()
hand-kept tables ─────────────┘            ▼                    + acquisitionFor(itemId)
                               src/chara/data/acquisition.en.json        │
                               src/chara/data/acquisition.meta.json      ▼
                                                               item.acquisition (English)
                                                                         │
                                                                         ▼
                                                   glamour-markdown  "Acquisition: <line>"
```

### Units

| Unit | Does | Depends on |
|---|---|---|
| `apps/api-worker/scripts/build-acquisition.mjs` | Pins Teamcraft, downloads inputs, queries XIVAPI, runs the three stages below for every equippable item, writes the table and meta | `acquisition/*.mjs`, network |
| `scripts/acquisition/sources.mjs` | Pure: raw inputs → per-item list of typed sources (`duty`, `quest`, `fate`, `achievement`, `craft`, `vendor`, `container`, `voyage`, `desynth`, `onlineStore`, `relic`…) | nothing |
| `scripts/acquisition/select.mjs` | Pure: applies D5–D12 (only-source rules, suppression, vendor choice) | hand-kept tables |
| `scripts/acquisition/format.mjs` | Pure: typed sources → the guide's strings, joined by " / " in the guide's order | nothing |
| `scripts/acquisition/tables/*.json` | Hand-kept and reviewed: `gacha-containers` (ids), `relic-sagas` (rules + include/exclude), `eureka-lockboxes` (lockbox name → zone), `ishgard-districts`. Everything else is derived: zone levels from FATEs, currencies by UI category, scrips and irregular tomestones by name | review |
| `src/chara/acquisition.ts` | `acquisitionFor(itemId): string \| undefined` over the bundled table | `data/acquisition.en.json` |
| `src/chara/resolver.ts` `pickItem()` | Adds `acquisition` to the named item when the table has it | `acquisition.ts` |
| web-app `chara-resolve-service` + glamour block | Carries `acquisition` into `GlamourMarkdownInput` | resolve response |
| web-app `glamour-markdown.ts` | Writes `Acquisition: <line>` when present, the blank label otherwise | input |

The three stages are pure functions over plain data so they test without the network; only
`build-acquisition.mjs` fetches.

## The lines this version writes

In the guide's order; several sources join with " / ".

| Guide entry | Output | Data |
|---|---|---|
| Dungeon | `Eden's Promise: Litany (Savage)` (Duty Finder name; a leading "the" capitalized) | Teamcraft `instance-sources` for the item, its fixed coffers (`loot-sources`) and its duty tokens (D5/D6); names from `instances.json` |
| Quest | `Quest Name (Main Story Quest)` / `(Sidequest)` — **only when it is the only source**. Journal section "Main Scenario…" → Main Story Quest; every other section (custom deliveries, job, allied society, feature quests) → Sidequest; Seasonal Events dropped (D12) | Teamcraft `quest-sources`/`quests`; type from XIVAPI `JournalSection` |
| FATE | `FATE Name - Zone (FATE)` | Teamcraft `fate-sources`/`fates`; zone from XIVAPI `Level/<location>` |
| Achievement | `Achievement Name (Achievement)` | Teamcraft `achievements.itemReward` |
| Crafted | `Crafted (WVR Lvl. 92)`, one per recipe | Teamcraft `recipes-per-item` (`job` 8–15 → CRP…CUL, `lvl`) |
| Scrip exchange | `Scrip Exchange - Old Gridania (250 White Gatherers' Scrips)` whenever the only cost is a crafters'/gatherers' scrip (an item named "… Crafters' Scrip" / "… Gatherers' Scrip") | Teamcraft `shops` |
| Vendor | `Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)`; `(1,500 Trophy Crystals)`; upgrade: `Name - Zone (Base Item, Token1, Token2)`; free: no parentheses | Teamcraft `shops` + `npcs`/`maps`/`places`; XIVAPI `Item.Plural`, `MapMarker` labels; D8–D10 |
| Relic sagas | `Phantom Gear & Weapons` etc., exactly as the guide names them | `relic-sagas` table (D11) |
| Eureka lockboxes | `Eureka Anemos Lockboxes` — only-source (D7) | `loot-sources` + `gacha-containers` + `eureka-lockboxes` |
| Sanctuary Materiel Container | as named — only-source (D7) | same |
| Coffer | A fixed coffer takes its own source's line: a duty drop → the Dungeon line, a quest reward → the quest format, an Online Store product → `FFXIV Online Store`; any other fixed coffer → `Coffer Name`. Random containers: only-source (D7) | `loot-sources`, `instance-sources`, `quest-sources`, `mogstation-sources` |
| Voyages | `Airship Voyages` / `Subaquatic Voyages` | Teamcraft `voyage-sources` |
| Moogle Treasure Trove | `Moogle Treasure Trove` when every cost is an item named "Irregular Tomestone of …" | `shops` |
| Desynthesis | `Desynthesis (WVR) - Source Item` | Teamcraft `desynth`; class from XIVAPI `Item.ClassJobRepair` |
| FFXIV Online Store | `FFXIV Online Store`, also for pieces that come out of a store-bought coffer | Teamcraft `mogstation-sources` (+ `loot-sources`) |

Formatting: generic NPC names in title case ("independent merchant" → "Independent Merchant"),
amounts with thousands separators, "Gil" capitalized, and currency names plural when the amount is
not 1. The game's `Item.Plural` is inconsistently cased ("Trophy Crystals", "skybuilders' scrips")
and sometimes a measure phrase ("copies of the Book of Litany"), so the plural is the title-case
`Name` with whichever word the game pluralized given an "s"/"es" ("Skybuilders' Scrips",
"Allagan Tomestones of Poetics"); when no single word matches, the name stays singular.

## Error handling

- **Build script:** fails loudly — non-zero exit, nothing written — when a Teamcraft file is missing,
  a shape assertion fails (every file is checked against the fields this design reads), or XIVAPI
  search returns 503 (post-patch ingestion; see `chara-equipment-resolution` §7.2). A partial table is
  worse than yesterday's.
- **Meta counts** make silent regressions visible in review: lines written per category, pieces
  suppressed per rule, vendors without positions, items with no line.
- **Worker:** an item missing from the table gets no `acquisition` field; nothing else changes.
- **Web-app:** no field → today's blank `Acquisition:` line.

## Testing

- **Acceptance:** a fixture trimmed from the real inputs for the user's six-piece example; the output
  must equal the six hand-written lines character for character (research §5).
- **Rules:** one case per decision — random container dropped when another source exists and kept
  when alone (Fête Present vs Street Handwear's store coffer), Savage encounters without books,
  repurchase shops ignored, Gridania preferred, lowest-level zone chosen, scrip exchange fixed to Old
  Gridania, free vendor without parentheses, quest only when alone (MSQ and side), seasonal quest
  dropped, relic listed vs unlisted-at-relic-shop, outpost present / out of range / city district.
- **Worker:** `pickItem` adds `acquisition` from the table and omits it when absent; the router's
  response carries it; bundle size measured with `wrangler deploy --dry-run` and recorded in the PR.
- **Web-app (PR 2):** `glamour-markdown` writes the value in all three renderings and the blank label
  without it; the glamour block passes the resolved value through.
- The repo gates as usual (`build type-check lint test`, dead-code, docs).

## Rollout

1. **PR 1 — api-worker 0.15.0:** build script, hand-kept tables (seeded, reviewed), generated table,
   the response field, `docs/reference/chara.md`, CHANGELOG. Merge deploys it; the web-app ignores the
   new field until PR 2.
2. **PR 2 — web-app:** after PR #206 merges (stacked on it until then): pass the field into the export;
   version bump, both web-app changelogs and the root player changelog.
3. **After every patch:** run `build-item-names.mjs` and `build-acquisition.mjs`, review the meta
   diff, commit, deploy.

## Open questions

1. ~~**D6** — should normal-raid, alliance-raid and Extreme-trial token exchanges follow the Savage rule?~~
   Yes (design 2c answers).
2. **The hand-kept tables** — especially `relic-sagas` and `gacha-containers` — need one review pass by
   someone who knows the GPOSERS conventions before PR 1 merges.
3. **Deferred categories** — worth a hand-kept table later if the blank lines they leave turn out to
   be common.

## Amendments (2026-09-27, Glamour Reader designs)

The user pointed this work at the Claude Design project's Glamour Reader drawings (`Glamour Reader
Directions.dc.html`, turn 2 = sheet 2c). They change three things here and nothing in the build
script:

1. **Every twin gets a line** (D3). `pickItem` attaches `acquisition` to `alternates[]` entries as well
   as to the named item. Alternates stay capped at `MAX_ALTERNATES`.
2. **D6 is confirmed.**
3. **Where the line is shown** (non-goal 4, D13): the Glamour Reader's export sheet, one editable
   field per piece; edits are saved on the device keyed by a hash of the gear, never the file or the
   character. That is web-app work, specified in
   [`2026-09-27-glamour-reader-design.md`](2026-09-27-glamour-reader-design.md).
4. **Review findings (2026-09-27, whole-branch review of PR A)** — rules the real data needed:
   - **D8 widened:** every shop run by a Calamity or journeyman salvager, a recompense officer or the
     MGF trader is ignored, whatever its name — they sell back quest, achievement, ceremony, seasonal
     and old-gear rewards a player once earned (and the MGF trader ran a limited-time collaboration).
   - **Unknown prices are dropped:** in `UseCurrencyType` 16 SpecialShops Teamcraft reads a tomestone
     price as the retired Red Crafters'/Gatherers' Scrip; those offers are left out (`unknownCost`).
   - **Duty tokens without drop data** (Dawntrail's AAC Illustrated books and recent totems) are
     mapped by the reviewed `tables/duty-tokens.json`; a known token with no known duty drops its
     exchange (`tokenWithoutDuty`) instead of printing it.
   - **D11 extended:** replica and step shops (Zodiac Zeta replicas, Anima replication, Resistance and
     Manderville replicas, Blade's gear) and name rules — any category (`names`: Eureka armor,
     Phantom Vision gear), weapons only (`weaponNames`: Unfinished Zodiac, Eureka, Law's Order and
     Manderville weapons), tools only (`toolNames`: the Skysteel, Splendorous and Cosmic lines).
   - **Duty names** lose the game's text markup (`<i>…</i>`) and doubled spaces.
   - A table-invariant test (`tests/acquisition/table.test.ts`) guards the generated file against each
     of these classes, and the meta records the top cost currencies and vendor NPCs.
