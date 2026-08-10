# Preset Glamour Shots — Design

**Date:** 2026-08-10
**Status:** Approved (design); not implemented
**Supersedes:** the thumbnail paragraph in `docs/research/monorepo-2.0/8a-gallery-port-spec.md`

## The model

A preset gets **two independent optional fields**:

| Field | Purpose | Where it comes from |
|---|---|---|
| `example_link` | A link to the **page** carrying that glamour's information — gear list, author credit, comments | The submitter pastes a URL on an allowlisted host |
| **preview image** | The picture shown on the card | The submitter **uploads a file**; image-worker crops and encodes it; it lives in R2 |

The two are unrelated. A preset may have a link, an image, both, or neither.
**The link is never fetched.** It is a reference for a human to click, not a
source we derive anything from. That retires the scraping question by design
rather than by circumstance — see the appendix for why scraping was never going
to work anyway.

This corrects the 8A follow-up plan, which assumed the image would be derived
from the link:

> presets-api fetches the linked page's OG image on approval, caches to R2,
> serves `thumbnail_url`; cards use it when present.

## Link allowlist

The allowlist's job is no longer "hosts we can fetch from" — it is **where we
are willing to send our users**. An open URL field is a spam and phishing
vector, so the list stays curated.

| Host | Notes |
|---|---|
| `eorzeacollection.com` | incl. `ffxiv.` subdomain |
| `mirapri.com` | **new** — cannot be submitted today |
| `reddit.com`, `redd.it` | any post, host-level check |
| `x.com`, `twitter.com` | both, since legacy links are still everywhere |
| `bsky.app` | |
| `instagram.com` | |

Matching stays as it is today: exact host or any subdomain of it.

**Removed:** `imgur.com`, `flickr.com`. They are bare image hosts, and under the
clarified purpose a raw image is precisely what this field is *not* for.
Verified zero-impact — exactly one preset in production has an `example_link`
(`Valiant Purple`, an Eorzea Collection URL), so nothing is invalidated.

Reddit is host-level rather than scoped to `/r/FFXIVGlamours`: path-scoping
breaks crossposts, other FFXIV glamour subs and share-link formats, while
offering little protection, since anyone can post inside an allowed subreddit.

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
  (4 hours). Nothing may request an image URL before its object exists.
  Guaranteed by serialising `preview_image_url` only once status is `approved`,
  and by the random UUID in every key — a replacement is a new URL no negative
  cache has seen.
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

Migration `0009_add_preview_image.sql` (additive; existing rows keep working):

```sql
ALTER TABLE presets ADD COLUMN preview_image_key TEXT;
ALTER TABLE presets ADD COLUMN preview_image_status TEXT NOT NULL DEFAULT 'none';
```

- `preview_image_status`: `none | pending | approved`
- **`preview_image_url` is serialised only when status is `approved`.** This
  single condition is the moderation gate; it lives in one place.

No `source` column: the image has exactly one origin — an author upload — and
the link is never a source. No `failed` state either: upload processing is
synchronous, so a failure returns 4xx and stores nothing, leaving status `none`.

New route: `POST /api/v1/presets/:id/preview-image` — author-only, raw image
body.

Also update `EXAMPLE_LINK_HOSTS` in `validation-service.ts` to the list above,
mirrored client-side.

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

Attach the pending image to the Discord embed it already posts, so a moderator
reviews image and preset in one action. Approve/reject sets
`preview_image_status`.

### 5. `web-app`

- Submit form gains an optional **preview image** picker (upload or paste),
  separate from the existing example-link field.
- `preset-card` chooses its shot area in this order:
  1. approved preview image → `<img>`
  2. no image but a link → today's striped placeholder + link caption
  3. neither → the existing palette-as-picture treatment
- `public/_headers`: add `https://shots.xivdyetools.app` to `img-src`.

## Data flow

```
client POST /presets/:id/preview-image  (author-only, raw image body)
  -> validate size / declared type / magic bytes
  -> IMAGE_WORKER crop + encode  (service binding)
  -> R2 put  (immutable Cache-Control, key {presetId}/{uuid}.webp)
  -> preview_image_status = 'pending'
  -> notify the Discord moderation queue
```

Moderator approves → status `approved` → `preview_image_url` starts being
serialised → cards show the image. Rejection deletes the object and returns
status to `none`; the preset and its link are untouched.

No external fetches anywhere. There is no OG parser, no SSRF surface, no
third-party timeout, and no partially-populated state to reconcile.

## Moderation

Every preview image is gated. Anyone can upload anything, so there is no
category of upload that is safe by construction.

**The queue is the normal path, and that is the accepted cost.** If it proves
painful, the intended escape hatch is author reputation — auto-publish uploads
from users with N prior approved presets. Out of scope for v1.

## Limits, validation, security

