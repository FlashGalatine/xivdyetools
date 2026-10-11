# Web research acquisition repairs, round 2 — 2026-10-11

Status: Implemented in api-worker 0.18.1 (data only). Follows [round 1](web-source-repairs.md); the [README](README.md) inventories stay frozen to the 2026-10-08 snapshot.

## Scope: what the Glamour Reader actually shows blank

The table had 5,000 blank item rows after round 1, most of them retired, unused or starter rows. The Glamour Reader names a worn model family by its lowest eligible row and lets the player pick any visually identical twin, each with its own line. So the blanks that matter are families whose named piece is blank **and** where no twin has a line.

Grouping all 29,058 equippable rows by (slot column, `ModelMain`) under the resolver's retired-family rule gives 18,599 families. **914 non-retired items** were blank with no filled twin; the research covered all of them except the 61 level-1 Weathered starter pieces, plus the 7 facewear unlock items still blank (860 items in 359 clusters).

The 1,093-file `.chara` corpus weighted the work. Before this round, 2,045 of 10,901 worn gear slots resolved to a blank primary: 809 with no filled twin, 1,232 where a twin has a line, and 4 in retired families.

## Policy decisions (maintainer, 2026-10-11)

- Seasonal and collaboration event gear that is not on the Online Store reads `Event Name (YYYY)`: the event's own title and the year the piece was **first** offered. Store-listed pieces read `FFXIV Online Store`. Design decision D12 left these blank only because no data source carried the event and year; research supplies both.
- Past PvP Series rewards read `PvP Series Rewards`, as do `Veteran Rewards (X Days)` and `Moogle Treasure Trove`, whether or not still earnable. The three earlier `PvP Series N - Level N` lines (11 items) were converted.
- Currencies carry their complete canonical plural name (`280 Allagan Tomestones of Poetics`, never `280 Poetics`).
- Non-Augmented tomestone gear from Endwalker and older is no longer sold; its blanks are correct. When Evercold releases (2027), non-Augmented Bygone and Historia gear is expected to follow. Those lines come from shop data, so the next pinned refresh should drop them by itself.

## Method

