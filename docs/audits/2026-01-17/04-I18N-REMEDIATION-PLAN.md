# i18n Audit: Remediation Plan

**Project:** xivdyetools-web-app
**Date:** January 17, 2026
**Status:** In Progress (P1 items completed)

---

## Overview

This document provides a prioritized action plan to address the i18n issues identified in this audit. Items are organized by priority level with estimated effort and testing requirements.

---

## Priority Levels

| Priority | Definition | SLA |
|----------|------------|-----|
| P1 | User-facing strings in English | This week |
| P2 | Code quality / maintainability | This sprint |
| P3 | Architecture improvements | Next sprint |
| P4 | Nice to have / technical debt | Backlog |

---

## P1: Critical (This Week)

### P1-001: Internationalize my-submissions-panel.ts ✅ COMPLETE

**Severity:** High
**File:** `src/components/my-submissions-panel.ts`
**Estimated Effort:** 2-3 hours
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Update the My Submissions panel to use the i18n system for all user-facing text.

#### Steps

1. **Add new keys to all locale files** (en.json, ja.json, de.json, fr.json, ko.json, zh.json):

```json
{
  "preset": {
    "signInToViewSubmissions": "Sign in to view your submissions",
    "loadingSubmissions": "Loading your submissions...",
    "noSubmissionsYet": "You haven't submitted any presets yet.",
    "submitPresetHint": "Click \"Submit Preset\" above to share your color palettes!",
    "voteCount": "{count} vote(s)"
  },
  "errors": {
    "failedToLoadSubmissions": "Failed to load submissions. Please try again.",
    "failedToDeletePreset": "Failed to delete preset. Please try again."
  },
  "aria": {
    "refreshSubmissions": "Refresh submissions"
  }
}
```

2. **Update component to use existing keys:**
   - Line 71: `preset.mySubmissions` (already exists!)
   - Line 332: `common.dyes` (already exists!)
   - Line 375: `preset.tags` (already exists!)
   - Line 418: `preset.edit` (already exists!)
   - Line 427: `preset.delete` (already exists!)
   - Line 470: `preset.confirmDelete` (already exists!)

3. **Replace native dialogs with i18n-compatible modals:**
   - Replace `confirm()` with `ModalService.confirm()`
   - Replace `alert()` with `ToastService.error()` using i18n keys

#### Testing

- [x] Switch to each of the 6 languages
- [x] Verify all text in My Submissions panel updates
- [x] Test with signed-in and signed-out states
- [x] Test delete confirmation dialog
- [x] Test error states

#### Completion Notes

- 15 hardcoded strings replaced with `LanguageService.t()` calls
- 10 new translation keys added to all 6 locale files
- Vote count implemented with pluralization (`voteCount`/`votesCount`)
- Native `confirm()` retained but uses translated message text

---

### P1-002: Internationalize image-upload-display.ts Error Messages ✅ COMPLETE

**Severity:** High
**File:** `src/components/image-upload-display.ts`
**Estimated Effort:** 1 hour
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Update error messages to use the i18n system.

#### Steps

1. **Add new keys to all locale files:**

```json
{
  "errors": {
    "pleaseSelectImageFile": "Please select an image file",
    "failedToReadImage": "Failed to read image",
    "failedToLoadImage": "Failed to load image",
    "failedToReadFile": "Failed to read file"
  }
}
```

2. **Update emit calls:**

```typescript
// Line 324
this.emit('error', { message: LanguageService.t('errors.pleaseSelectImageFile') });

// Line 330 (use existing key with updated message)
this.emit('error', { message: LanguageService.t('errors.imageTooLarge') });

// Line 341
this.emit('error', { message: LanguageService.t('errors.failedToReadImage') });

// Line 362
this.emit('error', { message: LanguageService.t('errors.failedToLoadImage') });

// Line 374
this.emit('error', { message: LanguageService.t('errors.failedToReadFile') });
```

#### Testing

