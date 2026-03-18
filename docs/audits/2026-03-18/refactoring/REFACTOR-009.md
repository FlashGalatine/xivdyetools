# REFACTOR-009: Hardcoded Production Proxy URL in Web App

## Priority
LOW

## Category
Configuration / Maintainability

## Location
- File(s): apps/web-app/src/services/api-service-wrapper.ts (line 37)
- Scope: function level

## Current State
```typescript
const proxyUrl = 'https://proxy.xivdyetools.app/api/v2';
```

The Universalis proxy URL is hardcoded in the web app source code. If the proxy URL changes (domain change, version bump, migration), a code change, rebuild, and redeployment is required.

## Issues
- URL change requires code modification and full rebuild
- Staging/development environments hit the production proxy
- Not configurable per environment (dev, staging, production)

## Proposed Refactoring
```typescript
// Use Vite environment variable
const proxyUrl = import.meta.env.VITE_UNIVERSALIS_PROXY_URL
  || 'https://proxy.xivdyetools.app/api/v2';
```

With corresponding `.env` files:
```
# .env.development
VITE_UNIVERSALIS_PROXY_URL=http://localhost:8787/api/v2

# .env.production
VITE_UNIVERSALIS_PROXY_URL=https://proxy.xivdyetools.app/api/v2
```

## Benefits
- Environment-specific proxy URLs
- No code change needed for URL updates
- Development can use local proxy

## Effort Estimate
LOW

## Risk Assessment
Very low — the environment variable fallback ensures the current URL works even without configuration