1. **Research.** Ten Sonnet workers, one per theme (Valentione's / Little Ladies' / Hatching-tide; All Saints' Wake / Starlight / Heavensturn; Moonfire, collaborations and the Treasure Trove; quest rewards; Ceremony, job and level-50 weapons; two pre-2016 batches; mid-era; recent; level-100 duty sets). Each returned a line, kind, evidence URLs and confidence per item.
2. **Mechanical checks.** Exact client names; GPOSERS line shapes; duty, quest, achievement, FATE, NPC and place names against the pinned Teamcraft tables; currency names against the plurals the generator already writes (`Item.Plural`, title-cased by `pluralOf`).
3. **Official store catalog.** All 803 products on sale (read from the store's own catalog on 2026-10-11) with their "Purchase Includes" items. A store line was kept only for an exact item-name match, or for a piece sold inside an attire coffer whose client description names the set (the Werewolf chests and The Warden's Attire Coffer). This confirmed 300 researched store lines. It also found 14 more store pieces outside the research list: the women's summer sets.
4. **Quest data.** For every quest line, the pinned `quests.json` must list the piece among the quest's rewards, and the XIVAPI journal section must match the guide's Main Story Quest / Sidequest split. 67 of the 70 quests list the piece itself. Two reward an attire coffer whose client text names the set (Phantasmal, Beast Herder's). The Will to Live hands out the #55 disguise set during the quest, which was verified separately.
5. **Independent verification.** Three Opus verifiers re-checked every remaining claim against sources the researchers had not cited, mostly the official Lodestone: event pages, the Veteran Rewards and Eternal Bonding pages, expansion product pages, and the Eorzea Database "Obtained From" entry for each of the 175 Dawntrail duty pieces.

## Result

| Basis | Lines |
| --- | ---: |
| Official Online Store catalog | 314 |
| Pinned quest rewards (quest name, type and reward list) | 111 |
| Verified duty and Ceremony attire (Lodestone database / official pages) | 196 |
| Verified fixed programs (Veteran Rewards, Hall of the Novice, editions, Treasure Trove, Cosmic Fortune, PvP Series, Feast rankings, a Wolf Marks vendor) | 107 |
| Verified seasonal and collaboration events | 60 |
| **Total new lines** | **788** |

[round2-resolutions.csv](round2-resolutions.csv) lists every filled Item ID with its line, basis and primary evidence. The same pins now produce **24,907 lines** (was 24,119); 788 were added, 11 PvP lines reworded, none removed. Facewear covers **60 of 61 styles** (720 of 732 variants); only Thick-rimmed Goggles remains unknown.

Effect on what players see:

- Visible blanks with no filled twin: **914 → 146**. The rest are 61 Weathered starter pieces (by design) and 85 researched items without an acceptable source (below).
- Corpus wears with a blank primary and no filled twin: **809 → 33**. All blank-primary wears: 2,045 → 1,269. The remaining 1,232 are the twin-naming cases below.

## Judgment calls

- **Event titles.** Official Lodestone titles are used where the event has one: `Yo-kai Watch: Gather One, Gather All! (2016)`, the 2020 run for the four weapons added then, `The Maiden's Rhapsody (2015)`, `Breaking Brick Mountains (2014)`, `A Nocturne for Heroes (2019)`. The Fall Guys collaboration has no subtitle (its page is titled "FINAL FANTASY XIV & Fall Guys Collaboration"), so its pieces use the event's own name, `Blunderville (2023)`, the way the guide's example uses `The Path Infernal`.
- **Edition bonuses** name the edition the item first came with. The Complete Collector's Edition, still sold, also grants the six CE items; Helm of Light was reduced to `Final Fantasy XIV: A Realm Reborn Collector's Edition`, because the researcher's line joined it to a later edition.
- **Feast ranking rewards** (Lone/Pack Wolf, Eaglewing/Eaglebeak, Hellhound and Faehound earrings) are The Feast seasons 1 to 4, not Frontline. They use the table's existing house string `Seasonal Quartermaster - Wolves' Den Pier (The Feast Ranking Reward; No Longer Obtainable)`.
- **Occult Crescent "of Blood" accessories** read `The Occult Crescent: South Horn`. The 7.4 notes confirm South Horn drops; the North Horn half rests on one wiki and was left out.
- **`The Will to Live (Main Story Quest)`** for the #55 disguise set: the pieces are issued during that quest, and the Calamity Salvager sells them back under quest rewards.
- **Zero's Luminary Sollerets** (52659): the client name carries a trailing space. The reviewed entry pins that exact name; the store lists it in product 1165.

## Left blank (86 researched items, one of them the Thick-rimmed Goggles unlock)

[round2-left-blank.csv](round2-left-blank.csv) gives the reason for each. Open questions for the maintainer:

- **Off-sale collaboration store sets** (14): Realm-roamer's, En Fortune-teller's and Vibran Princess's left the store on 2026-06-01. Their set-mate 50262 already reads `FFXIV Online Store` from Teamcraft's Mog Station data.
- **No guide format:** the Mad Bird Ring (Jumbo Cactpot grand prize, still current), retainer-venture items (the Onion set and others), the Neophyte's Ring (Hall of the Novice, no role), and the Inferno and Crag Masks (2016 purchase promotions run in several regions).
- **Single-source or no source:** Archaeodemon Horns (Silver Happy Bunny coffers, one wiki), the Judge's set, contest prizes, and client rows the wikis call unreleased (Avalanche, Festival Neotunic, Botanist's and Fisher's Earrings).

## Found in passing: twin naming

The 1,232 corpus wears whose named piece is blank while an identical twin has a line are a resolver rule, not missing data. Examples are non-Augmented tomestone accessories named instead of their Augmented twins, and the invisible bracelet model (65589) named "Promise of Innocence" instead of The Emperor's New Bracelet. Both are filed as a separate task.

## Maintenance

Reviewed lines are manual research. Re-check them at each patch refresh: store listings change, events recur, and a PvP Series ends. Regeneration (`pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --pinned`) fails if a reviewed Item ID changes name.
