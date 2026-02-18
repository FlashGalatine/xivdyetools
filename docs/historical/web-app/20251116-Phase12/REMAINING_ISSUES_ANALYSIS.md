# Remaining Issues Analysis - Phase 12.5/12.6

**Date**: November 16, 2025
**Status**: 6 fixes complete, 8 issues remaining
**Priority Triage**: Critical (2), High (4), Medium (2)

---

## 📊 Issues Summary by Status

### ✅ FIXED (6 issues)
1. Theme colors not changing
2. Harmony text unreadable (white-on-white)
3. Color Matcher image disappears
4. Distance explanation missing
5. Dye selection bloat (Facewear exclusion in selector)
6. Theme backgrounds not updating

### ⚠️ PARTIALLY ADDRESSED (1 issue)
7. Facewear exclusion - Done in selector UI, but **still appears in results**

### 🔴 REMAINING (8 issues)
8-15. [Listed below by priority]

---

## 🔴 CRITICAL ISSUES (Must Fix)

### Issue #8: Button Text Contrast Bug 🎨
**File**: `src/styles/themes.css`
**Severity**: High
**Screenshot**: image1.png

**Problem**:
- Tool selector buttons (Harmony, Matcher, etc.) have blue text on blue background
- Text color unreadable in some themes
- Root cause: CSS override is making all button text use `--theme-primary` color

**Visual Impact**:
```
❌ Blue button with blue text (unreadable)
✅ Should be: White text on colored button, or darker button background
```

**Affected**:
- Tool navigation buttons
- Category filter buttons in dye selector
- Other blue/colored buttons

**Fix Approach**:
- Add `color: white !important;` to `.bg-blue-600` and similar colored buttons
- OR ensure button text color contrasts with background
- Override text color for buttons to be white when background is primary

---

### Issue #9: Enable Dual Dyes Container Not Themed 🎨
**File**: Likely `src/components/accessibility-checker-tool.ts`
**Severity**: High
**Screenshot**: image2.png

**Problem**:
- "Enable Dual Dyes (secondary colors)" checkbox container stays light gray/white
- Doesn't change color when switching themes
- Appears as white box in dark themes, breaks visual consistency

**Affected**: Accessibility Checker tool only

**Root Cause**:
- The container styling is hardcoded or not using theme CSS variables
- CSS selector might not be covering this specific element

**Fix Approach**:
- Find the container element in accessibility-checker-tool.ts
- Ensure it uses theme background/text colors
- May need to add specific CSS selector in themes.css

---

### Issue #10: Deviance Values Display as "Censored" Boxes 📊
**Files**: Multiple
**Severity**: High
**Screenshots**: image5a.png, image5b.png

**Problem**:
- Deviance values show as light blue boxes with word "deviance" instead of numbers
- Affects:
  - Harmony Explorer (some cards show "deviance" label but number is in blue box)
  - Dye Mixer (similar issue with distance/deviance display)

**Visual**:
```
❌ Shows: [light blue box] deviance
✅ Should show: 2.5 deviance
```

**Root Cause**:
- CSS styling of `.deviance` elements might be using `color: var(--theme-primary)`
- Or the text property is set to something that hides/colors the numbers

**Fix Approach**:
- Check CSS for `.deviance` styling
- Ensure numerical text is visible with proper color
- May need to adjust color in themes.css for deviance labels

---

## 🟠 HIGH PRIORITY ISSUES (Should Fix)

### Issue #11: Facewear Still in Harmony Results 🎭
**File**: `src/components/harmony-generator-tool.ts`
**Severity**: High
**Screenshot**: image5a.png (shows Red, Green, Shadow Blue as Facewear)

**Problem**:
- User excluded Facewear from dye selector
- BUT Harmony Explorer still suggests Facewear dyes in results
- Example: Triadic shows "Red (Facewear)", "Green (Facewear)"

**Impact**:
- User expectations not met (selected filter not applied to results)
- Clutters harmony results with irrelevant dyes

**Fix Approach**:
- In HarmonyGeneratorTool or harmony calculation logic
- Filter out Facewear category when generating harmony suggestions
- Add option to `excludeFacewear` like we did for DyeSelector

**Estimate**: 15 minutes

---

### Issue #12: Facewear Still in Dye Mixer Suggestions 🎭
**File**: `src/components/dye-mixer-tool.ts`
**Severity**: High

**Problem**:
- Dye Mixer shows Facewear dyes in intermediate dye suggestions
- Same as Issue #11 but for different tool

**Fix Approach**:
- In `findClosestDye()` or `findDyesWithinDistance()` functions
- Filter out Facewear when generating results
- OR pass `excludeFacewear` option through the calculation

**Estimate**: 15 minutes

