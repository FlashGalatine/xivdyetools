# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cloudflare Worker that proxies requests to the Universalis API for FFXIV market board data. Solves CORS issues when Universalis returns error responses (like 429 rate limit) without proper CORS headers.

## Commands

```bash
npm run dev                  # Start local dev server (localhost:8787)
npm run deploy               # Deploy to Cloudflare (staging/development)
npm run deploy:production    # Deploy to production
npm run type-check           # TypeScript validation
```

## Architecture

```
src/
├── index.ts                 # Hono app with CORS middleware and proxy routes
```

### Request Flow

1. Frontend makes request to proxy (e.g., `/api/v2/aggregated/Crystal/5808`)
2. Proxy validates origin against ALLOWED_ORIGINS
3. Proxy forwards request to Universalis with proper User-Agent
4. Response is returned with CORS headers **always** included
5. Optional: Response is cached in KV for 5 minutes

### Key Implementation Details

- **CORS Always Applied**: Middleware ensures all responses (including errors) have CORS headers
- **Rate Limit Handling**: 429 responses are converted to proper JSON with Retry-After header
- **Input Validation**: Datacenter and itemIds parameters are validated to prevent injection
- **User-Agent**: All requests include identifying User-Agent for Universalis rate limit considerations

## Environment Variables

### Configuration (wrangler.toml)

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | "production" or "development" |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins |
| `UNIVERSALIS_API_BASE` | Base URL for upstream API |
| `RATE_LIMIT_REQUESTS` | Max requests per window (future use with KV) |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window duration |

### Optional Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `PRICE_CACHE` | KV Namespace | Response caching (5 minute TTL) |

## Testing Locally

```bash
# Start the proxy
npm run dev

# Test with curl
curl "http://localhost:8787/api/v2/aggregated/Crystal/5808" \
  -H "Origin: http://localhost:5173"

# Check CORS headers in response
curl -I "http://localhost:8787/api/v2/aggregated/Crystal/5808" \
  -H "Origin: http://localhost:5173"
```

## Deployment Checklist

1. Update `ALLOWED_ORIGINS` in production vars
2. Deploy: `npm run deploy:production`
3. Update `xivdyetools-core` constants to use proxy URL
4. Update web-app environment variables if needed
