# Preset Categories & Preview-Image Editing — Design

**Date:** 2026-08-11
**Status:** Approved (design); not implemented
**Builds on:** `docs/superpowers/specs/2026-08-10-preset-glamour-thumbnails-design.md`
**Design source:** `Tool Icon Directions.dc.html` (Turn 23 · Group 2), project
`993f0c5c-05b9-439b-8047-66a9c5ab1bd6` — sections `6a`, `6b`, `6c`

Three changes to what an author may do to their own preset, plus the three new
categories the design turn confirmed:

1. Categories become **1 primary + up to 2 secondary**, editable after submission.
2. **Appearance**, **Zones** and **Raids & Trials** join the enum (5 → 8).
3. The preview picture can be **uploaded, replaced or removed** from the edit
   form. Upload/replace re-queues the *image*; removal clears it.

---

## 1. Where the work actually lands

`preset-tool.ts` is a launcher, not a form. It dynamically imports
`preset-edit-form.ts` and hands it a `CommunityPreset`. The changes land in:

| Layer | Files |
|---|---|
| Types | `packages/types/src/preset/{core,community,request}.ts` |
| Glyphs | `packages/svg/src/icons/tool-icons.ts` |
| API | `apps/presets-api/{schema.sql,migrations,src/handlers,src/services}` |
| Web forms | `apps/web-app/src/components/preset-{edit,submission}-form.ts` |
| Web gallery | `apps/web-app/src/components/v4/preset-{tool,detail}.ts` |
| Web shared | `apps/web-app/src/shared/{preset-i18n,category-icons,tool-config-types}.ts` |
| Bot | `apps/discord-worker/src/commands/schemas.ts`, `src/types/preset.ts` |

---

## 2. The three new categories

Confirmed in the design turn as `6a`/`6b`/`6c`. Enum values, in the order they
join `CATEGORY_ORDER`:

| Value | Label | Glyph | Rationale (from the design) |
|---|---|---|---|
| `appearance` | Appearance | head in profile, one eye filled | Where the Swatch tool's *Make a palette* lands. Profile, not front-facing, so it cannot collide with the Swatch tool's own front-facing bust; profile also settles the fill, since **one** eye is correct in profile where a front view would need two. |
| `zones` | Zones | two-summit ridgeline, baseline, bare filled disc | Two summits, not one — a single peak is a mountain and the category is *places*. The disc has **no rays**; rays are what make a disc a sun, and that is the only reason it can share a set with the events burst. The baseline is load-bearing: without it the ridge reads as a chart. |
| `raids-trials` | Raids & Trials | crossed blades with guards, no fill | Crossed weapons only became free this session — they were the old jobs icon, and jobs is now one upright staff. The two differ by **orientation**, which is the difference that survives 16 px. |

**Naming constraints carried from the design, not negotiable in copy:**

- The enum value is `appearance`, **not** `character` — `kind: 'character'`
  remains the `CollectionService` record type. Two different things; any doc
  naming them must disambiguate in the same sentence.
- `zones` is the game's own word, so no localised name has to invent one.
- Primals are **descriptions inside** `raids-trials`, not a row of their own —
  that keeps every primal name out of the enum, where each would have needed six
  locale strings and a glyph. Dungeons stay excluded, so the copy **must not say
  "duties"**.

### Explicitly not in this change

- **Six expansion categories** (`expansion-arr` … `expansion-dt`) are decided
  *as categories* but their mark is deferred at `6d`. They cannot ship ahead of
  that verdict. The enum goes 5 → 8 here, not 5 → 14.
- **Housing** was declined.
- `pastel` / `dark` / `monochrome` are **computed filters derived from the
  dyes**, never declared values. That rule is what keeps the enum a list of
  subjects; do not add them as categories.

### Glyph geometry

32 × 32 grid, stroke-width 2.4, `fill="none" stroke="currentColor"`,
`stroke-linecap`/`stroke-linejoin` round. Fills in the category set are **ink,
not accent** — the repo's existing `INK` sentinel, not the `F` accent sentinel
every other set uses. `raids-trials` carries no fill at all, on the
`aesthetics` precedent.

