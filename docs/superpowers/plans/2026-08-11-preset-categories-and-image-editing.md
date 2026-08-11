# Preset Categories & Preview-Image Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a preset author set 1 primary + up to 2 secondary categories, add three new categories (`appearance` / `zones` / `raids-trials`), and upload, replace or remove the preview picture from the edit form.

**Architecture:** `category_id` stays the primary category — same FK, same indexes — and a new `secondary_categories` JSON column carries the extras, so nothing that reads `category_id` changes. Preview-image edits gate the *image* only: the preset's own `status` is never touched, and the moderator queue widens to `status = 'pending' OR preview_image_status = 'pending'` so a pending image is finally visible there.

**Tech Stack:** pnpm 11 + Turborepo monorepo; TypeScript 5.9 strict with `verbatimModuleSyntax`; Cloudflare Workers + Hono + D1 (presets-api); Vite + Lit + imperative-DOM modals (web-app); Vitest 4 everywhere.

**Spec:** `docs/superpowers/specs/2026-08-11-preset-categories-and-image-editing-design.md`

## Global Constraints

- **Repo root for all commands:** `c:\dev\XIVProjects\xivdyetools`. Branch: `monorepo-2.0-prep`.
- **`verbatimModuleSyntax` is on.** A symbol used only as a type MUST be imported with `import type`. A plain `import { Foo }` for a type-only use is a compile error.
- **The enum grows 5 → 8. No more.** The six `expansion-*` categories are deferred pending glyph verdict `6d`; `housing` was declined; `pastel` / `dark` / `monochrome` are computed filters derived from dyes and must never become enum values.
- **The value is `appearance`, never `character`** — `kind: 'character'` is already the `CollectionService` record type.
- **`raids-trials` copy must never say "duties".** Dungeons are excluded. Primals are descriptions inside this category, not a category.
- **Category-set glyph fills use the `INK` sentinel, not the ` F ` accent sentinel.** `raids-trials` has no fill at all.
- **The moderation gate does not move.** `rowToPreset` serializes `preview_image_url` only when `preview_image_status === 'approved'`. Any moderator-only pending URL is built in the handler, never in `rowToPreset`.
- **DB write before R2 delete, always.** A failed delete orphans an invisible object; the reverse leaves a row pointing at a missing key and an approved card 404s.
- **Six locales, always all six:** `en`, `ja`, `de`, `fr`, `ko`, `zh`.
- **Migrations are run by hand.** `pnpm db:migrate` cannot alter an existing table — `schema.sql` is all `CREATE TABLE IF NOT EXISTS` and exits 0 having changed nothing.
- **Commit after every task.** Do not squash tasks together.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `apps/presets-api/migrations/0010_add_secondary_categories.sql` | Column + three seeded category rows |
| `apps/web-app/src/components/preset-category-selector.ts` | The one category selector, shared by both forms |
| `apps/web-app/src/components/__tests__/preset-category-selector.test.ts` | Selector ranking / cap / re-rank behaviour |

**Modified**

| Path | Change |
|---|---|
| `packages/types/src/preset/core.ts` | `PresetCategory` + 3 |
| `packages/types/src/preset/community.ts` | `secondary_categories`, `preview_image_status`, submission field |
| `packages/types/src/preset/request.ts` | `PresetEditRequest` gains `category_id`, `secondary_categories` |
| `packages/svg/src/icons/tool-icons.ts` | `CategoryGlyphName` + 3, `CATEGORY` + 3 geometries |
| `packages/svg/src/icons/tool-icons.test.ts` | Roster count 6 → 9 |
| `packages/test-utils/src/factories/preset.ts` | `PresetRow.secondary_categories` default |
| `apps/presets-api/schema.sql` | Column + seed rows for fresh DBs |
| `apps/presets-api/src/types.ts` | `PresetRow.secondary_categories` |
| `apps/presets-api/src/services/validation-service.ts` | `validateSecondaryCategories` |
| `apps/presets-api/src/services/preset-service.ts` | Parse/persist/filter + widened queue |
| `apps/presets-api/src/handlers/presets.ts` | POST/PATCH fields, DELETE preview-image |
| `apps/presets-api/src/handlers/categories.ts` | Counts include secondary matches |
| `apps/web-app/src/shared/tool-config-types.ts` | `PresetCategoryFilter` + 3 |
| `apps/web-app/src/shared/preset-i18n.ts` | 3 label keys |
| `apps/web-app/src/shared/category-icons.ts` | 3 icons |
| `apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json` | Category labels + selector/image strings |
| `apps/web-app/src/services/preset-submission-service.ts` | `VALID_CATEGORIES`, edit fields, `deletePreviewImage` |
| `apps/web-app/src/services/community-preset-service.ts` | Local `CommunityPreset` copy gains the fields |
| `apps/web-app/src/services/hybrid-preset-service.ts` | `UnifiedPreset.secondaryCategories` |
| `apps/web-app/src/services/saved-presets-service.ts` | `SavedPreset.secondaryCategories` |
| `apps/web-app/src/components/preset-edit-form.ts` | Selector + image field + call orchestration |
| `apps/web-app/src/components/preset-submission-form.ts` | Shared selector |
| `apps/web-app/src/components/v4/preset-tool.ts` | `CATEGORY_ORDER`, filter, counts, mappers |
| `apps/web-app/src/components/v4/preset-detail.ts` | Secondary badges |
| `apps/discord-worker/src/commands/schemas.ts` | 3 choices |
| `apps/discord-worker/src/types/preset.ts` | 3 `CATEGORY_DISPLAY` entries |
| `apps/discord-worker/src/commands/registry.test.ts` | Expected choice list |

---

## Task 1: Widen `PresetCategory` and the preset interfaces

**Files:**
- Modify: `packages/types/src/preset/core.ts:12-18`
- Modify: `packages/types/src/preset/community.ts:37-130`
- Modify: `packages/types/src/preset/request.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `PresetCategory = 'jobs' | 'grand-companies' | 'seasons' | 'events' | 'aesthetics' | 'appearance' | 'zones' | 'raids-trials'`
  - `CommunityPreset.secondary_categories: PresetCategory[]`
  - `CommunityPreset.preview_image_status: 'none' | 'pending' | 'approved'`
  - `PresetSubmission.secondary_categories?: PresetCategory[]`
  - `PresetEditRequest.category_id?: PresetCategory`
  - `PresetEditRequest.secondary_categories?: PresetCategory[]`

- [ ] **Step 1: Widen the union**

In `packages/types/src/preset/core.ts`, replace the `PresetCategory` declaration:

```ts
/**
 * Preset palette category identifiers.
 *
 * The last three joined in the 2026-08-11 change (design `6a`/`6b`/`6c`).
 * `appearance` is deliberately NOT `character` — `kind: 'character'` is the
 * CollectionService record type, a different thing entirely.
 * `raids-trials` excludes dungeons; primals are descriptions inside it, not a
 * category of their own, so no copy anywhere may call this "duties".
 */
export type PresetCategory =
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'appearance'
  | 'zones'
  | 'raids-trials';
```

- [ ] **Step 2: Add the CommunityPreset fields**

In `packages/types/src/preset/community.ts`, immediately after the `category_id` field of `CommunityPreset`:

```ts
  /**
   * Up to two additional categories. `category_id` remains the primary; these
   * never contain it, and the gallery matches a preset on either slot.
   */
  secondary_categories: PresetCategory[];
```

And after the existing `preview_image_url` field in the same interface:

```ts
  /**
   * Moderation state of the uploaded picture. Safe to serialize everywhere —
   * it is a status label, not a URL, and it is what lets the edit form say
   * "under review". The URL itself stays gated on 'approved'.
   */
  preview_image_status: 'none' | 'pending' | 'approved';
```

- [ ] **Step 3: Add the PresetSubmission field**

In the same file, after `category_id` in `PresetSubmission`:

```ts
  /** Optional: up to two additional categories, never containing category_id */
  secondary_categories?: PresetCategory[];
```

- [ ] **Step 4: Add the PresetEditRequest fields**

In `packages/types/src/preset/request.ts`, inside `PresetEditRequest`:

```ts
  /** New primary category (the edit form unlocked this in 5.1) */
  category_id?: PresetCategory;

  /** Replacement secondary list; `[]` clears it */
  secondary_categories?: PresetCategory[];
```

- [ ] **Step 5: Type-check**

Run: `pnpm turbo run type-check --filter=@xivdyetools/types`
Expected: PASS.

- [ ] **Step 6: Build the whole workspace to surface the exhaustive-Record failures**

Run: `pnpm turbo run type-check`
Expected: **FAIL**, and this is the point. The two total `Record`s reject the widened union:
- `packages/svg/src/icons/tool-icons.ts` — `CATEGORY: Record<CategoryGlyphName, string>` (only once Task 2 widens `CategoryGlyphName`; it is a separate union, so it may not fail yet)
- `apps/web-app/src/shared/preset-i18n.ts` — `CATEGORY_LABEL_KEYS: Record<PresetCategoryFilter, string>` (fails once Task 10 widens `PresetCategoryFilter`)
- `apps/discord-worker/src/types/preset.ts` — `CATEGORY_DISPLAY: Record<PresetCategory, …>` — **this one fails now**

Record which files failed. Tasks 2, 10 and 15 fix them. Do not patch them here.

- [ ] **Step 7: Commit**

```bash
git add packages/types/src/preset/
git commit -m "feat(types): add appearance/zones/raids-trials and multi-category fields"
```

---

## Task 2: Add the three category glyphs

**Files:**
- Modify: `packages/svg/src/icons/tool-icons.ts:80-86` (union), `:221-234` (geometry)
- Test: `packages/svg/src/icons/tool-icons.test.ts:30`

**Interfaces:**
- Consumes: nothing from Task 1 (`CategoryGlyphName` is its own union).
- Produces: `categoryGlyph('appearance' | 'zones' | 'raids-trials', options)` returns an SVG string; `GLYPH_SETS.category` has 9 entries.

- [ ] **Step 1: Write the failing test**

In `packages/svg/src/icons/tool-icons.test.ts`, change the roster assertion on line 30 and add a new `it` block after it:

```ts
    expect(GLYPH_SETS.category).toHaveLength(9); // eight categories + default
