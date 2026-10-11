> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# P3: Streaming chat (Twitch, YouTube Live, Kick, stream-bot custom commands), research as of 2026-10-11

## 0. Evidence limits (read first)
- Direct page fetches were blocked in this session. The egress proxy returned 403 on CONNECT to dev.twitch.tv, and WebFetch failed DNS on every host. Everything below external comes from WebSearch result summaries, not from reading the primary pages. I label those `snippet` (summary of an official page) or `secondary` (third-party). Nothing is labeled `primary` for that reason; the URLs are official pages, but I did not read them directly.
- Not found despite searching: Nightbot urlfetch timeout and user-agent, Nightbot/StreamElements/Fossabot egress IPs, Fossabot customapi docs, Kick app-review rules, Kick FFXIV category numbers, YouTube FFXIV category numbers, Twitch Extension panel size and asset limits. These stay unverified.
- Repo facts were read directly in this checkout.

## 1. Twitch chat bot
**Receive side.** Twitch's docs say EventSub webhook transport works only with an app access token, and Twitch pitches webhooks for cloud-hosted chatbots [1][2]. For `channel.chat.message` the subscription needs `user:read:chat` and `user:bot` on the bot user, plus either the bot being a moderator in the channel or `channel:bot` granted by the broadcaster [3]. The condition is `broadcaster_user_id` plus the bot's `user_id` [2]. One forum thread notes the docs are confusingly worded about scopes on app tokens [3]. Another source says the bot's tokens need `user:read:chat`, `user:write:chat`, `user:bot` [4]. Test before committing to either reading.

**Signing.** HMAC-SHA256 over message-id + timestamp + raw body, keyed with the subscription secret (10-100 ASCII chars), compared to the `Twitch-Eventsub-Message-Signature` header (`sha256=` plus hex). Delivery is at-least-once, so dedupe on message ID. The challenge reply is 200 with the raw challenge as text/plain [5][6]. The "respond within N seconds" deadline was not confirmed. All of this is doable in a Worker with `crypto.subtle` and the raw body (my inference, not sourced).

