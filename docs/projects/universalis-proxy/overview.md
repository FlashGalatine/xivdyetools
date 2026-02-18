# Universalis Proxy Overview

**CORS proxy for Universalis API with intelligent dual-layer caching**

The Universalis Proxy provides a caching layer between XIV Dye Tools applications and the Universalis market data API. It solves CORS issues while significantly reducing upstream API load through edge caching, request coalescing, and stale-while-revalidate patterns.

---

## Quick Facts

| Property | Value |
|----------|-------|
| **Version** | v1.2.2 |
| **Type** | Cloudflare Worker |
| **Framework** | Hono |
| **Storage** | Cloudflare KV |
| **Source** | `xivdyetools-universalis-proxy/` |

---

## Why This Exists

The Universalis API doesn't support CORS, making direct browser requests impossible. Additionally:

1. **Rate Limiting** - Universalis has request limits; caching reduces load
2. **Latency** - Edge caching provides faster responses globally
3. **Reliability** - Stale-while-revalidate ensures data availability during outages
4. **Efficiency** - Request coalescing prevents duplicate upstream requests

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Request                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Universalis Proxy                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Input       │  │ Cache       │  │ Request                 │  │
│  │ Validation  │──│ Lookup      │──│ Coalescing              │  │
│  │             │  │             │  │                         │  │
│  │ • 100 items │  │ 1. Edge     │  │ Dedup simultaneous      │  │
│  │ • ID range  │  │ 2. KV       │  │ requests to same        │  │
│  │ • Size <5MB │  │ 3. SWR      │  │ endpoint                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ (cache miss)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Universalis API                              │
│                  universalis.app/api/v2                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Dual-Layer Caching

Two cache layers ensure optimal performance:

| Layer | Technology | Scope | Purpose |
|-------|------------|-------|---------|
| **Edge Cache** | Cloudflare Cache API | Regional | Ultra-low latency for nearby users |
| **KV Storage** | Cloudflare KV | Global | Persistent cache across all edges |

### Request Coalescing

When multiple clients request the same data simultaneously:

```
Client A ──┐                      ┌── Client A response
Client B ──┼──► Single request ──►├── Client B response
Client C ──┘   to Universalis     └── Client C response
```

This prevents the "thundering herd" problem and reduces upstream load.

### Stale-While-Revalidate

Expired cache entries are served immediately while fresh data is fetched:

```
Request → Cache expired by 30s → Return stale data immediately
                               └→ Background: fetch fresh data
```

### Input Validation

| Validation | Limit | Purpose |
|------------|-------|---------|
| Max items | 100 | Prevent abuse |
| Item ID range | 1 - 1,000,000 | Validate IDs |
| Response size | 5MB | Memory protection |

### Memory Leak Protection

Stale in-flight request entries are cleaned up after 60 seconds to prevent memory leaks from abandoned requests.

---

## API Endpoints

### Get Market Data

```
GET /api/{server}/{itemIds}
```

**Parameters**:
- `server` - FFXIV server name or data center
- `itemIds` - Comma-separated item IDs (max 100)

**Response**: Universalis API response (proxied)

**Headers Returned**:
- `X-Cache-Status: HIT|MISS|STALE`
- `X-Cache-Age: <seconds>`

### Health Check

```
GET /health
```

Returns `200 OK` with status information.

---

## Cache TTLs

| Data Type | Fresh TTL | Stale Window | Total Lifespan |
|-----------|-----------|--------------|----------------|
| **Price Data** | 5 minutes | +1 minute | 6 minutes |
| **Static Data** | 24 hours | +1 hour | 25 hours |

Price data refreshes more frequently because market prices change rapidly.

---

## Quick Start

### Development

```bash
cd xivdyetools-universalis-proxy
npm install
npm run dev          # Start local dev server
```

### Testing

```bash
npm run test         # Run vitest
npm run test:watch   # Watch mode
npm run type-check   # TypeScript validation
```

### Deployment

```bash
npm run deploy              # Deploy to staging
npm run deploy:production   # Deploy to production
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRICE_CACHE` | Yes | KV namespace for price data |
| `STATIC_CACHE` | Yes | KV namespace for static data |

See [Environment Variables](../../developer-guides/environment-variables.md) for setup instructions.

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Cloudflare Workers** | Serverless edge runtime |
| **Hono** | Lightweight web framework |
| **Cloudflare KV** | Global key-value storage |
| **Cloudflare Cache API** | Edge-level caching |
| **TypeScript** | Type safety |
| **Vitest** | Testing framework |

---

## Related Documentation

- [Caching Strategy](caching.md) - Deep dive into caching implementation
- [Deployment Guide](deployment.md) - KV setup and deployment procedures
- [Architecture Overview](../../architecture/overview.md) - How proxy fits in ecosystem
- [Data Flow](../../architecture/data-flow.md) - Market price flow diagrams
