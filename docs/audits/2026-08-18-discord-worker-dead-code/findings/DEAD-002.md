# [DEAD-002]: `services/preset-api.ts` still carries the moderation client that moved to moderation-worker

## Category
Unused Export (TEST-ONLY) / Legacy

## Location
- File: `apps/discord-worker/src/services/preset-api.ts`
- Symbols (line ranges): `getFeaturedPresets` (239-249), `deletePreset` (335-354), `getCategories` (454-468), the whole "Moderation Functions" block `getPendingPresets` / `approvePreset` / `rejectPreset` / `flagPreset` / `getModerationStats` / `getModerationHistory` (470-584), `revertPreset` (624-653) — ~191 lines
- Tests: `preset-api.test.ts` describes at 228, 320, 560, 583, 605, 705, 728, 751, 773, 792 (~260 lines)
- Freed by removal: `types/preset.ts` re-exports `ModerationStats`, `ModerationLogEntry`, `CategoryMeta` (only these functions use them)

## Evidence
`grep -rhn "presetApi\.\([a-zA-Z]*\)" src --include=*.ts | grep -v test` → callers exist only for `editPreset, getMyPresets, getPreset, getPresetByName, getPresets, getRandomPreset, hasVoted, isApiEnabled, isModerator, removeVote, searchPresetsForAutocomplete, setPreviewImageStatus, submitPreset, voteForPreset`. None of the ten symbols above appear outside `preset-api.test.ts`.

## Why It Exists
Preset moderation used to be a discord-worker feature; it moved to `apps/moderation-worker` (which has its own `services/preset-api.ts`). discord-worker kept only `isModerator` + `setPreviewImageStatus` (live for the preview-image approve/reject buttons) but never pruned the rest.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — one file + its test + 3 type re-exports |
| **Reversibility** | EASY |
| **Hidden Consumers** | None; the presets-api routes these call still exist (moderation-worker uses them), so no server-side change |

## Recommendation
**REMOVE**

### Rationale
~450 lines (code + tests) maintaining an HTTP client for endpoints this worker is not allowed to call any more; the tests are the only thing exercising them.

### If Removing
1. Delete the listed functions and their `describe` blocks.
2. Drop `ModerationStats`, `ModerationLogEntry`, `CategoryMeta` from `types/preset.ts` re-exports (they become unreferenced).
3. Run the discord-worker test suite + type-check.
