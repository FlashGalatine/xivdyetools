# FINDING-017: /glamour has no tier of its own and spends one shared api-worker service key
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker + worker-kit (preset) + api-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/worker-kit/src/rate-limiter/presets/configs.ts:102` — /glamour has no tier of its own and spends one shared api-worker service key

## Evidence
- configs.ts:102 `default: { maxRequests: 15, windowMs: 60_000 }`; rate-limit.ts:61-62 `const SERVICE_LIMIT = { maxRequests: 1300, windowMs: 60_000, failOpen: true } as const; const SERVICE_KEY = 'workers';`
- Reach: Any Discord user runs /glamour with a .chara attachment. That is up to 15 runs a minute per account (the default tier) and each run makes one POST /v1/chara/resolve over the UNIVERSALIS_PROXY binding. About 87 accounts together fill api-worker's single 'workers' service bucket (1300/60 s), after which every user's /glamour answers RESOLVE_BUSY.
- DISCORD_COMMAND_LIMITS (configs.ts:68-103) has no 'glamour' key, LOCAL_COMMAND_LIMITS (discord-worker services/rate-limiter.ts:189) holds only changelog, so getDiscordCommandLimit returns the default (configs.ts:115 → :102, 15/min), enforced at index.ts:954. Every binding request has no client IP, so api-worker rate-limit.ts:61-62,97 puts them all under one key, 'workers', limited to 1300/60 s (wrangler SERVICE_RATE_LIMITER, limit 1300). glamour.ts:54-98 makes one resolve per run, and bot-logic glamour.ts:468-470 turns a 429 into RESOLVE_BUSY. The effect is cross-user availability only: no data exposure, and the public /v1/chara/re… Preconditions: The attacker needs about 87 Discord accounts that can run the bot's commands, each sending a valid .chara attachment (the attachment guards run before the defer). Native rate limits are counted per colo, but Discord interactions arrive from Discord's own egress, so in practice the bucket is close t…
- Live state the repo cannot show: How many colos Discord interaction traffic lands in decides whether the 1300/60 s bucket is effectively global. The deployed SERVICE_RATE_LIMITER namespace 1005 (limit 1300) is assumed to match wrangler.toml.

## Fix
- Give glamour its own tier in DISCORD_COMMAND_LIMITS, e.g. 5/min on the existing RL_5 binding, which also needs a worker-kit release, or add a LOCAL_COMMAND_LIMITS entry in discord-worker as a stopgap. Optionally key api-worker's service bucket per Discord user (a forwarded, binding-only header) so one user group cannot fill the shared 'workers' key.

## Status
OPEN — the 5/minute shared glamour preset and existing Discord RL_5 selection regression are prepared 2026-10-27 in worker-kit 1.6.0 / Discord 5.9.1. The maintainer approved keeping the automatic consumer deployments, with all affected apps validated first. Deployed effective-limit verification remains pending; the shared upstream service budget is still shared. [Implementation and verification evidence](../evidence/remediation-worker-kit-2026-10-27.md).
