# review-gap-1: moderation-worker inline string table (bot-i18n.ts)

## Commands run (all from the preview worktree) and results
- Read apps/moderation-worker/src/services/bot-i18n.ts (full): table at :29-110 (enLocale), `strings = enLocale` at :124, Translator.t at :~180, getLocale at :~205 returns `this.locale` (never reads meta.*).
- `git grep -n -E "\.t\([a-zA-Z_$]" -- apps/moderation-worker/src ':!*.test.ts'` -> 0 hits (exit 1): no variable-key t() calls. Also no t( with template literal / line-wrapped call found.
- `git grep -n -E "common\.success|moderation\.(approved|rejected|missingReason)|preset\.categories|ban\.(userBanned|presetsHidden|alreadyBanned)|meta\.|nativeName|grand-companies" -- apps/moderation-worker/src` -> prod hits only the definitions in bot-i18n.ts (nativeName :21,:34; grand-companies :72; presetsHidden :98; alreadyBanned :103). Test hits: bot-i18n.test.ts:64,165,172-177; i18n.test.ts:28,33 (nativeName of the UNRELATED i18n.ts locale list).
- Distinct literal keys passed to `t.t('...')` in production: 32; every one is defined (no used-but-undefined keys seen).
- getLocale: returns this.locale; no read of meta.*. meta.locale/name/nativeName/flag are never read at runtime; only `meta` the type field. bot-i18n.test.ts:317-320 uses key 'meta' only as "key resolves to an object, returns key" (any object key such as 'common' would serve).
- `git grep -n "presetsHidden|alreadyBanned"` -> `presetsHidden` in handlers/modals/ban-reason.ts:205,221 is the BanResult count field, and the embed label is hardcoded English 'Presets Hidden' there (not t.t). `alreadyBanned` has no reader anywhere (test or prod).
- 'community' category: no production literal `'community'` in packages/types/src, apps/presets-api/src, apps/moderation-worker/src (grep empty): the key is a retired category kept only by definition + test :177.
- `git log` bot-i18n.ts: last touched c7fd9eba (1.8.0, +3 lines = xivauthId), ed885447; c6aa8c73 already removed three test-only helpers (DEAD-009/010/012) from this unit.
- Not run: any build or test.

## Orphan keys (confirmed; test-only or definition-only)
Never read by production code:
- common.success (test :64)
- preset.moderation.approved, approvedDesc, missingReason, rejected, rejectedDesc (no reader anywhere, not even tests; review-message.ts builds approve/reject text without the translator)
- preset.categories.* x6 incl. retired `community` (test :172-177 only)
- ban.userBanned (test :165), ban.presetsHidden, ban.alreadyBanned (no reader anywhere)
- meta.locale/name/nativeName/flag (never read; getLocale ignores them)
Total 20 string leaves + meta block (4) = about 24 definition lines in bot-i18n.ts, plus 8 test assertions (64,165,172-177) and the `meta` field in the LocaleData interface (:17-24).

## Candidates
See structured output. Single cleanup unit: delete the unread keys, the `meta` block + interface field, and the two/three test blocks that assert them (retarget the :317 test at 'common'); keep the keys the 32 production call sites use.

## Rejected
- Translator.getLocale: kept (called by index.ts/handlers or test; reset/observation, and does not read meta).
- bot-logic orphan gate: does not cover this table, so no existing gate would catch the removal's absence; suggest (not file) a small vitest that walks the table for unread keys.
- i18n.ts (resolveUserLocale / locale list nativeName): separate module, not part of this gap.
- LocaleData `[key: string]: unknown` and `strings` constant: live (I18N-009 documented single-table design).