**Send side.** `POST https://api.twitch.tv/helix/chat/messages` with `broadcaster_id` and `sender_id` [2]. Minimum `user:write:chat`; with an app access token it also needs `user:bot` from the chatting user, plus moderator status or `channel:bot` from the broadcaster [7]. So a Worker needs: the bot account's one-time user OAuth (to grant `user:bot`), an app token (client credentials, easy in a Worker), and each streamer's one-time `channel:bot` consent. Messages sent with an app token and `user:bot` get the Chat Bot badge in that flow (from memory of Twitch's announcement; not verified in these results). The 500-character limit was not confirmed in search (I recall it; unverified). Images are not possible in Twitch chat; the alternative is a link to a hosted card or og image page.

**Rate limits.** Send Chat Message has its own bucket and does not consume the regular bucket [8]. The regular chat limit is 20 messages per 30 s, 100 per 30 s if the bot is broadcaster/mod/VIP; exceeding it gets the bot ignored for 1 hour [8]. A third-party library says verified bots get 7,500 per 30 s [9] (secondary). Twitch says chatbot verification reviews are still paused and verified status is rarely granted [8][10]. The 2025-12-09 minimum-age change is from 07 and was not rechecked.

**IRC.** Twitch lists IRC as active with no end date; insecure IRC websockets were shut off in August 2025 [11]. Twitch steers new bots to EventSub plus the API. Streamer.bot dropped IRC for EventSub in v1.0.5 (August 2026 changelog) [12].

**Worker fit: good for receive and send.** No gateway or persistent socket needed (webhook + REST). Costs: a D1/KV table of channels that have authorized the bot, token refresh for the bot's user token, subscription management, and a text-only reply path.

## 2. Twitch Extension
Types: panel (under the video), video overlay (desktop only, one per channel), video component [13]. Extensions run in a sandboxed iframe, must be static pages (no SSR), and any backend must be HTTPS [13]. Lifecycle: Local Test, upload zip to Twitch CDN, Hosted Test, Review [14]. Review covers metadata, policy, functional, and code; all front-end HTML/CSS/JS must be in the asset zip, the Twitch Extension Helper must be the first script, and obfuscated or eval-using bundles are rejected [14][15]. Extension reviews have resumed (chatbot verification has not) [10]. A panel could embed a static dye picker plus calls to api-worker, but each streamer must install and activate it, and viewers need to be on the channel page, not in chat. Effort estimate: 2-4 weeks (my estimate: reuse Lit components in a static bundle, plus review round trips, plus config and CSP work). Adoption risk is high because every channel installs it individually. I found no sign an FFXIV dye extension exists (searched Twitch extensions only generally; not exhaustive).

## 3. FFXIV on Twitch (stats)
| Source | Figure | Counts | Date |
|---|---|---|---|
| StreamsCharts [16] | Sept 2026: 4,951 avg, 13,554 peak; Oct 2026 MTD 3,897 avg | average concurrent viewers, category | snippet, 2026-10 |
| SullyGnome [17] | ~4.6k avg last 30 days; 6,841 year-to-date avg | avg viewers | snippet, undated |
| ActivePlayer [18] | ~6,350 avg over 30 days (about July 2026); daily 6,800-22,000 in Aug to early Sept | avg concurrent viewers | secondary |
| TwitchTracker [19] | cached page stale (peaks from 2021) | n/a | not used |
Sources disagree (4k to 7k); a reasonable working figure is 4-7k average concurrent viewers, with event spikes. Top channels (ActivePlayer, early Sept 2026): Shenpai 878, ThijiHiguri 352, EllyEN 262 live viewers [18]. TwitchMetrics ranks the official `finalfantasyxiv` channel #1 (406,329 followers) and `woops` #8 (228,028 followers) [20]. The Japanese Fan Fest runs 2026-10-30 to 11-01 with Twitch chat badges for watching [21]; this should lift viewership then. Kaiyoko Star: only a low-quality page found (VTuber, Twitch since Aug 2020, YouTube since Oct 2020) [22]; no confirmation of a Fashion Report role or of their chat commands. I found no evidence either way on how often FFXIV streamers use custom chat commands for game info; generic Nightbot guides exist but nothing FFXIV-specific.

## 4. YouTube Live chat
Default quota is 10,000 units per day, resetting at midnight Pacific [23]. `liveChatMessages.streamList` (server-streaming, `maxResults` 200-2000) costs 5 units per call [24]; `list` is 5 units (secondary [25]); `insert` is 20 units on Google's page (about 13 months old) but a recent issue claims 50 [26][27]. Unresolved. At 20 units, 10,000/day is about 500 posted replies per day across all channels; at 50, about 200. Reading is cheap with streamList (one long-lived call), but a long-lived stream connection does not fit a Worker without a Durable Object or a Node host. Posting needs a user OAuth token for a bot account. A quota increase requires a Google audit/application (from memory, unverified). FFXIV YouTube presence: only per-channel pages found (e.g., Zeplahq's EU Fan Fest 2026 watch party at roughly 1,000 viewers; small channels in single digits to teens) [28]; no category totals.

## 5. Kick
Official dev docs live in the KickEngineering/KickDevDocs repo [29]. From secondary sources: base `api.kick.com/public/v1`, OAuth 2.1 with PKCE, tokens last 7,200 s [30]; webhooks signed with Ed25519 (public key from `GET /public-key`), at-least-once [30]; subscribe via `POST /events/subscriptions` to `chat.message.sent` [31]; send via `POST /public/v1/chat` with `chat:write`, body type, content, broadcaster_user_id [31]. A GitHub issue reports stalled or near-nonexistent `chat.message.sent` delivery (about 10 months old, unresolved) [32]. App review: nothing found. FFXIV on Kick: search found no category data (searched "Kick Final Fantasy XIV category"); treat presence as unknown and likely small. Worker fit: good in principle (webhooks plus REST, Ed25519 verify via WebCrypto), but reliability is a concern.

## 6. Stream-bot custom commands
- **Nightbot** `$(urlfetch url)`: plain text under 400 characters; a JSON variant lifts that limit; request carries `Nightbot-User` and `Nightbot-Channel` headers (absent from timers) [33]. Timeout, user agent, and IPs not found.
- **StreamElements** `$(customapi url)`: GET only, response truncated silently to 400 bytes (not characters, so CJK/accents cost more), proxy with 15 s timeout, no custom headers; encode user input with `$(queryescape)` [34].
- **Fossabot** customapi: not found.
- **api-worker today (repo):** no text route. Every handler returns JSON through `successResponse` (apps/api-worker/src/routes/dyes.ts:49-83 for `/v1/dyes/search`); no `c.text(` in non-test source. Locale comes from `?locale=` (apps/api-worker/src/middleware/locale.ts:15), not `lang`; reuse that name. Rate limit is 60 + 5 burst per 60 s per client IP (apps/api-worker/src/middleware/rate-limit.ts:30-31), applied to all `/v1/*` (index.ts:122), so shared egress IPs from a bot host could hit it. The service bucket (1,300/min, rate-limit.ts:61) is for service bindings only.
- **Minimal endpoint:** `GET /v1/bot/dye?q=&locale=` returning `text/plain; charset=utf-8`, no JSON envelope, capped to 400 bytes (UTF-8 byte count, truncating on a code point boundary) to satisfy both Nightbot and StreamElements; include name, hex, category, and a short link; return a short friendly error text with HTTP 200 for no-match (some bots only use 200 responses, per an old StreamElements copy, unverified); `Cache-Control: public, s-maxage` like the existing routes; consider a dedicated rate-limit bucket or a documented key so shared bot IPs do not 429. About 2-3 days of work (my estimate), plus docs in apps/api-worker/docs.

