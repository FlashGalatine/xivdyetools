# [REFACTOR-026]: handleAutocomplete in discord-worker is a 130-line per-command if/else monolith

## Priority
LOW

## Category
Handler decomposition / routing hygiene

## Location
`apps/discord-worker/src/index.ts:597-725` (`handleAutocomplete`), plus its command-specific helpers up to `:896` (`getCollectionAutocompleteChoices`, `getMyPresetsAutocompleteChoices`, `getFavoritedPresetsAutocompleteChoices`, `getClanAutocompleteChoices`); nested-option walker at `:616-647`; shallower duplicate walker in `apps/moderation-worker/src/index.ts:297-313`

## Current State
Autocomplete logic for `collection`, `preset` (four sub-branches incl. KV + service-binding helpers), `preferences`, and the default dye path all live inline in `index.ts` as a nested if/else chain over `commandName` × `focusedOption.name` × `subcommandName` × `subcommandGroupName`. The `/budget` command already demonstrates the intended shape: `handleBudgetAutocomplete` is co-located with its command handler (`apps/discord-worker/src/handlers/commands/budget.ts:402-443`) and delegated to in one line (`index.ts:701-703`). The 3-level focused-option walker (`AnyOpt` traversal) is bespoke here and re-implemented (2-level) in moderation-worker.

## Issues
- `index.ts` (1008 lines) carries per-command business logic instead of pure routing; every new autocomplete-bearing command grows the chain.
- The preset helpers hidden here are where OPT-007's N+1 fan-out lives — hard to see and to rate-limit while embedded in the router.
- Two hand-rolled option-tree walkers drift independently (the moderation copy misses subcommand-group nesting).

## Proposed Refactoring
1. Move each command's autocomplete beside its handler, following the budget pattern: `handleCollectionAutocomplete`, `handlePresetAutocomplete`, `handlePreferencesAutocomplete`, each returning the full autocomplete `Response`.
2. Reduce `handleAutocomplete` to: find focused option (shared utility) → dispatch by `commandName` → default dye choices.
3. Extract the focused-option walker into a small tested utility (in `@xivdyetools/bot-logic`) and use it in both workers.
4. While relocating, add the missing autocomplete rate limit (OPT-007's third item) in the now-thin dispatcher.

## Benefits
- `index.ts` shrinks toward pure routing; per-command autocomplete is testable in isolation next to its command.
- One correct option-tree walker shared by both workers.
- Natural seam for the autocomplete rate limit and for OPT-007's favorites fix.

## Effort Estimate
Small-medium — half a day; the moves are mechanical, plus one shared utility with tests.

## Risk Assessment
Low. Autocomplete is fail-soft (an error path already returns empty choices), so a routing mistake degrades to "no suggestions" rather than a broken command. Existing behavior pinned by keeping the dispatcher's command-name cases 1:1.

> Source: evidence/bot-workers-analysis.md (2026-07-18 deep-dive, bot-workers area)