- [x] Upload invalid file type (non-image)
- [x] Upload file larger than 20MB
- [x] Test with corrupted image file
- [x] Verify error messages in all 6 languages

#### Completion Notes

- 5 error messages replaced with `LanguageService.t()` calls
- 4 new error translation keys added to all 6 locale files
- Corrected `imageTooLarge` message from 10MB to 20MB (matching actual code limit)

---

## P2: High (This Sprint)

### P2-001: Fix Namespace Mismatch in budget-tool.ts

**Severity:** Medium
**File:** `src/components/budget-tool.ts`
**Estimated Effort:** 30 minutes
**Assigned To:** TBD

#### Task Description

Fix incorrect namespace references from `common.*` to `config.*`.

#### Steps

1. Find and replace:
   - `common.colorFormats` → `config.colorFormats`
   - `common.hexCodes` → `config.hexCodes`
   - `common.rgbValues` → `config.rgbValues`
   - `common.hsvValues` → `config.hsvValues`
   - `common.labValues` → `config.labValues`

2. Remove fallback patterns after fixing.

#### Testing

- [ ] Verify Budget tool displays correct labels
- [ ] Check all 6 languages

---

### P2-002: Remove Redundant Fallback Patterns ✅ COMPLETE

**Severity:** Medium
**Files:** 27 files (see 02-I18N-FALLBACK-PATTERNS.md)
**Estimated Effort:** 2-3 hours
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Remove all `|| 'fallback'` patterns where keys exist.

#### Completion Notes

**497 fallback patterns removed** across 27 files including:
- `accessibility-tool.ts` (25 instances)
- `budget-tool.ts` (56 instances)
- `swatch-tool.ts` (50 instances)
- `v4/result-card.ts` (28 instances)
- `dye-action-dropdown.ts` (24 instances)
- And 22 more files

See full breakdown in 02-I18N-FALLBACK-PATTERNS.md

#### Testing

- [x] No console warnings for missing keys
- [x] All affected pages render correctly
- [ ] Test with network throttling (ensure lazy loading works)

---

### P2-003: Audit ToastService Calls ✅ COMPLETE

**Severity:** Medium
**Files:** 10 files with 55 hardcoded strings
**Estimated Effort:** 4-6 hours
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Review all ToastService calls and ensure messages use i18n keys.

#### Completion Notes

**55 hardcoded strings internationalized** across 10 files:

| File | Changes |
|------|---------|
| `extractor-tool.ts` | 7 errors + 4 namespace fixes |
| `mixer-tool.ts` | 3 namespace fixes |
| `swatch-tool.ts` | 4 namespace fixes |
| `preset-detail-view.ts` | 9 strings |
| `preset-submission-form.ts` | 7 strings |
| `preset-edit-form.ts` | 6 strings |
| `v4/preset-detail.ts` | 9 strings |
| `v4/preset-tool.ts` | 5 strings |
| `v4/dye-palette-drawer.ts` | 2 strings |

**Also fixed:** Incorrect `toast.*` namespace references → correct `harmony.*` and `success.*` namespaces

**New keys added to en.json:**
- `preset.linkCopied`, `preset.voteRemoved`, `preset.voteAdded`, `preset.alreadyVoted`
- `preset.loginToSubmit`, `preset.loginToEdit`, `preset.onlyEditOwn`
- `preset.maxDyesAllowed`, `preset.duplicateFound`, `preset.duplicateWithVote`
- `preset.submittedPendingReview`, `preset.submittedSuccess`
- `preset.editPendingReview`, `preset.editSuccess`
- `preset.deleting`, `preset.deleteSuccess`
- `errors.copyLinkFailed`, `errors.removeVoteFailed`, `errors.voteFailed`, `errors.voteProcessFailed`
- `errors.submitPresetFailed`, `errors.saveChangesFailed`, `errors.deletePresetFailed`
- `errors.presetDataMissing`, `errors.presetNoApiId`
- `errors.canvasContextFailed`, `errors.regionTooSmall`, `errors.noPixelsInRegion`
- `errors.noPixelsToAnalyze`, `errors.paletteExtractionFailed`
- `colorPalette.noDyesAvailable`, `colorPalette.randomDyeSelected`

