# Bluesky FFXIV census — local runs, 2026-10-11/12

Raw output of [`../scripts/bsky-ffxiv-census.mjs`](../scripts/bsky-ffxiv-census.mjs), run from an open network as [§5 of the README](../../README.md#5-measuring-bluesky-directly) asks. Unlike the cloud reports, these numbers come straight from Bluesky's own APIs (`primary`). They have not had an adversarial check yet.

## Files

| File | Mode | What it is |
|---|---|---|
| `20261011T1642Z-profiles.json` | `profiles` | Followers, follows and posts for the 4 official FFXIV accounts and 5 community accounts |
| `20261011T1654Z-tags-7d.json` | `tags 7` | Posts per day per hashtag, 2026-10-04 to 2026-10-10 UTC. Superseded by the next file; kept because its totals are the reproducibility check |
| `20261011T1658Z-tags-7d-union.json` | `tags 7` | The same window rerun with distinct posts across hashtags (`union`) and languages. Every per-tag total matched the first run exactly |
| `20261011T1706Z-starterpacks.json` | `starterpacks` | FFXIV starter packs with real member counts |
| `20261011T1706Z-feeds.json` | `feeds` | FFXIV feed generators with like counts |
| `20261012T0259Z-actors.json` | `actors` | Accounts whose profile names FFXIV, with follower bands and the top 50 |
| `20261012T0354Z-stream-na.json` | `stream 60` | The live NA-evening hour, 03:54–04:54 UTC on 2026-10-12. Its counts include posts Jetstream sent twice; the replay below has the corrected ones |
| `20261012T0354Z-stream-na.log` | `stream 60` | The same run's stderr: the 5-minute checkpoints and the three reconnects |
| `20261012T0354Z-stream-na-replay.json` | `stream 60 <start>` | The same hour replayed from Jetstream's log, each post counted once |
| `20261012T1602Z-stream-eu.json` | `stream 60` | The live EU-evening hour, 16:02–17:02 UTC. Counts include posts sent twice, like the NA live file |
| `20261012T1602Z-stream-eu.log` | `stream 60` | That run's stderr |
| `20261012T1602Z-stream-eu-replay.json` | `stream 60 <start>` | The EU hour replayed, each post counted once |
| `20261012T1547Z-focus.json` | `focus 200` | How much of each account's newest 200 feed items (or all of them, if fewer) is about FFXIV, for the 4 official and 6 community accounts, with samples. One business email in a bio was redacted after the run |
| `20261012T1547Z-focus-handcount-kaiyoko.tsv` | hand count | Every original Kaiyoko post (56), labelled `ffxiv`, `other` or `unclear` by an Opus verifier |
| `20261012T1547Z-focus-handcount-mrhappy1227.tsv` | hand count | The same for the 166 Mrhappy1227 originals in the `focus` window |
| `20261012T1605Z-focus-top50.json` | `focus 200 <actors file>` | The same count for the top 50 accounts of the `actors` run |
| `20261012T1605Z-focus-top50-verdicts.json` | review | The grade for each of those 50 and what it rests on: keyword share, the worker's verdict, and the hand counts and Fable ruling where there was one |

## Results

**Official accounts** (all four created 2025-05-15):

| Account | Followers | Posts |
|---|---:|---:|
| `en.finalfantasyxiv.com` | 100,568 | 1,072 |
| `jp.finalfantasyxiv.com` | 20,850 | 1,145 |
| `fr.finalfantasyxiv.com` | 3,751 | 1,440 |
| `de.finalfantasyxiv.com` | 3,119 | 824 |

The Japanese handle is `jp.`, not `ja.`. EN follows exactly four accounts: Square Enix and the other three.

**Hashtag volume, 2026-10-04 to 2026-10-10:**
- 7,062 distinct posts carried at least one of the 10 tracked hashtags: **about 1,009 a day**.
- The per-tag totals sum to 9,925, so 29% of tag counts are the same post under a second tag. 70% of posts (4,916) carry only one of the tags.
- Biggest tags per day: `#ffxiv` 398, `#ff14` 361, `#gpose` 307, `#gposers` 200. Each day sat within about 20% of its tag's average, with no event spikes.
- Languages (first declared): English 59.4%, Japanese 27.8%, none declared 5.4%, French 1.7%, German 1.7%. `#ff14` is 76% Japanese; `#ffxiv` is 74% English.

**Accounts:**
- **42,691 accounts** name FFXIV in their handle, display name or bio. This is a lower bound: see *Limits*.
- `ffxiv` and `ff14` find almost disjoint sets: the `ff14` search added 18,839 accounts that `ffxiv` had not.
- Follower bands: 1 account at 100k+ (the official EN account), 12 at 10k–100k, 769 at 1k–10k, 7,384 at 100–1k, 34,525 under 100.

**Starter packs:**
- 109 FFXIV packs. Members per pack: median 30, quartiles 17 and 63, range 8 to 1,050 ("FF14 gposers"). 16 packs have 100+ members.
- 6,230 member slots in total. One account can sit in many packs, so this is not a count of people.
- Only 19 accounts have ever joined Bluesky through any of these packs, and none in the past week. The counter appears to count sign-ups made through the pack, not follows (inferred from the app's label).

**Feeds:**
- 748 FFXIV feed generators, with 5,282 likes between them.
- Most are personal: 410 have no likes and 273 have 1–9. 65 have 10+, and 12 have 100+.
- Top five by likes: FFXIV After Dark 🔞 (561), Final Fantasy XIV (439), FFXIV Art (SFW) (366), XIV Question of the Day (352), FF14_unofficial (306).

**Live stream, two hours.** Every new post on the network, counted against the stream terms. The counts below come from replays of each hour with each post counted once. The live runs counted posts that Jetstream sent twice; see *Limits*.

| Hour (UTC, 2026-10-12) | Local time | New posts | Named FFXIV | Share | English | Japanese |
|---|---|---:|---:|---:|---:|---:|
| 03:54–04:54 (NA evening) | Sunday 20:54 in California, 23:54 in New York; Monday 12:54 in Tokyo | 134,992 | **121** | **0.090%** | 78 (64%) | 35 (29%) |
| 16:02–17:02 (EU evening) | Monday 17:02 in London, 18:02 in Berlin; Tuesday 01:02 in Tokyo | 139,973 | **113** | **0.081%** | 83 (73%) | 15 (13%) |

- **About 1 post in 1,100 to 1,200 names FFXIV,** in both hours. The FFXIV count per hour is steady: 121 and 113.
- **Languages follow the clock.** Japanese drops from 29% at Tokyo's lunchtime to 13% at Tokyo's 1 a.m. European languages stay small even in the European evening: 9 of the 113 posts (Spanish 2, Finnish 2, French 2, German, Italian and Dutch 1 each). The rest of the NA hour: none declared 5, Portuguese 2, Spanish 1. The rest of the EU hour: none declared 5, Korean 1.
- **Terms matched** (one post can match several): NA `ffxiv` 48, `gpose` 48, `ff14` 47, `eorzea` 4, `final fantasy xiv` 2, `エオルゼア` 2; EU `ffxiv` 61, `gpose` 42, `ff14` 30, `eorzea` 7, `final fantasy xiv` 3, `파판14` 1.
- **The replays are the same stream as the live runs.** Their raw counts, before removing re-sent copies, match the live totals within 9 posts (NA 156,584 vs 156,577; EU 147,136 vs 147,127), and the NA replay's first event is 0.06 seconds after its start. Jetstream still held both hours when they were replayed, at about 17:08 UTC the same day.
- **These are two hours, not a daily rate.** The hashtag count above averages 42 tagged posts an hour; these hours matched 121 and 113 by text. The gap has three causes: text matching finds posts with no hashtag; it finds hashtags outside the 10 tracked ones (`#lalaxiv` and `#ff14漣亭` appear in the samples), along with trending-hashtag bots; and an evening hour may not be typical.
- **The EU hour fell on a maintenance day.** Several sampled posts say the game's servers were down ("ffxiv is down for the day"); this is from the post text, not checked against the Lodestone.
- **The Japanese share in the NA hour (29%) is in line with the 7-day hashtag share (27.8%).** That day was a Japanese public holiday (Sports Day, the second Monday of October; from the holiday calendar, not checked here), and it shows no visible effect.

**Account focus** (the six community accounts, 2026-10-12). How much of each account's own Bluesky feed is about FFXIV, from the `focus` run, with a verdict from one Sonnet worker per account:

| Account | Bluesky followers | FFXIV share of its own posts | On Bluesky | Off Bluesky | Verdict |
|---|---:|---:|---|---|---|
| `gposers.org` | 2,048 | 98% (97 of 99) | Active, last post 2026-10-11 | An FFXIV screenshot community (its own site, `primary`) | Focused |
| `ffxivteamcraft.com` | 152 | 93% (14 of 15) | Lapsed, last post 2026-07-30 | An FFXIV crafting tool (its own bio, `primary`) | Focused |
| `kaiyoko.bsky.social` | 2,616 | 57% (31 of 54), hand count | **Dormant** since 2024-12-20 | FFXIV is the largest Twitch category over the past year: 43% of about 36 hours (SullyGnome, `secondary`) | Mostly, until it went quiet |
| `gamerescape.com` | 321 | 35% (27 of 78); 90% of reposts | Active, last post 2026-10-12 | A general games site with an FFXIV wiki and podcast (its own bio, `primary`) | Partly |
| `mrhappy1227.bsky.social` | 5,042 | 27% (39 of 146), hand count; 79% in 2026 (11 of 14) | Lapsed, last post 2026-06-15 | FFXIV-primary on Twitch: every snapshot in the week to 2026-10-12 was FFXIV (TwitchMetrics, `secondary`) | Partly |
| `zepla.bsky.social` | 977 | 23% (27 of 116) | Active, last post 2026-10-07 | An MMO streamer; recent posts are mostly World of Warcraft (`snippet`) | Partly |

- **Evidence grades** in the Off Bluesky column follow the research's labels. `primary` is the account's own site or bio. The two Twitch trackers (SullyGnome, TwitchMetrics) were read directly but are third-party pages, so `secondary`. `snippet` is a search result only.
- **How the share is counted.** FFXIV posts over original posts with text; image-only posts are left out, and replies and reposts are reported separately in the file. Grades: 80% and up *focused*, 50–80% *mostly*, 20–50% *partly*, under 20% *not*.
- **Calibration.** The official accounts, which post only about FFXIV, score 80% (EN), 93% (FR), 87% (DE) and 100% (JP) on the same count. Their misses are posts about an event or in-game activity that never name the game (PAX Australia, the Fan Festival, the Moogle Treasure Trove), and German wording the term list lacks ("Krieger des Lichts").
- **The keyword count undercounts creators.** Stream announcements name content, not the game: "Back to the FRU grind tonight", "I have indeed caught every fabled fish in Ocean Fishing". For the two accounts where that mattered, an Opus verifier read every original post and classified it by hand (the two `handcount` files): Kaiyoko rose from 46% to 57%, Mrhappy1227 from 13% to 27%. Both labels hold under any reading of the borderline posts (54–61% and 27–36%).
- **One verdict was overturned.** The Mrhappy1227 worker graded *mostly* from its 2026 sample; the hand count over the whole window gives *partly*, and *mostly* describes only the 16 posts made in 2026. Nothing went to Fable: the hand count settled it from the posts themselves.

What this means for README §2.2's ratio table:
- Only two of its five pairs are FFXIV-only accounts that are live on Bluesky: the official EN account and GPOSERS.
- Kaiyoko's Bluesky account has been silent for 22 months, so its 2,616 followers are an audience frozen at the end of 2024. Mrhappy1227 is an FFXIV creator whose Bluesky account is mostly about other things and has been quiet since June. Zepla's Bluesky posts are now mostly about other games.
- The 0.10 median ratio therefore rests on two clean pairs, and the X figures are still unverified.

**Top 50 accounts by followers** (2026-10-12). The same count, run on the 50 most-followed accounts from the `actors` file, the accounts whose own profile names FFXIV:

| Grade | Accounts | Their followers |
|---|---:|---:|
| Focused | 6 | 153,725 |
| Mostly | 4 | 28,479 |
| Partly | 10 | 84,510 |
| Not | 30 | 305,158 |

- **Only 10 of the 50 post mostly or only about FFXIV.**
  - Two are the official EN and JP accounts.
  - Three are FFXIV accounts by design: a lore account (`ffxivxd`), an FFXIV alt account (`jocatffxiv`), and a music-meme account dormant since 2025-05 (`fittingxivsongs`).
  - Five are artists whose work is mostly FFXIV: `benedictg`, `necromoss`, `itsmeishmi`, `idyllruin`, `greenbeannsfw`.
- **The other 40 are artists, streamers and personal accounts that name FFXIV in their bio among other interests.** 30 of them post almost nothing about it. 14 of the 47 reviewed accounts mainly post adult art or photos.
- **Some FFXIV activity lives on separate accounts.** Four artists' bios send their FFXIV work to another account (`nemgraphics`, `grisser`, `goblinicaart`, `shilin`), and those accounts are not in this top 50.
- **What it means for the account count.** The 42,691 figure and its follower bands count accounts that name FFXIV, not accounts about FFXIV. Among the most-followed, about one in five is an FFXIV account. This does not scale to all 42,691: smaller accounts were not checked.
- **How it was graded.**
  - The 47 accounts under 80% on the keyword count were graded by eight Sonnet workers from each account's samples, with one grade of adjustment allowed.
  - Workers flagged five accounts for a hand count and returned one more at low confidence. Opus verifiers read every original post for those six; each count is in the verdicts file.
  - The keyword count missed badly on the lore and alt accounts: 8.7% became 100%, and 31% became 98%. Eight of the 50 ended above their keyword grade.
  - One account (`greenbeannsfw`) could not be settled from text: most of its posts are uncaptioned images, and images were not inspected. Fable ruled it *focused*, because all 10 captions that name a subject are FFXIV and none names anything else.
  - The 30 *not* grades rest on the workers' reading of samples, not on hand counts.

## Corrections to the cloud reports

| Cloud report says | Census found |
|---|---|
| `en.finalfantasyxiv.com` "100,541": followers or follows? (README §4) | Followers: 100,568 against 4 follows |
| Official handles EN, FR, DE, **JA** | The Japanese handle is `jp.finalfantasyxiv.com` |
| "53+ FFXIV starter packs" (B1b) | 109 |
| Individual packs list 8–12 members (B1b, README §2.2) | 12 is the app's member *sample*. Real sizes for the packs B1b names: FFXIV BSKY Starter Pack 28, FFXIV DJs/Venues/Owners 41, FFXIV Creators, Communities & Collectives 17, FFXIV Gposers :) 91, Games Industry FFXIV Writers 25, For FFXIV players pack 9, FFXIV NPCs 78 |
| "The only volume figure is one Japanese feed, which claims 150+ posts a day" (README §2.2) | About 1,009 distinct hashtag posts a day across the 10 tracked tags, `#ff14` alone 361 |
| Feeds: no like counts retrievable (B1b) | 748 feeds with likes, above |
| GPOSERS 2,043 / Kaiyoko 2,612 / Zepla 959 Bluesky followers (B1a) | 2,048 / 2,616 / 977: the snippets were current to within 2% |
| Mrhappy1227, "FFXIV focus unconfirmed" (README §2.2, B1a) | FFXIV-primary on Twitch, but only 27% of their Bluesky posts are FFXIV and the account has been quiet since 2026-06-15 |
| The ratio table treats all five pairs as FFXIV accounts (README §2.2) | Two are: the official EN account and GPOSERS. Kaiyoko's Bluesky has been dormant since 2024-12-20, and Zepla's is 23% FFXIV |

The X side of B1a's ratio table is still unverified, so its 0.10 median ratio stands or falls with the X numbers.

## Limits

- **Relevance filter.** The search modes keep only results whose own text names FFXIV (the stream sampler's term list, NFKC-folded). It drops FFXIV players whose profile never says so: handles like `cressxiv` match the `ffxiv` search on "xiv" but are dropped. It also keeps accounts that mention FFXIV once, so it does not test FFXIV *focus*: the 42,691 are accounts that name FFXIV, not accounts about FFXIV. The focus checks above cover the six named community accounts and the top 50.
- **Jetstream sends some posts twice.** Its stored log holds bursts of re-sent posts: thousands of recent posts arrive again, each copy 30 seconds to 10 minutes after the first and stamped with the later time. The NA hour held four bursts (21,592 copies, 14% of raw events), the EU hour one (7,163, 5%). They sit near the dropped connections, but they are in the log itself, so any client reading the stream sees them. `stream` now counts each post once, by repo and record key; the live files predate that.
- **Hashtags only count hashtags.** Posts that mention FFXIV without one of the 10 tags are missed. The stream sample matches text too.
- **Search results are what Bluesky's index returns.** Posts or accounts hidden by moderation, or never indexed, are invisible to every mode.
- **No X comparison.** These modes have no X equivalent without the paid API.
- **`tags` needs a login.** Bluesky refused `searchPosts` without one (HTTP 403, 2026-10-11), so the script signs in with `BSKY_HANDLE` / `BSKY_APP_PASSWORD`. The app password used for these runs was revoked on 2026-10-12; a rerun needs a new one. Every other mode runs without a login.

## Script changes made during these runs

All uncommitted edits to `bsky-ffxiv-census.mjs`, in order:
1. `profiles`: added the FR, DE and JP official handles.
2. `tags`: distinct posts across tags (`union`), languages, and a check for a post repeated within one tag's pages (none were).
3. `actors`, `starterpacks`, `feeds`: the relevance filter above. The first, unfiltered `actors` run had 25 or more unrelated accounts in its top 50, because Bluesky's search splits `ファイナルファンタジー14` and matches any "14" ("14K" accounts, the 14th Amendment Center).
4. Every search pages until its cursor runs out, and records why it stopped. `actors` stops a term early once 20 pages in a row add fewer than 20 new relevant accounts. `feeds` had been cut off at 3 pages; `actors` at 4, then 30, while the `ffxiv` term alone runs 220 pages.
5. `starterpacks` fetches each pack with `getStarterPack`: search results carry no member count.
6. `stream` writes a checkpoint to stderr every 5 minutes, reconnects from Jetstream's cursor when the socket drops, and reports rates per hour of event time covered.
7. A new `focus` mode measures how much of each handle's own feed is about FFXIV. It uses a wider term list than the other modes (expansion names, races, "fashion report" and the like), records which term matched each post, and leaves image-only posts out of the share. `mrhappy1227.bsky.social` joins the handle list, since README §2.2's ratio table includes it; the `profiles` file above predates that.
8. `focus` can take an `actors` output file and check its top 50 instead of the handle list.
9. `stream` counts each post once, by repo and record key, and reports how many re-sent copies it skipped. Given a start time, it replays that hour from Jetstream's log instead of listening live. The search modes (`tags`, `actors`, `starterpacks`, `feeds`) are unaffected: their results are keyed by URI.

## Runs not kept

- **EU-evening stream, 2026-10-11 from 16:57 UTC.** Killed when the session ended, and the script printed nothing until the end. That is why change 6 added checkpoints.
- **First NA-evening stream, 2026-10-12 from 02:51 UTC.** Jetstream closed the socket after 15 minutes and the script did not reconnect, so the per-hour rates covered a quarter of the hour they claimed. Its share figure is usable: 26 FFXIV posts out of 41,206 (0.063%) in the 15.2 live minutes. Like the later live runs, its counts may include posts Jetstream sent twice. The kept run an hour later reconnected three times and covered the full hour.
- **Unfiltered and page-capped `actors`, `starterpacks` and `feeds` runs**, replaced by the files above.

## Still to run

- `stream 60` in the JP evening (about 11:00–14:00 UTC). The NA and EU hours are done. Run it live, then replay the same hour (`stream 60 <start>`) while Jetstream still holds it, and keep the replay's counts.
- Record X follower counts by hand for the same accounts (README §5). Check that each X figure comes from the same persona: GPOSERS posts on X as `GPOSERS_FFXIV`.
- The focus check stops at the top 50 accounts by followers. Smaller accounts are unchecked.
