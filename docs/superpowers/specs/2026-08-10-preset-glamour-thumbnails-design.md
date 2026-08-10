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

**That mechanism does not work for the host our users actually use.**

## Research findings (measured 2026-08-10)

| Host | Server-side fetch | `og:image` |
|---|---|---|
| `eorzeacollection.com` (all paths, incl. `/`, `/api`, `/oembed`) | **403** | unreachable |
| `mirapri.com` | 200 | present |

Eorzea Collection sits behind Cloudflare bot protection and returns
`403 "Just a moment..."` to a self-identifying client on every path. Discord
renders a preview because `Discordbot` is on Cloudflare's *verified bots* list;
a Worker of ours is not.

Evasion is ruled out, on their terms rather than ours:

- Their robots.txt frames access as *"a condition of accessing this website"*.
- It explicitly lists `CloudflareBrowserRenderingCrawler` under `Disallow`, so
  the headless-browser route is closed by policy as well as by preference.

Both sites' robots.txt are otherwise permissive — `User-agent: *` / `Allow: /`
with `Content-Signal: search=yes,ai-train=no,use=reference`. We are not
unwelcome in policy; we are blocked in practice by the WAF. That distinction
matters: asking Eorzea Collection for an allowlist entry is a reasonable future
approach, not a long shot. It is out of scope here because it blocks the
feature on a third party's reply.

**Consequence:** scraping alone cannot deliver this feature. The design is a
hybrid — author upload works everywhere, scraping fills in the hosts that
permit it.

## Decisions

| Decision | Choice |
|---|---|
| Image sources | Hybrid: author upload (all hosts) + auto-scrape (hosts that permit it) |
| Trusted hosts (auto-publish) | `eorzeacollection.com`, `mirapri.com` |
| Gated (moderator review) | `imgur.com`, `flickr.com`, and **every** author upload |
| Serving | R2 bucket on `shots.xivdyetools.app` |
| Review surface | The existing Discord moderation queue |
| Crop | Landscape → middle band; square/portrait → upper band |

### The Eorzea Collection squeeze — accepted, not overlooked

Trust tiers describe the source host of a *scraped* image. An author upload has
no source host: anyone can paste an Eorzea Collection link and upload an
unrelated image. Uploads are therefore always gated. Combined with EC being
unscrapeable:

| Link host | Route to an image | Gate |
|---|---|---|
| Mirapri | auto-scrape | auto-publish |
| Imgur / Flickr | auto-scrape | moderator |
| **Eorzea Collection** | author upload only | **moderator** |
| Any host + upload | author upload | moderator |

So the most-used host always needs a human. This is a direct consequence of
EC's WAF, and it means the moderation queue is the normal path, not an
exception. If that load proves painful, the intended escape hatch is author
reputation (auto-publish uploads from users with N prior approved presets).
**Explicitly out of scope for v1** — add it only if the queue actually hurts.

## Architecture

Five components; four already exist.

### 1. R2 bucket (exists)

- Bucket: `xivdyetools-presets-preview-thumbnails`
- Public read via custom domain `shots.xivdyetools.app`
- Bound to presets-api as `THUMBNAILS`
- Key layout: `{presetId}/{uuid}.webp`

Verified end-to-end on 2026-08-10 by writing a test object and fetching it over
the custom domain (200, correct content-type), then deleting it.

Two measured behaviours drive design details:

- **A miss is negatively cached**: `404` returns `Cache-Control: max-age=14400`
  (4 hours). Nothing may request a thumbnail URL before its object exists.
  Guaranteed by serialising `thumbnail_url` only once status is `approved`, and
  by the random UUID in every key (a replacement is a new URL no negative cache
  has seen).
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
tolerance only stops a nominally-square image (1.00–1.05) from being treated as
landscape by a rounding error; square and portrait both take the upper band, so
the rule collapses to a single comparison.

The card's shot area is `height: 132px` at up to 320px wide, so the target is a
wide banner, not a square. The decode→crop→encode round trip drops EXIF, so GPS
data in an author's screenshot never reaches R2.

### 3. `presets-api` — owns the pipeline and the gate

Migration `0009_add_thumbnail.sql` (additive; existing rows keep working):

```sql
ALTER TABLE presets ADD COLUMN thumbnail_key TEXT;
ALTER TABLE presets ADD COLUMN thumbnail_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE presets ADD COLUMN thumbnail_source TEXT;
```

