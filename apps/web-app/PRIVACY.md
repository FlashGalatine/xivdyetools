# XIV Dye Tools — Privacy Guide (web app)

> Also available in: [日本語](PRIVACY.ja.md) · [Deutsch](PRIVACY.de.md) · [Français](PRIVACY.fr.md) · [한국어](PRIVACY.ko.md) · [中文](PRIVACY.zh.md). This English version is the authoritative text.

**Last updated:** 2026-09-16 · Covers **xivdyetools.app** and **beta.xivdyetools.app**. The Discord
bot has its own policy: [`apps/discord-worker/PRIVACY_POLICY.md`](../discord-worker/PRIVACY_POLICY.md).

XIV Dye Tools runs in your browser. The colour tools — the Palette Extractor, Harmony Explorer,
Comparison, Gradient, Mixer, Accessibility checker, Budget finder and Swatch Matcher — do their work
on your device. Nothing you upload, pick or type is sent anywhere unless a section below says so,
and the sections below are the complete list.

## Images and camera captures

- Uploaded, pasted, dragged-in and camera-captured images never leave your device, and are never
  written to browser storage. They are read with the browser's Canvas API, held in the page's memory
  for that session only, and discarded when you clear the image, close the tab or reload.
- The Palette Extractor says the same thing where you pick a file — "Images are read in your
  browser and never uploaded", beside a padlock. That notice is plain text, not a link; this
  document is reached from **About → Privacy**.

## Character files (`.chara`)

- A `.chara` file (Anamnesis, Ktisis, Brio) is parsed on your device. Its character name is never
  sent anywhere, and never used as a preset name, an author name, or anything else other people
  can see. Submitting a glamour to the community presets requires you to type a name yourself —
  the field starts empty on purpose, because the character name and the file name are both places
  players put their real name.
- **One exception, and it stays on your device.** If you save a glamour or its palette to this
  browser without typing a name, the saved record falls back to the character's nickname, then to
  the `.chara` file name. That name lives in your browser's storage next to your other saved
  collections. It is never uploaded, and the community path above never reads it. Rename or delete
  the record, or clear your site data, and it is gone.
- To name the gear on the glamour block, the app asks our API for the item behind each slot. The
  request carries only the equipment **model numbers** from the file (a dozen small integers per
  file) — not the file, not the name, not the colours — and the item icons come back from the same
  host (`data.xivdyetools.app`).

## What is stored on your device

`localStorage` holds lightweight preferences and your own saved work: theme, language, per-tool
settings (including the analytics switch below), favourite dyes, saved palettes and collections,
and — if you sign in — your community-presets session token. Nothing here is a tracking identifier.
"Reset settings" in Advanced Options and your browser's site-data controls clear it.

`IndexedDB` holds one thing: a cache of market-board prices already fetched, so the same lookup is
not repeated. It holds no images — an earlier version of the app kept your last extractor image
there, and that copy is deleted the first time you open the app after this update. Your browser's
site-data controls clear it.

## Network access

The app talks only to these first-party hosts (the site's Content-Security-Policy allows nothing
else) plus the third parties named below:

1. **Market-board prices** (optional — the "Show Prices" toggle): item ids and the world or data
   centre you chose go to our proxy at `data.xivdyetools.app`, which fetches from
   [Universalis](https://universalis.app).
2. **Gear names and icons for `.chara` imports** — `data.xivdyetools.app` (see above).
3. **Community presets** (`api.xivdyetools.app`): browsing sends nothing about you. Signing in
   through `auth.xivdyetools.app` with Discord or XIVAuth creates an account record — your
   provider ID and username — right away, whether or not you go on to submit or vote. Presets and
   votes you submit are stored under that account, and the author name is shown on published
   presets. When you submit or edit a preset, its name and description may also be sent to
   Google's [Perspective API](https://perspectiveapi.com/) for a moderation score (optional —
   content moderation only); the request tells Google not to store them (`doNotStore`), and
   nothing else — no account identity — is sent there. To have your account record and
   submissions removed, see the Questions? section below. Preset preview images are served from
   `shots.xivdyetools.app`; avatars load from Discord's CDN.
4. **Share links**: a share link encodes the dyes or colours you chose in its URL. Opening one loads
   that URL like any page; link previews on Discord and elsewhere are rendered by our own
   `og-worker`, which sees only the URL.
5. **Usage analytics** (opt-in — see the next section): `data.xivdyetools.app`.

Fonts are self-hosted. There are no third-party analytics scripts, ad or social trackers, and no
cookies.

