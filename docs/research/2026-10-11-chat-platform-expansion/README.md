# Chat platform expansion — 2026-10-11

**Date:** 2026-10-11
**Question:** Where can the XIV Dye Tools chat bot go next? Should `apps/stoat-worker` be un-parked, and which other platforms where FFXIV players gather are worth an adapter? The maintainer asked for a closer look at Bluesky.
**Status:** In progress. The cloud research phase is done: 12 raw agent reports in [`evidence/cloud/`](evidence/cloud/). Next comes a local phase: fact-check against primary pages, measure Bluesky directly, then write the final report over this file (§6). Builds on the [2026-10-04 refresh](../discord-alternatives/07-2026-10-refresh.md), which stays the current verified survey until this one is finished.

---

## 1. Read this first: how far to trust what is here

- **The container could reach GitHub and npm, and nothing else.** WebFetch failed with DNS errors on every other host, including discord.com, docs.discord.com, bsky.app, the Bluesky API hosts, stoat.chat, dev.twitch.tv, developers.cloudflare.com, Lodestone, Reddit and every directory site.
- **What was read directly** (labeled `primary` or `repo` in the evidence files):
  - this repo;
  - npm tarballs;
  - GitHub-hosted sources: Discord's `discord-api-docs` repo, Bluesky's `atproto` lexicons, `bsky-docs` and `social-app`, the `stoatchat` repos (cloned), Cloudflare's docs repo, Mastodon and Synapse source.
- **Everything else is a search-result snippet.** That includes every community-size number, price, follower count and policy page. Treat those as leads.
- **No adversarial fact-check has run yet.** The 2026-10-04 refresh had one; this phase did not. Contradictions between agents are listed in §4.
- **Two workflows produced the 12 reports.** The prompts are in [`evidence/workflows/`](evidence/workflows/), so a run can be repeated with full network access.
  - `chat-platform-research`: 9 agents (codebase C1–C2, platforms P1–P7).
  - `bluesky-deep-dive`: 3 agents (B1a, B1b, B2).
  - Before re-running `bluesky-deep-dive`, drop its "Network limits" paragraph, which describes this container.

| File | Scope |
|---|---|
| [C1-discord-reach](evidence/cloud/C1-discord-reach.md) | Discord user-install, Discord Activities, the public API for community bots, og-worker crawler list |
| [C2-adapter-and-stoat-unpark](evidence/cloud/C2-adapter-and-stoat-unpark.md) | Shared-code re-measure, the platform-adapter seam, revolt.js → stoat.js, rendering off-Workers, un-park checklist |
| [P1-stoat](evidence/cloud/P1-stoat.md) | Stoat since 2026-10-04, FFXIV presence, hosting options and prices |
| [P2-fluxer-matrix-others](evidence/cloud/P2-fluxer-matrix-others.md) | Fluxer, Matrix, Spacebar, Root, TeamSpeak 6, Steam chat |
| [P3-streaming](evidence/cloud/P3-streaming.md) | Twitch chat bot and Extensions, YouTube Live, Kick, Nightbot/StreamElements commands |
| [P4-social-forums](evidence/cloud/P4-social-forums.md) | Reddit (Devvit), Bluesky, Mastodon/Misskey, Threads, X, Tumblr |
| [P5-messengers](evidence/cloud/P5-messengers.md) | Telegram (bot, Mini App, inline), WhatsApp, Signal, Messenger |
| [P6-east-asia](evidence/cloud/P6-east-asia.md) | Japan, Korea, the Traditional Chinese service, mainland China |
| [P7-ffxiv-census](evidence/cloud/P7-ffxiv-census.md) | Where FFXIV communities actually are, by community |
| [B1a-bluesky-accounts](evidence/cloud/B1a-bluesky-accounts.md) | FFXIV on Bluesky vs X: official and creator accounts |
| [B1b-bluesky-content](evidence/cloud/B1b-bluesky-content.md) | FFXIV on Bluesky vs X: feeds, starter packs, hashtags, migration |
| [B2-bluesky-bot-design](evidence/cloud/B2-bluesky-bot-design.md) | A Bluesky bot on our Workers stack: ingestion, replies, limits, policy, effort |

