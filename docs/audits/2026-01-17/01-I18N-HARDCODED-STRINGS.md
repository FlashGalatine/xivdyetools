# i18n Audit: Hardcoded Strings Inventory

**Project:** xivdyetools-web-app
**Date:** January 17, 2026
**Focus:** User-facing strings that bypass the i18n system

---

## Overview

This document catalogs all hardcoded strings found in the web application that should be using the `LanguageService.t()` translation system. These strings will display in English regardless of the user's selected language.

---

## HIGH-001: my-submissions-panel.ts ✅ RESOLVED

**File:** `src/components/my-submissions-panel.ts`
**Severity:** High
**Impact:** Entire "My Submissions" feature displays in English only
**Status:** ✅ **RESOLVED** (2026-01-17)

### Hardcoded Strings Found

| Line | Current Code | Recommended Key | Notes |
|------|--------------|-----------------|-------|
| 56 | `'Sign in to view your submissions'` | `preset.signInToViewSubmissions` | New key needed |
| 71 | `'My Submissions'` | `preset.mySubmissions` | **Key EXISTS but not used!** |
| 80 | `'aria-label': 'Refresh submissions'` | `aria.refreshSubmissions` | New key needed |
| 149 | `'Loading your submissions...'` | `preset.loadingSubmissions` | New key needed |
| 162 | `'Failed to load submissions. Please try again.'` | `errors.failedToLoadSubmissions` | New key needed |
| 186 | `"You haven't submitted any presets yet."` | `preset.noSubmissionsYet` | New key needed |
| 192 | `'Click "Submit Preset" above to share...'` | `preset.submitPresetHint` | New key needed |
| 332 | `'Dyes'` | `common.dyes` | **Key EXISTS but not used!** |
| 375 | `'Tags'` | `preset.tags` | **Key EXISTS but not used!** |
| 402 | `${preset.vote_count} vote${...}` | `preset.voteCount` | Needs pluralization |
| 418 | `'✏️ Edit'` | `preset.edit` | **Key EXISTS but not used!** |
| 427 | `'🗑️ Delete'` | `preset.delete` | **Key EXISTS but not used!** |
| 470 | `confirm('Are you sure you want to delete...')` | `preset.confirmDelete` | **Key EXISTS but not used!** |
| 518 | `alert(result.error \|\| 'Failed to delete preset')` | `errors.failedToDeletePreset` | New key needed |
| 522 | `alert('Failed to delete preset. Please try again.')` | `errors.failedToDeletePreset` | New key needed |

### Code Example: Current vs. Recommended

**Current (Line 71):**
```typescript
const title = this.createElement('h3', {
  className: 'text-lg font-semibold text-gray-900 dark:text-white',
  textContent: 'My Submissions',  // Hardcoded English
});
```

**Recommended:**
```typescript
const title = this.createElement('h3', {
  className: 'text-lg font-semibold text-gray-900 dark:text-white',
  textContent: LanguageService.t('preset.mySubmissions'),  // Uses existing key!
});
```

### Key Observation

**5 of the 15 hardcoded strings have existing translation keys that are simply not being used:**
- `preset.mySubmissions` (Line 981 in en.json)
- `common.dyes` (Line 126 in en.json)
- `preset.tags` (Line 88 in en.json)
- `preset.edit` (Line 995 in en.json)
- `preset.delete` (Line 996 in en.json)
- `preset.confirmDelete` (Line 998 in en.json)

This suggests the component was developed without awareness of the existing i18n keys.

---

## HIGH-002: image-upload-display.ts ✅ RESOLVED

**File:** `src/components/image-upload-display.ts`
**Severity:** High
**Impact:** Error messages display in English only
**Status:** ✅ **RESOLVED** (2026-01-17)

### Hardcoded Strings Found

| Line | Current Code | Recommended Key | Notes |
|------|--------------|-----------------|-------|
| 324 | `'Please select an image file'` | `errors.pleaseSelectImageFile` | New key needed |
| 330 | `'Image must be smaller than 20MB'` | `errors.imageTooLarge` | Key exists but message differs |
| 341 | `'Failed to read image'` | `errors.failedToReadImage` | New key needed |
| 362 | `'Failed to load image'` | `errors.failedToLoadImage` | New key needed |
| 374 | `'Failed to read file'` | `errors.failedToReadFile` | New key needed |

### Code Example: Current vs. Recommended

