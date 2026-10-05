# Review: oauth + image-worker (dead-code audit 2026-10-04)

Note: symrefs.sh / members.py could not be run (the harness refuses shell wrappers around git in this worktree-isolated session). Substituted: the Grep tool (ripgrep, tracked tree; no coverage dirs in apps/*/src) with one combined -o regex over apps/oauth/src non-test files, plus per-symbol `grep -rlw` over src for image-worker. No class members exist in either unit (both are function modules), so members.py is N/A.

## Module map
oauth: src/index.ts (routes: GET /, GET /health, mounts /auth via authorizeRouter, callbackRouter, xivauthRouter, tokenRouter); handlers/oauth-flow.ts (shared authorize + GET callback builders); constants/oauth.ts; services/{jwt-service,rate-limit,user-service}.ts; utils/{env-validation,oauth-validation,pkce-binding,state-signing}.ts; middleware/body-validation.ts.
image-worker: src/index.ts (GET /health, POST /extract, POST /thumbnail); photon.ts, validators.ts, dimensions.ts, types.ts.

## Commands and results
1. `git ls-files apps/oauth apps/image-worker` -> 57 tracked files (oauth 40, image-worker 21 incl. docs).
2. Grep -o over apps/oauth/src (non-test) for 41 exported value symbols -> every symbol has a consumer in another prod file EXCEPT: decodeJWT (jwt-service.ts:193 only; its only other prod mention is the import alias at :21), ALLOWED_REDIRECT_ORIGINS (constants/oauth.ts:14,47 only, consumed via getAllowedRedirectOrigins), signPayload/verifyJWT/isTokenRevoked (consumed inside jwt-service.ts only; verifyJWT via verifyJWTWithRevocationCheck:241; isTokenRevoked:245), revokeToken (token.ts:132,146 live).
3. Test-only check: grep -rn -w in src/__tests__ for decodeJWT -> jwt-service.test.ts:149-285 only; isTokenRevoked also token.test.ts:374.
4. grep for retired origin `projectgalatine` in apps/oauth src/toml -> only comments in constants/oauth.ts:9, wrangler.toml, and negative assertions in oauth-constants.test.ts / wrangler-config.test.ts (guards, live). No leftover constant, route, env field, CORS entry.
5. Env fields (RL_AUTH_10/20/30, XIVAUTH_*, JWT_EXPIRY, WORKER_URL, TOKEN_BLACKLIST, DISCORD_CLIENT_ID) -> each read in non-test src; no read-but-undeclared. wrangler vars all read.
6. Test mock exports (`src/__tests__/mocks/cloudflare-test.ts`): grep -rlw per export outside the file -> createMockRateLimit has ZERO references anywhere in apps/ (cloudflare-test.ts:172); RecordedStatement type has none outside (used within file). All others consumed.
7. `.skip|it.todo|.only|xit` in both units -> none. `@deprecated` x5 on src/types.ts:13-41 re-exports; all five groups still imported from types.js (callback.ts:7, token.ts:17, xivauth.ts:10-15, jwt-service.ts:14, user-service.ts:6) -> live, but the deprecation note is stale-in-place.
8. allowUnsigned path in utils/state-signing.ts:49-91: callers oauth-flow.ts:93,250 pass ENVIRONMENT==='development'; pkce-binding.ts:66 passes false -> reachable in dev only, live.
9. Routes: index.ts app.get/use/route list above; no defined-but-unemitted routes. Retired-domain route removal verified (wrangler.toml routes = auth.xivdyetools.app only).
10. oauth package.json deps: @xivdyetools/auth, types, worker-kit, hono all imported; devDeps @xivdyetools/test-utils (mocks/cloudflare-test.ts), vitest, @vitest/coverage-v8, wrangler (dev script), workers-types, @types/node (tests use node:fs) -> all live.
11. oauth vitest.config.ts:19-20 coverage.exclude 'src/services/rate-limit-do.ts' and 'src/durable-objects/**'; `git ls-files src | grep -E "rate-limit-do|durable"` -> nothing. Dead config.
12. image-worker exports (grep per symbol): all consumed. Exported-but-only-internal+tests: loadImage, resizeImage, extractPixels, computeCropBox (photon.ts; only photon.ts + photon.test.ts), validateImageUrl, validateDimensions, validateImageFormat, detectImageFormat re-export (validators.ts, only validateAndFetchImage and tests), THUMBNAIL_WIDTH/HEIGHT, MAX_PIXEL_COUNT, FETCH_TIMEOUT_MS (prod only inside own module + tests).
13. image-worker `@` alias: vitest.config.ts resolve.alias '@' and tsconfig.json paths "@/*"; `grep -rn "from '@/" image-worker/src` -> 0 hits. Dead config.
14. image-worker wrangler.toml observability pin (PR #232): no vars/bindings declared; types.ts Env = Record<string, never> matches (no [vars]). Deps @cf-wasm/photon, worker-kit, hono all imported.
15. Single-reference non-exported top-level declarations in image-worker/src (non-test) -> none.
16. DEPRECATIONS.md grep for oauth/image-worker -> only the completed "flip consumers" checklist (line 257) and an OAuth redirect-URI mention; nothing outstanding.

## Candidates
- oauth decodeJWT (jwt-service.ts:193): wrapper over shared decodeJWT, zero prod callers, only jwt-service.test.ts. Test-only; dead wrapper.
- oauth createMockRateLimit (__tests__/mocks/cloudflare-test.ts:172): unused test helper.
- oauth vitest.config.ts:19-20 excludes for nonexistent rate-limit-do.ts / durable-objects (Dead Path, config).
- image-worker `@` alias (vitest.config.ts:21-25, tsconfig.json paths): no importer.
- oauth types.ts:13-44 five `@deprecated` re-exports that in-repo code still consumes; "removed next major" note on a private worker is Legacy marker (borderline; recommend keep or migrate imports).
- oauth jwt-service.ts:28-29 `export { base64UrlDecode }` "backwards compatibility" re-export: consumed by state-signing.ts:12 via jwt-service, so live but is a compat shim (borderline Redundant Re-export).
- oauth exported-only-internal symbols: ALLOWED_REDIRECT_ORIGINS, signPayload, verifyJWT, isTokenRevoked (the last two exported solely for tests); image-worker photon/validator helpers above. Export-narrowing only, ~0 line savings.

## Positive controls
- resetRateLimiter (rate-limit.ts:165) @testonly: reason holds, genuine reset hook clearing memoryLimiter + lazily built KV/CF limiters (rate-limit.ts:98-168); KEEP.
- PR #228 cleanup complete: retired origin gone from constants, routes, wrangler, CORS (CORS reuses getAllowedRedirectOrigins, index.ts:71); guarded by oauth-constants.test.ts + wrangler-config.test.ts.
- index.ts CORS localhost branch (index.ts:79-90) not redundant: ALLOWED_LOCALHOST_PORTS adds 8787, not in the allowlist.
- PR #232 image-worker change is config + test only; nothing orphaned.

## Rejected (live)
body-validation exports (bodySizeLimit/jsonDepthLimit -> index.ts:234,237); XIVAUTH_REQUIRED_SCOPES/REQUEST_TIMEOUT_MS/USER_INFO_TIMEOUT_MS (xivauth.ts); ALLOWED_ENVIRONMENTS (env-validation.ts:74); state-signing allowUnsigned (dev); MAX_*_LENGTH (oauth-flow.ts); all image-worker route-reachable functions; the 3 RL_AUTH bindings (rate-limit.ts, types.ts, env-validation.ts).

## Prior KEEP triggers
DEAD-018/019/021: not applicable to this unit. DEAD-020: oauth rate-limit KV/memory fallback (services/rate-limit.ts:101-115) is a native-binding fallback; trigger (retirement designed, local replacements, operational evidence) NOT met; keep.

## Files covered
oauth: all 17 non-test src files + 16 tests/mocks + wrangler.toml, package.json, vitest.config.ts, types. image-worker: 5 src files, 7 tests, wrangler.toml, package.json, configs. Total 56.
