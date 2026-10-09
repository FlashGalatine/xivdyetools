# Coffer sources and vendor placement — 2026-10-09

Status: Implemented on PR [#278](https://github.com/FlashGalatine/xivdyetools/pull/278). This follow-up records a new snapshot; the original gap inventories remain frozen.

## Result

All 212 equipment lines that consisted solely of a coffer name now identify their source. They span 40 coffers; [coffer-resolutions.csv](coffer-resolutions.csv) records every coffer, its equipment IDs, and the resulting line.

The regeneration uses the original production pins: Teamcraft `acc77d406cc50a78caf0210f805ec7b069607af0`, XIVAPI `541c0c12e07da325`. It changes 1,118 existing lines, adds 50 lines, and removes none. Of the changed lines, 212 replace coffer-only sources, 855 resolve or omit coffer segments in mixed-source lines under the existing source-selection rules, and 51 expand the South Horn vendor location. The resulting table has 23,740 lines. There are still 65 mixed-source lines mentioning unresolved coffers, principally Shire accessory coffers; none has a coffer as its sole acquisition line.

Known facewear acquisition coverage increases from 36 to 39 styles, or 432 to 468 color variants. The newly filled unlocks are Teardrop Glasses, Antique Monocle, and Simple Oval Spectacles. All 61 styles / 732 variant links remain present.

## Data fixes

The [pinned quest file](https://github.com/ffxiv-teamcraft/ffxiv-teamcraft/blob/acc77d406cc50a78caf0210f805ec7b069607af0/libs/data/src/lib/json/quests.json) contains fixed coffer rewards absent from `quest-sources.json`. Reversing those rewards for referenced coffers recovers 26 quest coffers covering 145 of the original coffer-only lines. Twenty-five use the quest source. The four Endless Summer pieces instead list their current direct [online-store outfit](https://store.finalfantasyxiv.com/ffxivstore/en-us/product/578); this does not imply the retired event coffer is sold by the store.

For example, client Quest 70061, **A Gift from House Leveilleur**, has Item 37493, **Appointed Attire Coffer**, in its `Reward` array. Its five equipment pieces (36844–36848) now list the quest. The generator requests journal classifications for the recovered quest IDs, so seasonal quests remain excluded and regular quests retain the guide's Main Story Quest / Sidequest formatting.

Coffer purchase offers were previously excluded because only equippable products entered the normalized shop index. The build now includes sellers and currencies of referenced containers and retains coffer products in that index. The selection stage follows those offers through the existing festival, repurchase, token, currency and vendor-placement checks. Peacelover's five pieces now list **Enie - Ishgard - The Firmament (50 Fête Tokens)** instead of the coffer. Fixture generation retains coffer vendors and costs as well.

Recovered quests and reviewed random rewards still follow the guide's only-source rules. When a craft or vendor is available, the quest coffer segment disappears rather than adding a second route disallowed by the guide. No previously populated item becomes blank.

## Reviewed server-driven rewards

The small [coffer source table](../../../apps/api-worker/scripts/acquisition/tables/coffer-sources.json) covers rewards absent from the pinned source indexes:

- **Coffer o' Kupos**, **Hraesvelgr Attire Coffer**, and **Casual Attire Coffer** list **Lizbeth - Ishgard - The Firmament (Kupo of Fortune)**. These remain random sources and are retained only when no other source exists. The official [Ishgardian Restoration guide](https://na.finalfantasyxiv.com/lodestone/ishgardian_restoration/) identifies Lizbeth and the voucher minigame; the official database's [Coffer o' Kupos entry](https://na.finalfantasyxiv.com/lodestone/playguide/db/item/b4723627ec5/) and contemporary [Casual Coffer discussion](https://forum.square-enix.com/ffxiv/threads/433347-Kupo-of-Fortune-Coffers-should-be-able-to-be-bought-with-Skybuilder-Scrips?mode=threaded&p=5513013) corroborate the prize sources. These server-managed prize lists are reviewed mappings, not inferred client shop offers.
- Eight **Feast ranking coffers** list their historical Seasonal Quartermaster source at Wolves' Den Pier, with **No Longer Obtainable**. The official [archived Feast reward instructions](https://na.finalfantasyxiv.com/lodestone/ranking/thefeast/reward/5/solo/) explain the ranking vouchers and quartermaster exchange. Existing owners may retain rewards or vouchers; the line does not advertise a way to earn new Feast ranking rewards.
- **Loose Fit Attire Coffer** and **Air Cell Attire Coffer** list **PvP Series 7 / 9 - Level 25 (No Longer Obtainable)**. Client `PvPSeries` rows 7 and 9 both place the corresponding Items 44352 and 47224 in `LevelRewards[25].LevelRewardItem`. The pinned shops contain no current purchase offer for either original coffer. The official [7.4 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/06944d892fd98cc00b2a28ff77edbafa4f7eef54/) distinguish returning earlier series rewards, alternate Feast colors, and the limited previous-series claim window. Recolors are not treated as the original coffer.

These reviewed mappings should be checked again on the next patch refresh, especially if a retired series reward returns to a permanent shop.

## Vendor locations

Locations are keyed by `ENpcResident` ID rather than shared vendor name:

| Resident | Vendor / location | Effect |
| --- | --- | --- |
| 1059408 | Kornago Merchant - Central Shroud - Bentbranch Meadows | 37 previously blank equipment and facewear unlock lines |
| 1059485 | Expedition Antiquarian - The Occult Crescent: North Horn | 13 previously blank lines, including 12 vendor pieces from Tule, Torna and Carwen, and Simple Oval Spectacles |
| 1053614 | Expedition Antiquarian - The Occult Crescent: South Horn | 51 existing lines receive the full zone label, including all 15 Lix, Tycoon and Scherwiz pieces |

Kornago's location was supplied by the user and confirmed by the [official shop entry](https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/f0d33fbc392/) in Central Shroud at (21.9, 22.6). The North Horn resident has no position in the pinned NPC file; the user's distinct six-set inventories agree with its indexed shop products.

One earlier user pairing was reversed relative to the indexed equipment shops: shop 1770927 assigns base **Arcanaut** armor to the South Horn resident, while shop 1771027 assigns base **Phantom Vision** armor to the North Horn resident. Those data-backed assignments are preserved. Phantom Vision continues to use the existing **Phantom Gear & Weapons** acquisition saga rule; this change does not override the guide's relic classification. Only the vendor-sold members of the six glamour sets are attributed to the vendors; missing offers are not fabricated from a shared set name.

Validation: all 36 API/web dependency build, type-check, lint and test tasks passed, including 679 API tests and 3,127 web tests with their coverage thresholds intact. Web bundle budgets, 133 repository script tests, all 977 checked documentation links and 34 version claims passed. The PR records the commit-level secret scan.
