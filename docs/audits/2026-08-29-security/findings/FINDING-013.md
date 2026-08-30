# FINDING-013: production `validateEnv` on presets-api, oauth and moderation-worker does not require the bindings/vars the 2026-08-21 fixes rely on (`TOKEN_BLACKLIST`, `JWT_ISSUER`, `JWT_SECRET`, `RL_*`) — a dropped binding silently disables revocation, issuer pinning or native rate limiting
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** presets-api + oauth + moderation-worker · **Rotation:** NONE · **CWE:** CWE-1188 (insecure default), CWE-636

## Location
- `apps/presets-api/src/utils/env-validation.ts:34-40,86-90` — required: `ENVIRONMENT`, `API_VERSION`, `CORS_ORIGIN`, `BOT_API_SECRET`, `MODERATOR_IDS` (+ `BOT_SIGNING_SECRET` in production); not `JWT_SECRET`, `JWT_ISSUER`, `TOKEN_BLACKLIST`, `RL_PUBLIC`
- `apps/presets-api/src/middleware/auth.ts:95-104` — revocation and `iss` checks are skipped when the binding/var is absent
- `apps/oauth/src/utils/env-validation.ts:36-120` — `RL_AUTH_*`, `TOKEN_BLACKLIST` not required; `apps/moderation-worker/src/utils/env-validation.ts:110-123` — `RL_COMMAND`/`RL_AUTOCOMPLETE` not required

## Evidence
- FINDING-002/003/015 (2026-08-21) are enforced only by the contents of `wrangler.toml`; a config edit or dashboard change that drops a binding degrades to "no revocation" / KV or memory limiter with no error and no log.

## Fix
- Require the security bindings in production `validateEnv` and fail every request when missing (the BUG-017 pattern already used for weak secrets); pair with FINDING-023's config tests.

## Status
PARTIAL — presets-api part FIXED 2026-08-30 efd495a4, a3e8ee14 (2.2.0: production `validateEnv` requires `JWT_SECRET` ≥ 32 chars, `JWT_ISSUER` https, `TOKEN_BLACKLIST`, `RL_PUBLIC` and fails every request when missing; one-variable tests); oauth part FIXED 2026-08-30 b14cade9 (3.0.0: production `validateEnv` requires `RL_AUTH_10/20/30` + `TOKEN_BLACKLIST` and fails every request when one is missing; one-binding tests); moderation-worker (Sprint 4) part pending.