---

## 2. Interim findings

Ordered by value for effort. Nothing here is a recommendation until §6 step 1 has run.

### 2.1 Discord user-install: the cheapest new reach (new since 2026-10-04)

**What the repo shows** (`repo`, C1):
- `apps/discord-worker/scripts/register-commands.ts` sets neither `integration_types` nor `contexts`.
- Under the bulk-overwrite defaults in Discord's docs, all 18 commands are therefore **guild-install only**.
- The bot reaches no Free Company or linkshell server whose admin never installed it, and the census (P7) puts essentially every FFXIV community on Discord.

**Code audit** (`repo`, C1): little would break under user install.
- Identity is read as `member?.user?.id ?? user?.id` everywhere.
- Rate limits and preferences are keyed by user.
- Every user-facing reply goes through the interaction webhook.
- The only bot-token channel posts go to our own moderation and log channels.

**Work** (about 0.5–1 dev-week):
- Set `integration_types: [0, 1]` and `contexts: [0, 1, 2]` on every command except `stats`.
- Enable User Install in the Developer Portal.
- Add an install-type analytics dimension, without guild IDs.
- Review the six privacy-policy and ToS languages.
- Test in a server without the bot, a DM and a group DM.

**Unknowns that need a live test:**
- Whether User Install is already on in the portal.
- Responses become private when a server turns off **Use External Apps** (C1 reads the old 25-member rule as removed, `primary` via the docs repo).
- A 5-follow-up cap applies when the app is not in the server.
- Ephemeral replies with PNG attachments, and autocomplete in servers without the bot.

**Also new:** Discord's 2026-10-05 changelog adds `discord:component-embed` link previews, which og-worker could serve.

### 2.2 Bluesky (the maintainer's interest)

**Presence.** The numbers are snippet-grade, from B1a and B1b.

| Data point | Bluesky | X | Ratio |
|---|---|---|---|
| Official FFXIV EN (`en.finalfantasyxiv.com` / `@FF_XIV_EN`) | 100,541 (undated; may be a follow count, see §4) | 652.4K (undated; another tracker had 437K in July 2023) | 0.154 |
| GPOSERS | 2,043 | 19.8K (likely stale) | 0.103 |
| Mrhappy1227 (FFXIV focus unconfirmed) | 5,023 | 50.1K | 0.100 |
| Kaiyoko Star (stepped away from Fashion Report 2025-01-14) | 2,612 | 77.6K | 0.034 |
| Zepla (X reportedly inactive, "moved to Bluesky") | 959 | 90.7K | 0.011 |
| Platform baseline: mobile MAU, Similarweb June 2026 | 10.4M (−27% YoY) | 302M | 0.034 |

- **Official accounts.** Square Enix opened four official FFXIV Bluesky accounts (EN, FR, DE, JA) in mid-2025 as a complement to X. The EN account posted on 2026-10-09. Only the EN handle was found.
- **Follower ratio.** The median of the 5 pairs is 0.10, about 3× the platform baseline. The official EN account sits at 4.5× the baseline.
  - That fits the maintainer's observation that FFXIV over-indexes on Bluesky relative to the platform's size.
  - It does **not** show that players post more there than on X. Follower counts measure an accumulated audience, n = 5, and the dates don't match.
- **Activity measures.**
  - 53+ FFXIV starter packs exist; individual packs list 8–12 members.
  - FFXIV gpose and general feeds exist, with no like counts retrievable.
  - The only volume figure is one Japanese feed, which claims 150+ posts a day.
  - No hashtag-volume tracker covers either platform.
- **Platform trend.** Bluesky is shrinking:
  - mobile DAU about 3M (July 2026, −25.6%);
  - daily posters down from 1.4M (late 2024) to about 600K (mid-2026).
