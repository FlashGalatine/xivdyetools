# i18n Audit: ToastService Calls Analysis

**Project:** xivdyetools-web-app
**Date:** January 17, 2026
**Focus:** ToastService calls with hardcoded strings
**Status:** ✅ COMPLETE

---

## Overview

This document analyzes all `ToastService.success()`, `.error()`, `.warning()`, and `.info()` calls to identify hardcoded strings that should be internationalized.

**Total ToastService Calls Found: 117** (excluding test files)
**Calls Already Using i18n: 117** (100%)
**Calls Needing i18n: 0** (0%)

---

## Summary by File

| File | Total Calls | Using i18n | Hardcoded | Status |
|------|-------------|------------|-----------|--------|
| `add-to-collection-menu.ts` | 3 | 3 | 0 | ✅ Good |
| `budget-tool.ts` | 2 | 2 | 0 | ✅ Good |
| `camera-preview-modal.ts` | 3 | 3 | 0 | ✅ Good |
| `collection-manager-modal.ts` | 12 | 12 | 0 | ✅ Good |
| `dye-action-dropdown.ts` | 10 | 10 | 0 | ✅ Good |
| `dye-grid.ts` | 3 | 3 | 0 | ✅ Good |
| `extractor-tool.ts` | 18 | 18 | 0 | ✅ Fixed |
| `gradient-tool.ts` | 12 | 12 | 0 | ✅ Good |
| `market-board.ts` | 2 | 2 | 0 | ✅ Good |
| `mixer-tool.ts` | 6 | 6 | 0 | ✅ Good |
| `preset-detail-view.ts` | 9 | 9 | 0 | ✅ Fixed |
| `preset-submission-form.ts` | 8 | 8 | 0 | ✅ Fixed |
| `preset-edit-form.ts` | 8 | 8 | 0 | ✅ Fixed |
| `preset-tool.ts` | 1 | 1 | 0 | ✅ Good |
| `swatch-tool.ts` | 5 | 5 | 0 | ✅ Fixed (namespace) |
| `saved-palettes-modal.ts` | 7 | 7 | 0 | ✅ Good |
| `v4/dye-palette-drawer.ts` | 4 | 4 | 0 | ✅ Fixed |
| `v4/preset-detail.ts` | 9 | 9 | 0 | ✅ Fixed |
| `v4/preset-tool.ts` | 5 | 5 | 0 | ✅ Fixed |
| `v4/result-card.ts` | 8 | 8 | 0 | ✅ Good |

---

## Detailed Findings by File

### extractor-tool.ts (7 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 2257 | `'Could not get canvas context'` | `errors.canvasContextFailed` |
| 2268 | `'Selected region is too small'` | `errors.regionTooSmall` |
| 2278 | `'No pixels to analyze in selected region'` | `errors.noPixelsInRegion` |
| 2319 | `'Failed to extract palette from region'` | `errors.paletteExtractionFailed` |
| 2339 | `'Could not get canvas context'` | `errors.canvasContextFailed` |
| 2357 | `'No pixels to analyze'` | `errors.noPixelsToAnalyze` |
| 2397 | `'Failed to extract palette'` | `errors.paletteExtractionFailed` |

**Note:** Also has incorrect namespace usage (`toast.*` instead of existing `harmony.*` keys).

---

### preset-detail-view.ts (9 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 419 | `'Preset link copied to clipboard!'` | `preset.linkCopied` |
| 422 | `'Failed to copy link'` | `errors.copyLinkFailed` |
| 431 | `'Please login with Discord to vote'` | `preset.loginToVote` |
| 470 | `'Vote removed'` | `preset.voteRemoved` |
| 472 | `result.error \|\| 'Failed to remove vote'` | `errors.removeVoteFailed` |
| 495 | `'Vote added!'` | `preset.voteAdded` |
| 497 | `'You already voted for this preset'` | `preset.alreadyVoted` |
| 499 | `result.error \|\| 'Failed to vote'` | `errors.voteFailed` |
| 504 | `'Failed to process vote'` | `errors.voteProcessFailed` |