### Links that take you to other sites

Separately from the list above, some buttons **navigate** you to a community database rather than
fetching anything in the background. The Swatch Matcher's "Open in…" menu on a glamour piece opens
[Mirapri](https://mirapri.com/), [Garland Tools](https://www.garlandtools.org/),
[Teamcraft](https://ffxivteamcraft.com/), [Gamer Escape](https://ffxiv.gamerescape.com/) or the
Lodestone; a dye result card can open Universalis, Garland Tools, Teamcraft or
[Saddlebag Exchange](https://saddlebagexchange.com/).

What travels in those links is the game's own item — its numeric item id, or the item's name in the
language that site uses. Nothing about you, your palette, your character or your session is in the
URL. They open in a new tab with the referrer suppressed, so the site you land on is not told which
page you came from. Once you are there you are on someone else's site, under their privacy policy.

## Usage analytics (opt-in)

Analytics are **off by default**. They run only while **Advanced Options → Enable Analytics** is
switched on, and never if your browser sends the
[Global Privacy Control](https://globalprivacycontrol.org/) signal — even with the switch on. The
server enforces this too: it accepts telemetry only from the app's own origins, and discards any
batch that carries your browser's `Sec-GPC` signal before writing it. Turning the switch off stops
sending immediately, in every open tab, and discards anything not yet sent.

When enabled, the app sends small batches of these events to our API (`data.xivdyetools.app`),
which stores them in Cloudflare Analytics Engine:

- **Tool views** — which tool was opened, whether it was the tool the page loaded into, a share
  link, or a deliberate switch, and how many seconds the tab was visible on it.
- **Dye picks** — the numeric id of a dye you explicitly picked from the palette drawer or a dye
  grid, and which tool you were in. Random-dye buttons and picks the tool did not accept are not
  counted; your palette as a whole is never sent.
- **Character-file imports** — whether a `.chara` file parsed, and which program family produced it
  (Anamnesis, Ktisis, Brio, other). Never the file or the character.
- **Theme switches** — the theme you deliberately switched to.

Each batch also carries five coarse dimensions: app version, environment (production or beta), UI
language, current theme, and a viewport bucket (phone / tablet / desktop).

What is **never stored with your events**: your IP address, user agent or device details, any
account, session or client identifier, cookies, page URLs, colours or images you work with, search
text, preset text, character or world names, or anything that would let two visits be linked. The
server discards everything about the request except the validated events, and the event list is an
allowlist — anything else is dropped. (Your IP reaches our server the way it reaches every website
you visit; what happens to it is the next section.)

Analytics Engine keeps the data for about three months. The code is open source:
[`apps/web-app/src/services/telemetry-service.ts`](src/services/telemetry-service.ts) (what the
browser sends) and
[`apps/api-worker/src/telemetry/schema.ts`](../api-worker/src/telemetry/schema.ts) (what the server
accepts).

## Your IP address, and what the servers log

Every website you visit receives your IP address — it is how the reply finds you. Ours is handled
by Cloudflare, and here is the whole of what we do with it.

- **Abuse prevention.** Our API counts requests per IP over a 60-second window so one source cannot
  flood the service. The counting is done by Cloudflare's own rate-limiting service, which we hand
  the address to without storing it ourselves. There is a fallback path, used only on a deployment
  where that service is not wired up, which instead keeps a counter in Cloudflare KV under a key
  containing the address, for **120 seconds**. Neither path writes your address to a database, and
  neither is connected to your analytics events.
- **Your IP is never stored alongside anything you did** — not your events, not your presets, not
  your votes. It is not used to link visits, build a profile, or identify you.
- **Operational logs.** Our workers can print short diagnostic lines while handling a request.
  Persistent log collection (Cloudflare Workers Logs) is switched **off** on every one of our
  workers, so these lines are visible only to a maintainer watching a live stream while debugging,
  and are not retained afterwards. If we ever turn persistent logging on, we will say so here
  first. The Discord bot's logs are covered by
  [its own policy](../discord-worker/PRIVACY_POLICY.md).

## How to verify

1. Open DevTools → Network, enable "Preserve log".
2. Use any tool with an image or a `.chara` file.
3. You will see no image upload — only the requests listed above, and `/v1/telemetry` beacons only
   if you switched analytics on.

## Questions?

Open an issue on [GitHub](https://github.com/FlashGalatine/xivdyetools/issues) or ask on Discord.
We are happy to document further guarantees if it helps the community feel safe using the tools.
