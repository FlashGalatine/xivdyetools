# Internationalization (i18n) Audit Report: xivdyetools-web-app

**Project:** XIV Dye Tools Web Application
**Date:** January 17, 2026
**Auditor:** Claude Code
**Framework:** TypeScript, Custom LanguageService + @xivdyetools/core LocalizationService
**Supported Languages:** English (en), Japanese (ja), German (de), French (fr), Korean (ko), Chinese (zh)

---

## Executive Summary

This audit assesses the internationalization completeness and compliance of the XIV Dye Tools web application across its 6 supported languages and 61+ components.

**Overall Assessment: GOOD (7/10)**

The application has a well-designed i18n architecture with comprehensive translation coverage. However, several recent features have hardcoded strings that bypass the translation system, and there's an excessive use of defensive fallback patterns that should be cleaned up.

| Severity | Count | Status |
|----------|-------|--------|
| High | 3 | 2 Resolved (P1-001, P1-002), 1 Remaining |
| Medium | 2 | Should fix |
| Low | 2 | Nice to have |
| Informational | 5+ | Documented |

---

## Key Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total Translation Keys | 1,090+ | Excellent |
| Supported Languages | 6 | Complete (matches FFXIV) |
| Components Using i18n | 61 | Good coverage |
| Hardcoded String Issues | 20+ | Needs attention |
| Fallback Pattern Instances | 50+ | Should review |
| FFXIV Terminology Compliance | 100% | Via core library |

---

## Architecture Assessment

### Strengths

1. **Clean separation of concerns**
   - Web app UI translations: `LanguageService` + `src/locales/*.json`
   - Game data translations: `@xivdyetools/core` `LocalizationService`

2. **Reactive locale switching**
   - Subscription-based pattern allows real-time UI updates
   - No page reload required for language change

3. **Browser language detection**
   - Automatic locale detection from `navigator.language`
   - Graceful fallback to English

4. **Lazy loading**
   - Translation files loaded on-demand via dynamic imports
   - Reduces initial bundle size

5. **Type safety**
   - `LocaleCode` type ensures only valid locales are used
   - `WebAppTranslations` interface documents key structure

### Areas for Improvement

1. **No compile-time key validation**
   - Missing translation keys only caught at runtime
   - Recommendation: Add build-time validation script

2. **Excessive fallback patterns**
   - 50+ instances of `LanguageService.t('key') || 'fallback'`
   - Indicates uncertainty about key existence

3. **New features bypassing i18n**
   - `my-submissions-panel.ts` has 15+ hardcoded strings
   - Suggests lack of i18n documentation for contributors

---

## Issue Summary by File

### High Priority

| File | Issues | Type |
|------|--------|------|
| `src/components/my-submissions-panel.ts` | 15+ | Hardcoded strings |
| `src/components/image-upload-display.ts` | 5 | Hardcoded error messages |
| `src/services/toast-service.ts` | System-wide | No i18n wrapper |

### Medium Priority

| File | Issues | Type |
|------|--------|------|
| `src/components/budget-tool.ts` | 40+ | Fallback patterns |
| `src/components/changelog-modal.ts` | 5 | Fallback patterns |
| `src/components/about-modal.ts` | 3 | Fallback patterns |

### Low Priority

| File | Issues | Type |
|------|--------|------|
| `src/components/app-layout.ts` | 2-3 | Aria label fallbacks |
| `src/mockups/MockupNav.ts` | 3 | Fallback patterns |

---

## FFXIV Terminology Compliance

**Status: FULLY COMPLIANT**

The core library (`@xivdyetools/core`) handles all FFXIV game data translations and uses official terminology:

- Dye names (125 dyes)
- Category names (9 categories)
- Acquisition methods (15+ methods)
- Race/Clan names (8 races, 16 clans)
- Harmony types (9 types)
- Vision types (5 types)

All game terminology is sourced from official FFXIV data and cross-referenced with the LOCALIZATION_REFERENCE.md document.

---

## Priority Action Items

### P1 - Critical (This Week)

1. **Update `my-submissions-panel.ts`** to use LanguageService
   - Existing key `preset.mySubmissions` is available but unused
   - Add 10+ new keys to locale files
   - Estimated effort: 2-3 hours

2. **Update `image-upload-display.ts`** error messages
   - Add keys for 5 error messages
   - Use existing `errors.*` namespace
   - Estimated effort: 1 hour

### P2 - High (This Sprint)

3. **Audit ToastService calls**
   - ~50 calls pass raw English strings
   - Consider i18n wrapper for ToastService
   - Estimated effort: 4-6 hours

4. **Remove unnecessary fallback patterns**
   - Verify keys exist, then remove `|| 'fallback'`
   - Prevents key drift and maintenance burden
   - Estimated effort: 2-3 hours

### P3 - Medium (Next Sprint)

5. **Add build-time translation validation**
   - Script to compare all `LanguageService.t()` calls against en.json
   - Catch missing keys before deployment
   - Estimated effort: 4 hours

6. **Document i18n patterns for contributors**
   - Add section to CONTRIBUTING.md
   - Include examples of correct patterns
   - Estimated effort: 1 hour

---

## Related Documents

- [01-I18N-HARDCODED-STRINGS.md](./01-I18N-HARDCODED-STRINGS.md) - Detailed inventory of hardcoded strings
- [02-I18N-FALLBACK-PATTERNS.md](./02-I18N-FALLBACK-PATTERNS.md) - Analysis of fallback patterns
- [03-I18N-FFXIV-TERMINOLOGY.md](./03-I18N-FFXIV-TERMINOLOGY.md) - Terminology compliance check
- [04-I18N-REMEDIATION-PLAN.md](./04-I18N-REMEDIATION-PLAN.md) - Prioritized action items

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Claude Code | Initial audit |
| 1.1 | 2026-01-17 | Claude Code | Marked P1-001, P1-002 as resolved |