**Current (Line 324):**
```typescript
if (!file.type.startsWith('image/')) {
  this.emit('error', { message: 'Please select an image file' });
  return;
}
```

**Recommended:**
```typescript
if (!file.type.startsWith('image/')) {
  this.emit('error', { message: LanguageService.t('errors.pleaseSelectImageFile') });
  return;
}
```

### Note on Error Handling Pattern

The `emit('error', { message: string })` pattern is used throughout the component. The consumer of these events should also handle i18n, but the source should still emit localized messages.

---

## MEDIUM-001: Alert/Confirm Dialogs

**Files:** Multiple components
**Severity:** Medium
**Impact:** Browser native dialogs show English text

### Instances Found

| File | Line | Current Code |
|------|------|--------------|
| `my-submissions-panel.ts` | 470 | `confirm('Are you sure you want to delete this preset?...')` |
| `my-submissions-panel.ts` | 518 | `alert(result.error \|\| 'Failed to delete preset')` |
| `my-submissions-panel.ts` | 522 | `alert('Failed to delete preset. Please try again.')` |

### Recommendation

Replace native `alert()` and `confirm()` with custom modal dialogs that support i18n:

```typescript
// Current (not i18n-friendly)
if (confirm('Are you sure you want to delete this preset?')) {
  // delete
}

// Recommended (using ModalService)
const confirmed = await ModalService.confirm({
  title: LanguageService.t('preset.deleteTitle'),
  message: LanguageService.t('preset.confirmDelete'),
  confirmText: LanguageService.t('common.delete'),
  cancelText: LanguageService.t('common.cancel'),
});
```

---

## LOW-001: Aria Labels

**Files:** Multiple components
**Severity:** Low
**Impact:** Screen reader users in non-English locales

### Instances Found

| File | Line | Current Pattern |
|------|------|-----------------|
| `app-layout.ts` | ~124 | `'aria-label': 'XIV Dye Tools Logo'` |
| `app-layout.ts` | ~130 | `'aria-label': 'About XIV Dye Tools'` |
| `my-submissions-panel.ts` | 80 | `'aria-label': 'Refresh submissions'` |

### Note

While aria-labels being in English may be acceptable for some accessibility tools, proper i18n would improve the experience for screen reader users in other locales.

---

## Summary: New Translation Keys Needed

### For `src/locales/en.json` (and all other locales)

```json
{
  "preset": {
    "signInToViewSubmissions": "Sign in to view your submissions",
    "loadingSubmissions": "Loading your submissions...",
    "noSubmissionsYet": "You haven't submitted any presets yet.",
    "submitPresetHint": "Click \"Submit Preset\" above to share your color palettes!",
    "voteCount": "{count} vote(s)",
    "deleteTitle": "Delete Preset"
  },
  "errors": {
    "failedToLoadSubmissions": "Failed to load submissions. Please try again.",
    "failedToDeletePreset": "Failed to delete preset. Please try again.",
    "pleaseSelectImageFile": "Please select an image file",
    "failedToReadImage": "Failed to read image",
    "failedToLoadImage": "Failed to load image",
    "failedToReadFile": "Failed to read file"
  },
  "aria": {
    "refreshSubmissions": "Refresh submissions",
    "xivDyeToolsLogo": "XIV Dye Tools Logo",
    "aboutXivDyeTools": "About XIV Dye Tools"
  }
}
```

### Total New Keys: 14
### Existing Keys Needing Connection: 6

---

## Verification Checklist

After implementing fixes:

- [x] All strings in `my-submissions-panel.ts` use LanguageService ✅ (2026-01-17)
- [x] All error messages in `image-upload-display.ts` use LanguageService ✅ (2026-01-17)
- [x] New keys added to all 6 locale files (en, ja, de, fr, ko, zh) ✅ (2026-01-17)
- [x] Native `confirm()` uses i18n for message text ✅ (2026-01-17)
- [ ] Test language switching on affected pages

### Resolution Notes (2026-01-17)

- **14 new translation keys** added to all 6 locale files
- **15 hardcoded strings** in `my-submissions-panel.ts` replaced with `LanguageService.t()` calls
- **5 error messages** in `image-upload-display.ts` now use i18n
- Native `confirm()` dialogs retained but now use translated message text
- Vote count uses pluralization pattern with `voteCount` (singular) and `votesCount` (plural) keys
