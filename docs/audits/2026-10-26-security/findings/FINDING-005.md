# FINDING-005: No cache-miss upstream budget on /v1/chara/*; arbitrary canonical icon ?version= (and any unknown key) forces an XIVAPI call per request
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-770

## Location
- `apps/api-worker/src/chara/xivapi.ts:296` — No cache-miss upstream budget on /v1/chara/*; arbitrary canonical icon ?version= (and any unknown key) forces an XIVAPI call per request

## Evidence
- xivapi.ts:295-296 `const version = versionOverride ?? this.version; if (isCanonicalVersion(version)) return { base: this.base, version, cacheable: true };` | rate-limit.ts:31 `failOpen: true` | icons.ts:35 404 thrown, never cached
- Reach: An anonymous client sends GET /v1/chara/icon/:id?version=<any 16-hex> (router.ts:306-314 accepts it, xivapi.ts:294-296 marks it cacheable unchecked), or POST /v1/chara/resolve with novel set/base/variant integers. Each one is a cache-cold key and costs one XIVAPI asset fetch or search (plus a Glasses fetch) under the project User-Agent. The only limit is the shared /v1/* bucket of 65 per 60 s per IP per colo, which fails open.
- Every fact holds at HEAD. resolveAssetContext (xivapi.ts:294-296) trusts any canonical version, and the icon cache key includes that version (icon-cache.ts:28). The resolve keys pack any integer lane up to LANE_MAX (router.ts:60-73, 118-120), and lookup-loader.ts:58-62 stores every non-truncated miss for about 7+1 days. The chara routes have no miss-only limiter of the kind the Universalis proxy got in FINDING-011 (no chara hit for a miss limiter in src). A 429 only throws to a 503 with no backoff (xivapi.ts:399-400), and API_LIMIT is failOpen: true (rate-limit.ts:31). The new ?version= adds little: an unversioned unknown iconId al… Preconditions: Any internet client. Amplification scales with the number of source IPs and colos, because the 65/60 s counter is per IP per colo and admits on backend error. Unconfirmed: how XIVAPI answers an unknown version key. The upstream call happens either way, and only a 200 PNG gets cached.
- Live state the repo cannot show: How XIVAPI rate-limits or blocks the project's User-Agent, and how it answers an unknown asset version key. Whether API_RATE_LIMITER is bound in production (the repo's wrangler.toml declares it).

## Fix
- Charge only cache misses on /v1/chara/* to a dedicated per-IP native rate-limit binding (mirror the Universalis onMiss pattern, with a 20x service key for discord-worker's /glamour). Optionally accept ?version= only when it equals the currently discovered or pinned game key, or serve it uncacheable otherwise. Add a short circuit-breaker on upstream 429/503.

## Status
OPEN
