# FINDING-007: discord-worker per-user rate-limit counters (keyed by Discord user id) live in Upstash Redis — the privacy policy says Cloudflare KV and never names Upstash as a processor
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker (+ policy) · **Rotation:** NONE · **CWE:** CWE-359

## Location
- `apps/discord-worker/src/services/rate-limiter.ts:40` (`KEY_PREFIX = 'ratelimit:user:'`), `:73-80` (Upstash preferred when URL + token are set), `:184-185` (key `<userId>:<command>`)
- `packages/worker-kit/src/rate-limiter/backends/upstash.ts:72-77,154` — `INCR`/`EXPIRE` against the Upstash REST API

## Evidence
- `docs/operations/POST_MERGE_CHECKLIST.md:66-69,82-83` — production discord-worker has `UPSTASH_REDIS_REST_URL/TOKEN` set ("Upstash + KV, no `ratelimits` binding by design").
- `apps/discord-worker/PRIVACY_POLICY.md` §2 "Rate Limiting Data — stored in Cloudflare KV"; §5 storage table and §6 third-party table never mention Upstash.

## Fix
- Either move the bot to the native `[[ratelimits]]` binding like the other four workers did under 2026-08-21/FINDING-003 (removes the third party and the KV race), or disclose Upstash as a processor with its 70 s retention in §2/§5/§6.

## Status
OPEN
