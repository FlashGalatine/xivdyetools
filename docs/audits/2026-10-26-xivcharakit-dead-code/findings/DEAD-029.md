# DEAD-029: Barrel re-export of resolveCharaWithProvider duplicates the ./chara subpath; in-repo barrel use is test-only
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** MAJOR · **Category:** Legacy

## Location
- `packages/core/src/index.ts:275`
- `packages/core/src/chara.ts:17`
- `packages/core/src/__tests__/chara-entry.test.ts:26-30`

## Evidence
- git grep -n -w resolveCharaWithProvider: only production importer is apps/web-app/src/workers/chara-inspection.worker.ts:24 via '@xivdyetools/core/chara'; barrel importers are tests only (web-app chara-inspection-service.test.ts:20, core chara-entry.test.ts:29, chara-library.test.ts:50). index.ts:275 carries /** @public */; chara.ts:6-7 and core CHANGELOG [5.15.0] say the barrel exports the same functions. npm view: latest 5.15.0, published 2026-10-26T21:15Z with ./chara in exports; barrel line came in 72e41474 (10:37 EDT), ancestor of #327 merge 231b39d0 (16:09 EDT), so it shipped in 5.15.0. Removal = MAJOR.
- The barrel copy is a published, /** @public */-tagged export of @xivdyetools/core 5.15.0 (npm latest), so npm consumers may import it from the root; removing it is a MAJOR break for 1 line of saving. It is a deliberate, documented duplicate of the ./chara subpath (chara.ts:6-7, core CLAUDE.md:191), not dead code. In-repo it is reached only by tests, which never make it live, but the published-API contract is the reason to keep.
- Still live: Published npm API (@xivdyetools/core 5.15.0 root export, /** @public */); in-repo production uses the ./chara subpath at apps/web-app/src/workers/chara-inspection.worker.ts:24

## Fix
- **KEEP** — revisit trigger: At core 6.0.0, decide whether the barrel keeps resolveCharaWithProvider or the ./chara subpath becomes the sole supported route.
- Trigger as verified: When packages/core/package.json is bumped to 6.0.0 (the next core MAJOR release prep): decide then whether the barrel keeps resolveCharaWithProvider, or earlier mark it @deprecated in a MINOR if the subpath is declared the sole supported route.
- Cascade: chara-library.test.ts:49-51, chara-entry.test.ts:29 identity assertion, web-app chara-inspection-service.test.ts:20 import must move to the subpath.
- Published: Shipped in @xivdyetools/core 5.15.0 (npm latest, published 2026-10-26T21:15Z); removal or narrowing is MAJOR, @deprecated is MINOR.

## Status
OPEN