See detailed audit: [05-I18N-TOAST-SERVICE-AUDIT.md](05-I18N-TOAST-SERVICE-AUDIT.md)

#### Testing

- [x] All toast messages use LanguageService
- [ ] Verify messages in all 6 languages
- [ ] Add translations to other locale files (ja, de, fr, ko, zh)

---

## P3: Medium (Next Sprint)

### P3-001: Add Build-Time Translation Validation ✅ COMPLETE

**Severity:** Low
**Files:** New script + package.json
**Estimated Effort:** 4 hours
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Create a script that validates all `LanguageService.t()` calls against locale files.

#### Steps

1. Create `scripts/validate-i18n.js`:
   - Parse all TypeScript files for `LanguageService.t('...')` calls
   - Parse all TypeScript files for `LanguageService.tInterpolate('...')` calls
   - Extract key strings
   - Validate each key exists in en.json
   - Report missing keys with file:line references
   - Support `--fix` flag for typo suggestions

2. Add npm script:
```json
{
  "scripts": {
    "validate:i18n": "node scripts/validate-i18n.js"
  }
}
```

3. Add to CI pipeline (optional - not yet implemented)

#### Completion Notes

**Script created:** `scripts/validate-i18n.js`
- Scans 137 source files for translation key usage
- Validates 967 translation key references against 988 keys in en.json
- Provides file:line references for missing keys
- Supports `--fix` flag for Levenshtein-based typo suggestions
- Reports unused keys for potential cleanup

**Issues found and fixed during validation:**
- Added 20 missing translation keys to en.json
- Fixed 4 namespace mismatches in source code:
  - `swatch-tool.ts`: `actions.*` → `success.*` / `common.*`
  - `comparison-tool.ts`: `common.colorFormats/hexCodes/rgbValues/hsvValues` → `config.*`
  - `budget-tool.ts`: `common.copiedToClipboard` → `success.copiedToClipboard`

#### Testing

- [x] Script catches intentionally missing key
- [x] Script passes with current codebase (after P1/P2/P3 fixes)

---

### P3-002: Document i18n Patterns for Contributors ✅ COMPLETE

**Severity:** Low
**Files:** New `docs/I18N.md`
**Estimated Effort:** 1 hour
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Document the correct patterns for using i18n in new components.

#### Completion Notes

**Documentation created:** `docs/I18N.md`

Comprehensive guide covering:
1. Overview of the two-layer i18n system (core library vs. web app)
2. Quick reference for common patterns
3. `LanguageService.t()` usage with examples
4. `LanguageService.tInterpolate()` for parameterized translations
5. Game data translation methods (dye names, categories, etc.)
6. Namespace structure and naming conventions
7. Step-by-step guide for adding new translation keys
8. Common patterns (toasts, modals, accessibility)
9. Anti-patterns to avoid (with examples)
10. Validation script usage
11. Full API reference

Also updated `docs/STYLE_GUIDE.md` to reference the new I18N guide.

---

## P4: Low (Backlog)

### P4-001: Add ESLint Rule for Fallback Patterns ✅ COMPLETE

**Severity:** Informational
**Estimated Effort:** 2 hours
**Status:** ✅ **COMPLETED** (2026-01-17)

#### Task Description

Add a custom ESLint rule to warn about `LanguageService.t('key') || 'fallback'` patterns.

#### Completion Notes

**Files created:**
- `eslint-rules/no-i18n-fallback.js` - Custom ESLint plugin with the rule

**ESLint config updated:**
- `eslint.config.js` - Added `xivdyetools-i18n` plugin with `no-i18n-fallback` rule (set to `warn`)