- `thumbnail_status`: `none | pending | approved | failed`
- `thumbnail_source`: `scrape | upload`
- **`thumbnail_url` is serialised only when `thumbnail_status = 'approved'`.**
  This single condition is the moderation gate; it lives in one place.

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

Also: add `mirapri.com` to `EXAMPLE_LINK_HOSTS` in `validation-service.ts` (and
mirror it client-side). Mirapri links cannot be submitted at all today.

### 4. `moderation-worker`

Attach the pending thumbnail URL to the Discord embed it already posts, so a
moderator reviews image and preset in one action. Approve/reject sets
`thumbnail_status`.

### 5. `web-app`

- Submit form gains an optional image picker (upload or paste).
- `preset-card` renders `<img src=thumbnail_url>` when present; the existing
  striped placeholder remains the fallback and is unchanged.
- `public/_headers`: add `https://shots.xivdyetools.app` to `img-src`.

## Data flow

### Scrape path (Mirapri / Imgur / Flickr) — never blocks submission

```
POST /presets -> row created -> response returns immediately
  \_ ctx.waitUntil:
       fetch page (5s cap, honest UA)
       parse og:image
       fetch image (<=5 MB, 10s, https only, image/* )
       image-worker crop+encode
       R2 put (immutable Cache-Control)
       status = trustedHost ? 'approved' : 'pending'
       if pending -> notify Discord queue
```

Any failure sets `failed`; the card keeps its placeholder. A missing thumbnail
is never an error the submitter sees.

### Upload path (Eorzea Collection and anything else)

```
client POST /presets/:id/thumbnail (author-only)
  -> validate size/type/magic bytes
  -> image-worker crop+encode
  -> R2 put
  -> status = 'pending', source = 'upload'
  -> notify Discord queue
```

## Limits, validation, security

**Uploads:** ≤ 5 MB; `image/png|jpeg|webp`. The declared content-type is a hint,
never the decision — sniff magic bytes. Photon rejects what it cannot decode,
which is a second gate. One thumbnail per preset; re-upload replaces.

**Scrape:** 5s page timeout, 10s image timeout, ≤ 5 MB, `https` only.

**SSRF:** `og:image` is attacker-influenced — the submitter picks the page and
the page picks the URL we fetch. Workers have no private network to pivot into,
which removes the classic payoff, but the discipline still applies: parse the
URL, require `https`, reject non-public hosts, do not follow redirects blindly.
Cheap now, and it keeps the rule true if this code ever runs somewhere with a
network behind it.

**Authorisation:** upload is author-only (401 unauthenticated, 403 non-author).

## Lifecycle

| Event | Effect |
|---|---|
| Preset deleted | R2 object deleted |
| `example_link` changed | thumbnail invalidated, status back to `none` |
| Moderator rejects image | object deleted, status `none`; preset unaffected |
| Re-upload | new UUID key; old object deleted |

No background re-scraping. If an author edits their glamour the thumbnail goes
stale; re-submitting the link refreshes it. A refresh crawler for 16 presets
would be inventing work.

**Cost:** a 640×264 WebP is ~30–60 KB against R2's 10 GB free tier. Not a
factor at any plausible scale for this app.

## Testing

The highest-value test is the gate: **`thumbnail_url` must be absent unless
`thumbnail_status = 'approved'`** — explicitly covered for `pending`, `failed`
and `none`. It is the only thing standing between an unreviewed image and every
gallery visitor.

- **image-worker** — crop selection (landscape → middle, portrait/square →
  upper), output dimensions, real decode/encode smoke test.
- **presets-api** — R2 mock from `@xivdyetools/test-utils` (already exists);
  MSW for the OG fetch; host-tier routing (Mirapri → `approved`, Imgur →
  `pending`); upload auth (non-author → 403); magic-byte rejection.
- **web-app** — card renders `<img>` when `thumbnail_url` is present, striped
  placeholder when absent (extends the existing card tests).

No E2E: it needs live R2 and a real third-party fetch. Not worth the flake.

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

- Author-reputation auto-publish (revisit if the queue hurts).
- Background thumbnail refresh / re-scrape.
- A bulk web moderation view.
- Approaching Eorzea Collection for an allowlist entry — worth doing, but it
  must not block this work.
