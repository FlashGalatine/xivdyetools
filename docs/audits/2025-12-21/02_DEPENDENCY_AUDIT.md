# Security Audit: Dependency Audit

**Project:** xivdyetools-* Monorepo
**Date:** December 21, 2025
**Tool:** npm audit
**Purpose:** Document dependency vulnerabilities and version analysis

---

## Executive Summary

**All 10 projects report zero npm vulnerabilities.**

| Metric | Value |
|--------|-------|
| Projects Scanned | 10 |
| Total Vulnerabilities | 0 |
| Critical | 0 |
| High | 0 |
| Moderate | 0 |
| Low | 0 |

---

## npm audit Results

### Project-by-Project Scan

Scans performed on December 21, 2025:

| Project | Command | Result |
|---------|---------|--------|
| xivdyetools-core | `npm audit` | found 0 vulnerabilities |
| xivdyetools-web-app | `npm audit` | found 0 vulnerabilities |
| xivdyetools-discord-worker | `npm audit` | found 0 vulnerabilities |
| xivdyetools-oauth | `npm audit` | found 0 vulnerabilities |
| xivdyetools-presets-api | `npm audit` | found 0 vulnerabilities |
| xivdyetools-logger | `npm audit` | found 0 vulnerabilities |
| xivdyetools-types | `npm audit` | found 0 vulnerabilities |
| xivdyetools-test-utils | `npm audit` | found 0 vulnerabilities |
| xivdyetools-maintainer | `npm audit` | found 0 vulnerabilities |
| xivdyetools-universalis-proxy | `npm audit` | found 0 vulnerabilities |

---

## Version Analysis

### TypeScript Versions

**Status:** STANDARDIZED

All projects now use TypeScript ^5.9.3:

| Project | Version |
|---------|---------|
| xivdyetools-core | ^5.9.3 |
| xivdyetools-web-app | ^5.9.3 |
| xivdyetools-discord-worker | ^5.9.3 |
| xivdyetools-oauth | ^5.9.3 |
| xivdyetools-presets-api | ^5.9.3 |
| xivdyetools-logger | ^5.9.3 |
| xivdyetools-types | ^5.9.3 |
| xivdyetools-test-utils | ^5.9.3 |
| xivdyetools-maintainer | ^5.9.3 |

---

### Vitest Versions

**Status:** CORRECTLY CONFIGURED (v3 for CF Workers, v4 for others)

| Project | Version | Status |
|---------|---------|--------|
| xivdyetools-core | ^4.0.13 | Current |
| xivdyetools-web-app | ^4.0.15 | Current |
| xivdyetools-discord-worker | ^4.0.15 | Current |
| xivdyetools-oauth | ^3.2.4 | Correct (CF Workers) |
| xivdyetools-presets-api | ^3.2.4 | Correct (CF Workers) |
| xivdyetools-logger | ^4.0.15 | Current |
| xivdyetools-types | ^4.0.15 | Current |
| xivdyetools-test-utils | ^4.0.15 | Current |
| xivdyetools-maintainer | N/A | No Vitest |