---

### Issue #13: Harmony Results - Too Many Suggestions 🎪
**File**: `src/services/harmony-service.ts` (or calculation logic)
**Severity**: High
**Screenshot**: image5a.png (Analogous has 12+ dyes)

**Problem**:
- Analogous harmony shows 12+ dyes (way too many)
- Split-Complementary also shows excessive dyes
- Should show top 4-6 matches based on deviance score

**User Feedback**:
- "Analogous and Split-Complementary lists way too many dyes as suggestions, sometimes with duplicates"

**Fix Approach**:
- Limit harmony results to top N closest dyes (e.g., top 6)
- Sort by deviance score (lower = better)
- Remove duplicates if any exist
- Apply limit to all harmony types

**Estimate**: 20 minutes

---

## 🟡 MEDIUM PRIORITY ISSUES (Nice to Fix)

### Issue #14: Triadic Includes Base Color ✏️
**File**: Harmony calculation logic
**Severity**: Medium

**Problem**:
- Triadic should show 3 harmony colors + suggestions
- Currently includes base color in results (should be separate)
- User feedback: "Triadic lists the base color along with the two related colors"

**Fix Approach**:
- In harmony calculation, explicitly exclude base color from Triadic results
- Or separate "base color" from "harmony colors" in display

**Estimate**: 10 minutes

---

### Issue #15: Dye Comparison Dark Theme Text Contrast 📊
**File**: `src/components/dye-comparison-tool.ts`
**Severity**: Medium
**Screenshot**: image3.png

**Problem**:
- "Selected" dyes section shows light text on light pill backgrounds
- Hard to read in dark themes
- Example: Dye names in pale blue on light gray pills

**Fix Approach**:
- Update CSS for `.selected-dyes` section or similar
- Ensure text color has proper contrast
- May need theme-aware styling for selected dye pills

**Estimate**: 10 minutes

---

## 📈 Remaining Issues Priority Matrix

| Issue | Type | Severity | Est. Time | Impact |
|-------|------|----------|-----------|--------|
| Button text contrast | Bug | 🔴 Critical | 10 min | All tools |
| Dual Dyes container | Bug | 🔴 Critical | 15 min | Accessibility only |
| Deviance display | Bug | 🔴 Critical | 20 min | Harmony, Mixer |
| Facewear in Harmony | Feature | 🟠 High | 15 min | Harmony |
| Facewear in Mixer | Feature | 🟠 High | 15 min | Mixer |
| Too many suggestions | UX | 🟠 High | 20 min | Harmony |
| Triadic base color | Logic | 🟡 Medium | 10 min | Harmony |
| Comparison contrast | UX | 🟡 Medium | 10 min | Comparison |

---

## 🎯 Recommended Fix Order

**Session 2 (Next - 2-3 hours)**:
1. Fix button text contrast (10 min) - Quick win, affects all tools
2. Fix deviance display (20 min) - Critical visual issue
3. Fix Dual Dyes container (15 min) - Accessibility tool
4. Fix Dye Comparison contrast (10 min) - Quick win
5. Remove Facewear from results (30 min) - Both Harmony and Mixer

**Session 3 (Phase 12.6)**:
6. Limit harmony suggestions (20 min) - UX improvement
7. Fix Triadic base color (10 min) - Logic fix
8. Start unit test suite

---

## 📋 Next Session Checklist

- [ ] Read image1.png to understand button issue
- [ ] Read image2.png to understand container issue
- [ ] Read image3.png to understand comparison contrast
- [ ] Read image5a.png to understand deviance display
- [ ] Start fixing button text contrast
- [ ] Continue with remaining issues in priority order
- [ ] Test each fix in browser before moving to next

---

## 💾 Reference Files

**CSS/Theme Files**:
- `src/styles/themes.css` - For button and deviance styling
- `src/styles/tailwind.css` - Tailwind directives

**Component Files**:
- `src/components/harmony-generator-tool.ts` - Harmony results
- `src/components/dye-mixer-tool.ts` - Mixer results
- `src/components/accessibility-checker-tool.ts` - Dual Dyes container
- `src/components/dye-comparison-tool.ts` - Comparison styling

**Service Files**:
- May be in service layer if harmony calculation is separate

---

## 🔍 Investigation Steps

Before fixing, document:
1. How button styling works (checked image1.png) ✓
2. Which container element needs theming (check image2.png)
3. How deviance values are rendered (check image5a.png)
4. Current harmony filtering/limiting logic
5. How Facewear is identified in results

---

**Status**: Ready for Session 2 fixes
**Total Est. Time**: 3-4 hours for all remaining issues
**Outcome**: Production-ready application with all cosmetic and UX issues resolved
