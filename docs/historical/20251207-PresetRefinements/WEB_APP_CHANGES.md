# Web App Changes

## 1. URL Routing for Presets

### Route Pattern
```
/presets/{uuid}
```

Example: `https://xivdyetools.projectgalatine.com/presets/550e8400-e29b-41d4-a716-446655440000`

### Implementation

**File: `src/main.ts`**

Add route detection on page load:
```typescript
// After app initialization
const handleRouting = async () => {
  const path = window.location.pathname;
  const presetMatch = path.match(/^\/presets\/([a-f0-9-]+)$/i);

  if (presetMatch) {
    const presetId = presetMatch[1];
    // Switch to presets tool
    await switchToTool('presets');
    // Auto-select the preset
    const presetTool = document.querySelector('preset-browser-tool');
    if (presetTool) {
      await (presetTool as PresetBrowserTool).selectPresetById(presetId);
    }
  }
};

handleRouting();
```

**File: `src/components/preset-browser-tool.ts`**

Add public method and URL updating:
```typescript
// New public method
public async selectPresetById(presetId: string): Promise<void> {
  const preset = await hybridPresetService.getPreset(presetId);
  if (preset) {
    this.selectedPreset = preset;
    this.renderPresetDetail();
  }
}

// Update URL when preset selected
private handlePresetSelect(preset: UnifiedPreset): void {
  this.selectedPreset = preset;
  history.pushState({}, '', `/presets/${preset.id}`);
  this.renderPresetDetail();
}

// Handle back button
constructor() {
  window.addEventListener('popstate', () => {
    // Re-render based on current URL
    this.handleRouting();
  });
}
```

---

## 2. Fix Modal Dismiss Bug

### Issue
Modal doesn't dismiss after successful preset submission.

### Investigation Points

**File: `src/components/preset-submission-form.ts`**

1. Check if `ModalService.dismissTop()` is being reached
2. Check for async timing issues
3. Verify modal stack state

### Debug Code
```typescript
// Add logging around line 554
console.log('[PresetSubmission] Submission successful, dismissing modal');
console.log('[PresetSubmission] Modal stack:', ModalService.getStack());

ModalService.dismissTop();

console.log('[PresetSubmission] Modal dismissed, stack:', ModalService.getStack());
```

### Potential Fixes

1. **Async race condition**: Wrap dismiss in requestAnimationFrame
```typescript
requestAnimationFrame(() => {
  ModalService.dismissTop();
});
```

2. **Modal reference issue**: Get modal ID before async operation
```typescript
const modalId = ModalService.getCurrentModalId();
// ... async operation ...
ModalService.dismiss(modalId);
```

3. **Error swallowing**: Ensure dismiss errors are logged
```typescript
try {
  ModalService.dismissTop();
} catch (err) {
  console.error('[PresetSubmission] Failed to dismiss modal:', err);
}
```

---

## 3. Vote Functionality

### Service Methods

**File: `src/services/community-preset-service.ts`**

```typescript
/**
 * Add vote to a preset
 */
async voteForPreset(presetId: string): Promise<VoteResponse> {
  if (!authService.isAuthenticated()) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/votes/${presetId}`,
    {
      method: 'POST',
      headers: authService.getAuthHeaders()
    }
  );

  return response.json();
}

/**
 * Remove vote from a preset
 */
async removeVote(presetId: string): Promise<VoteResponse> {
  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/votes/${presetId}`,
    {
      method: 'DELETE',
      headers: authService.getAuthHeaders()
    }
  );

  return response.json();
}

/**
 * Check if user has voted for a preset
 */
async hasVoted(presetId: string): Promise<boolean> {
  if (!authService.isAuthenticated()) return false;

  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/votes/${presetId}/check`,
    {
      headers: authService.getAuthHeaders()
    }
  );

  const data = await response.json();
  return data.has_voted;
}
```

### Vote Button UI

**File: `src/components/preset-browser-tool.ts`**

Replace the Discord CTA (lines ~1056-1067) with:
```typescript
// Vote button section
const voteSection = this.createElement('div', {
  className: 'flex items-center gap-3 p-3 rounded-lg',
});
voteSection.style.cssText =
  'background-color: var(--theme-card-background);';

if (authService.isAuthenticated()) {
  const voteBtn = this.createElement('button', {
    className: 'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
    id: 'vote-btn',
  });

  const hasVoted = await communityPresetService.hasVoted(preset.id);

  if (hasVoted) {
    voteBtn.innerHTML = `<span>★</span> Voted`;
    voteBtn.style.cssText =
      'background-color: var(--theme-primary); color: white;';
  } else {
    voteBtn.innerHTML = `<span>☆</span> Vote`;
    voteBtn.style.cssText =
      'background-color: var(--theme-card-hover); color: var(--theme-text);';
  }

  voteBtn.addEventListener('click', () => this.handleVote(preset));
  voteSection.appendChild(voteBtn);
} else {
  const loginPrompt = this.createElement('span', {
    className: 'text-sm',
    textContent: 'Login to vote',
  });
  voteSection.appendChild(loginPrompt);
}