```

```ts
  it('the three 2026-08-11 categories render on the category set conventions', () => {
    // Fills in this set are INK, not accent — a flag is not a colour.
    for (const name of ['appearance', 'zones'] as const) {
      const svg = categoryGlyph(name, { ink: '#101010' });
      expect(svg, name).toContain('fill="#101010"');
      expect(svg, name).not.toContain(GLYPH_ACCENT_DARK);
      expect(svg, name).toContain('stroke-width="2.4"');
    }
    // raids-trials carries no fill at all, on the aesthetics precedent.
    const raids = categoryGlyph('raids-trials', { ink: '#101010' });
    expect(raids).not.toContain('fill="#101010"');
    expect(raids).toContain('<g fill="none"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @xivdyetools/svg exec vitest run src/icons/tool-icons.test.ts`
Expected: FAIL — `expected 6 to be 9`, plus a TypeScript error that `'appearance'` is not assignable to `CategoryGlyphName`.

- [ ] **Step 3: Widen `CategoryGlyphName`**

In `packages/svg/src/icons/tool-icons.ts`, replace the declaration at line 80:

```ts
export type CategoryGlyphName =
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'appearance'
  | 'zones'
  | 'raids-trials'
  | 'default';
```

- [ ] **Step 4: Add the geometry**

In the `CATEGORY` record, after the `aesthetics` entry and before `default`:

```ts
  // Turn 23 (design 6a/6b/6c). Fills here are INK, not accent — the category
  // set's convention. A head in PROFILE, so it cannot collide with the Swatch
  // tool's front-facing bust; profile is also why one eye is correct where a
  // front view would need two.
  appearance:
    '<path d="M9.6 23.4 C6.6 17.4 7.4 9.4 13.6 5.4 C19.2 1.8 24.8 5.4 24.8 11.8 C24.8 14 24.2 15 24 15.8 L27 19.6 L22.2 21 V23.4 C22.2 26 20.4 27.6 17.4 27.6 H12 C10.6 27.6 9.6 26.4 9.6 25 Z"/><circle cx="20.4" cy="13.2" r="1.9" fill="INK" stroke="none"/>',
  // TWO summits — one peak is a mountain, and the category is places. The disc
  // is bare: rays are what make a disc a sun, and that is the only reason this
  // can share a set with the events burst. The baseline is not decoration —
  // without it the ridge reads as a chart.
  zones:
    '<path d="M3.6 25.8 H28.4"/><path d="M4.8 25.8 L11.8 12.4 L17 19.8 L21.2 14.4 L27.2 25.8"/><circle cx="24.4" cy="7.4" r="2.6" fill="INK" stroke="none"/>',
  // Crossed blades, no fill (the aesthetics precedent). Crossed weapons only
  // became free when jobs became one upright staff; the two differ by
  // ORIENTATION, which is the difference that survives 16 px.
  'raids-trials':
    '<path d="M7 26.6 L25 8.6"/><path d="M7.9 21.5 L12.1 25.7"/><path d="M25 26.6 L7 8.6"/><path d="M19.9 25.7 L24.1 21.5"/>',
```

- [ ] **Step 5: Update the doc comment**

Replace the `categoryGlyph` docblock at line 309:

```ts
/** Render a preset-category glyph (eight categories, eight icons, + default). */
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @xivdyetools/svg exec vitest run src/icons/tool-icons.test.ts`
Expected: PASS. The pre-existing suite-wide assertions (`no <symbol>/<use>`, `no leftover INK`, `no opacity`, `fill="none"` on the group) now cover the three new glyphs for free.

- [ ] **Step 7: Build and commit**

```bash
pnpm turbo run build test --filter=@xivdyetools/svg
git add packages/svg/src/icons/
git commit -m "feat(svg): add appearance/zones/raids-trials category glyphs"
```

---

## Task 3: Migration, schema, row type, test factory

**Files:**
- Create: `apps/presets-api/migrations/0010_add_secondary_categories.sql`
- Modify: `apps/presets-api/schema.sql:18-23` (seed), `:49-51` (columns)
- Modify: `apps/presets-api/src/types.ts:87-107`
- Modify: `packages/test-utils/src/factories/preset.ts:31-107`

**Interfaces:**
- Consumes: `PresetCategory` from Task 1.
- Produces: `PresetRow.secondary_categories: string` (a JSON array string, never null — the column is `NOT NULL DEFAULT '[]'`). `createMockPresetRow()` defaults it to `'[]'`.

- [ ] **Step 1: Write the migration**

Create `apps/presets-api/migrations/0010_add_secondary_categories.sql`:

```sql
-- Multi-category presets + the three categories confirmed in the Turn 23
-- design pass (6a appearance / 6b zones / 6c raids-trials).
-- See docs/superpowers/specs/2026-08-11-preset-categories-and-image-editing-design.md
--
-- Run (deploy window), BEFORE deploying the new presets-api:
--   wrangler d1 execute xivdyetools-presets --remote --file=migrations/0010_add_secondary_categories.sql
--
-- `npm run db:migrate` will NOT apply this: schema.sql is all
-- CREATE TABLE IF NOT EXISTS, so it skips the existing table and exits 0.

-- category_id stays the PRIMARY category (FK and indexes untouched); this
-- column carries up to two more. NOT NULL with a default so every existing
-- row is valid immediately and no backfill is needed.
ALTER TABLE presets ADD COLUMN secondary_categories TEXT NOT NULL DEFAULT '[]';

INSERT OR IGNORE INTO categories (id, name, description, icon, is_curated, display_order) VALUES
  ('appearance',   'Appearance',     'Palettes built around a character''s own colours', '👤', 1, 6),
  ('zones',        'Zones',          'Palettes drawn from the places of Eorzea',         '🏔️', 1, 7),
  ('raids-trials', 'Raids & Trials', 'Palettes from raid and trial encounters',          '🗡️', 1, 8);
```

- [ ] **Step 2: Mirror into `schema.sql` for fresh databases**

In `apps/presets-api/schema.sql`, extend the seed `INSERT` (line 18-23) so it ends:

```sql
  ('aesthetics', 'Aesthetics', 'General aesthetic themes', '✨', 1, 5),
  ('appearance', 'Appearance', 'Palettes built around a character''s own colours', '👤', 1, 6),
  ('zones', 'Zones', 'Palettes drawn from the places of Eorzea', '🏔️', 1, 7),
  ('raids-trials', 'Raids & Trials', 'Palettes from raid and trial encounters', '🗡️', 1, 8);
```

And add the column to the `presets` table definition, after `preview_image_status`:

```sql
  preview_image_status TEXT NOT NULL DEFAULT 'none',
  -- Up to two additional categories; category_id remains the primary
  secondary_categories TEXT NOT NULL DEFAULT '[]',
```

- [ ] **Step 3: Add the row field**

In `apps/presets-api/src/types.ts`, inside `PresetRow`, after `preview_image_status`:

```ts
  secondary_categories: string; // JSON array of PresetCategory; never null
```

- [ ] **Step 4: Update the shared test factory**

In `packages/test-utils/src/factories/preset.ts`, add to the `PresetRow` interface after `preview_image_status`:

```ts
  secondary_categories: string; // JSON string
```

and to the object returned by `createMockPresetRow`, after `preview_image_status: 'none',`:

```ts
    secondary_categories: '[]',
```

- [ ] **Step 5: Type-check both packages**

Run: `pnpm turbo run type-check --filter=@xivdyetools/test-utils --filter=xivdyetools-presets-api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/presets-api/migrations/0010_add_secondary_categories.sql apps/presets-api/schema.sql apps/presets-api/src/types.ts packages/test-utils/src/factories/preset.ts
git commit -m "feat(presets-api): migration 0010 — secondary_categories column + three categories"
```

---

## Task 4: `validateSecondaryCategories`

**Files:**
- Modify: `apps/presets-api/src/services/validation-service.ts`
- Test: `apps/presets-api/tests/services/validation-service.test.ts` (create if absent)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export const SECONDARY_CATEGORY_MAX = 2;
  export function validateSecondaryCategories(
    value: unknown,
    primary: string,
    validCategories: readonly string[]
  ): string | null
  ```
  Returns an error string, or `null` when valid. `undefined` is valid (field is optional).

- [ ] **Step 1: Write the failing test**

Create or append to `apps/presets-api/tests/services/validation-service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateSecondaryCategories,
  SECONDARY_CATEGORY_MAX,
} from '../../src/services/validation-service';

const VALID = ['jobs', 'seasons', 'events', 'aesthetics', 'appearance', 'zones', 'raids-trials'];

describe('validateSecondaryCategories', () => {
  it('accepts undefined — the field is optional', () => {
    expect(validateSecondaryCategories(undefined, 'jobs', VALID)).toBeNull();
  });

  it('accepts an empty array — that is how a caller clears the list', () => {
    expect(validateSecondaryCategories([], 'jobs', VALID)).toBeNull();
  });

  it('accepts up to the cap', () => {
    expect(validateSecondaryCategories(['seasons', 'zones'], 'jobs', VALID)).toBeNull();
    expect(SECONDARY_CATEGORY_MAX).toBe(2);
  });

  it('rejects more than the cap', () => {
    const error = validateSecondaryCategories(['seasons', 'zones', 'events'], 'jobs', VALID);
    expect(error).toContain('at most 2');
  });

  it('rejects a non-array', () => {
    expect(validateSecondaryCategories('seasons', 'jobs', VALID)).toContain('must be an array');
  });

  it('rejects an unknown category id', () => {
    expect(validateSecondaryCategories(['dungeons'], 'jobs', VALID)).toContain('Invalid');
  });

  it('rejects duplicates within the list', () => {
    expect(validateSecondaryCategories(['zones', 'zones'], 'jobs', VALID)).toContain('duplicate');
  });

  it('rejects the primary appearing as a secondary', () => {
    expect(validateSecondaryCategories(['jobs'], 'jobs', VALID)).toContain('primary');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/services/validation-service.test.ts`
Expected: FAIL — `validateSecondaryCategories is not a function`.

- [ ] **Step 3: Implement**

In `apps/presets-api/src/services/validation-service.ts`, add to `PRESET_VALIDATION_RULES` after the `tags` block:

```ts
  secondaryCategories: {
    maxLength: 2,
  },
```

Then add this function at the end of the "Preset-Specific Validators" section (immediately after `validatePresetTags`):

```ts
/** Cap on additional categories. One primary + this many = three total. */
export const SECONDARY_CATEGORY_MAX = PRESET_VALIDATION_RULES.secondaryCategories.maxLength;

/**
 * Validate the secondary category list.
 *
 * `undefined` is valid — the field is optional on both submit and edit. `[]`
 * is valid and is how a caller clears the list. The primary is passed in
 * because a category may not occupy both slots: it would double-count in the
 * gallery rail and read as a data error to anyone looking at the row.
 *
 * @param value - candidate list
 * @param primary - the preset's category_id after this request applies
 * @param validCategories - ids from getValidCategories(db)
 * @returns Error message or null if valid
 */
export function validateSecondaryCategories(
  value: unknown,
  primary: string,
  validCategories: readonly string[]
): string | null {
  if (value === undefined) return null;

  if (!Array.isArray(value)) {
    return 'Secondary categories must be an array';
  }

  if (value.length > SECONDARY_CATEGORY_MAX) {
    return `At most ${SECONDARY_CATEGORY_MAX} secondary categories allowed`;
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || !validCategories.includes(entry)) {
      return 'Invalid secondary category';
    }
    if (entry === primary) {
      return 'A secondary category cannot repeat the primary category';
    }
  }

  if (new Set(value as string[]).size !== value.length) {
    return 'Secondary categories contain a duplicate';
  }

  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/services/validation-service.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/presets-api/src/services/validation-service.ts apps/presets-api/tests/services/validation-service.test.ts
git commit -m "feat(presets-api): validateSecondaryCategories with cap, dupe and primary-collision rules"
```

---

## Task 5: Parse, serialize and persist the new columns

**Files:**
- Modify: `apps/presets-api/src/services/preset-service.ts:51-104` (`rowToPreset`), `:277-332` (`createPreset`), `:454-520` (`updatePreset`)
- Test: `apps/presets-api/tests/services/preset-service.test.ts`

**Interfaces:**
- Consumes: `PresetRow.secondary_categories` (Task 3); `CommunityPreset.secondary_categories` / `.preview_image_status` (Task 1).
- Produces: `rowToPreset` returns both new fields; `createPreset(db, submission, authorDiscordId, authorName, status)` persists `submission.secondary_categories ?? []`; `updatePreset(db, id, updates, previousValues?, newStatus?)` persists `updates.category_id` and `updates.secondary_categories` when present.

- [ ] **Step 1: Write the failing tests**

Append to `apps/presets-api/tests/services/preset-service.test.ts`:

```ts
describe('secondary categories and preview_image_status', () => {
  it('rowToPreset parses the JSON list', () => {
    const preset = rowToPreset(
      createMockPresetRow({ secondary_categories: '["zones","events"]' })
    );
    expect(preset.secondary_categories).toEqual(['zones', 'events']);
  });

  it('rowToPreset degrades corrupt secondary_categories to [] instead of throwing', () => {
    // Supplementary metadata, unlike `dyes` — a bad value must not hide the preset.
    const preset = rowToPreset(createMockPresetRow({ secondary_categories: '{not json' }));
    expect(preset.secondary_categories).toEqual([]);
  });

  it('rowToPreset degrades a non-array JSON value to []', () => {
    const preset = rowToPreset(createMockPresetRow({ secondary_categories: '"zones"' }));
    expect(preset.secondary_categories).toEqual([]);
  });

  it('rowToPreset surfaces preview_image_status but still gates the URL', () => {
    const pending = rowToPreset(
      createMockPresetRow({ preview_image_status: 'pending', preview_image_key: 'p/a.webp' })
    );
    expect(pending.preview_image_status).toBe('pending');
    expect(pending.preview_image_url).toBeNull();

    const approved = rowToPreset(
      createMockPresetRow({ preview_image_status: 'approved', preview_image_key: 'p/a.webp' })
    );
    expect(approved.preview_image_status).toBe('approved');
    expect(approved.preview_image_url).toBe('https://shots.xivdyetools.app/p/a.webp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/services/preset-service.test.ts -t "secondary categories"`
Expected: FAIL — `expected undefined to equal [ 'zones', 'events' ]`.

- [ ] **Step 3: Parse in `rowToPreset`**

In `apps/presets-api/src/services/preset-service.ts`, after the `previous_values` parsing block and before the `return`:

```ts
  // Supplementary metadata, like previous_values — degrade to [] rather than
  // throw. A corrupt list must not make the preset disappear from the gallery.
  let secondary_categories: CommunityPreset['secondary_categories'] = [];
  if (row.secondary_categories) {
    try {
      const parsed = JSON.parse(row.secondary_categories) as unknown;
      if (Array.isArray(parsed)) {
        secondary_categories = parsed as CommunityPreset['secondary_categories'];
      } else {
        (logger ?? console).error(
          `[BUG-012] Preset ${row.id}: 'secondary_categories' is not an array, defaulting to []`
        );
      }
    } catch {
      (logger ?? console).error(
        `[BUG-012] Preset ${row.id}: invalid JSON in 'secondary_categories', defaulting to []`
      );
    }
  }
```

Then add to the returned object, immediately after `category_id`:

```ts
    secondary_categories,
```

and immediately after the `preview_image_url` entry (leave the gate comment and expression exactly as they are):

```ts
    // The STATUS is safe to expose everywhere — it is a label, not a URL, and
    // it is what lets an author's own view say "under review".
    preview_image_status: (row.preview_image_status ??
      'none') as CommunityPreset['preview_image_status'],
```

- [ ] **Step 4: Persist on create**

In `createPreset`, change the INSERT column list and placeholders:

```ts
  const query = `
    INSERT INTO presets (
      id, name, description, category_id, dyes, tags,
      author_discord_id, author_name, vote_count, status, is_curated,
      created_at, updated_at, dye_signature, example_link, secondary_categories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?)
  `;
```

Add the bind after `submission.example_link ?? null`:

```ts
      JSON.stringify(submission.secondary_categories ?? [])
```

And add to the returned object, after `category_id: submission.category_id,`:

```ts
    secondary_categories: submission.secondary_categories ?? [],
```

plus, after `example_link: submission.example_link ?? null,`:

```ts
    preview_image_status: 'none',
```

- [ ] **Step 5: Persist on update**

In `updatePreset`, add these two blocks after the `updates.example_link` block:

```ts
  if (updates.category_id !== undefined) {
    setClauses.push('category_id = ?');
    params.push(updates.category_id);
  }

  if (updates.secondary_categories !== undefined) {
    setClauses.push('secondary_categories = ?');
    params.push(JSON.stringify(updates.secondary_categories));
  }
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/services/preset-service.test.ts`
Expected: PASS, whole file.

- [ ] **Step 7: Commit**

```bash
git add apps/presets-api/src/services/preset-service.ts apps/presets-api/tests/services/preset-service.test.ts
git commit -m "feat(presets-api): parse, serialize and persist secondary_categories"
```

---

## Task 6: Category filtering and counts match secondary slots

**Files:**
- Modify: `apps/presets-api/src/services/preset-service.ts:151-155` (`getPresets`)
- Modify: `apps/presets-api/src/handlers/categories.ts:32-45`, `:96-109`
- Test: `apps/presets-api/tests/handlers/presets.test.ts`, `apps/presets-api/tests/handlers/categories.test.ts`

**Interfaces:**
- Consumes: the `secondary_categories` column (Task 3).
- Produces: no new exports. `GET /presets?category=X` and both `/categories` routes match a preset whose *secondary* list contains `X`.

**Note on binding:** the spec writes the predicate with a numbered `?1`. Use **two positional binds** instead — `getPresets` builds `params` by pushing in order, and mixing `?` with `?1` in one SQLite statement is legal but a trap for the next editor.

- [ ] **Step 1: Write the failing tests**

In `apps/presets-api/tests/handlers/presets.test.ts`, add after the existing `'should filter by category'` test:

```ts
        it('matches a secondary category, not just the primary', async () => {
            mockDb._setupMock(() => []);

            await app.request('/api/v1/presets?category=zones', {}, env);

            const sql = mockDb._queries.join(' ');
            expect(sql).toContain('json_each');
            // Bound twice: once for the primary comparison, once inside json_each
            const zonesBinds = mockDb._bindings
                .flat()
                .filter((b) => b === 'zones');
            expect(zonesBinds).toHaveLength(2);
        });
```

In `apps/presets-api/tests/handlers/categories.test.ts`, add inside the top-level describe:

```ts
    it('counts a preset under its secondary categories too', async () => {
        mockDb._setupMock(() => []);

        await app.request('/api/v1/categories', {}, env);

        expect(mockDb._queries.join(' ')).toContain('json_each');
    });
```

`_queries: string[]` and `_bindings: unknown[][]` are both on the shared mock (`packages/test-utils/src/cloudflare/d1.ts:111-114`) and stay index-aligned, so both assertions above are valid as written.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/handlers/presets.test.ts tests/handlers/categories.test.ts -t "secondary"`
Expected: FAIL — the SQL contains no `json_each`.

- [ ] **Step 3: Widen the list filter**

In `apps/presets-api/src/services/preset-service.ts`, replace the `if (category)` block inside `getPresets`:

```ts
  if (category) {
    // A preset is "in" a category if it is the primary OR appears in the
    // secondary list. Bound twice rather than as ?1: this query builds its
    // params positionally, and mixing ? with ?1 is a trap for the next editor.
    conditions.push(
      '(category_id = ? OR EXISTS (SELECT 1 FROM json_each(presets.secondary_categories) WHERE value = ?))'
    );
    params.push(category, category);
  }
```

The out-of-range-page `COUNT(*)` fallback reuses `whereClause` and `params`, so it stays correct with no further change.

- [ ] **Step 4: Widen both category-count queries**

In `apps/presets-api/src/handlers/categories.ts`, in `fetchAllCategories` replace the JOIN line:

```sql
    FROM categories c
    LEFT JOIN presets p ON (
      p.category_id = c.id
      OR EXISTS (SELECT 1 FROM json_each(p.secondary_categories) WHERE value = c.id)
    )
```

Apply the identical replacement in the `GET /:id` handler's query.

Add this comment above `fetchAllCategories`:

```ts
/**
 * Execute D1 query for the full category list.
 * Extracted so it can be deduplicated via pendingCategoryListFetch.
 *
 * The JOIN matches primary OR secondary, so counts agree with what clicking a
 * chip actually returns. They therefore sum to MORE than the preset total —
 * that is inherent to multi-category and is the intended reading ("presets
 * tagged Zones"), not a bug to normalise away.
 */
```

- [ ] **Step 5: Run the full presets-api suite**

Run: `pnpm --filter xivdyetools-presets-api run test -- --run`
Expected: PASS. If any pre-existing test asserted an exact SQL string for these queries, update that assertion to match the new predicate.

- [ ] **Step 6: Commit**

```bash
git add apps/presets-api/src/services/preset-service.ts apps/presets-api/src/handlers/categories.ts apps/presets-api/tests/
git commit -m "feat(presets-api): category filter and counts match secondary categories"
```

---

## Task 7: Accept category fields on submit and edit

**Files:**
- Modify: `apps/presets-api/src/handlers/presets.ts:320-336` (PATCH guard), `:810-873` (validators)
- Test: `apps/presets-api/tests/handlers/presets.test.ts`

**Interfaces:**
- Consumes: `validateSecondaryCategories` (Task 4), `getValidCategories` (existing).
- Produces: `validateEditRequest` becomes **async** and takes `(body, currentCategoryId, db)` — the current id supplies the primary when the request does not change it.

**Do not touch the moderation trigger.** The PATCH handler runs `moderateContent` under `if (body.name || body.description)`. A category is a closed 8-value vocabulary with no free text, so a category-only edit must NOT re-queue the preset. Leaving that condition exactly as written is what implements that rule — there is no code to add.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('PATCH /api/v1/presets/:id')` block in `apps/presets-api/tests/handlers/presets.test.ts` (mirror the auth-header setup the neighbouring PATCH tests already use):

```ts
        it('accepts a category change with secondary categories', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) {
                    return [{ id: 'jobs' }, { id: 'zones' }, { id: 'events' }, { id: 'aesthetics' }];
                }
                return [{ ...row, category_id: 'jobs', secondary_categories: '["zones"]' }];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...authHeaders('123456789') },
                    body: JSON.stringify({ category_id: 'jobs', secondary_categories: ['zones'] }),
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('rejects a secondary category that repeats the primary', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) return [{ id: 'jobs' }, { id: 'zones' }];
                return [row];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...authHeaders('123456789') },
                    body: JSON.stringify({ category_id: 'jobs', secondary_categories: ['jobs'] }),
                },
                env
            );

            expect(res.status).toBe(400);
        });

        it('a category-only edit is not "No updates provided"', async () => {
            const row = createMockPresetRow({ author_discord_id: '123456789', status: 'approved' });
            mockDb._setupMock((sql: string) => {
                if (sql.includes('FROM categories')) return [{ id: 'jobs' }, { id: 'zones' }];
                return [row];
            });

            const res = await app.request(
                `/api/v1/presets/${row.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...authHeaders('123456789') },
                    body: JSON.stringify({ secondary_categories: [] }),
                },
                env
            );

            expect(res.status).toBe(200);
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/handlers/presets.test.ts -t "category"`
Expected: FAIL — the category-only edit returns 400 "No updates provided".

- [ ] **Step 3: Import the new validator**

In `apps/presets-api/src/handlers/presets.ts`, add to the existing import from `../services/validation-service.js`:

```ts
  validateSecondaryCategories,
```

- [ ] **Step 4: Extend the PATCH guard**

Replace the "Check if any updates provided" block:

```ts
  // Check if any updates provided
  if (
    !body.name &&
    !body.description &&
    !body.dyes &&
    !body.tags &&
    body.example_link === undefined &&
    body.category_id === undefined &&
    body.secondary_categories === undefined
  ) {
    return validationErrorResponse(c, 'No updates provided');
  }
```

- [ ] **Step 5: Make `validateEditRequest` async and category-aware**

Replace the whole `validateEditRequest` function:

```ts
/**
 * Validate preset edit request (all fields optional)
 * PRESETS-REF-001 FIX: Uses centralized validators from validation-service
 *
 * Async because category validation is DB-backed, exactly like validateSubmission.
 * `currentCategoryId` supplies the primary when the request does not change it —
 * otherwise adding a secondary equal to the unchanged primary would slip through.
 */
async function validateEditRequest(
  body: PresetEditRequest,
  currentCategoryId: string,
  db: D1Database
): Promise<string | null> {
  // All fields optional for edit, but validate if provided
  if (body.name !== undefined) {
    const nameError = validatePresetName(body.name);
    if (nameError) return nameError;
  }

  if (body.description !== undefined) {
    const descError = validatePresetDescription(body.description);
    if (descError) return descError;
  }

  if (body.dyes !== undefined) {
    const dyesError = validatePresetDyes(body.dyes);
    if (dyesError) return dyesError;
  }

  if (body.tags !== undefined) {
    const tagsError = validatePresetTags(body.tags);
    if (tagsError) return tagsError;
  }

  if (body.example_link !== undefined) {
    const linkError = validateExampleLink(body.example_link);
    if (linkError) return linkError;
    body.example_link = normalizeExampleLink(body.example_link);
  }

  if (body.category_id !== undefined || body.secondary_categories !== undefined) {
    const validCategories = await getValidCategories(db);

    if (body.category_id !== undefined && !validCategories.includes(body.category_id)) {
      return 'Invalid category';
    }

    const effectivePrimary = body.category_id ?? currentCategoryId;
    const secondaryError = validateSecondaryCategories(
      body.secondary_categories,
      effectivePrimary,
      validCategories
    );
    if (secondaryError) return secondaryError;
  }

  return null;
}
```

- [ ] **Step 6: Await it at the call site**

In the PATCH handler, replace the validation call:

```ts
  // Validate provided fields
  const validationError = await validateEditRequest(body, preset.category_id, c.env.DB);
  if (validationError) {
    return validationErrorResponse(c, validationError);
  }
```

- [ ] **Step 7: Validate secondaries on submit**

In `validateSubmission`, replace the category block:

```ts
  // PRESETS-CRITICAL-002: Validate category against database
  if (!body.category_id) return 'Category is required';
  const validCategories = await getValidCategories(db);
  if (!validCategories.includes(body.category_id)) {
    return 'Invalid category';
  }

  const secondaryError = validateSecondaryCategories(
    body.secondary_categories,
    body.category_id,
    validCategories
  );
  if (secondaryError) return secondaryError;
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter xivdyetools-presets-api run test -- --run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/presets-api/src/handlers/presets.ts apps/presets-api/tests/handlers/presets.test.ts
git commit -m "feat(presets-api): accept category_id and secondary_categories on submit and edit"
```

---

## Task 8: `DELETE /presets/:id/preview-image`

**Files:**
- Modify: `apps/presets-api/src/handlers/presets.ts` (after the POST preview-image route, ~line 800)
- Test: `apps/presets-api/tests/handlers/presets.test.ts`

**Interfaces:**
- Consumes: `getPresetImageState`, `deletePreviewImage` (both already imported in this file).
- Produces: `DELETE /api/v1/presets/:id/preview-image` → `200 { success: true, preview_image_status: 'none' }`; `403` for a non-author; `404` for an unknown preset.

- [ ] **Step 1: Write the failing tests**

Append to `apps/presets-api/tests/handlers/presets.test.ts`:

```ts
    describe('DELETE /api/v1/presets/:id/preview-image', () => {
        it('clears the key and status for the author', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: 'p1/a.webp', name: 'Test' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true, preview_image_status: 'none' });
            expect(mockDb._queries.join(' ')).toContain('preview_image_key = NULL');
        });

        it('refuses a non-author', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '999999999', preview_image_key: 'p1/a.webp', name: 'Test' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(403);
        });

        it('404s an unknown preset', async () => {
            mockDb._setupMock(() => []);

            const res = await app.request(
                '/api/v1/presets/nope/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(404);
        });

        it('is idempotent when there is no image', async () => {
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: null, name: 'Test' },
            ]);

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(200);
        });

        it('still succeeds when the R2 delete throws', async () => {
            // The DB already reflects the removal; an R2 hiccup must not 500 a
            // request whose state is already correct.
            mockDb._setupMock(() => [
                { author_discord_id: '123456789', preview_image_key: 'p1/a.webp', name: 'Test' },
            ]);
            (env.THUMBNAILS as unknown as MockR2Bucket).delete = () => {
                throw new Error('R2 down');
            };

            const res = await app.request(
                '/api/v1/presets/p1/preview-image',
                { method: 'DELETE', headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(200);
        });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/handlers/presets.test.ts -t "DELETE /api/v1/presets/:id/preview-image"`
Expected: FAIL — 404 from Hono, the route does not exist.

- [ ] **Step 3: Implement the route**

In `apps/presets-api/src/handlers/presets.ts`, immediately after the `POST /:id/preview-image` handler:

```ts
/**
 * DELETE /:id/preview-image — the author removes their card picture.
 *
 * Author-only; a moderator removing an image uses the existing reject action,
 * which is an act of moderation and belongs in the moderation log.
 *
 * The preset's own `status` is deliberately untouched. Clearing the image
 * clears the only condition the picture contributes to the moderation queue
 * predicate, so a preset queued *solely* for its image leaves the queue here,
 * while one that is also `status = 'pending'` for flagged text correctly stays.
 * That is what "auto-pass assuming all other checks pass" means, and it needs
 * no state of its own.
 *
 * Content moderation is NOT re-run: doing so would let an author launder
 * flagged text by attaching and removing a picture.
 */
presetsRouter.delete('/:id/preview-image', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');
  const presetId = c.req.param('id');

  // Row-level read: CommunityPreset hides preview_image_key by design.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  if (preset.author_discord_id !== auth.userDiscordId) {
    return forbiddenResponse(c, 'Only the author can remove the preview image');
  }

  // Idempotent: nothing to remove is a success, not a 404. The client may be
  // retrying, and the end state it asked for already holds.
  const previousKey = preset.preview_image_key;

  // DB UPDATE before the R2 delete, as everywhere else in this file: a failed
  // delete orphans an invisible object, while the reverse leaves a row pointing
  // at a key that no longer exists.
  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ?`
  )
    .bind(new Date().toISOString(), presetId)
    .run();

  try {
    await deletePreviewImage(c.env, previousKey);
  } catch (err) {
    console.error(`[preview-image] R2 delete failed after author removal: id=${presetId}`, err);
  }

  return c.json({ success: true, preview_image_status: 'none' });
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter xivdyetools-presets-api run test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/presets-api/src/handlers/presets.ts apps/presets-api/tests/handlers/presets.test.ts
git commit -m "feat(presets-api): author route to remove a preview image"
```

---

## Task 9: Widen the moderator queue

**Files:**
- Modify: `apps/presets-api/src/services/preset-service.ts:393-401` (`getPendingPresets`)
- Test: `apps/presets-api/tests/handlers/moderation.test.ts`

**Interfaces:**
- Consumes: `PREVIEW_IMAGE_PUBLIC_BASE` (already in this module).
- Produces:
  ```ts
  export type ModerationQueueEntry = CommunityPreset & { pending_preview_image_url: string | null };
  export function getPendingPresets(db, logger?): Promise<ModerationQueueEntry[]>
  ```
  `getPendingPresets` is imported only by `handlers/moderation.ts`, so widening its return type is contained.

- [ ] **Step 1: Write the failing test**

Append to `apps/presets-api/tests/handlers/moderation.test.ts`, inside the pending-queue describe:

```ts
        it('includes an approved preset whose image is awaiting review', async () => {
            mockDb._setupMock(() => [
                createMockPresetRow({
                    status: 'approved',
                    preview_image_status: 'pending',
                    preview_image_key: 'p1/a.webp',
                }),
            ]);

            const res = await app.request(
                '/api/v1/moderation/pending',
                { headers: { ...authHeaders('123456789') } },
                env
            );

            expect(res.status).toBe(200);
            expect(mockDb._queries.join(' ')).toContain("preview_image_status = 'pending'");

            const body = (await res.json()) as {
                presets: Array<{ preview_image_url: string | null; pending_preview_image_url: string | null }>;
            };
            // The gate holds: the public URL stays null for an unapproved image...
            expect(body.presets[0].preview_image_url).toBeNull();
            // ...and the moderator gets the pending URL from a separate field.
            expect(body.presets[0].pending_preview_image_url).toBe(
                'https://shots.xivdyetools.app/p1/a.webp'
            );
        });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-presets-api exec vitest run tests/handlers/moderation.test.ts -t "awaiting review"`
Expected: FAIL — the SQL has no `preview_image_status` clause and `pending_preview_image_url` is undefined.

- [ ] **Step 3: Replace `getPendingPresets`**

In `apps/presets-api/src/services/preset-service.ts`, replace the whole function and add the type above it:

```ts
/**
 * A moderation-queue row: the preset plus the unapproved image URL.
 *
 * The pending URL is built HERE and not in rowToPreset, so the gate in
 * rowToPreset — `preview_image_url` only when status is 'approved' — remains
 * the single rule governing every public path. This field only ever reaches a
 * moderator-guarded route. The R2 object is already publicly readable and the
 * discord-worker embed links it directly; the gate is about not advertising an
 * unreviewed image, not about secrecy.
 */
export type ModerationQueueEntry = CommunityPreset & {
  pending_preview_image_url: string | null;
};

/**
 * Get the moderation queue.
 *
 * Two reasons a preset needs a moderator: its own content is pending, or it
 * carries an image awaiting review. Before this widened, an uploaded image
 * NEVER appeared here — the only signal was a fire-and-forget Discord embed,
 * so a dropped notification meant an image nobody would ever review.
 */
export async function getPendingPresets(
  db: D1Database,
  logger?: PresetServiceLogger
): Promise<ModerationQueueEntry[]> {
  const query = `
    SELECT * FROM presets
    WHERE status = 'pending' OR preview_image_status = 'pending'
    ORDER BY created_at ASC
  `;
  const result = await db.prepare(query).all<PresetRow>();
  return (result.results || []).flatMap((row) => {
    try {
      return [
        {
          ...rowToPreset(row, logger),
          pending_preview_image_url:
            row.preview_image_status === 'pending' && row.preview_image_key
              ? `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}`
              : null,
        },
      ];
    } catch (error) {
      (logger ?? console).error(`[BUG-012] Skipping corrupted preset row id=${row.id}:`, error);
      return [];
    }
  });
}
```

- [ ] **Step 4: Run the full suite**

Run: `pnpm --filter xivdyetools-presets-api run test -- --run && pnpm --filter xivdyetools-presets-api run type-check`
Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add apps/presets-api/src/services/preset-service.ts apps/presets-api/tests/handlers/moderation.test.ts
git commit -m "fix(presets-api): pending preview images now reach the moderator queue"
```

---

## Task 10: Web-app shared category constants and locales

**Files:**
- Modify: `apps/web-app/src/shared/tool-config-types.ts:179-180`
- Modify: `apps/web-app/src/shared/preset-i18n.ts:58-65`
- Modify: `apps/web-app/src/shared/category-icons.ts:26-32`
- Modify: `apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json`

**Interfaces:**
- Consumes: `categoryGlyph` names from Task 2.
- Produces: `PresetCategoryFilter` includes the three new values; `presetCategoryLabel()` and `getCategoryIcon()` answer for them; locale keys `preset.categories.appearance` / `.zones` / `.raidsTrials` plus the selector and preview-image strings used by Tasks 11–13.

- [ ] **Step 1: Widen `PresetCategoryFilter`**

In `apps/web-app/src/shared/tool-config-types.ts`:

```ts
export type PresetCategoryFilter =
  | 'all'
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'appearance'
  | 'zones'
  | 'raids-trials';
```

- [ ] **Step 2: Run type-check to see the exhaustive Record fail**

Run: `pnpm --filter xivdyetools-web-app run type-check`
Expected: **FAIL** in `preset-i18n.ts` — `Property 'appearance' is missing in type … but required in type 'Record<PresetCategoryFilter, string>'`. This is the guard doing its job.

- [ ] **Step 3: Add the label keys**

In `apps/web-app/src/shared/preset-i18n.ts`, extend `CATEGORY_LABEL_KEYS`:

```ts
  aesthetics: 'preset.categories.aesthetics',
  appearance: 'preset.categories.appearance',
  zones: 'preset.categories.zones',
  'raids-trials': 'preset.categories.raidsTrials',
};
```

- [ ] **Step 4: Add the icons**

In `apps/web-app/src/shared/category-icons.ts`, extend `CATEGORY_ICONS`:

```ts
  aesthetics: glyph('aesthetics'),
  appearance: glyph('appearance'),
  zones: glyph('zones'),
  'raids-trials': glyph('raids-trials'),
};
```

and update the module docblock's parenthetical to `(jobs = mage's staff, grand-companies = flag, seasons = quartered disc, events = five-ray, aesthetics = hanger, appearance = head in profile, zones = ridgeline, raids-trials = crossed blades)` and the line `five categories, five icons` to `eight categories, eight icons`.

- [ ] **Step 5: Add the locale strings — English**

In `apps/web-app/src/locales/en.json`, extend `preset.categories` (line ~1287) and add the new sibling keys under `preset`:

```json
    "categories": {
      "all": "All",
      "jobs": "Jobs",
      "grandCompanies": "Grand Companies",
      "seasons": "Seasons",
      "events": "Events",
      "aesthetics": "Aesthetics",
      "appearance": "Appearance",
      "zones": "Zones",
      "raidsTrials": "Raids & Trials"
    },
```

```json
    "categoryHint": "First pick is the primary category. Up to 2 more, optional.",
    "categoryPrimaryBadge": "PRIMARY",
    "categoryMaxReached": "Up to 3 categories — remove one first",
    "categoryNeedsOne": "A preset needs at least one category",
    "previewImageCurrent": "Current picture",
    "previewImageReplace": "Replace",
    "previewImageRemove": "Remove",
    "previewImageUnderReview": "Image under review",
    "previewImageRemoved": "Picture removed",
    "previewImageRemoveFailed": "Could not remove the picture",
    "previewImagePendingReview": "Picture uploaded — it appears once a moderator approves it",
    "noChanges": "No changes to save",
```

- [ ] **Step 6: Add the same keys to the other five locales**

Same key placement in each file. Values:

| Key | ja | de | fr | ko | zh |
|---|---|---|---|---|---|
| `categories.appearance` | 外見 | Aussehen | Apparence | 외형 | 外观 |
| `categories.zones` | エリア | Gebiete | Zones | 지역 | 地区 |
| `categories.raidsTrials` | レイド・討伐戦 | Raids & Prüfungen | Raids et Défis | 레이드 및 토벌전 | 副本与讨伐战 |
| `categoryHint` | 最初に選んだものが主カテゴリーです。追加は2つまで（任意）。 | Die erste Wahl ist die Hauptkategorie. Bis zu 2 weitere, optional. | Le premier choix est la catégorie principale. Jusqu'à 2 autres, facultatif. | 처음 선택한 것이 기본 카테고리입니다. 최대 2개 더 추가할 수 있습니다(선택). | 第一个选择的是主分类。最多可再添加2个（可选）。 |
| `categoryPrimaryBadge` | メイン | HAUPT | PRINCIPAL | 기본 | 主要 |
| `categoryMaxReached` | カテゴリーは3つまでです。先に1つ解除してください | Bis zu 3 Kategorien — zuerst eine entfernen | Jusqu'à 3 catégories — retirez-en une d'abord | 카테고리는 최대 3개입니다. 먼저 하나를 해제하세요 | 最多3个分类，请先移除一个 |
| `categoryNeedsOne` | カテゴリーは少なくとも1つ必要です | Ein Preset braucht mindestens eine Kategorie | Un préréglage doit avoir au moins une catégorie | 프리셋에는 카테고리가 하나 이상 필요합니다 | 预设至少需要一个分类 |
| `previewImageCurrent` | 現在の画像 | Aktuelles Bild | Image actuelle | 현재 이미지 | 当前图片 |
| `previewImageReplace` | 差し替え | Ersetzen | Remplacer | 교체 | 替换 |
| `previewImageRemove` | 削除 | Entfernen | Retirer | 삭제 | 移除 |
| `previewImageUnderReview` | 画像は審査中です | Bild wird geprüft | Image en cours d'examen | 이미지 검토 중 | 图片审核中 |
| `previewImageRemoved` | 画像を削除しました | Bild entfernt | Image retirée | 이미지를 삭제했습니다 | 已移除图片 |
| `previewImageRemoveFailed` | 画像を削除できませんでした | Bild konnte nicht entfernt werden | Impossible de retirer l'image | 이미지를 삭제하지 못했습니다 | 无法移除图片 |
| `noChanges` | 保存する変更はありません | Keine Änderungen zu speichern | Aucune modification à enregistrer | 저장할 변경 사항이 없습니다 | 没有需要保存的更改 |
| `previewImagePendingReview` | 画像をアップロードしました。承認後に表示されます | Bild hochgeladen — es erscheint nach der Freigabe | Image envoyée — elle apparaîtra après validation | 이미지를 업로드했습니다. 승인 후 표시됩니다 | 图片已上传，审核通过后显示 |

- [ ] **Step 7: Validate locale completeness and type-check**

Run: `pnpm --filter xivdyetools-web-app run validate:i18n && pnpm --filter xivdyetools-web-app run type-check`
Expected: PASS both. `validate:i18n` fails loudly if any of the six files is missing a key.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/shared/ apps/web-app/src/locales/
git commit -m "feat(web-app): category labels, icons and strings for the three new categories"
```

---

## Task 11: The shared category selector

**Files:**
- Create: `apps/web-app/src/components/preset-category-selector.ts`
- Test: `apps/web-app/src/components/__tests__/preset-category-selector.test.ts`

**Interfaces:**
- Consumes: `getCategoryIcon` and `presetCategoryLabel` (Task 10).
- Produces:
  ```ts
  export interface CategorySelection { primary: PresetCategory; secondary: PresetCategory[]; }
  export const SELECTABLE_CATEGORIES: readonly PresetCategory[];
  export const MAX_CATEGORIES = 3;
  export function createCategorySelector(
    selection: CategorySelection,
    onChange?: () => void
  ): HTMLElement;
  ```
  The element mutates `selection` in place on every click, so callers read `selection.primary` / `selection.secondary` at submit time. Tasks 12 and 14 consume this.

- [ ] **Step 1: Write the failing test**

Create `apps/web-app/src/components/__tests__/preset-category-selector.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  createCategorySelector,
  SELECTABLE_CATEGORIES,
  MAX_CATEGORIES,
  type CategorySelection,
} from '../preset-category-selector';

function chips(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll('button[data-category]'));
}

function chipFor(el: HTMLElement, category: string): HTMLButtonElement {
  const chip = chips(el).find((b) => b.dataset.category === category);
  if (!chip) throw new Error(`no chip for ${category}`);
  return chip;
}

describe('preset category selector', () => {
  it('offers all eight submittable categories and no "all" pseudo-category', () => {
    expect(SELECTABLE_CATEGORIES).toHaveLength(8);
    expect(SELECTABLE_CATEGORIES).toContain('appearance');
    expect(SELECTABLE_CATEGORIES).toContain('zones');
    expect(SELECTABLE_CATEGORIES).toContain('raids-trials');
    expect(SELECTABLE_CATEGORIES as readonly string[]).not.toContain('all');
  });

  it('marks the initial primary with rank 1', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);
    expect(chipFor(el, 'jobs').dataset.rank).toBe('1');
  });

  it('an unselected chip becomes the next secondary, in click order', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);

    chipFor(el, 'zones').click();
    chipFor(el, 'events').click();

    expect(selection.primary).toBe('jobs');
    expect(selection.secondary).toEqual(['zones', 'events']);
    expect(chipFor(el, 'zones').dataset.rank).toBe('2');
    expect(chipFor(el, 'events').dataset.rank).toBe('3');
  });

  it('caps at three and leaves the selection untouched past the cap', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: ['zones', 'events'] };
    const el = createCategorySelector(selection);

    chipFor(el, 'seasons').click();

    expect(MAX_CATEGORIES).toBe(3);
    expect(selection.secondary).toEqual(['zones', 'events']);
    expect(chipFor(el, 'seasons').dataset.rank).toBeUndefined();
  });

  it('removing the primary promotes the next in line', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: ['zones', 'events'] };
    const el = createCategorySelector(selection);

    chipFor(el, 'jobs').click();

    expect(selection.primary).toBe('zones');
    expect(selection.secondary).toEqual(['events']);
  });

  it('refuses to remove the last remaining category', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);

    chipFor(el, 'jobs').click();

    expect(selection.primary).toBe('jobs');
    expect(selection.secondary).toEqual([]);
  });

  it('notifies on every change', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const onChange = vi.fn();
    const el = createCategorySelector(selection, onChange);

    chipFor(el, 'zones').click();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/preset-category-selector.test.ts`
Expected: FAIL — cannot resolve `../preset-category-selector`.

- [ ] **Step 3: Implement**

Create `apps/web-app/src/components/preset-category-selector.ts`:

```ts
/**
 * XIV Dye Tools - Preset Category Selector
 *
 * One control, used by both the submission and the edit form. A preset carries
 * a primary category and up to two secondary ones, and rank is carried by
 * SELECTION ORDER: the first chip you pick is the primary, the next two are
 * secondary in the order you picked them.
 *
 * That is deliberately affordance-free — no star toggle, no drag handle. To
 * change the primary you deselect and re-pick, and removing the primary
 * promotes the next in line rather than leaving the preset category-less.
 *
 * @module components/preset-category-selector
 */

import { LanguageService, ToastService } from '@services/index';
import { getCategoryIcon } from '@shared/category-icons';
import { presetCategoryLabel } from '@shared/preset-i18n';
import type { PresetCategory } from '@xivdyetools/types';

/** A preset's categories: one primary, up to MAX_CATEGORIES - 1 secondary. */
export interface CategorySelection {
  primary: PresetCategory;
  secondary: PresetCategory[];
}

/**
 * Submittable categories in display order. The `all` pseudo-category of the
 * gallery rail is a filter, never a value a preset can carry, so it is absent.
 */
export const SELECTABLE_CATEGORIES: readonly PresetCategory[] = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'appearance',
  'zones',
  'raids-trials',
];

