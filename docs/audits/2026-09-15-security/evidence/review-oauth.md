# OAuth worker review

**Scope:** `apps/oauth` at `0332fcc5`; source-only review.  The top-level `wrangler.toml` block is production, with no `[env.production]`.

## Route and authorization matrix
| Route | Gate / validation | Result |
|---|---|---|
| `GET /`, `/health` | global env validation, headers | public health only |
| `GET /auth/discord`, `/auth/xivauth` | `/auth/*` IP/path native limit; PKCE challenge, redirect/state/return-path validation | public OAuth initiation |
| `GET /auth/callback`, `/auth/xivauth/callback` | signed, expiring provider-bound state; redirect revalidated | public provider bounce |
| `POST /auth/callback`, `/auth/xivauth/callback` | 10 KB/depth cap; required signed state + S256 verifier binding before provider fetch | public exchange |
| `GET /auth/me` | Bearer JWT, HS256/expiry/issuer + revocation wrapper | authenticated user |
| `POST /auth/revoke` | signature-valid Bearer JWT; failure to write revocation returns 503 | authenticated user |

## Candidates
No unit-specific candidate verified.

## Positive controls
- State signature and expiry are enforced in `utils/state-signing.ts:53-87`; POST callbacks require state and compare S256 verifier binding at `handlers/callback.ts:90-114` (same shared pipeline for XIVAuth).
- Redirects require an exact allowed origin and `/auth/callback` with no query/fragment (`utils/oauth-validation.ts:75-107`), and the callback revalidates before bouncing (`handlers/oauth-flow.ts:271-303`).
- JWT creation uses HS256; verification pins algorithm, expiry and issuer (`services/jwt-service.ts:156-186`); blacklist TTL spans expiry plus grace. `/auth/refresh` is absent.
- Production env validation requires the three native rate-limit bindings, D1, KV and secrets; `wrangler.toml:1-38` binds production routes and limits. Body cap, depth cap, request timeouts, generic production errors, no-store responses, CORS exact matching, and pathname-only fail-open limiter logging are present.
- D1 access in user service is parameterized; provider fetch targets are fixed Discord/XIVAuth constants with 5/10-second timeouts. No cookies, user-agent capture, analytics sink, or unredacted identity logging found.

## Rejected suspicions
- OAuth state replay is not an authorization-code replay: it expires in ten minutes, is HMAC-verified, and the provider code remains one-time; no server state store is needed for the binding enforced before exchange.
- Open redirect, PKCE downgrade/mismatch, unsigned production state, JWT algorithm confusion, refresh-token extension, client-secret vars, and unbounded callback body were not reachable.
- A failed revoke write is not silently successful: `handlers/token.ts:146-171` logs a non-identifying reason and returns 503.
- Revocation-read fail-open is a documented residual risk, not a new finding: current `apps/oauth/README.md:56` explicitly accepts availability during KV outages at the cost of temporarily honoring revoked tokens; production requires KV and removed `/auth/refresh` limits it to the token's remaining lifetime.

## Covered files and limits
- Covered 17 production TypeScript files, `wrangler.toml`, schema/migration, target CLAUDE/README, prior-audit README plus Positive controls/Rejected suspicions, and security trade-offs. No tests, installs, production probes, or source changes.
- Limits: Cloudflare binding health and provider behavior were not production-probed.
