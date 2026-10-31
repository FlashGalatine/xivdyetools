> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P4 — Social and forum surfaces (research as of 2026-10-11)

> Privacy minimization 2026-10-29: individual examples and per-record measurements were removed. Remaining platform claims retain their original cloud-phase grades; see [the aggregate census](../bluesky-census/README.md#redaction).

## Method and limits
Direct page fetches were blocked in this session. WebFetch refused developers.reddit.com and failed DNS on four other hosts. Raw HTTPS through the proxy returned 403 for public.api.bsky.app, docs.bsky.app and socialblade.com. So almost everything here comes from WebSearch result summaries, many of them from third-party blogs or mirrors. Labels reflect that: very little is "primary". Where a source is a mirror or a blog, it is marked. I used about 15 searches and 3 fetch attempts. Nothing was filled from memory. The checkout file `docs/research/discord-alternatives/07-2026-10-refresh.md` §6 (lines 304-323) is the baseline [1].

## 1. Reddit (Devvit)
**Devvit Web docs.** The only copies the search surfaced were on an unofficial `trycloudflare.com` mirror of the docs, not developers.reddit.com [2]. Treat these points as secondary until checked on the official site:
- Fetch is server-side only, and each domain must be requested per app in `devvit.json`. Entries are exact hostnames: no wildcards, protocols or paths. Requests go to admin review when you playtest or upload. One doc version says review takes about 1-2 business days. A community post said reviews paused 2025-12-23 to 2026-01-04 [2].
- Comment and post triggers (`onCommentCreate`, `onCommentSubmit`) are declared under `triggers` in `devvit.json` [2].
- Media upload: enable the `media` permission. `media.upload()` takes a remote URL or data URL and returns a media ID plus a Reddit CDN URL. The 0.11 docs showed that ID going into `RichTextBuilder().image()` and then `submitComment`. The 0.11 limit was 20 MB. A devvit-docs PR (#178) suggests the type list is image or GIF only, with video removed [2][3].
- This answers 07's "image posting unverified": an image in a comment looks supported. It needs a check on the official page.
- Review and install: a third-party guide (about 50 days old) says playtest subreddits must have fewer than 200 subscribers and `devvit publish` submits for launch review. Unlisted apps can be installed on larger subreddits you moderate, and a README is required [4]. Unconfirmed against official docs.

**Could a moderator-installed app answer "!dye Snow White" with a card?** Technically plausible: trigger on comment, call our API via an approved domain, upload the PNG with `media.upload`, post a reply as the app account. The fetch allowlist needs `api.xivdyetools.app` or similar approved per app. This is inferred from [2], not tested. A moderator on each target subreddit must install it. Open questions: whether the app account may reply with an image where the subreddit disallows image comments, and whether Reddit approves a third-party domain for an unaffiliated app.

**Data API policy.** Search results conflict, and none are Reddit primary sources [5]:
- Some blogs say apps must register by 2026-09-30 (as 07 reported).
- Coverage of a 2026-09-30 announcement says RSS stops 2026-11-13 and public Data API access closes in March 2027. It also gives 2026-10-31 as the last day for new public API access requests and 2026-11-30 as the deadline to register an existing app for a porting bounty. Another source says approved third-party apps and bots must register by 2027-01-12.
- So 07's 2026-09-30 date looks superseded or reframed, but the later dates are unconfirmed. A Devvit app runs inside Reddit and does not use the external Data API, which is a point in its favor if the closure is real.

**FFXIV subreddits.** r/ffxiv shows 1.3M members on GummySearch (the tracker closed 2025-11-30, so the number predates that) [6]. 07 cited 1.4M, updated 2026-09-30 [1]. I found no member counts for r/ffxivglamours or r/ffxivdiscussion. GummySearch lists r/ffxivart at 31k and r/FFXIVRECRUITMENT at 59k [6]. r/ffxiv's rules (via an unofficial mirror) bar third-party tools that alter core gameplay, and moderators verify outside resource sites such as XIVDB through modmail with a special flair [7]. That verification route is a possible precedent for a tool bot. I found no existing FFXIV Lodestone or news bot on Reddit (searched r/ffxiv rules and bot terms).

## 2. Bluesky
- Users: 45M registered as of June 2026 (company figure, via blog) and 46.7M on 2026-09-26 (a tracker) [8]. Bluesky publishes no official MAU. Similarweb mobile MAU is about 10.4M in June 2026, down more than 50% from a late-2024 peak near 22M. Mobile DAU is about 3M in July 2026, down 25.6% year over year [8][9]. Third-party MAU estimates range up to 27.5M.
- Bot rules (docs mirror and blog quoting official docs): self-label the profile `bot`. Bots that reply to, like or repost others should do so only when tagged, as an opt-in. Rate limit is 5,000 points per hour and 35,000 per day, with create costing 3 points [10]. This matches 07's "reply only when tagged" advice. I found nothing on the chat/DM API for bots, or on any age-assurance change since 07.
- Square Enix presence: June 2025 coverage says Square Enix opened four FFXIV accounts in English, French, German and Japanese [11]. A search snippet shows the English account as `en.finalfantasyxiv.com` with a post dated 2026-10-09, so it is active [12]. A snippet gave "100,541" for that account but called it a follow count. It is ambiguous and I could not confirm whether it means followers. Do not cite it as followers.
- Community: GPOSERS has an organization presence [13]. The directory lists 53+ FFXIV starter packs as of June 2026. Individual creator-owned feeds, titles, sample packs and per-record figures were removed for privacy; use the later cohort aggregates.
- X comparison: the last public figure found for the English X account is about 437k followers (July 2023, a tracker, stale) [14]. I found no JP/FR/DE X follower counts.

## 3. Mastodon / Misskey
- ffxiv-mastodon.com: a Japanese-language FF14 Mastodon server, 235 active users on a listing about two years old [15]. mastodonservers.net lists "Mastodon for FFXIV Server" with 131 users on Mastodon 3.5.3, likely stale [15]. Elekk.xyz was FFXIV-focused in 2018 and may be dead [15].
- A Lodestone blog post describes a Misskey-based FFXIV "Eostagram" (a Japanese player's project). No user count [16].
- misskey.io had over 450k registered users in February 2024 [16].
- Conclusion: tiny dedicated instances (low hundreds). The audience on general instances cannot be measured. Bot conventions and webhook details were not re-researched beyond 07.

## 4. Threads
Webhook topics include mentions, replies and publish. Mentions on a public post tagging the bot's account are delivered. Apps need App Review (Advanced Access), and `threads_read_replies` for the reply fields. Private accounts' media does not trigger mentions [17]. Reply-approval management was added in February 2026 [17]. Image upload and publishing details (JPEG/PNG/WebP up to 20 MB) come only from a third-party guide, and reply-with-image is unverified. I found no official FFXIV Threads account. Search for one returned only Steam and Square Enix forum pages.

## 5. X
Since 2026-02-23, API replies are allowed only when the original author mentioned or quoted the replying account (Free, Basic, Pro and Pay-Per-Use; Enterprise and public-utility apps reportedly exempt) [18]. Pay-per-use: summoned reply $0.010, post with a URL $0.20 from 2026-04-20 [18]. One blog says AI reply bots need prior written approval, unconfirmed [18]. No change dated after 2026-10-04 was found. Official-account follower counts by region: not found beyond the stale EN figure above.

## 6. Tumblr
Searches returned only generic API and automation-vendor pages. No evidence of an FFXIV glamour community on Tumblr in this evidence, and no bot-friendly mention mechanism was found. Drop it.

## Sources
[1] /home/user/xivdyetools/docs/research/discord-alternatives/07-2026-10-refresh.md:304-323 (repo)
[2] Devvit docs mirror (unofficial), accessed 2026-10-11: https://tourism-pro-counties-prototype.trycloudflare.com/docs/capabilities/server/http-fetch and /media-uploads, /triggers
[3] https://github.com/reddit/devvit-docs/pull/178/files
[4] https://karmium.com/guides/devvit/ (third-party, about Aug 2026)
[5] https://ppc.land/reddit-to-halt-public-data-api-access-in-march-2027-as-14-000-apps-register/ ; https://creuto.com/reddit-data-api-registration-developer-platform-2026 (secondary)
[6] https://gummysearch.com/r/ffxiv/ , /r/ffxivart/ , /r/FFXIVRECRUITMENT/
[7] https://reddit.birdcat.cafe/r/ffxiv/wiki/rules ; https://lr.in.psf.lt/r/ffxiv/wiki/meta (mirrors)
[8] https://proxidize.com/blog/bluesky-user-count-2026/ ; https://tech.slashdot.org/story/26/08/16/0326249/
[9] https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/ (via 07)
[10] https://docs.bsky.app/docs/starter-templates/bots ; https://docs.bsky.app/blog/rate-limits-pds-v3 (via search snippets)
[11] https://thefilibusterblog.com/ffxiv-launches-new-social-media-presence-on-bluesky/ (June 2025)
[12] https://bsky.app/profile/en.finalfantasyxiv.com ; [URL removed: names an individual] (snippets)
[13] https://bsky.app/profile/gposers.org ; https://blueskystarterpack.com/ffxiv ; https://ffxivtobluesky.carrd.co/
[14] https://www.speakrj.com/audit/report/FF_XIV_EN/twitter (July 2023)
[15] https://ffxiv-mastodon.com/ ; https://mastodonservers.net/server/633-mastodon-for-ffxiv-server ; https://aggronaut.com/2018/12/19/mmorpg-social/
[16] [URL removed: names an individual] ; https://en.wikipedia.org/wiki/Misskey
[17] https://developers.facebook.com/documentation/threads/webhooks ; https://developers.facebook.com/blog/post/2026/04/14/whats-new-in-the-threads-api/ (snippets)
[18] https://piunikaweb.com/2026/02/24/x-api-blocks-automated-spam-replies/ ; https://opentweet.io/blog/x-api-link-post-fee ; https://vorplabs.com/agent-tools/x-api


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Reddit (Devvit) | large — r/ffxiv about 1.3-1.4M members (GummySearch, closed 2025-11-30; 07 says 1.4M on 2026-09-30). r/ffxivglamours count not found. | Runs on Reddit; calls api-worker via an approved domain, which fits a stateless HTTP route. | spike. Only with moderator buy-in on r/ffxivglamours; check official Devvit docs and domain approval first. | 3-5 (07 said L) | Largest FFXIV text community found, and the glamour subreddit is a natural dye audience. Mention-style comments with image replies look feasible via media.upload. Moderators must install the app, and domain review and the Data API closure are outside our control. |
| Bluesky | small — Official EN/FR/DE/JA Square Enix accounts (launched 2025-06, EN active 2026-10-09); GPOSERS feed with about 9-14 likes per post; 53+ starter packs; platform mobile MAU about 10.4M and falling. | Cron poll of notifications on a Worker; no webhook push. | build-if-asked. Cheapest bot, and mention-only replies fit the rules. | 3.5-5 first platform, 1.5-2.5 after shared work (from 07) | Real FFXIV and gposer presence, bot rules permit tagged replies, cost is a cron poll. Audience is small and the platform is shrinking. |
| Mastodon / Misskey / Sharkey | tiny — ffxiv-mastodon.com 235 active users (about 2024); another listed FFXIV server 131 users; no Misskey FFXIV instance with counts found. | Cron or Misskey webhooks would work, but no demand evidence. | skip. Revisit only if a community asks. | M (07), unchanged | Dedicated instances have a few hundred users, and the general-instance audience is unmeasurable. The EU age-verification draft in 07 adds risk. |
| Threads | none-found — Searched for an official FFXIV or Square Enix Threads account and FFXIV community; nothing relevant returned. | Webhook delivery would fit a Worker, if approved. | skip | unknown | Mention webhooks exist but need Advanced Access App Review, and image-reply publishing is unverified. No audience evidence. |
| X | large — Official EN account about 437k followers (tracker, July 2023, stale); JP/FR/DE counts not found. | Poll or webhook on a Worker is workable. | watch. Low priority; image replies only if a poll asks. | M (07) | The audience is large, but replies are restricted to authors who mentioned the bot, pay per call, and posts with URLs cost $0.20. No change since 2026-10-04 found. |
| Tumblr | none-found — Search for an FFXIV glamour community on Tumblr returned nothing relevant. | Poll only. | skip | M (07) | No evidence of audience or a mention mechanism for bots; 07 verdict stands. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | Devvit allows a server-side media.upload (URL or data URL) returning a Reddit-hosted asset whose ID can be placed in a rich-text comment; 0.11 docs cite 20 MB limit | secondary | https://tourism-pro-counties-prototype.trycloudflare.com/docs/capabilities/server/media-uploads | accessed 2026-10-11 (unofficial docs mirror) |
| C2 | Devvit fetch needs per-app, exact-hostname domain requests reviewed by Reddit admins (about 1-2 business days per one doc version); no wildcards | secondary | https://tourism-pro-counties-prototype.trycloudflare.com/docs/capabilities/server/http-fetch | accessed 2026-10-11 (mirror) |
| C3 | Reddit Data API timeline reported differently by blogs: 2026-09-30 registration (07) vs a 2026-09-30 announcement with RSS end 2026-11-13, new public access requests closing 2026-10-31, public API closing March 2027, registration by 2027-01-12; no Reddit primary found | secondary | https://ppc.land/reddit-to-halt-public-data-api-access-in-march-2027-as-14-000-apps-register/ | 2026-09-30 or later |
| C4 | r/ffxiv about 1.3M members on GummySearch (tracker closed 2025-11-30); 07 cites 1.4M (2026-09-30). No counts found for r/ffxivglamours or r/ffxivdiscussion | secondary | https://gummysearch.com/r/ffxiv/ | 2025-11 or earlier |
| C5 | Square Enix runs four FFXIV Bluesky accounts (EN/FR/DE/JA), launched June 2025; EN account en.finalfantasyxiv.com posted 2026-10-09 | snippet | https://bsky.app/profile/en.finalfantasyxiv.com | 2025-06 and 2026-10-09 |
| C6 | Bluesky bot guidance: self-label bot; reply/like/repost only when tagged (opt-in); 5,000 points/hour, 35,000/day, create=3 points | snippet | https://docs.bsky.app/docs/starter-templates/bots | accessed 2026-10-11 |
| C7 | Bluesky 45M registered (June 2026), 46.7M (2026-09-26); Similarweb mobile MAU about 10.4M (June 2026), mobile DAU about 3M (July 2026, down 25.6% YoY) | secondary | https://proxidize.com/blog/bluesky-user-count-2026/ | 2026-08 to 2026-09 |
| C8 | FFXIV-specific Mastodon instances are tiny: ffxiv-mastodon.com 235 active users (listing about 2 years old); another listing 131 users | snippet | https://ffxiv-mastodon.com/ | about 2024 |
| C9 | Threads webhooks deliver mentions of a public post tagging the app user; App Review (Advanced Access) and threads_read_replies required; private accounts excluded | snippet | https://developers.facebook.com/documentation/threads/webhooks | 2026-04 |
| C10 | X programmatic replies are limited since 2026-02-23 to posts where the author mentioned/quoted the bot; summoned reply $0.010, URL post $0.20 (from 2026-04-20); no change after 2026-10-04 found | secondary | https://piunikaweb.com/2026/02/24/x-api-blocks-automated-spam-replies/ | 2026-02-24 |


## Corrections to the 2026-10-04 refresh

- 07 §6 says the Reddit registration deadline of 2026-09-30 'may have passed': secondary sources now describe a later schedule (new public API access requests close 2026-10-31, registration by 2026-11-30 for a bounty or by 2027-01-12, public API closing March 2027). None is a Reddit primary source (ppc.land / digitalapplied, accessed via search).
- 07 says Devvit image posting is unverified: unofficial docs mirror shows media.upload plus RichTextBuilder().image() in comments (20 MB per the 0.11 docs), so likely supported.
- 07 says a Japanese FFXIV Mastodon instance exists but is unnamed: it appears to be ffxiv-mastodon.com (235 active users on an older listing).
- 07's r/ffxiv 1.4M figure: GummySearch lists 1.3M and closed 2025-11-30; the 1.4M figure could not be reproduced in this session.


## Open questions

- Official developers.reddit.com pages (http-fetch, media-uploads, triggers, review policy) could not be fetched; verify there, and find Reddit's own post on the Data API closure.
- r/ffxivglamours and r/ffxivdiscussion member counts and their bot rules.
- Whether official Square Enix Bluesky accounts' follower counts are known (live bsky.app profile pages were blocked); same for JP/FR/DE X accounts.
- Bluesky chat/DM API bot rules and any age-assurance impact on bots: nothing found.
- Whether Threads reply publishing supports images, and whether any FFXIV Threads community exists.
- Misskey/Sharkey FFXIV instances: servers.misskey.ink and joinmastodon directories were not reachable to check.