/** One primary + two secondary. */
export const MAX_CATEGORIES = 3;

const CHIP_BASE =
  'px-3 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-1 relative';

export function createCategorySelector(
  selection: CategorySelection,
  onChange?: () => void
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-3 gap-2';

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-muted)';
  hint.textContent = LanguageService.t('preset.categoryHint');

  // Rank is the single source of truth while the control is open; index 0 is
  // the primary. `selection` is written back on every change so the caller can
  // simply read it at submit time.
  let ordered: PresetCategory[] = [selection.primary, ...selection.secondary];

  function commit(): void {
    const [primary, ...secondary] = ordered;
    // ordered can never be empty — toggle() refuses to remove the last entry.
    selection.primary = primary as PresetCategory;
    selection.secondary = secondary;
    render();
    onChange?.();
  }

  function toggle(category: PresetCategory): void {
    const index = ordered.indexOf(category);

    if (index === -1) {
      if (ordered.length >= MAX_CATEGORIES) {
        ToastService.warning(LanguageService.t('preset.categoryMaxReached'));
        return;
      }
      ordered = [...ordered, category];
      commit();
      return;
    }

    if (ordered.length === 1) {
      // A preset must always carry a category; removing the only one would
      // leave it unfiled with no way back except re-picking.
      ToastService.warning(LanguageService.t('preset.categoryNeedsOne'));
      return;
    }

    // Removing the primary promotes whatever was next — the list stays ranked.
    ordered = ordered.filter((c) => c !== category);
    commit();
  }

  function render(): void {
    grid.replaceChildren();

    for (const category of SELECTABLE_CATEGORIES) {
      const rank = ordered.indexOf(category);
      const isPrimary = rank === 0;
      const isSelected = rank !== -1;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = CHIP_BASE;
      btn.dataset.category = category;
      if (isSelected) btn.dataset.rank = String(rank + 1);

      if (isPrimary) {
        btn.style.cssText =
          'background-color: var(--theme-primary); color: white; border-color: var(--theme-primary);';
        btn.title = LanguageService.t('preset.categoryPrimaryBadge');
      } else if (isSelected) {
        btn.style.cssText =
          'background-color: color-mix(in srgb, var(--theme-primary) 14%, transparent); color: var(--theme-primary); border-color: color-mix(in srgb, var(--theme-primary) 45%, transparent);';
      } else {
        btn.style.cssText =
          'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
      }

      const icon = document.createElement('span');
      icon.className = 'w-4 h-4 inline-block';
      // Static, code-defined SVG — see the security note in category-icons.ts.
      icon.innerHTML = getCategoryIcon(category);

      const label = document.createElement('span');
      label.textContent = presetCategoryLabel(category);

      btn.appendChild(icon);
      btn.appendChild(label);

      if (isSelected) {
        const badge = document.createElement('span');
        badge.style.cssText =
          "font-family: 'Fragment Mono', monospace; font-size: 9px; opacity: 0.85; margin-left: 2px;";
        badge.textContent = String(rank + 1);
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => toggle(category));
      grid.appendChild(btn);
    }
  }

  render();

  wrapper.appendChild(grid);
  wrapper.appendChild(hint);
  return wrapper;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/preset-category-selector.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/src/components/preset-category-selector.ts apps/web-app/src/components/__tests__/preset-category-selector.test.ts
