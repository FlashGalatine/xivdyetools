# Unused Translation Keys Analysis

**Date:** January 20, 2026
**Severity:** Medium (P3)
**Tool Created:** `scripts/analyze-unused-keys.js`

---

## Executive Summary

Analysis of 1,041 translation keys in `en.json` revealed:

| Category | Count | Percentage |
|----------|-------|------------|
| Directly referenced | 746 | 71.7% |
| Dynamically referenced | 35 | 3.4% |
| Truly unused | 258 | 24.8% |
| **Effective usage** | **783** | **75.2%** |

**Potential bundle size reduction:** ~75.6 KB (if all unused keys removed from 6 locales)

---

## Dynamic Reference Detection

The analysis script detected template literal patterns that reference keys dynamically:

```javascript
LanguageService.t(`harmony.${this.harmonyType}`)
LanguageService.t(`themes.${localeKey}`)
LanguageService.t(`${tool.translationKey}.shortName`)
```

**Dynamic prefixes found:**
- `harmony.*` (60 keys) - Harmony type names and descriptions
- `themes.*` (12 keys) - Theme display names
- `harmony.types.*` (9 keys) - Harmony type descriptions

These 35 keys are NOT candidates for removal.

---

## Unused Keys by Category

### 1. Tutorial Keys (36 keys) - KEEP

```
tutorial.harmony.baseColor.title
tutorial.harmony.baseColor.description
tutorial.harmony.filters.title
tutorial.matcher.palette.title
... and 32 more
```

**Recommendation:** Keep these keys. Tutorial functionality may be re-enabled in a future release. The overhead is minimal (~10 KB across all locales).

### 2. Feature-Specific Keys (82 keys) - REVIEW

**Mixer namespace (34 keys):**
```
mixer.selectStartEnd
mixer.interpolationSteps
mixer.colorSpaceRgb
mixer.savedGradients
```

**Matcher namespace (34 keys):**
```
matcher.imageUpload
matcher.privacyNote
matcher.pickFromImage
matcher.sampleSettings
```

**Recommendation:** Review whether these features were refactored or removed. If the UI no longer uses these labels, they can be safely removed.

### 3. Common Utility Keys (20 keys) - CONSIDER KEEPING

```
common.dyes
common.generate
common.select
common.export
common.reset
common.search
common.filter
common.baseColor
common.targetColor
```

**Recommendation:** These generic labels may be useful for future features. Low overhead to keep.

### 4. Error & Feedback Keys (21 keys) - REVIEW

```
errors.invalidHex
errors.networkError
errors.clipboardFailed
success.exported
success.settingsSaved
```

**Recommendation:** Verify error handling code paths. Some may be used in try/catch blocks not detected by static analysis.

### 5. UI Component Keys (99 keys) - REVIEW

**Tools subtitles (10 keys):**
```
tools.harmony.subtitle
tools.matcher.subtitle
tools.accessibility.subtitle
```

**ColorPalette filters (12 keys):**
```
colorPalette.neutral
colorPalette.reds
colorPalette.browns
```

**Recommendation:** Check if UI was refactored to use different patterns. May be duplicates of `labelKey` references.

---

## Safe Removal Candidates

After manual review, the following categories are likely safe to remove:

| Namespace | Keys | Reason |
|-----------|------|--------|
| `welcome.*` | 5 | Welcome modal removed/refactored |
| `export.*` | 9 | Export functionality changed |
| `palette.*` | 2 | Unused UI labels |
| `auth.*` | 2 | Auth display refactored |
| `share.*` | 2 | Share functionality changed |

**Total safe to remove:** ~20 keys (~6 KB savings)

---

## Analysis Script Usage

A new analysis script has been added to the project:

```bash
# Run unused keys analysis
node scripts/analyze-unused-keys.js
```

The script:
1. Extracts all keys from `en.json`
2. Scans source files for direct `LanguageService.t()` calls
3. Detects `labelKey:` patterns for indirect references
4. Identifies dynamic template literal prefixes
5. Categorizes and reports unused keys

---

## Action Items

### Immediate (Optional)
- [ ] Remove 20 clearly orphaned keys (welcome, export, palette, auth, share)
- [ ] Verify error keys are not used in error boundaries

### Future Sprint
- [ ] Audit mixer/matcher keys against current UI
- [ ] Decide on tutorial keys retention
- [ ] Consider lazy-loading translation files by feature

---

## Notes

- The `labelKey` pattern is used extensively for data-driven UI components
- Some keys may be used in unit tests only
- Bundle size impact is relatively small (~75 KB across 6 locales)
- Keeping unused keys has minimal runtime performance impact
