# Preset Preview Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a preset author upload a preview image that, once a moderator approves it, replaces the striped placeholder on the gallery card.

**Architecture:** The author uploads a file to presets-api, which forwards the bytes to image-worker over a service binding for crop + WebP encode, stores the result in R2, and marks it `pending`. `preview_image_url` is serialised only when status is `approved` — that single condition is the moderation gate. The `example_link` field is unrelated and is never fetched.

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), R2, `@cf-wasm/photon` (WASM), Vitest, Lit (web-app).

**Spec:** `docs/superpowers/specs/2026-08-10-preset-glamour-thumbnails-design.md`

## Global Constraints

- Output image: **640 × 264 WebP** (2× the card's 320×132 slot, ≈2.4242:1).
- Crop band: `aspect > 1.05` → **middle** band; `aspect <= 1.05` → **upper** band. Horizontally centred in both cases.
- Upload limit: **5 MB**; accepted types **png, jpeg, webp**, decided by **magic bytes**, not the declared `Content-Type`.
- R2 bucket name: `xivdyetools-presets-preview-thumbnails`; binding `THUMBNAILS`; public host `https://shots.xivdyetools.app`.
- R2 key layout: `{presetId}/{uuid}.webp`. Objects are written with `httpMetadata: { cacheControl: 'public, max-age=31536000, immutable' }`.
- `preview_image_status` values: `none | pending | approved`. No `failed` state.
- **`preview_image_url` MUST be absent unless `preview_image_status === 'approved'`.**
- Every new binding must be added to **both** the top-level block and `[env.production]` in `wrangler.toml` — Wrangler does not inherit bindings into named environments.
- Deploy commands differ per worker: `presets-api` and `image-worker` need `--env production`; `oauth` does not. See `docs/operations/DEPLOY_ENVIRONMENTS.md`.
- Photon `PhotonImage` instances are not garbage-collected. Every one created must be `.free()`d in a `finally` block, guarding against two variables holding the same reference.

---

### Task 1: Expand the example-link allowlist

Independent of everything else and shippable on its own. Currently Mirapri links cannot be submitted at all.

**Files:**
- Modify: `apps/presets-api/src/services/validation-service.ts:321`
- Modify: `apps/presets-api/tests/services/example-link.test.ts:25`
- Modify: `apps/web-app/src/shared/example-link.ts:16`

**Interfaces:**
- Consumes: nothing.
- Produces: `EXAMPLE_LINK_HOSTS: readonly string[]` — exported from both files above, same values.

- [ ] **Step 1: Update the failing test first**

The existing test at `apps/presets-api/tests/services/example-link.test.ts` asserts imgur is accepted. Replace that assertion and add the new hosts:

```typescript
  it('accepts every allowlisted host and their subdomains', () => {
    for (const host of EXAMPLE_LINK_HOSTS) {
      expect(validateExampleLink(`https://${host}/glamour/38412`)).toBeNull();
      expect(validateExampleLink(`https://www.${host}/a`)).toBeNull();
    }
  });

  it('accepts the glamour and social destinations', () => {
    expect(validateExampleLink('https://ffxiv.eorzeacollection.com/glamour/342206/x')).toBeNull();
    expect(validateExampleLink('https://mirapri.com/100814')).toBeNull();
    expect(validateExampleLink('https://www.reddit.com/r/FFXIVGlamours/comments/abc/x/')).toBeNull();
    expect(validateExampleLink('https://redd.it/abc123')).toBeNull();
    expect(validateExampleLink('https://x.com/user/status/123')).toBeNull();
    expect(validateExampleLink('https://twitter.com/user/status/123')).toBeNull();
    expect(validateExampleLink('https://bsky.app/profile/a.bsky.social/post/123')).toBeNull();
    expect(validateExampleLink('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('rejects bare image hosts — the field links a page, not an image', () => {
    expect(validateExampleLink('https://i.imgur.com/abc123.png')).not.toBeNull();
    expect(validateExampleLink('https://www.flickr.com/photos/x/123')).not.toBeNull();
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/presets-api && npx vitest run tests/services/example-link.test.ts`
Expected: FAIL — `mirapri.com` is rejected and `i.imgur.com` is accepted.

- [ ] **Step 3: Update the server allowlist**

In `apps/presets-api/src/services/validation-service.ts`, replace the `EXAMPLE_LINK_HOSTS` constant and its comment:

```typescript
/**
 * Example-link host allowlist.
 *
 * This list is not "hosts we can fetch from" — the link is never fetched. It
 * is "where we are willing to send our users", which makes it a spam and
 * phishing control. Entries are destinations that carry a glamour's
 * information (gear list, credit, comments), not image hosts: a raw image is
 * exactly what this field is not for.
 *
 * Exact hosts plus their subdomains (www.eorzeacollection.com, old.reddit.com).
 * The client mirrors this list in apps/web-app/src/shared/example-link.ts.
 */
export const EXAMPLE_LINK_HOSTS = [
  'eorzeacollection.com',
  'mirapri.com',
  'reddit.com',
  'redd.it',
  'x.com',
  'twitter.com',
  'bsky.app',
  'instagram.com',
] as const;
```

- [ ] **Step 4: Update the client mirror**

In `apps/web-app/src/shared/example-link.ts`, replace the constant so the two cannot disagree:

```typescript
/** Client mirror of the presets-api example-link host allowlist. */
export const EXAMPLE_LINK_HOSTS = [
  'eorzeacollection.com',
  'mirapri.com',
  'reddit.com',
  'redd.it',
  'x.com',
  'twitter.com',
  'bsky.app',
  'instagram.com',
];
```

- [ ] **Step 5: Run both test suites**

Run: `cd apps/presets-api && npx vitest run tests/services/example-link.test.ts`
Expected: PASS

Run: `cd apps/web-app && npm run test -- --run`
Expected: PASS (2200 tests). If a web-app test asserts imgur is valid, update it the same way.

- [ ] **Step 6: Commit**

```bash
git add apps/presets-api/src/services/validation-service.ts apps/presets-api/tests/services/example-link.test.ts apps/web-app/src/shared/example-link.ts
git commit -m "feat(presets): allow Mirapri, Reddit and social links; drop image hosts"
```

---

### Task 2: image-worker crop + WebP encode

**Files:**
- Modify: `apps/image-worker/src/photon.ts`
- Modify: `apps/image-worker/src/index.ts:75` (add route after `/extract`)
- Modify: `apps/image-worker/src/photon.test.ts`
- Modify: `apps/image-worker/src/index.test.ts`

**Interfaces:**
- Consumes: existing `loadImage(buffer: Uint8Array): PhotonImage` from `photon.ts`.
- Produces:
  - `computeCropBox(width: number, height: number): { x1: number; y1: number; x2: number; y2: number }`
  - `processImageForThumbnail(buffer: Uint8Array): Uint8Array` — returns WebP bytes.
  - `POST /thumbnail` — request body is raw image bytes; 200 returns `image/webp` bytes; 400 returns `{ error: string }`.

- [ ] **Step 1: Write the failing crop test**

Add to `apps/image-worker/src/photon.test.ts`:

```typescript
import { computeCropBox } from './photon.js';

describe('computeCropBox', () => {
  it('takes the middle band of a landscape image', () => {
    // 1920x1080 (1.78) is landscape -> vertically centred
    const box = computeCropBox(1920, 1080);
    expect(box.x1).toBe(0);
    expect(box.x2).toBe(1920);
    // band height = round(1920 / 2.4242) = 792; y = round((1080-792)/2) = 144
    expect(box.y2 - box.y1).toBe(792);
    expect(box.y1).toBe(144);
  });

  it('takes the upper band of a portrait image', () => {
    // 1080x1920 (0.5625) is portrait -> flush to the top
    const box = computeCropBox(1080, 1920);
    expect(box.y1).toBe(0);
    expect(box.x1).toBe(0);
    expect(box.x2).toBe(1080);
    expect(box.y2 - box.y1).toBe(446); // round(1080 / 2.4242)
  });

  it('takes the upper band of a square image', () => {
    const box = computeCropBox(1000, 1000);
    expect(box.y1).toBe(0);
    expect(box.y2 - box.y1).toBe(413); // round(1000 / 2.4242)
  });

  it('treats 4:3 as landscape, not square', () => {
    // 1.333 > 1.05, so the band is vertically centred rather than flush to the top
    const box = computeCropBox(1600, 1200);
    expect(box.y1).toBeGreaterThan(0);
  });

  it('never exceeds the source bounds on an ultra-wide image', () => {
    // 3000x400 (7.5) is wider than the target ratio: the band is width-limited
    const box = computeCropBox(3000, 400);
    expect(box.y1).toBe(0);
    expect(box.y2).toBe(400);
    expect(box.x2 - box.x1).toBe(970); // round(400 * 2.4242)
    expect(box.x2).toBeLessThanOrEqual(3000);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/image-worker && npx vitest run src/photon.test.ts -t computeCropBox`
Expected: FAIL — `computeCropBox is not a function`.

- [ ] **Step 3: Implement the crop maths**

Add to `apps/image-worker/src/photon.ts` (imports at top: add `crop` to the existing `@cf-wasm/photon` import):

```typescript
import { PhotonImage, SamplingFilter, resize, crop } from '@cf-wasm/photon';

/** Card shot slot is 320x132; we encode at 2x for retina. */
export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_HEIGHT = 264;
const TARGET_ASPECT = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT; // ~2.4242

/**
 * "Landscape" means wider than tall, so 4:3 (1.33) and 3:2 (1.50) are
 * landscape. The 0.05 tolerance only stops a nominally-square image being
 * treated as landscape by a rounding error; square and portrait share the same
 * branch, so the rule is one comparison.
 */
const LANDSCAPE_ASPECT_THRESHOLD = 1.05;

/**
 * The largest band of the target aspect ratio that fits inside the source,
 * positioned per the crop rule: middle for landscape, upper for square and
 * portrait. Always horizontally centred.
 *
 * Glamour shots are usually portrait with the character's head high in frame,
 * which is why those crop from the top rather than the centre.
 */
export function computeCropBox(
  width: number,
  height: number
): { x1: number; y1: number; x2: number; y2: number } {
  let bandWidth = width;
  let bandHeight = Math.round(width / TARGET_ASPECT);

  if (bandHeight > height) {
    // Source is wider than the target ratio — the band is limited by width.
    bandHeight = height;
    bandWidth = Math.round(height * TARGET_ASPECT);
  }

  const x1 = Math.round((width - bandWidth) / 2);
  const isLandscape = width / height > LANDSCAPE_ASPECT_THRESHOLD;
  const y1 = isLandscape ? Math.round((height - bandHeight) / 2) : 0;

  return { x1, y1, x2: x1 + bandWidth, y2: y1 + bandHeight };
}

/**
 * Decode -> crop to the card band -> resize to exactly 640x264 -> WebP.
 *
 * The decode/encode round trip also drops EXIF, so GPS coordinates in an
 * author's screenshot never reach R2.
 */
export function processImageForThumbnail(buffer: Uint8Array): Uint8Array {
  let original: PhotonImage | null = null;
  let cropped: PhotonImage | null = null;
  let resized: PhotonImage | null = null;

  try {
    original = loadImage(buffer);
    const box = computeCropBox(original.get_width(), original.get_height());
    cropped = crop(original, box.x1, box.y1, box.x2, box.y2);
    resized = resize(cropped, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, SamplingFilter.Lanczos3);
    return resized.get_bytes_webp();
  } finally {
    // Distinct references only — freeing the same pointer twice corrupts the
    // WASM heap.
    for (const img of new Set([original, cropped, resized])) {
      if (img) {
        try {
          img.free();
        } catch {
          // already freed
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the crop tests**

Run: `cd apps/image-worker && npx vitest run src/photon.test.ts -t computeCropBox`
Expected: PASS

- [ ] **Step 5: Write the failing route test**

Add to `apps/image-worker/src/index.test.ts`:

```typescript
describe('POST /thumbnail', () => {
  it('rejects an empty body', async () => {
    const res = await app.request('/thumbnail', {
      method: 'POST',
      body: new Uint8Array(0),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No image data provided' });
  });

  it('rejects bytes that are not a decodable image', async () => {
    const res = await app.request('/thumbnail', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `cd apps/image-worker && npx vitest run src/index.test.ts -t "POST /thumbnail"`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 7: Add the route**

In `apps/image-worker/src/index.ts`, add after the `/extract` handler and import `processImageForThumbnail` alongside `processImageForExtraction`:

```typescript
/**
 * Crop and encode an uploaded image into a card thumbnail.
 *
 * Internal only — reached via service binding from presets-api. Unlike
 * /extract this takes raw bytes rather than a URL: the caller already holds
 * the file, so there is nothing to fetch and no SSRF surface.
 */
app.post('/thumbnail', async (c) => {
  const buffer = new Uint8Array(await c.req.arrayBuffer());

  if (buffer.byteLength === 0) {
    return c.json({ error: 'No image data provided' }, 400);
  }

  try {
    const webp = processImageForThumbnail(buffer);
    return new Response(webp, {
      status: 200,
      headers: { 'Content-Type': 'image/webp' },
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      400
    );
  }
});
```

- [ ] **Step 8: Run the whole image-worker suite**

Run: `cd apps/image-worker && npm run test && npm run type-check && npm run lint`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/image-worker/src/photon.ts apps/image-worker/src/index.ts apps/image-worker/src/photon.test.ts apps/image-worker/src/index.test.ts
git commit -m "feat(image-worker): add POST /thumbnail with band crop and WebP encode"
```

---

### Task 3: Database columns and the serialization gate

Adds the columns and makes `preview_image_url` appear only for approved images. No upload route yet, so nothing can set `pending` — that is deliberate: the gate ships and is tested before anything can write through it.

**Files:**
- Create: `apps/presets-api/migrations/0009_add_preview_image.sql`
- Modify: `apps/presets-api/schema.sql` (so a fresh database matches)
- Modify: `apps/presets-api/src/types.ts:83-101` (`PresetRow`)
- Modify: `apps/presets-api/src/services/preset-service.ts:48-93` (`rowToPreset`)
- Modify: `packages/types/src/preset/community.ts:90` (`CommunityPreset`)
- Modify: `apps/presets-api/tests/services/preset-service.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `PresetRow.preview_image_key: string | null`, `PresetRow.preview_image_status: string`
  - `CommunityPreset.preview_image_url?: string | null`
  - `PREVIEW_IMAGE_PUBLIC_BASE = 'https://shots.xivdyetools.app'` exported from `preset-service.ts`

- [ ] **Step 1: Write the migration**

Create `apps/presets-api/migrations/0009_add_preview_image.sql`:

```sql
-- Preset preview images: the author uploads a picture for the card. Separate
-- from example_link, which points at a PAGE about the glamour and is never
-- fetched. See docs/superpowers/specs/2026-08-10-preset-glamour-thumbnails-design.md
--
-- Run (deploy window), BEFORE deploying the new presets-api:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0009_add_preview_image.sql
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

ALTER TABLE presets ADD COLUMN preview_image_key TEXT;
ALTER TABLE presets ADD COLUMN preview_image_status TEXT NOT NULL DEFAULT 'none';
```

- [ ] **Step 2: Mirror the columns into schema.sql**

In `apps/presets-api/schema.sql`, inside `CREATE TABLE IF NOT EXISTS presets`, add after the `example_link TEXT,` line:

```sql
  preview_image_key TEXT,
  preview_image_status TEXT NOT NULL DEFAULT 'none',
```

- [ ] **Step 3: Verify schema.sql still parses**

Run: `cd apps/presets-api && npx wrangler d1 execute xivdyetools-presets --local --file=./schema.sql`
Expected: `"success": true`. (A trailing-comma slip here is exactly how schema.sql was broken before.)

- [ ] **Step 4: Write the failing gate tests**

Add to `apps/presets-api/tests/services/preset-service.test.ts`:

```typescript
import { rowToPreset } from '../../src/services/preset-service';
import type { PresetRow } from '../../src/types';

const baseRow: PresetRow = {
  id: 'p1',
  name: 'Test',
  description: 'd',
  category_id: 'aesthetics',
  dyes: '[1,2,3]',
  tags: '[]',
  author_discord_id: '123',
  author_name: 'Author',
  vote_count: 0,
  status: 'approved',
  is_curated: 0,
  created_at: '2026-08-10T00:00:00.000Z',
  updated_at: '2026-08-10T00:00:00.000Z',
  dye_signature: '[1,2,3]',
  previous_values: null,
  example_link: null,
  preview_image_key: 'p1/abc.webp',
  preview_image_status: 'none',
};

describe('rowToPreset preview image gate', () => {
  it('omits the URL when status is none', () => {
    expect(rowToPreset({ ...baseRow, preview_image_status: 'none' }).preview_image_url).toBeNull();
  });

  it('omits the URL when status is pending — an unreviewed image must never be served', () => {
    expect(rowToPreset({ ...baseRow, preview_image_status: 'pending' }).preview_image_url).toBeNull();
  });

  it('serves the URL only when approved', () => {
    const preset = rowToPreset({ ...baseRow, preview_image_status: 'approved' });
    expect(preset.preview_image_url).toBe('https://shots.xivdyetools.app/p1/abc.webp');
  });

  it('omits the URL when approved but no key was ever stored', () => {
    const preset = rowToPreset({
      ...baseRow,
      preview_image_key: null,
      preview_image_status: 'approved',
    });
    expect(preset.preview_image_url).toBeNull();
  });
});
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `cd apps/presets-api && npx vitest run tests/services/preset-service.test.ts -t "preview image gate"`
Expected: FAIL — `preview_image_url` is undefined.

- [ ] **Step 6: Add the row fields**

In `apps/presets-api/src/types.ts`, add to `PresetRow` after `example_link`:

```typescript
  preview_image_key: string | null; // R2 key, {presetId}/{uuid}.webp
  preview_image_status: string; // 'none' | 'pending' | 'approved'
```

- [ ] **Step 7: Add the API field**

In `packages/types/src/preset/community.ts`, add to `CommunityPreset` after `example_link`:

```typescript
  /**
   * Public URL of the author-uploaded preview image. Present ONLY when the
   * image has been approved by a moderator — the serialiser omits it for every
   * other status, which is the moderation gate.
   */
  preview_image_url?: string | null;
```

- [ ] **Step 8: Implement the gate**

In `apps/presets-api/src/services/preset-service.ts`, add the constant near the top of the file:

```typescript
/** R2 custom domain serving approved preview images. */
export const PREVIEW_IMAGE_PUBLIC_BASE = 'https://shots.xivdyetools.app';
```

and add to the object returned by `rowToPreset`, after `example_link`:

```typescript
    // THE MODERATION GATE. An unapproved image must never be reachable from
    // the API, so the URL is built only for 'approved'. Do not move this
    // condition into a caller — one place, one rule.
    preview_image_url:
      row.preview_image_status === 'approved' && row.preview_image_key
        ? `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}`
        : null,
```

- [ ] **Step 9: Run the tests**

Run: `cd apps/presets-api && npm run test -- --run && npm run type-check`
Expected: PASS. Fix any other test that constructs a `PresetRow` literal by adding the two new fields.

Run: `cd ../.. && pnpm turbo run build --filter=@xivdyetools/types`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/presets-api/migrations/0009_add_preview_image.sql apps/presets-api/schema.sql apps/presets-api/src/types.ts apps/presets-api/src/services/preset-service.ts apps/presets-api/tests/services/preset-service.test.ts packages/types/src/preset/community.ts
git commit -m "feat(presets-api): add preview image columns and the approval gate"
```

---

### Task 4: The upload route

**Files:**
- Modify: `apps/presets-api/wrangler.toml` (both blocks)
- Modify: `apps/presets-api/src/types.ts` (`Env`)
- Create: `apps/presets-api/src/services/preview-image-service.ts`
- Modify: `apps/presets-api/src/handlers/presets.ts` (add route)
- Create: `apps/presets-api/tests/services/preview-image-service.test.ts`
- Modify: `packages/test-utils/src/cloudflare/r2.ts` (accept `httpMetadata`)

**Interfaces:**
- Consumes: `PresetRow.preview_image_key`, `PresetRow.preview_image_status` (Task 3); `POST /thumbnail` on image-worker (Task 2).
- Produces:
  - `sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null`
  - `storePreviewImage(env: Env, presetId: string, bytes: Uint8Array): Promise<string>` — returns the new R2 key.
  - `getPresetImageState(db: D1Database, id: string): Promise<{ author_discord_id: string | null; preview_image_key: string | null } | null>`
  - `deletePreviewImage(env: Env, key: string | null): Promise<void>`
  - `POST /api/v1/presets/:id/preview-image`

> **Why a new row-level helper:** the existing `getPresetById` returns a
> `CommunityPreset`, which by design carries only the *gated* `preview_image_url`
> and never the raw `preview_image_key`. Reading the key through it is a type
> error. Handlers that need the storage key must go to the row.

- [ ] **Step 1: Add the bindings**

In `apps/presets-api/wrangler.toml`, add to the **top-level** block:

```toml
[[r2_buckets]]
binding = "THUMBNAILS"
bucket_name = "xivdyetools-presets-preview-thumbnails"

[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"
```

and the same two entries again as `[[env.production.r2_buckets]]` and `[[env.production.services]]`. Bindings are not inherited into named environments; omitting the production copies produces a worker that type-checks and fails at runtime.

In `apps/presets-api/src/types.ts`, add to `Env`:

```typescript
  THUMBNAILS: R2Bucket;
  IMAGE_WORKER: Fetcher;
```

- [ ] **Step 2: Teach the R2 mock about httpMetadata**

In `packages/test-utils/src/cloudflare/r2.ts`, widen the `put` signature on `MockR2Bucket` so the cache-control header can be asserted:

```typescript
  put: (
    key: string,
    value: ArrayBuffer | string | ReadableStream | Blob,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { cacheControl?: string; contentType?: string };
    }
  ) => Promise<R2ObjectMeta>;
```

and store it on the stored object so tests can read it back (add `httpMetadata` to `StoredR2Object` and set it in the `put` implementation).

- [ ] **Step 3: Write the failing magic-byte tests**

Create `apps/presets-api/tests/services/preview-image-service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sniffImageType } from '../../src/services/preview-image-service';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe('sniffImageType', () => {
  it('identifies png, jpeg and webp by magic bytes', () => {
    expect(sniffImageType(png)).toBe('png');
    expect(sniffImageType(jpeg)).toBe('jpeg');
    expect(sniffImageType(webp)).toBe('webp');
  });

  it('rejects a non-image, however it was labelled', () => {
    expect(sniffImageType(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBeNull();
  });

  it('rejects a RIFF container that is not WEBP', () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it('rejects a buffer too short to carry a signature', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `cd apps/presets-api && npx vitest run tests/services/preview-image-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the service**

Create `apps/presets-api/src/services/preview-image-service.ts`:

```typescript
/**
 * Preview image storage: sniff, hand to image-worker, put in R2.
 *
 * The author uploads a picture for their preset's card. This module owns the
 * bytes; the moderation gate lives in preset-service's rowToPreset.
 *
 * @module services/preview-image-service
 */

import type { Env } from '../types.js';

/** Cloudflare's cap for this route; also bounds what image-worker decodes. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Identify an image by its leading bytes.
 *
 * The declared Content-Type is a hint, never the decision — a PNG header on a
 * 300 MB archive is the oldest trick there is, and the browser will happily
 * label anything image/png.
 */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  if (bytes.length < 12) return null;

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // RIFF....WEBP — the container alone is not enough, WAV shares the prefix.
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Crop + encode via image-worker, then store in R2.
 *
 * @returns the R2 key of the stored object
 * @throws when image-worker cannot decode the bytes
 */
export async function storePreviewImage(
  env: Env,
  presetId: string,
  bytes: Uint8Array
): Promise<string> {
  const response = await env.IMAGE_WORKER.fetch(
    new Request('https://image-worker/thumbnail', {
      method: 'POST',
      body: bytes,
    })
  );

  if (!response.ok) {
    throw new Error('Image could not be processed');
  }

  const webp = await response.arrayBuffer();
  const key = `${presetId}/${crypto.randomUUID()}.webp`;

  await env.THUMBNAILS.put(key, webp, {
    httpMetadata: {
      contentType: 'image/webp',
      // Safe to mark immutable: the UUID makes every key single-use, so this
      // URL can never come to mean something else.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return key;
}

/** Remove a stored object; missing keys are not an error. */
export async function deletePreviewImage(env: Env, key: string | null): Promise<void> {
  if (!key) return;
  await env.THUMBNAILS.delete(key);
}

/**
 * Read the ownership and storage-key columns straight off the row.
 *
 * `getPresetById` returns a CommunityPreset, which carries only the gated
 * `preview_image_url` and deliberately never exposes `preview_image_key` — so
 * it cannot answer "which object do I replace or delete?".
 */
export async function getPresetImageState(
  db: D1Database,
  id: string
): Promise<{ author_discord_id: string | null; preview_image_key: string | null } | null> {
  const row = await db
    .prepare('SELECT author_discord_id, preview_image_key FROM presets WHERE id = ?')
    .bind(id)
    .first<{ author_discord_id: string | null; preview_image_key: string | null }>();
  return row ?? null;
}
```

- [ ] **Step 6: Run the sniff tests**

Run: `cd apps/presets-api && npx vitest run tests/services/preview-image-service.test.ts`
Expected: PASS

- [ ] **Step 7: Add the route**

In `apps/presets-api/src/handlers/presets.ts`, add after the existing `POST /` handler. Import the service and `ErrorCode` (already imported):

```typescript
/**
 * POST /:id/preview-image — the author uploads their card picture.
 *
 * Author-only: a preset's picture is the author's to choose. The upload lands
 * as 'pending' and is invisible until a moderator approves it.
 */
presetsRouter.post('/:id/preview-image', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const userError = requireUserContext(c);
  if (userError) return userError;

  const banError = await requireNotBannedCheck(c);
  if (banError) return banError;

  const auth = c.get('auth');
  const presetId = c.req.param('id');

  // Row-level read: we need preview_image_key, which CommunityPreset hides.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return c.json(
      { success: false, error: ErrorCode.NOT_FOUND, message: 'Preset not found' },
      404
    );
  }

  if (preset.author_discord_id !== auth.userDiscordId) {
    return c.json(
      {
        success: false,
        error: ErrorCode.FORBIDDEN,
        message: 'Only the author can set a preview image',
      },
      403
    );
  }

  const bytes = new Uint8Array(await c.req.arrayBuffer());

  if (bytes.byteLength === 0) {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: 'No image data provided' },
      400
    );
  }

  if (bytes.byteLength > MAX_PREVIEW_IMAGE_BYTES) {
    return c.json(
      {
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Image must be at most 5 MB',
      },
      400
    );
  }

  if (!sniffImageType(bytes)) {
    return c.json(
      {
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Image must be a PNG, JPEG or WebP',
      },
      400
    );
  }

  let key: string;
  try {
    key = await storePreviewImage(c.env, presetId, bytes);
  } catch {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: 'Image could not be processed' },
      400
    );
  }

  // Replace any previous image so an abandoned object is not orphaned.
  await deletePreviewImage(c.env, preset.preview_image_key);

  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = ?, preview_image_status = 'pending', updated_at = ? WHERE id = ?`
  )
    .bind(key, new Date().toISOString(), presetId)
    .run();

  return c.json({ success: true, status: 'pending' });
});
```

Add these imports at the top of `presets.ts`:

```typescript
import {
  sniffImageType,
  storePreviewImage,
  deletePreviewImage,
  getPresetImageState,
  MAX_PREVIEW_IMAGE_BYTES,
} from '../services/preview-image-service.js';
```

- [ ] **Step 8: Delete the object when the preset is deleted**

`presetsRouter.delete('/:id')` already exists at `src/handlers/presets.ts:219`.
Without this the R2 object outlives its preset forever — nothing else ever
references that key again.

Write the failing test first, in `apps/presets-api/tests/handlers/presets.test.ts`:

```typescript
it('removes the stored preview image when the preset is deleted', async () => {
  // seed a preset owned by the test author with preview_image_key = 'p1/a.webp'
  // and put that key in the mock bucket
  expect(mockBucket._store.has('p1/a.webp')).toBe(true);

  const res = await authorRequest(`/api/v1/presets/${presetId}`, { method: 'DELETE' });
  expect(res.status).toBe(200);

  expect(mockBucket._store.has('p1/a.webp')).toBe(false);
});
```

Run it (expect FAIL — the object survives), then add to the delete handler,
before the row is removed:

```typescript
  // The row is about to go; nothing will ever reference this key again.
  const imageState = await getPresetImageState(c.env.DB, presetId);
  await deletePreviewImage(c.env, imageState?.preview_image_key ?? null);
```

Re-run: expect PASS.

- [ ] **Step 9: Run the full suite**

Run: `cd apps/presets-api && npm run test -- --run && npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/presets-api packages/test-utils/src/cloudflare/r2.ts
git commit -m "feat(presets-api): author preview-image upload via image-worker to R2"
```

---

### Task 5: Moderator approval

**Files:**
- Modify: `apps/presets-api/src/handlers/moderation.ts`
- Modify: `apps/presets-api/tests/handlers/moderation.test.ts`

**Interfaces:**
- Consumes: `preview_image_status` (Task 3), `deletePreviewImage` (Task 4).
- Produces: `PATCH /api/v1/moderation/:presetId/preview-image` with body `{ action: 'approve' | 'reject' }`.

- [ ] **Step 1: Write the failing test**

Add to `apps/presets-api/tests/handlers/moderation.test.ts`, following the file's existing request-building style:

```typescript
describe('PATCH /moderation/:presetId/preview-image', () => {
  it('approves a pending image so the URL starts being served', async () => {
    // seed a preset with preview_image_status = 'pending' using the file's
    // existing helper, then:
    const res = await moderatorRequest(`/api/v1/moderation/${presetId}/preview-image`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(200);

    const row = await db
      .prepare('SELECT preview_image_status FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ preview_image_status: string }>();
    expect(row?.preview_image_status).toBe('approved');
  });

  it('rejects by clearing the image, leaving the preset alone', async () => {
    const res = await moderatorRequest(`/api/v1/moderation/${presetId}/preview-image`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'reject' }),
    });
    expect(res.status).toBe(200);

    const row = await db
      .prepare('SELECT preview_image_status, preview_image_key, status FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ preview_image_status: string; preview_image_key: string | null; status: string }>();
    expect(row?.preview_image_status).toBe('none');
    expect(row?.preview_image_key).toBeNull();
    expect(row?.status).toBe('approved'); // the preset itself is untouched
  });

  it('refuses a non-moderator', async () => {
    const res = await authorRequest(`/api/v1/moderation/${presetId}/preview-image`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/presets-api && npx vitest run tests/handlers/moderation.test.ts -t preview-image`
Expected: FAIL — 404.

- [ ] **Step 3: Implement the route**

Add to `apps/presets-api/src/handlers/moderation.ts`:

```typescript
/**
 * PATCH /:presetId/preview-image — approve or reject an uploaded image.
 *
 * Rejection clears the image only. The preset keeps its own status: a bad
 * picture is not a bad palette.
 */
moderationRouter.patch('/:presetId/preview-image', async (c) => {
  const modError = requireModerator(c);
  if (modError) return modError;

  const presetId = c.req.param('presetId');

  let body: { action?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: 'Invalid JSON body' },
      400
    );
  }

  if (body.action !== 'approve' && body.action !== 'reject') {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: "action must be 'approve' or 'reject'" },
      400
    );
  }

  // Row-level read: CommunityPreset hides preview_image_key by design.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return c.json({ success: false, error: ErrorCode.NOT_FOUND, message: 'Preset not found' }, 404);
  }

  const now = new Date().toISOString();

  if (body.action === 'approve') {
    await c.env.DB.prepare(
      `UPDATE presets SET preview_image_status = 'approved', updated_at = ? WHERE id = ?`
    )
      .bind(now, presetId)
      .run();
    return c.json({ success: true, preview_image_status: 'approved' });
  }

  await deletePreviewImage(c.env, preset.preview_image_key);
  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ?`
  )
    .bind(now, presetId)
    .run();

  return c.json({ success: true, preview_image_status: 'none' });
});
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/presets-api && npm run test -- --run && npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/presets-api/src/handlers/moderation.ts apps/presets-api/tests/handlers/moderation.test.ts
git commit -m "feat(presets-api): moderator approve/reject for preview images"
```

---

### Task 6: Card renders the approved image

**Files:**
- Modify: `apps/web-app/src/components/v4/preset-card.ts:36` (`PresetCardData`), `:314-355` (render)
- Modify: `apps/web-app/src/components/v4/preset-tool.ts` (populate the new field)
- Modify: `apps/web-app/src/services/hybrid-preset-service.ts` (`UnifiedPreset`)
- Modify: `apps/web-app/public/_headers`
- Create: `apps/web-app/src/components/__tests__/v4/preset-card.test.ts`

> **Test location and style:** v4 component tests live in
> `src/components/__tests__/v4/`, NOT beside the component. There is no
> `@open-wc/testing` in this project — do not import `fixture`/`html` from it.
> Mount the way `src/components/__tests__/v4/result-card.test.ts` does: create a
> container div, append the element, set properties, `await el.updateComplete`,
> then query `el.shadowRoot`. Copy that file's `vi.mock` block for
> `@services/index`, `@xivdyetools/core` and `@shared/logger` — a Lit component
> pulled in without them fails at import.

**Interfaces:**
- Consumes: `preview_image_url` from the API (Task 3).
- Produces: `PresetCardData.previewImageUrl?: string | null`; `UnifiedPreset.previewImageUrl?: string | null`.

- [ ] **Step 1: Write the failing test**

Add to the preset-card test file:

```typescript
/** Mount a card with the given data and wait for Lit to render. */
async function mountCard(data: PresetCardData): Promise<HTMLElement> {
  await import('../../v4/preset-card');
  const el = document.createElement('v4-preset-card') as HTMLElement & {
    data: PresetCardData;
    updateComplete: Promise<unknown>;
  };
  el.data = data;
  container.appendChild(el);
  await el.updateComplete;
  return el;
}

it('renders the preview image when one is approved', async () => {
  const el = await mountCard({
    ...baseCardData,
    previewImageUrl: 'https://shots.xivdyetools.app/p1/a.webp',
  });

  const img = el.shadowRoot!.querySelector('img.shot-img') as HTMLImageElement | null;
  expect(img).not.toBeNull();
  expect(img!.getAttribute('src')).toBe('https://shots.xivdyetools.app/p1/a.webp');
});

it('falls back to the striped link treatment when there is no image', async () => {
  const el = await mountCard({
    ...baseCardData,
    previewImageUrl: null,
    exampleLink: 'https://mirapri.com/100814',
  });

  expect(el.shadowRoot!.querySelector('img.shot-img')).toBeNull();
  expect(el.shadowRoot!.querySelector('.shot-caption')).not.toBeNull();
});
```

`baseCardData` is a minimal valid `PresetCardData` you define at the top of the
file — build it from the shape in `preset-card.ts` (`preset`, `colors`, and the
optional fields). `container` is the `document.createElement('div')` created in
`beforeEach`, matching `result-card.test.ts`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/web-app && npx vitest run src/components/__tests__/v4/preset-card.test.ts`
Expected: FAIL — no `<img>` is rendered.

- [ ] **Step 3: Add the field and render branch**

In `apps/web-app/src/components/v4/preset-card.ts`, add to `PresetCardData`:

```typescript
  /** Approved preview image URL; absent until a moderator approves it. */
  previewImageUrl?: string | null;
```

Add to the `.shot` styles:

```css
      .shot-img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
```

In `renderShot` (around line 314), take the image branch first:

```typescript
    const { preset, colors, exampleLink, previewImageUrl } = this.data;
    const hasImage = !!previewImageUrl && this.showShot;
    const hasShot = !hasImage && !!exampleLink && this.showShot;
```

and inside the `.shot` div, before the caption:

```typescript
          ${hasImage
            ? html`<img
                class="shot-img"
                src=${previewImageUrl!}
                alt=""
                loading="lazy"
                decoding="async"
              />`
            : nothing}
```

`alt=""` is deliberate: the image is decorative next to the preset name, so a screen reader should skip it rather than announce a filename.

- [ ] **Step 4: Thread the field through**

In `apps/web-app/src/services/hybrid-preset-service.ts`, add `previewImageUrl?: string | null;` to `UnifiedPreset` and map it wherever a `CommunityPreset` becomes a `UnifiedPreset` (`preview_image_url` → `previewImageUrl`). In `preset-tool.ts`'s `presetToCardData`, pass `previewImageUrl: preset.previewImageUrl ?? null`. In `localPaletteToUnified`, set it to `null` — a local palette has no server image.

- [ ] **Step 5: Update the CSP**

In `apps/web-app/public/_headers`, change the `img-src` directive to:

```
img-src 'self' data: blob: https://cdn.discordapp.com https://shots.xivdyetools.app;
```

Leave every other directive untouched.

- [ ] **Step 6: Run the tests**

Run: `cd apps/web-app && npm run test -- --run && npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/components/v4/preset-card.ts apps/web-app/src/components/v4/preset-tool.ts apps/web-app/src/services/hybrid-preset-service.ts apps/web-app/public/_headers apps/web-app/src/components/__tests__/v4/preset-card.test.ts
git commit -m "feat(web-app): render approved preset preview images on cards"
```

---

### Task 7: Submit-form image picker

**Files:**
- Modify: `apps/web-app/src/components/preset-submission-form.ts` (state at :35, :88; field near :614; submit near :685)
- Modify: `apps/web-app/src/services/preset-submission-service.ts`
- Modify: `apps/web-app/src/locales/en.json`
- Modify: the submission-form test file

**Interfaces:**
- Consumes: `POST /api/v1/presets/:id/preview-image` (Task 4).
- Produces: `uploadPreviewImage(presetId: string, file: File): Promise<void>` on `preset-submission-service`.

- [ ] **Step 1: Write the failing service test**

```typescript
it('POSTs the raw file bytes to the preview-image route', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ success: true }), { status: 200 })
  );
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', {
    type: 'image/png',
  });

  await uploadPreviewImage('preset-1', file);

  const [url, init] = fetchSpy.mock.calls[0];
  expect(String(url)).toContain('/api/v1/presets/preset-1/preview-image');
  expect((init as RequestInit).method).toBe('POST');
});

it('rejects a file over 5 MB before any request is made', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });

  await expect(uploadPreviewImage('preset-1', big)).rejects.toThrow();
  expect(fetchSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/web-app && npx vitest run src/services/__tests__/preset-submission-service.test.ts -t preview-image`
Expected: FAIL — `uploadPreviewImage` is not exported.

- [ ] **Step 3: Implement the upload call**

Add to `apps/web-app/src/services/preset-submission-service.ts`:

```typescript
/** Mirror of the server limit — fail locally rather than spend the upload. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Upload a preview image for a preset the signed-in user authored.
 *
 * Sent as raw bytes, not multipart: the route takes one file and nothing else,
 * so a multipart envelope would be parsing work for no information.
 */
export async function uploadPreviewImage(presetId: string, file: File): Promise<void> {
  if (file.size > MAX_PREVIEW_IMAGE_BYTES) {
    throw new Error('Image must be at most 5 MB');
  }

  const token = authService.getToken();
  const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/${presetId}/preview-image`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error('Preview image upload failed');
  }
}
```

Use whatever the file's existing helper is for the auth header rather than reimplementing it if one exists.

- [ ] **Step 4: Add the form field**

In `apps/preset-submission-form.ts`: add `previewImage: File | null` to the form state (initialised `null`), render an `<input type="file" accept="image/png,image/jpeg,image/webp">` beneath the example-link field, and store the chosen file on `change`. Add these keys to `apps/web-app/src/locales/en.json` under `preset`:

```json
      "fieldPreviewImage": "Preview image (optional)",
      "fieldPreviewImageHint": "PNG, JPEG or WebP, up to 5 MB. Shown on your card once a moderator approves it.",
      "previewImageTooLarge": "Image must be at most 5 MB",
      "previewImageFailed": "Preview image upload failed — your preset was still submitted"
```

Do not add fallback strings in `LanguageService.t()` calls; the lint rule `xivdyetools-i18n/no-i18n-fallback` rejects them.

- [ ] **Step 5: Upload after a successful submit**

In the form's submit path (near line 685), after the preset is created and its id is known:

```typescript
    if (state.previewImage) {
      try {
        await uploadPreviewImage(created.id, state.previewImage);
      } catch {
        // The preset exists; only the picture failed. Say so and move on —
        // throwing here would imply the whole submission was lost.
        ToastService.warning(LanguageService.t('preset.previewImageFailed'));
      }
    }
```

- [ ] **Step 6: Run the tests**

Run: `cd apps/web-app && npm run test -- --run && npm run type-check && npm run lint && npm run validate:i18n`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/components/preset-submission-form.ts apps/web-app/src/services/preset-submission-service.ts apps/web-app/src/locales/en.json apps/web-app/src/services/__tests__/preset-submission-service.test.ts
git commit -m "feat(web-app): optional preview image on preset submission"
```

---

### Task 8: Discord notification for a pending image

**Files:**
- Modify: `apps/discord-worker/src/types/preset.ts:63` (`PresetNotificationPayload`)
- Modify: `apps/discord-worker/src/index.ts:150` (`/webhooks/preset-submission`)
- Modify: `apps/discord-worker/src/index.test.ts`
- Modify: `apps/presets-api/src/handlers/presets.ts` (notify after upload)

**Interfaces:**
- Consumes: `preview_image_key` written by Task 4.
- Produces: a `type: 'preview_image'` variant of the existing webhook payload.

> **This is a separate notification, not a field on the submission embed.**
> The submission notification fires when the preset row is created, and the
> image is uploaded *afterwards* — the web-app cannot upload before it has a
> preset id. Attaching the image to the submission embed would therefore
> attach nothing every time. The upload route sends its own message instead.

- [ ] **Step 1: Write the failing test**

Add to `apps/discord-worker/src/index.test.ts`, following the file's existing
webhook-request style:

```typescript
it('posts a review message carrying the pending preview image', async () => {
  const res = await app.request('/webhooks/preset-submission', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'preview_image',
      preset: { id: 'p1', name: 'Test', author_name: 'Author' },
      preview_image_key: 'p1/abc.webp',
    }),
  }, env);

  expect(res.status).toBe(200);
  const sent = fetchMock.mock.calls.find(([url]) => String(url).includes('/messages'));
  const body = JSON.parse((sent![1] as RequestInit).body as string);
  expect(body.embeds[0].image.url).toBe('https://shots.xivdyetools.app/p1/abc.webp');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd apps/discord-worker && npx vitest run src/index.test.ts -t "pending preview image"`
Expected: FAIL — the payload type is rejected.

- [ ] **Step 3: Widen the payload type**

In `apps/discord-worker/src/types/preset.ts`, change the `type` field and add
the key:

```typescript
export interface PresetNotificationPayload {
  /** Notification type */
  type: 'submission' | 'preview_image';
  /**
   * R2 key of an uploaded preview image awaiting review. Present only on
   * `preview_image` notifications.
   */
  preview_image_key?: string | null;
  /** Preset data */
  preset: {
```

- [ ] **Step 4: Handle the new type**

In `apps/discord-worker/src/index.ts`, inside the `/webhooks/preset-submission`
handler, branch before the existing submission handling:

```typescript
  if (payload.type === 'preview_image') {
    const adminT = createTranslator('en');
    const safeName = sanitizePresetName(payload.preset.name);
    const imageRes = await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: `🖼️ ${adminT.t('webhook.previewImagePending')}`,
          description: `**${safeName}**`,
          color: STATUS_DISPLAY.pending.color,
          // Built here rather than read from the API: for a pending image the
          // API withholds preview_image_url by design, and this embed is
          // exactly where an unapproved image is meant to be seen.
          ...(payload.preview_image_key
            ? { image: { url: `https://shots.xivdyetools.app/${payload.preview_image_key}` } }
            : {}),
          footer: { text: `ID: ${payload.preset.id}` },
        },
      ],
    });
    if (!imageRes.ok) {
      logger.error('Preview-image notification rejected by Discord', undefined, {
        status: imageRes.status,
      });
    }
    return c.json({ success: true });
  }
```

Add `"previewImagePending": "Preview image awaiting review"` to the
discord-worker locale under `webhook`.

- [ ] **Step 5: Fire it from presets-api**

At the end of the upload route from Task 4, after the `UPDATE` succeeds:

```typescript
  // Best-effort: the image is stored and pending either way. A notification
  // failure must not fail the upload the author just completed.
  try {
    await c.env.DISCORD_WORKER?.fetch(
      new Request('https://internal/webhooks/preset-submission', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.INTERNAL_WEBHOOK_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'preview_image',
          preset: { id: presetId, name: preset.name ?? '', author_name: auth.userName ?? '' },
          preview_image_key: key,
        }),
      })
    );
  } catch {
    // swallowed deliberately — see comment above
  }
```

Widen `getPresetImageState`'s `SELECT` to include `name` so the notification can
title itself, and update its return type to match.

- [ ] **Step 6: Run tests and commit**

Run: `cd apps/discord-worker && npm run test -- --run && npm run type-check && npm run lint`
Run: `cd ../presets-api && npm run test -- --run && npm run type-check && npm run lint`
Expected: PASS

```bash
git add apps/discord-worker apps/presets-api/src/handlers/presets.ts apps/presets-api/src/services/preview-image-service.ts
git commit -m "feat(discord): notify moderators when a preview image needs review"
```

---

## Deployment (user-run, after all tasks are green)

1. **Migration first** — before any worker deploy:
   ```bash
   cd apps/presets-api
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT SUM(name='preview_image_key') AS k, SUM(name='preview_image_status') AS s, COUNT(*) AS total FROM pragma_table_info('presets');"
   # expect k=0 s=0, then:
   npx wrangler d1 execute xivdyetools-presets --remote --file=./migrations/0009_add_preview_image.sql
   # re-run the SELECT; expect k=1 s=1
   ```
   Use the single-row aggregate, never a column list — a truncated list read as
   complete is how two columns were wrongly reported missing on 2026-08-10.

2. `cd apps/image-worker && pnpm deploy:production`
3. `cd apps/presets-api && pnpm deploy:production`
4. `cd apps/discord-worker && pnpm deploy:production` — it carries the new
   `preview_image` notification branch. **Deploy image-worker before it**, per
   `apps/image-worker/CLAUDE.md`: discord-worker's `IMAGE_WORKER` binding fails
   to resolve otherwise. (Step 2 already covers that ordering.)
5. web-app: merge to the branch, CI deploys. It carries the CSP change and must be last.

Smoke test: submit a preset with an image, confirm the card shows the placeholder
(not the image), approve it in Discord, reload, confirm the image appears.
