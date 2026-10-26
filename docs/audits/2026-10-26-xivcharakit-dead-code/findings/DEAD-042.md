# DEAD-042: Resolve response field 'version' is read by no in-repo client
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast LOW->MEDIUM: the field is part of the public v1 HTTP response contract (shared runtime, and its own trigger calls removal a breaking v1 change). This matches D46. Semver stays NONE because api-worker is an app.

## Location
- `apps/api-worker/src/chara/types.ts:105-107`
- `apps/api-worker/src/chara/resolver.ts:183,211`
- `apps/api-worker/docs/reference/chara.md:60`

## Evidence
- Read types.ts:105-107 (`version: string | null`, documented 'null when fully served from cache') and resolver.ts:211 (`{ version, items }`). git grep over apps/ and packages/ src: web-app chara-resolve-service.ts:89,229 only copies `envelope.data.version`; glamour-block.ts:388 only writes `version: null`; glamour-list-actions.ts never reads it; discord-worker glamour.ts:47 ResolveEnvelope omits it. No reader in bot-logic or core. The field is still public. index.ts:176 mounts /v1/chara on the public custom domain data.xivdyetools.app (wrangler.toml:111-114). The VitePress chara.md:60 table documents `version` under meta.apiVersion v1. router.test.ts:203,280 pin its value and its null-from-cache case.
- Nothing in the repo reads the field, but it is part of a documented public HTTP contract: POST /v1/chara/resolve on data.xivdyetools.app, apiVersion v1, described in the published developer docs. Third-party callers may read it, so removing it would quietly break the v1 response shape for them. The field also costs almost nothing: one property that already flows through from lookup-loader. KEEP is correct.
- Still live: No in-repo reader. Its consumers are external callers of the public v1 contract: data.xivdyetools.app/v1/chara/resolve, documented at apps/api-worker/docs/reference/chara.md:60.

## Fix
- **KEEP** — revisit trigger: Revisit when either of these happens. (a) api-worker adds a /v2/chara/resolve route, or meta.apiVersion moves past 'v1' (apps/api-worker/src/index.ts and docs/reference/chara.md). (b) chara.md's field table marks `version` as deprecated. Until then, removing it is a breaking v1 change.
- Cascade: web-app CharaResolveResult.version (chara-resolve-service.ts:89,229), plus the write at glamour-block.ts:388. It is an unused client-side copy that can be removed on its own without touching the api-worker contract.
- Published: This is not an npm export. It is a field of the public HTTP API (v1) served by api-worker and documented on developers.xivdyetools.app. Removing it would be a breaking API change, even though app semver is NONE.

## Status
OPEN
