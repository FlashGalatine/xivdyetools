# API Changes

## Database Schema

### New Column: `previous_values`

Add to `presets` table to store pre-edit state for potential revert:

```sql
ALTER TABLE presets ADD COLUMN previous_values TEXT;
-- JSON: {"name": "...", "description": "...", "tags": [...], "dyes": [...]}
```

**Purpose**: When a preset edit is flagged by content moderation, the original values are stored here. Moderators can then "Revert" to restore the original content.

---

## New Types

### PresetEditRequest

```typescript
interface PresetEditRequest {
  name?: string;          // 2-50 characters
  dyes?: number[];        // 2-5 dye IDs
  description?: string;   // 10-200 characters
  tags?: string[];        // 0-10 tags, max 30 chars each
}
```

### PresetEditResponse

```typescript
interface PresetEditResponse {
  success: boolean;
  preset?: CommunityPreset;
  moderation_status?: 'approved' | 'pending';
  duplicate?: {
    id: string;
    name: string;
    author_name: string;
  };
  error?: string;
}
```

### PresetPreviousValues

```typescript
interface PresetPreviousValues {
  name: string;
  description: string;
  tags: string[];
  dyes: number[];
}
```

---

## New Endpoints

### PATCH /api/v1/presets/:id

Edit a preset (owner only).

**Headers:**
- `Authorization: Bearer <JWT or BOT_API_SECRET>`

**Request Body:**
```json
{
  "name": "New Preset Name",
  "description": "Updated description...",
  "dyes": [5738, 13115, 13117],
  "tags": ["dark", "gothic"]
}
```

**Response (Success):**
```json
{
  "success": true,
  "preset": { /* updated preset object */ },
  "moderation_status": "approved"
}
```

**Response (Flagged for moderation):**
```json
{
  "success": true,
  "preset": { /* updated preset object */ },
  "moderation_status": "pending"
}
```

**Response (Duplicate dyes):**
```json
{
  "success": false,
  "error": "duplicate_dyes",
  "message": "This dye combination already exists",
  "duplicate": {
    "id": "uuid-here",
    "name": "Existing Preset",
    "author_name": "SomeUser"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not the preset owner
- `404 Not Found` - Preset doesn't exist
- `409 Conflict` - Duplicate dye combination
- `400 Bad Request` - Validation errors

**Authorization Logic:**
1. Verify user is authenticated
2. Verify `author_discord_id === userDiscordId`
3. Moderators cannot edit others' presets

**Moderation Flow:**
1. If name or description changed, run content moderation
2. If flagged:
   - Store current values in `previous_values`
   - Set `status = 'pending'`
   - Return `moderation_status: 'pending'`
3. If clean:
   - Clear `previous_values`
   - Keep `status = 'approved'`
   - Return `moderation_status: 'approved'`

---

### PATCH /api/v1/moderation/:presetId/revert

Revert a preset to its previous values (moderators only).

**Headers:**
- `Authorization: Bearer <BOT_API_SECRET>`
- `X-User-Discord-ID: <moderator_id>`

**Request Body:**
```json
{
  "reason": "Inappropriate content in name"
}
```

**Response (Success):**
```json
{
  "success": true,
  "preset": { /* reverted preset object */ },
  "message": "Preset reverted to previous values"
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a moderator
- `404 Not Found` - Preset doesn't exist
- `400 Bad Request` - No previous values to revert to

**Revert Flow:**
1. Verify moderator permissions
2. Check `previous_values` exists
3. Restore preset fields from `previous_values`
4. Set `status = 'approved'`
5. Clear `previous_values`
6. Log action in `moderation_log` table

---

## Service Functions

### findDuplicatePresetExcluding

```typescript
async function findDuplicatePresetExcluding(
  db: D1Database,
  dyes: number[],
  excludePresetId: string
): Promise<CommunityPreset | null>
```

Same as `findDuplicatePreset` but excludes one preset ID from the search. Used when editing to allow keeping the same dye combination.

### updatePreset

```typescript
async function updatePreset(
  db: D1Database,
  id: string,
  updates: {
    name?: string;
    dyes?: number[];
    description?: string;
    tags?: string[];
  },
  previousValues?: PresetPreviousValues
): Promise<CommunityPreset | null>
```

Updates preset fields. If `previousValues` is provided, stores them for potential revert. Regenerates `dye_signature` if dyes change.

### revertPreset

```typescript
async function revertPreset(
  db: D1Database,
  id: string
): Promise<CommunityPreset | null>
```

Restores preset from `previous_values` column, clears the column, and sets status to 'approved'.

---

## Files to Modify

1. **`xivdyetools-presets-api/schema.sql`** - Add migration
2. **`xivdyetools-presets-api/src/types.ts`** - Add new interfaces
3. **`xivdyetools-presets-api/src/services/preset-service.ts`** - Add service functions
4. **`xivdyetools-presets-api/src/handlers/presets.ts`** - Add PATCH endpoint
5. **`xivdyetools-presets-api/src/handlers/moderation.ts`** - Add revert endpoint
