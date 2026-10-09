# DEAD-039: CrawlerInfo.userAgent in apps/og-worker/src/types.ts is written but never read since the crawler log was minimized: 4 src lines + 11 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/og-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/og-worker/src/types.ts:184` — CrawlerInfo.userAgent

## Evidence
- CrawlerInfo.userAgent is only ever written in production (crawler-detector.ts:69,78,86). Every crawlerInfo use in index.ts (564,568,586,600,1247,1249,1266,1268) reads .isCrawler or .type; nothing spreads or passes the whole object. Only crawler-detector.test.ts asserts the field.
  - Commands: git grep -n -w -E 'userAgent|crawlerInfo' -- apps/og-worker/src ':!*.test.ts': crawlerInfo is only read as .isCrawler/.type; userAgent appears only in the detector's writes, the JSDoc and types.ts:184; git show 3095b8ce -- apps/og-worker/src/index.ts: '-      userAgent: crawlerInfo.userAgent,'; CrawlerInfo has no importer outside apps/og-worker (git grep -w CrawlerInfo)
- Origin: Commit 3095b8ce 'fix(og-worker): minimize crawler metadata logs' removed the last reader (-userAgent: crawlerInfo.userAgent). git merge-base --is-ancestor 3095b8ce 8ecb878f succeeds, and git log 8ecb878f..HEAD -S userAgent -- apps/og-worker is empty.

## Fix
**REMOVE.** Internal to a private worker, so no API risk. Keep the index.privacy.test.ts:47 not.toHaveProperty('userAgent') guard: it checks the log context, not this field. Re-add the field only if a crawler-debug log is designed; that log would conflict with the privacy test anyway.

Steps: 1) apps/og-worker/src/types.ts:184: delete 'userAgent: string;'. 2) apps/og-worker/src/crawler-detector.ts: delete the userAgent property lines 69, 78 and 86, and change the JSDoc example at line 62 to '{ isCrawler: true, type: 'discord' }'. 3) apps/og-worker/src/crawler-detector.test.ts: delete the userAgent: expectation lines 17, 26, 36, 47, 66, 85, 104, 116, 128, 140 and 152 (keep the local userAgent variables, which are inputs). 4) Leave index.privacy.test.ts:47 as it is. 5) pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker && pnpm dead-code:check

## Status
REMOVED, NOT DEPLOYED — `261f1a13` (branch `fix/remediation-2026-10-04-sprint11`, og-worker 2.12.0; PR #268, open, on PR #263).
