# DEAD-022: Legacy handleMixerCommand Handler

## Category
Legacy Code

## Location
- `apps/discord-worker/src/handlers/commands/mixer.ts` (251 lines)
- `apps/discord-worker/src/handlers/commands/index.ts` (line 27, re-export)

## Evidence
- `handlers/commands/index.ts` line 26 comments: `// Note: handleMixerCommand (old gradient) is deprecated - use handleGradientCommand`
- `handlers/commands/index.ts` line 25: `// Legacy commands (deprecated in v4, kept for backward compatibility)`
- The main `src/index.ts` switch/case for `'mixer'` routes to `handleMixerV4Command`, **not** `handleMixerCommand`.
- `handleMixerCommand` is exported from `handlers/commands/index.ts` but never imported in `src/index.ts`.
- Only the test file `mixer.test.ts` imports `handleMixerCommand`.

## Why It Exists
The original `/mixer` command was a gradient generator. In V4, the gradient logic was refactored:
- New `/gradient` command → `handleGradientCommand` (from `@xivdyetools/bot-logic`)
- New `/mixer` command → `handleMixerV4Command` (color blending, different feature)
- Old `handleMixerCommand` was kept "for backward compatibility" but is unreachable.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — never routed in production |
| **Runtime Impact** | NONE — handler is never invoked |
| **Build Impact** | Removes ~251 lines + test file |
| **External Consumers** | None |

## Recommendation
**REMOVE** `mixer.ts` (the old handler) and its test file `mixer.test.ts`. Also remove the re-export from `handlers/commands/index.ts`.
