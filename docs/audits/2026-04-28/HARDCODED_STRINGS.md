# Hardcoded String Extraction Report

**Date:** 2026-04-28
**Scope:** Source-code scan for English UI strings outside the i18n system

## Summary

| Priority | Location | Count | Action |
|----------|----------|------:|--------|
| HIGH | [og-worker/src/og-data-generator.ts](../../../apps/og-worker/src/og-data-generator.ts) — 4 hardcoded display-name maps | ~24 strings | Localize via shared constant or `web-app` locale lookup |
| MED | og-worker default OG description (English only) | 1 string | Localize |
| LOW | og-worker fallback default image | 2 strings | Brand-tier; keep English |
| LOW | web-app components with `.textContent =` patterns | 8 files | Manual review (most are loading states / accessibility labels) |
| OK | discord-worker | 0 in user-facing paths | i18n via `bot-i18n` is comprehensive |

## High Priority

### [HC-001] og-worker Tool Names

**File:** [apps/og-worker/src/og-data-generator.ts:33-40](../../../apps/og-worker/src/og-data-generator.ts#L33-L40)

```typescript
const TOOL_NAMES: Record<ToolId, string> = {
  harmony: 'Harmony Explorer',
  gradient: 'Gradient Builder',
  mixer: 'Dye Mixer',
  swatch: 'Swatch Matcher',
  comparison: 'Dye Comparison',
  accessibility: 'Accessibility Checker',
};
```

**Impact:** Every social-media link preview is English regardless of `?lang=ja`. A user sharing a Japanese-locale `/harmony/?lang=ja` page gets `"Harmony Explorer"` in Discord/Twitter unfurl.

**Fix sketch:**

```typescript
import enLocale from '../../../apps/web-app/src/locales/en.json' assert { type: 'json' };
import jaLocale from '../../../apps/web-app/src/locales/ja.json' assert { type: 'json' };
// ...etc

function getToolName(toolId: ToolId, lang: string): string {
  const locale = locales[lang] ?? enLocale;
  return locale.tools?.[toolId]?.fullName ?? TOOL_NAMES_EN[toolId];
}
```

The web-app locale already has `tools.harmony.shortName`, `tools.harmony.fullName`, etc. for all 9 tools — reuse those.

---

### [HC-002] og-worker Harmony Names

**File:** [apps/og-worker/src/og-data-generator.ts:42-52](../../../apps/og-worker/src/og-data-generator.ts#L42-L52)

```typescript
const HARMONY_NAMES: Record<HarmonyType, string> = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  'split-complementary': 'Split-Complementary',
  tetradic: 'Tetradic',
  square: 'Square',
  monochromatic: 'Monochromatic',
  compound: 'Compound',
  shades: 'Shades',
};
```

**Note:** [packages/core/src/data/locales/*.json](../../../packages/core/src/data/locales/en.json) already has `harmonyTypes` for all 6 languages. Use the core locale data directly.

---

### [HC-003] og-worker Vision Names

**File:** [apps/og-worker/src/og-data-generator.ts:54-60](../../../apps/og-worker/src/og-data-generator.ts#L54-L60)

```typescript
const VISION_NAMES: Record<VisionType, string> = {
  normal: 'Normal Vision',
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};
```

**Note:** core locale has `visionTypes` for all 6 languages with the parenthetical disorder name. Use directly.

---

### [HC-004] og-worker Sheet Names

**File:** [apps/og-worker/src/og-data-generator.ts:62-72](../../../apps/og-worker/src/og-data-generator.ts#L62-L72)

```typescript
const SHEET_NAMES: Record<ColorSheetCategory, string> = {
  eyeColors: 'Eye Colors',
  highlightColors: 'Highlights',
  lipColorsDark: 'Lip Colors (Dark)',
  // ... etc
};
```

**Note:** Cross-reference `web-app/src/locales/*.json` `tools.character.*` keys.

---

## Medium Priority

### [HC-005] OG Default Description

**File:** [apps/og-worker/src/og-data-generator.ts:471](../../../apps/og-worker/src/og-data-generator.ts#L471)

```typescript
'Explore FFXIV dye colors, create harmonious palettes, build gradients, mix colors, and find your perfect glamour combinations. Free web tools for Final Fantasy XIV players.'
```

**Fix:** Source from web-app `meta.description` for the requested language; fall back to English.

---

## Low Priority

### [HC-006] OG Default Image Brand Strings

**File:** [apps/og-worker/src/index.ts:419-430](../../../apps/og-worker/src/index.ts#L419-L430)

```typescript
text(centerX, centerY - 60, 'XIV DYE TOOLS', { /* ... */ })
text(centerX, centerY, 'FFXIV Color & Dye Companion', { /* ... */ })
```

**Verdict:** `'XIV DYE TOOLS'` is the brand and should remain English. `'FFXIV Color & Dye Companion'` is a tagline that could be localized but is low priority since this is the fallback image.

---

### [HC-007] Web-app `.textContent =` Patterns

`Grep` for `.textContent = "..."` and `innerHTML = "..."` patterns turned up these production files (test files excluded):

| File | Likely content type |
|------|---------------------|
| [apps/web-app/src/components/about-modal.ts](../../../apps/web-app/src/components/about-modal.ts) | About modal text — but this file has 41 t() calls, so most strings are i18n'd |
| [apps/web-app/src/components/color-display.ts](../../../apps/web-app/src/components/color-display.ts) | Color display widget |
| [apps/web-app/src/components/preset-detail-view.ts](../../../apps/web-app/src/components/preset-detail-view.ts) | Preset detail panel |
| [apps/web-app/src/components/preset-edit-form.ts](../../../apps/web-app/src/components/preset-edit-form.ts) | Preset edit form (49 t() calls) |
| [apps/web-app/src/components/preset-submission-form.ts](../../../apps/web-app/src/components/preset-submission-form.ts) | Preset submission form (50 t() calls) |
| [apps/web-app/src/components/add-to-collection-menu.ts](../../../apps/web-app/src/components/add-to-collection-menu.ts) | Collection picker menu |

**Verdict:** Most of these files have heavy i18n usage already. The few `.textContent` assignments are likely dynamic values (numbers, hex codes, dye IDs) or accessibility labels. Recommend a focused review pass — but no broad replacement project. Estimate 0–10 real findings out of these 8 files.

---

## Discord Worker — OK

Spot-checked [apps/discord-worker/src/handlers/commands/](../../../apps/discord-worker/src/handlers/commands/). All user-facing strings are routed through [packages/bot-i18n](../../../packages/bot-i18n/) with locale auto-detection via `interaction.locale`. No hardcoded English bleed-through observed in production paths. Test fixtures and command-registration scripts (which run only at deploy time) are intentionally English.

---

## Recommended Implementation Approach for og-worker Localization

A minimal first step:

1. Create a small `apps/og-worker/src/i18n.ts` with a `Locales` type and dynamic imports of locale JSON
2. Read `?lang=` (or `Accept-Language`) from the request in [index.ts](../../../apps/og-worker/src/index.ts) handlers
3. Pass the resolved language to `generateOGDataForTool()` and use it for the four hardcoded maps
4. **Defer** CJK font bundling until a follow-up — current default is Latin-only since dye name display in OG previews already renders via core locale data (which uses Unicode), and resvg-wasm will produce tofu boxes for ja/ko/zh dye names. This is a known limitation to address separately.

For step 4: bundle subset CJK fonts into og-worker by reusing the discord-worker subset script + outputs. The two workers share font needs.
