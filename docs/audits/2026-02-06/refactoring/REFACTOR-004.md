# REFACTOR-004: Preferences UI Strings Hardcoded in English

## Priority
MEDIUM

## Category
Maintainability / Localization Gap

## Location
- File(s): src/handlers/commands/preferences.ts
- Scope: entire file

## Current State
The preferences command handler has many hardcoded English strings that bypass the i18n system:

- Lines 55-64: `PREFERENCE_LABELS` — "Language", "Blending Mode", "Matching Method", etc.
- Line 177: "⚙️ Your Preferences"
- Line 178: "These settings affect how commands work for you."
- Line 210: "Please provide at least one preference to set."
- Line 310-312: "✅ Preference Updated" / "Preferences Updated"
- Lines 466-492: All validation error messages

Other commands (harmony, budget, extractor) properly use the translator `t.t('key')` for all user-facing strings.

## Issues
- Non-English users see a mix of translated and untranslated text
- Violates the localization pattern used by all other commands
- Translation keys likely already exist or could be easily added

## Proposed Refactoring
Add preference-related keys to all locale JSON files and replace hardcoded strings:

```typescript
// Before
title: '⚙️ Your Preferences',

// After
title: t.t('preferences.title'),
```

## Benefits
- Consistent localized experience across all commands
- Follows the pattern already established by other commands

## Effort Estimate
MEDIUM (need to add ~30 translation keys across 6 locale files)

## Risk Assessment
Low risk — purely additive changes to locale files + string replacements in one file.
