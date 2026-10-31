> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# Task C1: Reaching more FFXIV players without a new platform

Date: 2026-10-11. Scope: Discord user-install, Discord Activities, the public API, and og-worker share cards. Read-only; no repo files were changed.

Access note: the sandbox's egress proxy returned 403 for discord.com and docs.discord.com, and WebFetch could not resolve them. Discord's developer docs were therefore read from Discord's own `discord/discord-api-docs` repository on GitHub (main branch, accessed 2026-10-11). That repository is the source of the published docs, but it is not the rendered site. Where I could not reach a primary source, I say so.

## 1. Discord user-installable apps

### 1.1 What our registration does today
- `apps/discord-worker/scripts/register-commands.ts` does a bulk overwrite (`PUT .../commands`) of the payload from `schemas.ts`. It sets no `integration_types` or `contexts` [1]. A grep of `apps/discord-worker/src` and `scripts` found neither field.
- `apps/moderation-worker/scripts/register-commands.ts:52-53` sets `contexts: [0]` and `integration_types: [0]` explicitly [2].
- Discord's docs give the defaults only in the Bulk Overwrite section. `integration_types` defaults to `GUILD_INSTALL` (`[0]`) and `contexts` defaults to all contexts `[0,1,2]` [3]. So our 18 commands are guild-install only today.
- The command object table says `integration_types` "defaults to your app's configured contexts" [3]. That text conflicts with the bulk-overwrite text. A 2024 issue (#7108) reported that defaults did not match the docs. It was closed on 2024-10-17 with the note that the fix applies only to newly created commands [4].
- Recommendation: set both fields explicitly on every command and do not rely on a default.
- In the Developer Portal, the Installation page has "User Install" and "Guild Install" checkboxes under Installation Contexts. Default Install Settings: User Install takes the `applications.commands` scope; Guild Install takes `applications.commands` and `bot` [6]. I cannot see our portal settings, so whether User Install is already enabled is unknown.
- `PRIVATE_CHANNEL` (2) can appear in `contexts` only if `USER_INSTALL` is in `integration_types` [6].

### 1.2 What a user-install invocation looks like
- **Payload fields.** `context` is 0 (guild), 1 (bot DM) or 2 (group DM or DM with another user). `authorizing_integration_owners` maps `"1"` (user install) to the installing user's ID, and `"0"` (guild install) to the guild ID, or `"0"` for bot DMs. For user installs it can tell the installer apart from the invoker [5][6].
- **`member` vs `user`.** `member` is sent when invoked in a guild and `user` when invoked in a DM [5]. A user-install in a guild where our bot is absent still carries `guild_id` and `member`, but our bot has no presence there. That last sentence is my inference from the docs' wording and was not tested.
- **`app_permissions`.** It is now correct for user-installed apps. In (G)DMs with other users it includes `ATTACH_FILES | EMBED_LINKS | MENTION_EVERYONE` [5][7].
- **Forced-ephemeral rule.** There is no member-count rule any more: "Interaction responses are no longer forced to be ephemeral for servers with over 25 members" (2024-06-27) [7]. The current rule is the `USE_EXTERNAL_APPS` permission (`1 << 50`), enabled by default. If a server turns it off and the app is not installed in that server, responses are ephemeral for the user [7]. A community guide says AutoMod can also force public replies private [8]. I found no later change to this rule in the 2026 changelog [9].
- **Follow-ups.** When the app is not installed in the server (`authorizing_integration_owners` has only `USER_INSTALL`), it gets at most 5 follow-up messages per interaction. The cap applies to Create Followup Message only [5][7]. The interaction token lasts 15 minutes and the initial response is due in 3 seconds [5].
- **Attachments.** User apps inherit the invoking user's permissions, for example Attach Files [8]. That guide is community-written. The file upload limit is 20 MiB by default since 2026-09-03 [9].
- **Components.** Component interactions can be triggered by any user who can see the component, and responses can be visible to users without the app installed [6].
- **Autocomplete.** No user-install-specific rule appears in the docs I read [5]. Autocomplete interactions are interactions too, so I expect them to work. That is unverified until tested in a real server.
- **Bot-token limits.** A user-installed app can only respond to its own commands, buttons and select menus. It cannot read channels, post to channels, or delete anything [8]. This matters for any code that posts with `Authorization: Bot`.
- **Recent client changes.** Slash command autocomplete became fuzzy on 2026-09-11 [9]. Context-menu commands per type rose from 5 to 15 on 2026-03-03 [9].

### 1.3 Audit of apps/discord-worker/src
**Already safe**
- Identity is read as `interaction.member?.user?.id ?? interaction.user?.id` everywhere: `index.ts:912, 1111, 1198, 1205, 1508`, plus every handler. Examples are `handlers/commands/harmony.ts:41`, `glamour.ts:107`, `preset.ts:69-74`, and `handlers/buttons/index.ts:73`. A user-install in a guild or DM resolves to the same user ID.
- `index.ts:914-921` rejects an interaction with no user ID. That path cannot be hit.
- Rate limiting is keyed by `userId:scope` (`services/rate-limiter.ts:275`), not by guild. Preferences are keyed `prefs:v1:<userId>` (KV). Both are unaffected.
- Every interactive reply goes through the interaction webhook (`utils/discord-api.ts:76, 165, 340`). The only `Bot ${token}` channel posts are `sendMessage` / `editMessage` (`utils/discord-api.ts:410-461`). They are used for the moderation and submission-log channels (`index.ts:379, 523`), the GitHub changelog webhook (`index.ts:754`), and the moderation preview-image button (`handlers/buttons/preview-image.ts:166-340`). These post to our own channels and are not part of user flows. The preview-image button belongs to moderation staff in our server.
- Stats admin gate is by user ID list (`handlers/commands/stats.ts:71-76`). No guild permission checks were found in `handlers`, `utils` or `services`. No custom emoji are used.
- Follow-up use is small. Only `budget.ts:222` and `index.ts:887` (the first-run notice) send follow-ups outside moderation buttons. Both stay well under the 5-follow-up cap.
- No Gateway intents are used, so message content is never read.

**Needs a change**
- `types/env.ts:137-209` (`interface DiscordInteraction`): it has `guild_id`, `member` and `user`, but not `context`, `authorizing_integration_owners`, `app_permissions` or `attachment_size_limit`. Add them if install-aware behavior is wanted.
- `services/analytics.ts:95-96` labels `event.guildId ? 'guild' : 'dm'`. Under user install, a server where the bot is absent is also labeled `guild`. DMs and group DMs are labeled `dm`. `services/command-trace.ts:191-218` passes `interaction.guild_id`. To see whether user-install works, add an install-type dimension taken from `authorizing_integration_owners`. This must keep the privacy rule from the comment at `analytics.ts:43-53`: never write a guild ID.
- `scripts/register-commands.ts` and `schemas.ts` (1406 lines): add `integration_types: [0, 1]` and `contexts: [0, 1, 2]` per command, or add them in one place inside `localizeCommands`. The roster-parity check at `register-commands.ts:30-37` stays as is.
- Privacy policy and terms: both mention "the Bot" and a server context. Review all six languages for user-install wording (`apps/discord-worker/PRIVACY_POLICY*.md`, `TERMS_OF_SERVICE*.md`).
- Behavior to tell users: in a server with Use External Apps off, replies become private. Cards still render, because ephemeral messages can carry attachments (to be confirmed in a test).

**Command classification (my judgment from the code read above)**

| Command | Verdict |
|---|---|
| harmony, mixer, gradient, swatch, comparison, contrast, accessibility, a11y, dye, about, manual, changelog | Works as-is |
| extractor (image subcommand), glamour (`.chara` attachment) | Works as-is, but test: attachment resolution and `attachment_size_limit` |
| budget (service-bound Universalis), preferences (KV, user-keyed) | Works as-is, but test: the world and data center choice comes from preferences, not from the guild |
| preset (browse, vote, submit via presets-api) | Works as-is: it keys on user ID and posts moderation notices to our own server. Test after enabling |
| stats | Keep guild-only or bot-DM only: it exposes admin subcommands and has no value for strangers |

**Must stay guild-only:** the moderation-worker commands (already `[0]`/`[0]`, `register-commands.ts:52-53`) [2].

### 1.4 Effort
- Registration change, portal toggle, type additions, an analytics install dimension and six policy edits: about 2-4 dev-days. Add 1-2 days to test in a server without the bot, a DM and a group DM. The real unknowns are Discord behaviors that I could not test (autocomplete, ephemeral attachments).
- No new hosting, no new platform, and no new policy documents beyond edits.

### 1.5 App Directory
- Opting into Discovery needs completed team-owner identity verification and app verification. The app needs a public privacy policy and terms of service. Content must be appropriate for ages 13 and over [12]. The Discovery Status tab lists what is missing, and Enable Discovery stays grayed out until all items are met [12]. A support server must be a Community server [12].
- Our privacy and terms files already exist in six languages. Whether the app is already verified is unknown.
- I found no current server-count threshold. The old "75 servers" figure comes from a 2020 verification program and does not apply [12].
- Source note: [12] is a search-result summary of Discord's support pages, not a direct read. Treat it as snippet-level.
- Age assurance (2026-09-22): the changelog says integrations "continue to work as is" and lists custom status, age-restricted Activities, spending limits and DM filtering as the changes developers may see [9]. None of our commands is age-restricted.

## 2. Discord Activities (Embedded App SDK)

- Activities are web apps run in an iframe in Discord on desktop, mobile and web, using the Embedded App SDK (MIT licensed) [10][11].
- Launch: enabling Activities creates a default Entry Point ("Launch") command in the App Launcher. A command, component or modal interaction can also launch one with callback type 12 `LAUNCH_ACTIVITY` [10]. The Entry Point command carries `integration_types` and `contexts` like any command [10].
- Surfaces: the 2024-09-26 changelog says that with user install, Activities can be available across servers, DMs and group DMs [10]. I could not find a current statement of exactly which `contexts` values launch an Activity in a text channel or DM. The SDK's Open Invite Dialog errors in DM contexts, which matters only if the app uses that command [10]. A 2024 report says Activities work in text chats without a voice call (snippet level).
- Networking: all traffic goes through the Discord proxy on `{clientId}.discordsays.com`. URL mappings are configured in the Developer Portal. Requests to unmapped external hosts fail with `blocked:csp`. WebSockets are the only supported real-time transport [10]. The SDK offers `patchUrlMappings` for runtime URLs. Since 2024-08-28 the `/.proxy/` prefix is optional (snippet level).
- OAuth: the Activity calls `ready()`, then `commands.authorize` (a code), the app server exchanges the code for a token, then `commands.authenticate` [10][11].
- Age: "Age-restricted Activities may require users to confirm their age group" (2026-09-22) [9]. Nothing in our web app is age-restricted, so I expect no impact. Not tested.
- 2026 SDK changes: `getInstanceConnectedParticipants` was renamed on 2026-10-06 [9]. The `relationships.read` scope opened up on 2026-01-21 [9]. Neither affects us.

**Blockers in apps/web-app**
- `public/_headers:31` sets `frame-ancestors 'none'`, and `_headers:37` sets `X-Frame-Options: DENY` [25]. The app cannot render inside Discord's iframe as deployed. `src/__tests__/security-headers.test.ts` pins these headers.
- `connect-src 'self' https://*.xivdyetools.app` and `img-src` hosts (`_headers:31`) are outside the Activity proxy. They need URL mappings (api, data, shots, auth) or `patchUrlMappings`. The code uses seven distinct `https://*.xivdyetools.app` hosts in `src`.
- `auth-service.ts`, `result-card.ts`, `v4-layout.ts` and `item-links-menu.ts` use `window.open` or `location.href` assignment. Inside the iframe, external links need `sdk.commands.openExternalLink`, and sign-in has to use the SDK OAuth flow, not XIVAuth redirects.
- The app uses `history.pushState` in `tool-handoff.ts`, `preset-tool.ts` and `extractor-tool.ts`. Behavior inside the iframe is untested.
- The app has no `navigator.share` outside tests (consistent with 07).

**Effort and value (my estimate):** about 2-4 dev-weeks for a separate Activity build and Pages project with its own headers, URL mappings, SDK auth, link handling and testing in the real client. It would reach people through the App Launcher, but it duplicates the web app that already needs no account. Spike only if a community asks. Not recommended now.

## 3. Public API for community bot builders

- `apps/api-worker` has 16 `/v1` endpoints (14 GET, 2 POST) [13]. All return JSON. The only image is a proxied XIVAPI item icon PNG (`GET /v1/chara/icon/:iconId`). There is no endpoint that returns a rendered card. Cards are made only in discord-worker (SVG to PNG via resvg-wasm) and og-worker.
- No API keys exist: `src/index.ts:98-99` says `X-API-Key` is no longer advertised and "add it back with the feature, not before". `docs/guide/rate-limits.md` says every endpoint is anonymous [13].
- CORS is `origin: '*'` with GET, POST and OPTIONS (`src/index.ts:100-117`) [13].
- Rate limit: `src/middleware/rate-limit.ts:30-32` sets 60 requests plus 5 burst per 60 s, per client IP, enforced by the Workers binding at limit 65 per colo (`rate-limit.ts:38-42`). The docs state "60 req/min per IP (per-colo fixed window)" [13]. A request with no `CF-Connecting-IP` (our own service bindings) gets a separate 1300-per-minute bucket (`rate-limit.ts:61-77`). This is the item 07 §1 asked to confirm.
- Fit for hosted bots: a hosted Telegram, Matrix or Fluxer bot calls from one shared IP. A single popular instance would hit 65 requests per minute quickly, and Nightbot-style shared IPs would too. Options are an API-key tier (not built), documented caching guidance, or the batch endpoint `GET /v1/dyes/batch?ids=` (max 50).
- A "build a bot on our API" page needs: the anonymous-access model; the rate limits and `429`/`Retry-After` handling; localized name lookup (`?locale=`); a worked example for closest-dye matching and harmony; how to draw your own card (we ship no image endpoint); an attribution and fan-site-terms note; and a pointer to the open-source packages `@xivdyetools/core` and `@xivdyetools/svg` for self-rendering, which is the better route for bots that need images.
- The docs site already exists at developers.xivdyetools.app (VitePress, `apps/api-worker/docs/guide/`, `docs/reference/`).
- Effort: S (about 1-2 days) for the page. M (about 1-2 weeks) if a PNG card endpoint or API keys are added. I did not find or look for outside community-bot demand.

## 4. Share cards: apps/og-worker/src/crawler-detector.ts

Today `CRAWLER_PATTERNS` (lines 19-52) matches: Discordbot, Twitterbot, facebookexternalhit, Facebot, LinkedInBot, Slackbot, TelegramBot, WhatsApp, "Open Graph", MetaInspector, Applebot. Googlebot is deliberately excluded and a test pins that [14].

| Platform | UA string | Source | Status today |
|---|---|---|---|
| Telegram | `TelegramBot (like TwitterBot)` | Cloudflare Radar lists TelegramBot (snippet) | Matched by `/TelegramBot/` |
| WhatsApp | `WhatsApp/2.x.x.x` plus A, I or N for Android, iOS or web | Meta developer docs [22] | Matched by `/WhatsApp/` |
| KakaoTalk | `facebookexternalhit/1.1;kakaotalk-scrap/1.0` | Kakao DevTalk answers [16] (not official docs) | Already matched by the `facebookexternalhit` pattern, if the string is current. 07 says KakaoTalk gets the generic card. Verify with a live request |
| LINE | `Mozilla/5.0 (compatible; Linespider/1.1; +https://lin.ee/4dwXkTH)` | LINE help page [17] | Not matched. Add `/Linespider/i`. Reportedly reads only og:title, description and image (secondary) |
| Stoat (January) | `Mozilla/5.0 (compatible; January/2.0; +https://github.com/stoatchat/stoatchat)`; for reddit.com and klipy.com it spoofs `Discordbot/2.0` | January source, `requests.rs` [18] | Not matched. Add `/January\//` |
| Mastodon | `Mastodon/<ver> (http.rb/<ver>; +https://<domain>/)`. Order varies by version | Mastodon `lib/mastodon/version.rb` (primary, truncated) plus bot directories [19] | Not matched. Add `/Mastodon\//` and `/http\.rb/`. Each instance fetches separately |
| Matrix (Synapse) | `Synapse (bot; +https://github.com/matrix-org/synapse)` | Known Agents (third-party) [20]. Synapse code builds it from `version_string` plus an optional suffix | Not matched. Add `/Synapse \(bot/`. Confirm against a live homeserver. Previews are off by default on Synapse |
| Bluesky | `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app) Chrome/W.X.Y.Z Safari/537.36` (one site lists 1.0) | Third-party directories only [21]. No official Bluesky document found | Not matched. Add `/Bluesky Cardyb/i` |
| Reddit | `Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)` | Third-party directories [23] | Not matched. Add `/redditbot/i` |
| Fluxer | Unknown. The unfurler is a separate `fluxer-unfurl` package in `fluxerapp/fluxer` [24] | I could not read the code | Unverified. Read the unfurl source before adding a pattern |
| Twitch | Unknown. No crawler documented | Searched, none found | Unverified. Likely no server-side crawler |
| Signal | Link previews are fetched by the sender's client, not a Signal crawler | Secondary claim only | Nothing to add |
| Element (Matrix client) | Previews come from the homeserver, so the Synapse UA applies | See Matrix row | See Matrix row |

New finding: on 2026-10-05 Discord added link-preview customization. A page can include `<script id="discord:component-embed" type="application/json">` in the server-rendered `<head>`, or `<link rel="discord:component-embed" type="application/json">` pointing to same-site JSON. The payload is display-only and needs no app or bot, and it must be under 3,000 bytes [9][15]. Third-party implementations report a 40-component cap and fall back to the normal Open Graph card on failure [15]. The draft docs were still under review when I read them, so check the rendered Link Previews page. This could give Discord shares richer cards from og-worker.

Effort: S (about 1-2 days) for the regex additions, `CrawlerType` additions, tests and a live check against each platform. The component-embed is a separate S-to-M task.

## 5. What I could not settle
- Developer Portal install settings for our app, and whether the app is verified.
- Real behavior of autocomplete, ephemeral attachments and follow-ups in a server without the bot (docs are silent or only partly clear).
- Which `contexts` values let an Activity launch in a DM or text channel.
- Fluxer and Twitch crawler user agents.
- Official sources for the Bluesky, Mastodon-as-deployed, Synapse, Reddit and KakaoTalk user agents beyond what is cited.

## Sources
[1] Repo: apps/discord-worker/scripts/register-commands.ts (lines 43-116, no integration_types/contexts); apps/discord-worker/src/commands/registry.ts (18 commands)
[2] Repo: apps/moderation-worker/scripts/register-commands.ts:52-53
[3] Discord API docs, Application Commands: https://github.com/discord/discord-api-docs/blob/main/developers/interactions/application-commands.mdx (accessed 2026-10-11)
[4] discord-api-docs issue #7108, opened 2024-08-27, closed 2024-10-17: https://github.com/discord/discord-api-docs/issues/7108
[5] Discord API docs, Receiving and Responding: https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx (accessed 2026-10-11)
[6] Discord API docs, Developing a User-Installable App: https://github.com/discord/discord-api-docs/blob/main/developers/tutorials/developing-a-user-installable-app.mdx (accessed 2026-10-11)
[7] Discord changelog 2024-06-27 "User-Installed Apps General Availability" (PR 6958): https://github.com/discord/discord-api-docs/pull/6958/files
[8] Community guide (TwilightZebby): https://gist.github.com/TwilightZebby/517850b65575fdb7cf2ff156d36ece9b (secondary)
[9] Discord changelog (2026 entries; 2024 Activities and user-install entries): https://raw.githubusercontent.com/discord/discord-api-docs/refs/heads/main/developers/change-log.mdx (accessed 2026-10-11)
[10] Discord Activities docs: https://github.com/discord/discord-api-docs/blob/main/developers/activities/overview.mdx ; .../how-activities-work.mdx ; .../development-guides/networking.mdx ; .../development-guides/user-actions.mdx (accessed 2026-10-11)
[11] Embedded App SDK README: https://github.com/discord/embedded-app-sdk (accessed 2026-10-11)
[12] App Directory Discovery requirements (search summary of Discord support pages): https://support-dev.discord.com/hc/en-us/articles/9489299950487 (snippet)
[13] Repo: apps/api-worker/src/index.ts:98-117, 119-160; src/middleware/rate-limit.ts:30-77; README.md:7-28; docs/guide/rate-limits.md:1-20
[14] Repo: apps/og-worker/src/crawler-detector.ts:19-99
[15] Discord Link Previews docs PR #8606 (draft text): https://github.com/discord/discord-api-docs/pull/8606
[16] Kakao DevTalk threads on scrap user agents: https://devtalk.kakao.com/t/user-agent/120219 (and related threads; community answers)
[17] LINE Linespider help page: https://help2.line.me/linesearchbot/web/?contentId=50006055&lang=en
[18] Stoat January source: https://raw.githubusercontent.com/stoatchat/stoatchat/main/crates/services/january/src/requests.rs (accessed 2026-10-11)
[19] Mastodon source: https://raw.githubusercontent.com/mastodon/mastodon/main/lib/mastodon/version.rb ; app/lib/request.rb; bot directories https://darkvisitors.com/agents/mastodon (secondary)
[20] Synapse UA via Known Agents: https://knownagents.com/agents/synapse (secondary); client code https://raw.githubusercontent.com/element-hq/synapse/develop/synapse/http/client.py
[21] Bluesky Cardyb UA directories: https://chrisleverseo.com/user-agents/bluesky-cardyb/ ; https://community.vercel.com/t/blue-sky-bot-seems-to-be-blocked/44430 (secondary)
[22] Meta WhatsApp link previews docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/
[23] redditbot directories: https://knownagents.com/agents/redditbot ; https://darkvisitors.com/agents/redditbot (secondary)
[24] Fluxer unfurl release: https://github.com/fluxerapp/fluxer/releases/tag/fluxer-unfurl%402026.929.230316
[25] Repo: apps/web-app/public/_headers:31,37


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Discord user-install | dominant — Discord is where FFXIV Free Company, linkshell and community servers live per the 07 refresh; this task did not measure presence directly. | Same HTTP-interaction Worker, no new hosting; webhook-only replies already used. | build-now: set integration_types [0,1] and contexts [0,1,2] on all commands except stats (guild/bot-DM only), enable User Install in the portal, add install-type analytics, review the six privacy policies, then test in a server without the bot. | 0.5-1 (about 2-4 dev-days plus 1-2 days of testing and policy edits) | Registration omits both fields today, so the bot is guild-install only. The code audit found identity read as member ?? user everywhere, user-keyed rate limits and preferences, interaction-webhook replies only, and no guild permission checks. Remaining risks are Discord-side behaviors (Use External Apps forcing ephemeral replies, 5-follow-up cap, ephemeral attachment handling) that need a real test. This reaches Free Company and linkshell members whose admins never installed the bot. |
| Discord Activity (web app) | dominant — Same Discord audience; Activities launch from the App Launcher and, with user install, reportedly in servers, DMs and group DMs (2024 changelog). | Pages hosting works, but needs a separate Activity build, proxy URL mappings and an auth server route. | skip for now; spike only if a community asks. If revisited, first enable user install, then spike a headers-relaxed Activity build. | 2-4 (my estimate) | Hard blockers: _headers sets frame-ancestors 'none' and X-Frame-Options DENY, connect-src and img-src hosts need Activity URL mappings, and sign-in and external links use window.open or redirects that the iframe cannot do. The Activity would mostly duplicate the account-free web app. Age-restricted Activities may require age confirmation, but our tools are not age-restricted. Exact launch contexts for DMs and text channels were not confirmed in current docs. |
| Public API for community bots | n/a — Audience is community bot developers, not players; no demand evidence gathered. | Built (api-worker on Cloudflare Workers). | build-now (docs page only): write the 'build a bot on our API' guide; defer keys and card rendering until a real bot builder asks. | 0.3-0.5 for a docs page; 1-2 if a PNG card endpoint or API keys are added | The API is JSON only, anonymous, CORS-open, 60+5 requests per minute per IP per colo, with no key system (src/index.ts:98-99) and no rendered images. A hosted bot behind one IP will hit the cap, so the page should push caching, the batch endpoint, and self-rendering with @xivdyetools/core and @xivdyetools/svg. It costs nearly nothing and enables other platforms without adapter work on our side. |
| og-worker share cards | n/a — It is a link-preview mechanism; reach depends on where links are pasted, which this task did not measure. | Built (og-worker on Cloudflare Workers). | build-now: add patterns for Linespider, January, Mastodon, Synapse, Bluesky Cardyb and redditbot with tests; verify each with a live request; consider a discord:component-embed payload as a follow-up. | 0.2-0.4 (1-2 dev-days) | Existing patterns already cover Discord, Twitter, Facebook, LinkedIn, Slack, Telegram and WhatsApp, and KakaoTalk's reported UA contains facebookexternalhit. Missing: LINE (official UA documented), Stoat's January (vendor source), Mastodon (vendor source), and Matrix, Bluesky and Reddit (third-party UA sources only). Fluxer and Twitch UAs were not found. Discord added display-only component-embed link previews on 2026-10-05, a new option for richer Discord shares. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| c1 | discord-worker's registration sets neither integration_types nor contexts; moderation-worker sets both to [0]. Under the bulk-overwrite defaults documented by Discord (integration_types [0], contexts [0,1,2]), all 18 commands are guild-install only today. | repo | apps/discord-worker/scripts/register-commands.ts:43-88 ; apps/moderation-worker/scripts/register-commands.ts:52-53 ; https://github.com/discord/discord-api-docs/blob/main/developers/interactions/application-commands.mdx | accessed 2026-10-11 |
| c2 | The command object table says integration_types 'defaults to your app's configured contexts', but the Bulk Overwrite section says GUILD_INSTALL [0]; issue #7108 reported mismatches and was closed 2024-10-17 with the fix applying only to newly created commands. Set both fields explicitly. | primary | https://github.com/discord/discord-api-docs/issues/7108 | 2024-10-17 |
| c3 | Forced-ephemeral for servers over 25 members was removed on 2024-06-27. Now USE_EXTERNAL_APPS (1<<50, on by default) governs: if off and the app is not installed in that server, responses are ephemeral for the user. User-installed apps get max 5 follow-ups per interaction when not installed in the server. | primary | https://github.com/discord/discord-api-docs/pull/6958/files | 2024-06-27 |
| c4 | Interaction payload for user install: context (0 guild, 1 bot DM, 2 PRIVATE_CHANNEL), authorizing_integration_owners (key '1' = installing user ID, '0' = guild ID or '0' for bot DM), member sent in guilds, user sent in DMs. PRIVATE_CHANNEL requires USER_INSTALL in integration_types. | primary | https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx ; .../tutorials/developing-a-user-installable-app.mdx | accessed 2026-10-11 |
| c5 | discord-worker resolves the user as interaction.member?.user?.id ?? interaction.user?.id in index.ts (912, 1111, 1198, 1205, 1508) and every command handler; rate limits are keyed userId:scope; preferences are keyed prefs:v1:<userId>; replies use the interaction webhook; Bot-token channel posts are only for our own moderation/log channels. No guild permission checks or custom emoji found. | repo | apps/discord-worker/src/index.ts:912 ; apps/discord-worker/src/services/rate-limiter.ts:275 ; apps/discord-worker/src/utils/discord-api.ts:76,410-461 | accessed 2026-10-11 |
| c6 | DiscordInteraction type lacks context, authorizing_integration_owners, app_permissions; analytics labels guild_id present as 'guild' else 'dm', so user-install in a bot-less server would count as 'guild'. | repo | apps/discord-worker/src/types/env.ts:137-209 ; apps/discord-worker/src/services/analytics.ts:95-96 ; apps/discord-worker/src/services/command-trace.ts:191-218 | accessed 2026-10-11 |
| c7 | App Directory Discovery needs team-owner identity verification, app verification, public privacy policy and terms of service, and content suitable for ages 13+; the 75-server threshold is from a 2020 program and does not apply. | snippet | https://support-dev.discord.com/hc/en-us/articles/9489299950487 | accessed 2026-10-11 |
| c8 | Activities run as an iframe web app via the Embedded App SDK; traffic is proxied through {clientId}.discordsays.com with URL mappings configured in the portal; unmapped hosts fail with blocked:csp; WebSockets only; OAuth via commands.authorize then token exchange then commands.authenticate. | primary | https://github.com/discord/discord-api-docs/blob/main/developers/activities/development-guides/networking.mdx ; .../how-activities-work.mdx | accessed 2026-10-11 |
| c9 | The web app's _headers set frame-ancestors 'none' and X-Frame-Options: DENY, and a CSP connect-src limited to self and *.xivdyetools.app, so it cannot render in Discord's iframe as deployed; sign-in and external links use window.open/location redirects. | repo | apps/web-app/public/_headers:31,37 ; apps/web-app/src/services/auth-service.ts | accessed 2026-10-11 |
| c10 | Discord changelog 2026-09-22: age assurance rollout; integrations continue to work as is; 'Age-restricted Activities may require users to confirm their age group.' | primary | https://raw.githubusercontent.com/discord/discord-api-docs/refs/heads/main/developers/change-log.mdx | 2026-09-22 |
| c11 | Discord changelog 2026-10-05 (after the 07 refresh): sites can add a discord:component-embed JSON payload (inline script in head, or a link rel) to render link previews as a display-only Components V2 layout; payload under 3,000 bytes; server-rendered HTML required. | primary | https://github.com/discord/discord-api-docs/pull/8606 | 2026-10-05 |
| c12 | Other 2026 changelog items: default file upload limit 10 to 20 MiB (including interaction responses) on 2026-09-03; fuzzy slash-command autocomplete on 2026-09-11; context-menu command limit 5 to 15 on 2026-03-03; privileged intent review threshold moved to 10,000 users on 2026-06-10. | primary | https://raw.githubusercontent.com/discord/discord-api-docs/refs/heads/main/developers/change-log.mdx | 2026-09-11 |
| c13 | api-worker returns JSON only (plus a proxied XIVAPI icon PNG); no rendered card endpoint; no API keys (X-API-Key deliberately removed); CORS origin '*'. | repo | apps/api-worker/src/index.ts:98-117 ; apps/api-worker/README.md:7-28 | accessed 2026-10-11 |
| c14 | Public API limit is 60 requests plus 5 burst per 60 s per client IP, enforced per colo by the Workers binding at 65; service-binding calls with no CF-Connecting-IP get a separate 1300/min bucket. | repo | apps/api-worker/src/middleware/rate-limit.ts:30-77 ; apps/api-worker/docs/guide/rate-limits.md | accessed 2026-10-11 |
| c15 | crawler-detector.ts matches Discordbot, Twitterbot, facebookexternalhit, Facebot, LinkedInBot, Slackbot, TelegramBot, WhatsApp, Open Graph, MetaInspector, Applebot; Googlebot excluded on purpose. | repo | apps/og-worker/src/crawler-detector.ts:19-52 | accessed 2026-10-11 |
| c16 | KakaoTalk's scraper reportedly sends 'facebookexternalhit/1.1;kakaotalk-scrap/1.0', which the existing facebookexternalhit pattern already matches; 07's claim that KakaoTalk gets only the generic card is probably wrong. | secondary | https://devtalk.kakao.com/t/user-agent/120219 | accessed 2026-10-11 |
| c17 | LINE's crawler UA is 'Mozilla/5.0 (compatible; Linespider/1.1; +https://lin.ee/4dwXkTH)', documented on LINE's help page; it follows robots.txt. | primary | https://help2.line.me/linesearchbot/web/?contentId=50006055&lang=en | accessed 2026-10-11 |
| c18 | Stoat's January embed service sends 'Mozilla/5.0 (compatible; January/2.0; +https://github.com/stoatchat/stoatchat)' and spoofs Discordbot/2.0 for reddit.com and klipy.com. | primary | https://raw.githubusercontent.com/stoatchat/stoatchat/main/crates/services/january/src/requests.rs | accessed 2026-10-11 |
| c19 | Mastodon's outbound UA is 'Mastodon/<version> (http.rb/<version>; +https://<domain>/)'; every instance fetches previews separately. Synapse's UA is reported as 'Synapse (bot; +https://github.com/matrix-org/synapse)' (third-party only); Bluesky as 'Bluesky Cardyb/1.1' and Reddit as 'redditbot/1.0' (third-party directories only). | secondary | https://raw.githubusercontent.com/mastodon/mastodon/main/lib/mastodon/version.rb ; https://knownagents.com/agents/synapse ; https://chrisleverseo.com/user-agents/bluesky-cardyb/ ; https://knownagents.com/agents/redditbot | accessed 2026-10-11 |
| c20 | WhatsApp's fetch UA is 'WhatsApp/2.x.x.x' plus A, I or N per Meta's developer docs; Signal fetches previews client-side; no Twitch crawler UA or Fluxer unfurler UA was found. | primary | https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/ | accessed 2026-10-11 |


## Corrections to the 2026-10-04 refresh

- 07 section 1 item 3 and section 6 say KakaoTalk gets the generic card. Kakao DevTalk answers give the scraper UA as 'facebookexternalhit/1.1;kakaotalk-scrap/1.0', which the existing /facebookexternalhit/i pattern already matches (secondary source; confirm live). Source: https://devtalk.kakao.com/t/user-agent/120219
- 07 section 1 item 8 left open whether the API returns cards and whether 60 req/min suits a hosted bot. Answer: JSON only (plus a proxied icon PNG), no keys, 60+5 per IP per colo; a shared-IP bot will hit it. Source: apps/api-worker/src/index.ts:98-117 and src/middleware/rate-limit.ts:30-77.
- 07 section 1 item 3 says Bluesky, Mastodon, Matrix, Stoat, Fluxer, LINE and KakaoTalk 'get the generic site card'. Still true for all but KakaoTalk (above) and WhatsApp/Telegram, which are matched. The Fluxer UA is unknown, so it is not yet a patterned addition.
- 07 (dated 2026-10-04) predates Discord's 2026-10-05 changelog entry on discord:component-embed link previews, so it does not mention that option. Source: https://raw.githubusercontent.com/discord/discord-api-docs/refs/heads/main/developers/change-log.mdx
- 07 section 1 says 'Stay on Discord. The bot needs no change.' That holds for age assurance, but it omits that the bot is guild-install only. User-installable apps (GA since 2024-06-27) are a free, low-effort reach lever that 07 did not evaluate. Source: apps/discord-worker/scripts/register-commands.ts; https://github.com/discord/discord-api-docs/pull/6958/files


## Open questions

- Is User Install already enabled in the Developer Portal Installation settings for the production app, and is the app verified (needed for App Directory Discovery)?
- Do autocomplete, ephemeral replies with PNG attachments, and the 5-follow-up cap behave as expected in a server where the bot is not a member and Use External Apps is off? Needs a real test.
- Which contexts values let an Activity launch in a DM or text channel, and are user-installed Activities supported today? Current docs read were silent.
- What are the real outbound UA strings of Fluxer's unfurler and Twitch? Read fluxerapp/fluxer fluxer-unfurl source and log live requests.
- Do the Synapse, Bluesky Cardyb and redditbot UA strings match live traffic? Only third-party directories document them.
- Should the privacy policy and terms be amended for user-install contexts (DMs, group DMs, servers without the bot), and does that interact with the 12-file-per-platform policy plan in 07 section 7?
- Should the community-bot API get an optional key or higher-limit tier before the docs page is published, given the shared-IP issue?
