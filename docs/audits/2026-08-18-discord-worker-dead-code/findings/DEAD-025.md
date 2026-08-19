# [DEAD-025]: types — `createSnowflake`/`DiscordSnowflake`, the whole `DyeDatabase` interface file, and five chain-dead contract types (`PresetSortOption`, `ModerationResponse`, `CategoryListResponse`, `OAuthState`, `XIVAuthSocialIdentity`)

## Category
Unused Export / Unused Type / Orphaned File

## Location
- `packages/types/src/auth/discord-snowflake.ts:36,82` — `createSnowflake`, `DiscordSnowflake` (~36 lines + part of a 99-line test). DEAD-059 (Feb audit) removed them from the root barrel but kept them on `/auth`; still zero adoption. `isValidSnowflake` is live (×5); bot-logic's `isValidDiscordSnowflake` (moderators.ts:18) duplicates it
- `packages/types/src/dye/database.ts` — `DyeDatabase` interface (27 lines, whole file); zero references; name-collides with core's `DyeDatabase` class; README:103 still shows importing it
- Chain-dead (only reach an app's `@deprecated` re-export shim, never imported past it): `PresetSortOption` (discord/moderation shims; web-app defines its own twice), `ModerationResponse` + `CategoryListResponse` (`preset/response.ts:177-209`, presets-api shim only; presets-api handlers don't type their responses), `OAuthState` (`auth/jwt.ts:88-97`) + `XIVAuthSocialIdentity` (`auth/xivauth.ts`) (oauth shim only; oauth's real state shape is `StateData` in `utils/state-signing.ts:17` with different fields — the shared type is stale, not shared) — ~60 lines
- **KEEP**: `MATCH_QUALITY_TIERS` (read by `classifyMatchDistance`, single source of truth), `Matrix3x3`, `ErrorSeverity`, the `@internal` union constituents (`PresetSubmit*`, `Auth{Success,Error}Response`, …), `AuthUser` (field of live `AuthSuccessResponse`) — INTERNAL-ONLY building blocks of live unions; the legacy markers on live types (`stainID: number|null`, `id`, optional `jti`/`hsv`) are documented, load-bearing compat

## Evidence
Per-symbol `git grep -nw` across tracked files; for the shim chain, the app-side `types.ts` shims were read and their re-exported names grepped inside each app.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — also trims the matching lines from the app shims (`apps/oauth/src/types.ts`, `apps/presets-api/src/types.ts`, discord/moderation `types/preset.ts`) |
| **Reversibility** | EASY |
| **Hidden Consumers** | npm-published; DEPRECATIONS.md names workspace consumers only |

## Recommendation
**REMOVE** (types-package `2.x` minor + CHANGELOG note; fix README:103).

Note for the web-app track: web-app is the one app that ignores the shared contract — it redefines `AuthUser`, `AuthResponse`, `JWTPayload`, `PrimaryCharacter`, `CommunityPreset`, `PresetListResponse`, `PresetFilters`, `VoteResponse`, `PresetSubmission`, `PresetEditRequest`, `PresetSortOption`×2 (~150 lines) while already depending on `@xivdyetools/types`. Out of this audit's scope; recorded in the report footer.

**2026-08-18 follow-up (Task 4):** `PresetSortOption` restored in `preset/request.ts` (also used to type `PresetFilters.sort`) and re-exported from `preset/index.ts` + the package root. web-app's two local copies (`services/hybrid-preset-service.ts:73`, `shared/tool-config-types.ts:184`) were collapsed into this import.

Per-type disposition: **swapped** for the shared import — `AuthUser`, `AuthProvider`, `PrimaryCharacter`, `AuthResponse`, `JWTPayload`, `PresetStatus`, `CommunityPreset`, `PresetFilters`, `PresetListResponse`, `PresetSubmission`, `PresetEditRequest`, `PresetSortOption`. **Kept local** — `VoteResponse`: presets-api returns `{success: true, already_voted: true, new_vote_count}` on HTTP 409 (`apps/presets-api/src/handlers/votes.ts` `addVote()`), but the web-app client deliberately synthesises `success: false` for that case so its "already voted" UI branch fires instead of the success branch — a shape the shared `VoteErrorResponse` (`success: false; error: string` only) can't hold.
