> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P7 Census: where FFXIV players gather (research date 2026-10-11)

> Redacted 2026-10-16: individual accounts are labels or generic descriptions, and post text, bios and identifying details are removed. See [the census README](../bluesky-census/README.md#redaction).

## Method and limits (read first)
- WebFetch could not reach any external host this session (DNS failure, and the agent proxy returned 403 on CONNECT). Every web fact below therefore comes from WebSearch result summaries, labeled "snippet" at best. None was confirmed on the live page. I could not open discord.com, discordbotlist.com, top.gg, disboard, Lodestone, or any social page.
- Third-party listing counts are undated point-in-time snapshots. Treat them as order-of-magnitude figures.
- About 22 searches were used. Each query and what it did not find is recorded because absence is evidence too.

## Bottom line
1. Discord is the dominant gathering place for FFXIV communities by every measure found: the largest general server (r/ffxiv, about 275k members), The Balance (about 470k listed), raiding, venue, regional and glamour servers. Reddit (r/ffxiv, about 1.3M) is the other large hub. Twitch is the main broadcast and streamer platform.
2. There is no Square Enix-run FFXIV Discord. The "official" server is the r/ffxiv subreddit's own server [1][2]. Square Enix's presence is on X, Twitch, YouTube, Bluesky (4 language accounts, launched mid-2025), TikTok, Lodestone, and in China 石之家 [9][10][11].
3. I found no evidence that any FFXIV community moved off Discord because of age verification. The search found two tiny Stoat servers (one about 85 members) and one hit for a long-dead Telegram group (about 2014). This matches and slightly extends the 2026-10-04 finding (53 and 6 members) [7][8].
4. Competition exists on Discord: Ser Aymeric (about 47k servers, FFXIV-origin, has a fashion report command) and Kweh! (glamour report, Lodestone, Eorzea Collection lookups) [12][13]. I found no FFXIV dye-matching bot on any platform in a top.gg search. That is a niche xivdyetools holds, but the evidence is one search.
5. In China, 石之家 recently relaunched a glamour feature with dye-database links (17173, 2026-03-16 per URL) [14]. That is a domestic competitor to our web tools for mainland users.
6. Recommendation from a presence standpoint: stay on Discord; build no new chat adapter on presence grounds alone. Telegram, Stoat, Matrix, Fluxer and Mastodon have effectively no FFXIV presence in what I could find. Twitch, Reddit and X/Bluesky have real FFXIV audiences but are poor fits for the bot's feature set (outside this task's scope to rule on).

## Ranked table: where FFXIV players are
| Rank | Venue | Evidence (figure, what it counts, date) | Evidence quality |
|---|---|---|---|
| 1 | Discord (many community servers) | r/ffxiv server 275,313 members (Discord Discovery) / 276,198 members, 112,703 online (Discord Bot List); The Balance 469,842 members, 160.4k online (DBL listing); NA Ultimate Raiding 35,248 members; Savage Learning Academy 10,070; FFXIV Venues 7,072; ffxivesp 6,296; FR server about 6,575; FFXIV Community server 2,649 members; HK server targeting Gaia DC. All undated snapshots [1][2][3][4][5]. | snippet (listing sites, undated) |
| 2 | Reddit | r/ffxiv about 1.3M members (GummySearch archive, before 2025-11-30; Notifier.so about 1,309,905) [6]. Prior file cites 1.4M [82 in prior file]. Also r/ffxivrecruitment, r/EorzeaCollection. | snippet; figures disagree (1.3M vs 1.4M) |
| 3 | Twitch | Official channel about 406,329 followers, 30-day average about 16,655 viewers, peak 45,844 (TwitchMetrics, undated). Category: #67 by 7-day average viewers, 4,367 (TwitchTracker, July 2026) [9]. Live Letters stream on Twitch and YouTube [10]. | snippet |
| 4 | X (Twitter) | @FF_XIV_EN about 437k followers (third-party tracker, July 2023); @FFXIV_NEWS_EN about 123k (May 2022). Stale [11]. | snippet, stale |
| 5 | Chinese-language sites: 石之家, NGA, Tieba | 石之家 is the official CN community site, glamour board relaunched (17173, 2026-03) [14]. NGA FFXIV board historically strong (2019/2020 poll claim, Moegirl) [15]. NGA FF14 KOOK server from prior file. No QQ or KOOK group data found. | snippet; QQ/KOOK unverified |
| 6 | Steam groups, Lodestone Community Finder | Community Finder is the in-game-adjacent finder; sampled listings mention Discord for chat and coordination (3 snippets, no Stoat/Telegram/LINE links seen) [16]. Steam coalition groups exist. | snippet; sample not systematic |
| 7 | Bluesky | Square Enix opened 4 official FFXIV accounts (en/fr/de/ja) in 2025; no follower counts found [9b]. Prior file: Bluesky web audience down 27% YoY. | secondary |
| 8 | Japanese: Discord (Disboard JP), Misskey/Mastodon (ffxiv-mastodon.com JA instance; etheirys.masto.host) | Small new JP servers listed on Disboard [17]; Fanlore lists the two Mastodon instances, liveness unconfirmed, no user counts [18]. No LINE OpenChat FF14 groups found [17]. | snippet / unverified |
| 9 | Korean: Inven, DC gallery, Discord | Search for 최종환상14/파이널판타지14 + Discord/Kakao open chat returned nothing relevant. Absence only; prior file says Inven and DC gallery. | unverified |
| 10 | Stoat | "One Normal Server" about 85 members, FFXIV-themed (stoat discover listing) plus a same-description entry on stoatservers.com [7]. Prior file: 53 and 6 members. | snippet |
| 11 | Telegram, Matrix, Fluxer | Telegram: only a 2014-era Square Enix forum thread; no current group found [8]. Matrix/Fluxer: nothing found. | absence after 1-2 searches |

