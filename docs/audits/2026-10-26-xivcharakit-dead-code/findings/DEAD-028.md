# DEAD-028: Provider arm of resolveCharaForTools (isPaletteProvider) is test-only in-repo but is published, documented 5.15.0 API: KEEP until core 6.0.0
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** MAJOR · **Category:** Legacy

## Location
- `packages/core/src/services/chara/chara-library-resolve.ts:20-24,29-30,35,38`
- `packages/core/src/services/chara/chara-library-types.ts:30-33`
- `packages/core/src/services/chara/__tests__/chara-library.test.ts:731-737,781-800`

## Evidence
- git grep -w resolveCharaForTools (non-test): one production caller, bot-logic/src/commands/chara-identity.ts:51, passing getCharacterColors() (the service). Provider callers use resolveCharaWithProvider instead (web-app workers/chara-inspection.worker.ts:88). The provider arm is reached only at chara-library.test.ts:784,795. CharacterColorService has no getColor, so the guard does discriminate. index.ts:277 tags resolveCharaForTools /** @public */. core/CHANGELOG.md [5.15.0] (lines 32-37) advertises that it "also takes a CharaPaletteProvider". git log -S isPaletteProvider gives 466d48b2 and 72e41474, both shipped in 5.15.0. npm view @xivdyetools/core version gives 5.15.0 (latest), equal to the local package.js…
- In-repo, the union arm is reached only by tests, but it is not dead. Core 5.15.0 is on npm as latest, the CHANGELOG documents the provider argument as a feature, and resolveCharaForTools carries @public. Narrowing the parameter type is a type-only narrowing of a published signature, which is MAJOR, and an npm consumer that passes a provider would break at both compile time and run time. The cost of keeping it is about 5 lines. The reviewer's second trigger ("first in-repo caller that passes a provider") would make the arm live, not removable, so I replaced it.
- Still live: None in-repo for the provider arm. The public npm contract is core 5.15.0: CHANGELOG.md:32-37 and the index.ts:277 @public tag. The service arm is live through bot-logic chara-identity.ts:51.

## Fix
- **KEEP** — revisit trigger: At core 6.0.0, decide whether to narrow resolveCharaForTools to CharacterColorService only, pointing provider users to resolveCharaWithProvider (optionally @deprecated in a 5.x MINOR first).
- Trigger as verified: Revisit when core 6.0.0 (the next MAJOR) is being planned. Narrow it then only if git grep -n -w resolveCharaForTools still shows every non-test caller passing a CharacterColorService. Optionally, tag it @deprecated in a 5.x MINOR first, pointing provider users to resolveCharaWithProvider.
- Cascade: The chara-library-types.ts:30-33 comment, which says resolveCharaForTools accepts a provider, needs rewording. CharaPaletteProvider stays because resolveCharaWithProvider (chara-library.ts:209-212) and the /chara subpath (chara.ts:22) still use it. Nothing else depends on the arm.
- Published: @xivdyetools/core 5.15.0 is npm latest (equal to local). The provider-accepting union signature shipped in it and is documented in its CHANGELOG, so removing or narrowing it is MAJOR. An @deprecated tag would be MINOR.

## Status
OPEN