## 7. Bottom line
Cheapest real reach: the text endpoint (days, no per-streamer onboarding beyond pasting a command). Twitch chat bot is feasible on Workers but is text-only with per-channel OAuth; build only with a named streamer partner. YouTube is poor on fit and quota. Kick is immature and low presence. A Twitch panel extension is the only option that can show visuals on Twitch and it has the highest adoption friction.

## Sources
[1] https://dev.twitch.tv/docs/eventsub/ (snippet via search 2026-10-11)
[2] https://dev.twitch.tv/docs/chat/authenticating/ (snippet)
[3] https://discuss.dev.twitch.com/t/app-access-token-with-scopes/58286 and https://discuss.dev.twitch.com/t/confused-about-channel-bot-for-eventsub/61972 (secondary, forum)
[4] https://dev.twitch.tv/docs/chat/authenticating/ (snippet; conflicts with [3])
[5] https://dev.twitch.tv/docs/eventsub/handling-webhook-events (snippet)
[6] https://hookdeck.com/webhooks/skills/twitch-webhooks.md (secondary)
[7] https://dev.twitch.tv/docs/chat/irc-migration/ (snippet)
[8] https://dev.twitch.tv/docs/irc (snippet)
[9] https://hexdocs.pm/tmi/TMI.MessageServer.html (secondary)
[10] https://dev.twitch.tv/docs/chat/chatbot-guide/ (snippet: bot verification paused; extension reviews resumed)
[11] https://dev.twitch.tv/docs/product-lifecycle/ (snippet)
[12] https://docs.streamer.bot/changelogs/v1.0.7 (secondary, August 2026)
[13] https://dev.twitch.tv/extensions and https://blog.twitch.com/en/2019/06/20/10-tips-for-building-twitch-extensions-850354ecdf3d/ (snippet/secondary)
[14] https://dev.twitch.tv/docs/extensions/life-cycle/ (snippet)
[15] https://dev.twitch.tv/docs/extensions/guidelines-and-policies (snippet)
[16] https://streamscharts.com/games/final-fantasy-xiv-a-realm-reborn (snippet, 2026-10)
[17] https://sullygnome.com/game/final_fantasy_xiv_online_a_realm_reborn (snippet)
[18] https://activeplayer.io/final-fantasy-xiv-online (snippet, about 2026-09)
[19] https://twitchtracker.com/games/24241 (stale)
[20] https://www.twitchmetrics.net/c/9504944-finalfantasyxiv ; https://www.twitchmetrics.net/c/38927816-woops (snippet, undated)
[21] https://www.siliconera.com/ffxiv-fan-fest-2026-twitch-chat-badges-revealed/ (secondary)
[22] https://grants-stack-ux-events.gitcoin.co/trendingentertainment248/kaiyoko-star.html (low quality)
[23] https://developers.google.com/youtube/v3/determine_quota_cost (snippet)
[24] https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList (snippet)
[25] https://www.blotato.com/blog/youtube-api-pricing (secondary)
[26] https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert (snippet: 20 units)
[27] https://github.com/Milzstream/OBS-Multi-Chat/issues/6 (secondary: claims 50)
[28] https://streamscharts.com/channels/zeplahq/streams (snippet)
[29] https://raw.githubusercontent.com/KickEngineering/KickDevDocs/main/README.md (snippet)
[30] https://skills.sh/goncy/skills/kick-api (secondary)
[31] https://github.com/KickEngineering/KickDevDocs/issues/300 and https://pumpfundler.mintlify.app/en/apis/chat (secondary)
[32] https://github.com/KickEngineering/KickDevDocs/issues/300 (user report)
[33] https://docs.nightbot.tv/variables/urlfetch (snippet)
[34] https://docs.streamelements.com/chatbot/variables/customapi (snippet)
Repo: apps/api-worker/src/routes/dyes.ts:49, apps/api-worker/src/middleware/rate-limit.ts:30-31, apps/api-worker/src/index.ts:122, apps/api-worker/src/middleware/locale.ts:15


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Twitch chat bot | moderate — Category averages about 4-7k concurrent viewers (StreamsCharts Sept 2026 avg 4,951; SullyGnome ~4.6k; ActivePlayer ~6.35k); top live channels in early Sept 2026 were 878, 352, 262 viewers; official channel 406k followers. Sources disagree; snippets only. | Good: EventSub webhook (app token) plus Helix REST send; HMAC via crypto.subtle; needs KV/D1 for authorized channels and bot token refresh. No persistent socket. | spike - only with a named streamer partner; text-only replies with a link to a hosted card page; ask for mod status to get the 100/30s limit. | 3-5 (my estimate) | Technically fits Workers, but each channel needs its own channel:bot consent, bot verification is paused, there is no image support, and the audience is concentrated in a few channels. The text endpoint reaches most of the same streamers more cheaply. |
| Twitch Extension | unknown — No FFXIV dye extension found, but search covered Twitch extensions only generally and was not exhaustive. | Static bundle goes to Twitch CDN; only optional calls to api-worker over HTTPS. No Worker hosting of the front end. | watch - only if a partner streamer commits to installing it. | 2-4 plus review time (my estimate) | It is the only Twitch option that can show visuals, but streamers must install and activate it per channel, review has four parts, and viewers must be on the channel page. |
| YouTube Live chat | small — Only per-channel pages found (Zeplahq EU Fan Fest 2026 watch party about 1,000 viewers; small channels in single digits to teens); no category totals. | Poor to fair: streamList is a long-lived server-streaming call (needs Durable Object or Node host); polling list or posting works over REST but burns quota. | skip | 3-4 (my estimate) | Default quota 10,000 units/day with insert at 20 (or 50) units caps replies at about 200-500 per day across all channels, a persistent connection is needed to read chat, and FFXIV presence is unmeasured. |
| Kick | none-found — Searched 'Kick Final Fantasy XIV category viewers streamers'; no category data returned. | Good in principle: webhooks (Ed25519 verify via WebCrypto) plus REST send; but a user report of stalled chat webhook delivery. | skip | 3-4 (my estimate) | No evidence of FFXIV viewers, app review rules unknown, and the chat webhook reliability report is unresolved. |
| Stream-bot custom commands | unknown — No evidence found for FFXIV streamers' use of custom info commands; Nightbot/StreamElements are generic and widely used on Twitch. | Excellent: a plain GET text route on api-worker; no new infrastructure. | build-if-asked - cheap enough to build proactively if a streamer shows interest; GET /v1/bot/dye?q=&locale= returning text/plain capped at 400 UTF-8 bytes. | 0.5 (about 2-3 days incl. docs and tests; my estimate) | Works across Nightbot (400 chars), StreamElements (400 bytes, 15 s timeout, GET only) and likely Fossabot (unverified). Needs a dedicated rate-limit bucket because the current 60+5/min per IP could 429 shared bot IPs. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| T1 | Twitch EventSub webhook transport requires an app access token; channel.chat.message needs user:read:chat + user:bot on the bot and either bot-is-mod or channel:bot from the broadcaster | snippet | https://dev.twitch.tv/docs/chat/authenticating/ | accessed 2026-10-11 |
| T2 | Send Chat Message API: user:write:chat minimum; with app token also user:bot from sender and mod status or channel:bot from broadcaster; own rate bucket separate from IRC | snippet | https://dev.twitch.tv/docs/chat/irc-migration/ | accessed 2026-10-11 |
| T3 | EventSub HMAC-SHA256 over message-id+timestamp+raw body; challenge reply 200 text/plain; at-least-once delivery | snippet | https://dev.twitch.tv/docs/eventsub/handling-webhook-events | accessed 2026-10-11 |
| T4 | Twitch chatbot verification reviews remain paused; extension reviews resumed; verified status rarely granted; unverified bot limit 20 msgs/30s (100 if mod/VIP/broadcaster) | snippet | https://dev.twitch.tv/docs/chat/chatbot-guide/ | accessed 2026-10-11 |
| T5 | Twitch IRC still listed active, no EOL date; Streamer.bot removed IRC for EventSub in v1.0.5 (Aug 2026) | snippet | https://dev.twitch.tv/docs/product-lifecycle/ | accessed 2026-10-11 |
| T6 | FFXIV Twitch category averages roughly 4-7k concurrent viewers (StreamsCharts Sept 2026 avg 4,951, peak 13,554; SullyGnome ~4.6k/30d; ActivePlayer ~6.35k) | snippet | https://streamscharts.com/games/final-fantasy-xiv-a-realm-reborn | 2026-10 (month-to-date) |
| T7 | Top FFXIV Twitch streamers early Sept 2026 live viewers: Shenpai 878, ThijiHiguri 352, EllyEN 262; official channel finalfantasyxiv 406,329 followers | secondary | https://activeplayer.io/final-fantasy-xiv-online | about 2026-09 |
| T8 | Japanese FFXIV Fan Fest 2026-10-30 to 11-01 with Twitch chat badges | secondary | https://www.siliconera.com/ffxiv-fan-fest-2026-twitch-chat-badges-revealed/ | 2026-10 |
| T9 | Twitch extensions: panel/overlay/component types, sandboxed static iframe, assets zipped to Twitch CDN, four-part review (metadata, policy, functional, code), no obfuscated code | snippet | https://dev.twitch.tv/docs/extensions/life-cycle/ | accessed 2026-10-11 |
| Y1 | YouTube default quota 10,000 units/day (reset midnight PT); liveChatMessages.streamList 5 units/call; insert 20 units per Google page (about 13 months old) but a recent issue claims 50 | snippet | https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList | accessed 2026-10-11 |
| K1 | Kick public API: OAuth 2.1+PKCE, Ed25519-signed webhooks, chat.message.sent event, POST /public/v1/chat with chat:write; a user report says chat webhook delivery stalls | secondary | https://github.com/KickEngineering/KickDevDocs/issues/300 | about 2025-12 (issue ~10 months old) |
| N1 | Nightbot urlfetch needs plain text under 400 characters (JSON variant lifts the cap) and sends Nightbot-User/Nightbot-Channel headers | snippet | https://docs.nightbot.tv/variables/urlfetch | accessed 2026-10-11 |
| N2 | StreamElements $(customapi): GET only, truncates to 400 BYTES silently, 15 s timeout via proxy, no custom headers | snippet | https://docs.streamelements.com/chatbot/variables/customapi | accessed 2026-10-11 |
| R1 | api-worker has no text/plain route; all handlers return JSON via successResponse; locale param is ?locale= not lang | repo | apps/api-worker/src/routes/dyes.ts:49 |  |
| R2 | api-worker /v1/* limit is 60 requests + 5 burst per 60 s per client IP | repo | apps/api-worker/src/middleware/rate-limit.ts:31 |  |


## Corrections to the 2026-10-04 refresh

- 07 §6 says Twitch send-side scopes are unverified. Per Twitch's chat docs (search snippet, not read directly), they are: user:write:chat minimum; with an app access token also user:bot from the sender plus mod status or channel:bot from the broadcaster. Source: https://dev.twitch.tv/docs/chat/irc-migration/
- 07 §6 says Nightbot's urlfetch cap is plain text under 400 characters. That is right, but there is a JSON variant without the cap, and StreamElements truncates at 400 BYTES, not characters. Sources: https://docs.nightbot.tv/variables/urlfetch ; https://docs.streamelements.com/chatbot/variables/customapi
- 07 §6 says api-worker's 60 requests/min per IP 'could hit that limit'. Confirmed in repo at apps/api-worker/src/middleware/rate-limit.ts:31 (60 + 5 burst per 60 s per IP, applied to all /v1/* at index.ts:122); whether Nightbot actually shares IPs remains unverified.


## Open questions

- Direct fetch of dev.twitch.tv, docs.kick.com, and docs.fossabot.com was blocked; re-verify Twitch send-side token rules, the 500-character limit, and the EventSub response deadline from the primary pages.
- Is liveChatMessages.insert 20 or 50 quota units today? Check Google's quota table directly.
- Nightbot urlfetch timeout, user-agent, and egress IPs; Fossabot customapi limits: not found.
- Kick app-review requirements and whether chat.message.sent webhook delivery is reliable now.
- How many FFXIV streamers actually use custom info commands? Needs a sample of top channels' command lists or a direct ask to streamers.
- Which FFXIV Twitch streamers are glamour/fashion-report focused, and are any willing to partner? Kaiyoko Star's role was not confirmed.
- Kick and YouTube FFXIV category sizes: not found; needs Streams Charts category pages or the platforms' own category views.