## Findings by task item
1. Official presence. No Square Enix Discord (ProGameGuides says so; the largest "official" server is the r/ffxiv fan server) [2]. Known official accounts: X (EN, JP, news), Twitch, YouTube, Bluesky x4, TikTok (about 1,500 followers at launch, stale), Lodestone [9][11]. Live Letters: Twitch, YouTube, NicoNico; no viewer counts found [10]. Facebook, Instagram, LINE, Weibo and Bilibili follower counts were not found. A 2017 article mentions official LINE stickers only. Fan Fests 2026: Anaheim (Apr 24-25), Berlin (late Jul), Tokyo (end Oct) [9b].
2. Community Finder. Three sampled listings mention Discord. No Stoat, Telegram or LINE link seen. This is anecdotal, not a systematic sample.
3. Hubs. The Balance, r/ffxiv, NA Ultimate Raiding, Venues, Savage Learning Academy, regional (ES, FR, DE, HK) are all Discord. EGI (Eorzean Glamour Idols) runs Discord plus Twitter [19]. Eorzea Collection has a Discord (10,856 members per prior file); a 2024 Reddit ban-appeal post confirms it exists. No Discord server found for a dedicated glamour or dye group (search returned only SEO pages). GPOSERS, Teamcraft and Partake counts not found. Reddit's r/ffxivrecruitment tags Discord communities as a category.
4. Surveys. None found for 2024-2026 on platform use. Only: Lucky Bancho census (July 2025, character counts, not platforms), a 2017 fan survey (about 700 respondents), an academic case study of the FFXIV Discord server (RUC master project, undated) [20].
5. Existing bots. Ser Aymeric about 47k servers (top.gg, discord.bots.gg, alternative.me; undated), has slash commands, fashion report, character cards [12]. Kweh! (prefix commands, glam report, open source) [13]. xivbot (GitHub, `!` prefix), FFXIV-Companion PhantomBot module for Twitch and Discord [13]. No dye-matching bot found on Discord, Twitch, QQ, KOOK or Telegram.

