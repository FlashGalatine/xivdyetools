# DEAD-010: CharaResolveResult.version is stored but never read — ~25 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/chara-resolve-service.ts:89,147,178,229`
- `apps/web-app/src/components/glamour-block.ts:388`
- `tests: src/services/__tests__/chara-resolve-service.test.ts:54,122,179`

## Evidence
- git grep -w version on chara-resolve-service.ts + glamour-block.ts: only writes at 89(type),147(envelope type),178,229 and glamour-block.ts:388. git grep for .version reads, ...equipment/...result spreads, stringify(equipment), Object.keys(equipment) in web-app src+e2e (non-test): none touch CharaResolveResult (chara-inspection-service.ts:225 spreads an ImportedCharaCharacter). Consumers glamour-block/glamour-list-actions/glamour-sheet/item-links-menu read only .items/.glasses. Only reader anywhere: test chara-resolve-service.test.ts:122 (test tier). git grep -c "version: 'test'|'v'" in src __tests__: 22 standalone lines over 5 files. Field added 1d13e4c2 (2026-08-20). App unpublished; api-worker (router.ts) and docs/projects/api-worker/endpoints.md:367 describe the API, unaffected.
- The field is written from the api-worker envelope and stored in the session cache but no production code reads it; every consumer of CharaResolveResult uses only items and glasses. web-app is not published, so semver is NONE, and api-worker keeps sending the field, so nothing changes over the wire. Remove with caution for two reasons. First, the reviewer's cascade undercounts the test edits: there are 5+ test files, not the 2 named. tsconfig includes src, so typed fixtures with version fail type-check through excess-property errors, and toEqual at chara-resolve-service.test.ts:179 fails. Second, make sure nobody plans to use the XIVAPI version key in the client, for example to invalidate the session cache. If someone does, keep the field and give it a reader.
- Still live: none in production; only chara-resolve-service.test.ts:122 (test tier)

## Fix
- **REMOVE WITH CAUTION** — 1) chara-resolve-service.ts: delete lines 89, 147, 229; line 178 -> { items: outOfRange, glasses: null }. 2) glamour-block.ts:388 -> { items: {}, glasses: null }. 3) Delete standalone version fixture lines in glamour-block.test.ts (17), glamour-block-item-links.test.ts (90,96), glamour-sheet.test.ts:63, item-links-menu.test.ts:23, chara-resolve-service.test.ts:54; drop the inline version from glamour-block-item-links.test.ts:404, glamour-sheet.test.ts:506, glamour-tool.test.ts:69, chara-resolve-service.test.ts:179; rewrite :122 to assert .items. Leave envelope/e2e API mocks. 4) pnpm turbo run build type-check lint test --filter=xivdyetools-web-app
- Prerequisite: Confirm no planned client use of the XIVAPI version key (e.g. cache invalidation) before dropping it.
- Cascade: Interface narrowing breaks typed test fixtures (excess property) and two assertions (test.ts:122 reads .version; :179 toEqual expects version: null). The e2e route.fulfill payloads and the envelope() mocks are API-shaped and can keep version. No production cascade.

## Status
OPEN
