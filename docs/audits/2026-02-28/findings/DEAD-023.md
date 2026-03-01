# DEAD-023: Unused discord-interactions devDependency

## Category
Unused Dependency

## Location
- `apps/discord-worker/package.json` line 42: `"discord-interactions": "^4.4.0"`

## Evidence
- `depcheck --json` flagged `discord-interactions` as unused devDependency.
- Zero imports from `'discord-interactions'` across all of `src/` and `scripts/`.
- CHANGELOG explicitly states: "Fixed `verify.test.ts` to mock shared auth package **instead of deprecated** `discord-interactions`".
- Ed25519 verification was migrated to `@xivdyetools/auth`.

## Why It Exists
Originally the sole Ed25519 signature verification library. Was replaced by `@xivdyetools/auth` during the shared auth package extraction. The dependency was left in `package.json`.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero imports |
| **Runtime Impact** | NONE |
| **Build Impact** | Reduces node_modules footprint |
| **External Consumers** | None |

## Recommendation
**REMOVE** from `package.json` devDependencies.