git commit -m "feat(web-app): shared 1-primary + 2-secondary category selector"
```

---

## Task 12: Service layer — categories and image removal

**Files:**
- Modify: `apps/web-app/src/services/preset-submission-service.ts:16-53` (types), `:79-85` (`VALID_CATEGORIES`), `:154-185` (image fns), `:225-232` (submit body), `:518-523` (edit body)
- Modify: `apps/web-app/src/services/community-preset-service.ts:17-37`

**Interfaces:**
- Consumes: `PresetCategory` (Task 1).
- Produces:
  - `PresetSubmission.secondary_categories?: PresetCategory[]`
  - `PresetEditRequest.category_id?`, `.secondary_categories?`
  - `export async function removePreviewImage(presetId: string): Promise<void>`
  - Web-local `CommunityPreset` gains `secondary_categories?: PresetCategory[]` and `preview_image_status?: 'none' | 'pending' | 'approved'`

- [ ] **Step 1: Extend the web-local `CommunityPreset`**

In `apps/web-app/src/services/community-preset-service.ts`, inside the interface after `category_id`:

```ts
  /** Up to two additional categories; never contains category_id */
  secondary_categories?: PresetCategory[];
```

and after `preview_image_url`:

```ts
  /** Moderation state of the uploaded picture (the URL stays gated on 'approved') */
  preview_image_status?: 'none' | 'pending' | 'approved';
