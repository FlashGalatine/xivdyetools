# FINDING-004: Per-IP /auth/* limiter keys on the full IPv6 address, so one /64 gets an unlimited number of independent buckets
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** oauth (root cause in packages/worker-kit getClientIp; same property in api-worker and presets-api IP-keyed limiters) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-770
**Verification:** split vote (C/R), settled by a third verifier

## Location
- `packages/worker-kit/src/rate-limiter/ip.ts:87` — Per-IP /auth/* limiter keys on the full IPv6 address, so one /64 gets an unlimited number of independent buckets

## Evidence
- ip.ts:87-89 `function normalizeIp(ip: string): string { return ip.toLowerCase(); }`; oauth services/rate-limit.ts:145 `const key = `${ip}:${path}`;`; callback.ts:119 verifyPkceStateBinding runs before the :150 fetch to discord.com/api/oauth2/token
- Reach: An unauthenticated client with a routed IPv6 /64 calls /auth/discord, /auth/xivauth and POST /auth/callback from rotating source addresses. apps/oauth/src/index.ts:182-193 keys each request on getClientIp() (CF-Connecting-IP, only lowercased at ip.ts:61-63 and 87-89) plus path (services/rate-limit.ts:145), so every address gets a fresh bucket.
- The code does what the claim says: normalizeIp only lowercases, nothing in worker-kit collapses a prefix, and the oauth key is `${ip}:${path}`. Impact is bounded because callback.ts:109-128 requires a signed state with a PKCE binding before the Discord token fetch at :150, so nothing can be brute forced. What remains is unthrottled login initiation and 1:1 upstream token calls that use the app's client credentials, which is hardening grade (LOW). Opinion B's rejection grounds (2026-08-29 review-api-worker.md:204, 2026-10-04 verdicts.tsv:211) are evidence files outside the exclusion sources, and the 10-04 rejection only cited the ea… Preconditions: The attacker holds an IPv6 /64, which is common on residential and VPS connections. The auth.xivdyetools.app zone serves IPv6 and does not overwrite CF-Connecting-IP with Pseudo IPv4.
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): zone `xivdyetools.app` has IPv6 **on** (since 2026-01-15) and Pseudo IPv4 **off**, so `CF-Connecting-IP` is the full IPv6 address and each address in a /64 gets its own bucket. Dashboard WAF and rate-limiting rules were not read.

## Fix
- In getClientIp, or behind an opt-in option used by the oauth/api-worker/presets-api IP limiters, collapse IPv6 to its /64 (expand '::', keep the first 4 hextets) and leave IPv4 as is. Add a test that two addresses in one /64 share a key, and check that the key-scope IPV6_RE still labels the collapsed form `ip`.
- **Maintainer decision:** the live check is done (IPv6 on, Pseudo IPv4 off). Choose dashboard-side mitigation (a WAF rate-limiting rule keyed on the /64) or /64 keying in the `getClientIp`-based limiters; the code fix is Sprint 1 of the plan.

## Status
OPEN — opt-in library support and regression tests prepared 2026-10-27 in worker-kit 1.6.0; existing callers remain opted out. API, presets-api and OAuth adoption/deployment remain in their owning app sprints. No npm publication or live verification has occurred. [Implementation and verification evidence](../evidence/remediation-worker-kit-2026-10-27.md).
