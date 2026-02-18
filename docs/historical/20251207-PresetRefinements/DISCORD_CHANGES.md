# Discord Worker Changes

## New Subcommand: `/preset edit`

### Command Definition

```javascript
{
  name: 'edit',
  description: 'Edit one of your presets',
  type: 1, // SUB_COMMAND
  options: [
    {
      name: 'preset',
      description: 'The preset to edit',
      type: 3, // STRING
      required: true,
      autocomplete: true
    },
    {
      name: 'name',
      description: 'New preset name (2-50 characters)',
      type: 3,
      required: false
    },
    {
      name: 'description',
      description: 'New description (10-200 characters)',
      type: 3,
      required: false
    },
    {
      name: 'tags',
      description: 'New tags (comma-separated)',
      type: 3,
      required: false
    },
    {
      name: 'dye1',
      description: 'First dye',
      type: 3,
      required: false,
      autocomplete: true
    },
    {
      name: 'dye2',
      description: 'Second dye',
      type: 3,
      required: false,
      autocomplete: true
    },
    {
      name: 'dye3',
      description: 'Third dye',
      type: 3,
      required: false,
      autocomplete: true
    },
    {
      name: 'dye4',
      description: 'Fourth dye',
      type: 3,
      required: false,
      autocomplete: true
    },
    {
      name: 'dye5',
      description: 'Fifth dye',
      type: 3,
      required: false,
      autocomplete: true
    }
  ]
}
```

### Autocomplete: Preset Selection

Only show presets owned by the user:
```typescript
// In autocomplete handler
case 'preset':
  const myPresets = await presetApi.getMyPresets(env, userId);
  return myPresets
    .filter(p => p.name.toLowerCase().includes(focused.value.toLowerCase()))
    .slice(0, 25)
    .map(p => ({
      name: `${p.name} (${p.status})`,
      value: p.id
    }));
```

### Response Embeds

**Success (Approved):**
```
Title: Preset Updated
Color: Green
Fields:
  - Name: {new_name}
  - Description: {new_description}
  - Dyes: {dye_chips}
  - Tags: {tags}
Footer: Changes applied immediately
```

**Success (Pending Moderation):**
```
Title: Preset Updated - Pending Review
Color: Yellow
Fields:
  - Name: {new_name}
  - Description: {new_description}
  - Dyes: {dye_chips}
  - Tags: {tags}
Footer: Your changes will be reviewed by a moderator
```

**Error (Duplicate):**
```
Title: Duplicate Dye Combination
Color: Red
Description: This dye combination already exists in another preset.
Fields:
  - Existing Preset: {preset_name} by {author_name}
  - Link: [View Preset](url)
```

---

## Moderation Panel Changes

### Add Revert Button

When a preset has `previous_values` (edit was flagged), add a "Revert" button:

```
Current Buttons: [Approve] [Reject] [View]
With Revert:     [Approve] [Reject] [Revert] [View]
```

**Button Configuration:**
```javascript
{
  type: 2, // BUTTON
  style: 4, // DANGER (red)
  label: 'Revert',
  custom_id: `preset_revert:${presetId}`,
  emoji: { name: '↩️' }
}
```

### Revert Modal

When moderator clicks Revert, show modal for reason:

```javascript
{
  title: 'Revert Preset Edit',
  custom_id: `preset_revert_modal:${presetId}`,
  components: [{
    type: 1, // ACTION_ROW
    components: [{
      type: 4, // TEXT_INPUT
      custom_id: 'reason',
      label: 'Reason for reverting',
      style: 2, // PARAGRAPH
      min_length: 10,
      max_length: 200,
      placeholder: 'Explain why the edit is being reverted...',
      required: true
    }]
  }]
}
```

### Revert Confirmation

After successful revert:
```
Title: Preset Edit Reverted
Color: Blue
Description: The preset has been restored to its previous state.
Fields:
  - Preset: {preset_name}
  - Previous Name: {old_name}
  - Reverted By: {moderator}
  - Reason: {reason}
```

---

## API Client Methods

### getMyPresets

```typescript
export async function getMyPresets(
  env: Env,
  userId: string
): Promise<CommunityPreset[]> {
  const response = await fetch(
    `${getApiUrl(env)}/api/v1/presets/mine`,
    {
      headers: {
        'Authorization': `Bearer ${env.API_SECRET}`,
        'X-User-Discord-ID': userId
      }
    }
  );
  return response.json();
}
```

### editPreset

```typescript
export async function editPreset(
  env: Env,
  presetId: string,
  updates: {
    name?: string;
    description?: string;
    tags?: string[];
    dyes?: number[];
  },
  userId: string,
  userName: string
): Promise<PresetEditResponse> {
  const response = await fetch(
    `${getApiUrl(env)}/api/v1/presets/${presetId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.API_SECRET}`,
        'X-User-Discord-ID': userId,
        'X-User-Discord-Name': userName,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  );
  return response.json();
}
```

### revertPreset

```typescript
export async function revertPreset(
  env: Env,
  presetId: string,
  reason: string,
  moderatorId: string
): Promise<{ success: boolean; preset?: CommunityPreset }> {
  const response = await fetch(
    `${getApiUrl(env)}/api/v1/moderation/${presetId}/revert`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${env.API_SECRET}`,
        'X-User-Discord-ID': moderatorId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    }
  );
  return response.json();
}
```

---

## Files to Modify

1. **`xivdyetools-discord-worker/src/services/preset-api.ts`** - Add API client methods
2. **`xivdyetools-discord-worker/src/handlers/commands/preset.ts`** - Add edit subcommand
3. **`xivdyetools-discord-worker/src/handlers/buttons/preset-moderation.ts`** - Add revert button handler
4. **`xivdyetools-discord-worker/src/handlers/modals/preset-rejection.ts`** - Add revert modal handler (or create new file)
5. **`xivdyetools-discord-worker/scripts/register-commands.ts`** - Add edit subcommand to registration