---

### preset-submission-form.ts (8 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 68 | `'Please login with Discord to submit presets'` | `preset.loginToSubmit` |
| 409 | `Maximum ${MAX_DYES} dyes allowed` | `preset.maxDyesAllowed` |
| 535 | Dynamic validation errors | (use LanguageService for each error) |
| 550 | `This dye combination already exists...` | `preset.duplicateFound` |
| 569 | `'Preset submitted! It will appear after moderator review.'` | `preset.submittedPendingReview` |
| 571 | `'Preset submitted successfully!'` | `preset.submittedSuccess` |
| 579 | `result.error \|\| 'Failed to submit preset'` | `errors.submitPresetFailed` |
| 582 | `'Failed to submit preset. Please try again.'` | `errors.submitPresetFailed` |

---

### preset-edit-form.ts (8 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 67 | `'Please login with Discord to edit presets'` | `preset.loginToEdit` |
| 74 | `'You can only edit your own presets'` | `preset.onlyEditOwn` |
| 510 | Dynamic validation errors | (use LanguageService for each error) |
| 523 | `'Changes saved! Your edit is pending moderator review.'` | `preset.editPendingReview` |
| 525 | `'Preset updated successfully!'` | `preset.editSuccess` |
| 533 | `This dye combination already exists...` | `preset.duplicateFound` |
| 535 | `result.error \|\| 'Failed to save changes'` | `errors.saveChangesFailed` |
| 538 | `'Failed to save changes. Please try again.'` | `errors.saveChangesFailed` |

---

### v4/preset-detail.ts (9 hardcoded)

Same patterns as `preset-detail-view.ts` - duplicate component for v4 layout.

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 561 | `'Preset link copied to clipboard!'` | `preset.linkCopied` |
| 562 | `'Failed to copy link'` | `errors.copyLinkFailed` |
| 588 | `'Please login to vote'` | `preset.loginToVote` |
| 604 | `'Vote removed'` | `preset.voteRemoved` |
| 606 | `result.error \|\| 'Failed to remove vote'` | `errors.removeVoteFailed` |
| 617 | `'Vote added!'` | `preset.voteAdded` |
| 620 | `'You already voted for this preset'` | `preset.alreadyVoted` |
| 622 | `result.error \|\| 'Failed to vote'` | `errors.voteFailed` |
| 627 | `'Failed to process vote'` | `errors.voteProcessFailed` |

---

### v4/preset-tool.ts (5 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 570 | `'Unable to delete: preset data missing'` | `errors.presetDataMissing` |
| 576 | `'Unable to delete: preset has no API ID'` | `errors.presetNoApiId` |
| 591 | `'Deleting preset...'` | `preset.deleting` |
| 594 | `'Preset deleted successfully'` | `preset.deleteSuccess` |
| 604 | `'Failed to delete preset. Please try again.'` | `errors.deletePresetFailed` |

---

### v4/dye-palette-drawer.ts (2 hardcoded)

| Line | Current Message | Recommended Key |
|------|-----------------|-----------------|
| 810 | `'No dyes available'` | `colorPalette.noDyesAvailable` |
| 845-847 | `Maximum ${maxFavorites} favorites reached...` | `collections.favoritesFull` |

**Note:** Line 819 (`Selected: ${randomDye.name}`) is intentionally dynamic.

---

## Translation Keys to Add

### New keys for `preset` namespace:

