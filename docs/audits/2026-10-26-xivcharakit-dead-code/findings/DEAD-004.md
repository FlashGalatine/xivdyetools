# DEAD-004: Stale api-worker chara docs/comments: icon caching, resolve consumer, /api/version, misplaced OPT-004 note — ~4 lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** api-worker (docs + comments only; hub docs/ copies ride along) · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/api-worker/README.md:27,194`
- `apps/api-worker/docs/guide/responses.md:102`
- `docs/user-guides/public-api.md:150`

## Evidence
- HEAD 88189ee8. router.ts:331-334 sends 'max-age=300, must-revalidate' when there is no ?version= and 'max-age=2592000, immutable' when one is given. router.test.ts:519/623/671 pin both. README:27, responses.md:102 and public-api.md:150 claim long or immutable caching only. git grep shows swatch-tool.ts imports no chara-resolve-service; resolveCharaEquipment callers are glamour-block.ts:394 and item-links-menu.ts:284; discord-worker glamour.ts:43 calls /v1/chara/resolve. git grep 'api/version' (excluding CHANGELOG, audits and research) hits only README:194 and types.ts:56. xivapi.ts:325 probes /api/sheet/Item/1 and the namespace is [base,version,schema] (xivapi.ts:314). router.ts:202-206 sit above resolveContext; the cast is at :214. In 0bc669e4 the same comment preceded CharaRowCache directly.
- All four claims are true. The code and its tests serve a 300 s, must-revalidate policy for the unversioned icon URL, but three docs still promise 30 d immutable caching. Swatch Matcher stopped calling resolve on 2026-09-27 (e6aba41d). /api/version discovery was replaced by the Item/1 probe in 1b3fabd4. The OPT-004 note now sits above unrelated code, and its rationale is kept at cache-service.ts:58/98. Nothing exported or runtime changes, apps are unpublished, and only one comment block is deleted outright; the other lines are rewrites. Cascade: src/index.ts:174 makes the same Swatch claim and should be fixed in the same pass. apps/web-app/CLAUDE.md:136 and chara-resolve-service.ts:3 belong to the web-app slice. docs/versions.md:647 is a historical release note, so leave it.
- Still live: None of the stale text is consumed. Tests pin the actual two-policy headers (router.test.ts:519,623,671), not the doc wording.

## Fix
- **REMOVE** — 1. Rewrite README:27, responses.md:102 and public-api.md:150 to the two-policy wording from reference/chara.md:107. 2. Rewrite the consumer in CLAUDE.md:118, reference/chara.md:5, environment-variables.md:255 and src/index.ts:174 to 'Glamour Reader + discord-worker /glamour'. 3. Rewrite README:194 and types.ts:55-57 to the Item/1 probe and the base/game/schema namespace (as overview.md:133). 4. Delete router.ts:203-206 and move the :202 cast note above :214. 5. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker, then pnpm docs:check-links.
- Prerequisite: None.
- Cascade: Same stale Swatch-consumer claim at apps/api-worker/src/index.ts:174 (same unit, not in the filed rows); apps/web-app/CLAUDE.md:136 and apps/web-app/src/services/chara-resolve-service.ts:3 (web-app slice).

## Status
OPEN
