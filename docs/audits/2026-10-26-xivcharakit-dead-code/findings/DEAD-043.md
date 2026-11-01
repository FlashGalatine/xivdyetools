# DEAD-043: Icon ?version= branch has no in-repo caller
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/api-worker/src/chara/router.ts:306-314,332-334`
- `apps/api-worker/src/chara/xivapi.ts:294-296 (resolveAssetContext versionOverride)`
- `apps/api-worker/src/chara/router.test.ts:591-679`

## Evidence
- git grep -n 'chara/icon' (src only): one client, apps/web-app/src/services/chara-resolve-service.ts:124-125 charaIconUrl(iconId) builds unversioned URLs; discord-worker/bot-logic have none. So the in-repo-unused claim holds. But ?version= is public documented API on data.xivdyetools.app: apps/api-worker/docs/reference/chara.md:104 (EndpointCard 'version' param) and :107, docs/projects/api-worker/endpoints.md:371. Added deliberately by 4b03e9e8 (2026-10-20, XIVAPI-002, REMEDIATION_PLAN.md:27,97-120) and shipped as the additive feature of api-worker 0.21.0 (package.json 0.21.0, CHANGELOG.md:8). Its key is the public POST /v1/chara/resolve response field data.version (types.ts:106-107), which web-app already stor…
- The code is not dead. It is a deliberately shipped, documented public query parameter (api-worker 0.21.0) and the companion of the public resolve field data.version. External API consumers may pin icon URLs with it. Removing it turns their requests into unversioned fetches with a different cache policy, and the developer docs would then be wrong. The web-app already receives the version key, so the likelier change is for it to start passing the key, which would make this branch live in-repo. App-only, so semver is NONE, but blast is MEDIUM because it is a public HTTP contract.
- Still live: Public API contract: external clients of data.xivdyetools.app/v1/chara/icon/:iconId?version= (documented at apps/api-worker/docs/reference/chara.md:104). There is no in-repo production caller.

## Fix
- **KEEP** — revisit trigger: Revisit in either of two cases. (1) web-app's charaIconUrl (chara-resolve-service.ts:124) starts appending the resolve result's version: the branch is then live in-repo, so close the item. (2) The api-worker CHANGELOG and docs/reference/chara.md announce a deprecation of the /v1/chara/icon version query, or the /v1/chara/icon route is removed: drop the branch in that release.
- Cascade: If ever removed, the immutable Cache-Control branch, the versionOverride parameter of XivapiClient.resolveAssetContext, the versioned cases in router.test.ts, and three doc pages (reference/chara.md, docs/.vitepress/theme/lib/endpoints.ts, docs/projects/api-worker/endpoints.md) go with it.
- Published: This is not an npm package. api-worker is an app (semver NONE), but the parameter is a public HTTP API surface on data.xivdyetools.app and developers.xivdyetools.app.

## Status
OPEN
