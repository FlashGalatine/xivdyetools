> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

## Summary

- **Ingestion.** Use a Cron Trigger that polls `app.bsky.notification.listNotifications` once a minute. It costs $0 on Workers, replies arrive in about 30 s at the median and 60–65 s at worst, and it is the pattern Bluesky's own bot tutorial uses [16].
  - **If latency matters later:** a Durable Object (DO) alarm that polls every ~10 s cuts that to roughly 5–10 s.
  - **Jetstream does not fit.** Its `wantedDids` filter matches the *author's* repo, not mentions, so catching mentions means streaming every post on the network [15].
  - **Bluesky has no official webhook or push channel** for notifications [6][15][34].
- **Images fit easily.** A real 2× render of our cards is 51–57 KB as PNG. That is 2.5–2.9% of the 2,000,000-byte per-image cap [2], so no 1×, JPEG or WebP fallback is needed.
- **DMs cannot replace ephemeral replies.**
  - DM messages carry no images [7].
  - By default only people a user follows can DM them [24], and age checks remove DMs in several regions [25].
  - Using DMs needs a separate "privileged" app password [9][23], and DMs have an undocumented rate limiter [22].
- **Policy.**
  - Label the account `bot` and reply only when tagged ("opt-in") [11][16].
  - The developer guidelines require a way to delete content on request, plus a monitored public contact email [12].
  - The FFXIV Materials Usage License (revised, effective 2026-09-16 per snippets) is non-commercial, asks for a © SQUARE ENIX notice "with every use," and bars soliciting donations [29].
