# Quick Start

<p class="xdt-meta">No account · No key · No setup</p>

The XIV Dye Tools API is a public REST API serving the FFXIV dye database and color matching algorithms. Responses are JSON in one envelope.

## Base URL

Every endpoint is prefixed with `/v1`.

<BaseUrl />

## Your first request

Fetch Snow White (stainID 1). This is the same console card every reference page uses — **Send** makes the request from your browser, and nothing is fetched until you tap it.

<EndpointCard endpoint="/v1/dyes/1" summary="One dye, by itemID or stainID — the range decides which." fields="dye" />

Every `/v1` response has the same `{ success, data, meta }` envelope (`meta.locale` appears only when a non-English `locale` was requested). See [Responses](./responses) for the full spec.

## ID auto-detection

Most ID endpoints accept any of three numeric ID types. The type is inferred by range:

| Range | Type | Example |
|-------|------|---------|
| `1 – 254` | stainID (game stain table; 126+ reserved for future dyes) | `1` = Snow White |
| `≥ 5729` | itemID (game item database) | `5729` = Snow White |
| `< 0` | Legacy Facewear ID — explanatory 404 (no longer served as dyes) | `-1629` |
| `255 – 5728` | *(invalid gap)* | Returns `404` |

```bash
# All three resolve to Snow White
curl https://data.xivdyetools.app/v1/dyes/1       # stainID
curl https://data.xivdyetools.app/v1/dyes/5729    # itemID
curl https://data.xivdyetools.app/v1/dyes/stain/1 # explicit stainID
```

## Localization

Add `?locale=` to any dye endpoint to get localized names. Supported: `en`, `ja`, `de`, `fr`, `ko`, `zh`.

```bash
curl https://data.xivdyetools.app/v1/dyes/1?locale=ja
```

```json
{
  "data": {
    "name": "Snow White",
    "localizedName": "スノウホワイト",
    ...
  }
}
```

## Next: Reference

| Section | Endpoints |
|---|---|
| [Dyes](../reference/dyes) | `/v1/dyes/*` — lookup, filtering, search, batch, consolidation groups |
| [Color Matching](../reference/matching) | `/v1/match/*` — closest dye, dyes within a distance |
| [Character Equipment](../reference/chara) | `/v1/chara/*` — `.chara` gear resolution and item icons |

The [Reference overview](../reference/) lists every endpoint, most with a live sample from the API.

**Planned:** community presets, and optional API keys for higher rate limits.

## Rate limits

Anonymous requests: **60 per minute** per IP. Responses include `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. See [Rate Limits](./rate-limits).