```ts
appearance:
  '<path d="M9.6 23.4 C6.6 17.4 7.4 9.4 13.6 5.4 C19.2 1.8 24.8 5.4 24.8 11.8 C24.8 14 24.2 15 24 15.8 L27 19.6 L22.2 21 V23.4 C22.2 26 20.4 27.6 17.4 27.6 H12 C10.6 27.6 9.6 26.4 9.6 25 Z"/><circle cx="20.4" cy="13.2" r="1.9" fill="INK" stroke="none"/>',
zones:
  '<path d="M3.6 25.8 H28.4"/><path d="M4.8 25.8 L11.8 12.4 L17 19.8 L21.2 14.4 L27.2 25.8"/><circle cx="24.4" cy="7.4" r="2.6" fill="INK" stroke="none"/>',
'raids-trials':
  '<path d="M7 26.6 L25 8.6"/><path d="M7.9 21.5 L12.1 25.7"/><path d="M25 26.6 L7 8.6"/><path d="M19.9 25.7 L24.1 21.5"/>',
```

The design keys these `g.appearance` / `g.zones` / `g.raids`; the repo keys
`CATEGORY` by category id, so the third becomes `'raids-trials'` — the
`'grand-companies'` precedent.

### Two exhaustive Records police this

`CATEGORY_LABEL_KEYS: Record<PresetCategoryFilter, string>` and
`CATEGORY: Record<CategoryGlyphName, string>` are total maps. Widening the union
without adding a label and a glyph is a **compile error**, not a
`preset.categories.undefined` string in the UI. Do not relax either to
`Partial`.

### Discord emoji

`categories.icon` (D1) and `CATEGORY_META` (discord-worker) carry emoji, separate
from the SVG glyphs:

| Value | Emoji |
|---|---|
| `appearance` | 👤 |
| `zones` | 🏔️ |
| `raids-trials` | 🗡️ |

`raids-trials` takes 🗡️ rather than ⚔️ because `jobs` still holds ⚔️. The design
retired crossed swords *from jobs* (jobs is now an upright staff), so ⚔️ arguably
belongs here and `jobs` should move to a staff emoji — deliberately **out of
scope**, noted as a follow-up rather than folded into this change.

---

## 3. Multi-category data model

### Storage

```sql
ALTER TABLE presets ADD COLUMN secondary_categories TEXT NOT NULL DEFAULT '[]';
```

`category_id` is unchanged — same FK, same indexes, same meaning: the primary
category. Additive, no backfill, no consumer breaks. A junction table was
rejected: it makes `SELECT *` stop yielding a whole preset, forces categories to
be injected into `rowToPreset`, turns create/edit into multi-statement batches
and needs a backfill — all for at most three values from a closed vocabulary.

The three new categories are seeded in the same migration, and mirrored into
`schema.sql` for fresh databases:

```sql
INSERT OR IGNORE INTO categories (id, name, description, icon, is_curated, display_order) VALUES
  ('appearance',   'Appearance',     'Palettes built around a character''s own colours', '👤',  1, 6),
  ('zones',        'Zones',          'Palettes drawn from the places of Eorzea',         '🏔️', 1, 7),
  ('raids-trials', 'Raids & Trials', 'Palettes from raid and trial encounters',          '🗡️', 1, 8);
```

### Types

| Type | Change |
|---|---|
| `PresetCategory` | `+ 'appearance' \| 'zones' \| 'raids-trials'` |
| `PresetCategoryFilter` (web) | same three |
| `CategoryGlyphName` | same three |
| `PresetRow` | `secondary_categories: string` |
| `CommunityPreset` | `secondary_categories: PresetCategory[]`, `preview_image_status: 'none' \| 'pending' \| 'approved'` |
| `PresetSubmission` | `secondary_categories?: PresetCategory[]` |
| `PresetEditRequest` | `category_id?`, `secondary_categories?` — **both new**; the edit request has no category field at all today |

`CommunityPreset` is declared twice — `packages/types/src/preset/community.ts`
and a local copy in `apps/web-app/src/services/community-preset-service.ts`.
Both need the new fields.

`rowToPreset` parses `secondary_categories` alongside `tags`, but **degrades to
`[]` on corruption rather than throwing**. It is supplementary metadata like
`previous_values`, not load-bearing like `dyes`.

### Validation

New `validateSecondaryCategories` in `validation-service.ts`:

- at most **2** entries
- each a real category id (same DB-backed check the primary uses)
- no duplicates within the array
- **must not contain the primary**

### Filtering

Category filtering matches either slot:

```sql
WHERE category_id = ?1
   OR EXISTS (SELECT 1 FROM json_each(secondary_categories) WHERE value = ?1)
```

The same predicate replaces `LEFT JOIN presets p ON p.category_id = c.id` in
both handlers of `categories.ts`, so counts agree with what clicking a chip
returns.

**Verify D1 exposes JSON1 before committing to `json_each`.** Fallback:
`secondary_categories LIKE '%"jobs"%'` — safe here only because no category id
is a substring of another, and the JSON quotes make the match unambiguous.
Re-check that property if a future category id is ever added that violates it.

