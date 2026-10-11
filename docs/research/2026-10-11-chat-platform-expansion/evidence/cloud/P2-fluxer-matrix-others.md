> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P2: Fluxer, Matrix and other Discord-like platforms (checked 2026-10-11)

## Limits of this pass (read first)
- The sandbox could not reach fluxer.app, docs.fluxer.app, matrix.org, Wikipedia, Reddit or most third-party domains (DNS or proxy 403). Only github.com pages were fetchable. Anything below tagged "snippet" came from a search-result summary, not from the page itself. I could not re-read Fluxer's own roadmap or Matrix's blog; 07's reads of them (sources 50-54) stand.
- I found NO FFXIV community on Fluxer, Matrix, Spacebar, Root, TeamSpeak 6 or Zulip. Several searches returned nothing for those names (list in the FFXIV section). Absence of search hits is weak evidence because directories of these platforms are not well indexed. A search engine cannot query live room directories (matrixrooms.info, Element explorer, Fluxer discovery); someone with a browser has to run those.

## 1. Fluxer
**Status (primary, repo, 2026-10-11).** Active. The main repo fluxerapp/fluxer shows 10.5k stars, 801 forks, 1,823 commits, AGPL-3.0-or-later, and "host your own instance" in the README [1]. The 30 newest commits are dated Oct 10-11 and are fixes, refactors, self-host branding and media-proxy work; one touches "deleted bots" (#3390) and none mentions slash commands or interactions [2]. Releases are cut per service by CI, nearly all on 11 Oct [3]. The directory listing of packages/ shows no interactions or commands package, but the list was truncated [4].

**Slash commands, buttons, modals: not shipped; no date.** Snippet of the official roadmap: "slash commands, modals, buttons and other components, and interactions" are a 2026 item with no month [5]. A bot author merged a PR on 2026-09-28 saying the bot will move to native slash commands "once Fluxer ships them" [6]. A reference Dart bot live-tested on 2026-09-07 states "no slash commands / interactions at all" and found no /interactions or /commands path in the live OpenAPI spec (REST version 1.0.0) [7]. A GitHub discussion (snippet) says slash commands come after the v2 launch; v2 has since shipped, with no evidence they followed [5]. A Mintlify mirror lists an INTERACTION_CREATE gateway event, but it is an unofficial mirror and conflicts with the live-spec check; treat as unreliable (snippet) [8]. Net: 07's "planned, no date" still holds as of 2026-10-11.

**API shape.** REST follows OpenAPI 3.1 and the live spec is public (snippet via DeepWiki) [9]. Gateway WebSocket plus REST, Discord-shaped. Bots are created in a developer portal and use a token (fluxer.js install guide, snippet) [10]. Community SDKs exist in about 15 languages (21 libraries and 22 bots listed on awesome-fluxer) [11]. The mainstream JS SDK @fluxerjs/core documents prefix commands (`!`) as the pattern, plus EmbedBuilder, file attachments, reactions and a server-discovery application API [10]. fluxer.js v3.2.0 shipped 2026-10-02 (snippet) [12]. I did NOT verify whether discord.js or discord-api-types run against it. Because slash commands and interactions are absent, our HTTP-interactions Worker code cannot run; only a gateway prefix-command bot (the stoat-worker shape) is possible. There is no interactions endpoint URL.

**Incoming webhooks exist.** A Mintlify mirror documents `POST api.fluxer.app/v1/webhooks/{id}/{token}` with up to 10 Discord-style embeds, no bot token needed; a Gitea PR reports nine live deliveries returning 204 (snippets) [13]. Path variants conflict across sources. This is send-only; it cannot receive commands.

**Users.** "Nearly half a million registered" as of 2026-09-15, self-reported (cited in 07). Public beta began 2025-10-25 (snippet) [14]. No October figure found. Registered, not active.

**Age and region.** Per 07 [15] and a snippet of the help page (dated March 2026 in the snippet): UK adult verification is an optional $0.00 credit-card authorization; without it, NSFW channels and age-restricted communities are hidden but normal use works.

**E2EE: resolved.** The privacy policy (snippets of two copies, effective 2025-10-01) says "We are not end-to-end encrypted, but we use strong encryption for data in transit and at rest," and that data is not sold [16]. The roadmap lists "federation (E2EE)" and "secret chat (E2E, ephemeral)" as future items (snippet of a French summary quoting the blog) [17].

**Self-hosting.** Supported; recent commits are about self-host branding and SMTP. Desktop multi-instance sign-in and an "Operator Pass" were planned for early October (snippet) [18]. Not researched: Swedish operator duties.

**Rate limits, attachment size limits: not found.** No documented numbers in anything I could read.

**FFXIV presence: none found.** awesome-fluxer lists 22 bots; the only gaming ones are Fluxmon, a counting game and GameHound (free-game alerts); no FFXIV bot [11]. Searches for Fluxer FFXIV servers and fluxer.gg FFXIV invites returned nothing. Fluxer server discovery exists as an application API, but no directory contents were reachable [10].

## 2. Matrix
- **Spec:** v1.19 (2026-07-08) is still the latest I can find; no v1.20 found (snippet) [19]. Weekly notes through 2026-10-09 mention MSC4140 (delayed events) merged and conference prep (Malmo, 20-22 Oct) [20].
- **MSC4391 (in-room bot commands), repo read:** still open; labeled implementation-needs-checking; last activity 2026-08-09. It does define typed argument schemas (optional args, primitives, literals, unions, arrays). It does NOT define autocomplete or partial commands; those are deferred to a follow-up MSC. No buttons. Implementations merged in gomuks and mautrix-go; meowlnir implementation status unknown; Sable support request open [21]. Correction to 07: autocomplete is not part of MSC4391 at all.
- **Buttons:** MSC3006 (bot interactions: client-rendered buttons from a state event, click sends a normal message) is the relevant proposal; status unknown, only a Dec 2024 mention found (snippet) [22].
- **matrix.org age verification:** no decision found; latest public statement remains Feb 2026 "evaluating options" [23]. Other homeservers set their own rules.
- **Bots and E2EE:** Element's enforcement of MSC4153 (hide messages from non-cross-signed devices) was pushed from April to October 2026 (snippet of This Week in Matrix 2026-04-10) [24]. A bot or bridge in an encrypted room must self-sign its device, or Element users will not see its messages. maubot and mautrix-python can verify with a recovery key (snippet) [24]. Not verified: whether enforcement actually took effect in October.
- **FFXIV presence: none found.** Searches for FFXIV Matrix rooms/spaces and view.matrix.org / matrixrooms.info returned unrelated rooms. No FFXIV Discord bridge found; mautrix-discord (puppeting, needs a Discord account per user) is the generic bridge [25].

## 3. Others
- **Spacebar:** docs claim Discord-bot compatibility by changing endpoints [26]. The interactions callback route is still 9 empty TODOs; issue #1600 last commented 2026-09-06, open; maintainers reject AI-assisted PRs [27]. A Feb 2026 community post lists E2EE and the full REST API as incomplete (snippet). No public instance found. FFXIV: none found.
- **Root:** bots run only on Root's servers; docs describe event listening and per-bot SQLite; no inbound webhook found (snippet) [28]. Imports Discord server structure but not messages/members [28]. FFXIV: none found.
- **TeamSpeak 6:** still beta; newest 6.0.0-beta13.1 on 2026-09-22; ServerQuery SSH and Web Query HTTP exist but are admin interfaces, not a chat-bot API [29]. Reported a user surge in Feb 2026 (snippet) [30]. FFXIV: none found.
- **Guilded:** closed 2025-12-19; Roblox points users to Roblox Communities (snippet) [31]. An FFXIV recruitment subreddit's tag list offered [Discord] and [Guilded] only (snippet), a sign of what FFXIV groups used, now gone [32].
- **Steam Chat:** no official bot API; only unofficial libraries (steam-user), with account limits and last-published dates years old (snippet) [33]. FFXIV is on Steam, but no evidence of FFXIV groups using it for chat.
- **Stoat:** a staff blog snippet says 1.4 million users (date unconfirmed; 07 had 1M registered at 2026-03-29) [34]. Still no FFXIV server found.
- **Zulip, Jami, IRC, Revolt forks:** not searched beyond 07; no FFXIV evidence found.
- **New entrants since 2026-10-04:** a search for Discord-alternative news in October 2026 returned only generic roundups and the TechCrunch 2026-09-22 piece on Discord's rollout [35]. No new entrant with traction found.

## FFXIV presence: what I searched
FFXIV + Fluxer / fluxer.gg / Matrix room / matrixrooms / view.matrix.org / Stoat / Revolt / Guilded / TeamSpeak / Steam Chat; "FFXIV leaving Discord alternatives". All returned nothing relevant. Only Discord evidence surfaced (an "FFXIV Community" Discord server listing, about 2,600 members, snippet) [36].

## Sources
[1] https://github.com/fluxerapp/fluxer (accessed 2026-10-11)
[2] https://github.com/fluxerapp/fluxer/commits/main (accessed 2026-10-11)
[3] https://github.com/fluxerapp/fluxer/releases (accessed 2026-10-11)
[4] https://github.com/fluxerapp/fluxer/tree/main/packages (accessed 2026-10-11)
[5] https://fluxer.app/blog/roadmap-2026 (snippet via search, 2026-10-11)
[6] https://github.com/Ferdinand99/Sylo-Fluxer/pull/12 (merged 2026-09-28)
[7] https://github.com/oppahansi/fluxer_dart_bot (live test 2026-09-07)
[8] https://fluxerapp-fluxer.mintlify.app/bots/overview (snippet; unofficial mirror)
[9] https://deepwiki.com/fluxerapp/fluxer/9.1-rest-api (snippet)
[10] https://fluxer.js.org/guides/ and https://fluxer.js.org/guides/server-discovery/ (snippets)
[11] https://github.com/awesome-fluxer/awesome-fluxer (accessed 2026-10-11)
[12] https://fluxer.js.org/changelog/ (snippet)
[13] https://fluxerapp-fluxer.mintlify.app/bots/webhooks ; https://github.com/go-gitea/gitea/pull/39569 (snippets)
[14] https://fluxer.app/blog/mobile-clients-and-fluxer-v2 (cited by 07 as source 54); beta date from https://en.wikipedia.org/wiki/Fluxer (snippet)
[15] https://fluxer.app/help/regional-restrictions (07 source 52; snippet)
[16] https://fluxer.app/privacy and https://canary.fluxer.app/privacy (snippets)
[17] https://www.threads.com/@velvetshadow.fr/post/DU1rorSAqkZ (secondary summary of the roadmap)
[18] Roadmap snippet via search "Fluxer changelog October 2026"
[19] https://matrix.org/blog/2026/07/08/matrix-v1.19-release/ (snippet)
[20] https://matrix.org/blog/2026/10/09/this-week-in-matrix-2026-10-09/ (snippet)
[21] https://github.com/matrix-org/matrix-spec-proposals/pull/4391 (accessed 2026-10-11)
[22] https://matrix.org/blog/2024/12/13/this-week-in-matrix-2024-12-13/ (snippet)
[23] https://matrix.org/blog/2026/02/welcome-discord/ (snippet)
[24] https://matrix.org/blog/2026/04/10/this-week-in-matrix-2026-04-10/ ; https://matrix.org/blog/2025/11/exclude-insecure-devices/ ; https://github.com/wappensc/tdsp/issues/27 (snippets)
[25] https://matrix.org/ecosystem/bridges/discord (snippet)
[26] https://docs.spacebar.chat/setup/bots (snippet)
[27] https://github.com/spacebarchat/server/issues/1600 (accessed 2026-10-11)
[28] https://docs.rootapp.com/docs/overview/choose-app-or-bot/ ; https://www.nettosgameroom.com/2026/02/discord-alternative-root-allows-users.html (snippets)
[29] https://github.com/teamspeak/teamspeak6-server/releases (accessed 2026-10-11)
[30] https://www.notebookcheck.net/TeamSpeak-confirms-an-incredible-surge-of-new-users-as-Discord-users-look-for-alternatives.1228647.0.html (Feb 2026, snippet)
[31] https://alternativeto.net/news/2025/11/guilded-to-shut-down-on-december-19-2025-as-focus-shifts-to-roblox-communities/ (snippet)
[32] https://lr.sudovanilla.org/r/FFXIVRECRUITMENT/hot (Reddit mirror, snippet, 2024)
[33] https://developer.valvesoftware.com/wiki/Steam_Chat ; https://npmjs.com/package/steam-chat-bot (snippets)
[34] https://vale.rocks/portfolio/stoat (snippet, undated)
[35] https://techcrunch.com/2026/09/22/discords-age-verification-era-is-upon-us-despite-community-backlash/ (snippet)
[36] https://discord.com/servers/final-fantasy-xiv-community-1148107306547032085 (snippet)


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Fluxer | none-found — No FFXIV server, invite or bot found via search; awesome-fluxer lists no FFXIV bot; discovery directory contents unreachable | Poor: persistent gateway WebSocket needs a Node host or Durable Object relay; no HTTP interactions endpoint; incoming webhooks are send-only | watch: re-check when interactions ship; do not build before then | 5-6.5 as gateway prefix bot (estimate from 07, not re-derived) | Active, AGPL, about 500k registered accounts, but no slash commands, buttons or interactions (live spec check 2026-09-07, roadmap says only 2026) and no FFXIV audience evidence. A prefix bot would be a second stoat-worker with fewer users. |
| Matrix | none-found — Searches for FFXIV rooms/spaces/bridges returned nothing; live room directories not reachable from this environment | Poor: /sync long-poll needs a persistent host; appservice push needs a homeserver we run | skip for now; spike only if a poll or directory check shows real FFXIV rooms | 5.5-7.5 plus homeserver ops and 1-2 for E2EE (07 estimate) | MSC4391 still open and lacks autocomplete and buttons; MSC4153 enforcement makes E2EE bots need device self-signing; matrix.org age decision unresolved. No FFXIV evidence. |
| Spacebar | none-found — No public instance found | Poor: interactions callback unimplemented (9 empty TODOs); gateway only | skip | n/a | Interactions unimplemented as of 2026-09-06; no public instance; slow project. |
| Root | none-found — None found in search | None: bots run in Root's cloud, no inbound webhook found | skip | n/a | Cannot be hosted on our infrastructure. |
| TeamSpeak 6 | none-found — None found; Feb 2026 surge reported but no FFXIV link | None: still beta, admin-only query APIs, voice-first | skip | n/a | No chat bot API; beta13.1 on 2026-09-22. |
| Guilded | small — Listed as a recruitment tag on an FFXIV recruitment subreddit (snippet, 2024), but closed 2025-12-19 | n/a | skip (closed) | n/a | Shut down; Roblox Communities is the stated successor and has no FFXIV relevance. |
| Steam Chat | unknown — No evidence of FFXIV groups using Steam Chat | None: no official API | skip | n/a | Only unofficial libraries; account and ToS risk. |
| Jami / IRC / Zulip / Revolt forks | none-found — Not searched beyond 07; no FFXIV evidence encountered | Zulip push fits but only on @-mention (per 07); IRC needs persistent connection | skip | n/a | No audience evidence and nothing new since 07. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| F1 | Fluxer slash commands, buttons, modals and interactions are NOT shipped as of 2026-10-11; roadmap says only '2026', no month | snippet | https://fluxer.app/blog/roadmap-2026 | accessed 2026-10-11 |
| F2 | Reference Dart bot live-tested 2026-09-07 found no /interactions or /commands path in Fluxer's live OpenAPI spec and states no slash commands/interactions at all | secondary | https://github.com/oppahansi/fluxer_dart_bot | 2026-09-07 |
| F3 | Bot author merged PR on 2026-09-28 saying native slash commands will come 'once Fluxer ships them' | secondary | https://github.com/Ferdinand99/Sylo-Fluxer/pull/12 | 2026-09-28 |
| F4 | fluxerapp/fluxer is very active: 10.5k stars, AGPL-3.0, 1,823 commits, commits and per-service releases daily through 2026-10-11; recent work is fixes, self-host branding, media proxy; no interactions commits in the latest 30 | primary | https://github.com/fluxerapp/fluxer/commits/main | 2026-10-11 |
| F5 | Fluxer privacy policy states it is not end-to-end encrypted (encryption in transit and at rest only); E2EE appears only as future roadmap items | snippet | https://fluxer.app/privacy | policy effective 2025-10-01 |
| F6 | Fluxer supports Discord-style incoming webhooks with up to 10 embeds (send-only, token in URL); exact path varies across sources | snippet | https://fluxerapp-fluxer.mintlify.app/bots/webhooks | accessed 2026-10-11 |
| F7 | Fluxer user figure remains 'nearly half a million registered' as of 2026-09-15 (self-reported); no October figure found | secondary | https://fluxer.app/blog/mobile-clients-and-fluxer-v2 | 2026-09-15 |
| F8 | awesome-fluxer lists 21 libraries and 22 bots; no FFXIV bot; gaming bots are Fluxmon, counting game, GameHound | primary | https://github.com/awesome-fluxer/awesome-fluxer | accessed 2026-10-11 |
| M1 | MSC4391 (in-room bot commands) is still open, last activity 2026-08-09; defines typed argument schemas but NOT autocomplete or partial commands; no buttons | primary | https://github.com/matrix-org/matrix-spec-proposals/pull/4391 | 2026-08-09 |
| M2 | Matrix spec latest remains v1.19 (2026-07-08); no v1.20 found | snippet | https://matrix.org/blog/2026/07/08/matrix-v1.19-release/ | 2026-07-08 |
| M3 | Element's enforcement of MSC4153 (hide messages from non-cross-signed devices) was delayed from April to October 2026; bots in encrypted rooms must self-sign devices or their messages are hidden in Element | snippet | https://matrix.org/blog/2026/04/10/this-week-in-matrix-2026-04-10/ | 2026-04-10 |
| M4 | No matrix.org age-verification decision found; last statement 2026-02-12 'evaluating options' | snippet | https://matrix.org/blog/2026/02/welcome-discord/ | 2026-02-12 |
| M5 | No FFXIV Matrix room, space or Discord bridge found by search; live room directories were not reachable from this environment | unverified | search: FFXIV Matrix room / matrixrooms.info / view.matrix.org | 2026-10-11 |
| O1 | Spacebar interactions callback route still has 9 empty TODOs; issue #1600 open, last comment 2026-09-06; maintainers reject AI-assisted PRs; no public instance found | primary | https://github.com/spacebarchat/server/issues/1600 | 2026-09-06 |
| O2 | TeamSpeak 6 server is still beta: 6.0.0-beta13.1 on 2026-09-22; ServerQuery/Web Query are admin APIs, no chat bot API documented | primary | https://github.com/teamspeak/teamspeak6-server/releases | 2026-09-22 |
| O3 | Guilded closed 2025-12-19; Roblox directs communities to Roblox Communities; no successor with FFXIV traction found | snippet | https://alternativeto.net/news/2025/11/guilded-to-shut-down-on-december-19-2025-as-focus-shifts-to-roblox-communities/ | 2025-11 |
| O4 | Steam Chat has no official bot API; only unofficial libraries (steam-user, steam-chat-bot last published years ago) requiring a bot account that owns a game | snippet | https://developer.valvesoftware.com/wiki/Steam_Chat | accessed 2026-10-11 |
| O5 | Root bots run only on Root's servers; no inbound webhook found in docs | snippet | https://docs.rootapp.com/docs/overview/choose-app-or-bot/ | accessed 2026-10-11 |
| S1 | A Stoat team blog snippet gives 1.4 million users (undated; 07 had 1M registered on 2026-03-29) | snippet | https://vale.rocks/portfolio/stoat | undated |
| P1 | Searches for FFXIV communities on Fluxer, Matrix, Stoat, Guilded, TeamSpeak and Steam Chat found none; only Discord appears (an FFXIV Community Discord listing of about 2,600 members) | snippet | https://discord.com/servers/final-fantasy-xiv-community-1148107306547032085 | accessed 2026-10-11 |


## Corrections to the 2026-10-04 refresh

- 07 says Matrix autocomplete is possible 'only if MSC4391 is adopted'. MSC4391 defines typed argument schemas but explicitly defers autocomplete and partial commands to a follow-up MSC (https://github.com/matrix-org/matrix-spec-proposals/pull/4391, read 2026-10-11).
- 07's Fluxer E2EE cell is '(verify)'. Fluxer's privacy policy says it is not end-to-end encrypted (snippet of fluxer.app/privacy); E2EE is only a future roadmap item.
- 07 cites Spacebar issue #1600 as dated 2026-03-17. That is the open date; last comment is 2026-09-06 and it is still open with 9 empty interaction TODOs.
- 07's Fluxer row omits that incoming webhooks with Discord-style embeds exist (send-only, snippet-level evidence).
- 07's Matrix row omits MSC4153: Element's enforcement of hiding messages from non-cross-signed devices was delayed to October 2026, which affects E2EE bots (snippet; actual enforcement unverified).
- 07's Stoat row has 1M registered at 2026-03-29; an undated staff-blog snippet now says 1.4M users (unverified date).


## Open questions

- Fluxer: does the live OpenAPI spec now contain interactions or application-command routes? fluxer.app and docs.fluxer.app were unreachable; needs a browser check of the spec.
- Fluxer rate limits and attachment size limits: not found anywhere.
- Matrix: run a real room-directory search (Element explorer, matrixrooms.info) for FFXIV, Eorzea, Final Fantasy; the search engine cannot query live directories.
- Did Element actually enforce MSC4153 in October 2026, and did matrix.org announce an age-verification method?
- Fluxer server discovery: any FFXIV or Square Enix game communities listed? Unreachable from here.
- Where do FFXIV players actually gather besides Discord? Nothing found here; the 07 poll is still the best instrument, plus manual checks of Lodestone Community Finder entries for non-Discord links.
- Is the Stoat 1.4M user figure real and what date? Not confirmed.
