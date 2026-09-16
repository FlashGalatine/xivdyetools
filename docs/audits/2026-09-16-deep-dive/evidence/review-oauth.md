# Review: oauth (apps/oauth) — 2026-09-16 deep-dive

## 1. Map

| Module | Route / responsibility |
|---|---|
| `src/index.ts` | Hono app; middleware order: requestId → logger → cors → envValidation → securityHeaders → rateLimit(`/auth/*`) → bodySizeLimit(`/auth/*`) → jsonDepthLimit(`/auth/*`) → routes; 404 + onError |
| `src/handlers/authorize.ts` | `GET /auth/discord` — Discord config, delegates to `buildAuthorizeHandler` |
| `src/handlers/xivauth.ts` | `GET /auth/xivauth`, `GET/POST /auth/xivauth/callback` — XIVAuth config + token exchange |
| `src/handlers/oauth-flow.ts` | Shared authorize + GET-callback pipeline (PKCE param validation, redirect-URI allowlist, state sign/verify, BUG-049 error-redirect recovery) |
| `src/handlers/callback.ts` | `GET/POST /auth/callback` — Discord GET bounce + POST token exchange |
| `src/handlers/token.ts` | `GET /auth/me`, `POST /auth/revoke`; `/auth/refresh` intentionally 404s (FINDING-003) |
| `src/services/jwt-service.ts` | Mint (`createJWTForUser`/`signPayload`) + thin verify wrappers delegating to `@xivdyetools/auth` |
| `src/services/user-service.ts` | `findOrCreateUser` (D1 upsert + race retry), `attachIdentities` (account-link guard) |
| `src/services/rate-limit.ts` | Backend selection: Cloudflare binding → KV → memory; per-isolate singleton cache |
| `src/utils/oauth-validation.ts` | PKCE format checks, `validateRedirectUri` (origin + exact path), `validateReturnPath`/`validateStateParam`, `validateScopes` |
| `src/utils/pkce-binding.ts` | `verifyPkceStateBinding` — S256(verifier) === signed state's `code_challenge` |
| `src/utils/state-signing.ts` | `signState`/`verifyState` — HMAC-SHA256, `exp` enforced, dev-only unsigned legacy path |
| `src/utils/env-validation.ts` | `validateEnv` — required vars, prod-only binding requirements |
| `src/middleware/body-validation.ts` | `bodySizeLimit` (10KB, Hono `bodyLimit`), `jsonDepthLimit` (depth 10 + prototype-key guard) |
| `schema/users.sql` / `migrations/0001_*.sql` | Single `users` table; hand-run migration, matches `UserRow` (no `avatar_url`) |

## 2. Candidates

### oauth-12 — BUG — MEDIUM — `apps/oauth/src/index.ts:119-165`

**Claim:** the env-validation fail-closed middleware (registered before the security-headers middleware) returns its `500 Service misconfigured` response without calling `next()`, so that response never passes through the security-headers middleware — it ships with none of `X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control: no-store`, `Pragma: no-cache`, or (outside development) `Strict-Transport-Security`.

**Failing input → wrong outcome:** any request to a production/non-development deploy whose env fails `validateEnv` (a dropped `RL_AUTH_*`/`TOKEN_BLACKLIST` binding, a bad `FRONTEND_URL`, etc. — BUG-017 made this run on *every* request, not just the first). Every such response is missing all five security headers, contradicting the worker's own documented invariant ("every response the app dispatches carries `Cache-Control: no-store`… the one exception is a CORS preflight" — `apps/oauth/CLAUDE.md`, "Cache-Control" section) — there is a second, undocumented exception.

**Why tests miss it:** `index.test.ts`'s `Environment gates (FINDING-029)` block (lines ~503-528) asserts only `response.status` and `json.error` on the misconfigured-env 500; the `Cache-Control (FINDING-022)` block (lines ~189-205) asserts `no-store`/`Pragma` only on `/health` (200) and an unmatched route (404) — never on the env-validation 500 path. No test in the suite reads any header off that specific response.

**Covered by test:** no (UNTESTED gap backing a live bug).

```ts
// index.ts — envValidation registered BEFORE securityHeaders
app.use('*', async (c, next) => {
  const result = validateEnv(c.env);
  if (!result.valid) {
    ...
    if (!isDevelopment) {
      return c.json({ error: 'Service misconfigured' }, 500); // no next() — securityHeaders below never runs
    }
  }
  return next();
});
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff'); // skipped for the 500 above
  ...
});
```

**Fix direction:** move the security-headers middleware registration above the env-validation middleware (it has no dependency on validated env, same reasoning already applied to CORS in the oauth-08 fix), or apply the headers directly in the misconfigured-env branch.

## 3. POSITIVE

