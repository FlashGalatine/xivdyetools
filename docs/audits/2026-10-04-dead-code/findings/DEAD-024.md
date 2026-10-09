# DEAD-024: CommandRegistryEntry.deprecated in registry.ts is never set or read in production: 2 lines + 3-line test
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/discord-worker/src/commands/registry.ts:26` — CommandRegistryEntry.deprecated

## Evidence
- No COMMAND_REGISTRY entry sets `deprecated`, and no production code reads it: about.ts uses the hard-coded REMOVED_IN_V5 array at :64, and register-commands.ts reads only .name. The only readers are registry.test.ts:24 and index.test.ts:63, and the doc comment is stale.
  - Commands: git grep -n deprecated -- apps/discord-worker ':!*.md' -> registry.ts:26, registry.test.ts:24, index.test.ts:63 (+ unrelated @deprecated JSDoc in types/preset.ts); about.ts:64 REMOVED_IN_V5 literal; about.ts:72/82 read only .category/.length
- Origin: git grep deprecated 8ecb878f: registry.ts:26, registry.test.ts:24, index.test.ts:63 only. about.ts:64 at main already hard-codes REMOVED_IN_V5.

## Fix
**REMOVE.** Type-only field. The bot-logic locale-orphans.test.ts regex parses the COMMAND_REGISTRY array block, not the interface, so it is unaffected.

Steps: Delete registry.ts lines 25-26 (the JSDoc and `deprecated?: true;`). Delete registry.test.ts lines 23-25 (the 'carries no deprecated commands' it-block). In index.test.ts:63, change `COMMAND_REGISTRY.filter((entry) => !entry.deprecated).map(...)` to `COMMAND_REGISTRY.map(...)`. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker && pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `d9fdb57c` (branch `fix/remediation-2026-10-04-sprint9`, discord-worker 5.8.4; PR #257, open, on PR #256).