- **Biggest technical risk:** Bluesky's per-IP limits applied to Cloudflare's shared egress IPs (atproto issue #3388) [21]. Spend one day on a spike before committing.
- **Effort.**
  - 07's build estimate holds for the bot itself, but leaves out about 3.5–5 days of policy and pipeline work.
  - **MVP** (dye info, match and harmony card replies; en+ja checked, all six locales present for the gate): **19.5–26.5 days (≈4–5.3 weeks)**.
  - **Full** (all commands that fit, image extraction, budget, read-only presets, DO poller): **≈31–44 days (6–9 weeks)**.

---

## 1. Ingestion options (Cloudflare Workers stack)

| Option | How | Latency | Cost / ops | Verdict |
|---|---|---|---|---|
| **(a) Cron poll** | `listNotifications` with `reasons=[mention, reply]`, `limit` ≤100, a `cursor` for paging, then `updateSeen(seenAt)` [6] | Up to 60 s from the 1-minute cron [30], plus ~2–5 s to work. Median ~30 s. | 1,440 calls a day, far below 3,000 per 5 min per IP [10]. Uses one cron slot (Free: 5 per account [30]; the repo uses 1, at `apps/presets-api/wrangler.toml:125-126`). | **Recommended** |
| (a′) DO alarm poll | Same calls from a DO alarm that re-arms every ~10 s | ~5–10 s | ~8,640 short alarm runs a day. Billed only while running; unlike a socket held open 24/7, this is not 10,800 GB-s/day [07 §4] *(estimate)*. | Upgrade path |
| (b) Jetstream WebSocket | `wantedCollections=app.bsky.feed.post`, then scan every post's facets for our DID | ~1 s | `wantedDids` filters by **repo author**, at most 10,000 DIDs [15], so it can't select mentions. Volume: 2025 averaged ~3.86M posts/day (~45/s; snippet) [31], about 850 MB/day of posts in 2024 [31]. Needs a persistent consumer: a DO, where an outbound WS lasts at most 15 min and runs ~10,800 GB-s/day (07 §4), or a Node host. Jetstream v2 is a rewrite that promises the same URLs and payload [15]. | Reject |
| (c) Webhook / push | None in the lexicons or docs. Third-party relays such as tailscale/bsky-webhook turn Jetstream into webhooks [34]. | — | Adds a third-party dependency | Not available |
| (d) Feed generator / labeler | A feed needs our own post index, which means Jetstream. A labeler emits labels, not replies. | — | — | Not relevant to replies |

**Polling details** (primary sources):
- `seenAt` as a request parameter on `listNotifications` is "deprecated… will cause an error." It survives only in the response and in `updateSeen` [6].
- The tutorial's loop filters on `notif.isRead` but never calls `updateSeen` [16]. It also uses the mention as `root` even when the mention is itself a reply. Neither should be copied.
- **Design:**
  - Use the D1 unique key `notif.uri` as an idempotency record.
  - Store a high-water `indexedAt` and page with `cursor` until you pass it.
  - Process, then call `updateSeen`.
  - Retries must not double-post.
- **Notification reasons available** [6]: `mention`, `reply` and `quote`, among others.
  - Act on `mention`.
  - Act on `reply` to a bot post only if it contains a command keyword.
  - Ignore `quote`.
- **CPU.** A cron run gets 10 ms CPU on Workers Free and 30 s on Paid [30]. A resvg render will not fit in 10 ms *(assumption)*. Discord-worker renders today, which suggests a paid plan, but 07 §8 step 5 has not confirmed it.

## 2. Replying

**Post record** (`app.bsky.feed.post`) [4]:
- `text` is limited to 300 graphemes and 3,000 bytes.
- `langs` takes up to 3 entries.
- `tags` takes up to 8.
- The `embed` union includes `images`, `video`, `gallery`, `external`, `record` and `recordWithMedia`.
- `reply` needs both `root` and `parent` strongRefs (uri + cid). Copy the parent's `reply.root` when one exists [13].

**Facets** [4]:
- Mentions and links use UTF-8 **byte** offsets.
- Strip our own mention facet before parsing the command.

**Images and galleries:**
- `app.bsky.embed.images` holds at most 4 images. Each blob has `maxSize: 2000000` ("formerly limited to 1 MB"), takes `accept: image/*`, and requires `alt` [2].
- The posts guide still contradicts itself: its prose says 1,000,000 bytes (posts.md:437), while its sample code checks 2,000,000 (posts.md:334-337) [13].
- **New since 07:** `app.bsky.embed.gallery` holds up to 20 items (clients should keep to 10). Each item is ≤2 MB and **requires** `aspectRatio` [5]. It shipped in June 2026 [5].
- That suits `/dye random`-style grids and multi-card replies.

**Link-card alternative** (`app.bsky.embed.external`):
- Fields are `uri`, `title` and `description`, plus a `thumb` blob of at most 1,000,000 bytes [3].
- The API does not build the card. We fetch the og image, upload it, and fill the fields ourselves [13].

**Formats:**
- The lexicon accepts `image/*` [2], and the PDS is told not to parse media [18], so WebP is schema-legal.
- Third-party sources list jpeg, png, gif and webp as accepted (snippet).
- Viewers see CDN transcodes (the guide's example URL ends `@jpeg`) [18]. Text-heavy PNG cards may show JPEG artifacts, which a beta check should confirm.

**Our cards:**
- Cards are drawn at `CARD_WIDTH = 400` and capped at `CARD_MAX_HEIGHT = 350` (`packages/svg/src/frame.ts:28,31`). The SVG shell is 1× (`frame.ts:209-216`).
- Every caller renders at `scale: 2` (`apps/discord-worker/src/services/svg/renderer.ts:99,119-123`; for example `handlers/commands/dye.ts:239` and `harmony.ts:176`). The maximum is therefore 800×700 px.
- No repo test or fixture records PNG byte sizes. I rendered two cards locally from `packages/svg` source with @resvg/resvg-js 2.6.2: the same resvg version as the Worker's resvg-wasm 2.6.2, but the native build. Fonts came from `apps/discord-worker/src/fonts`.

| Card | Size (px) | PNG bytes |
|---|---|---|
| Dye info, 1× | 400×350 | 22,683 |
| Dye info, 2× | 800×700 | 50,894 |
| Harmony (3 slots), 1× | 400×278 | 25,763 |
| Harmony (3 slots), 2× | 800×556 | 57,131 |

- **Ratio (computed):** 57,131 / 2,000,000 = 2.9%. Even a raw 800×700 RGBA bitmap (2,240,000 bytes) barely exceeds the cap, and these flat cards compress about 40×. **Keep the 2× PNG.**
- **Alt text** has no lexicon max length [2]. Generate it from bot-logic i18n.
- **`aspectRatio`** is known from the SVG width and height, so no image parsing is needed.

## 3. Private replies (DMs)

**Mechanics:**
- `chat.bsky.convo.*` calls go to the PDS with an `atproto-proxy` header naming `did:web:api.bsky.chat` (`#bsky_chat` in client libraries; secondary) [23].
- The app password must have DM access: `createAppPassword` has a `privileged` flag [9], and you can't add DM access afterward [23]. Without it, calls fail with "Bad token scope" [23].
- A bot account can technically use DMs.

**Who can DM whom:**
- `chat.bsky.actor.declaration.allowIncoming` takes `all`, `none` or `following` [7].
- The default at launch was "only people you follow" [24]. So the bot can DM a user only if that user allows `all`, or follows the bot under `following`.
- The bot itself can set `all` for inbound DMs.

**What DMs can carry:**
- A `messageInput` holds text of up to 1,000 graphemes and 10,000 bytes.
- Its embed may be **only** `app.bsky.embed.record` or `chat.bsky.embed.joinLink`, so **no images** [7].

**Rate limits:**
- No published DM limits.
- atproto issue #3246 reports 429s on `sendMessage` while `ratelimit-remaining` was above 0, which points to a separate undocumented limiter [22].

**Age assurance:**
- Unverified users lose DMs in the UK, Australia (ages 16–17) and the US states with checks [25].
- Recipients in those regions may simply be unreachable.

**Verdict:** DMs are not a usable "ephemeral" channel. Keep errors as short public replies, and send long lists to a web-app link. Leave DMs out of the MVP and use a non-privileged app password, which is a smaller blast radius.

## 4. Rate limits, auth and hosting

**Write budget** [10]:
- 5,000 points/hour and 35,000/day per account.
- CREATE costs 3, UPDATE 2, DELETE 1. That allows 1,666 creates/hour and 11,666/day.
- Each reply is one CREATE. Blob uploads are not records.

**PDS limits** [10]:
- 3,000 requests per 5 min per IP.
- `createSession`: 30 per 5 min and 300/day per account.
- `updateHandle`: 10 per 5 min and 50/day.
- Blob upload ceiling: 52,428,800 bytes.
- Relay limits apply only to a self-hosted PDS: 50 events/s, 2,600/h, 21,000/day, and 100 accounts.

**Cloudflare risk:**
- atproto #3388 reports `createSession` failing from Workers because all Workers share Cloudflare IP ranges [21].
- A live report puts `createSession` at 10/day (Aug 2026, snippet; unverified) [21].
- **Mitigation:**
  - Log in once.
  - Persist `refreshJwt` in KV or a DO.
  - Refresh on expiry.
  - Back off using `ratelimit-reset` [10][21].
  - Run the day-1 spike to confirm.

**Tokens:**
- Reference PDS defaults are a 120-minute access token and a 90-day refresh token (`packages/pds/src/account-manager/helpers/auth.ts:46,72`) [19].
- bsky.social sessions go through the entryway [14]. Its values were not checked.

**App password vs OAuth:**
- The SDK README marks app passwords "deprecated in favor of OAuth" [14].
- But the OAuth guide says OAuth is "not currently recommended… for headless clients, such as command-line tools or bots" [14], and the bot tutorial uses an app password [16].
- **Use an app password**, stored as a Worker secret.

**Hosting:** use an account on bsky.social. A self-hosted PDS adds a server, relay caps and upkeep for no gain at this volume.

## 5. Policy

**Bluesky:**
- **Self-label.** Bluesky's docs call it best practice to self-label the profile `bot` [11][16]. The app shows that label on the profile and posts (app v1.119; newsletter, snippet) [28].
- **Opt-in.** "If your bot interacts with other users, please only interact… if the user has tagged the bot account. It must be an opt-in interaction" [11].
- **Developer guidelines** [12]:
  - No automated or bulk interactions that notify users.
  - A deletion method for content a user asks to remove.
  - A response system for user reports.
  - Public contact info with a monitored email.
  - Reasonable security.
  - Records of reports.
- **Community Guidelines** (updated 2025-09-19, snippet) [27]:
  - Ban automated harassment and artificially manipulated engagement.
  - The 2025 transparency report says automated detection targets spam networks and bot operations [27].
- **No registration or approval step was found.**
- **Thread etiquette:** honor `threadgate` and `viewer.replyDisabled` [8].

**Square Enix:**
- The FFXIV Materials Usage License was revised; snippets give an effective date of 2026-09-16 [29].
- It is non-commercial. The EU text bars "solicit donations" and "crowdfunding."
- It requires "© SQUARE ENIX" "with every use of the Materials" [29].
- Use is limited to "websites, blogs, and/or social media." Bots aren't named.
- **Today:**
  - The Discord bot carries the notice in `/about` (`apps/discord-worker/src/handlers/commands/about.ts:28`) and in its ToS (`TERMS_OF_SERVICE.*.md:75`).
  - Patreon and Ko-fi links appear in `README.md:169-170` and `apps/discord-worker/src/handlers/commands/manual.ts:305`.
- **For Bluesky:**
  - Put the notice in the bot bio and ToS.
  - Never put donation links in replies or the bio.
  - Whether "every use" means a footer on every card is open (and would change the Discord cards too).
  - The full text should be read directly. It was only seen via snippets.

**Privacy (our policy, six languages):**
- **What we would store:**
  - The DID inside notification URIs, in a D1 dedupe table with a TTL of, say, 7 days.
  - A mapping from our reply URI to their post URI (30 days), used for deletion.
  - A DID blocklist.
  - Rate-limit counters in the native binding, not persisted.
  - No DID in Analytics Engine; use a salted HMAC (07 §7).
- **The policy must say:**
  - Replies are public and quote the user's input.
  - Attached images are fetched from Bluesky's CDN, processed in memory and not stored.
  - How to delete: a "@bot delete" reply under our reply, and email.
- **Deleted source posts:** a weekly cron could call `getPosts` on mapped parents and delete our replies whose parent is gone *(design suggestion)*.
- **Documents:** either 12 new files or amendments to the Discord documents (07 §7).

## 6. Command design

**Grammar:**
- Parse the text after stripping the mention facet [4].
- `dye <name|id>` → dye info card.
- `match #hex` → the `/extractor color` path (`apps/discord-worker/src/handlers/commands/extractor.ts:201`).
- `harmony <dye> [type]`, `gradient A > B [n]`, `mixer A + B`, `compare A, B, C`, `contrast A B`.
- `random`, `help`, `delete`.
- Accept ja/de/fr/ko/zh keyword aliases.

**Locale:**
- Take the first `langs` entry with a prefix we support [4][13]. The client auto-detects `langs` [13].
- Otherwise fall back to en.
- Set the reply's `langs` to match.
- Map through `isValidLocale` in `packages/bot-logic/src/i18n/locale-resolution.ts:84`.

**"Did you mean":**
- `searchDyesByName` does substring matching only (`packages/bot-logic/src/input-resolution.ts:81-101`). Discord gets by with autocomplete.
- Free text needs an edit-distance matcher across 125 dyes × 6 locales, which is new bot-logic work.

**Images, quotes and galleries:**
- Read the images from `getPostThread` views, covering `images`, `gallery` and `recordWithMedia`.
- Use only images in the mentioner's own post, or in the parent post they replied to.
- Fetch the `fullsize` URL from `cdn.bsky.app` [18]. Never fetch `com.atproto.sync.getBlob` from an arbitrary PDS host, which is an SSRF risk.
- Required change: `apps/image-worker/src/validators.ts:25-28` allows only Discord CDN hosts. Make the allowlist per caller and add `cdn.bsky.app`.
- **Correction to 07:** 07 cites `chara-attachment.ts:26-28`. The allowlist is now at `apps/discord-worker/src/utils/chara-attachment.ts:42-45`. It can stay unchanged, because Bluesky has no file attachments and so no `.chara` input.

**Abuse controls:**
- A per-DID rate limit (worker-kit rate limiter) and a global hourly cap.
- A KV blocklist.
- Ignore self, accounts labeled `bot`, and more than N bot replies per thread.
- Stay silent on unparseable spam rather than replying with errors.

## 7. Handle as domain

**DNS method** [17]:
- Add a TXT record at `_atproto.xivdyetools.app` (or `_atproto.bot.xivdyetools.app`) with the value `did=did:plc:…`.
- It needs no web route and does not interact with Pages or og-worker.

**HTTPS method** [17]:
- `/.well-known/atproto-did` must return 2xx, `text/plain` and the bare DID.
- The web app's SPA fallback `/* /index.html 200` (`apps/web-app/public/_redirects:3`) answers that path with HTML today, so the HTTPS method would be invalid.
- og-worker routes only `/harmony/*` … `/glamour/*` (`apps/og-worker/wrangler.toml:75-87`).
- **Use DNS.** Optionally add a static `public/.well-known/atproto-did` so HTTPS resolvers agree.

**Handle choice:**
- The root handle is the best brand. But if a human announcement account is ever wanted, give the bot `bot.xivdyetools.app`.

## 8. Link cards (Cardyb)

- The Bluesky app fetches metadata via `https://cardyb.bsky.app/v1/extract?url=` (social-app `src/lib/constants.ts:117`). It then re-encodes the thumb to at most 2000 px and 1,000,000 bytes (`IMAGE_SIZE_CONFIG_2K_1MB`, `constants.ts:109-112`; `src/lib/api/resolve.ts:295,306-316`) [20].
- The Cardyb user agent is `Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)` (third-party, snippet) [26]. No pattern in `apps/og-worker/src/crawler-detector.ts:19-52` matches it.
- **Add:**
  - `{ pattern: /Bluesky Cardyb/i, type: 'bluesky' }`.
  - `'bluesky'` in `CrawlerType` (`apps/og-worker/src/types.ts:174-183`). Analytics records the type at `apps/og-worker/src/index.ts:686,700`.
  - Tests in `crawler-detector.test.ts`.
- Check that Cloudflare bot protection does not challenge it [26].

## 9. Effort (1 week = 5 days)

**MVP:** dye info, match and harmony card replies, with en+ja reviewed and all six locales present for the gate.

| # | Task | Days |
|---|---|---|
| 0 | Spike: Worker → bsky.social login, poll, post, IP-limit check, CDN image fetch | 1 |
| 1 | Account: DNS handle, `bot` label, bio with © notice, contact email, app password | 0.5 |
| 2 | XRPC client, session store and refresh, 429 backoff | 1.5–2 |
| 3 | Cron poller, D1 dedupe, `updateSeen`, idempotent replies | 1.5–2 |
| 4 | Facet-aware parser, `langs` → locale | 1.5–2 |
| 5 | "Did you mean" matcher (bot-logic) | 1–1.5 |
| 6 | Reply composer: graphemes, byte-offset facets, alt text, aspectRatio, uploadBlob, reply refs, replyDisabled | 2 |
| 7 | Render path: new worker with resvg and fonts, or a shared render binding | 1.5–2.5 |
| 8 | Abuse controls | 1–1.5 |
| 9 | Bot strings ×6 through the locale-quality gate | 1–1.5 |
| 10 | og-worker Cardyb UA and tests | 0.5 |
| 11 | Policy docs and per-language review | 2–3 |
| 12 | Pipeline: wrangler (observability off, crons), deploy workflow, CI, docs and version tables | 1.5–2 |
| 13 | Tests | 2–3 |
| 14 | Beta soak | 1 |
| | **MVP total** | **19.5–26.5 (≈4–5.3 wk)** |

**Comparison with 07:** leaving out rows 11–12 gives 16–21.5 days (3.2–4.3 wk), which is consistent with 07's 3.5–5 weeks.

**Full version adds:**
- The remaining T1 commands (gradient, mixer, comparison, contrast, a11y, dye search/list/random, manual): +5–7 days.
- T2: image extraction via the CDN plus `executeBudget`: +4–6 days.
- T3: read-only presets: +2–3 days.
- DO alarm poller: +1–2 days.
- **Full total ≈31–44 days (6–9 weeks).**

## Sources
1. Repo: `docs/research/discord-alternatives/07-2026-10-refresh.md` (2026-10-04), §1, §3, §4, §6, §7.
2. atproto lexicon `app/bsky/embed/images.json` (main, fetched 2026-10-11). https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json
3. Lexicon `app/bsky/embed/external.json`. Same repo.
4. Lexicons `app/bsky/feed/post.json` and `app/bsky/richtext/facet.json`. Same repo.
5. Lexicon `app/bsky/embed/gallery.json`; atproto Discussion #5032 "New Post Embed: Gallery" (Jun 2026). https://github.com/bluesky-social/atproto/discussions/5032
6. Lexicons `app/bsky/notification/listNotifications.json` and `updateSeen.json`.
7. Lexicons `chat/bsky/actor/declaration.json`, `chat/bsky/convo/defs.json#messageInput` and `sendMessage.json`.
8. Lexicons `app/bsky/feed/threadgate.json` and `app/bsky/feed/defs.json#viewerState`.
9. Lexicons `com/atproto/repo/uploadBlob.json` and `com/atproto/server/createAppPassword.json`.
10. bsky-docs `docs/advanced-guides/rate-limits.md` (undated). https://github.com/bluesky-social/bsky-docs
11. bsky-docs `docs/starter-templates/bots.mdx`.
12. bsky-docs `docs/support/developer-guidelines.md`.
13. bsky-docs `docs/advanced-guides/posts.md`.
14. bsky-docs `oauth-client.md:55` and `entryway.md`; atproto `packages/api/README.md:42-51`.
15. bsky-docs `firehose.mdx`; jetstream-legacy README (`wantedDids` ≤10,000 at lines 56-57; instances); jetstream `docs/README.md` (v2 RFD). https://github.com/bluesky-social/jetstream-legacy
16. atproto-website `guides/bot-tutorial/en.mdx` and `_snippets/15-full-agent-code.mdx`. https://atproto.com/guides/bot-tutorial
17. atproto-website `specs/handle/en.mdx`. https://atproto.com/specs/handle
18. atproto-website `specs/blob/en.mdx` and `guides/images-and-video/en.mdx`.
19. atproto `packages/pds/src/account-manager/helpers/auth.ts`.
20. bluesky-social/social-app `src/lib/constants.ts`, `src/lib/link-meta/link-meta.ts` and `src/lib/api/resolve.ts`.
21. atproto issue #3388, "Using the Bluesky API from Cloudflare workers doesn't work due to IP rate limits." https://github.com/bluesky-social/atproto/issues/3388
22. atproto issue #3246, sendMessage 429s. https://github.com/bluesky-social/atproto/issues/3246
23. dev.to/rulestack (app password scopes); atproto.blue DM guide; zernio.com Bluesky DM API (secondary).
24. Bluesky blog, DMs launch, 2024-05-22. https://bsky.social/about/blog/05-22-2024-direct-messages
25. Bluesky, age-assurance approach (2025-09-10, updated). https://bsky.social/about/blog/09-10-2025-age-assurance-approach
26. Cardyb UA: chrisleverseo.com/user-agents/bluesky-cardyb, opengraphplus.com/consumers/bluesky/crawling and darkvisitors.com (secondary).
27. Bluesky Community Guidelines (updated 2025-09-19; snippet) and 2025 Transparency Report (2026-01-29). https://bsky.social/about/support/community-guidelines
28. Bluesky Directory newsletter, Issue 70 (snippet).
29. Square Enix Support Center, FFXIV Materials Usage License (NA rule 5382, EU rule 5383); Lodestone revision notice; Automaton West coverage (snippets).
30. Cloudflare Workers limits (cron triggers: 5 Free / 250 Paid; cron CPU 10 ms Free / 30 s Paid) and Cron Triggers docs (snippet).
31. jazco.dev, "Jetstream" (2024-09-24); post count from the Bluesky 2025 transparency report (snippet).
32. Local render: @resvg/resvg-js 2.6.2 on `packages/svg/src` at HEAD, 2026-10-11 (computed).
33. Repo paths cited inline.
34. tailscale/bsky-webhook; onyxhq.us blog (secondary).


## Numbers (structured)

| Subject | Platform | Metric | Value | As of | Confidence | Source |
|---|---|---|---|---|---|---|
| app.bsky.embed.images | bluesky | max image blob size | 2,000,000 bytes | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/images.json |
| app.bsky.embed.images | bluesky | max images per embed | 4 | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/images.json |
| app.bsky.embed.gallery | bluesky | max items (schema / client soft limit) | 20 / 10 | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/gallery.json |
| app.bsky.embed.gallery | bluesky | max image blob size | 2,000,000 bytes | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/gallery.json |
| app.bsky.embed.external thumb | bluesky | max thumb size | 1,000,000 bytes | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/external.json |
| app.bsky.feed.post text | bluesky | max text length | 300 graphemes / 3,000 bytes | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json |
| app.bsky.feed.post langs | bluesky | max langs entries | 3 | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json |
| listNotifications | bluesky | max limit per page | 100 (default 50) | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/notification/listNotifications.json |
| PDS content writes per account | bluesky | points per hour / per day | 5,000 / 35,000 (create = 3) |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| PDS content writes per account | bluesky | max creates per hour / per day | 1,666 / 11,666 |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| PDS API requests | bluesky | requests per IP per 5 min | 3,000 |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| com.atproto.server.createSession | bluesky | per account limit | 30 per 5 min; 300 per day |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| com.atproto.server.createSession (live report) | bluesky | observed daily policy | 10 per day (Aug 2026 report) | 2026-08 | unverified | https://github.com/bluesky-social/atproto/issues/3388 |
| com.atproto.identity.updateHandle | bluesky | per account limit | 10 per 5 min; 50 per day |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| PDS blob upload | bluesky | max blob upload size | 52,428,800 bytes |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| Relay limits for a new self-hosted PDS | bluesky | stream events | 50/s; 2,600/h; 21,000/day; 100 accounts |  | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md |
| Reference PDS tokens | bluesky | access / refresh token lifetime | 120 min / 90 days |  | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/packages/pds/src/account-manager/helpers/auth.ts |
| chat.bsky.convo messageInput | bluesky | max DM text | 1,000 graphemes / 10,000 bytes | 2026-10-11 | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/chat/bsky/convo/defs.json |
| Jetstream wantedDids | bluesky | max DIDs per subscription | 10,000 |  | primary | https://raw.githubusercontent.com/bluesky-social/jetstream-legacy/main/README.md |
| app.bsky.feed.threadgate | bluesky | max allow rules | 5 |  | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/threadgate.json |
| Bluesky app link-card thumb re-encode | bluesky | max dimension / bytes | 2000 px / 1,000,000 bytes |  | primary | https://raw.githubusercontent.com/bluesky-social/social-app/main/src/lib/constants.ts |
| Bluesky network posts (2025 average) | bluesky | posts per day | ~3.86M (1.41B in 2025) | 2025 | snippet | https://bsky.social/about/blog/01-29-2026-transparency-report-2025 |
| Dye info card, 2x PNG (local render) | bluesky | bytes / pixel size | 50,894 B / 800x700 | 2026-10-11 | computed | packages/svg/src/dye-info-card.ts |
| Harmony card, 2x PNG (local render) | bluesky | bytes / pixel size | 57,131 B / 800x556 | 2026-10-11 | computed | packages/svg/src/harmony-card.ts |
| Largest card vs image cap | bluesky | share of 2,000,000-byte cap | 2.9% (57,131 / 2,000,000) | 2026-10-11 | computed | packages/svg/src/frame.ts |
| Cloudflare Cron Triggers | other | per-account count (Free / Paid) | 5 / 250 |  | snippet | https://developers.cloudflare.com/workers/platform/limits |
| Cloudflare Cron Trigger CPU | other | CPU per run (Free / Paid, <1h interval) | 10 ms / 30 s |  | snippet | https://developers.cloudflare.com/workers/platform/limits |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C1 | app.bsky.embed.images allows at most 4 images. Each blob has maxSize 2,000,000 bytes, accepts image/*, and requires alt text. | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/images.json | fetched 2026-10-11 |
| C2 | A new app.bsky.embed.gallery holds up to 20 items (clients should use 10), each at most 2 MB, and requires aspectRatio. The post embed union includes it. | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/embed/gallery.json | fetched 2026-10-11 |
| C3 | Our cards render at 400 px wide (at most 350 tall) and every caller uses scale 2. Local 2x PNGs were 50,894 bytes (dye info) and 57,131 bytes (harmony), about 2.9% of the cap. | computed | packages/svg/src/frame.ts:28,31; apps/discord-worker/src/services/svg/renderer.ts:99 | 2026-10-11 |
| C4 | In listNotifications, the seenAt request parameter is deprecated and causes an error. Use cursor, reasons and limit (at most 100), then updateSeen. | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/notification/listNotifications.json | fetched 2026-10-11 |
| C5 | Jetstream's wantedDids filters by repo author, at most 10,000 DIDs, so it cannot select mentions. | primary | https://raw.githubusercontent.com/bluesky-social/jetstream-legacy/main/README.md |  |
| C6 | DM message input allows 1,000 graphemes, and its embed may only be a record or a joinLink, so DMs carry no images. allowIncoming is all, none or following. | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/chat/bsky/convo/defs.json | fetched 2026-10-11 |
| C7 | Writes are limited to 5,000 points/hour and 35,000/day; a create costs 3 points. The per-IP limit is 3,000 requests per 5 minutes. createSession is limited to 30 per 5 minutes and 300 per day. | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/rate-limits.md | undated |
| C8 | Cloudflare Workers share IP ranges, and createSession has been reported to hit IP rate limits from Workers. | secondary | https://github.com/bluesky-social/atproto/issues/3388 |  |
| C9 | OAuth is not currently recommended for headless clients such as bots, even though the SDK marks app passwords deprecated. | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/advanced-guides/oauth-client.md |  |
| C10 | Bots should self-label 'bot' and should interact only when the user has tagged them (opt-in). | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/starter-templates/bots.mdx |  |
| C11 | The developer guidelines require a method for deleting content on request, a report-response system, and a public, monitored contact email. | primary | https://raw.githubusercontent.com/bluesky-social/bsky-docs/main/docs/support/developer-guidelines.md |  |
| C12 | Neither og-worker crawler pattern list matches the Bluesky Cardyb user agent. The Bluesky app fetches link metadata from cardyb.bsky.app/v1/extract. | repo | apps/og-worker/src/crawler-detector.ts:19-52; https://raw.githubusercontent.com/bluesky-social/social-app/main/src/lib/constants.ts |  |
| C13 | The web app's SPA fallback '/* /index.html 200' answers /.well-known/atproto-did with HTML, so use a DNS TXT record at _atproto.<handle>. | repo | apps/web-app/public/_redirects:3; https://atproto.com/specs/handle |  |
| C14 | Image-worker's host allowlist accepts only Discord CDN hosts. The chara-attachment allowlist is now at lines 42-45, not 26-28 as 07 states. | repo | apps/image-worker/src/validators.ts:25-28; apps/discord-worker/src/utils/chara-attachment.ts:42-45 |  |
| C15 | The FFXIV Materials Usage License, revised and effective 2026-09-16, is non-commercial, bars soliciting donations, and asks for '© SQUARE ENIX' with every use. | snippet | https://support.eu.square-enix.com/rule.php?id=5383&la=2&tag=authc | 2026-09-16 |
| C16 | The reference PDS issues access tokens that last 120 minutes and refresh tokens that last 90 days. | primary | https://raw.githubusercontent.com/bluesky-social/atproto/main/packages/pds/src/account-manager/helpers/auth.ts |  |


## Conclusions

- Use a Cron Trigger that polls listNotifications every minute (median reply ~30 s, $0 extra). Upgrade to a Durable Object alarm polling every ~10 s only if latency matters. Jetstream cannot filter by mention, and Bluesky has no official webhook.
- Keep the 2x PNG cards. Real renders are 51–57 KB, about 2.9% of the 2 MB cap. The new gallery embed (up to 10 images, aspectRatio required) allows multi-card replies.
- DMs cannot carry images, need a privileged app password, are usually blocked by the recipient's default allowIncoming=following, and are gated by age checks. Do not use them as ephemeral replies.
- Use an app password, not OAuth: Bluesky's own OAuth guide says OAuth is not recommended for bots. Persist the session and refresh token, and never log in on every cron run.
- Prove first that Workers can call bsky.social without hitting per-IP limits (atproto #3388). That is the main go/no-go risk.
- Policy requirements: self-label the account bot; reply only when tagged; provide a deletion path ('@bot delete' plus email); keep a monitored contact email; put the © SQUARE ENIX notice in the bio and ToS; and put no donation links in bot output.
- og-worker needs a 'Bluesky Cardyb' pattern and a 'bluesky' CrawlerType. Use a DNS TXT record for the handle, because the SPA fallback answers /.well-known/atproto-did with HTML.
- MVP (dye info + match + harmony) is about 4–5.3 dev-weeks including policy and pipeline. The full bot is about 6–9 weeks. 07's 3.5–5 weeks matches the build alone.


## Open questions

- Is the Cloudflare account on Workers Paid? On Free, a cron gets 10 ms of CPU, which cannot render a card inline, and the account is limited to 5 cron triggers.
- Do bsky.social's per-IP limits still apply to Cloudflare egress IPs, given atproto #3388 and a report of createSession at 10 per day? This needs the day-1 spike.
- Does the bsky.social entryway issue sessions with the same 120-minute and 90-day lifetimes as the reference PDS?
- Does the CDN's JPEG transcode (@jpeg) visibly degrade text-heavy PNG cards in the Bluesky app?
- The full text of the FFXIV Materials Usage License (effective 2026-09-16) was seen only in snippets. Does 'with every use' require a © notice on every card? Do the existing Patreon and Ko-fi links conflict with its donation clause?
- Is the Cardyb user agent still 'Bluesky Cardyb/1.1'? This needs confirming in og-worker request logs or with a test share.
- The Bluesky Community Guidelines (2025-09-19) automation wording was not read in full, because bsky.social cannot be reached from this environment.
- Should the bot take the root handle xivdyetools.app, or bot.xivdyetools.app to leave the root for an announcement account?
- Should the bot's replies be deleted automatically when the source post is deleted (a weekly getPosts sweep), or only on request?