### Gallery behaviour

The rail matches primary **and** secondary. Counts therefore sum to more than
the total, which is inherent to multi-category and reads correctly as "presets
tagged Zones". This is the point of secondary categories: a Yuletide Dark Knight
palette is findable from both shelves.

The rail grows from 6 chips to 9 (`all` + 8). `.cat-row` is already
`flex-wrap`, so it wraps without layout work.

### Category changes do not re-moderate

A closed 8-value vocabulary has no free text. `moderateContent` continues to run
only on `name` / `description`. Changing the primary category on an approved
preset is allowed and silent.

---

## 4. Preview-image editing

### Model: image-only gate

Uploading or replacing a picture leaves the preset's own `status` untouched. The
preset stays live in the gallery showing its previous image (or the palette
treatment); only the *new* image is withheld until approved.

The alternative — flipping `status` to `pending` — was rejected: it takes a
popular preset offline as a consequence of adding a picture, which is a strong
incentive never to add one.

### Closing the queue hole

Today a pending image **never reaches the moderator queue**:
`getPendingPresets()` filters `WHERE status = 'pending'`, and an image upload
only sets `preview_image_status`. The sole path to a moderator is a
fire-and-forget Discord embed; if that notification fails the image is invisible
forever.

```sql
WHERE status = 'pending' OR preview_image_status = 'pending'
```

The moderator route decorates those rows with `pending_preview_image_url` built
**in the handler** — moderator-scoped and additive, so `rowToPreset`'s gate is
untouched. The R2 object is already publicly readable and the discord-worker
embed links it directly; the gate is about not advertising an unreviewed image,
not about secrecy.

`preview_image_status` joins the serialized preset. A status label leaks
nothing, and it is what lets the edit form say "under review" and My Submissions
explain itself. **The gate in `rowToPreset` — `preview_image_url` serialized
only when status is `approved` — does not move.**

### New route

`DELETE /api/v1/presets/:id/preview-image` — author-only (moderators already
have reject, which deletes).

```
-> getPresetImageState(db, id)      404 if absent, 403 if not author
-> status 'none'?                   200 no-op (idempotent)
-> UPDATE preview_image_key = NULL, preview_image_status = 'none'
-> R2 delete inside try/catch
-> 200 { success: true, preview_image_status: 'none' }
```

DB write **before** the R2 delete, matching every other path in this file and
for the same reason: a failed delete orphans an invisible object, while the
reverse leaves a row pointing at a key that no longer exists and an approved
card 404s on every view. Never trade a broken live image for a tidy bucket.

### State machine

```
upload / replace ─► preview_image_status: none|approved → pending
                    status: UNCHANGED
                    ⇒ enters queue via the OR clause

remove ──────────► preview_image_status: * → none, key → NULL, R2 delete
                    status: UNCHANGED
                    ⇒ leaves the queue

moderator approve ► preview_image_status → approved   (existing route)
moderator reject ─► preview_image_status → none       (existing route)
```

### "Auto-pass" is emergent, not coded

Removal clears the only condition the image contributes to the queue predicate.
A preset that is *also* `status='pending'` for flagged text stays queued,
because the other half of the `OR` is still true — which is exactly "assuming
all other checks pass".

No `pending_reason` column, and **content moderation is not re-run on removal**.
That is deliberate: re-running it would let an author launder flagged text by
attaching and removing a picture.

Removing an *approved* image is instant and unreviewed. It is content-reducing,
so this is correct, but it does mean an author can quietly pull a picture a
moderator approved.

---

## 5. Web app

### Category selector — one component, both forms

The existing 5-chip grid becomes 8, with selection **order** carrying rank:

```
[⚔ Jobs ①]  [🏛 Grand Companies]  [🌸 Seasons ②]
[🎉 Events] [✨ Aesthetics ③]     [👤 Appearance]
[🏔 Zones]  [🗡 Raids & Trials]

① filled with --theme-primary    ②③ outlined in the accent
Hint: "First pick is the primary category. Up to 2 more, optional."
Clicking a selected chip removes it and re-ranks the rest.
```

Honest and affordance-free — to change the primary you deselect and re-pick. No
star toggle, no drag handle, nothing to explain.

This **replaces** `createCategoryDisplay` in `preset-edit-form.ts` (the
read-only field labelled `preset.categoryLocked`) and **extends**
`createCategorySelector` in `preset-submission-form.ts`.

### Preview-image field (edit form)

