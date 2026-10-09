# Acquisition gap review — 2026-10-08

Status: Review complete. The inventory below records the pre-repair snapshot; see [confirmed repairs](confirmed-repairs.md) and [coffer/vendor repairs](coffer-repairs.md) for subsequent work.

## Scope and evidence

Audited the acquisition generator and regenerated its intermediate source/selection results using the production pins: Teamcraft `acc77d406cc50a78caf0210f805ec7b069607af0`, XIVAPI game version `541c0c12e07da325`, schema `exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb`. All resulting lines matched the committed table. Production data was not rewritten.

This measures coverage across the eligible client item rows, not the percentage of currently obtainable glamour items. The input includes tools, soul crystals and potentially obsolete or unused gear. A filled line also does not establish that every alternative acquisition route is present. This review identifies systematic gaps and concrete examples; it does not independently verify all 23,621 filled lines.

| Measure | Count |
| --- | ---: |
| Equipment rows | 29,058 |
| Facewear unlock items | 61 |
| Combined item rows | 29,119 |
| Filled acquisition lines | 23,621 |
| Blank acquisition lines | 5,498 |
| Blanks with no collected source | 4,299 |
| Blanks with collected sources | 1,199 |
| Facewear styles filled / blank | 36 / 25 |
| Facewear variants filled / blank | 432 / 300 |

The 1,199 blanks with collected sources include 687 affected by missing or unusable vendor placement, 602 with excluded repurchase offers, 167 with excluded seasonal offers, 27 with unmapped tokens and three with unresolved duty names. These reason counts overlap and must not be added together. No blank is caused solely by unknown currency decoding in this snapshot, although that decoder omission can remove additional routes from populated lines.

## Recommended repair order

1. **Fix token classification and mappings: 27 items.** `duty-tokens.json` has empty mappings for Mad Harlequin's Totem and Mica Magicog. The 22 Palazzo Diamond weapons should resolve to **Dancing Mad (Ultimate)**; the duty already exists in pinned Teamcraft data as instance 30162. Official [7.51 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/c46881a31a2c90d0965493c921b434eca09113f8/) explicitly connect its completion reward to these weapons. Mica Magicog is a FATE reward (pinned `fate-sources.json` links it to Fate 1922, Mascot Murder), so it does not belong in the high-end duty-token table. Its entry currently blocks Mica Head, Mica Suit and three Mica Neotunic sizes, even though Uah'shepya's Solution Nine shop and prices are available.

