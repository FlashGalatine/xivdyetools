# Internationalization (i18n) Audit Report: xivdyetools-web-app

**Project:** XIV Dye Tools Web Application
**Date:** January 20, 2026
**Auditor:** Claude Code
**Framework:** TypeScript, Custom LanguageService + @xivdyetools/core LocalizationService
**Supported Languages:** English (en), Japanese (ja), German (de), French (fr), Korean (ko), Chinese (zh)

---

## Executive Summary

This audit assesses the internationalization completeness and compliance of the XIV Dye Tools web application, following up on the January 17, 2026 audit.

**Overall Assessment: GOOD (7.5/10)** *(improved from 7/10)*

The application maintains a well-designed i18n architecture with comprehensive translation coverage. The validation script confirms all 1,018 referenced translation keys are valid. However, structural completeness issues were identified in the Korean and Chinese locale files.

| Severity | Count | Status |
|----------|-------|--------|
| High | 1 | Missing keys in ko.json/zh.json |
| Medium | 1 | Unused keys (316 orphaned) |
| Low | 1 | Duplicate key definition in en.json |
| Informational | 2 | Documented |

---

## Key Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Translation Keys (en.json) | 1,041 | Excellent |
| Keys Referenced in Code | 725 | Active |
| Unused/Orphaned Keys | 316 | Review recommended |
| Supported Languages | 6 | Complete (matches FFXIV) |
| Validation Script Status | PASS | All 1,018 references valid |

---

## Locale File Comparison

| Locale | File | Lines | Keys | Status |
|--------|------|-------|------|--------|
| English | en.json | 1,214 | 1,041 | Reference |
| Japanese | ja.json | 1,209 | ~1,036 | 5 lines fewer |
| German | de.json | 1,209 | ~1,036 | 5 lines fewer |
| French | fr.json | 1,210 | ~1,037 | 4 lines fewer |
| Korean | ko.json | 1,193 | ~1,024 | **21 lines fewer** |
| Chinese | zh.json | 1,193 | ~1,024 | **21 lines fewer** |

---

## Critical Finding: Missing Keys in Korean & Chinese

Both `ko.json` and `zh.json` are missing the following 17 keys in the `config` section:

```
config.advancedSettings
config.resetSettings
config.resetSettingsConfirm
config.clearDyes
config.clearDyesConfirm
config.clearFavorites
config.clearFavoritesConfirm
config.clearPalettes
config.clearPalettesConfirm
config.resetTutorial
config.performanceMode
config.performanceModeDesc
config.enableAnalytics
config.analyticsDesc
config.exportSettings
config.importSettings
config.importError
```

**Impact:** Users with Korean or Chinese language settings will see English fallback text for:
- Advanced Settings panel header
- All reset/clear action buttons and confirmation dialogs
- Performance mode toggle and description
- Analytics toggle and description
- Import/Export settings functionality

**Root Cause:** The Advanced Settings feature was likely added after the initial ko/zh translations, and the new keys were not propagated to these locale files.

---

## Structural Differences

### Japanese/German/French (5 lines fewer)
Minor differences likely due to:
- Whitespace/formatting variations
- Single duplicate key in en.json (`common.close` appears on both line 29 and line 137)

### Korean/Chinese (21 lines fewer)
Missing the entire Advanced Settings key block (17 keys = ~21 lines with JSON formatting).

---

## Validation Results

```
npm run validate:i18n

✅ All 1018 translation key references are valid!
📊 Summary:
   • Total keys in en.json: 1041
   • Keys referenced in code: 725
   • Total references checked: 1018
```

**Note:** The validation script only checks that referenced keys exist - it does not:
1. Verify structural completeness across all locale files
2. Detect missing keys in non-English locales
3. Flag unused/orphaned keys

---

## Comparison to Previous Audit (2026-01-17)

| Issue | Previous Status | Current Status |
|-------|-----------------|----------------|
| P1-001: my-submissions-panel.ts hardcoded strings | Resolved | Verified resolved |
| P1-002: image-upload-display.ts error messages | Resolved | Verified resolved |
| ToastService i18n wrapper | Medium priority | Still recommended |
| Fallback pattern cleanup | Medium priority | Ongoing |
| Build-time validation | Recommended | Partially implemented |

**New Issues Found:**
- Missing keys in ko.json/zh.json (17 keys each)
- Duplicate `common.close` key in en.json

---

## Priority Action Items

### P1 - Critical (Immediate)

1. **Add missing keys to ko.json**
   - Copy keys from en.json lines 292-308
   - Translate to Korean
   - Estimated effort: 30 minutes

2. **Add missing keys to zh.json**
   - Copy keys from en.json lines 292-308
   - Translate to Chinese
   - Estimated effort: 30 minutes

### P2 - High (This Sprint)

3. **Remove duplicate `common.close` from en.json**
   - Delete duplicate definition (line 29 or 137)
   - Verify no impact on other locales
   - Estimated effort: 5 minutes

4. **Enhance validation script**
   - Add cross-locale structural comparison
   - Flag keys present in en.json but missing in other locales
   - Estimated effort: 2 hours

### P3 - Medium (Next Sprint)

5. **Audit unused keys**
   - 316 keys defined but never referenced
   - Determine if orphaned or for future features
   - Consider removal for bundle size reduction
   - Estimated effort: 2-3 hours

---

## FFXIV Terminology Compliance

**Status: FULLY COMPLIANT** (unchanged from previous audit)

All FFXIV game terminology is sourced from official data via `@xivdyetools/core`:
- 125 dye names
- 9 category names
- 15+ acquisition methods
- 8 races, 16 clans
- Official Japanese/German/French/Korean/Chinese game data

---

## Related Documents

- [01-I18N-MISSING-KEYS-DETAIL.md](./01-I18N-MISSING-KEYS-DETAIL.md) - Detailed missing key analysis
- [02-I18N-UNUSED-KEYS-ANALYSIS.md](./02-I18N-UNUSED-KEYS-ANALYSIS.md) - Unused/orphaned keys analysis
- Previous audit: [../2026-01-17/00-I18N-AUDIT-EXECUTIVE-SUMMARY.md](../2026-01-17/00-I18N-AUDIT-EXECUTIVE-SUMMARY.md)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | Claude Code | Initial audit - follow-up to 2026-01-17 |
| 1.1 | 2026-01-20 | Claude Code | P1 resolved: Added 17 keys to ko.json, zh.json |
| 1.2 | 2026-01-20 | Claude Code | P2 resolved: Removed duplicate common section, enhanced validation |
| 1.3 | 2026-01-20 | Claude Code | Added accessibility.shareAs to all locales |
| 1.4 | 2026-01-20 | Claude Code | P3 analysis: Unused keys audit complete |
| 1.5 | 2026-01-20 | Claude Code | P3 resolved: Removed 20 orphaned keys, all locales now at 1,021 keys |
