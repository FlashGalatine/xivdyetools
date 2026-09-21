# workers + packages cluster review

| cand-id | sev | file:line | one-line claim | evidence pointer |
|---|---|---|---|---|
| cand-001 | MEDIUM | docs/projects/oauth/overview.md:200-203 (+22-24) | "**Secrets:**" lists only `DISCORD_CLIENT_SECRET` and `JWT_SECRET` as the worker's secrets | apps/oauth/wrangler.toml:75 comment lists a third, `XIVAUTH_CLIENT_SECRET`; apps/oauth/src/types.ts:64 declares it (`XIVAUTH_CLIENT_SECRET?: string`) and src/handlers/xivauth.ts:158-159 reads it into `tokenParams.client_secret` for XIVAuth confidential-client token exchange — never mentioned in overview.md or endpoints.md |
| cand-002 | LOW | docs/projects/moderation-worker/overview.md:102-105 | "Project Structure" `types/` tree lists only `env.ts`, `ban.ts`, `preset.ts` | `apps/moderation-worker/src/types/modal.ts` exists on disk (backs `handlers/modals/{ban-reason,preset-rejection}.ts`) but is omitted from the doc's tree |

POSITIVE:
- SPECIFIC HIGH-VALUE CHECK: docs/projects/universalis-proxy/overview.md correctly documents the worker as merged/retired, not live — verified `apps/api-worker/src/universalis/{router.ts,config/,services/}` holds the code, routes actually mount at `/universalis` and `/api/v2` (apps/api-worker/src/index.ts:185-186), `proxy.xivdyetools.app` is a real route on the api-worker prod env (wrangler.toml), and `DEPRECATIONS.md` exists at repo root. No finding.
- api-worker/{overview,endpoints}.md: all 16 v1 routes (14 GET/2 POST across dyes/match/wheels/harmony/chara/telemetry), all 12 `ErrorCode` values, and the 3 universalis-proxy routes verified byte-for-byte against apps/api-worker/src/routes/*.ts, src/lib/api-error.ts and src/universalis/router.ts.
- presets-api's 5-doc cluster (database/endpoints/moderation/overview/rate-limiting) verified against schema.sql (7 tables, exact column lists), all 13 migrations (0002-0014 + legacy 002), every handler route registration, and rate-limit-service.ts's 4 daily-cap constants (10/10/20/30) — no discrepancies.
- core's 5-doc cluster verified field-for-field against source: `Dye` is genuinely 17 fields (packages/types/src/dye/dye.ts), dyes.json's 7 stored fields, `HARMONY_OFFSETS`' 10 keys, `ColorConverter`'s 7 named LRU caches, and the full RYB/CMYK conversion function sets all match exactly.
- oauth's JWT/PKCE numeric claims verified byte-for-byte: `REFRESH_GRACE_SECONDS` = 900s with a `Math.max(..., 60)` floor (packages/auth/src/revocation.ts:25,87), the `code_verifier` regex `[A-Za-z0-9-._~]{43,128}`, and the 10s/5s/5s `AbortSignal.timeout()` calls.
- og-worker's `SUPPORTED_TOOLS` (9), `OG_ALLOWED_QUERY_KEYS` (5), 8-platform crawler list (Googlebot deliberately excluded, comment matches doc's wording) and font count (10 TTFs) all verified against apps/og-worker/src/*.

SPELLING-EXCEPTION:
- docs/projects/og-worker/overview.md:207 — "Related Dyes: Soot Black, Slate Grey, Ash Grey" (illustrative harmony-card mockup): "Slate Grey" and "Ash Grey" are the game's own dye names, confirmed verbatim in packages/core/src/data/dyes.json:13,31. Correct British spelling, not a finding.

COVERED: 25/25 — api-worker/{endpoints,overview}; core/{algorithms,overview,publishing,services,types}; index; logger/overview; moderation-worker/overview; oauth/{endpoints,jwt,overview,pkce-flow}; og-worker/overview; presets-api/{database,endpoints,moderation,overview,rate-limiting}; test-utils/overview; types/overview; universalis-proxy/overview; user-guides/{index,public-api}. Nothing unfinished.
