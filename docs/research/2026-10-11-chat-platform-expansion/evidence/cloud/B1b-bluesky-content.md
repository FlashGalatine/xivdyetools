> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# FFXIV on Bluesky vs X: content and community measures (as of 2026-10-11)

## Bottom line
I found no hard measurement of FFXIV post volume on either platform. No hashtag tracker, survey or academic dataset covers #FFXIV, #FF14 or #GPOSE per day, and the search tool could only see snippets of bsky.app, directory and tracker pages (direct fetch failed). What exists is a set of directory counts, one official-account figure and a clear paper trail of FFXIV community presence on Bluesky. The platform-level numbers show Bluesky is shrinking. Nothing found shows that English-speaking FFXIV players post more on Bluesky than on X. The observation stays anecdotal and I found nothing to confirm or refute it.

## 1. Custom feeds
- "FFXIV GPose Feed" by Drakon (@drakon.bsky.social) parses posts tagged #GPose, #GPosers, #EorzeaPhotos and #FFXIVScreenshots [1][2]. No like count or posts-per-day figure surfaced.
- A goodfeeds Track feed ("FF XIV") follows the terms "Final fantasy xiv", "Ffxiv" and "FF XIV" [3][4]. No stats found.
- Other named feeds in a community guide and search results: an FFXIV general feed, NSFW and SFW gpose feeds, "FFXIV After Dark" (NSFW gpose/art/prose), "FFXIV stuff", "FFXIV Art (+NSFW)", a Question-of-the-Day feed, an FFXIV Roleplay feed [1][5][6]. The guide itself says some feeds have been deleted and that it is partly outdated [1]. I found no "FFXIV Snaps" feed under that name. GPOSERS also runs a #GPOSERS feed [7].
- Like counts and posts per day were not available for any English feed.
- Japanese: "FF14_unofficial" (Skyfeed-built, filters out inflammatory posts) is described by its author as catching 150+ posts per day [8]. That is the only posts-per-day figure I found, and it is the author's own claim. "ff14txt" shows text-only posts, dropping screenshots, friend recruiting and similar [8][9]. The same article says feeds are more active than starter packs in Japan [8].

## 2. Starter packs
- blueskystarterpack.com's FFXIV hub titles itself "53+ Lists, Jun 2026"; its gpose hub says "10+ Lists, Nov 2025" [10][11]. These count packs, not members.
- Individual FFXIV packs show small rosters: 12 members each for "FFXIV BSKY Starter Pack" (Dec 2024), "FFXIV DJs/Venues/Owners" (Jan 2026), "FFXIV Creators, Communities & Collectives" (Oct 2024) and "FFXIV Gposers :)" (Nov 2024); 11 for "Games Industry FFXIV Writers" (Feb 2025); 8 for "For FFXIV players pack" [12][13][14]. A Bluesky Directory copy of a pack similar to "FFXIV NPCs" lists 70 members [12].
- No "joined" counts (people who signed up via a pack) were visible in any snippet.

## 3. Hashtag and post volume
- No tracker covering #FFXIV, #FF14, #GPOSE, #FFXIVSnaps or #FFXIVRP on either platform turned up. X offers no public hashtag analytics.
- A mackuba gist ranks Bluesky hashtags over a 30-day window. The search tool reported #FFXIV at 1,488 posts (8th) in one reading and #FF14 at 628 in another; the two readings do not reconcile [15]. The page metadata dates the gist about 1,129 days back, roughly September 2023, when Bluesky was far smaller. Treat both numbers as unverified and stale.
- Live tools that could answer this if queried directly: bluefacts.app/tags and bskyinfo.com hashtag tracker [16][17]. I could not query them.
- Cheapest route to real numbers: use the public search API or Jetstream from a machine with open network access and count posts with the target tags over a week.

## 4. Migration evidence
- Anecdotal and structural, not measured:
  - Square Enix launched four official FFXIV Bluesky accounts (EN, FR, DE, JA) and said they complement, not replace, other channels [18][19].
  - A Sept 2025 forum thread asked for Bluesky parity with X: no Lodestone icon, and a giveaway requiring an X account. No staff reply appeared in the results [20].
  - GPOSERS lists Bluesky alongside Discord, X and Instagram and credits winners' Bluesky handles [7][21]. Many gpose creators list both platforms rather than leaving X [22].
  - A community carrd guide for "the FFXIV twitter community" exists [1]. A Japanese forum post from 2-3 years ago said FFXIV users were flowing to Bluesky after X's terms change [23].
