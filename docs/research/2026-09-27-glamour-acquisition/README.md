# Glamour acquisition — where "how to get this piece" data can come from

**Date:** 2026-09-27 · **Question:** can the glamour Markdown export fill its `Acquisition:` line
automatically, in the GPOSERS format, and from which data? · **Status:** research complete; design in
[`../../superpowers/specs/2026-09-27-glamour-acquisition-design.md`](../../superpowers/specs/2026-09-27-glamour-acquisition-design.md)

Every query below was run live on 2026-09-27 against XIVAPI v2 (`version 541c0c12e07da325`,
`schema exdschema@2:rev:e773c41a`), Teamcraft's `staging` branch and garlandtools.org. Each XIVAPI
search pattern was checked against a positive control before a zero result was trusted.

## 1. TL;DR

- **XIVAPI (game data)** answers crafting, gil and currency shops with their costs, quest and
  achievement rewards, and — for many shops — which NPC runs them. It has no source column on
  `Item`; everything is a reverse search on the sheets that point at the item.
- It **cannot** answer duty drops, coffer contents, the Mog Station, relic upgrades done by quest
  script, or where many vendor NPCs stand, and some shops link to no NPC through any static column.
- **Teamcraft's data files** (MIT, updated every patch) fill almost all of that: duty sources
  including coffers and tokens, coffer contents, Mog Station items, NPC positions, shop→NPC links,
  voyages, desynthesis, FATEs, quests, achievements and recipes.
- **Garland Tools** has per-item JSON its own site loads — unofficial, one request per item, no
  bulk download. Useful as a cross-check only.
- On a real six-piece glamour written to the GPOSERS guide, **XIVAPI + Teamcraft + formatting rules
  reproduce all six lines** (§5).

## 2. XIVAPI v2 — the reverse searches that work

`GET https://v2.xivapi.com/api/search?sheets=<Sheet>&query=<clause>&fields=<…>`

| Source | Query | Positive control |
|---|---|---|
| Crafted | `Recipe` `ItemResult=<id>` → `CraftType`, `RecipeLevelTable.ClassJobLevel` | Bronze Ingot 5056 → Smithing 1 + Armorcraft 1 |
| Gil vendor | `GilShopItem` `Item=<id>`; price is `Item.PriceMid` | Makai Manhandler's Quartertights 16114 → 2 shops, 2,000 gil |
| Currency exchange | `SpecialShop` `Item[].Item[]=<id>`; the matching `Item[n]` entry has `ItemCost[3]`, `CurrencyCost[3]`, `Quest`, `AchievementUnlock` | 16114 → shop 1769743, 4,000 × Wolf Mark |
| Quest reward | `Quest` `Reward[]=<id> OptionalItemReward[]=<id>` | item 4552 → quest 66002 "Double Dealing" (+4 more) |
| Achievement reward | `Achievement` `Item=<id>` | item 2907 → achievement 7 |
| Vendor NPC | `ENpcBase` `ENpcData[]=<shopId>`, else via a menu: `TopicSelect` `Shop[]=<shopId>` then `ENpcBase` `ENpcData[]=<topicId>`; name from `ENpcResident/<id>` `Singular` | shop 262182 → NPC 1000236; repurchase shops → menu 3276815 → Calamity salvager |
| NPC position | `Level` `Object=<npcId>` → `Territory`, `Map`, X/Z | NPC 1000004 → Level 1034661 |

`Item.PriceMid` of 99999 is a placeholder, not a price. Quest type (Main Scenario vs side quest) is
`Quest.JournalGenre.JournalCategory.JournalSection`.

## 3. What XIVAPI cannot answer (evidence)

| Gap | Evidence |
|---|---|
| Duty drops and coffer contents | The game files carry no loot tables. Street Handwear 36828 → no source in any sheet; Teamcraft knows it comes out of the Street Attire Coffer 36814. |
| Mog Station | Leisurewear Shoes 44665 matched no sheet at all. Garland flags it `mog`; Teamcraft lists it as Mog Station product 1071. |
| Scripted relic rewards | Nirvana Zeta 10059: no `Quest.Reward[]`/`OptionalItemReward[]`, no `QuestClassJobReward.RewardItem[]` hit. |
| Many NPC positions | The Calamity salvager (1006004–6) and the Dawntrail merchants selling Mountain Linen (1048726, 1048851, 1048931) have no `Level` row; positions live in map layout files XIVAPI does not serve. |
| Some shop→NPC links | Wolf Mark shop 1769743 and Skybuilders' shop 1770281 are linked from no `ENpcData`, `TopicSelect`, `InclusionShopSeries`, `PreHandler` or `CustomTalk` column searched. |
| Random vs fixed containers | Random boxes (Venture Coffer, Materiel Container 4.0, Sanctuary Materiel Container) and fixed set coffers (Street/Metian Attire Coffer, Edenmorn gear coffers) share open-action `ItemAction` 388; actions 388 and 2462 are the same generic "open" (`Action` 4647). |