```

- [ ] **Step 2: Extend the request types**

In `apps/web-app/src/services/preset-submission-service.ts`, add to `PresetSubmission`:

```ts
  /** Up to two additional categories; must not repeat category_id */
  secondary_categories?: PresetCategory[];
```

and to `PresetEditRequest`:

```ts
  /** New primary category — the edit form unlocked this in 5.1 */
  category_id?: PresetCategory;
  /** Replacement secondary list; `[]` clears it */
  secondary_categories?: PresetCategory[];
```

- [ ] **Step 3: Widen `VALID_CATEGORIES`**

```ts
const VALID_CATEGORIES: PresetCategory[] = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'appearance',
  'zones',
  'raids-trials',
];
```

- [ ] **Step 4: Send the field on submit**

In `submitPreset`, add to the JSON body after `category_id`:

```ts
          secondary_categories: submission.secondary_categories ?? [],
```

- [ ] **Step 5: Send the fields on edit**

In `editPreset`, add to the body-building block after the `tags` line:

```ts
      if (updates.category_id !== undefined) body.category_id = updates.category_id;
      if (updates.secondary_categories !== undefined) {
        body.secondary_categories = updates.secondary_categories;
      }
      // example_link was already accepted by the API but never sent — the edit
      // form set it and it was silently dropped on every save.
      if (updates.example_link !== undefined) body.example_link = updates.example_link;
