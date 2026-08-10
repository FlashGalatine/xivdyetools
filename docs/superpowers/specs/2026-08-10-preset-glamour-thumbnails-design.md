# Preset Glamour Thumbnails — Design

**Date:** 2026-08-10
**Status:** Approved (design); not implemented
**Supersedes:** the thumbnail paragraph in `docs/research/monorepo-2.0/8a-gallery-port-spec.md`

## Problem

8A shipped `example_link`: a submitter pastes a glamour page URL and the card
shows a striped placeholder captioned `GLAMOUR SHOT · LINKED, NOT UPLOADED`.
That was always meant to be temporary. The 8A spec's follow-up plan reads:

> presets-api fetches the linked page's OG image on approval, caches to R2,
> serves `thumbnail_url`; cards use it when present. Never hotlink the target
> site from the browser.

**Research killed that mechanism.** Every host we would want to scrape blocks
server-side image fetching. The feature is therefore built on author uploads.

## Research findings (measured 2026-08-10)

| Host | Page fetch | `og:image` fetch | Scrapeable? |
|---|---|---|---|
| `eorzeacollection.com` | **403** (all paths, incl. `/api`, `/oembed`) | — | No |
| `mirapri.com` | 200, `og:image` present | **403** — image is on `assets.mirapri.com`, hotlink-protected | No |
| `imgur.com` / `flickr.com` | 200 | likely | Yes, but see below |

### Eorzea Collection

Behind Cloudflare bot protection; returns `403 "Just a moment..."` to a
self-identifying client on every path. Discord renders a preview because
`Discordbot` is on Cloudflare's *verified bots* list; our Worker is not.

Evasion is ruled out on their terms, not ours:

- robots.txt frames access as *"a condition of accessing this website"*.
- It lists `CloudflareBrowserRenderingCrawler` under `Disallow` — the
  headless-browser route is closed deliberately, not by oversight.

### Mirapri

The page is readable, but its `og:image` points at `assets.mirapri.com`, which
is hotlink-protected:

```
GET image, no Referer                        -> 403 "Attention Required! | Cloudflare"
GET image, Referer: https://mirapri.com/...  -> 200
```

The only way through is a Referer claiming we are rendering their page — which
is exactly the access control they configured to stop third parties fetching
their images. The `_watermark.webp` suffix on their filenames says the same
about intent. Not pursued.

### Why this removes the scrape path entirely

Both *trusted* hosts are unscrapeable, so the auto-publish tier has no working
source. Scraping would only ever produce images for Imgur and Flickr — the two
hosts nobody uses for FFXIV glamour shots — and those are moderator-gated
anyway. It would buy an OG parser, an SSRF surface, external fetch timeouts and
a `failed` state to serve approximately nobody.

Both sites' robots.txt are otherwise permissive (`User-agent: *` / `Allow: /`,
`Content-Signal: search=yes,ai-train=no,use=reference`). We are not unwelcome in
policy; we are blocked in practice. That makes *asking* a reasonable v2 route
rather than a long shot.

## Decisions

| Decision | Choice |
|---|---|
| Image source | **Author upload only** |
| Moderation | Every thumbnail is moderator-gated |
| Serving | R2 bucket on `shots.xivdyetools.app` |
| Review surface | The existing Discord moderation queue |
| Crop | Landscape → middle band; square/portrait → upper band |

Uploads were always going to be gated — anyone can paste an Eorzea Collection
link and upload an unrelated image — so dropping scraping loses no safety
property. It collapses the trust tiers into a single gate.

**Moderation load is the accepted cost.** Every thumbnail needs a human. If that
proves painful, the intended escape hatch is author reputation (auto-publish
uploads from users with N prior approved presets). Out of scope for v1.

## Architecture

Four components; three already exist.

### 1. R2 bucket (exists)

- Bucket: `xivdyetools-presets-preview-thumbnails`
- Public read via custom domain `shots.xivdyetools.app`
- Bound to presets-api as `THUMBNAILS`
- Key layout: `{presetId}/{uuid}.webp`

Verified end-to-end on 2026-08-10 by writing a test object, fetching it over the
custom domain (200, correct content-type), and deleting it.

Two measured behaviours drive design details:

- **A miss is negatively cached**: `404` returns `Cache-Control: max-age=14400`
  (4 hours). Nothing may request a thumbnail URL before its object exists.
  Guaranteed by serialising `thumbnail_url` only once status is `approved`, and
  by the random UUID in every key — a replacement is a new URL no negative cache
  has seen.
- **A hit carries no `Cache-Control`**: R2 does not invent one. We set
  `public, max-age=31536000, immutable` at upload via `httpMetadata`. Safe here
  precisely because keys are immutable by construction — the same header that
  caused the beta asset incident when it landed on a mutable SPA fallback.

### 2. `image-worker` — new `POST /thumbnail`

Reuses the existing Photon helpers (`loadImage`, `resizeImage`,
`getImageDimensions`); adds crop and WebP encode. Stays service-binding-only.

```
input:  image bytes
crop:   aspect = width / height
        aspect >  1.05 (landscape)       -> middle band
        aspect <= 1.05 (square/portrait) -> upper band
output: 640 x 264 WebP  (2x the card's 320x132 slot, ~2.4:1)
```

The threshold is 1.05, not something higher: "landscape" means wider than tall,
so 4:3 (1.33) and 3:2 (1.50) are landscape and take the middle band. The 0.05
tolerance only stops a nominally-square image (1.00–1.05) being treated as
landscape by a rounding error; square and portrait both take the upper band, so
the rule collapses to a single comparison.

The card's shot area is `height: 132px` at up to 320px wide, so the target is a
wide banner, not a square. The decode→crop→encode round trip drops EXIF, so GPS
data in an author's screenshot never reaches R2.

### 3. `presets-api` — owns the upload and the gate

Migration `0009_add_thumbnail.sql` (additive; existing rows keep working):

```sql
ALTER TABLE presets ADD COLUMN thumbnail_key TEXT;
ALTER TABLE presets ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE presets ADD COLUMN thumbnail_source TEXT;
```

- `thumbnail_status`: `none | pending | approved`
- `thumbnail_source`: always `'upload'` in v1. Kept because adding a column
  later costs a hand-run production migration — the riskiest step in this
  rollout — while a nullable TEXT column costs nothing now and makes a future
  scrape path additive.
- **`thumbnail_url` is serialised only when `thumbnail_status = 'approved'`.**
  This single condition is the moderation gate; it lives in one place.

There is no `failed` state: upload processing is synchronous, so a failure
returns 4xx to the client and stores nothing, leaving status at `none`.

New route: `POST /api/v1/presets/:id/thumbnail` — author-only, raw image body.

**New bindings required in `apps/presets-api/wrangler.toml`** (both the
top-level `-dev` block and `[env.production]`, since neither is inherited):

```toml
[[r2_buckets]]
binding = "THUMBNAILS"
bucket_name = "xivdyetools-presets-preview-thumbnails"

[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"
```

presets-api currently binds only `DB` and `DISCORD_WORKER`; it has no route to
image-worker today. Only discord-worker binds `IMAGE_WORKER`, so this is a new
consumer of a Worker that is service-binding-only by design.

### 4. `moderation-worker`

Attach the pending thumbnail URL to the Discord embed it already posts, so a
moderator reviews image and preset in one action. Approve/reject sets
`thumbnail_status`.

### 5. `web-app`

- Submit form gains an optional image picker (upload or paste).
- `preset-card` renders `<img src=thumbnail_url>` when present; the existing
  striped placeholder remains the fallback, unchanged.
- `public/_headers`: add `https://shots.xivdyetools.app` to `img-src`.

### Independent of all the above

Add `mirapri.com` to `EXAMPLE_LINK_HOSTS` in `validation-service.ts`, mirrored
client-side. Mirapri links cannot be submitted at all today. This is worth
shipping whether or not the rest lands, and it is unaffected by the fact that
we cannot scrape the host.

## Data flow

```
client POST /presets/:id/thumbnail  (author-only, raw image body)
  -> validate size / declared type / magic bytes
  -> IMAGE_WORKER crop + encode  (service binding)
  -> R2 put  (immutable Cache-Control, key {presetId}/{uuid}.webp)
  -> thumbnail_status = 'pending', thumbnail_source = 'upload'
  -> notify the Discord moderation queue
```