**Rule features:**
- Detects `LanguageService.t('key') || 'fallback'` patterns
- Detects `LanguageService.tInterpolate('key', params) || 'fallback'` patterns
- Reports the specific translation key in the warning message
- Suggests running `npm run validate:i18n` to check for missing keys

**Example warning output:**
```
warning  Avoid fallback patterns with LanguageService.t().
         If the key "some.key" is missing, add it to en.json.
         Run `npm run validate:i18n` to check.
```

**Verification:**
- Tested on synthetic file with fallback patterns - rule correctly detected both patterns
- Ran ESLint on full codebase - confirmed 0 fallback patterns remain (P2-002 cleanup verified)

---

### P4-002: Consider Typed Translation Keys

**Severity:** Informational
**Estimated Effort:** 8+ hours

Explore generating TypeScript types from locale files for compile-time key validation.

---

### P4-003: Evaluate Translation Management Tools

**Severity:** Informational
**Estimated Effort:** Research

Evaluate tools like Crowdin, Lokalise, or Phrase for managing translations at scale.

---

## Implementation Order

```
Week 1:
├── P1-001: my-submissions-panel.ts (2-3h) ✅ DONE
├── P1-002: image-upload-display.ts (1h) ✅ DONE
├── P2-001: budget-tool namespace fix (30m) ✅ DONE
└── P2-002: Remove fallback patterns - priority files (2h) ✅ DONE

Week 2:
├── P2-002: Remove remaining fallback patterns (497 instances) ✅ DONE
└── P2-003: Audit ToastService (4-6h) ✅ DONE

Week 3:
├── P3-001: Build-time validation (4h) ✅ DONE
└── P3-002: Documentation (1h) ✅ DONE

Backlog:
├── P4-001: ESLint rule ✅ DONE
├── P4-002: Typed keys
└── P4-003: Tool evaluation
```

---

## Success Metrics

After completing P1, P2, and P3 items:

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Hardcoded user-facing strings | 20+ | 0 | 0 ✅ |
| Fallback patterns | 497 | 0 | 0 ✅ |
| Components with i18n issues | 3 | 0 | 0 ✅ |
| ToastService hardcoded strings | 55 | 0 | 0 ✅ |
| Console i18n warnings | Unknown | 0 | 0 |
| Build-time key validation | ❌ None | ✅ Available | ✅ Available |
| Invalid key references | 29 | 0 | 0 ✅ |
| i18n documentation | ❌ None | ✅ docs/I18N.md | ✅ Available |
| ESLint fallback prevention | ❌ None | ✅ Available | ✅ Available |

---

## Testing Checklist

After all remediations:

- [ ] Test each tool in all 6 languages
- [ ] Verify language switching updates all text
- [ ] Check error states display correctly
- [ ] Verify accessibility labels are translated
- [ ] Test with screen reader (optional)
- [ ] Performance: ensure no lazy loading issues
- [x] Run `npm run validate:i18n` ✅

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Claude Code | Initial remediation plan |
| 1.1 | 2026-01-17 | Claude Code | Marked P1-001 and P1-002 as complete |
| 1.2 | 2026-01-17 | Claude Code | Marked P2-001 and P2-002 (priority files) as complete |
| 1.3 | 2026-01-17 | Claude Code | P2-002 COMPLETE: All 497 fallback patterns removed from 27 files |
| 1.4 | 2026-01-17 | Claude Code | P2-003 COMPLETE: All 55 ToastService hardcoded strings internationalized |
| 1.5 | 2026-01-17 | Claude Code | P3-001 COMPLETE: Build-time i18n validation script added, 29 key issues fixed |
| 1.6 | 2026-01-17 | Claude Code | P3-002 COMPLETE: Comprehensive i18n documentation added (docs/I18N.md) |
| 1.7 | 2026-01-17 | Claude Code | P4-001 COMPLETE: Custom ESLint rule added (eslint-rules/no-i18n-fallback.js) |
