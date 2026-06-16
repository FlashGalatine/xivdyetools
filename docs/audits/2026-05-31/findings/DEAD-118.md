# DEAD-118: 7 dead type/function exports still present (continuation of DEAD-026)

> **STATUS: RESOLVED** (verified 2026-06-15) — executed in `106e94f` (2026-06-04), merged to main via `fbc065f`; the flagged files/symbols are no longer in the tree.

## Category
Unused Type / Unused Export

## Location
- `apps/discord-worker/src/types/image.ts` — `DiscordAttachment` (L52), `ExtractedPaletteEntry` (L78)
- `apps/discord-worker/src/types/budget.ts` — `SORT_DISPLAY` (L192), `getDistanceQuality()` (L210)
- `apps/discord-worker/src/types/preferences.ts` — `getRaceForClan()` (L194)
- `apps/discord-worker/src/types/preset.ts` — `PresetPreviousValues` re-export (L24)
- `apps/discord-worker/src/utils/verify.ts` — `VerificationResult` alias (L20, "for backwards compatibility")

## Evidence
**Continuation of 2026-02-28 DEAD-026** (8 symbols). Re-verifying, **7 are still dead** — a monorepo-wide symbol sweep
returns only the definition line for each (no consumer, not even internal):
```
DiscordAttachment, ExtractedPaletteEntry        → defined in types/image.ts, 0 other refs
SORT_DISPLAY, getDistanceQuality                → defined in types/budget.ts, 0 other refs
getRaceForClan                                  → defined in types/preferences.ts, 0 other refs
PresetPreviousValues                            → re-exported in types/preset.ts:24, 0 importers
VerificationResult                              → alias in verify.ts:20, 0 importers
```
The 8th DEAD-026 symbol, `embedResponse`, is handled in **DEAD-116** (grouped with its file-sibling `autocompleteResponse`).
Note `PresetPreviousValues` sits inside the deprecated re-export block tracked separately in **DEAD-121** — it is the one
member of that block with zero consumers, so it belongs here (delete), not there (migrate).

## Why It Exists
Types/helpers defined for planned features (image-extraction typing, budget UI helpers, character lookups) or pure
back-compat aliases, none of which were integrated. DEAD-026 recommended REMOVE; not executed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — each symbol appears only at its definition (whole-monorepo sweep) |
| **Blast Radius** | LOW — types erase at compile; functions/consts are small and isolated |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — confirm with `tsc --noEmit` after removal |

## Recommendation
**REMOVE**

### Rationale
- Closes the bulk of DEAD-026. Low-effort, zero-risk surface reduction across 5 files.

### If Removing
1. Delete the 7 symbols listed above. For `PresetPreviousValues`, drop it from the `types/preset.ts` re-export block.
2. `pnpm --filter xivdyetools-discord-worker run type-check` (confirms no erased-type consumer) `&& run test`.
3. Coordinate with DEAD-116 (embedResponse) and DEAD-121 (preset.ts deprecated block) so DEAD-026 can be marked resolved.