- No Reddit threads (r/ffxiv, r/ffxivglamours, r/BlueskySocial) or polls on where players post screenshots surfaced. That is a search limitation as much as evidence of absence.
- Counter-evidence: no survey, but one Japanese blogger reports Bluesky had few people and was only an occasional visit [23].

## 5. Japanese FF14 community
- No FF14-specific Japanese numbers. Platform-level: Japan is about 5.15% (Aug 2026) to 6.03% (Mar 2026) of bsky.app web traffic by Similarweb, and a CEO remark places it among the top three markets by users [24]. One Japanese article claiming about 18% is an outlier with no method [24].
- The 150+/day figure for FF14_unofficial [8] is small next to X volume, but X volume for FF14 is also unmeasured here.

## 6. Platform health
- Similarweb via TechCrunch (2026-08-11): 10.4M mobile MAU in June 2026, down 27.2% year on year; about 3M mobile DAU in July, down 25.6%; X at about 302M MAU [25][26]. Q4 2024 average about 22.1M vs Q2 2026 about 10.7M, roughly -52% [26].
- Daily posters: a former Bluesky engineering lead told CNBC daily posters fell from 1.4M (late 2024) to about 600K in mid-2026 [27]; a stats tracker counted 571,860 unique posters on 2026-09-25 [27].
- Registered accounts about 46M (Aug 2026), which does not measure activity [28].
- Since 2026-10-04: only the 2026-10-06 .bsky domain application news [29]. No new usage figures.

## Computed ratios (inputs shown)
- Official EN FFXIV accounts: X @FF_XIV_EN about 652.6K followers (undated snippet) [30]; Bluesky en.finalfantasyxiv.com about 100.5K (snippet says "follows", likely followers, unverified) [31]. 100.5/652.6 is about 15%. Different dates, so rough.
- Mobile MAU: 10.4M / 302M is about 3.4% [25].

## Caveats
Everything above comes from search snippets, not primary pages. Verify directly on bsky.app before citing.

## Sources
[1] https://ffxivtobluesky.carrd.co/
[2] https://bsky.app/profile/did:plc:vigxa24owwfxyoe5nnweh7i4/feed/aaaloec77deck
[3] https://track.goodfeeds.co/
[4] https://bsky.app/profile/did:plc:lyrmsmhhg7vzz4ghj44y5xzq/feed/43327cd81dc9
[5] https://bsky.app/profile/did:plc:ir4xyboxl2yer3nhq5cgcj32/feed/aaalms5q4svei
[6] https://bsky.app/profile/did:plc:4yr2a4bhxomer7mzpenxf53r/feed/aaacgkwre64sy
[7] https://bsky.app/profile/gposers.org
[8] https://note.com/amanatsu_mikan/n/n7d30c28bf2bb
[9] http://llllll.blue/bluesky/
[10] https://blueskystarterpack.com/ffxiv
[11] https://blueskystarterpack.com/gpose
[12] https://blueskydirectory.com/starter-packs/a/20776-ffxiv-npcs
[13] https://blueskystarterpack.com/starter-packs/@vierawifexiv.bsky.social/ffxiv-gposers-3lc2nbrze6s2r
[14] https://blueskydirectory.com/starter-packs/a/324537-for-ffxiv-players-pack
[15] https://gist.github.com/mackuba/43751fa3facc5893fd0602d146e2aea6
[16] https://bluefacts.app/tags
[17] https://www.bskyinfo.com/tools/bluesky-hashtags/
[18] https://www.siliconera.com/new-ffxiv-social-media-account-opens-on-bluesky/
[19] https://na.finalfantasyxiv.com/lodestone/topics/detail/8ea3fc2cdc8183bd9b7dfa37261dc7976afe527a
[20] https://forum.square-enix.com/ffxiv/threads/522344
[21] https://www.tumblr.com/gposers
[22] https://viottostudio.carrd.co/
[23] https://forum.square-enix.com/ffxiv/threads/511643
[24] https://adamconnell.me/bluesky-statistics/ and https://www.socialpilot.co/blog/bluesky-statistics (search-result summary of Similarweb country shares)
[25] https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/
[26] https://gigazine.net/gsc_news/en/20260812-blueskys-active-user/
[27] https://www.cnbc.com/2026/06/04/bluesky-twitter-rival-reddit-social-media.html
[28] https://en.wikipedia.org/wiki/Bluesky
[29] https://techcrunch.com/2026/10/06/bluesky-wants-to-give-you-your-own-domain-on-the-open-web
[30] https://x.com/ff_xiv_en
[31] https://bsky.app/profile/en.finalfantasyxiv.com