const voteCount = this.createElement('span', {
  className: 'text-sm font-medium',
  textContent: `${preset.voteCount} votes`,
});
voteSection.appendChild(voteCount);
```

### Vote Handler
```typescript
private async handleVote(preset: UnifiedPreset): Promise<void> {
  const voteBtn = this.querySelector('#vote-btn');
  if (!voteBtn) return;

  voteBtn.disabled = true;

  try {
    const hasVoted = await communityPresetService.hasVoted(preset.id);

    if (hasVoted) {
      await communityPresetService.removeVote(preset.id);
      preset.voteCount--;
    } else {
      await communityPresetService.voteForPreset(preset.id);
      preset.voteCount++;
    }

    // Re-render to update UI
    this.renderPresetDetail();
  } catch (err) {
    ToastService.error('Failed to update vote');
  } finally {
    voteBtn.disabled = false;
  }
}
```

---

## 4. Share Button

**File: `src/components/preset-browser-tool.ts`**

Add in detail panel header:
```typescript
const shareBtn = this.createElement('button', {
  className: 'flex items-center gap-1 px-3 py-1 rounded text-sm',
  innerHTML: `${ICON_SHARE} Share`,
});
shareBtn.style.cssText =
  'background-color: var(--theme-card-hover); color: var(--theme-text);';

shareBtn.addEventListener('click', () => {
  const url = `${window.location.origin}/presets/${preset.id}`;
  navigator.clipboard.writeText(url).then(() => {
    ToastService.success('Preset link copied to clipboard!');
  }).catch(() => {
    ToastService.error('Failed to copy link');
  });
});
```

---

## 5. Filter Facewear Dyes

**File: `src/components/preset-submission-form.ts`** (line ~381)

```typescript
// Before
const allDyes = dyeService.getAllDyes();

// After
const allDyes = dyeService.getAllDyes().filter(dye => dye.category !== 'Facewear');
```

Also apply to edit form when created.

---

## 6. Show Duplicate Link

**File: `src/components/preset-submission-form.ts`** (lines ~544-547)

```typescript
if (result.duplicate) {
  const presetUrl = `${window.location.origin}/presets/${result.duplicate.id}`;

  // Create a more detailed toast or modal
  ToastService.info(
    `This dye combination already exists as "${result.duplicate.name}". ` +
    `${result.vote_added ? 'Your vote has been added!' : ''}`
  );

  // Option: Show link in a separate element before dismissing
  // Or use a custom modal with a button
}
```

---

## 7. Edit Form Component

**File: `src/components/preset-edit-form.ts`** (NEW)

Structure similar to `preset-submission-form.ts` but:
- Pre-populate all fields from existing preset
- Name is editable (unlike previous plan)
- Category shown as read-only badge
- Show moderation warning if edit is flagged

```typescript
export function showPresetEditForm(
  preset: CommunityPreset,
  onEdit?: (result: PresetEditResponse) => void
): void {
  if (!authService.isAuthenticated()) {
    ToastService.error('Please login to edit presets');
    return;
  }

  const state: EditFormState = {
    name: preset.name,
    description: preset.description,
    category: preset.category_id, // Read-only
    selectedDyes: preset.dyes.map(id => dyeService.getDyeById(id)!),
    tags: preset.tags.join(', '),
  };

  const content = createEditFormContent(state, preset, onEdit);

  ModalService.show({
    type: 'custom',
    title: 'Edit Preset',
    content,
    size: 'lg',
    closable: true,
  });
}
```

### Edit Service Method

**File: `src/services/preset-submission-service.ts`**

```typescript
async editPreset(
  presetId: string,
  updates: {
    name?: string;
    description?: string;
    dyes?: number[];
    tags?: string[];
  }
): Promise<PresetEditResponse> {
  const response = await fetch(
    `${PRESETS_API_URL}/api/v1/presets/${presetId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(updates),
    }
  );

  return response.json();
}
```

---

## 8. Edit Button in My Submissions

**File: `src/components/my-submissions-panel.ts`**

Add edit button in `renderPresetDetails`:
```typescript
// Next to delete button (around line 397-409)
const editBtn = this.createElement('button', {
  className: 'px-3 py-1 rounded text-sm transition-colors',
  textContent: 'Edit',
});
editBtn.style.cssText =
  'background-color: var(--theme-primary); color: white;';

editBtn.addEventListener('click', () => {
  showPresetEditForm(preset, (result) => {
    if (result.success) {
      this.refreshSubmissions();
      if (result.moderation_status === 'pending') {
        ToastService.info('Your edit is pending moderator review');
      } else {
        ToastService.success('Preset updated successfully');
      }
    }
  });
});

// Only show for non-rejected presets
if (preset.status !== 'rejected') {
  actionsRow.appendChild(editBtn);
}
```

### Pending Badge

Show when preset was edited and is pending review:
```typescript
if (preset.status === 'pending' && preset.previous_values) {
  const pendingBadge = this.createElement('span', {
    className: 'text-xs px-2 py-0.5 rounded',
    textContent: 'Edit Pending Review',
  });
  pendingBadge.style.cssText =
    'background-color: var(--theme-warning); color: white;';
  statusRow.appendChild(pendingBadge);
}
```

---

## Files to Modify

1. **`src/main.ts`** - Add URL routing
2. **`src/components/preset-submission-form.ts`** - Fix modal bug, filter facewear, duplicate link
3. **`src/components/preset-browser-tool.ts`** - Add vote button, share button, selectPresetById method
4. **`src/components/my-submissions-panel.ts`** - Add edit button, pending badge
5. **`src/components/preset-edit-form.ts`** - NEW FILE
6. **`src/services/community-preset-service.ts`** - Add voting methods
7. **`src/services/preset-submission-service.ts`** - Add editPreset method
