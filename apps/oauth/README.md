# xivdyetools-oauth-worker

> OAuth2 authentication and JWT issuance for XIV Dye Tools — a Cloudflare Worker on Hono backed by D1, supporting Discord and [XIVAuth](https://xivauth.net/) as identity providers.

Deployed at [auth.xivdyetools.app](https://auth.xivdyetools.app).

## Role in the ecosystem

This Worker is the **only** component that issues tokens. Every other secured Worker (`presets-api`, `discord-worker`, `moderation-worker`) only *verifies* them via `@xivdyetools/auth`. Keeping issuance in one place means the signing secret lives in one place, and the verify-only surface exposed elsewhere stays small and audit-friendly.

## Endpoints

All auth routes are mounted under `/auth`.

### Discord OAuth2

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/discord` | Begin the Discord OAuth2 flow — redirects to Discord with PKCE state |
| `GET` | `/auth/callback` | Discord redirect target; exchanges the code and issues a JWT |
| `POST` | `/auth/callback` | SPA token exchange — body `{ code, code_verifier, state }` (`state` = the signed value echoed by the GET callback) |

### XIVAuth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/xivauth` | Begin the XIVAuth flow — links verified FFXIV characters |
| `GET` | `/auth/xivauth/callback` | XIVAuth redirect target |
| `POST` | `/auth/xivauth/callback` | SPA token exchange — body `{ code, code_verifier, state }` |

### Token lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/revoke` | Revoke a token — adds its `jti` to the KV blacklist |
| `GET` | `/auth/me` | Return the authenticated user's profile |

There is no refresh endpoint. `POST /auth/refresh` was removed in 3.0.0 and now 404s — see [Tokens](#tokens).

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info JSON |
| `GET` | `/health` | Health probe |

## Tokens

Access tokens are **HS256 JWTs** with a one-hour default lifetime (`JWT_EXPIRY = 3600`), issued with `iss` set to `WORKER_URL` — `https://auth.xivdyetools.app` in production.

**A session ends at `exp`.** There is no way to extend one: `POST /auth/refresh` was removed in 3.0.0 (FINDING-003, 2026-08-29 audit) and the route 404s. It had no client — the web app signs in again rather than refreshing — but it accepted a token on signature alone for a grace window past `exp` and re-minted the new token from the *old* token's claims, so anyone holding a copied token could keep the chain alive for up to 30 days and survive the victim's `/auth/revoke` (only the presented `jti` was blacklisted).

Revocation is a KV-backed `jti` blacklist (`TOKEN_BLACKLIST`) whose entries live for the token's remaining lifetime **plus `REFRESH_GRACE_SECONDS`** (`@xivdyetools/auth`, 15 min — now purely a clock-skew margin), so a revoked token cannot be used and entries still clean themselves up afterwards (FINDING-001, 2026-08-21 audit). `presets-api` binds the same namespace and rejects revoked tokens too (FINDING-002), so `/auth/revoke` really does end a session. Revocation checks **fail open**: if KV is unavailable the check returns `false` rather than throwing, keeping auth functional during an outage at the cost of briefly honouring a revoked token.

Every response carries `Cache-Control: no-store` and `Pragma: no-cache` (FINDING-022; RFC 6749 §5.1).

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-oauth-worker run dev          # wrangler dev on http://localhost:8788
pnpm --filter xivdyetools-oauth-worker run test
pnpm --filter xivdyetools-oauth-worker run type-check
pnpm --filter xivdyetools-oauth-worker run lint
```

The `development` environment points `FRONTEND_URL` at `http://localhost:5173` (the web app's Vite dev server) and `WORKER_URL` at `http://localhost:8788`, so the OAuth redirect round-trip works locally.

## Deployment

> ⚠️ **This worker is the exception to the monorepo's deploy convention.** Its top-level `wrangler.toml` config *is* production — `name = "xivdyetools-oauth"` with the `auth.xivdyetools.app` routes attached. Both `deploy` and `deploy:production` run a bare `wrangler deploy` and therefore **both ship to production**. There is no accidental-staging safety net here.

```bash
pnpm --filter xivdyetools-oauth-worker run deploy       # PRODUCTION (auth.xivdyetools.app)

# Non-production targets must be named explicitly:
pnpm --filter xivdyetools-oauth-worker exec wrangler deploy --env development   # xivdyetools-oauth-dev (the only other env)
```

See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md) for the full per-worker matrix.

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 (`xivdyetools-users`) | User records and linked identities |
| `TOKEN_BLACKLIST` | KV Namespace | Revoked `jti` values, TTL-bounded |
| `ENVIRONMENT` | Var | `development` or `production` |
| `DISCORD_CLIENT_ID` | Var | Discord application ID |
| `XIVAUTH_CLIENT_ID` | Var | XIVAuth application ID |
| `FRONTEND_URL` | Var | Where to redirect after a successful login |
| `WORKER_URL` | Var | This Worker's own origin — becomes the JWT `iss` claim |
| `JWT_EXPIRY` | Var | Access token lifetime in seconds (default `3600`) |

The `development` environment carries its own KV namespace and D1 database (`xivdyetools-users-dev` — its `database_id` in `wrangler.toml` is still a placeholder to be created with `wrangler d1 create`), so it does not share user state with production. There is no `preview` environment any more: it bound the production D1/KV behind a stale frontend origin and was deleted in the 2026-08-21 security audit (FINDING-029). `ENVIRONMENT` must be `development` or `production`, and every value other than `development` gets the full production gates (HTTPS-only URLs, fail-closed env validation, HSTS).

### Required Secrets

```bash
wrangler secret put JWT_SECRET              # HS256 signing key
wrangler secret put DISCORD_CLIENT_SECRET   # Discord OAuth2 client secret
wrangler secret put XIVAUTH_CLIENT_SECRET   # XIVAuth OAuth2 client secret
```

`JWT_SECRET` is shared with [`apps/presets-api`](../../apps/presets-api/), which verifies the tokens this Worker signs. **Rotating it in one place without the other invalidates every session.** See [`docs/operations/SECRET_ROTATION.md`](../../docs/operations/SECRET_ROTATION.md).

## Security

- **PKCE** on both OAuth2 flows — the authorization code alone is not sufficient to obtain a token. The GET callback echoes the worker-signed `state`; the SPA must return it in the POST callback body (`{ code, code_verifier, state }` — `400 Missing state` otherwise), and the worker verifies `S256(code_verifier)` against the signed `code_challenge` **before** calling the provider, so PKCE does not depend on the IdP enforcing it (FINDING-012).
- **Exact redirect target** — `redirect_uri` must be an allowlisted origin **and** exactly `/auth/callback` (no query string or fragment); `return_path` and the SPA `state` are bounded server-side (256 visible-ASCII characters).
- **XIVAuth identity** — only a verified character becomes `username`/`global_name`; the XIVAuth-asserted Discord link must be a valid snowflake, an existing local account is never silently merged or deleted, and the XIVAuth handler logs no identifiers (FINDING-013).
- **Data minimisation** — a sign-in stores one identity row and nothing else. The FFXIV character roster XIVAuth returns is read in memory to pick the verified character and then discarded (the `xivauth_characters` table is gone — FINDING-001), the avatar URL is recomputed on every response rather than stored (FINDING-002), and the JWT carries only the claims consumers read: `sub`, `iat`, `exp`, `iss`, `jti`, `username`, `global_name`, `avatar`, `auth_provider`, `discord_id`.
- **HS256 pinning** — tokens are signed and verified with HS256 only; `alg: none` and `alg: RS256` confusion attacks are rejected at verification time in `@xivdyetools/auth`.
- **Required claims** — issued tokens always carry `exp` and `sub`; consumers reject tokens missing either.
- **Timing-safe comparison** for all secret comparisons.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/auth` | HMAC signing primitives, Base64URL/hex encoding, revocation store |
| `@xivdyetools/types` | `JWTPayload`, `DiscordUser`, `XIVAuthUser`, etc. |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Request ID, logger, and rate-limit middleware |

## Related Projects

- [`apps/presets-api`](../../apps/presets-api/) — verifies the JWTs issued here.
- [`apps/web-app`](../../apps/web-app/) — initiates the login flow and stores the resulting token.
- [XIVAuth](https://xivauth.net/) — third-party FFXIV character verification service.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
