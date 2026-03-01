# Unused Exports Summary

## Overview
- **Total Findings:** 16 (DEAD-008, 009, 012, 013, 014, 016, 024, 025, 026, 028, 032, 033, 035, 036, 037, 038, 039, 040)
- **Recommended for Removal:** 10 (8 keep — published package API or valid testing pattern)
- **Estimated Lines Removable:** ~750+

---

## Web App Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-008 | `src/components/index.ts` | Nearly-dead barrel file (1/35 exports used) | HIGH | REMOVE |
| DEAD-009 | `src/components/v4/index.ts` | Completely unused barrel file | HIGH | REMOVE |
| DEAD-012 | `src/shared/constants.ts` | ~30 exported constants never imported | HIGH | REMOVE |
| DEAD-013 | `src/shared/empty-state-icons.ts` | Dead lookup function + 3 unused icons | HIGH | REMOVE |
| DEAD-014 | `src/shared/ui-icons.ts` | Dead lookup function + 12 unused icons | HIGH | REMOVE |
| DEAD-016 | `src/services/index.ts` | Dead barrel re-exports (SHARE_URL_VERSION, BASE_URL, etc.) | MEDIUM-HIGH | REMOVE WITH CAUTION |

---

## Discord Worker Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-024 | `src/utils/discord-api.ts` | InteractionContext class + deadline functions (~100 lines, test-only) | HIGH | REMOVE |
| DEAD-025 | `src/services/component-context.ts` | 7 unused UI builders (deleteContext, isAuthorized, SelectMenuOption, build*) ~125 lines | HIGH | REMOVE |
| DEAD-026 | Multiple type files | 8 dead type/function exports (DiscordAttachment, ExtractedPaletteEntry, SORT_DISPLAY, etc.) | HIGH | REMOVE |
| DEAD-028 | analytics.ts, middleware.ts, emoji.ts | 10 test-only exports (trackCommand, getLogger, getDyeEmojiOrFallback, etc.) | MEDIUM | KEEP — valid testing pattern |
| DEAD-035 | `src/services/bot-i18n.ts` | 5 unused re-exports (translate, getAvailableLocales, isLocaleSupported, LocaleData, TranslatorLogger) | HIGH | REMOVE |

---

## bot-i18n Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-032 | `src/translator.ts` | 3 unused function exports (translate, getAvailableLocales, isLocaleSupported) | HIGH | REMOVE |
| DEAD-033 | `src/types.ts` | 2 unused type exports (TranslatorLogger, LocaleData) | HIGH | KEEP — published API |

---

## bot-logic Findings

| ID | Location | Description | Confidence | Recommendation |
|----|----------|-------------|------------|----------------|
| DEAD-036 | `src/css-colors.ts`, `src/color-utils.ts` | 4 internal-only function exports | HIGH | KEEP — mark @internal |
| DEAD-037 | `src/constants.ts` | 2 unused constant exports (HARMONY_TYPES, VISION_TYPES) | HIGH | KEEP — mark @internal |
| DEAD-038 | `src/types.ts` | ~24 unused Input/Result type exports | HIGH (monorepo) | KEEP — published SDK API |
| DEAD-039 | `src/types.ts` | EmbedData/EmbedField types | HIGH (monorepo) | KEEP — platform-agnostic API |
| DEAD-040 | `src/resolve-color.ts` | ResolveColorOptions type | HIGH (monorepo) | KEEP — parameter type |
