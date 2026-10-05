# DEAD-053: HarmonyInput.harmonyOptions in bot-logic harmony.ts is ignored legacy published API — 2 lines + 11-line stale test
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/bot-logic · **Semver:** MAJOR · **Category:** Legacy · **Origin:** MAIN

## Location
- `packages/bot-logic/src/commands/harmony.ts:79` — HarmonyInput.harmonyOptions (+ HarmonyOptions import)

## Evidence
- The @deprecated HarmonyInput.harmonyOptions field (harmony.ts:78-79) has no reader in executeHarmony and no app caller passes it. Only harmony.test.ts:377-387 sets it, and that test asserts only ok===true, so its title 'preserves caller-supplied deltaE formula' is misleading.
  - Commands: git grep -n -w harmonyOptions -- apps packages (non-md) -> harmony.ts:79 decl, harmony.test.ts:383; core hits are HarmonyGenerator's own unrelated param; bot-logic index.ts:58 exports /** @public */ HarmonyInput; npm view -> 4.5.0 = 70e2482b, where harmony.ts:79 already has the field
- Re-verified independently in the completeness re-sweep: harmonyOptions (+ HarmonyOptions import) and is not a new finding. The field is ignored and only harmony.test.ts:383 sets it, but HarmonyInput is @public (bot-logic index.ts:58), so dropping it is a type break. Core HarmonyOptions still types the published find*/DyeService params.
- Origin: git grep at 8ecb878f: packages/bot-logic/src/commands/harmony.ts:79 harmonyOptions?: HarmonyOptions; no open PR touches harmony.ts (pr-delta.txt: #227 changes only bot-logic locale JSON)

## Fix
**KEEP.** Published API (HarmonyInput is @public at index.ts:58, and the field exists in npm 4.5.0). Revisit at the next bot-logic major, the same shape as 2026-09-15-dead-code/DEAD-018. Now, with semver NONE: rename harmony.test.ts:377 to 'accepts deprecated harmonyOptions without error'. That keeps the type-compat coverage and drops the false claim.

Steps: Now: rename the test title at packages/bot-logic/src/commands/harmony.test.ts:377. At the next major: delete harmony.ts:78-79; remove HarmonyOptions from the import at harmony.ts:11 (it has no other use in the file); delete harmony.test.ts:377-387; update the bot-logic README.md:134, CLAUDE.md:104 and a CHANGELOG breaking entry. Then run pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic plus pnpm dead-code:check.

Correction from the final adversarial check: At core's major, HarmonyOptions is moved to a surviving module, not deleted (DEAD-047 step 1), because this field still names it. It can leave core only after bot-logic's major has removed the field.

## Status
KEEP (register) — revisit on the trigger above
