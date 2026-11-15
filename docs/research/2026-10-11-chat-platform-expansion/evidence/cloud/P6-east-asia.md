> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P6 East Asia research, 2026-10-11

Scope note: WebFetch could not resolve any host from this sandbox (getaddrinfo ENOTFOUND for gnn.gamer.com.tw, ffxiv.com.tw, developers.line.biz, greatfire.org, pttweb.cc). All web evidence below therefore comes from WebSearch result summaries (confidence "snippet" or "secondary"), not from reading the pages. About 20 searches were used. Nothing was written to the repository.

## 1. Biggest correction: a Traditional Chinese FFXIV service exists and is live

- FINAL FANTASY XIV 繁體中文版 (PC) is operated by 宇峻奧汀 (UserJoy / Soft-World group, per search summaries) with 智寶國際 as co-agent. The announcement was 2025-02-27. Service covers Taiwan, Hong Kong, Macau, Singapore and Malaysia. Early access began 2025-11-27 and official launch was 2025-12-10 on patch 7.0 content, with a 6-World opening during early-access queues [1][2][3].
- The 2026-10-04 refresh has no mention of this. Its §5 treats "zh" as mainland only.
- Population: a PTT C_Chat post (2026-04, unreachable for me) is summarized as citing "23,430 active players" on the TC servers; I could not confirm its source. A Bahamut report summary says player-tallied daily peak is about 10-15K online [4]. A third-party ranking site lists 15,850 public-logging players (counts only players with public logs, not population) [5]. Treat all three as unverified.
- Client languages of the TC client: not confirmed by any source I could read (unverified).

## 2. Where Taiwan/HK players gather (evidence)

- LINE OpenChat is real and visible. A single OpenChat page for "FF14繁中版-迦樓羅伺服器討論區" (Garuda server) showed about 443 members, and lists related rooms: a trade group, "新芽光呆預備群" about 579 members, "依露希爾交流群" about 211 members. Counts are a page snapshot; they count members of each room [6].
- Official channels: ffxiv.com.tw, a Facebook fan page, Instagram, YouTube; Bahamut (巴哈姆特) has an FFXIV 哈啦板 where operator reports are reposted [4][7].
- Discord: the largest Chinese-language server found is 全港最大FF14討論區 (Hong Kong) with 8,940 members and 2,928 online (member count and online-now, Discord/discordbotlist snapshot, undated). It is oriented to the Japan Gaia DC (international client), not the TC service [8]. English "Final Fantasy XIV Community" listing: about 2,669-2,685 members [8].
- I found no TC-service-specific Discord server count. A comparison page says LINE is popular in Japan, Thailand and Taiwan [9] (weak).
- Implication: for Taiwan, LINE OpenChat is the preferred group channel, and LINE bots cannot join OpenChat (see §4). HK players already use Discord, where the existing bot works, but zh-TW users get Simplified text (see §3).

## 3. zh-TW locale: the repo ships Simplified only

- bot-logic (user locale) and discord-worker (command localization) both map zh-CN and zh-TW to the single `zh` locale: packages/bot-logic/src/i18n/locale-resolution.ts:101-102 (user locale) and apps/discord-worker/src/commands/localize.ts:59-60 (command localization); the comment at localize.ts:27-28 says Discord wants both but "the bot ships one zh". LOCALE_CODES in localize.ts has only ja/de/fr/ko/zh (:64).
- packages/core/src/services/LocalizationService.ts:39 lists 'zh' only; :53 documents the zh-CN prefix handling.
- The text is Simplified: packages/bot-logic/src/i18n/locales/zh.json:7 uses 染剂; core dye names use Simplified (packages/core/src/data/locales/zh.json:18 素雪白, :19 苍白灰). That file was generated 2026-10-06 and is built from dyenames.csv / localize.yaml per CLAUDE.md, so Traditional names must enter the source CSV/YAML.
- A real zh-TW locale needs: (a) a new locale code in core, bot-logic, svg/og fonts and the web app; (b) the TC client's official 125 dye names (a source I could not find; a web search for official TC/SC dye-name differences returned nothing; the data must come from the TC client or its game data export, not from OpenCC conversion, because FFXIV TC and SC localizations differ in terms); (c) about 270 locale-file lines of UI strings translated (core zh.json is 270 lines; bot-logic zh.json size not counted); (d) Traditional-capable CJK font subsets for card rendering (Noto Sans TC; the repo subsets JP/SC/KR only, per CLAUDE.md); (e) the locale-quality gates and parity tests; (f) Discord's `zh-TW` locale already exists, so registering command localizations is cheap.
- Cheap interim: auto-converting the existing strings to Traditional is possible but would show Simplified-sourced dye names that differ from the TC client; flag as lower quality.

## 4. LINE

