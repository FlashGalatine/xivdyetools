# REFACTOR-008: Hardcoded Locale 'en' in Stoat Worker Info Command

## Priority
LOW

## Category
Feature Gap / Internationalization

## Location
- File(s): apps/stoat-worker/src/commands/info.ts (line 39)
- Scope: function level

## Current State
```typescript
const locale: LocaleCode = 'en'; // TODO: resolve from user preferences
```

The stoat-worker's `/info` command always returns English dye names regardless of the user's language preference. The TODO comment indicates this was always intended to be configurable.

## Issues
- Non-English users on Revolt servers always see English dye names
- Inconsistent with the Discord bot which supports 6 languages
- The locale infrastructure already exists in `@xivdyetools/core`

## Proposed Refactoring
Depends on stoat-worker's Phase 2 plans:

**Minimal fix**: Detect server/channel locale from Revolt API:
```typescript
const locale = resolveRevoltLocale(message.channel) ?? 'en';
```

**Full fix**: Implement user preference storage (requires SQLite or similar), following the discord-worker's `/preferences set language` pattern.

## Benefits
- Internationalized responses for non-English Revolt users
- Consistent behavior with the Discord bot

## Effort Estimate
LOW (minimal fix) / MEDIUM (full user preferences)

## Risk Assessment
None — additive change, English remains the default
