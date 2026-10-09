# Web research acquisition repairs — 2026-10-09

Status: Implemented on PR [#278](https://github.com/FlashGalatine/xivdyetools/pull/278). Three independent web-search agents researched relic upgrades, facewear, and recent glamour/PvP rewards. The coordinator checked the findings against pinned client/shop data, retained supported routes, and regenerated the table.

## Result

The same Teamcraft `acc77d406cc50a78caf0210f805ec7b069607af0` and XIVAPI `541c0c12e07da325` pins now produce **24,119 acquisition lines**, filling **379 previous blanks**. No existing line changes or disappears. [web-resolutions.csv](web-resolutions.csv) records every newly filled Item ID, name, category and line.

| Repair | New lines |
| --- | ---: |
| Anemos weapon/shield and armor upgrades | 273 |
| Cosmic v1.1/v1.2 tools | 22 |
| Commendation Quartermaster exchanges | 43 |
| Ose Wyd: Fuath attire and First Light accessories | 9 |
| Mica outfits | 5 |
| Original Alternative, Yozakura's and Graffiti store pieces | 12 |
| Facewear unlock items | 15 |
| **Total** | **379** |

**5,000 blank item/unlock rows remain**: 4,993 equipment rows and seven facewear unlocks. Of those blanks, 750 have collected sources that still do not yield a line, and 4,250 lack indexed sources. These include obsolete, unused and unreleased client records; they are not all obtainable gear.

Facewear coverage is now **54 / 61 styles**, representing **648 / 732 variants**. The seven unfilled styles represent 84 variants.

## Relic membership

The official [4.25 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/5ad19879fc01a5d878af9a7f90f29e4a2394c5b4/) identify Gerolt's Anemos weapon and gear enhancement and list the relevant equipment stages. Pinned unnamed shops 1769820–1769834 contain 48 weapon/shield stages (Items 21942–21989) and 225 armor stages (22006–22230). These lacked the names and vendor placement needed by the earlier saga matcher. Their exact IDs now belong to **Eureka Gear & Weapons**; Antiquated originals and unrelated Zeta weapons are not added.

The official [7.51 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/c46881a31a2c90d0965493c921b434eca09113f8/) connect further Cosmic tool enhancement to stellar missions and Researchingway. Its [new-item list](https://na.finalfantasyxiv.com/lodestone/topics/detail/f2e3faea7dd6fecf3f1b66a2a4c30892684d2938) contains all 22 v1.1/v1.2 tools (51756–51777). The existing Hyper tool expression now accepts those two suffixes while retaining Cross-pein, Raising, Round and Fishing prefixes and restricting membership to tool categories.

## Vendor repairs

SpecialShop **1770684** omitted its NPC connection. The resident is **1043099**, Commendation Quartermaster, whose pinned record has a valid map51 position (4.56, 6.29). The [official current shop](https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/cfe634889ba/) and [6.48 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/77ced00c8fc9b818f7a31b9925162a7007bf7882/) confirm Wolves' Den Pier. Restoring this exact missing connection fills 43 equipment exchanges, including ten Shadowhound/Black Shuck pieces. All prices and any required base weapons come from the pinned offers; augmented Hellhound weapon lines retain their base equipment costs. The repair preserves an existing NPC attachment if upstream supplies one later.

The official [7.35 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/9d2cad7a1028016719060b5ae3caeb5e369c89e9/) place **Ose Wyd** in Il Mheg at (29.9, 5.9). Pinned Item **46263**, First Light Relic, explicitly names **Wolekdorf** in its description. Resident1054944 now has that zone and settlement. Five Fuath pieces cost ten Illumed Aetherpool Glass each; four First Light accessories cost two Illumed Invocations each. These remain vendor purchases, distinct from the weapon family's Pilgrim's Traverse line.

**Mica Magicog** was wrongly registered as an unknown high-end duty token. Its pinned FATE source is Mascot Murder and its shops already identify Uah'shepya in Solution Nine. Removing it from `duty-tokens.json` restores the existing vendor/currency rule: Mica Head costs four Magicogs, Mica Suit six, and the three Mica Neotunic fits two each. Pinned SpecialShop1770885 supplies those products and prices. No raid duty is assigned to this FATE currency.

## Reviewed item sources

The [reviewed source table](../../../apps/api-worker/scripts/acquisition/tables/reviewed-item-sources.json) stores 27 exact Item IDs, their client names, acquisition lines and evidence URLs. Regeneration fails if a reviewed ID's name changes. These routes are manual research additions alongside the pinned indexed sources; source availability should be reviewed again on each patch refresh.

Current store listings support four [Yozakura's pieces](https://store.finalfantasyxiv.com/ffxivstore/en-us/product/1171), five pieces of the [original Alternative outfit](https://store.finalfantasyxiv.com/ffxivstore/en-us/product/1103), and three Graffiti Neotunic fits. The official [Graffiti release announcement](https://na.finalfantasyxiv.com/lodestone/topics/detail/334099e1c89b2c20536b1ca267799c47915d7d4d) identifies the three-piece set, which remains listed on the current store. Its promotion end date was not treated as an item expiration. The original Alternative product is not extended to the newer Alternative Dress equipment.

Facewear sources use exact, individually researched unlock names:

| Unlock style | Line | Evidence basis |
| --- | --- | --- |
| Mythril-edged Eyepatch (Right) | Subaquatic Voyages | Same-name FFXIV Collect and community-wiki reward records |
| Tinted Goggles | Subaquatic Voyages | Same-name community reward records |
| Blindfold Eyepatch (Left / Right) | Subaquatic Voyages | Each side checked separately in community reward records |
| Sash Blinder (Left / Right) | Subaquatic Voyages | Each side checked separately in community reward records |
| Studded Eyepatch (Left / Right) | Subaquatic Voyages | Each side checked separately in community reward records |
| Scaevan Headgear | Cosmic Fortune - Phaenna | Same-name community reward records |
| Tinted Sunglasses | Cosmic Fortune - Sinus Ardorum | Same-name community reward records |
| Holospecs / Holovisor | Cosmic Fortune - Oizys | Each style checked separately in community reward records |
| Wrap-around Sunglasses | Cosmic Fortune - Auxesia | Same-name community reward records |
| Professorial Glasses | Cenote Ja Ja Gural / Vault Oneiron | Same-name community treasure-dungeon reward records |
| Half-rim Spectacles | PvP Series 12 - Level 5 | Official active series announcement plus pinned client reward link |

For the community-backed loot routes, official pages establish item identity and content context, but do **not** expose the exact loot table. The report does not claim primary-source confirmation of those routes. [FFXIV Collect](https://ffxivcollect.com/facewear) and matching community-wiki records agree on the exact styles; their individual URLs are retained in the reviewed table. Voyage lines keep the guide's existing **Subaquatic Voyages** format. No source was inferred solely from an opposite-side eyepatch or a similar item name.

Pinned `PvPSeries` row12 directly links Item **52448**, The Faces We Wear - Half-rim Spectacles, in `LevelRewards[5].LevelRewardItem`. The [official Series12 announcement](https://na.finalfantasyxiv.com/lodestone/topics/detail/530c8d8b31d2a6d092de132e1b57645645d89343) corroborates current availability. This is time limited and requires review when the series changes.

## Deliberate exclusions

- All six Eggy/Spriggan/Chicken/Blooming facewear unlocks (50308–50313) came from [Hatching-tide 2026](https://na.finalfantasyxiv.com/lodestone/special/2026/Hatching_tide/wgtbl3kgc5), which ended April6. No permanent store listing was found; expired seasonal-shop sources remain excluded.
- Thick-rimmed Goggles (52447) has no confirmed source. Missing source and 0% recorded ownership are clues, not proof the item is unused. It remains unresolved.
- Rule-breaker's five pieces (52397–52401) were Series11 rewards. The official [7.56 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/a8a526ad64db45c8ca8d1c7fdcce8a5eedaa18bc/) ended Series11. Previously earned rewards may still be claimed during Series12, which is not a new earning route.
- New Alternative Dress pieces (52413–52417) and Festival Neotunic fits (52436–52438) lack confirmed current availability. An active listing for a similar outfit does not establish their source.
- Cosmic Operator's four pieces (52424–52427) have a community-reported Auxesia Fortune coffer route, but the exact prize connection was not corroborated enough in this pass. They remain candidates for further reward-table research.

Validation: all 36 API/web dependency build, type-check, lint and test tasks passed, including 682 API tests and 3,127 web tests with coverage thresholds intact. Bundle budgets, all 133 repository script tests, 980 documentation links, 34 version claims, dead-code and worker-log configuration gates passed. The PR records the commit-level secret scan.