- **Measurement.** This needs the open network the container lacked. [`evidence/scripts/bsky-ffxiv-census.mjs`](evidence/scripts/bsky-ffxiv-census.mjs) does it; see §5.

**Bot design.** Mostly `primary`, from Bluesky's lexicons and docs on GitHub (B2).

| Topic | Finding |
|---|---|
| Ingestion | A Cron Trigger polls `app.bsky.notification.listNotifications` every minute: median reply about 30 s, no extra cost. Jetstream can't filter by mention, and Bluesky has no webhook. A Durable Object alarm poller is the upgrade path for latency. |
| Images | A real 2× render of our cards is 51–57 KB, about 2.9% of the 2,000,000-byte cap per image. Keep PNG. The new `app.bsky.embed.gallery` (June 2026) takes up to 10 images in clients. |
| No private replies | DMs carry no images, need a privileged app password, are blocked by most users' default (`allowIncoming = following`), and are age-gated in several regions. Errors go in short public replies. |
| Auth | An app password, not OAuth: Bluesky's own OAuth guide says OAuth is not recommended for headless bots. Persist the refresh token. |
| Go/no-go risk | Per-IP limits applied to Cloudflare's shared egress IPs (atproto #3388). A day-1 spike settles it. |
| Policy | Self-label the account `bot`, reply only when tagged, provide a deletion path and a monitored contact email. |
| Handle | Use a DNS TXT record at `_atproto.xivdyetools.app`. The web app's SPA fallback answers `/.well-known/atproto-did` with HTML (`apps/web-app/public/_redirects:3`). |
| Link cards | og-worker has no pattern for Bluesky's `Cardyb` fetcher. |
| Effort | MVP (dye info, match and harmony cards; en and ja reviewed): about **4–5.3 dev-weeks** including policy and pipeline. The full bot: about 6–9 weeks. |

**Check before any new public surface:** B2 saw snippets saying Square Enix's **FFXIV Materials Usage License** was revised with effect from 2026-09-16. Per those snippets it is non-commercial, asks for "© SQUARE ENIX" "with every use", and bars soliciting donations. The repo links Patreon and Ko-fi (`README.md:169-170`, `apps/discord-worker/src/handlers/commands/manual.ts:305`). Read the license text (NA rule 5382, EU rule 5383) before deciding anything. It concerns the existing bot too, not only Bluesky.

### 2.3 Stoat un-park

- **Presence is tiny.** One FFXIV server on stoatservers.com has 53 members and 11 online. Its ID decodes to a creation date of 2026-02-10, and it was last bumped about 5 months ago. A Discover snippet shows a separate FFXIV-themed server of about 85 members. No FFXIV bot exists there, and no Free Company was found moving.
- **The API has not moved** (`primary`, stoat-api 0.15.5 OpenAPI, 2026-09-12):
  - `interactions_url` is still "Reserved";
  - edits can't add files;
  - embeds have no fields, and their text counts toward the 2,000-character cap.