- OpenChat: an SDK issue states bots cannot join OpenChat like normal groups; official overview and group-chat docs do not mention OpenChat [10][11]. This matches the 2026-10-04 file. I found no 2026 change. No third-party OpenChat bot program found.
- LINE OpenChat FF14 groups in Japan: searches ("FF14 オープンチャット", "光の戦士") returned no room names or counts. That is evidence only that search engines do not index them, not that none exist [12].
- Pricing: Japan examples from official docs: free plan 200 messages, light plan JPY 5,000 for 5,000, standard JPY 15,000 for 30,000; extra JPY 3 (2.5 above 200k) from 2026-10-01, Japan only [13][14]. A Taiwan plan table appears only in an unsourced HackMD note (free 200, NT$800 for 3,000, NT$1,200 for 6,000); do not rely on it [15]. Replies to users are generally not counted; pushes are.
- LINE MINI App: found only that LIFF `sendMessages()` can post to an open chat on the user's behalf [11]. No evidence of a 2026 MINI App program change; I could not read the LINE news page. LIFF/MINI App could be a launcher for the web app inside LINE, which is a web-app task, not a bot task.
- Messaging API changes since 2026-10-04: none found (search returned no 2026 changelog).

## 5. KakaoTalk (Korea)

- Operator: Actoz Soft publishes FFXIV in Korea under a Square Enix contract; Korea sits on patch 7.3 (2025-10-28), Switch 2 version announced for 2026-08 and 8.0 expansion teaser for 2027-01 per an Inven listing (dates uncertain) [16].
- KakaoTalk open chats are used for Korean free companies (an Inven recruiting post links two). No FFXIV open-chat room with a member count was found [17].
- Bot options: Kakao i Open Builder is for channel chatbots. A March 2026 community Q&A says KakaoTalk has no official bot API for open-chat rooms; a 2026-06 Kakao ChatGPT chatbot works in group and 1:1 rooms but is Kakao's own feature [18][19]. An older guide says the chatbot beta does not work in OpenChat rooms (validity unconfirmed). No third-party OpenChat bot program found.
- Discord member counts for Korea not found; the KR community's Discord use remains from the 2026-10-04 file.

## 6. Mainland China

