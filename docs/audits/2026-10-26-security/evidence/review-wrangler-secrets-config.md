# Review: wrangler-secrets-config (all workers) - 2026-10-26

## Config table (apps/*/wrangler.toml, 7 files; stoat-worker has no wrangler)

| Worker | Top-level env | Prod env | workers_dev / preview_urls | observability | ratelimits (ns ids) | Notes |
|---|---|---|---|---|---|---|
| api-worker | `-dev`, no routes | `[env.production]` data./proxy./developers. custom domains | false/false top (:18-19); prod workers_dev inherits false, preview_urls inherits false | off both (:99, :173) | API 1001/1002, TELEMETRY 1003/1004, SERVICE 1005/1006, UNIV 1007/1008, UNIV_SVC 1009/1010 | vars public only; XIVAPI_BASE/UNIVERSALIS_API_BASE are config not user input |
| discord-worker | BETA bot, `workers_dev=true` (:16), preview_urls unset (known residual g) | bot. custom domain, workers_dev=false | see left | off both | RL_5..70 prod 1041-1046, beta 1051-1056 | beta shares prod PRESETS_API/UNIVERSALIS/IMAGE service bindings by design (DEPLOY_ENVIRONMENTS.md); beta KV isolated |
| image-worker | `-dev` | `[env.production]` | false/false both envs, test-pinned | off both | none (binding-only) | no routes |
| moderation-worker | `-dev`, workers_dev=false (:17) | moderation-bot. custom domain | preview_urls unset | off both | RL_COMMAND/AUTOCOMPLETE prod 1031/1032, dev 1033/1034 | top-level binds PROD D1 + KV (:27-34) |
| oauth | top level IS production (route auth.) | none; `[env.development]` only | unset (routes present) | off (:48, inherited) | RL_AUTH_10/20/30 prod 1021-1023, dev 1024-1026 | XIVAUTH_CLIENT_ID in [vars] is a public client id |
| og-worker | BETA routed (beta./og-beta.) | zone routes + og. | workers_dev=false both | off both | none | public render routes with no rate limit binding (reviewed by og-worker reviewer) |
| presets-api | `-dev`, workers_dev=false | api. custom domain, cron 23 4 * * * (prod only) | preview_urls unset | off both | RL_PUBLIC prod 1011, dev 1012 | top-level binds PROD D1, PROD R2, PROD service bindings |

Namespace ids: `git grep` duplicate check over all `namespace_id` values returned none (unique).
Compat flags: none anywhere (no nodejs_compat). Cron: presets-api only, production only.

## Authz matrix

Not applicable to config review; per-route authz belongs to the unit reviewers.

## POSITIVE controls

- No secret in any `[vars]`: only client ids, URLs, zone id, channel ids, rate-limit numbers. Secrets are enumerated as comments only.
- `.gitignore:11-12` ignores `apps/*/.dev.vars` and `.dev.vars.*`; no `.dev.vars*` tracked; only tracked env example is `apps/stoat-worker/.env.example` (empty values).
- `[observability] enabled=false` pinned at top level AND production in all 7 workers (FINDING-022 holds; no logpush/tail_consumers/cron beyond presets-api retention).
- Per-env namespace_ids distinct; production vs beta vs dev rate limiters do not share counters.
- api-worker and image-worker pin `workers_dev=false` + `preview_urls=false`, test guarded.
- Production routes only on `.xivdyetools.app`; retired projectgalatine domains absent.
- All eight production-facing error handlers hide message/stack unless `ENVIRONMENT==='development'`; production envs set `ENVIRONMENT="production"` explicitly (vars not inherited, repeated).
- potential-secrets.txt classification (76 hits): 0 real. ~58 test fixtures (`token: 'interaction-token'`, `access_token: 'xivauth_token'`, `'x'.repeat(32)`, jwt.test.ts secrets, base-logger.test.ts), ~17 doc/audit prose lines (docs/audits/**, logger CHANGELOG/CLAUDE.md), 1 source line (discord-worker scripts/upload-emojis.ts:102 builds header from a runtime variable), 1 web-app i18n-parity.mjs parser variable.

## REJECTED

- discord-worker beta workers_dev=true / preview_urls unset: previously recorded residual g (2026-08-29, 2026-10-03), Ed25519 verification makes it inert.
- Beta bot sharing production PRESETS_API binding: documented accepted residual (DEPLOY_ENVIRONMENTS.md section 3); beta lacks BOT_API_SECRET.
- moderation-worker KV id equal to discord-worker production KV id (1fcb7e03...): shared preferences/rate-limit namespace, no secret in it; not a vulnerability.
- oauth XIVAUTH_CLIENT_ID / Discord client ids in [vars]: public OAuth client identifiers.
- presets-api `ADDITIONAL_CORS_ORIGINS` includes xiv-colorexplorer.pages.dev: pinned by test, documented.
- Missing rate-limit binding on og-worker: out of this reviewer's scope (public cacheable image routes).

## FILES COVERED

~14 files: 7 wrangler.toml, .gitignore, apps/stoat-worker/.env.example, evidence wrangler-surface.txt + potential-secrets.txt, oauth wrangler-config.test.ts, docs/developer-guides/environment-variables.md (lines 1-140), docs/operations/DEPLOY_ENVIRONMENTS.md (240-310), presets-api auth.ts/index.ts (dev gates). Directories: apps/*/ (root config), docs/developer-guides, docs/operations, docs/audits/2026-10-26-security/evidence.

## Candidates

See structured return (wrangler-secrets-config-01, -02, both LOW / LOCAL).