## Source list
[1] https://discord.com/servers/final-fantasy-xiv-100463940835762176 (search snippet, undated)
[2] https://discordbotlist.com/servers/ffxiv and https://progameguides.com/final-fantasy/is-there-a-final-fantasy-xiv-discord/
[3] https://discordbotlist.com/servers/thebalanceffxiv
[4] https://discordbotlist.com/servers/naurffxiv, /ffxiv-venues-942536163959406632, /ffxiv-savage-learning-academy-633011544652906496
[5] https://discord.com/servers/ffxivesp-537956000569753600; https://discordbotlist.com/servers/final-fantasy-xiv-france-374194472294154241; https://discord.com/servers/final-fantasy-xiv-community-1148107306547032085
[6] https://gummysearch.com/r/ffxiv/ ; https://notifier.so/similar-subreddits/ffxiv
[7] https://rvlt.gg/discover/search?embedded=true&query=the&type=servers ; https://stoatservers.com/
[8] https://forum.square-enix.com/ffxiv/showthread.php?p=3620189
[9] https://www.twitchmetrics.net/c/9504944-finalfantasyxiv ; https://twitchtracker.com/games?page=4
[9b] https://thefilibusterblog.com/ffxiv-launches-new-social-media-presence-on-bluesky/ ; https://www.mynewsdesk.com/uk/bastion-uk/pressreleases/square-enix-announces-final-fantasy-xiv-online-fan-festivals-for-2026-3401181
[10] https://www.siliconera.com/final-fantasy-xiv-letter-from-the-producer-live-6-1-time-announced-ffxiv/
[11] https://www.speakrj.com/audit/report/FF_XIV_EN/twitter ; https://www.speakrj.com/audit/report/FFXIV_NEWS_EN/twitter
[12] https://top.gg/bot/265562769397514242 ; https://discord.bots.gg/bots/265562769397514242 ; https://docs.seraymeric.com/features/final-fantasy-xiv
[13] https://top.gg/bot/725551243551834112 ; https://github.com/xenodus/kweh-bot ; https://github.com/brysonwood/xivbot ; https://github.com/onigiri070/FFXIV-Companion
[14] https://news.17173.com/content/03162026/094002495.shtml
[15] https://mzh.moegirl.org.cn/NGA
[16] https://na.finalfantasyxiv.com/lodestone/community_finder/ (sampled listing URLs)
[17] https://disboard.org/ja/servers ; https://discord.com/servers/ff14-363677618144280587
[18] https://www.fanlore.org/wiki/Mastodon
[19] https://www.mmogames.com/articles/archives/community-spotlight-eorzean-glamour-idols
[20] https://rucforsk.ruc.dk/ws/files/81564013/Master_project_2.pdf ; https://www.mmogames.com/articles/archives/echoes-eorzea-ffxiv-survey-results-1


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Discord | dominant — r/ffxiv server about 275k; The Balance about 470k (listing); NA Ultimate Raiding 35k; many regional and glamour servers (undated listings). |  | build-now (already built): stay on Discord; it is where every large FFXIV community found lives. |  | Every hub I found lives on Discord. Competitor bots (Ser Aymeric about 47k servers) show demand. |
| Stoat (Revolt) | tiny — One server about 85 members plus a same-description listing; prior file found 53 and 6 members. |  | skip (keep parked) from a presence standpoint. |  | No community mass to serve; revisit only if a poll names it. |
| Telegram | none-found — Only a ~2014 SE forum thread about a Telegram group; no current group. |  | watch: no presence evidence; poll before building. |  | Technical fit (prior file) does not offset the lack of audience evidence. |
| Matrix / Element | none-found — No FFXIV Matrix rooms surfaced in any search. |  | skip |  | No evidence of FFXIV communities. |
| Fluxer | none-found — No FFXIV Fluxer communities surfaced. |  | watch |  | New platform; no FFXIV evidence. |
| Reddit | large — r/ffxiv about 1.3M members (2025 archive); r/ffxivrecruitment, r/EorzeaCollection. |  | watch: large audience but needs mod buy-in; link-outs only for now. |  | Largest non-Discord hub; platform is poor for interactive bots. |
| Twitch | moderate — Official channel about 406k followers; category about 4.4k average viewers (July 2026). |  | build-if-asked (streamer commands only) |  | SE broadcasts there; chat bot is text-only. |
| YouTube | moderate — Live Letters stream there; subscriber counts not found. |  | skip |  | Not a chat/bot venue. |
| X (Twitter) | moderate — @FF_XIV_EN about 437k followers (July 2023 tracker, stale). |  | watch |  | Official and community presence, but costly API and public-only replies. |
| Bluesky | small — Four official SE accounts launched 2025; no follower counts found; web audience reportedly falling. |  | watch |  | Official SE presence but unknown size. |
| Mastodon / Misskey | tiny — Fanlore lists etheirys.masto.host and ffxiv-mastodon.com (JA); liveness and counts unverified. |  | skip |  | Tiny and unverified. |
| LINE (Japan) | none-found — Searched LINE OpenChat FF14; only Discord servers on Disboard JP found. |  | watch: only if Japanese users ask. |  | JP players visible on Discord; no LINE FFXIV groups found. |
| KakaoTalk (Korea) | none-found — Korean-language search found no FFXIV Kakao groups or Korean FFXIV Discord. |  | skip |  | Absence only; Korean players use Inven, DC gallery and Discord per prior file. |
| KOOK / QQ / 石之家 / NGA (mainland China) | moderate — 石之家 glamour board relaunched 2026-03; NGA FFXIV board strong historically; NGA KOOK server per prior file; QQ groups unverified. |  | skip: presence is real but hosting and verification make a bot infeasible (prior file); web-app is the better channel. |  | Players use domestic sites; Discord is blocked from the mainland. |
| Steam groups / Lodestone Community Finder | small — Steam coalition groups exist; sampled Community Finder listings reference Discord. |  | n/a: link-out only |  | Not bot platforms. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | No Square Enix-run FFXIV Discord exists; the largest 'official' server is the r/ffxiv subreddit's fan server, about 275k-276k members (undated listings). | snippet | https://progameguides.com/final-fantasy/is-there-a-final-fantasy-xiv-discord/ | accessed 2026-10-11 (page undated) |
| C2 | The Balance Discord listed at 469,842 members (160.4k online) on Discord Bot List; counts members, undated. | snippet | https://discordbotlist.com/servers/thebalanceffxiv | undated |
| C3 | NA Ultimate Raiding 35,248 members; Savage Learning Academy 10,070; FFXIV Venues 7,072; ES server 6,296; FR server about 6,575 (listing snapshots, undated). | snippet | https://discordbotlist.com/servers/naurffxiv | undated |
| C4 | r/ffxiv has about 1.3M members (GummySearch archive before 2025-11-30; Notifier.so 1,309,905); the prior file says 1.4M. | snippet | https://gummysearch.com/r/ffxiv/ | 2025 (pre-2025-11-30) |
| C5 | Official FFXIV Twitch channel about 406k followers, 30-day average about 16.7k viewers, peak about 45.8k; Twitch FFXIV category ranked #67 with 4,367 average viewers (7 days, July 2026). | snippet | https://twitchtracker.com/games?page=4 | 2026-07 |
| C6 | Square Enix launched four official FFXIV Bluesky accounts (en/fr/de/ja) in 2025, positioned as complementary to X and Instagram; no follower counts found. | secondary | https://thefilibusterblog.com/ffxiv-launches-new-social-media-presence-on-bluesky/ | 2025 |
| C7 | Stoat FFXIV presence found: 'One Normal Server' about 85 members (Stoat Discover) plus a same-description stoatservers.com entry; no larger server found. | snippet | https://rvlt.gg/discover/search?embedded=true&query=the&type=servers | accessed 2026-10-11 |
| C8 | No current FFXIV Telegram group found; only a ~2014 Square Enix forum thread. | snippet | https://forum.square-enix.com/ffxiv/showthread.php?p=3620189 | 2014 (approx.) |
| C9 | No evidence found that any FFXIV community moved off Discord over age verification; searches for r/ffxiv and Discord-exodus coverage return only generic news. | snippet | https://www.techradar.com/computing/software/what-a-great-way-to-kill-your-community-discord-users-are-furious-about-its-new-age-verification-checks-and-are-now-hunting-for-alternatives | 2026 |
| C10 | Ser Aymeric (FFXIV-origin Discord bot with slash commands, fashion report, character cards) is listed at about 47k servers; Kweh! offers glamour reports and Eorzea Collection lookups. No FFXIV dye-matching bot found. | snippet | https://top.gg/bot/265562769397514242 | undated |
| C11 | 石之家 (CN official community site) relaunched a glamour board with outfit uploads, race/gender filters, favorites and dye-database links (17173, 2026-03-16 per URL). | snippet | https://news.17173.com/content/03162026/094002495.shtml | 2026-03-16 |
| C12 | No 2024-2026 survey of FFXIV players' platform use found; only the Lucky Bancho census (character counts) and an academic case study of the FFXIV Discord server. | snippet | https://rucforsk.ruc.dk/ws/files/81564013/Master_project_2.pdf | undated |
| C13 | WebFetch could not reach external hosts in this session (DNS failure; proxy 403 on CONNECT), so no figure here was verified on the live page. | unverified | /home/user/xivdyetools/docs/research/discord-alternatives/07-2026-10-refresh.md:1 | 2026-10-11 |


