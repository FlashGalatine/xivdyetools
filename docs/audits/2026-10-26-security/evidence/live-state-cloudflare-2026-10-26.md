# Live Cloudflare state — read-only (2026-10-26)

Read at the maintainer's request in this session ("Allow read-only Cloudflare queries", §8 gate 2026-10-26) through the Cloudflare API MCP connection. **Only GET/list calls and aggregate `SELECT COUNT`s were made; nothing was written.** Secret values were never requested (the secrets endpoint returns names only); no row of personal data was read — the D1 queries are counts. The account holds other projects (`doyoulikethis-*`, `galatine-*`, `calendar-sync-worker`, `webp-converter`, `shaderfinder-webapp`, `xivcharakit-demo`); they are outside this audit and were not examined.

## Workers (names, `workers.dev` subdomain, secret NAMES)

| Worker | `workers.dev` / previews | Secret names |
|---|---|---|
| `xivdyetools-discord-worker` (prod) | off / off | BOT_API_SECRET, BOT_SIGNING_SECRET, DISCORD_PUBLIC_KEY, DISCORD_TOKEN, GITHUB_WEBHOOK_SECRET, INTERNAL_WEBHOOK_SECRET, MODERATION_BOT_TOKEN, MODERATION_CHANNEL_ID, MODERATOR_IDS, STATS_AUTHORIZED_USERS, SUBMISSION_LOG_CHANNEL_ID |
| `xivdyetools-discord-worker-dev` (beta bot) | **on / on** (by design) | DISCORD_PUBLIC_KEY, DISCORD_TOKEN — **no** BOT_API_SECRET / BOT_SIGNING_SECRET |
| `xivdyetools-presets-api` (prod) | off / off | BOT_API_SECRET, BOT_SIGNING_SECRET, CACHE_PURGE_API_TOKEN, INTERNAL_WEBHOOK_SECRET, JWT_SECRET, MODERATOR_IDS, **PERSPECTIVE_API_KEY** |
| `xivdyetools-presets-api-dev` | off / off | none (binds production `DB`, `THUMBNAILS`, service bindings) |
| `xivdyetools-moderation-worker` (prod) | off / off | BOT_API_SECRET, BOT_SIGNING_SECRET, DISCORD_PUBLIC_KEY, DISCORD_TOKEN, MODERATION_CHANNEL_ID, MODERATOR_IDS, SUBMISSION_LOG_CHANNEL_ID |
| `xivdyetools-api-worker-dev` | **on / on** — contradicts `apps/api-worker/wrangler.toml:18-19` (`workers_dev = false`, `preview_urls = false`); last deployed **2026-08-10**; bindings: KV `RATE_LIMIT` + plain vars only (no native rate limiters, no chara/telemetry bindings) | none |
| `xivdyetools-og-worker-dev` | off / off (served at `og-beta.xivdyetools.app` and the `beta.` routes) | none |
| `xivdyetools-universalis-proxy` | off / off, no route, no custom domain — **retired app, still deployed** | none |
| `xivdyetools-oauth-dev` | **does not exist** (no worker of that name) | — |

HEAD probes: `https://xivdyetools-api-worker-dev.<account>.workers.dev/` → **200 JSON** (`X-API-Version: v1`); `…presets-api-dev…` → 404; `…discord-worker-dev…` → 404 ([capture](live-headers-http-and-retired.txt)).

## Zone `xivdyetools.app`

- `ipv6: on` (since 2026-01-15), **`pseudo_ipv4: off`**, **`always_use_https: off`**, **`min_tls_version: 1.0`**, zone-level HSTS (`security_header`) disabled (the Workers and Pages set their own HSTS header).
- Plain HTTP is served, not redirected: `http://api.xivdyetools.app/`, `http://data.xivdyetools.app/`, `http://auth.xivdyetools.app/` each answer **200 OK** over cleartext ([capture](live-headers-http-and-retired.txt)).
- DNS: 12 records, every CNAME target exists (`beta` → `xivdyetools-beta.pages.dev`, apex → `xiv-colorexplorer.pages.dev`, `shots` → `public.r2.dev`); the API hosts are proxied `AAAA 100::` placeholders for Workers custom domains. Custom domains: auth/api/og/og-beta/proxy/data/developers/moderation-bot/bot → the expected workers. Zone routes: only the og-worker tool routes on `xivdyetools.app` and `beta.xivdyetools.app`. No dangling DNS or route found.

## Pages

| Project | Deployments retained | Notes |
|---|---|---|
| `xivdyetools` | **522** (each at its own `<hash>.xiv-colorexplorer.pages.dev`) | domains: `xiv-colorexplorer.pages.dev`, `xivdyetools.app` |
| `xivdyetools-beta` | **240** | domains: `xivdyetools-beta.pages.dev`, `beta.xivdyetools.app` |
| `xivdyetools-api-docs` | 22, last 2026-07-21 | **retired project** (docs moved into api-worker); `https://xivdyetools-api-docs.pages.dev/` → 200, no security headers ([capture](live-headers-http-and-retired.txt)) |

## D1 (aggregate counts only)

- `xivdyetools-users`: 19 users; 18 with a Discord id; 5 with an XIVAuth id; **4 linked to both**.
- `xivdyetools-presets`: 16 presets (all approved) by 7 authors — 1 UUID-shaped author id, 6 snowflake-shaped. Trigger `presets_content_revision_after_update` present, `content_revision` column present, `submission_events` accepts `text_edit` — **2026-10-03/FINDING-031's deployed-schema limit is closed** (migrations 0012 and 0014 are applied; `d1_migrations` holds 0 rows, as the runbook's hand-applied process implies).
- No dev D1 databases exist (4 databases in the account: `xivdyetools-users`, `xivdyetools-presets`, `doyoulikethis-prod`, `calendar-sync`).

## What this settles

| Finding | Effect |
|---|---|
| FINDING-004 | Precondition confirmed: IPv6 on, Pseudo IPv4 off, so `CF-Connecting-IP` is the full IPv6 address. |
| FINDING-018 | `PERSPECTIVE_API_KEY` is set in production: the reorder is reachable and will not lapse before the key is removed. |
| FINDING-001 | `MODERATION_CHANNEL_ID` and `SUBMISSION_LOG_CHANNEL_ID` are configured on both bots: the submission-log copy is live. |
| FINDING-009 | Scale is 522 + 240 retained deployments (not three). |
| FINDING-030 | The beta bot holds neither signing secret: the described escalation is not present today. |
| FINDING-032 | No `xivdyetools-oauth-dev` worker and no dev D1 exist: the route-inheritance trap is latent. |
| FINDING-023 / -025 | Population is tiny: 4 users linked to both identities; 1 UUID-shaped preset author of 7. |
| New | Plain HTTP served on `api.`/`data.`/`auth.`; zone minimum TLS 1.0; a stale public `xivdyetools-api-worker-dev`; the retired `xivdyetools-api-docs` Pages site and `xivdyetools-universalis-proxy` worker still deployed. |

The account `workers.dev` subdomain is redacted as `<account>` in this folder (it is the maintainer's handle and the files are published with the audit).
