# DEAD-059: `DiscordSnowflake` branded type + `createSnowflake` factory — zero consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/auth/discord-snowflake.ts`
- Line(s): 35 (`DiscordSnowflake`), 74 (`createSnowflake`)
- Symbol(s): `DiscordSnowflake`, `createSnowflake`

## Evidence
Monorepo-wide grep for `DiscordSnowflake` and `createSnowflake` returns **zero** import hits in any app or package outside `packages/types/`.

The companion function `isValidSnowflake` IS actively used by 3 apps (discord-worker, moderation-worker, presets-api) — all import it from `@xivdyetools/types`.

Apps validate snowflake IDs with `isValidSnowflake()` but never use the branded type `DiscordSnowflake` for type safety, nor do they create snowflakes with `createSnowflake`.

Cross-reference with existing finding FINDING-002 (referenced in the source code header): this finding was about consolidating snowflake validation, which was done by moving `isValidSnowflake` to types. But the branded type pattern was never adopted.

## Why They Exist
Branded-type pattern (same as `HexColor`, `DyeId`, etc.) intended to prevent passing arbitrary strings where a snowflake is expected. The pattern works well for `HexColor` and `DyeId` (widely adopted) but was never adopted for snowflakes.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero imports, clear search pattern |
| **Blast Radius** | NONE — `isValidSnowflake` (actively used) does not depend on the branded type |
| **Reversibility** | EASY — types only |
| **Hidden Consumers** | UNLIKELY |

## Recommendation
**MARK @internal** (defer removal to next major version)

### Rationale
The branded type has zero adoption. It could be promoted by updating `isValidSnowflake` to return `DiscordSnowflake` (as a type guard), but until consumers adopt it, it's dead code. Mark `@internal` and evaluate at next major version.

### If Removing
1. Remove `DiscordSnowflake` and `createSnowflake` exports from `src/auth/index.ts`
2. Remove from `src/index.ts` barrel
3. Keep `isValidSnowflake` (actively consumed)
4. Optionally keep definitions in the source file for future adoption
