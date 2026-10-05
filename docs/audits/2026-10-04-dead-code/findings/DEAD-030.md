# DEAD-030: moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Orphan i18n · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/services/bot-i18n.ts:70` — preset.categories.* (6 keys incl. retired 'community')
- `apps/moderation-worker/src/services/bot-i18n.ts:96` — ban.userBanned, ban.presetsHidden, ban.alreadyBanned
- `apps/moderation-worker/src/services/bot-i18n.ts:31` — meta block + LocaleData.meta; common.success

## Evidence
- No production reader: the moderation-worker has no dynamic t() call, and category display comes from CATEGORY_DISPLAY in types/preset.ts. The only reader is the 'should translate category keys' test. No production source in moderation-worker, presets-api or packages/types contains a 'community' literal.
  - Commands: git grep 'preset\.categories|grand-companies' -- apps/moderation-worker gives the definitions at :70-77 and test lines :172-177.; The 8 discord-worker 'about.categories' hits are a different table.; No prod 'community' literal in moderation/presets-api/types src.
- ban.userBanned is read only by bot-i18n.test.ts:165. presetsHidden and alreadyBanned have no t() reader at all: ban-reason.ts:205,221 hardcode the 'Presets Hidden' label, and every other presetsHidden hit is the BanResult count field.
  - Commands: git grep -w userBanned|presetsHidden|alreadyBanned (excluding docs/audits) finds the definitions at bot-i18n.ts:96,98,103 and the test at :165.; The presetsHidden hits in ban-service.ts, types/ban.ts:93 and ban-reason.ts are the BanResult field, not the key.
- meta.{locale,name,nativeName,flag} is never read: getLocale() returns this.locale, LocaleData is not exported, and the i18n.test.ts nativeName hits belong to the separate i18n.ts list. common.success is read only by bot-i18n.test.ts:64, while common.error stays live.
  - Commands: All production t.t() keys are literals in preset.ts, and none is meta.* or common.success.; getLocale (bot-i18n.ts:201-203) returns this.locale.; The module is not imported outside moderation-worker; the discord-worker bot-i18n hits are that worker's own module.
- Origin: git grep 'preset\.categories' 8ecb878f -- apps/moderation-worker finds only bot-i18n.test.ts:172-177. The block at bot-i18n.ts is unchanged since main (the diff 8ecb878f..HEAD only adds presetsStillHidden/Why).

## Fix
**REMOVE.** After the edit, the parent `preset` object keeps only `moderation`. Confirm type-check passes.

Steps: Delete bot-i18n.ts:70-77 (the `categories: {...},` block). Delete bot-i18n.test.ts:169-178 (the 'should translate category keys' it block), plus the preceding blank line if one is left dangling. Apply this with the other DEAD-030 keys as one edit. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker and pnpm dead-code:check.

Steps (ban.userBanned, ban.presetsHidden, ban.alreadyBanned): Delete bot-i18n.ts lines 96 (userBanned), 98 (presetsHidden) and 103 (alreadyBanned). Delete bot-i18n.test.ts:165 and keep the rest of the 'ban-related keys' it block, which asserts live keys. Apply this with the other DEAD-030 keys. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker and pnpm dead-code:check.

Steps (meta block + LocaleData.meta; common.success): In bot-i18n.ts, delete the interface field at :18-23 (leaving `interface LocaleData { [key: string]: unknown; }`), the meta object at :31-36 and common.success at :39. In bot-i18n.test.ts, delete :64, and at :317-320 change the comment and the key to an object-valued key ('common') and the expectation to 'common'. DEAD-001 will already have landed in PR #225; apply this with the other DEAD-030 keys as one edit. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker and pnpm dead-code:check.

## Status
OPEN