2. **Supply verified vendor locations and shop links.** Three named, unplaced vendors account for 103 blank items: Ose Wyd (53, including First Light weapons), Kornago merchant (37, including two facewear unlocks), and expedition antiquarian (13, including Simple Oval Spectacles and Tule/Torna/Carwen gear). The [official 7.56 notes](https://na.finalfantasyxiv.com/lodestone/topics/detail/a8a526ad64db45c8ca8d1c7fdcce8a5eedaa18bc/) place the Kornago merchant in Central Shroud; the pinned shop offers price Teardrop Glasses and Antique Monocle at 100 Faded Remnants of Resilience each. Simple Oval Spectacles cost 40 Arcane Amulets in the pinned antiquarian shop. Verify the other vendors' locations and any settlement label before adding lines. Separately, 516 vendor-blocked blanks have at least one offer without an NPC link; these overlap other groups and include obsolete shops. Notable research candidates include Makai gear and Commendation Crystal exchanges, including Shadowhound/Black Shuck equipment.

3. **Expand relic-family matching.** 273 blank items occur in unnamed shop IDs 1769820–1769834, including Galatyn, Sudarshana Chakra and their upgrade stages. These are candidates for Eureka saga coverage: existing rules depend on recognizable names or placed Eureka vendors, which these records lack. Verify each shop's item family before assigning the saga. Another 22 blank tools have `v1.1`/`v1.2` suffixes, such as Hypersaw v1.1; the current Cosmic tool expression ends immediately after the Hyper name and does not match those versions. Official [7.51 item additions](https://na.finalfantasyxiv.com/lodestone/topics/detail/f2e3faea7dd6fecf3f1b66a2a4c30892684d2938) include those tool versions.

4. **Resolve three invalid duty references.** Templar's Chain Coif selects duty IDs -50 and 13; 13 has the valid name Dzemael Darkhold, but -50 has no name, so the formatter suppresses the entire line. Great Shin-Zantetsuken and Shin-Zantetsuken select -524, also absent from the instance table. Determine what these source IDs represent; taking the absolute value is unsafe (-50 would become Shisui of the Violet Tides).

5. **Follow coffers to their actual acquisition route.** 249 item lines contain one of 48 attire/costume coffer labels; 160 show only that coffer. Examples include Antiquated level-70 job sets, Red/Magus/True Blue sets, Scion Traveler, Appointed, Peacelover, Hraesvelgr and Casual attire. These are not blank, but still need the quest, reward system, vendor or other route that supplies the coffer. The generator currently follows a coffer to Online Store, duty or quest data when available, but does not follow its vendor, achievement or other source types. Verify each family and preserve the existing random-container rules. Coffer labels with another valid route are lower priority. Peacelover's coffer already has Enie shop links in the pinned data, while Cashmere's Faux Leaf shop lacks an NPC link.

6. **Research remaining source-less items, starting with current facewear and recent glamour sets.** The 4,299 rows without collected sources require obtainable/obsolete/unused classification before they can become a repair count. Recent examples include Rule-breaker's, Yozakura's, Alternative, Cosmic Operator's and Graffiti/Festival Neotunic items. Their names alone do not prove a source or current availability. Check client reward links, current Online Store listings, voyages, quests, PvP/event rewards and achievement mail as appropriate.

## Facewear backlog

All 61 real styles are linked to their unlock item and all 12 color variants; the remaining gap is the unlock item's acquisition source.

- **Three vendor-placement gaps:** Teardrop Glasses, Antique Monocle, Simple Oval Spectacles. These should be filled after verifying vendor placement.
- **Seventeen source-less unlocks:** Mythril-edged Eyepatch (Right), Scaevan Headgear, Professorial Glasses, Tinted Goggles, Tinted Sunglasses, Party Eggy Eyeglasses, Holospecs, Blindfold Eyepatch (Left/Right), Holovisor, Sash Blinder (Left/Right), Studded Eyepatch (Left/Right), Thick-rimmed Goggles, Half-rim Spectacles, Wrap-around Sunglasses. Their acquisition sources require research; do not infer a source from the opposite-side item or a similar name.
- **Five deliberately excluded seasonal-shop sources:** Painted Eggy Eyeglasses, Slim Frame Eggy Eyeglasses, Spriggan Eyeglasses, Chicken Eyeglasses, Blooming Eyeglasses. Under current rules those offers remain omitted. A verified permanent route, such as an Online Store listing, can still be added separately.

## Intentional omissions and follow-up checks

Do not fill blank lines using Calamity/journeyman/recompense repurchase shops or expired seasonal shops. Instead, identify the original or a currently available permanent acquisition route. Quest, random-container, deep-dungeon and desynthesis routes also have existing “only source” restrictions. Missing or uncertain information remains blank.

Additional-route review should include the 755 unknown-cost offer removals recorded in build metadata (`SpecialShop.UseCurrencyType` 16 decoding), even though those did not leave any item entirely blank here. Metadata counts are source-removal events, not unique missing items. The printed relic-name heuristic also has false positives such as Diamond Zeta raid weapons and Manderville clothing; it is not a reliable backlog on its own.

## Inventories

- [All 5,498 blank item rows](blank-items.csv), with category, known source types, omission reasons, shop names and NPC IDs.
- [All 249 item/coffer lines](coffer-lines.csv), identifying whether the coffer is the only listed route.
- [All 25 blank facewear unlocks](facewear-table.md), with their source/omission classification.

These inventories are frozen to the pins above. A future source refresh should produce a diff before repairs are applied; it may resolve some gaps upstream.
