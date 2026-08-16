# API Reference

**Base URL:** `https://data.xivdyetools.app/v1`

All `/v1` responses use the `{ success, data, meta }` envelope. See [Responses](../guide/responses) for the full spec.

## Phase 1 Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | [`/v1/dyes`](./dyes#get-v1-dyes) | List all dyes with filtering and sorting |
| `GET` | [`/v1/dyes/:id`](./dyes#get-v1-dyes-id) | Lookup by itemID or stainID (legacy negative Facewear IDs → explanatory 404) |
| `GET` | [`/v1/dyes/stain/:stainId`](./dyes#get-v1-dyes-stain-stainid) | Lookup by stainID (explicit) |
| `GET` | [`/v1/dyes/search`](./dyes#get-v1-dyes-search) | Search dyes by name |
| `GET` | [`/v1/dyes/categories`](./dyes#get-v1-dyes-categories) | List categories with dye counts |
| `GET` | [`/v1/dyes/batch`](./dyes#get-v1-dyes-batch) | Multi-ID lookup (up to 50) |
| `GET` | [`/v1/dyes/consolidation-groups`](./dyes#get-v1-dyes-consolidation-groups) | Patch 7.5 consolidation metadata |
| `GET` | [`/v1/match/closest`](./matching#get-v1-match-closest) | Find closest dye to a hex color |
| `GET` | [`/v1/match/within-distance`](./matching#get-v1-match-within-distance) | Find dyes within a distance threshold |

## Universalis Market-Board Proxy

Outside `/v1`, un-enveloped, separately rate-limited — see [Universalis Proxy](./universalis).

| Method | Path | Description |
|---|---|---|
| `GET` | [`/universalis/aggregated/:datacenter/:itemIds`](./universalis#get-universalis-aggregated-datacenter-itemids) | Aggregated market prices (cached 5 min) |
| `GET` | [`/universalis/data-centers`](./universalis#get-universalis-data-centers) | Data-center list (cached 24 h) |
| `GET` | [`/universalis/worlds`](./universalis#get-universalis-worlds) | World list (cached 24 h) |

## Health

```bash
curl https://data.xivdyetools.app/health
```

Returns `{ "status": "ok", "timestamp": "..." }` — no envelope, no auth, no rate limiting.