## Numbers (structured)

| Subject | Platform | Metric | Value | As of | Confidence | Source |
|---|---|---|---|---|---|---|
| Bluesky mobile MAU worldwide | bluesky | MAU | 10.4M, -27.2% YoY | 2026-06 | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| Bluesky mobile DAU | bluesky | DAU | about 3M, -25.6% YoY | 2026-07 | secondary | https://gigazine.net/gsc_news/en/20260812-blueskys-active-user/ |
| X mobile MAU | x | MAU | about 302M | 2026-06 | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| Bluesky unique accounts posting in a day | bluesky | daily posters | 571,860 | 2026-09-25 | snippet | https://www.cnbc.com/2026/06/04/bluesky-twitter-rival-reddit-social-media.html |
| Bluesky daily posters peak vs mid-2026 | bluesky | daily posters | 1.4M (late 2024) to about 600K (mid-2026) | 2026-06 | snippet | https://www.cnbc.com/2026/06/04/bluesky-twitter-rival-reddit-social-media.html |
| Bluesky registered accounts | bluesky | registered users | about 46M | 2026-08-16 | secondary | https://en.wikipedia.org/wiki/Bluesky |
| Japan share of bsky.app web traffic | bluesky | traffic share | 5.15% (Aug 2026), 6.03% (Mar 2026) | 2026-08 | snippet | https://adamconnell.me/bluesky-statistics/ |
| en.finalfantasyxiv.com (official EN) | bluesky | followers (labeled 'follows') | about 100,541 | 2026-10 (snapshot) | snippet | https://bsky.app/profile/en.finalfantasyxiv.com |
| @FF_XIV_EN (official EN) | x | followers | about 652.6K | undated | snippet | https://x.com/ff_xiv_en |
| Official EN Bluesky / X follower ratio | other | computed ratio | 100.5K / 652.6K = about 15% (dates differ) | 2026-10 | computed | https://bsky.app/profile/en.finalfantasyxiv.com |
| Unofficial finalfantasyxiv.bsky.social | bluesky | followers | about 3,089 | 2026-10 (snapshot) | snippet | https://bsky.app/profile/finalfantasyxiv.bsky.social |
| GPOSERS @gposers.org | bluesky | followers | about 2,048 | undated snapshot | snippet | https://bsky.app/profile/gposers.org |
| FFXIV starter packs on blueskystarterpack.com | bluesky | pack count | 53+ | 2026-06 | snippet | https://blueskystarterpack.com/ffxiv |
| Gpose starter packs on blueskystarterpack.com | bluesky | pack count | 10+ | 2025-11 | snippet | https://blueskystarterpack.com/gpose |
| Individual FFXIV starter packs | bluesky | members per pack | 8 to 12 (one directory copy: 70) | various 2024-2026 | snippet | https://blueskystarterpack.com/starter-packs/@cinderpixel.bsky.social/ffxiv-bsky-starter-pack-3lblbxgtjfd24 |
| FF14_unofficial JP feed | bluesky | posts per day (author claim) | 150+ | undated | snippet | https://note.com/amanatsu_mikan/n/n7d30c28bf2bb |
| #FFXIV / #FF14 in mackuba hashtag gist | bluesky | posts in 30 days | 1,488 (#FFXIV) or 628 (#FF14); readings conflict | about 2023-09 (stale) | unverified | https://gist.github.com/mackuba/43751fa3facc5893fd0602d146e2aea6 |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | No hashtag tracker, survey or dataset measuring FFXIV/FF14/GPOSE post volume per day on Bluesky or X was found. | unverified | https://gist.github.com/mackuba/43751fa3facc5893fd0602d146e2aea6 |  |
| C2 | FFXIV GPose Feed by Drakon collects #GPose, #GPosers, #EorzeaPhotos, #FFXIVScreenshots; no like or daily-volume figure found. | snippet | https://bsky.app/profile/did:plc:vigxa24owwfxyoe5nnweh7i4/feed/aaaloec77deck |  |
| C3 | Japanese feed FF14_unofficial is described by its author as catching 150+ posts per day. | snippet | https://note.com/amanatsu_mikan/n/n7d30c28bf2bb |  |
| C4 | blueskystarterpack.com lists 53+ FFXIV packs (Jun 2026) and 10+ gpose packs (Nov 2025); individual FFXIV packs hold 8 to 12 members, one directory copy lists 70. | snippet | https://blueskystarterpack.com/ffxiv |  |
| C5 | Square Enix runs four official FFXIV Bluesky accounts (EN, FR, DE, JA); a Sept 2025 forum thread complained of no Lodestone link and an X-only giveaway. | secondary | https://www.siliconera.com/new-ffxiv-social-media-account-opens-on-bluesky/ |  |
| C6 | Official EN Bluesky account shows about 100.5K (labeled follows, likely followers) vs X @FF_XIV_EN about 652.6K, undated; ratio about 15%. | snippet | https://bsky.app/profile/en.finalfantasyxiv.com |  |
| C7 | Bluesky mobile MAU 10.4M in June 2026 (-27.2% YoY), mobile DAU about 3M in July 2026 (-25.6%); X about 302M MAU. | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |  |
| C8 | Daily posters fell from 1.4M (late 2024) to about 600K mid-2026; tracker counted 571,860 posters on 2026-09-25. | snippet | https://www.cnbc.com/2026/06/04/bluesky-twitter-rival-reddit-social-media.html |  |
| C9 | Japan is about 5-6% of bsky.app web traffic per Similarweb figures; a Japanese article claiming 18% is an outlier. | snippet | https://www.socialpilot.co/blog/bluesky-statistics |  |
| C10 | No Reddit threads or polls on where FFXIV players post screenshots surfaced; evidence of migration is structural and anecdotal, many gpose creators keep both X and Bluesky. | snippet | https://viottostudio.carrd.co/ |  |