## 4. Community sources

### 4.1 Teamcraft

- **Where:** `libs/data/src/lib/json/` in `ffxiv-teamcraft/ffxiv-teamcraft`, `staging` branch, served from
  `raw.githubusercontent.com`. This repo already reads it for the ko/zh item names
  (`apps/api-worker/scripts/build-item-names.mjs`).
- **License:** MIT (repository `LICENSE`).
- **Freshness:** the data folder's latest commit on 2026-09-27 was 2026-09-08, "search update for 7.56".
- **No API:** `api.ffxivteamcraft.com` returns 404 at the root; the app reads these same files.

Files that matter here (shapes verified):

| File | Size | Shape | Used for |
|---|---|---|---|
| `instance-sources.json` | 189 KB | `{itemId: [instanceId]}` | duties (incl. coffers and tokens that drop there) |
| `instances.json` | 1.4 MB | `{id: {en, ja, de, fr, …}}` | Duty Finder names ("Eden's Promise: Litany (Savage)") |
| `loot-sources.json` | 113 KB | `{itemId: [containerItemId]}` | "comes out of container X" |
| `mogstation-sources.json` | 38 KB | `{itemId: {price, id}}` | FFXIV Online Store (803 items, max id 52596) |
| `shops.json` | 9 MB | `[{id, type, npcs[], trades[{currencies[{id, amount}], items[{id, amount}]}]}]` | shops with costs and NPC links, including links XIVAPI lacks |
| `npcs.json` | 17 MB | `{id: {en, …, position: {zoneid, map, x, y, z}}}` | vendor zones |
| `maps.json` / `places.json` | 0.5 / 0.8 MB | map → `placename_id`, `placename_sub_id`; place names | zone names |
| `recipes-per-item.json` | 14 MB | `{itemId: [{job, lvl, …}]}` (job 8–15 = CRP…CUL) | Crafted (CLS Lvl. N) |
| `quest-sources.json` / `quests.json` | 8 KB / 2.2 MB | `{itemId: [questId]}` / `{id: {name, rewards, banner}}` | quests (no type — XIVAPI supplies it) |
| `achievements.json` | 1.1 MB | `{id: {en, …, itemReward}}` | achievements |
| `fate-sources.json` / `fates.json` | 15 KB / 2.2 MB | `{itemId: [fateId]}` / `{id: {name, level, location}}` (`location` is a `Level` row) | FATEs |
| `voyage-sources.json` | 85 KB | `{itemId: [{type, id}]}` | Airship / Subaquatic Voyages |
| `desynth.json` | 65 KB | `{itemId: [sourceItemId]}` | Desynthesis |
| `special-shop-names.json` / `gil-shop-names.json` | 263 / 157 KB | `{shopId: {en, …}}` | shop names (e.g. "Phantom Weapons Penumbrae") |

### 4.2 Garland Tools

- **Where:** the JSON its own pages load: `https://www.garlandtools.org/db/doc/item/en/3/<id>.json`
  (and `/npc/`, `/instance/`, …). The community package `karashiiro/garlandtools-api` wraps these
  and calls them unofficial.
- **Access:** `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=172800`, behind Cloudflare.
  One request per item; no bulk download; no stated terms or rate limits.
- **Code/data:** code repository `ufx/GarlandTools` is MIT but was last pushed 2023-10-18; the data
  is current (item 52596 "Neo Citizen's Attire", patch 7.5, is present).
- **Coverage on the test pieces:** `vendors` (15 for the Makai legs), `tradeShops`, `treasure` (Street
  Handwear), a `mog` flag (Leisurewear Shoes); nothing for Nirvana Zeta or the Eastern Technojacket.

## 5. Reproducing a real GPOSERS glamour

The user's "Cropsey" glamour, written by hand to the guide, against what the data yields:

| Slot | Line in the example | Derivation |
|---|---|---|
| Main Hand | Phantom Gear & Weapons | XIVAPI: Phantom Cleavers Penumbrae 47878 sells only at SpecialShop 1770926 "Phantom Weapons Penumbrae" (3 × Arcanite) in Phantom Village → relic saga |
| Head | Crafted (WVR Lvl. 92) / Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil) | XIVAPI: recipe WVR 92, `PriceMid` 28,483, GilShop 263178. Teamcraft: sellers in Urqopacha, Kozama'uka, Yak T'el → lowest-level zone. Map labels: Worlar's Echo (§7) |
| Body | Crafted (WVR Lvl. 93) / Independent Merchant - Urqopacha - Worlar's Echo (47,471 Gil) | same |
| Hands | Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage) | Teamcraft: sleeves 32326 ← Edenmorn Hand Gear Coffer 32147 ← instances 30100 + 30102; the Book of Litany token 32141 ← 30100. The 6-book exchange (Ghul Gul, Amh Araeng) is left out |
| Legs | Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals) | XIVAPI alone: SpecialShop 1770732, NPC 1038441 with a `Level` row |
| Feet | Enie - Ishgard - The Firmament (1,200 Skybuilders' Scrips) | XIVAPI: the cost. Teamcraft: shop 1770281 → Enie 1031680 in The Firmament. The boots also come out of the Fête Present (a random box), which the example leaves out |

Formatting still needed on top: title case for generic NPC names (stored "independent merchant"),
plural currency names (`Item.Plural`), thousands separators, and city-district prefixes
("Ishgard - The Firmament").

## 6. Random ("gacha") containers

The user's rule: leave random containers out unless they are the item's only source. The game data
does not mark them (§3). Counting contents in Teamcraft's `loot-sources.json` (556 containers,
median 5 items, 90th percentile 18) separates the obvious cases — random boxes yield 22–97 items,
set coffers 3–7 — but job-based weapon coffers yield 16–23, so a threshold alone misfires. Two text
signals do separate every container above 15 items:

- **Description:** random boxes say so ("mystery prize", "Contains a random…", "the contents of which
  remain a mystery"); fixed coffers say "determined by current job or class" or "a complete set".
- **Name:** random boxes whose text says neither are Eureka/Bozja `Lockbox`es, deep-dungeon
  `-trimmed`/`-haloed Sack`s and `Timeworn … Map`s.

83 containers yield more than 15 items; about 35 of them are random by these signals.

## 7. Outposts from map labels

The guide wants the outpost for vendors in the wilderness, Ul'dah and Ishgard (e.g. "Urqopacha -
Worlar's Echo"), and not the nearest aetheryte. Teamcraft's NPC position gives only the zone. The
map's own area labels fill it: `Map/857.MapMarkerRange` = 622; listing `sheet/MapMarker?after=621`
gives 46 markers for that range, 34 with a `PlaceNameSubtext`. Converting pixels to map coordinates
(`41 / (SizeFactor / 100) × px / 2048 + 1`), the nearest label to the Independent Merchant (30.47,
34.64) is **Worlar's Echo** at 0.56 units; the next is Ten Thousand Steps at 2.47. Tested on this one
vendor only.

## 8. What neither source has

- **Zone levels** for the user's "prefer Gridania, else the lowest-level zone players can reach" rule.
- **Ceremony of Eternal Bonding, Hall of the Novice, event names with years, PvP Series rewards,
  preorder / Collector's Edition / Encyclopaedia Eorzea items** — the guide's hand-kept categories.
- **Relic saga membership** as a list, although the game data has per-saga relic sheets
  (`RelicItem`, `RelicNote`, `AnimaWeaponItem`, `Eureka*`, `ResistanceWeaponAdjust`,
  `MandervilleWeaponEnhance`, `PhantomWeaponExTodo`, `WKSCosmoTool*`) and relic shops have
  recognizable names.

## Sources

- XIVAPI v2: `https://v2.xivapi.com/api/` (`/sheet`, `/search`); query grammar in
  [`../chara-equipment-resolution/README.md`](../chara-equipment-resolution/README.md) §4.
- Teamcraft data: `https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/tree/staging/libs/data/src/lib/json`
- Garland Tools: `https://www.garlandtools.org/db/doc/item/en/3/<id>.json`; code
  `https://github.com/ufx/GarlandTools`; wrapper `https://github.com/karashiiro/garlandtools-api`