Moderator approves → `thumbnail_status = 'approved'` → `thumbnail_url` starts
being serialised → cards show the image. Rejection deletes the object and
returns status to `none`; the preset itself is untouched.

No external fetches anywhere in this flow. That is the point of cutting the
scrape path: there is no OG parser, no SSRF surface, no third-party timeout, and
no partially-populated state to reconcile.

## Limits, validation, security

**Uploads:** ≤ 5 MB; `image/png|jpeg|webp`. The declared content-type is a hint,
never the decision — sniff magic bytes, because a PNG header on a 300 MB archive
is the oldest trick there is. Photon rejects what it cannot decode, a second
gate for free. One thumbnail per preset; re-upload replaces.

**Authorisation:** author-only — 401 unauthenticated, 403 non-author. Covered by
an explicit test.

**Rate limiting:** uploads ride the existing `/api/*` public rate limit
(100/min/IP). No separate quota; one thumbnail per preset already bounds it.

## Lifecycle

| Event | Effect |
|---|---|
| Preset deleted | R2 object deleted |
| Moderator rejects image | object deleted, status `none`; preset unaffected |
| Re-upload | new UUID key; old object deleted |

`example_link` changes no longer invalidate anything — the thumbnail is the
author's own upload, not a copy of whatever that link points at.

**Cost:** a 640×264 WebP is ~30–60 KB against R2's 10 GB free tier. Not a factor
at any plausible scale for this app.

## Testing

The highest-value test is the gate: **`thumbnail_url` must be absent unless
`thumbnail_status = 'approved'`** — explicitly covered for `pending` and `none`.
It is the only thing standing between an unreviewed image and every gallery
visitor.

- **image-worker** — crop selection (landscape → middle, portrait/square →
  upper), output dimensions, real decode/encode smoke test.
- **presets-api** — R2 mock from `@xivdyetools/test-utils` (already exists);
  upload auth (non-author → 403); magic-byte rejection; oversize rejection; the
  gate tests above.
- **web-app** — card renders `<img>` when `thumbnail_url` is present, striped
  placeholder when absent (extends the existing card tests).

No E2E: it needs live R2. Not worth the flake.

## Rollout

Ordered; each step depends on the last.

1. ~~Create R2 bucket + bind `shots.xivdyetools.app`~~ — **done 2026-08-10**,
   verified by round-tripping a test object.
2. **Migration `0009` on production D1 — user-run, by hand.**
   ```bash
   cd apps/presets-api
   npx wrangler d1 execute xivdyetools-presets --remote --file=./migrations/0009_add_thumbnail.sql
   ```
   `pnpm db:migrate` CANNOT do this — `schema.sql` is all
   `CREATE TABLE IF NOT EXISTS`, so it skips the existing table and exits 0
   having changed nothing.

   Verify with a **single-row aggregate**, never a column list — a truncated
   list read as complete is exactly how two columns were wrongly reported
   missing during the 2026-08-10 investigation:
   ```bash
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT SUM(name='thumbnail_key') AS k, SUM(name='thumbnail_status') AS s, \
             SUM(name='thumbnail_source') AS src, COUNT(*) AS total \
      FROM pragma_table_info('presets');"
   ```
   Expect `0,0,0` before and `1,1,1` after. The migration must land **before**
   the new presets-api deploy, or the first write to `thumbnail_status` fails as
   an opaque 500.
3. Deploy `image-worker`, then `presets-api`, then `moderation-worker`.
4. Deploy `web-app` **last** — it carries the CSP change, which would otherwise
   allow a host serving nothing.

Note the per-worker deploy asymmetry (`docs/operations/DEPLOY_ENVIRONMENTS.md`):
`presets-api` and `image-worker` need explicit `--env production`; `oauth` does
not and has no `production` env at all. Check each `wrangler.toml`.

## Explicitly out of scope

- **Auto-scraping OG images.** Removed on evidence, not preference — see the
  research findings. Revisit only if a host grants access.
- Approaching Eorzea Collection / Mirapri for an allowlist or API. Worth doing;
  must not block this work.
- Author-reputation auto-publish (revisit if the moderation queue hurts).
- Background thumbnail refresh.
- A bulk web moderation view.
