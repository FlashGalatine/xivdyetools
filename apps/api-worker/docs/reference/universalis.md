# Universalis Proxy

A cached, coalesced, rate-limited pass-through to the [Universalis](https://universalis.app) market-board API. It exists so browser clients (the XIV Dye Tools web app) and bots can read market prices without hitting Universalis directly — the proxy adds `Access-Control-Allow-Origin: *`, edge caching with stale-while-revalidate, and request coalescing.

::: warning Not part of `/v1`
These routes live **outside** `/v1`, so the [envelope](../guide/responses), the `X-RateLimit-*` headers, `?locale=` and the `/v1` KV rate limiter do **not** apply. Responses are Universalis' own JSON bodies, forwarded as-is. Error bodies are a bare `{ "error": "..." }` object with the upstream status code.
:::

## Base URL

```
https://data.xivdyetools.app/universalis
```

The same router is also mounted at `/api/v2/*` (on `data.xivdyetools.app` and on the legacy `proxy.xivdyetools.app` domain) so that older clients built against the standalone proxy keep working — `/api/v2/aggregated/...` and `/universalis/aggregated/...` are the same endpoint. New integrations should use `/universalis/*`.

---

## GET /universalis/aggregated/:datacenter/:itemIds

Aggregated price data for up to 100 items on one data center or world. Proxies Universalis' `GET /api/v2/aggregated/{dc}/{ids}?listings=5&entries=5`.

### Parameters

| Name | In | Required | Description |
|---|---|---|---|
| `datacenter` | path | Yes | Data-center or world name (case-insensitive), e.g. `Aether`, `Midgardsormr`. Validated against a static list with a live fallback to Universalis' own lists |
| `itemIds` | path | Yes | Comma-separated item IDs — 1–100 integers, each `1`–`1000000`. Use the dye's `marketItemID` from the [Dyes API](./dyes#dye-object). Duplicates are deduped and IDs are sorted so equivalent requests share a cache entry |

```bash
curl https://data.xivdyetools.app/universalis/aggregated/Aether/52254,52255,52256
```

### Errors

| HTTP | Body | When |
|---|---|---|
| `400` | `{ "error": "Invalid datacenter or world name" }` | Unknown `datacenter` |
| `400` | `{ "error": "Invalid itemIds parameter" }` | Non-numeric characters in `itemIds` |
| `400` | `{ "error": "Item count must be between 1 and 100", "provided": n }` | Too many IDs |
| `400` | `{ "error": "Invalid item IDs detected", "invalidIds": [...] }` | IDs outside `1`–`1000000` |
| `429` | `{ "error": "Rate limit exceeded", "retryAfter": s }` + `Retry-After` | Per-IP proxy limit hit (see below) |
| `429` | `{ "error": "Rate limited by upstream API", "retryAfter": 60, ... }` | Universalis rate-limited the proxy |
| `502` | `{ "error": "Upstream response too large", ... }` | Upstream body exceeded 5 MB |
| `502` | `{ "error": "Failed to fetch from upstream API", ... }` | Network / unexpected upstream failure |
| other 4xx/5xx | `{ "error": "Upstream API error: <status>", "message": ... }` | Universalis returned that status |

### Rate limit

Per IP, separate from the `/v1` budget: **30 requests per minute** in production (`RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW_SECONDS`, 60/60 in local dev), enforced by a per-isolate memory limiter — so the effective ceiling is per Cloudflare isolate, not global. `X-RateLimit-*` headers are only attached to the `429` response on this route.

### Caching

`Cache-Control: public, max-age=300, stale-while-revalidate=120` on fresh responses; a stale (SWR) hit is served with `max-age=0, must-revalidate` while the edge refreshes in the background. `X-Cache` (`HIT` / `HIT-STALE` / `MISS`), `X-Cache-Source` and `X-Cache-Stale` report where the body came from. Concurrent identical requests are coalesced into one upstream fetch.

---

## GET /universalis/data-centers

Universalis' data-center list (`GET /api/v2/data-centers`), cached **24 hours** + 6 hours SWR. Not rate-limited.

```bash
curl https://data.xivdyetools.app/universalis/data-centers
```

---

## GET /universalis/worlds

Universalis' world list (`GET /api/v2/worlds`), cached **24 hours** + 6 hours SWR. Not rate-limited.

```bash
curl https://data.xivdyetools.app/universalis/worlds
```

---

## Notes

- Market data is Universalis' — see their [documentation](https://docs.universalis.app/) for the response schema and their own usage policy.
- Since Patch 7.5, 105 of the 125 dyes trade under three shared consolidated item IDs (`52254` / `52255` / `52256`). Always look up prices by `marketItemID`, never by a dye's legacy `itemID` — see [consolidation groups](./dyes#get-v1-dyes-consolidation-groups).