**Note:** oauth and presets-api use `@cloudflare/vitest-pool-workers@^0.10.14` which [only supports Vitest 2.0.x - 3.2.x](https://github.com/cloudflare/workers-sdk/issues/11064). The v3 usage is intentional and required.

---

### @types/node Versions

**Status:** STANDARDIZED

| Project | Version |
|---------|---------|
| xivdyetools-core | ^22.10.2 |
| xivdyetools-web-app | ^22.10.2 |
| xivdyetools-discord-worker | ^22.10.2 |
| xivdyetools-oauth | ^22.10.1 |
| xivdyetools-presets-api | ^22.10.2 |
| xivdyetools-maintainer | ^22.10.2 |

Minor version difference (22.10.1 vs 22.10.2) is acceptable.

---

### Vite Versions

**Status:** ACCEPTABLE

| Project | Version | Notes |
|---------|---------|-------|
| xivdyetools-web-app | ^7.2.7 | Latest major |
| xivdyetools-maintainer | ^6.0.5 | Previous major |

Version split is acceptable as maintainer is a dev-only tool.

---

### Hono Versions

**Status:** STANDARDIZED

| Project | Version |
|---------|---------|
| xivdyetools-discord-worker | ^4.10.7 |
| xivdyetools-oauth | ^4.10.7 |
| xivdyetools-presets-api | ^4.10.7 |
| xivdyetools-universalis-proxy | (varies) |

All Cloudflare Worker projects now use Hono ^4.10.7.

---

### Wrangler Versions

**Status:** STANDARDIZED

| Project | Version |
|---------|---------|
| xivdyetools-discord-worker | ^4.53.0 |
| xivdyetools-oauth | ^4.53.0 |
| xivdyetools-presets-api | ^4.53.0 |
| xivdyetools-universalis-proxy | ^4.53.0+ |

All Cloudflare workers on Wrangler v4.53.0.

---

## Internal Package Dependencies

### @xivdyetools/core

| Consumer | Version | Status |
|----------|---------|--------|
| xivdyetools-web-app | ^1.4.0 | Good |
| xivdyetools-discord-worker | ^1.4.0 | Good |
| xivdyetools-maintainer | file: | Latest |

**Core Version:** 1.5.1 (consuming projects compatible via semver)

---

### @xivdyetools/logger

| Consumer | Version |
|----------|---------|
| xivdyetools-core | ^1.0.0 |
| xivdyetools-web-app | ^1.0.0 |
| xivdyetools-discord-worker | ^1.0.0 |
| xivdyetools-oauth | ^1.0.0 |
| xivdyetools-presets-api | ^1.0.0 |

**Status:** All projects on ^1.0.0

---

### @xivdyetools/types

| Consumer | Version |
|----------|---------|
| xivdyetools-core | ^1.0.0 |
| xivdyetools-web-app | ^1.0.0 |
| xivdyetools-discord-worker | ^1.0.0 |
| xivdyetools-oauth | ^1.0.0 |
| xivdyetools-presets-api | ^1.0.0 |
| xivdyetools-test-utils | ^1.0.0 |

**Status:** All projects on ^1.0.0

---

### @xivdyetools/test-utils

| Consumer | Version |
|----------|---------|
| xivdyetools-web-app | ^1.0.2 |
| xivdyetools-oauth | ^1.0.2 |
| xivdyetools-presets-api | file: |

**Status:** Good

---

## Production Dependencies Analysis

### xivdyetools-web-app

```json
{
  "@tailwindcss/postcss": "^4.1.17",
  "@xivdyetools/core": "^1.4.0",
  "@xivdyetools/logger": "^1.0.0",
  "@xivdyetools/types": "^1.0.0"
}
```

**Status:** Minimal, appropriate dependencies. Selenium removed.

---

### xivdyetools-discord-worker

```json
{
  "@cf-wasm/photon": "^0.3.4",
  "@cloudflare/workers-types": "^4.20251205.0",
  "@resvg/resvg-wasm": "^2.6.2",
  "@xivdyetools/core": "^1.4.0",
  "@xivdyetools/logger": "^1.0.0",
  "@xivdyetools/types": "^1.0.0",
  "discord-interactions": "^4.4.0",
  "hono": "^4.10.7"
}
```

**Status:** Appropriate for image processing and Discord integration.

---

### xivdyetools-oauth

```json
{
  "@xivdyetools/logger": "^1.0.0",
  "@xivdyetools/types": "^1.0.0",
  "hono": "^4.6.0"
}
```

**Status:** Minimal, appropriate. Consider updating Hono to ^4.10.7.

---

### xivdyetools-presets-api

```json
{
  "@xivdyetools/logger": "^1.0.0",
  "@xivdyetools/types": "^1.0.0",
  "hono": "^4.10.7"
}
```

**Status:** Minimal, appropriate.

---

## Lock File Analysis

**All projects have package-lock.json files:**

| Project | Lock File | Status |
|---------|-----------|--------|
| xivdyetools-core | Present | Good |
| xivdyetools-web-app | Present | Good |
| xivdyetools-discord-worker | Present | Good |
| xivdyetools-oauth | Present | Good |
| xivdyetools-presets-api | Present | Good |
| xivdyetools-logger | Present | Good |
| xivdyetools-types | Present | Good |
| xivdyetools-test-utils | Present | Good |
| xivdyetools-maintainer | Present | Good |
| xivdyetools-universalis-proxy | Present | Good |

**Consistency:** All projects use npm (no yarn.lock files)

---

## Node.js Engine Requirements

**Status:** STANDARDIZED (All projects now specify Node.js >=18.0.0)

| Project | Engines Field | Requirement |
|---------|---------------|-------------|
| xivdyetools-core | Present | >=18.0.0 |
| xivdyetools-oauth | Present | >=18.0.0 |
| xivdyetools-presets-api | Present | >=18.0.0 |
| xivdyetools-logger | Present | >=18.0.0 |
| xivdyetools-types | Present | >=18.0.0 |
| xivdyetools-test-utils | Present | >=18.0.0 |
| xivdyetools-web-app | Present | >=18.0.0 |
| xivdyetools-discord-worker | Present | >=18.0.0 |
| xivdyetools-maintainer | Present | >=18.0.0 |

All projects now specify the minimum Node.js version requirement.

---

## Recommendations

### Monitoring (No Action Required)

1. **Vitest v4 for CF Workers:** Monitor [@cloudflare/vitest-pool-workers](https://github.com/cloudflare/workers-sdk/issues/11064) for v4 support. Once released, upgrade oauth and presets-api.

### Completed Improvements (Dec 21, 2025)

The following optional improvements have been implemented:

2. **Updated Hono in oauth worker:** ^4.6.0 -> ^4.10.7
3. **Updated @types/node in oauth:** ^22.10.1 -> ^22.10.2
4. **Added engines field to:**
   - xivdyetools-web-app
   - xivdyetools-discord-worker
   - xivdyetools-maintainer

---

## Historical Comparison

| Finding | Dec 15, 2025 | Dec 21, 2025 |
|---------|--------------|--------------|
| npm vulnerabilities | 0 | 0 |
| TypeScript versions | Mixed (5.3-5.9) | Standardized (5.9.3) |
| Vitest versions | v2/v3/v4 mix | v3/v4 (improved) |
| Core package | ^1.3.7 | ^1.4.0 |
| Selenium in prod | Yes | Removed |

---

## Conclusion

The dependency audit shows excellent progress:
- Zero npm vulnerabilities across all projects
- TypeScript fully standardized
- Core package references updated
- Selenium removed from production
- Lock files present everywhere

Remaining improvements are minor version standardization tasks.

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
