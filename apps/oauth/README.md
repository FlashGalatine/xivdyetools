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
| `POST` | `/auth/callback` | Same exchange for clients that prefer to POST the code |

### XIVAuth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/xivauth` | Begin the XIVAuth flow — links verified FFXIV characters |
| `GET` | `/auth/xivauth/callback` | XIVAuth redirect target |
| `POST` | `/auth/xivauth/callback` | POST variant of the exchange |

### Token lifecycle

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/refresh` | Exchange a refresh token for a new access token |
| `POST` | `/auth/revoke` | Revoke a token — adds its `jti` to the KV blacklist |
| `GET` | `/auth/me` | Return the authenticated user's profile |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info JSON |
| `GET` | `/health` | Health probe |

## Tokens

Access tokens are **HS256 JWTs** with a one-hour default lifetime (`JWT_EXPIRY = 3600`), issued with `iss` set to `WORKER_URL` — `https://auth.xivdyetools.app` in production.

Revocation is a KV-backed `jti` blacklist (`TOKEN_BLACKLIST`) whose entries live for the token's remaining lifetime **plus the refresh grace window** (`REFRESH_GRACE_SECONDS` from `@xivdyetools/auth`, 15 min — the same constant `/auth/refresh` uses to accept a recently expired token), so a revoked token can neither be used nor refreshed, and entries still clean themselves up afterwards (FINDING-001, 2026-08-21 audit). `presets-api` binds the same namespace and rejects revoked tokens too (FINDING-002), so `/auth/revoke` really does end a session. Revocation checks **fail open**: if KV is unavailable the check returns `false` rather than throwing, keeping auth functional during an outage at the cost of briefly honouring a revoked token.

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
pnpm --filter xivdyetools-oauth-worker exec wrangler deploy --env development   # xivdyetools-oauth-dev
pnpm --filter xivdyetools-oauth-worker exec wrangler deploy --env preview       # auth-preview.xivdyetools.app
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

The `preview` and `development` environments carry their own KV namespace and D1 database (`xivdyetools-users-dev`), so they do not share user state with production.

### Required Secrets

```bash
wrangler secret put JWT_SECRET              # HS256 signing key
wrangler secret put DISCORD_CLIENT_SECRET   # Discord OAuth2 client secret
wrangler secret put XIVAUTH_CLIENT_SECRET   # XIVAuth OAuth2 client secret
```

`JWT_SECRET` is shared with [`apps/presets-api`](../../apps/presets-api/), which verifies the tokens this Worker signs. **Rotating it in one place without the other invalidates every session.** See [`docs/operations/SECRET_ROTATION.md`](../../docs/operations/SECRET_ROTATION.md).

## Security

- **PKCE** on both OAuth2 flows — the authorization code alone is not sufficient to obtain a token.
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