## Conclusions

- No public measurement of FFXIV hashtag or post volume exists on either platform that I could find; the maintainer's observation cannot be confirmed or refuted from public data.
- Bluesky is shrinking: mobile MAU about 10.4M (-27% YoY), DAU about 3M (-26%), daily posters down from 1.4M to about 600K. Mobile MAU is roughly 3% of X's.
- Bluesky's official EN FFXIV account has roughly 15% of the X account's followers (rough, mismatched dates), so X remains the larger official channel.
- A real FFXIV community footprint exists on Bluesky (GPose feed, 53+ starter packs, four official accounts, GPOSERS), but pack rosters are small (8-12 members) and no feed reach figures were found.
- Japan is about 5-6% of Bluesky web traffic, so the JP FF14 community is not obviously a large driver; Japanese FF14 users seem to use feeds rather than starter packs.
- If a decision depends on volume, measure it directly: count #ffxiv/#ff14/#gpose posts over a week via the public search API or Jetstream from an unrestricted network.
- Treat the reply-bot case as unproven: it should wait for the planned poll to name Bluesky, consistent with the existing survey recommendation.


## Open questions

- Actual weekly post counts for #FFXIV, #FF14, #GPOSE, #FFXIVSnaps on Bluesky (needs API/Jetstream access).
- Like counts and subscriber reach of the FFXIV GPose feed and other FFXIV feeds.
- Whether 100,541 on en.finalfantasyxiv.com is followers or follows, and its live value; same for the X account's current count.
- Any FFXIV-specific survey or Reddit thread comparing Bluesky vs X for screenshots.
- FF14-specific Japanese numbers on Bluesky vs X.
- Whether any usage data has appeared after 2026-10-06 (none found).