- 国服 is run by 盛趣游戏 (Shengqu; the search summary names it, I did not read an official page). The 石之家 site has no public API, bot or mini-program that I could find; only community scripts (e.g., FF14CN/Sarean-arsenal for sign-ins) exist [20].
- FF14 bots in the Chinese community are on QQ via Koishi/NoneBot. Hamster (Koishi, QQ plus Discord, "not public", plugins macrodict, lodestone, eorzea) serves the Eorzea Macrology Association guild; a NoneBot FF14 toolkit uses 肥肥咖啡 (Fat Fat Coffee/ffcafe) and Universalis APIs; a QQ bot for FFLogs monitoring exists. No dye-lookup plugin was found [21]. This is evidence the community's bot channel is QQ via unofficial protocol-based frameworks, and a gap exists for dyes.
- QQ official bot: tutorials say individual developers can register, must complete real-name plus face verification, and must add public IPs to an API IP allowlist (error 11298 if not); home broadband IPs break it [22]. This matches the earlier file. ICP filing: not found in either direction.
- KOOK: I found no FFXIV-specific KOOK server size, nor evidence of KOOK native slash commands (a sample open-source bot uses /help style prefix text commands).
- Reachability of xivdyetools.app from mainland China: untested. GreatFire could not be fetched. A forum thread says pages.dev is intermittently blocked, an anecdote [23]. A real test needs a mainland probe (e.g., itdog.cn or GreatFire's lookup).
- WeChat: no new evidence; the earlier "not feasible" verdict stands, unchanged and unrechecked.

## 7. Recommendations summary

1. Highest-value item: zh-TW. It is also needed for Discord users on the TC service and in Hong Kong. Do this regardless of new platforms.
2. LINE for Taiwan or Japan: low value because bots cannot enter OpenChat and the FFXIV groups are OpenChat.
3. KakaoTalk, WeChat: skip.
4. QQ/KOOK: only through a mainland partner; the unofficial frameworks (Koishi/NoneBot) are the community norm; an open-source plugin could be a cheaper route than an official adapter.

## Sources
[1] Search summary: GNN/Gamer, 宇峻奧汀與智寶國際宣布 FFXIV 繁體中文版 (sn=281500, sn=283088, sn=293907, sn=296226), https://gnn.gamer.com.tw/detail.php?sn=296226 (not fetched)
[2] Gamania blog, https://blog.shopping.gamania.com/game/ff14-traditional-chinese-version-live ; official site https://www.ffxiv.com.tw/ (not fetched)
[3] 4Gamers, https://www.4gamers.com.tw/news/detail/71478/the-first-live-broadcast-of-the-traditional-chinese-version-of-ff14 and unwire.hk 2025-02-27
[4] Bahamut forum, https://forum.gamer.com.tw/C.php?bsn=17608&snA=31066 ; PTT C_Chat, https://www.pttweb.cc/bbs/C_Chat/M.1776020509.A.C08 (2026-04, not fetched)
[5] https://ranking.init.engineer/stats/ (accessed 2026-10-11)
[6] LINE OpenChat page, https://openchat.line.me/th/cover/bxB8Da49QnWeEXGdVS449q04ZWR5lKQEfvHhAFjaWY_2xA9S98rOP8sArmQ (snapshot, undated)
[7] https://www.facebook.com/FinalFantasyXIVTC/ and summail.blog 2025-12-10 community article
[8] https://discord.com/servers/ff14-363677618144280587 ; https://discordbotlist.com/servers/final-fantasy-xiv-community-1148107306547032085
[9] https://www.wmtips.com/technologies/compare/discord-vs-line/
[10] https://github.com/line/line-bot-sdk-python/issues/918
[11] https://developers.line.biz/en/docs/messaging-api/overview/ and receiving-messages doc
[12] Searches "FF14 LINE オープンチャット", "openchat.line.me FF14" (no results), 2026-10-11
[13] https://developers.line.biz/en/docs/messaging-api/pricing/
[14] https://www.lycbiz.com/jp/news/line-official-account/20260216/
[15] https://hackmd.io/@assistive-devices/rJEQJX95be (unsourced)
[16] https://m.inven.co.kr/webzine/wznews.php?site=ff14 and xportsnews/inews24 results
[17] https://www.inven.co.kr/board/ff14/4468/31451
[18] https://bbojjak-library.gpters.org/qna/qna-16 (2026-03 community Q&A)
[19] https://www.kakaocorp.com/page/detail/12056?lang=ENG
[20] GitHub FF14CN/Sarean-arsenal (via search)
[21] https://classic.yarnpkg.com/en/package/koishi-plugin-ffxiv-macrodict ; https://github-redirect.dependabot.com/AwesomeHamster/hatsushimo
[22] https://developer.aliyun.com/article/1710410 and https://developer.cloud.tencent.cn/article/2395564
[23] https://lowendspirit.com/discussion/8352
Repo: apps/discord-worker/src/commands/localize.ts:27-28,59-60,64; packages/bot-logic/src/i18n/locale-resolution.ts:101-102; packages/core/src/services/LocalizationService.ts:39; packages/bot-logic/src/i18n/locales/zh.json:7; packages/core/src/data/locales/zh.json:18-19.


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| LINE (JP) | unknown — Searches for FF14 LINE OpenChat rooms in Japanese returned no room names or counts; absence of search indexing is not proof of none. | Webhook with HMAC fits a Worker. | skip. Build only if Japanese users ask. | 5-6.5 (from 2026-10-04 file) | Bots cannot join OpenChat, JP players are on Discord, images need hosted URLs and an Official Account. |
| LINE (TW) | small — Garuda room about 443 members, new-player room about 579, another about 211 members (OpenChat snapshots). | Same as LINE JP. | skip for now; watch. The audience is on LINE OpenChat, which bots cannot join. | 5-6.5 plus zh-TW locale | A normal-group bot would only reach friends' small groups; Taiwan prices unverified. Fix zh-TW on Discord first. |
| LINE MINI App | n/a — No evidence found; only that LIFF can send messages to open chats on the user's behalf. | Static web app; fine. | watch. A LIFF wrapper around the web app is a web-app task, not a bot. | unknown | Not a bot platform; no 2026 program change found. |
| KakaoTalk | small — Free companies share open-chat links on Inven; no room with a count found. | Skill-server POST fits a Worker but the surface is wrong. | skip | not estimated | No third-party OpenChat bot API found; Open Builder is channel-only; Korean players on Discord. |
| KOOK | small — Only the NGA FF14 invite from the earlier file; no new count found. | Poor. | skip | not estimated | Real-name beyond sandbox, 1 s ACK, workers.dev blocked; no slash-command evidence. |
| QQ | moderate — Several FF14 QQ bots exist (Hamster, FFLogs monitor, Koishi/NoneBot plugins); no group counts found. | Poor (no fixed egress IP). | skip as an official adapter; consider publishing an open-source Koishi/NoneBot plugin on request. | not estimated | Official bot needs real-name and IP allowlist; community uses unofficial frameworks. |
| WeChat | unknown — No new evidence collected. | n/a | skip | n/a | Earlier verdict (no open chat/group bot API) stands, not rechecked. |
| zh-TW locale | moderate — TC service live since 2025-12-10; population claims about 10-23K, unverified; HK Discord 8,940 members. | Works on existing Discord worker, no hosting change. | build-if-asked, but it is the highest-value East Asia item; a spike to source the TC client's dye names comes first. | 2-4 (my estimate, not sourced) | Repo maps zh-TW to Simplified zh; needs Traditional UI, official TC dye names, Traditional fonts, a new locale code and gate updates. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | FFXIV Traditional Chinese PC service exists: operator 宇峻奧汀 with 智寶國際, covering Taiwan, HK, Macau, Singapore, Malaysia; announced 2025-02-27, early access 2025-11-27, launch 2025-12-10. | snippet | https://gnn.gamer.com.tw/detail.php?sn=296226 | 2025-12 |
| C2 | bot-logic (user locale) and discord-worker (command localization) both map zh-CN and zh-TW to a single zh; the localize.ts comment says the bot ships one zh. | repo | apps/discord-worker/src/commands/localize.ts:27-28,59-60; packages/bot-logic/src/i18n/locale-resolution.ts:101-102 | 2026-10-11 |
| C3 | zh locale strings and dye names are Simplified (染剂, 素雪白, 苍白灰). | repo | packages/core/src/data/locales/zh.json:18-19 | 2026-10-06 |
| C4 | LINE OpenChat has TW FFXIV rooms: Garuda server room about 443 members, new-player prep room about 579, Elemental-related room about 211 (snapshot, member counts). | snippet | https://openchat.line.me/th/cover/bxB8Da49QnWeEXGdVS449q04ZWR5lKQEfvHhAFjaWY_2xA9S98rOP8sArmQ | undated snapshot |
| C5 | Bots cannot join OpenChat like normal groups (maintainer comment); official docs omit OpenChat. No 2026 change found. | secondary | https://github.com/line/line-bot-sdk-python/issues/918 | undated |
| C6 | HK Discord 全港最大FF14討論區: 8,940 members, 2,928 online (snapshot), focused on Gaia DC international client. | snippet | https://discord.com/servers/ff14-363677618144280587 | undated |
| C7 | TC population figures: 23,430 active (PTT, unverified source), 10-15K daily peak (player tally), 15,850 public-log players (ranking site). | unverified | https://forum.gamer.com.tw/C.php?bsn=17608&snA=31066 | 2026-04 |
| C8 | CN FFXIV bots are QQ bots on Koishi/NoneBot (Hamster, macrodict, lodestone, ffcafe/Universalis toolkit); no dye-lookup plugin found. | secondary | https://github-redirect.dependabot.com/AwesomeHamster/hatsushimo | accessed 2026-10-11 |
| C9 | QQ official bot requires real-name + face verification and an API IP allowlist (error 11298); home IPs break it. | secondary | https://developer.aliyun.com/article/1710410 | 2026 |
| C10 | No Kakao OpenChat bot API for third parties found; March 2026 Q&A says none exists. | secondary | https://bbojjak-library.gpters.org/qna/qna-16 | 2026-03 |
| C11 | No public API/bot/mini-program found for 石之家; only community scripts. | snippet | https://github.com/FF14CN/Sarean-arsenal | accessed 2026-10-11 |
| C12 | LINE Japan pricing: free 200 msgs, JPY 5,000 for 5,000, JPY 15,000 for 30,000; extra JPY 3 then 2.5 from 2026-10-01 (Japan only). Taiwan prices not verified. | secondary | https://www.lycbiz.com/jp/news/line-official-account/20260216/ | 2026-02-16 |


## Corrections to the 2026-10-04 refresh

- The refresh treats zh as mainland-only. A Traditional Chinese FFXIV service (宇峻奧汀 / 智寶國際; Taiwan, HK, Macau, Singapore, Malaysia) launched 2025-12-10, snippet-level sources [1][2].
- Its claim that zh-TW users are covered by the six locales is only nominally true: the repo maps zh-TW to Simplified zh (locale-resolution.ts:101-102).
- Its statement that no LINE FFXIV groups were found holds for Japan, but Taiwan has visible LINE OpenChat FFXIV rooms (443/579/211 members, snapshot).


## Open questions

- Does the TC client use official dye names that differ from the SC client, and where can the 125 names be obtained (client export or game data)?
- Which languages does the TC client ship (not confirmed)?
- Real size of the TC population (23,430 claim unsourced) and Taiwan LINE Official Account prices from tw.linebiz.com.
- Is xivdyetools.app reachable from mainland China (needs a mainland probe; WebFetch could not reach GreatFire)?
- Are there Japanese LINE OpenChat FFXIV rooms and their counts (needs in-app search)?
- Does Kakao provide any third-party OpenChat bot program, and does KOOK support native slash commands?
- Actual member counts of KR and JP Discord servers (disboard not reachable).