```

- [ ] **Step 6: Add `removePreviewImage`**

Immediately after `uploadPreviewImage`:

```ts
/**
 * Remove the preview image from a preset the signed-in user authored.
 *
 * Idempotent server-side: removing an image that is not there is a success,
 * because the end state the caller asked for already holds.
 */
export async function removePreviewImage(presetId: string): Promise<void> {
  const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/${presetId}/preview-image`, {
    method: 'DELETE',
    headers: {
      ...authService.getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error('Preview image removal failed');
  }
}
```

- [ ] **Step 7: Type-check and run the service tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/preset-submission-service.test.ts && pnpm --filter xivdyetools-web-app run type-check`
Expected: PASS both.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/services/preset-submission-service.ts apps/web-app/src/services/community-preset-service.ts
git commit -m "feat(web-app): service support for multi-category and preview-image removal"
```

---

## Task 13: Edit form — categories and preview image

**Files:**
- Modify: `apps/web-app/src/components/preset-edit-form.ts` (whole file: state, `createFormContent`, remove `createCategoryDisplay`, new image field, submit orchestration)

**Interfaces:**
- Consumes: `createCategorySelector` / `CategorySelection` (Task 11); `uploadPreviewImage`, `removePreviewImage`, `MAX_PREVIEW_IMAGE_BYTES` (Task 12).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update imports and form state**

Replace the import block additions and the `FormState` interface:

```ts
import {
  MAX_PREVIEW_IMAGE_BYTES,
  removePreviewImage,
  uploadPreviewImage,
} from '@services/preset-submission-service';
import {
  createCategorySelector,
  type CategorySelection,
} from './preset-category-selector';
```

```ts
interface FormState {
  name: string;
  description: string;
  /** Editable since 5.1 — was a locked read-only display */
  categories: CategorySelection;
  selectedDyes: Dye[];
  tags: string;
  exampleLink: string;
  /** Picked file awaiting upload; null when nothing new was chosen */
  newPreviewImage: File | null;
  /**
   * The author pressed Remove; mutually exclusive with newPreviewImage.
   * Named `clearPreviewImage`, not `removePreviewImage`, so it cannot be
   * confused with the imported service function of that name.
   */
  clearPreviewImage: boolean;
  /** Status as loaded, so the field knows which affordance to render */
  previewImageStatus: 'none' | 'pending' | 'approved';
  previewImageUrl: string | null;
}
```

Delete the now-unused `getCategoryIcon` and `presetCategoryLabel` imports **only if** nothing else in the file uses them (the selector owns that rendering now).

- [ ] **Step 2: Initialise the new state in `showPresetEditForm`**

```ts
  const state: FormState = {
    name: preset.name,
    description: preset.description,
    categories: {
      primary: preset.category_id,
      secondary: preset.secondary_categories ?? [],
    },
    selectedDyes: dyeObjects,
    tags: preset.tags.join(', '),
    exampleLink: preset.example_link ?? '',
    newPreviewImage: null,
    clearPreviewImage: false,
    previewImageStatus: preset.preview_image_status ?? 'none',
    previewImageUrl: preset.preview_image_url ?? null,
  };
```

- [ ] **Step 3: Swap the category field and add the image field**

In `createFormContent`, replace `form.appendChild(createCategoryDisplay(state));` with:

```ts
  // Editable since 5.1. The category was locked here, and PresetEditRequest
  // had no category field at all, so a change had nowhere to go.
  form.appendChild(createCategorySelector(state.categories));
```

and add, after the example-link field:

```ts
  form.appendChild(createPreviewImageField(state));
```

Delete the whole `createCategoryDisplay` function.

- [ ] **Step 4: Implement `createPreviewImageField`**

Add before `createSubmitButton`:

```ts
const PREVIEW_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Preview image: upload, replace, or remove.
 *
 * A new upload re-queues the IMAGE only — the preset stays live in the gallery
 * showing its previous picture until a moderator approves the new one.
 * Removing clears the picture and, with it, the only reason the preset was in
 * the queue for its image.
 */
function createPreviewImageField(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = LanguageService.t('preset.fieldPreviewImage');

  const body = document.createElement('div');
  body.className = 'space-y-2';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = PREVIEW_IMAGE_ACCEPT;
  input.className = 'w-full text-sm';
  input.style.color = 'var(--theme-text)';

  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    // Mirror the server limit so the author finds out before spending the upload.
    if (file && file.size > MAX_PREVIEW_IMAGE_BYTES) {
      ToastService.error(LanguageService.t('preset.previewImageTooLarge'));
      input.value = '';
      state.newPreviewImage = null;
      return;
    }
    state.newPreviewImage = file;
    // Picking a file supersedes a pending removal — they are mutually exclusive.
    if (file) state.clearPreviewImage = false;
    render();
  });

  function render(): void {
    body.replaceChildren();

    const hasStoredImage = state.previewImageStatus !== 'none' && !state.clearPreviewImage;

    if (hasStoredImage && state.previewImageStatus === 'approved' && state.previewImageUrl) {
      const img = document.createElement('img');
      img.src = state.previewImageUrl;
      img.alt = LanguageService.t('preset.previewImageCurrent');
      img.style.cssText =
        'width: 100%; max-width: 320px; border-radius: 8px; border: 1px solid var(--theme-border); display: block;';
      body.appendChild(img);
    } else if (hasStoredImage && state.previewImageStatus === 'pending') {
      const note = document.createElement('div');
      note.className = 'text-xs px-3 py-2 rounded-lg border';
      note.style.cssText =
        'border-color: rgba(244,191,79,0.35); background: rgba(244,191,79,0.08); color: var(--theme-text-secondary);';
      note.textContent = LanguageService.t('preset.previewImageUnderReview');
      body.appendChild(note);
    }

    if (state.clearPreviewImage) {
      const note = document.createElement('div');
      note.className = 'text-xs';
      note.style.color = 'var(--theme-text-secondary)';
      note.textContent = LanguageService.t('preset.previewImageRemoved');
      body.appendChild(note);
    }

    body.appendChild(input);

    if (hasStoredImage) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'px-3 py-1.5 rounded-lg border text-xs';
      removeBtn.style.cssText =
        'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
      removeBtn.textContent = LanguageService.t('preset.previewImageRemove');
      removeBtn.addEventListener('click', () => {
        state.clearPreviewImage = true;
        state.newPreviewImage = null;
        input.value = '';
        render();
      });
      body.appendChild(removeBtn);
    }
  }

  render();

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = LanguageService.t('preset.fieldPreviewImageHint');

  wrapper.appendChild(label);
  wrapper.appendChild(body);
  wrapper.appendChild(hint);
  return wrapper;
}
```

- [ ] **Step 5: Rewrite the submit handler's request building**

In `createSubmitButton`, replace the `updates` construction and the `presetSubmissionService.editPreset` call. Everything from `const updates: PresetEditRequest = {};` down to the end of the `try` block becomes:

```ts
    // Build the patch from what actually CHANGED, not from everything on the
    // form. Two reasons: an image-only edit would otherwise send a body full of
    // unchanged fields, and — because the API runs content moderation whenever
    // `name` or `description` is present — every picture swap would spend a
    // Perspective API call re-checking text nobody touched.
    const name = state.name.trim();
    const description = state.description.trim();
    const dyes = state.selectedDyes
      .map((d) => d.stainID)
      .filter((id): id is number => id !== null);
    const tags = state.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    // Empty clears the link rather than leaving the old one in place
    const exampleLink = state.exampleLink.trim() || null;
    const originalSecondary = preset.secondary_categories ?? [];

    const updates: PresetEditRequest = {};
    if (name !== preset.name) updates.name = name;
    if (description !== preset.description) updates.description = description;
    if (dyes.join(',') !== preset.dyes.join(',')) updates.dyes = dyes;
    if (tags.join(',') !== preset.tags.join(',')) updates.tags = tags;
    if (exampleLink !== (preset.example_link ?? null)) updates.example_link = exampleLink;
    if (state.categories.primary !== preset.category_id) {
      updates.category_id = state.categories.primary;
    }
    if (state.categories.secondary.join(',') !== originalSecondary.join(',')) {
      updates.secondary_categories = state.categories.secondary;
    }

    // Validate against the form's values, not the patch: a field that did not
    // change was already valid, and one that did must be checked either way.
    const errors: string[] = [];
    if (name.length < MIN_NAME_LENGTH) {
      errors.push(`Name must be at least ${MIN_NAME_LENGTH} characters`);
    }
    if (description.length < MIN_DESC_LENGTH) {
      errors.push(`Description must be at least ${MIN_DESC_LENGTH} characters`);
    }
    if (state.selectedDyes.length < MIN_DYES) {
      errors.push(`Must include at least ${MIN_DYES} dyes`);
    }
    if (state.selectedDyes.length > MAX_DYES) {
      errors.push(`Maximum ${MAX_DYES} dyes allowed`);
    }

    if (errors.length > 0) {
      ToastService.error(errors.join('. '));
      return;
    }

    const hasFieldChanges = Object.keys(updates).length > 0;
    const hasImageChange = state.newPreviewImage !== null || state.clearPreviewImage;

    // An empty PATCH body comes back as 400 "No updates provided", which would
    // surface as a spurious error on an image-only edit that is about to
    // succeed. Nothing at all to do is its own, quieter message.
    if (!hasFieldChanges && !hasImageChange) {
      ToastService.info(LanguageService.t('preset.noChanges'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      let result: EditResult = { success: true };

      if (hasFieldChanges) {
        result = await presetSubmissionService.editPreset(presetId, updates);

        if (!result.success) {
          if (result.duplicate) {
            const dupName = result.duplicate.name || 'another preset';
            ToastService.error(
              LanguageService.tInterpolate('preset.duplicateFound', { name: dupName })
            );
          } else {
            ToastService.error(result.error || LanguageService.t('errors.saveChangesFailed'));
          }
          return;
        }
      }

      // The image lives on its own routes, so it is a separate call — and a
      // failure here must not read as a failed edit, because the fields did
      // save. Warn and carry on, exactly as the submission form does.
      if (state.newPreviewImage) {
        try {
          await uploadPreviewImage(presetId, state.newPreviewImage);
        } catch {
          ToastService.warning(LanguageService.t('preset.previewImageFailed'));
        }
      } else if (state.clearPreviewImage) {
        try {
          await removePreviewImage(presetId);
        } catch {
          ToastService.warning(LanguageService.t('preset.previewImageRemoveFailed'));
        }
      }

      // A new picture is always the more surprising outcome — it is invisible
      // until a moderator approves it — so it wins the message.
      if (state.newPreviewImage) {
        ToastService.info(LanguageService.t('preset.previewImagePendingReview'));
      } else if (result.moderation_status === 'pending') {
        ToastService.info(LanguageService.t('preset.editPendingReview'));
      } else {
        ToastService.success(LanguageService.t('preset.editSuccess'));
      }

      ModalService.dismissTop();
      onEdit?.(result);
    } catch {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
```

`EditResult` is already imported at the top of this file as a type — confirm the import line reads `import type { EditResult, PresetEditRequest } from '@services/preset-submission-service';` and leave it as is.

The `preset` object is in scope here because `createSubmitButton` is called from `createFormContent`, which receives only `presetId`. **Change both signatures to pass the preset through:**

```ts
// createFormContent
function createFormContent(
  preset: CommunityPreset,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
```
Inside it, replace `createSubmitButton(presetId, state, onEdit)` with `createSubmitButton(preset, state, onEdit)`, and at the call site in `showPresetEditForm` replace `createFormContent(preset.id, state, onEdit)` with `createFormContent(preset, state, onEdit)`.

```ts
// createSubmitButton
function createSubmitButton(
  preset: CommunityPreset,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
  const presetId = preset.id;
```

Note the three fixed defects folded in here: the error strings said "at least 2 dyes" and "maximum 5 dyes" while the constants are 3 and 6; `example_link` was set but never transmitted; and the success toast fired before the image call.

- [ ] **Step 6: Type-check and run the web-app suite**

Run: `pnpm --filter xivdyetools-web-app run type-check && pnpm --filter xivdyetools-web-app run test -- --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/components/preset-edit-form.ts
git commit -m "feat(web-app): edit categories and the preview picture from the edit form"
```

---

## Task 14: Submission form uses the shared selector

**Files:**
- Modify: `apps/web-app/src/components/preset-submission-form.ts:33-54` (state + `CATEGORIES`), `:203-245` (`createFormContent`), `:342-408` (delete local selector), `:726-740` (submission body)
- Test: `apps/web-app/src/components/__tests__/preset-submission-form.test.ts`

**Interfaces:**
- Consumes: `createCategorySelector` / `CategorySelection` (Task 11).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the local category state**

In `FormState`, replace `category: PresetCategory;` with:

```ts
  /** Primary + up to two secondary; the shared selector owns the ranking */
  categories: CategorySelection;
```

Delete the module-local `CATEGORIES` constant (line 54) — `SELECTABLE_CATEGORIES` in the shared module is now the single list.

Add the import:

```ts
import {
  createCategorySelector,
  type CategorySelection,
} from './preset-category-selector';
```

- [ ] **Step 2: Update the initial state**

```ts
    categories: { primary: 'events', secondary: [] },
```

- [ ] **Step 3: Use the shared selector**

In `createFormContent`, replace `form.appendChild(createCategorySelector(state));` with:

```ts
  form.appendChild(
    createCategorySelector(state.categories, () => state.refreshPreview?.())
  );
```

Then delete the local `createCategorySelector` function entirely (lines 342-408). Remove the `getCategoryIcon` / `presetCategoryLabel` imports if nothing else in the file uses them.

- [ ] **Step 4: Send the categories**

In the submit handler:

```ts
    const submission: PresetSubmission = {
      name: state.name.trim(),
      description: state.description.trim(),
      category_id: state.categories.primary,
      secondary_categories: state.categories.secondary,
      dyes: state.selectedDyes.map((d) => d.stainID).filter((id): id is number => id !== null),
      tags: state.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      example_link: state.exampleLink.trim() || null,
    };
```

- [ ] **Step 5: Confirm the existing suite still passes**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/preset-submission-form.test.ts`
Expected: PASS with no edits. The only `category` in that file is a `Dye` fixture's `category: 'Red'` (line 44) — nothing asserts against the form's own category state, so renaming `state.category` to `state.categories` touches no test.

- [ ] **Step 6: Run the suite and type-check**

Run: `pnpm --filter xivdyetools-web-app run type-check && pnpm --filter xivdyetools-web-app run test -- --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/components/preset-submission-form.ts apps/web-app/src/components/__tests__/preset-submission-form.test.ts
git commit -m "refactor(web-app): submission form uses the shared category selector"
```

---

## Task 15: Gallery matches secondary categories

**Files:**
- Modify: `apps/web-app/src/services/hybrid-preset-service.ts:31-54` (`UnifiedPreset`), `:167-175` (community mapper)
- Modify: `apps/web-app/src/services/saved-presets-service.ts:25-39`
- Modify: `apps/web-app/src/components/v4/preset-tool.ts:49-56`, `:517-591`, `:628-680`
- Modify: `apps/web-app/src/components/v4/preset-detail.ts:877-883`

**Interfaces:**
- Consumes: `secondary_categories` from the API (Tasks 5–7).
- Produces: `UnifiedPreset.secondaryCategories: PresetCategory[]`, `SavedPreset.secondaryCategories?: PresetCategory[]`.

- [ ] **Step 1: Add the field to `UnifiedPreset`**

In `apps/web-app/src/services/hybrid-preset-service.ts`, after `category: PresetCategory;`:

```ts
  /** Up to two extra categories; the rail matches on either slot */
  secondaryCategories: PresetCategory[];
```

Then fix every construction site the compiler flags — in this file the local mapper gets `secondaryCategories: []` and the community mapper gets:

```ts
      secondaryCategories: preset.secondary_categories ?? [],
```

- [ ] **Step 2: Add the field to `SavedPreset`**

In `apps/web-app/src/services/saved-presets-service.ts`, after `category: PresetCategory;`:

```ts
  /** Snapshotted so the offline shelf filters the same way the live rail does */
  secondaryCategories?: PresetCategory[];
```

There is exactly one construction site — `SavedPresetsService.snapshotOf()` at line 77, which `toggle()` calls. Add to the returned object, after `category: preset.category,`:

```ts
      secondaryCategories: [...preset.secondaryCategories],
```

- [ ] **Step 3: Extend the rail**

In `apps/web-app/src/components/v4/preset-tool.ts`, replace `CATEGORY_ORDER`:

```ts
const CATEGORY_ORDER: readonly PresetCategoryFilter[] = [
  'all',
  'aesthetics',
  'jobs',
  'seasons',
  'events',
  'grand-companies',
  'appearance',
  'zones',
  'raids-trials',
];
```

- [ ] **Step 4: Add the matcher and use it in both places**

Add above `currentPool()`:

```ts
  /**
   * Does this preset belong to `category`?
   *
   * Either slot counts. Rail counts therefore sum to MORE than the total —
   * inherent to multi-category, and the intended reading ("presets tagged
   * Zones"). Deduping them would make the number contradict the result list.
   */
  private matchesCategory(preset: UnifiedPreset, category: PresetCategoryFilter): boolean {
    if (category === 'all') return true;
    if (preset.category === category) return true;
    return preset.secondaryCategories.includes(category as PresetCategory);
  }
```

Replace the body of `currentPool()`:

```ts
  private currentPool(): UnifiedPreset[] {
    const pool = this.currentTabPool();
    if (this.config.category === 'all') return pool;
    return pool.filter((p) => this.matchesCategory(p, this.config.category));
  }
```

and the tail of `categoryCount()`:

```ts
    if (category === 'all') return base.length;
    return base.filter((p) => this.matchesCategory(p, category)).length;
```

Add `import type { PresetCategory } from '@xivdyetools/types';` if the file does not already import it.

- [ ] **Step 5: Carry the field through the three mappers**

In the same file:

```ts
// communityToUnified — after `category: preset.category_id,`
      secondaryCategories: preset.secondary_categories ?? [],

// savedToUnified — after `category: saved.category,`
      secondaryCategories: saved.secondaryCategories ?? [],

// localPaletteToUnified — after the 'aesthetics' category line
      // Local palettes carry no categories beyond the general bucket.
      secondaryCategories: [],
```

- [ ] **Step 6: Render secondary badges in the detail view**

In `apps/web-app/src/components/v4/preset-detail.ts`, immediately after the closing `</span>` of the existing `badge-category` span:

```ts
          ${this.preset.secondaryCategories.map(
            (cat) => html`
              <span class="badge badge-category">
                ${unsafeHTML(getCategoryIcon(cat))} ${presetCategoryLabel(cat)}
              </span>
            `
          )}
```

- [ ] **Step 7: Type-check, test, build**

Run: `pnpm --filter xivdyetools-web-app run type-check && pnpm --filter xivdyetools-web-app run test -- --run && pnpm --filter xivdyetools-web-app run build:check`
Expected: PASS all three. `build:check` also enforces the per-chunk byte ceilings — three extra glyphs and nine rail chips are well inside them, but confirm rather than assume.

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/src/services/ apps/web-app/src/components/v4/
git commit -m "feat(web-app): gallery rail and detail view honour secondary categories"
```

---

## Task 16: Discord bot choices and display metadata

**Files:**
- Modify: `apps/discord-worker/src/commands/schemas.ts:41-47`
- Modify: `apps/discord-worker/src/types/preset.ts:165-171`
- Test: `apps/discord-worker/src/commands/registry.test.ts:40-50`

**Interfaces:**
- Consumes: `PresetCategory` (Task 1).
- Produces: nothing consumed by later tasks. This is the task that clears the `CATEGORY_DISPLAY` compile error recorded in Task 1 Step 6.

- [ ] **Step 1: Write the failing test**

In `apps/discord-worker/src/commands/registry.test.ts`, replace the `liveMembers` literal (lines 42-48). Both sides of the assertion are `.sort()`ed, so keep this list alphabetical:

```ts
    const liveMembers: PresetCategory[] = [
      'aesthetics',
      'appearance',
      'events',
      'grand-companies',
      'jobs',
      'raids-trials',
      'seasons',
      'zones',
    ];
```

Leave the comment above it intact — it explains that this literal *is* the tripwire, because a type cannot be enumerated at runtime, and that updating it is the deliberate act acknowledging the registered Discord contract changed.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/commands/registry.test.ts`
Expected: FAIL — the choice list has 5 entries, not 8.

- [ ] **Step 3: Add the choices**

In `apps/discord-worker/src/commands/schemas.ts`:

```ts
export const PRESET_CATEGORY_CHOICES: ReadonlyArray<{ name: string; value: PresetCategory }> = [
  { name: '⚔️ FFXIV Jobs', value: 'jobs' },
  { name: '🏛️ Grand Companies', value: 'grand-companies' },
  { name: '🍂 Seasons', value: 'seasons' },
  { name: '🎉 FFXIV Events', value: 'events' },
  { name: '🎨 Aesthetics', value: 'aesthetics' },
  { name: '👤 Appearance', value: 'appearance' },
  { name: '🏔️ Zones', value: 'zones' },
  { name: '🗡️ Raids & Trials', value: 'raids-trials' },
];
```

- [ ] **Step 4: Add the display metadata**

In `apps/discord-worker/src/types/preset.ts`:

```ts
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '⚔️', name: 'FFXIV Jobs' },
  'grand-companies': { icon: '🏛️', name: 'Grand Companies' },
  seasons: { icon: '🍂', name: 'Seasons' },
  events: { icon: '🎉', name: 'FFXIV Events' },
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  appearance: { icon: '👤', name: 'Appearance' },
  zones: { icon: '🏔️', name: 'Zones' },
  // 🗡️ rather than ⚔️ because `jobs` still holds ⚔️. The design retired crossed
  // swords FROM jobs (now an upright staff), so ⚔️ arguably belongs here — but
  // reassigning it is a change to an existing category and is out of scope.
  'raids-trials': { icon: '🗡️', name: 'Raids & Trials' },
};
```

- [ ] **Step 5: Run the tests and type-check**

Run: `pnpm --filter xivdyetools-discord-worker run test -- --run && pnpm --filter xivdyetools-discord-worker run type-check`
Expected: PASS.

- [ ] **Step 6: Verify discord-worker absorbs the widened union**

Run: `pnpm turbo run lint type-check test --filter=xivdyetools-discord-worker`
Expected: PASS.

**Do not expect a workspace-wide pass yet.** Three more exhaustive
`Record<PresetCategory, …>` sites remain red until **Task 17** repairs them —
`apps/moderation-worker/src/types/preset.ts`, `packages/svg/src/preset-swatch.ts`,
and the `PresetData` fixtures in
`packages/core/src/services/__tests__/PresetService.test.ts`. Leave all three
alone here; Task 17 owns them and carries the workspace-wide gate.

- [ ] **Step 7: Commit**

```bash
git add apps/discord-worker/src/
git commit -m "feat(discord-worker): appearance/zones/raids-trials command choices and embed metadata"
```

---

## Deploy (user-run, not part of implementation)

Do **not** run these as part of executing the plan. They belong to a deploy window the repository owner runs by hand.

1. **Migration first**, before any deploy:
   ```bash
   cd apps/presets-api
   npx wrangler d1 execute xivdyetools-presets --remote \
     --file=./migrations/0010_add_secondary_categories.sql
   ```
   Verify with single-row aggregates — never a column list, which truncates and reads as complete:
   ```bash
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT SUM(name='secondary_categories') AS c FROM pragma_table_info('presets');"
   npx wrangler d1 execute xivdyetools-presets --remote --command \
     "SELECT COUNT(*) AS n FROM categories WHERE id IN ('appearance','zones','raids-trials');"
   ```
   Expect `0` → `1` and `0` → `3`.

2. `pnpm --filter xivdyetools-presets-api run deploy:production` — a bare `deploy` targets the dev worker on this app.
3. `pnpm --filter xivdyetools-discord-worker run deploy:production`, then `npm run register-commands` with the production token. Unregistered choices are invisible in every Discord client.
4. Deploy `web-app` last.

`@xivdyetools/types` and `@xivdyetools/svg` resolve via `workspace:*`, so their version bumps and npm publishes are housekeeping and do not gate any deploy.

---

## Task 17: Close the remaining exhaustive-`Record` sites

**Added 2026-08-11, after Task 1 execution surfaced them.** The original plan
traced `category_id` consumers and found one exhaustive `Record<PresetCategory, …>`
(discord-worker's `CATEGORY_DISPLAY`, Task 16). There are three more. Widening the
union breaks all of them, and no other task repairs them.

Dispatch this immediately after Task 16 so the tree is green from that point on.

**Files:**
- Modify: `apps/moderation-worker/src/types/preset.ts:62-68`
- Modify: `packages/svg/src/preset-swatch.ts:92-98`
- Modify: `packages/core/src/data/presets.json` (the `categories` object)
- Modify: `packages/core/src/services/__tests__/PresetService.test.ts:16-40`, `:744-750`

**Interfaces:**
- Consumes: `PresetCategory` (Task 1).
- Produces: nothing later tasks depend on. This task's whole job is that
  `pnpm turbo run type-check` passes across the workspace.

**Why `presets.json` gains the three categories rather than the type going `Partial`:**
`PresetData.categories` is `Record<PresetCategory, CategoryMeta>` and `presets.json`
is exported straight out of `@xivdyetools/core` (`index.ts:229`) into `PresetService`,
so the JSON is structurally checked at that call site. Relaxing the type to `Partial`
would compile, but it would also mask a real defect: `HybridPresetService.getCategories()`
seeds its map from the *local* categories and only ever *adds counts* from the API — a
category absent from `presets.json` is silently dropped and can never appear. Adding
the metadata keeps the map exhaustive and makes the three categories reachable.
Curated palettes are unaffected: the design ships fifteen across events / seasons /
grand-companies only, and a category with no palettes is exactly the empty row the
gallery is specified to render.

- [ ] **Step 1: Write the failing check**

Run: `pnpm turbo run type-check`
Expected: FAIL in all four files above (discord-worker is already fixed by Task 16).
Record the exact errors.

- [ ] **Step 2: moderation-worker display metadata**

In `apps/moderation-worker/src/types/preset.ts`, extend `CATEGORY_DISPLAY`. This file
uses escaped surrogate pairs rather than literal emoji — match that convention:

```ts
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  appearance: { icon: '👤', name: 'Appearance' },
  zones: { icon: '🏔️', name: 'Zones' },
  // 🗡 (dagger) rather than ⚔ (crossed swords) because `jobs`
  // still holds crossed swords. See the same note in discord-worker.
  'raids-trials': { icon: '🗡️', name: 'Raids & Trials' },
};
```

- [ ] **Step 3: svg preset-swatch display metadata**

In `packages/svg/src/preset-swatch.ts`, extend `CATEGORY_DISPLAY`. This file uses
literal emoji — match that:

```ts
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  appearance: { icon: '👤', name: 'Appearance' },
  zones: { icon: '🏔️', name: 'Zones' },
  'raids-trials': { icon: '🗡️', name: 'Raids & Trials' },
};
```

- [ ] **Step 4: Curated category metadata**

In `packages/core/src/data/presets.json`, add three entries to `categories`, after
`aesthetics`, matching the existing three-key shape exactly:

```json
    "appearance": {
      "name": "Appearance",
      "description": "Palettes built around a character's own colours",
      "icon": "👤"
    },
    "zones": {
      "name": "Zones",
      "description": "Palettes drawn from the places of Eorzea",
      "icon": "🏔️"
    },
    "raids-trials": {
      "name": "Raids & Trials",
      "description": "Palettes from raid and trial encounters",
      "icon": "🗡️"
    }
