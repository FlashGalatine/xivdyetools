# DEAD-040: Unreachable guard for a 304 with no retained ETag in loadIcon
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: removing it would edit internal api-worker production code. KEEP is unchanged, since the guard is defensive against xivapi.ts get() changes.

## Location
- `apps/api-worker/src/chara/icons.ts:27-28`
- `apps/api-worker/src/chara/icons.test.ts:102-108`

## Evidence
- Read icons.ts:25-28: fetchIcon(iconId, ctx, retained?.etag ?? undefined). xivapi.ts:462-472: If-None-Match header and allowNotModified=Boolean(ifNoneMatch) share one condition; get() xivapi.ts:395 returns a 304 only with that flag, else :396 throws 'redirect refused'. An empty-string etag also gives flag false, so the guard can't be reached. git grep -w fetchIcon (no audits): only icons.ts:25, so there's no other caller. loadIcon: router.ts:321 (prod) + tests. Test icons.test.ts:102 has an empty cache, so no ETag, so it throws at xivapi.ts:396, not at the guard. The guard also narrows `retained` (possibly null) for retained.bytes/etag at :30-31, so deleting it needs a non-null assertion.
- Claim holds: in production the guard can't be reached. That's because fetchIcon's sole caller ties If-None-Match to retained.etag, and XivapiClient.get turns any other 304 into an error before it returns. KEEP is still right, for three reasons. The guard costs two lines. It enforces a contract between two modules, so a refactor of get() can't make loadIcon serve undefined bytes. It also gives the TypeScript null narrowing that lines 30-31 need. App code, unpublished, semver NONE.
- Still live: Guard sits on the production path router.ts:321 -> loadIcon. Unreachable branch, kept deliberately.

## Fix
- **KEEP** — revisit trigger: Revisit when any of these happens: apps/api-worker/src/chara/xivapi.ts get() stops refusing a 304 without allowNotModified (lines 395-397); fetchIcon gets a caller other than icons.ts:25; or fetchIcon's allowNotModified is no longer Boolean(ifNoneMatch). If one does, the guard becomes reachable and needs a direct test. It does not become removable.
- Cascade: None. The test at icons.test.ts:102 stays valid because it covers xivapi.ts:396.

## Status
OPEN
