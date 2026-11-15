> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# B1a: FFXIV on Bluesky vs X, measured by account (as of 2026-10-11)

> Privacy minimization 2026-10-29: linked individual records, numerical fingerprints and creator-owned feed/pack examples were removed. Other claims retain their original cloud-phase evidence grade; this is not a new fact-check. See [the census README](../bluesky-census/README.md#redaction).

## Bottom line
- I could not test the claim that English-speaking FFXIV players post more on Bluesky than on X. Almost every number comes from search-engine snippets of profile pages. Those pages carry no capture date, and the direct profile fetches failed (DNS errors).
- Two organization pairs remain in this publication. Individual comparisons have been removed for privacy; this is a selected organization sample.
- The retained organization ratios are about 0.103 and 0.154, with median about 0.129. They are illustrations with mismatched dates, not evidence of population activity.
- That reading is weak. The pairs are not a random sample. Follower counts also measure accumulated audience, not posting volume. I found no post-volume data for either platform.
- Nothing I found measures "posts more on Bluesky than on X." The only direct evidence is anecdote: Square Enix forum posters say many FFXIV artists moved to Bluesky [6].

## 1. Official Square Enix accounts
- **Launch.** Square Enix opened four FFXIV Bluesky accounts (English, French, German, Japanese) [1][2]. The Lodestone notice says it is "trying out" Bluesky and that the accounts complement the other channels [2]. The exact date was not visible in snippets. Siliconera's article age implies mid-2025 [1].
- **English handle.** The handle is `en.finalfantasyxiv.com` [3]. I could not find the fr, de or jp Bluesky handles in any snippet.
- **English Bluesky counts (snippet, undated).** The profile metadata lists about 100,541 followers and about 1,062 posts [3]. Two different search runs returned 100,541, but no second source corroborates it. I could not rule out that a metadata field was misread. Treat it as unverified.
- **Activity.** The newest post I saw is dated 2026-10-09 and promotes the PAX Australia development panel. It had about 49 likes and 1 comment [3]. The account is active.
- **Posting rate (computed).** 1,062 posts over roughly 480 days (mid-June 2025 to 2026-10-11) is about 2.2 posts per day. That assumes the post count and the launch date are both right.
- **X counts (snippets, undated).**

| Account | X followers |
|---|---|
| @FF_XIV_EN | 652.4K to 652.6K [7] |
| @FF_XIV_JP | 653.7K to 663.5K [8] |
| @FF_XIV_FR | 58.9K [9] |
| @FF_XIV_DE | 38.5K [9] |
| @FFXIV_NEWS_JP | 206.9K [8] |

- **Dual posting.** The same PAX Australia news appears on both X and Bluesky [3][10]. I could not confirm that Live Letter or patch news goes to both. The X post for the PAX announcement exists [10], but I got no like or repost counts for it, so there is no same-announcement engagement comparison.
- **Square Enix's own treatment (forum, anecdote).**
  - Lodestone news posts show X and Facebook links but no Bluesky icon.
  - A giveaway required an X account even though it was also posted on Bluesky.
  - The official account said it was staying on X while expanding to Bluesky [6].
  - One forum poster quoted "4.1 million active users" for Bluesky against "245 million" for X. That figure is undated forum text, not a measurement [6].

## 2. Creators and organizations
Bluesky counts come from the "FollowAction" value in bsky.app page metadata, which I read as followers. The snippets did not label it, so this is an inference.

| Account | Bluesky | X | Notes |
|---|---|---|---|
| FFXIV official EN | 100,541 [3] | 652.4K [7] | See section 1 for caveats |
| GPOSERS (`gposers.org`) | 2,043 [11] | 19.8K [12] | The search tool said the X page was about 2,995 days old, so 19.8K is likely stale. Bluesky posts run through Sep 2026. Its X account also posted the August issue. |
| FFXIV Teamcraft (`ffxivteamcraft.com`) | not found | about 2,171 [17] | The X account posted that it "made the move toward being on Bsky." |
| Gamer Escape (`gamerescape.com`) | not found | about 3,729 [18] | The Bluesky account posts articles, with a post cached from Feb 2025. |
| Aetheryte Radio | about 343 [19] | not found | |
| Eorzea Collection | no account found | about 2,964 [20] | |
| The Balance | no account found | about 2,021 [21] | |
| The FFXIV producer | no account found | not checked | |
| Siliconera (not FFXIV-specific) | about 796 [22] | not found | |

- **Other FFXIV-related Bluesky accounts.**
  - The `redditffxiv.bsky.social` feed has about 4,141 followers [23].
  - Starter packs list 53+ FFXIV packs (artists, gposers, streamers, DJs, NPC roleplay). They show no follower counts [25].

## 3. Ratios (Bluesky followers divided by X followers)

| Pair | Calculation | Ratio |
|---|---|---|
| GPOSERS | 2,043 / 19,800 | 0.103 |
| FFXIV official EN | 100,541 / 652,400 | 0.154 |

- Two selected organization pairs: median about 0.129, range 0.103–0.154. This replaces the removed individual comparison sample.
- Selection bias: the retained examples are organizations with a measured presence on both platforms. They do not represent people without a Bluesky account.

## 4. Baseline
- **Bluesky.** Similarweb puts the Bluesky mobile app at 10.4M MAU in June 2026, down 27.2% year over year [27][28]. It shows mobile DAU of about 3M in July 2026, down 25.6% [28]. Quarterly average MAU fell from about 22.1M (Q4 2024) to 10.7M (Q2 2026). Registered accounts are nearly 46M [28]. Other sources cite about 15M MAU in Jan 2026 and 27.5M in Feb 2026. These use different methods [28].
- **X.** Similarweb shows about 302M app MAU in June 2026 and mobile DAU of about 123.7M in July 2026 [28]. Non-Similarweb estimates range from about 350M to over 600M MAU. They are marketing aggregators and are unreliable [29].
- **Baseline ratio (computed).**
  - MAU: 10.4M / 302M = 0.034.
  - DAU: 3M / 123.7M = 0.024.

## 5. Correction to the existing research doc
`docs/research/discord-alternatives/07-2026-10-refresh.md` line 39 says Similarweb estimated Bluesky's "web audience" fell 27%. The search summaries I saw describe the 10.4M and 302M figures as mobile app MAU [28]. Re-check the TechCrunch article [27] before reusing "web audience."

## Sources
1. Siliconera, "New FFXIV Social Media Account Opens on Bluesky," https://www.siliconera.com/new-ffxiv-social-media-account-opens-on-bluesky/ (via search snippet)
2. Lodestone, "FFXIV is now on Bluesky!" https://na.finalfantasyxiv.com/lodestone/topics/detail/8ea3fc2cdc8183bd9b7dfa37261dc7976afe527a (snippet; direct fetch failed)
3. https://bsky.app/profile/en.finalfantasyxiv.com (snippet)
4. [URL removed: names an individual] (snippets)
5. (unused)
6. Square Enix forum, "Please prioritize Bluesky the same as or moreso than X on official posts," https://forum.square-enix.com/ffxiv/threads/522344 ; and "Can we get an official FFXIV account on Bluesky," https://forum.square-enix.com/ffxiv/threads/515063
7. https://x.com/FF_XIV_EN (snippet)
8. https://x.com/FF_XIV_JP and https://x.com/FFXIV_NEWS_JP (snippets)
9. https://x.com/FF_XIV_FR and https://x.com/FF_XIV_DE (snippets)
10. https://x.com/FF_XIV_EN/status/2101990067803922770 ; Lodestone PAX Aus 2026 notice, https://eu.finalfantasyxiv.com/lodestone/topics/detail/7708a72cbba8ff0ef76f95c9034d358b1b9de92c
11. https://bsky.app/profile/gposers.org (snippet)
12. https://x.com/GPOSERS_FFXIV (snippet; stale)
13. [URL removed: names an individual] (snippet)
14. [URL removed: names an individual] (snippets)
15. [URL removed: names an individual] (snippets)
16. [URL removed: names an individual] (snippets)
17. https://x.com/FFXIVTeamcraft ; https://bsky.app/profile/ffxivteamcraft.com (snippets)
18. https://x.com/gamerescape ; https://web-cdn.bsky.app/profile/gamerescape.com (snippets)
19. [URL removed: DID-based profile link] (snippet)
20. https://x.com/eorzeacollect (snippet)
21. https://x.com/thebalanceffxiv (snippet)
22. https://bsky.app/profile/siliconera.bsky.social (snippet)
23. https://bsky.app/profile/redditffxiv.bsky.social (snippet)
24. [URL removed: names an individual] (snippet)
25. https://blueskystarterpack.com/ffxiv (snippet)
26. [URL removed: names an individual] (starter pack and three Bluesky Directory profiles; snippets)
27. TechCrunch, 2026-08-11, https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/
28. Search-tool summaries of Similarweb data via TechCrunch/Slashdot/Daring Fireball: https://tech.slashdot.org/story/26/08/16/0326249/blueskys-active-user-base-shrinks-52-over-18-months-but-its-protocol-is-spreading ; https://daringfireball.net/linked/2026/08/21/bluesky-user-base-is-tiny
29. X MAU aggregators, e.g. https://onclusive.com/resources/blog/x-twitter-statistics-2026/ and https://seoscaleup.com/blog/x-twitter-user-statistics-for-2026/


## Numbers (structured)

| Subject | Platform | Metric | Value | As of | Confidence | Source |
|---|---|---|---|---|---|---|
| @en.finalfantasyxiv.com (official EN) | bluesky | followers | 100,541 | undated (post seen 2026-10-09) | snippet | https://bsky.app/profile/en.finalfantasyxiv.com |
| @en.finalfantasyxiv.com (official EN) | bluesky | posts | ~1,062 | undated | snippet | https://bsky.app/profile/en.finalfantasyxiv.com |
| @FF_XIV_EN | x | followers | 652.4K-652.6K | undated | snippet | https://x.com/FF_XIV_EN |
| @FF_XIV_JP | x | followers | 653.7K-663.5K | undated | snippet | https://x.com/FF_XIV_JP?lang=en |
| @FF_XIV_FR | x | followers | 58.9K | undated | snippet | https://x.com/FF_XIV_FR |
| @FF_XIV_DE | x | followers | 38.5K | around 2026-10-09 | snippet | https://x.com/FF_XIV_DE |
| @FFXIV_NEWS_JP | x | followers | 206.9K | undated | snippet | https://x.com/FFXIV_NEWS_JP |
| GPOSERS gposers.org | bluesky | followers | 2,043 | undated (posts to Sep 2026) | snippet | https://bsky.app/profile/gposers.org |
| GPOSERS @GPOSERS_FFXIV | x | followers | 19.8K | likely stale | snippet | https://x.com/GPOSERS_FFXIV |
| FFXIV Teamcraft @FFXIVTeamcraft | x | followers | ~2,171 | undated | snippet | https://x.com/FFXIVTeamcraft |
| Gamer Escape @gamerescape | x | followers | ~3,729 | undated | snippet | https://x.com/gamerescape |
| Aetheryte Radio | bluesky | followers | ~343 | undated | snippet | [URL removed: DID-based profile link] |
| Eorzea Collection @EorzeaCollect | x | followers | ~2,961-2,964 | undated | snippet | https://x.com/eorzeacollect |
| The Balance @thebalanceffxiv | x | followers | ~2,021 | old, undated | snippet | https://x.com/thebalanceffxiv |
| Retained organization ratios | other | median ratio (range) | about 0.129 (0.103–0.154), two examples | computed from 2026-10-11 snippets | computed | https://bsky.app/profile/gposers.org |
| Bluesky mobile app | bluesky | MAU (Similarweb) | 10.4M, -27.2% YoY | June 2026 | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| Bluesky mobile app | bluesky | DAU (Similarweb) | ~3M, -25.6% YoY | July 2026 | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| X app | x | MAU (Similarweb) | ~302M | June 2026 | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| X app | x | mobile DAU (Similarweb) | ~123.7M | July 2026 | secondary | https://daringfireball.net/linked/2026/08/21/bluesky-user-base-is-tiny |
| Bluesky:X baseline | other | MAU ratio / DAU ratio | 10.4/302 = 0.034 ; 3/123.7 = 0.024 | computed 2026-10-11 | computed | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |
| Bluesky registered accounts | bluesky | registered | nearly 46M | Aug 2026 | secondary | https://tech.slashdot.org/story/26/08/16/0326249/blueskys-active-user-base-shrinks-52-over-18-months-but-its-protocol-is-spreading |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| c1 | Square Enix opened four FFXIV Bluesky accounts (EN, FR, DE, JP); the English handle is en.finalfantasyxiv.com. FR/DE/JP handles not found. | snippet | https://www.siliconera.com/new-ffxiv-social-media-account-opens-on-bluesky/ |  |
| c2 | EN official Bluesky profile metadata shows about 100,541 followers and about 1,062 posts, latest post 2026-10-09 (about 49 likes). Single-source, undated; possibly misread. | snippet | https://bsky.app/profile/en.finalfantasyxiv.com |  |
| c3 | @FF_XIV_EN has about 652K X followers; @FF_XIV_JP about 654-664K; @FF_XIV_FR about 58.9K; @FF_XIV_DE about 38.5K (undated snippets). | snippet | https://x.com/FF_XIV_EN |  |
| c4 | Two retained organization pairs have ratios about 0.103 and 0.154; median about 0.129. Selected examples with mismatched capture dates do not establish population activity. | computed | https://bsky.app/profile/gposers.org | |
| c5 | Similarweb: Bluesky mobile app 10.4M MAU (June 2026, -27.2% YoY), about 3M mobile DAU (July 2026); X app about 302M MAU, about 123.7M mobile DAU. Baseline ratio about 0.034 (MAU), about 0.024 (DAU). | secondary | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |  |
| c6 | Square Enix forum posters say Lodestone posts link X and Facebook but not Bluesky, a giveaway required an X account, and the official account said it is staying on X while expanding to Bluesky. | snippet | https://forum.square-enix.com/ffxiv/threads/522344 |  |
| c8 | The existing research doc says Similarweb's 27% decline is a web audience; search summaries describe it as mobile app MAU. Needs re-check against the TechCrunch article. | unverified | https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ |  |


## Conclusions

- The maintainer's observation (English FFXIV players post more on Bluesky than on X) is not testable with what I could retrieve. No post-volume or hashtag-volume data was found for either platform.
- Retained organization examples have ratios about 0.103 and 0.154. No population or posting-activity inference follows from this selected pair of organization audiences.
- Square Enix runs an active English Bluesky account (post seen 2026-10-09) but still treats X as primary (forum reports: no Lodestone link, X-only giveaway). A Bluesky bot would reach a real but much smaller audience than X.
- Official Bluesky follower figure (about 100.5K) is the single most important number and rests on one undated snippet; verify it live before relying on it.
- The existing research doc's phrase 'web audience' for the Similarweb figure may be wrong (sources say mobile app MAU).


## Open questions

- Is the official EN Bluesky follower count really about 100.5K today? Verify live on bsky.app or via the AT Protocol getProfile endpoint, from a network that can reach it.
- What are the FR, DE and JP official Bluesky handles, follower counts and post counts?
- How do likes and reposts compare per announcement (same Live Letter or patch post) on Bluesky vs X for each official account?
- Which FFXIV hashtag or keyword post volume per day exists on Bluesky vs X (the AT Protocol search API or Jetstream could measure Bluesky directly)?
- Is the Similarweb 10.4M / 302M figure mobile app MAU or web audience? Re-read the TechCrunch article.
- Bluesky counts for Teamcraft, Gamer Escape, Eorzea Collection, The Balance, and X counts for Aetheryte Radio, Siliconera were not found, so those pairs are incomplete.
- Whether the FFXIV producer or other Square Enix staff have Bluesky accounts (none found).