## Corrections to the 2026-10-04 refresh

- The prior file's 'only two tiny Stoat servers (53 and 6 members)' is not contradicted: this run found one FFXIV-themed Stoat server of about 85 members (Stoat Discover snippet, undated). The conclusion stands (tiny).
- The prior file gives r/ffxiv as 1.4M members; archived trackers show about 1.3M (GummySearch pre-2025-11-30, Notifier.so 1,309,905). Possibly a growth difference or a different source date; unresolved.
- The 'Fluxer over 200,000 users' figure appeared in one search snippet as unverified; do not use it.
- The prior file's note that Mastodon has 'a Japanese FFXIV instance (not named; unverified)': Fanlore names ffxiv-mastodon.com (JA) and etheirys.masto.host, but liveness is still unconfirmed.


## Open questions

- Live follower and subscriber counts for official FFXIV X, Bluesky, YouTube, TikTok, Facebook, Instagram, LINE, Weibo and Bilibili accounts (WebFetch was blocked this session).
- Current verified member counts for The Balance, GPOSERS, Teamcraft, Partake, Raid Finder, Eorzea Collection and EGI Discords (only undated listing snapshots found).
- Whether any FFXIV community announced a move off Discord in 2026 (searches found none; try r/ffxiv and individual server announcement channels).
- How many Lodestone Community Finder listings carry Discord vs. other links (needs a systematic sample).
- Whether any mainland QQ/KOOK FF14 groups exist and how large they are.
- Whether a community poll in the r/ffxiv Discord, r/ffxivglamours or similar would name any non-Discord platform (the recommended next step).