- **Library** (`primary`, npm and the SDK repo):
  - `stoat.js` 7.3.6 (2026-01-16) is still the npm latest.
  - The 2026-10-06 WebSocket reliability fix (#198) is **unpublished**, so pin a git commit.
  - All 11 APIs the bot uses are unchanged, and `Client.uploadFile` is new.
- **Gateway.** An Elixir events-gateway rewrite is under heavy development (31 commits in two weeks). Bot compatibility is unknown.
- **Hosting** (snippet prices):
  - Fly.io: about $2–4 a month.
  - Cloudflare Containers: GA since 2026-04-13, about $2–7 a month on top of Workers Paid. Its 10-minute idle timeout isn't renewed by a background socket, and it has no 24/7 guarantee.
  - A Durable Object relay needs an alarm watchdog.
- **Effort** (C2):
  - A lookup-only MVP with no images: about 2 weeks.
  - T1 parity: 4–6 weeks, plus 2–3 weeks of shared extraction.
  - The checklist with file:line items is in C2 §7.

### 2.4 Traditional Chinese: the biggest regional gap (new since 2026-10-04)

- **The service.** A Traditional Chinese FFXIV service has been live since **2025-12-10** (snippet, P6). It covers Taiwan, Hong Kong, Macau, Singapore and Malaysia, operated by UserJoy and 智寶國際.
- **The repo maps `zh-TW` to Simplified `zh`** (`packages/bot-logic/src/i18n/locale-resolution.ts:59-60`), so those players get Simplified text and Simplified dye names.
- **Taiwanese players gather in LINE OpenChat** (rooms of 443, 579 and 211 members), which bots cannot join. Hong Kong players are on Discord (one server has 8,940 members).
- **The fix is a locale, not a platform:**
  - the TC client's official dye names (source not found);
  - Traditional UI strings;
  - Noto Sans TC subsets;
  - gate updates.
- **Estimate:** about 2–4 weeks. It helps the existing Discord bot and the web app.

### 2.5 Smaller reach items (each a few days)

- **og-worker crawler patterns.** Add `Linespider` (LINE), `January` (Stoat), `Mastodon/`, `Synapse (bot` (Matrix), `Bluesky Cardyb` and `redditbot`. KakaoTalk's scraper reportedly already matches `facebookexternalhit` (a correction to 07). 1–2 days.
- **Stream-bot text endpoint.** For example `GET /v1/bot/dye?q=&locale=` returning `text/plain` capped at 400 UTF-8 bytes. StreamElements truncates at 400 *bytes* and Nightbot at 400 characters. Give it its own rate-limit bucket, because the current 60+5 per minute per IP would 429 shared bot IPs. 2–3 days.
- **Public API docs page.** The API is JSON only, anonymous, CORS `*`, 60+5 per minute per IP per colo. There is no rendered-card endpoint. 1–2 days.

### 2.6 Everything else

| Platform | Interim verdict | Why |
|---|---|---|
| Twitch chat bot | Spike only with a partner streamer | It fits Workers (EventSub webhook plus Helix send), but it is text-only, every channel needs `channel:bot` consent, and bot verification is paused. The category averages about 4–7K concurrent viewers. |
| Twitch Extension | Watch | It is the only Twitch surface with visuals, but each streamer has to install it, and it needs Twitch review. 2–4 weeks. |
| Reddit (Devvit) | Spike only with moderator buy-in | r/ffxiv has about 1.3–1.4M members. Image comments look supported (unofficial docs mirror). The Data API is reportedly closing in March 2027 (secondary). |
| Telegram | Build only if asked | A sweep in English, Russian, Japanese, Portuguese and Spanish found no FFXIV community. Brazil (4,860), Spanish (about 6,200) and Latin American (about 3,000) communities are on Discord. A Mini App launcher, about 1–2 weeks, is the cheapest probe. |
| Fluxer, Matrix | Watch | No interactions on Fluxer; Matrix's MSC4391 has no autocomplete (a correction to 07). Fluxer is not end-to-end encrypted. No FFXIV presence was found on either. |
| QQ / KOOK / WeChat | Skip as adapters | Real-name verification, mainland hosting and IP allowlists. Chinese FF14 bots run on QQ through Koishi/NoneBot and none does dyes, so an open-source plugin is a possible side path. |
| LINE, KakaoTalk | Skip | Bots can't join OpenChat or open chats, which is where these groups are. |
| WhatsApp, Signal, Messenger, Threads, Tumblr, Kick, YouTube Live, Root, Spacebar, TeamSpeak 6, Steam chat | Skip | No fit, no FFXIV audience evidence, or both. |

### 2.7 Shared foundation (any second platform)

- **Shared code today** (C2, method stated):
  - `bot-logic` plus `svg` is 50.3% of the code a platform needs;
  - `bot-logic` alone is 29.3%.
- **Even the thin Discord handlers compose the final text** with Discord emoji and markdown.
- **The proposed seam** (C2 §5):
  - a platform-neutral `CommandReply` with the share URL in its own field;
  - a `TextFormatter` per markup;
  - the resolver moved into `bot-logic`;
  - an `ActorId`-namespaced `PreferenceStore`;
  - a shared `Renderer` with two backends.
- **Estimate:** 2–3 weeks, paid once.
- **Vercel's Chat SDK** has the right shape but no Stoat or Fluxer adapter and no documented autocomplete.

**Competition** (P7, snippets):
- Ser Aymeric (about 47K servers) and Kweh! cover general FFXIV and glamour lookups.
- No dye-matching bot turned up on any platform.

---

## 3. What changed against the 2026-10-04 refresh

Collected from the agents' correction lists. Verify each before it moves into the final report.

| 07 says | Cloud phase found | Source |
|---|---|---|
| "Stay on Discord, the bot needs no change" | True for age assurance, but it misses that the bot is guild-install only (§2.1) | C1 (`repo`) |
| `zh` treated as mainland only | A Traditional Chinese service has been live since 2025-12-10, and `zh-TW` maps to Simplified | P6 (snippet), `repo` |
| KakaoTalk gets the generic share card | Its scraper UA reportedly contains `facebookexternalhit`, which is already matched | C1 (secondary) |
| Matrix autocomplete "only if MSC4391 is adopted" | MSC4391 defers autocomplete to a later MSC | P2 (`primary`, PR read) |
| Fluxer E2EE "(verify)" | Not E2EE, per its privacy policy | P2 (snippet) |
| `chara-attachment.ts:26-28` | The allowlist is now at lines 42-45 | C1, C2, B2 (`repo`) |
| 48% shared, no method | 50.3% (bot-logic + svg) or 29.3% (bot-logic alone), method stated | C2 (`repo`) |
| "STOAT-02" and "DEAD-030" | STOAT-2 under FINDING-035. The Stoat dead-code leftovers are DEAD-064 in the 2026-10-04 audit | C2 (`repo`) |
| Stoat endpoints `api.stoat.chat` / `events.stoat.chat` | The SDK defaults to `stoat.chat/api` and `wss://stoat.chat/events`. Live config not fetched | C2 (`primary`, tarball) |
| Durable Object: inbound frames "do not count as activity" | Consistent with Cloudflare's docs, but not stated in them | P1 (`primary`, docs repo) |
| Reddit registration deadline 2026-09-30 | Later dates reported (new access requests close 2026-10-31; public API closing March 2027) | P4 (secondary) |
| Bluesky image cap "raised to 2 MB" | Confirmed, and the new gallery embed holds up to 10 images in clients | B2 (`primary`, lexicon) |

---

## 4. Contradictions to settle in the local phase

- **`@FF_XIV_EN` follower count.** 652.4K (undated snippet, B1a and B1b) against about 437K (a tracker, July 2023, P4 and P7). Probably growth; read the live profile.
- **`en.finalfantasyxiv.com` "100,541".** Followers, or a follow count? B1a read it as followers; B1b and P4 flagged it as ambiguous.
- **r/ffxiv size.** 1.3M (GummySearch, before 2025-11-30) against 1.4M (07, 2026-09-30).
- **Stoat users.** 1M registered (official, 2026-03-29) against an undated 1.4M staff-blog snippet.
- **Stoat FFXIV servers.** 53 members (stoatservers.com) against about 85 ("One Normal Server", a Discover snippet). Possibly two different servers.
- **Discord command defaults.** The bulk-overwrite text says `integration_types` defaults to `[0]`. The command-object table says it "defaults to your app's configured contexts". Set both fields explicitly either way.
- **Cloudflare Containers.** The idle-timeout API is named `renewActivityTimeout` in one doc and `setInactivityTimeout` in another.
- **YouTube `liveChatMessages.insert`.** 20 or 50 quota units?
- **Twitch limits.** The 500-character limit and the verified-bot rate (7,500 per 30 s) are unconfirmed.
- **Matrix.** Did Element actually enforce MSC4153 (hiding messages from non-cross-signed devices) in October 2026?

---

## 5. Measuring Bluesky directly

[`evidence/scripts/bsky-ffxiv-census.mjs`](evidence/scripts/bsky-ffxiv-census.mjs) needs Node 22+ and no dependencies. It calls only Bluesky's public AppView and Jetstream.

| Command | Output |
|---|---|
| `node bsky-ffxiv-census.mjs profiles` | Followers and posts for the handles at the top of the script. Add the FR, DE and JA official handles once they are found. |
| `node bsky-ffxiv-census.mjs actors` | Top 50 accounts matching FFXIV terms, by followers |
| `node bsky-ffxiv-census.mjs starterpacks` | FFXIV starter packs with members, `joinedWeekCount` and `joinedAllTimeCount` |
| `node bsky-ffxiv-census.mjs feeds` | FFXIV feed generators with like counts |
| `node bsky-ffxiv-census.mjs tags 7` | Posts per day for #ffxiv, #ff14, #gpose and the others over the last 7 days |
| `node bsky-ffxiv-census.mjs stream 60` | A live 60-minute Jetstream sample: FFXIV posts per hour, share of all posts, and language split |

**Running it:**
- Run `tags` with a throwaway app password in `BSKY_HANDLE` / `BSKY_APP_PASSWORD` if the public `searchPosts` endpoint refuses unauthenticated calls.
- Run `stream` three times, in the NA, EU and JP evenings. One hour is not a daily rate.
- Save the JSON outputs under `evidence/bluesky-census/` with the date and time.

**The X side can't be measured the same way** without the paid API.
- Record X follower counts by hand for the same accounts.
- Compare with the follower ratio, not post volume.
- If a stated goal needs post volume on X, say so in the report rather than estimating it.

The script was syntax-checked here (`node --check`) but never run against the live API, since the container could not reach it. Expect to fix small things on the first run.

---

## 6. Next steps (local)

1. **Fact-check.** Each evidence file ends with a key-claims table that gives a confidence for every claim. Verify every `snippet`, `secondary` or `unverified` claim that would change a verdict, using the primary page. Spread the work across independent verifiers (CLAUDE.md § Subagent models: `xivdye-verifier`). Priority:
   1. **Discord user-install.**
      - Read the rendered pages: Application Commands, Receiving and Responding, and Developing a User-Installable App.
      - Check the app's Installation page in the Developer Portal.
      - Write the live-test plan from §2.1.
   2. **The FFXIV Materials Usage License** full text: the donation clause and "with every use".
   3. **Bluesky.**
      - Run §5.
      - Read the Community Guidelines and the developer guidelines on bsky.social.
      - Confirm the Cardyb UA from a test share.
   4. **The Traditional Chinese service.**
      - ffxiv.com.tw: launch date, client languages.
      - Find a source for the TC dye names.
   5. **Stoat.**
      - Search Discover by hand for FFXIV.
      - Read the live `GET https://api.stoat.chat/` config.
      - Check stoat.js 7.3.7 on npm.
      - Check the gateway's bot compatibility.
   6. **Hosting prices** on Fly.io's and Cloudflare Containers' own pricing pages.
   7. **Twitch:** scopes and limits on dev.twitch.tv.
   8. **Reddit:** developers.reddit.com (http-fetch, media uploads, triggers), and Reddit's own Data API announcement.
2. **Settle §4.**
3. **Write the final report over this README.**
   - Keep the ranked decision list and the per-platform tables. Keep `evidence/` as is.
   - Add an adversarial-verify note under §1.
   - Update the row for this directory in [`../index.md`](../index.md).
   - Change the `Status:` line of [07-2026-10-refresh.md](../discord-alternatives/07-2026-10-refresh.md) to point here.
4. **Decisions for the maintainer** (draft, after step 1):
   - Turn on Discord user-install?
   - Bluesky: go or no-go on the MVP, after the census and the day-1 Workers-IP spike?
   - Stoat: a lookup-only MVP, the T1 build, or stay parked? Which host?
   - Fund the `zh-TW` locale? It depends on finding the TC dye names.
   - Run 07's one-week community poll (§8 step 2) first? If so, add Bluesky and "Discord, via user-install" to its options.