**Uploads:** ≤ 5 MB; `image/png|jpeg|webp`. The declared content-type is a hint,
never the decision — sniff magic bytes, because a PNG header on a 300 MB archive
is the oldest trick there is. Photon rejects what it cannot decode, a second
gate for free. One image per preset; re-upload replaces.

**Authorisation:** author-only — 401 unauthenticated, 403 non-author. Covered by
an explicit test.

**Rate limiting:** uploads ride the existing `/api/*` public rate limit
(100/min/IP). No separate quota; one image per preset already bounds it.

## Lifecycle

| Event | Effect |
|---|---|
| Preset deleted | R2 object deleted |
| Moderator rejects image | object deleted, status `none`; preset unaffected |
| Re-upload | new UUID key; old object deleted |
| `example_link` changed | **no effect** — the fields are independent |

**Cost:** a 640×264 WebP is ~30–60 KB against R2's 10 GB free tier. Not a factor
at any plausible scale for this app.

## Testing

The highest-value test is the gate: **`preview_image_url` must be absent unless
status is `approved`** — explicitly covered for `pending` and `none`. It is the
only thing standing between an unreviewed image and every gallery visitor.

- **image-worker** — crop selection (landscape → middle, portrait/square →
  upper), output dimensions, real decode/encode smoke test.
- **presets-api** — R2 mock from `@xivdyetools/test-utils` (already exists);
  upload auth (non-author → 403); magic-byte rejection; oversize rejection;
  the gate tests above; the revised host allowlist (each new host accepted,
  `imgur.com` now rejected).
- **web-app** — card picks image → placeholder+link → palette in that order.
  Extends the existing card tests rather than replacing them.

No E2E: it needs live R2. Not worth the flake.

## Rollout

Ordered; each step depends on the last.

1. ~~Create R2 bucket + bind `shots.xivdyetools.app`~~ — **done 2026-08-10**,
   verified by round-tripping a test object.
2. **Migration `0009` on production D1 — user-run, by hand.**
   ```bash
   cd apps/presets-api
   npx wrangler d1 execute xivdyetools-presets --remote --file=./migrations/0009_add_preview_image.sql
   ```
   `pnpm db:migrate` CANNOT do this — `schema.sql` is all
   `CREATE TABLE IF NOT EXISTS`, so it skips the existing table and exits 0
   having changed nothing.

   Verify with a **single-row aggregate**, never a column list — a truncated
   list read as complete is exactly how two columns were wrongly reported
   missing during the 2026-08-10 investigation:
   ```bash
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT SUM(name='preview_image_key') AS k, \
             SUM(name='preview_image_status') AS s, COUNT(*) AS total \
      FROM pragma_table_info('presets');"
   ```
   Expect `0,0` before and `1,1` after. The migration must land **before** the
   new presets-api deploy, or the first write to `preview_image_status` fails as
   an opaque 500.
3. Deploy `image-worker`, then `presets-api`, then `moderation-worker`.
4. Deploy `web-app` **last** — it carries the CSP change, which would otherwise
   allow a host serving nothing.

Note the per-worker deploy asymmetry (`docs/operations/DEPLOY_ENVIRONMENTS.md`):
`presets-api` and `image-worker` need explicit `--env production`; `oauth` does
not and has no `production` env at all. Check each `wrangler.toml`.

## Explicitly out of scope

- **Deriving the image from the link.** Not a fetching problem — the two fields
  simply mean different things. The appendix records that it was also
  technically impossible, so nobody re-proposes it.
- Author-reputation auto-publish (revisit if the moderation queue hurts).
- Background image refresh.
- A bulk web moderation view.

## Appendix — why link-derived images were never viable

Measured 2026-08-10, before the model was clarified. Retained so the idea is not
revisited on the assumption it would work.

| Host | Page fetch | `og:image` fetch |
|---|---|---|
| `eorzeacollection.com` | **403** on every path, incl. `/api`, `/oembed` | — |
| `mirapri.com` | 200, `og:image` present | **403** — image is on `assets.mirapri.com` |

**Eorzea Collection** sits behind Cloudflare bot protection. Discord renders a
preview because `Discordbot` is a Cloudflare *verified bot*; our Worker is not.
Their robots.txt frames access as *"a condition of accessing this website"* and
lists `CloudflareBrowserRenderingCrawler` under `Disallow` — the headless route
is closed deliberately.

**Mirapri** serves the page but hotlink-protects its asset CDN: 403 with no
Referer, 200 with a Referer claiming we render their page. That Referer check is
exactly the control stopping third parties fetching their images, and the
`_watermark.webp` filenames say the same about intent.

Both sites' robots.txt are otherwise permissive (`User-agent: *` / `Allow: /`,
`Content-Signal: search=yes,ai-train=no,use=reference`). We are not unwelcome in
policy; we were blocked in practice.
