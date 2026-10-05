# DEAD-061: registryCommandNames in registry.ts is test-only: 10 lines (62-71), 3 test lines to rewrite
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/discord-worker/src/commands/registry.ts:69` — registryCommandNames

## Evidence
- Pure wrapper over the COMMAND_REGISTRY constant. Its only callers are in registry.test.ts (:3, :8, :14); scripts/register-commands.ts:31 inlines the map itself. It is not a reset or observation hook over real state.
  - Commands: git grep -n -w registryCommandNames -- . ':!docs/audits/**' -> registry.ts:69 decl, registry.test.ts:3/8/14, CHANGELOG.md:750; scripts/register-commands.ts:31 uses COMMAND_REGISTRY.map directly; dead-code-check.txt:2 lists it as test-only exempt
- Origin: git grep -w registryCommandNames 8ecb878f: same 3 test hits plus decl at registry.ts:69. CHANGELOG.md:750 (2026-08-18-discord-worker-dead-code/DEAD-004) shows it was kept on purpose before main.

## Fix
**KEEP.** The owner kept it on purpose in 2026-08-18-discord-worker-dead-code/DEAD-004 (CHANGELOG.md:750, 'kept (legitimate test hooks)'), and the dead-code gate lists it as @testonly-exempt. Revisit trigger: the owner reverses that decision. Removing it is then a zero-risk 10-line change.

Steps: If the owner reverses 2026-08-18-discord-worker-dead-code/DEAD-004: delete registry.ts lines 62-71 (docblock + function). In registry.test.ts, drop registryCommandNames from the :3 import and replace the calls at :8 and :14 with COMMAND_REGISTRY.map((c) => c.name). Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker && pnpm dead-code:check (the exempt count drops from 26 to 25).

## Status
KEEP (register) — revisit on the trigger above
