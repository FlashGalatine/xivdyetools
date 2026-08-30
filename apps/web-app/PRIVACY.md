# XIV Dye Tools — Privacy Guide (web app)

**Last updated:** 2026-08-29 · Covers **xivdyetools.app** and **beta.xivdyetools.app**. The Discord
bot has its own policy: [`apps/discord-worker/PRIVACY_POLICY.md`](../discord-worker/PRIVACY_POLICY.md).

XIV Dye Tools runs in your browser. The colour tools — the Colour Extractor, Harmony Explorer,
Comparison, Gradient, Mixer, Accessibility checker, Budget finder and Swatch Matcher — do their work
on your device. Nothing you upload, pick or type is sent anywhere unless a section below says so,
and the sections below are the complete list.

## Images and camera captures

- Uploaded, pasted, dragged-in and camera-captured images never leave your device. They are read
  with the browser's Canvas API and discarded when you clear the image, close the tab or reload.
- The extractor's "Privacy Protected" notice links here.

## Character files (`.chara`)

- A `.chara` file (Anamnesis, Ktisis, Brio) is parsed on your device. Its character name is never
  used as a title, a default palette name or anything community-visible, and is never sent.
- To name the gear on the glamour block, the app asks our API for the item behind each slot. The
  request carries only the equipment **model numbers** from the file (a dozen small integers per
  file) — not the file, not the name, not the colours — and the item icons come back from the same
  host (`data.xivdyetools.app`).

## What is stored on your device

`localStorage` holds lightweight preferences and your own saved work: theme, language, per-tool
settings (including the analytics switch below), favourite dyes, saved palettes and collections,
and — if you sign in — your community-presets session token. Nothing here is a tracking identifier.
"Reset settings" in Advanced Options and your browser's site-data controls clear it.

## Network access

The app talks only to these first-party hosts (the site's Content-Security-Policy allows nothing
else) plus the one third party named below:

1. **Market-board prices** (optional — the "Show Prices" toggle): item ids and the world or data
   centre you chose go to our proxy at `data.xivdyetools.app`, which fetches from
   [Universalis](https://universalis.app).
2. **Gear names and icons for `.chara` imports** — `data.xivdyetools.app` (see above).
3. **Community presets** (`api.xivdyetools.app`): browsing sends nothing about you. Submitting or
   voting requires signing in through `auth.xivdyetools.app` with Discord or XIVAuth; the account
   identity you sign in with is stored with the presets and votes you submit, and the author name
   is shown on published presets. Preset preview images are served from `shots.xivdyetools.app`;
   avatars load from Discord's CDN.
4. **Share links**: a share link encodes the dyes or colours you chose in its URL. Opening one loads
   that URL like any page; link previews on Discord and elsewhere are rendered by our own
   `og-worker`, which sees only the URL.
5. **Usage analytics** (opt-in — see the next section): `data.xivdyetools.app`.

Fonts are self-hosted. There are no third-party analytics scripts, ad or social trackers, and no
cookies.

## Usage analytics (opt-in)

Analytics are **off by default**. They run only while **Advanced Options → Enable Analytics** is
switched on, and never if your browser sends the
[Global Privacy Control](https://globalprivacycontrol.org/) signal — even with the switch on.
Turning the switch off stops sending immediately, in every open tab, and discards anything not yet
sent.

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

What is **never** collected: your IP address, user agent or device details, any account, session
or client identifier, cookies, page URLs, colours or images you work with, search text, preset text,
character or world names, or anything that would let two visits be linked. The server discards
everything about the request except the validated events, and the event list is an allowlist —
anything else is dropped.

Analytics Engine keeps the data for about three months. The code is open source:
[`apps/web-app/src/services/telemetry-service.ts`](src/services/telemetry-service.ts) (what the
browser sends) and
[`apps/api-worker/src/telemetry/schema.ts`](../api-worker/src/telemetry/schema.ts) (what the server
accepts).

## How to verify

1. Open DevTools → Network, enable "Preserve log".
2. Use any tool with an image or a `.chara` file.
3. You will see no image upload — only the requests listed above, and `/v1/telemetry` beacons only
   if you switched analytics on.

## Questions?

Open an issue on [GitHub](https://github.com/FlashGalatine/xivdyetools/issues) or ask on Discord.
We are happy to document further guarantees if it helps the community feel safe using the tools.