- BUG-049 (error-redirect origin) is correctly fixed and non-vacuously regression-tested: `callback.test.ts` deliberately uses an allowlisted origin distinct from `FRONTEND_URL` so the assertion can't pass by coincidence (`apps/oauth/src/__tests__/callback.test.ts:145-168`).
- oauth-05 (GET-callback provider mismatch) is enforced (`oauth-flow.ts:267-269`) and exercised in both `callback.test.ts`/`xivauth.test.ts`.
- BUG-051 (XIVAuth non-array character roster) is fixed with a local-first parse (`xivauth.ts:296-302`) and covered by a parametrized `%s`-roster-shape test in `xivauth.test.ts`.
- BUG-050 (`/auth/revoke` reporting a failed KV write as success) is fixed and precisely regression-tested, including the "must not say JTI" assertion (`token.test.ts:487-540`).
- oauth-06/oauth-07 (D1 timestamp format mismatch; concurrent-link race on `attachIdentities`) are both fixed and covered — including the exact "two concurrent first sign-ins" INSERT-race scenario (`user-service.test.ts:412-478`).
- The two hand-rolled D1 test mocks in this unit (`__tests__/mocks/cloudflare-test.ts`, `__tests__/user-service.test.ts`) are statement-aware (branch on `sql.includes(...)`), not a scripted answer-queue blind to the statement — the generic "D1 mock answers `.first()` regardless of statement" risk named in the brief does not apply here.
- `oauth-10` (no `RETURNING`) — confirmed still open, not re-filed; the code comment correctly cites the statement-blind-mock risk as the reason to defer it.
- CORS and redirect-URI validation share one allowlist function (`getAllowedRedirectOrigins`), so a host cannot be trusted for one half of the flow and not the other (BUG-018 lineage).

## 4. REJECTED

- `bodySizeLimit`'s doc comment ("checks the actual stream, not just Content-Length") is only true when `Content-Length` is absent/chunked — Hono's `bodyLimit` trusts a present `Content-Length` header outright (confirmed in `node_modules/hono/dist/middleware/body-limit/index.js`). Not filed as a live bypass: standard HTTP/1.1 framing bounds the bytes actually delivered to the application to the declared `Content-Length`, so I could not construct a request that both understates its length and still delivers a larger body to `c.req.text()` — could not make it fail without asserting facts about the edge runtime I can't verify from source.
- Clock skew on `exp`/`state.exp` (0 tolerance, no leeway) — matches `@xivdyetools/auth`'s documented default and the "Cloudflare's synchronised clocks" rationale; not a bug.
- Signed-state replay (the same signed `state` is verified once at the GET leg and again inside `verifyPkceStateBinding` at the POST leg) — by design; the state alone grants nothing without the provider's single-use authorization code and the client-held `code_verifier`, neither of which a captured GET-callback URL contains.
- `createJWTForUser`'s `parseInt(env.JWT_EXPIRY, 10) || 3600` silently substitutes 3600 for a `0` expiry (0 is falsy) — degenerate input, `validateEnv` already requires `expiry > 0` and fails closed in production; only reachable with a deliberately broken dev env.
- `recoverErrorTarget` doesn't check `stateData.provider === config.provider` before recovering a redirect target on the error path — only bounces to an already-allowlisted origin either way (validated by `validateRedirectUri`), no privilege or data implication, just picks a technically-unrelated-provider's origin in an already-narrow scenario.

## 5. COVERED

**26 files read** (full unless noted):

`apps/oauth/src/index.ts`, `src/types.ts`, `src/constants/oauth.ts`, `src/handlers/authorize.ts`, `src/handlers/oauth-flow.ts`, `src/handlers/callback.ts`, `src/handlers/xivauth.ts`, `src/handlers/token.ts`, `src/services/jwt-service.ts`, `src/services/user-service.ts`, `src/services/rate-limit.ts`, `src/utils/oauth-validation.ts`, `src/utils/pkce-binding.ts`, `src/utils/state-signing.ts`, `src/utils/env-validation.ts`, `src/middleware/body-validation.ts`, `schema/users.sql`, `migrations/0001_drop_xivauth_characters.sql`, `wrangler.toml`.

Tests: `__tests__/mocks/cloudflare-test.ts` (full), `__tests__/user-service.test.ts` (full), `__tests__/token.test.ts` (full), `__tests__/jwt-service.test.ts` (full), `__tests__/middleware.test.ts` (full), `__tests__/callback.test.ts` (partial: GET-callback block + grep for coverage of state/BUG-049/oauth-05), `__tests__/xivauth.test.ts` (partial: grep + BUG-051/roster sections), `__tests__/index.test.ts` (partial: CORS, 404, Cache-Control, rate-limit, env-gates, error-handler blocks).

Package entry points read to confirm delegation/regression claims (out-of-scope package, read-only per brief): `packages/auth/src/jwt.ts`, `packages/auth/src/revocation.ts`, `packages/auth/src/hmac.ts`, `packages/worker-kit/src/rate-limiter/presets/configs.ts`, `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`. Framework behavior confirmed against installed `hono@4.13.7` (`request.js`, `middleware/cors/index.js`, `middleware/body-limit/index.js`).

Not fully read (skimmed via grep only): `__tests__/authorize.test.ts`, `__tests__/rate-limit.test.ts`, `__tests__/rate-limit-binding.test.ts`, `__tests__/oauth-validation.test.ts`, `__tests__/oauth-constants.test.ts`, `__tests__/schema.test.ts`, `__tests__/wrangler-config.test.ts`, `__tests__/env-validation.test.ts`, `__tests__/body-validation.test.ts`.