| `preview_image_status` | Shows |
|---|---|
| `approved` | thumbnail + **Replace** / **Remove** |
| `pending` | "Image under review" + **Replace** / **Remove** |
| `none` | file picker, same 5 MB / PNG-JPEG-WebP guard as the submission form |

Save runs the `PATCH` first, then the image call — the same two-step the
submission form already does after create, and with the same rule: **a failed
image call warns, it does not fail the edit.**

**Skip the `PATCH` entirely when no field changed.** The image lives on its own
routes, so an edit that only swaps or removes the picture has nothing to send —
and an empty body would come back as `400 No updates provided`, surfacing as a
spurious error on an operation that succeeded. The form compares its state
against the preset it opened with and issues only the calls that have work:
zero, one or both.

### Gallery

- `UnifiedPreset` gains `secondaryCategories: PresetCategory[]`
- `currentPool()` and `categoryCount()` test primary-or-secondary
- all three `*ToUnified` mappers carry it through
- `SavedPreset` snapshots it, so the offline shelf filters consistently
- `preset-detail.ts` renders secondary badges beside the primary one

### i18n — 6 locales

New keys: `preset.categories.appearance`, `.zones`, `.raidsTrials`; the selector
hint; the five preview-image states. `preset.categoryLocked` retires.

Locale keys are camelCase while wire values are kebab-case — hence
`raidsTrials` for `raids-trials`, matching `grandCompanies`.

---

## 6. Testing

The highest-value test is unchanged from the thumbnails spec and now needs a
**regression guard**, because this change adds a sibling field right next to it:
`preview_image_url` must be absent unless `preview_image_status === 'approved'`.

**presets-api**
- secondary categories: cap of 2, duplicates, collision with primary, unknown id
- filter matches a secondary-only preset; category counts include it
- `DELETE preview-image`: author-only (403), idempotent on `none`, clears key
- `getPendingPresets` includes an approved preset whose image is pending
- `PATCH` accepts `category_id` / `secondary_categories`; both satisfy the
  "no updates provided" guard
- all three new category ids validate on submit

**packages/svg**
- the three new glyphs render, use `INK` not accent, and `raids-trials` has no
  fill — the existing `GLYPH_SETS` parity test covers presence for free

**web-app**
- selector ranking: first pick primary, cap at 3, re-rank on deselect
- rail count includes secondary matches
- edit form renders the correct image affordance per status

No E2E — the image paths need live R2, and that flake is not worth buying.

---

## 7. Rollout

Ordered; each step depends on the last.

1. **Migration `0010` by hand on production D1, before any deploy.**
   ```bash
   cd apps/presets-api
   npx wrangler d1 execute xivdyetools-presets --remote \
     --file=./migrations/0010_add_secondary_categories.sql
   ```
   `pnpm db:migrate` **cannot** do this — `schema.sql` is all
   `CREATE TABLE IF NOT EXISTS`, so on a live D1 every statement is skipped and
   the script exits 0 having changed nothing. That is how `example_link` and
   `previous_values` went missing.

   Verify with a **single-row aggregate**, never a column list — a truncated
   list read as complete is how two columns were wrongly reported missing during
   the 2026-08-10 investigation:
   ```bash
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT SUM(name='secondary_categories') AS c FROM pragma_table_info('presets');"
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT COUNT(*) AS n FROM categories WHERE id IN ('appearance','zones','raids-trials');"
   ```
   Expect `0` then `1`, and `0` then `3`.

2. **Deploy `presets-api`** — needs an explicit `--env production`; a bare
   `deploy` targets the dev worker. Check `wrangler.toml`, the flag is not
   uniform across workers.

3. **Deploy `discord-worker`**, then run `register-commands` — the `/preset`
   category choices changed, and unregistered choices are invisible in Discord.

4. **Deploy `web-app` last.**

`@xivdyetools/types` and `@xivdyetools/svg` resolve via `workspace:*`, so their
version bumps and npm publishes are housekeeping, not a deploy gate.

---

## 8. Open questions deliberately closed

| Question | Ruling |
|---|---|
| Should a category change re-queue the preset? | No — closed vocabulary, nothing to moderate. |
| Should removing an approved image need review? | No — content-reducing. |
| Should removal re-run content moderation? | No — it would let an author launder flagged text. |
| Should counts be deduped so they sum to the total? | No — they would contradict the result list after a click. |
| Should the six expansion categories ship here? | No — mark deferred at `6d`. |
| Should `pastel` / `dark` / `monochrome` be categories? | No — computed filters derived from the dyes. |
| Should `jobs` give up ⚔️ to `raids-trials`? | Out of scope; `raids-trials` takes 🗡️. Follow-up. |
