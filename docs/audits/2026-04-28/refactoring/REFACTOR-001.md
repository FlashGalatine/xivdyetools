# REFACTOR-001: og-worker hardcodes English display names — link previews never localize

- **Priority:** MEDIUM
- **Effort:** LOW–MEDIUM
- **Category:** i18n / Refactoring
- **File:** [`apps/og-worker/src/og-data-generator.ts:33-72`](../../../../apps/og-worker/src/og-data-generator.ts#L33-L72)

## Description

The og-worker renders OpenGraph metadata for every shared link previewed by Discord, Twitter, Facebook, etc. Four display-name maps are hardcoded in English:

```typescript
// apps/og-worker/src/og-data-generator.ts:33-72
const TOOL_NAMES: Record<ToolId, string> = {
  harmony: 'Harmony Explorer',
  gradient: 'Gradient Builder',
  // ... 6 tools, all English
};

const HARMONY_NAMES: Record<HarmonyType, string> = {
  complementary: 'Complementary',
  // ... 9 harmony types, all English
};

const VISION_NAMES: Record<VisionType, string> = {
  normal: 'Normal Vision',
  // ... 5 vision types, all English
};

const SHEET_NAMES: Record<ColorSheetCategory, string> = {
  eyeColors: 'Eye Colors',
  // ... 9 sheet categories, all English
};
```

Even though the tool URLs accept `?lang=` to indicate user preference, og-worker never reads it for these strings. **Every social-media link preview is in English regardless of the sharer's locale.**

This finding was first surfaced by today's [I18N_AUDIT](../I18N_AUDIT.md). It is included in this deep-dive as a refactoring opportunity because the same audit cycle should not file the same issue twice from different angles, but the code-quality framing is distinct: this is a **structural duplication** problem (display names that ought to be in a localized table), not just an i18n parity gap.

## Why this is a refactoring concern (not just i18n)

- The four tables are duplicates of conceptual data the rest of the monorepo handles through [`packages/core/src/data/locales/`](../../../../packages/core/src/data/locales/) — but those locale JSONs don't yet contain `TOOL_NAMES` / `HARMONY_NAMES` / etc. So og-worker isn't redundant with existing locales; it's the **first/only definition of these names anywhere**.
- The right fix isn't "import from core" because the strings don't exist in core. The right fix is to **add** localized versions of these maps to the core locale system as a new top-level key (e.g., `tools`, `harmonies`, `visions`, `sheets`), then have og-worker read from there.

## Recommendation

1. Add four new top-level objects to all six locale JSONs in `packages/core/src/data/locales/`:
   - `tools: Record<ToolId, string>` — 6 entries
   - `harmonies: Record<HarmonyType, string>` — 9 entries
   - `visions: Record<VisionType, string>` — 5 entries
   - `sheets: Record<ColorSheetCategory, string>` — 9 entries
2. Translate each into ja / de / fr / ko / zh.
3. Expose new methods on [`TranslationProvider`](../../../../packages/core/src/services/localization/TranslationProvider.ts) (e.g., `getToolName(id, locale)`) following the existing `getCategory` pattern.
4. Refactor [`og-data-generator.ts`](../../../../apps/og-worker/src/og-data-generator.ts) to extract `?lang=` from the request URL and use the new methods. The og-worker already imports from `@xivdyetools/core` (line 11) so the dependency is in place.

### Bundle-size impact for og-worker

The four new maps add ~30–40 strings × 6 locales ≈ 200 short strings per language. Estimate: +5 KiB uncompressed, +1.5 KiB gzipped per locale, total ~9 KiB gzipped across all six. Within budget.

## Cross-reference

- Today's [I18N_AUDIT.md](../I18N_AUDIT.md) — same finding from the localization parity angle.
- Today's [HARDCODED_STRINGS.md](../HARDCODED_STRINGS.md) — enumerates these and other hardcoded strings.

## Resolution

**Status:** OPEN
