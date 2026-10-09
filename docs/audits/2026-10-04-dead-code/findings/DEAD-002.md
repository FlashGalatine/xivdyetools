# DEAD-002: ModerationPresetInfo.author_discord_id in preset-notifications.ts is unread since #227: 2 lines; fixture must be reshaped, not deleted
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** PR-#227

## Location
- `apps/discord-worker/src/handlers/commands/preset-notifications.ts:42` — ModerationPresetInfo.author_discord_id

## Evidence
- Since PR #227 (FINDING-008), buildModerationNotification renders only author_name. Every caller passes a CommunityPreset variable (preset.ts:1146/1167, index.ts:408), so structural typing does not need the field and there is no excess-property check.
  - Commands: git grep -n -w author_discord_id -- apps/discord-worker/src: decl :42 only in non-test code that touches this type; preset.ts:778 and types/preset.ts:59 are on CommunityPreset; grep author preset-notifications.ts: only author_name is read (:129, :153)
- Origin: At main@8ecb878f, preset-notifications.ts:102 and :114 render `(<@${preset.author_discord_id}>)`. git log 8ecb878f..HEAD -S author_discord_id returns only d1fdb89a 'fix(discord-worker): 5.8.0 ... Sprint 5' (PR #227 @4ebd09f2).

## Fix
**REMOVE WITH CAUTION.** The fixture at preset-notifications.test.ts:29 supplies the snowflake that makes the FINDING-008 regression assertion at :140 (`not.toContain('123456789012345678')`) meaningful. Deleting that line as proposed would make the assertion vacuous, so keep the id present at runtime.

Steps: Delete preset-notifications.ts lines 41-42 (the comment and the field). In preset-notifications.test.ts, line 29 then becomes an excess-property error inside the `preset()` literal. Keep the snowflake at runtime: build the base object as a separate variable carrying author_discord_id, or type it as a CommunityPreset-shaped object, and spread it, so the :140 assertion still proves the id is not rendered. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker && pnpm dead-code:check.

## Status
FIXED 2026-10-05 — `d3bf312a` (PR #227, merged in `ecbdafea`): the field and its comment removed; the fixture was reshaped, so the FINDING-008 "never rendered" assertion keeps its meaning. Re-verified on `main@50165ec6`: [reverify-2026-10-05.md](../../2026-10-04-i18n/evidence/reverify-2026-10-05.md).