```

Do **not** add any palettes. `version` stays `2.0.0` — the schema did not change.

- [ ] **Step 5: Test fixtures**

In `packages/core/src/services/__tests__/PresetService.test.ts`, both `PresetData`
fixtures declare a full `categories` map and now need the same three keys.

In `mockPresetData` (starts line ~16), after the `aesthetics` entry:

```ts
    appearance: {
      name: 'Appearance',
      description: 'Palettes built around a character\'s own colours',
      icon: '👤',
    },
    zones: {
      name: 'Zones',
      description: 'Palettes drawn from the places of Eorzea',
      icon: '🏔️',
    },
    'raids-trials': {
      name: 'Raids & Trials',
      description: 'Palettes from raid and trial encounters',
      icon: '🗡️',
    },
```

In `minimalData` inside the `edge cases` describe (~line 744), after the `aesthetics`
entry — this fixture deliberately omits `icon`, so match it:

```ts
          appearance: { name: 'Appearance', description: 'Test' },
          zones: { name: 'Zones', description: 'Test' },
          'raids-trials': { name: 'Raids & Trials', description: 'Test' },
```

If a test asserts an exact category **count** (e.g. `expect(categories).toHaveLength(5)`),
update it to 8 — the fixture genuinely has eight now.

- [ ] **Step 6: Verify the whole workspace is green**

Run: `pnpm turbo run type-check`
Expected: PASS across every package and app — this is the gate for this task.

Run: `pnpm turbo run test --filter=@xivdyetools/core --filter=@xivdyetools/svg --filter=xivdyetools-moderation-worker -- --run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/moderation-worker/src/types/preset.ts packages/svg/src/preset-swatch.ts packages/core/src/data/presets.json packages/core/src/services/__tests__/PresetService.test.ts
git commit -m "feat: category metadata for appearance/zones/raids-trials across core, svg and moderation-worker"
```