```json
{
  "preset": {
    "linkCopied": "Preset link copied to clipboard!",
    "voteRemoved": "Vote removed",
    "voteAdded": "Vote added!",
    "alreadyVoted": "You already voted for this preset",
    "loginToSubmit": "Please login to submit presets",
    "loginToEdit": "Please login to edit presets",
    "onlyEditOwn": "You can only edit your own presets",
    "maxDyesAllowed": "Maximum {count} dyes allowed",
    "duplicateFound": "This dye combination already exists as \"{name}\"",
    "duplicateWithVote": "This dye combination already exists as \"{name}\". Your vote has been added!",
    "submittedPendingReview": "Preset submitted! It will appear after moderator review.",
    "submittedSuccess": "Preset submitted successfully!",
    "editPendingReview": "Changes saved! Your edit is pending moderator review.",
    "editSuccess": "Preset updated successfully!",
    "deleting": "Deleting preset...",
    "deleteSuccess": "Preset deleted successfully"
  }
}
```

### New keys for `errors` namespace:

```json
{
  "errors": {
    "copyLinkFailed": "Failed to copy link",
    "removeVoteFailed": "Failed to remove vote",
    "voteFailed": "Failed to vote",
    "voteProcessFailed": "Failed to process vote",
    "submitPresetFailed": "Failed to submit preset. Please try again.",
    "saveChangesFailed": "Failed to save changes. Please try again.",
    "deletePresetFailed": "Failed to delete preset. Please try again.",
    "presetDataMissing": "Unable to delete: preset data missing",
    "presetNoApiId": "Unable to delete: preset has no API ID",
    "canvasContextFailed": "Could not get canvas context",
    "regionTooSmall": "Selected region is too small",
    "noPixelsInRegion": "No pixels to analyze in selected region",
    "noPixelsToAnalyze": "No pixels to analyze",
    "paletteExtractionFailed": "Failed to extract palette"
  }
}
```

### New keys for `colorPalette` namespace:

```json
{
  "colorPalette": {
    "noDyesAvailable": "No dyes available",
    "randomDyeSelected": "Selected: {name}"
  }
}
```

---

## Additional Issue: Wrong Namespace Usage

The following files use `toast.*` namespace keys that don't exist:

- `extractor-tool.ts` (lines 2622, 2631, 2641, 2664)
- `mixer-tool.ts` (lines 1515, 1559, 1582)
- `swatch-tool.ts` (lines 1291, 1300, 1310, 1333)

These should use the existing `harmony.*` keys:
- `toast.addedToComparison` → `harmony.addedToComparison`
- `toast.addedToMixer` → `harmony.addedToMixer`
- `toast.addedToAccessibility` → `harmony.addedToAccessibility`
- `toast.copiedToClipboard` → `common.copiedToClipboard`

---

## Implementation Plan

### Phase 1: Add Translation Keys
1. Add all new keys to `en.json`
2. Add translations to other locale files (ja, de, fr, ko, zh)

### Phase 2: Fix Hardcoded Strings
1. Update `extractor-tool.ts` (7 changes)
2. Update `preset-detail-view.ts` (9 changes)
3. Update `preset-submission-form.ts` (8 changes)
4. Update `preset-edit-form.ts` (8 changes)
5. Update `v4/preset-detail.ts` (9 changes)
6. Update `v4/preset-tool.ts` (5 changes)
7. Update `v4/dye-palette-drawer.ts` (2 changes)

### Phase 3: Fix Wrong Namespace
1. Update `extractor-tool.ts` - change `toast.*` to correct namespaces
2. Update `mixer-tool.ts` - change `toast.*` to correct namespaces
3. Update `swatch-tool.ts` - change `toast.*` to correct namespaces

---

## Testing Checklist

After implementation:

- [ ] All toast messages appear correctly in English
- [ ] Switch to each of 6 languages and verify translations
- [ ] Test preset submission flow (login prompt, success, errors)
- [ ] Test preset editing flow
- [ ] Test preset deletion flow
- [ ] Test voting flow (add vote, remove vote, already voted)
- [ ] Test share/copy link functionality
- [ ] Test extractor palette extraction
- [ ] Verify no console warnings for missing keys

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Claude Code | Initial ToastService audit |
