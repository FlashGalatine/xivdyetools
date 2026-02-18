# Security Audit: Dependency Analysis

**Project:** xivdyetools-* Monorepo
**Date:** December 15, 2025
**Scope:** All production and development dependencies across 9 projects

---

## Overview

This document provides a comprehensive analysis of dependencies across the xivdyetools monorepo, identifying version inconsistencies, security concerns, and recommendations for standardization.

---

## Projects Summary

| Project | Version | Prod Deps | Dev Deps | Lock File |
|---------|---------|-----------|----------|-----------|
| xivdyetools-core | 1.4.0 | 2 | 14 | package-lock.json |
| xivdyetools-web-app | 3.1.0 | 5 | 27 | package-lock.json |
| xivdyetools-discord-worker | 2.1.0 | 8 | 7 | package-lock.json |
| xivdyetools-oauth | 2.1.0 | 3 | 10 | package-lock.json |
| xivdyetools-presets-api | 1.2.0 | 3 | 9 | package-lock.json |
| xivdyetools-logger | 1.0.0 | 0 | 4 | package-lock.json |
| xivdyetools-types | 1.0.0 | 0 | 4 | package-lock.json |
| xivdyetools-test-utils | 1.0.2 | 1 | 7 | package-lock.json |
| xivdyetools-maintainer | 1.0.0 | 2 | 14 | package-lock.json |

**Total Dependencies:** ~50 unique packages (excluding transitive)

---

## Critical Issues

### Issue #1: Selenium in Production Dependencies

**Project:** xivdyetools-web-app
**Severity:** HIGH

```json
{
  "dependencies": {
    "selenium": "^2.20.0"  // INCORRECT - should not be here
  }
}
```

**Problems:**
| Issue | Impact |
|-------|--------|
| Listed as production dependency | Bundled into client app |
| Version 2.20.0 from 2020 | 5+ years without updates |
| Browser automation framework | No purpose in web frontend |
| Playwright already used | Redundant E2E capability |

**Recommendation:** Remove entirely
```bash
cd xivdyetools-web-app
npm uninstall selenium
```

---

### Issue #2: Internal Package Version Mismatch

**Package:** @xivdyetools/core

| Consumer | Depends On | Available |
|----------|-----------|-----------|
| xivdyetools-web-app | ^1.3.7 | 1.4.0 |
| xivdyetools-discord-worker | ^1.3.7 | 1.4.0 |
| xivdyetools-maintainer | file:../core | Latest |

**Impact:** Web-app and discord-worker miss latest core features/fixes.

**Recommendation:**
```bash
npm install @xivdyetools/core@^1.4.0
```

---

## Version Inconsistency Analysis

### TypeScript Versions

| Project | Version | Status |
|---------|---------|--------|
| xivdyetools-core | ^5.3.2 | Outdated |
| xivdyetools-web-app | ^5.9.3 | Current |
| xivdyetools-discord-worker | ^5.9.3 | Current |
| xivdyetools-oauth | ^5.7.2 | Slightly outdated |
| xivdyetools-presets-api | ^5.9.3 | Current |
| xivdyetools-logger | ^5.3.2 | Outdated |
| xivdyetools-types | ^5.3.2 | Outdated |
| xivdyetools-test-utils | ^5.3.2 | Outdated |
| xivdyetools-maintainer | ^5.7.2 | Slightly outdated |

**Recommendation:** Standardize to `^5.9.3`

---

### Vitest Versions

| Project | Vitest | Coverage | Status |
|---------|--------|----------|--------|
| xivdyetools-core | ^4.0.13 | ^4.0.14 | Current |
| xivdyetools-web-app | ^4.0.15 | ^4.0.15 | Current |
| xivdyetools-discord-worker | ^4.0.15 | ^4.0.15 | Current |
| xivdyetools-oauth | ^2.1.9 | ^2.1.9 | Major outdated |
| xivdyetools-presets-api | ^3.2.4 | ^3.2.4 | Major outdated |
| xivdyetools-logger | ^2.1.8 | ^2.1.8 | Major outdated |
| xivdyetools-types | ^4.0.15 | ^4.0.15 | Current |
| xivdyetools-test-utils | ^2.0.0 | ^2.0.0 | Major outdated |

**Impact:**
- 3 different major versions in use (v2, v3, v4)
- test-utils requires `vitest >=2.0.0` as peer dependency
- Inconsistent test behavior and snapshots

**Recommendation:** Standardize to `^4.0.15`

---

### @types/node Versions

| Project | Version | Node.js LTS |
|---------|---------|-------------|
| xivdyetools-core | ^20.10.0 | 20.x |
| xivdyetools-web-app | ^25.0.0 | Future |
| xivdyetools-discord-worker | ^24.10.1 | 24.x |
| xivdyetools-oauth | ^22.10.1 | 22.x |
| xivdyetools-presets-api | ^24.10.1 | 24.x |
| xivdyetools-maintainer | ^22.10.2 | 22.x |

**Impact:** Type definition inconsistencies across projects.

**Recommendation:** Standardize to `^22.x` (matches current LTS) or `^24.x`

---

### Hono Framework Versions

| Project | Version | Status |
|---------|---------|--------|
| xivdyetools-discord-worker | ^4.10.7 | Current |
| xivdyetools-oauth | ^4.6.0 | Slightly outdated |
| xivdyetools-presets-api | ^4.10.7 | Current |

**Impact:** Minor - all within 4.x range.

**Recommendation:** Update oauth to `^4.10.7`

---

### Cloudflare Workers Types

| Project | Version |
|---------|---------|
| xivdyetools-discord-worker | ^4.20251205.0 |
| xivdyetools-oauth | ^4.20241127.0 |
| xivdyetools-presets-api | ^4.20251205.0 |
| xivdyetools-test-utils | ^4.20241205.0 |

**Impact:** Minor date-based version differences.

**Recommendation:** Standardize to latest `^4.20251205.0`

---

## Production Dependencies by Project

### xivdyetools-core

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| @xivdyetools/types | ^1.0.0 | Type definitions | Internal |
| @xivdyetools/logger | ^1.0.0 | Logging | Internal |

**Assessment:** Clean, minimal dependencies.

---

### xivdyetools-web-app

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| @tailwindcss/postcss | ^4.1.17 | CSS processing | OK |
| @xivdyetools/core | ^1.3.7 | Color algorithms | Outdated |
| @xivdyetools/logger | ^1.0.0 | Logging | OK |
| @xivdyetools/types | ^1.0.0 | Type definitions | OK |
| selenium | ^2.20.0 | ??? | **REMOVE** |

**Assessment:** Remove selenium, update core.

---

### xivdyetools-discord-worker

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| @cf-wasm/photon | ^0.3.4 | WASM image processing | OK |
| @cloudflare/workers-types | ^4.20251205.0 | Type definitions | OK |
| @resvg/resvg-wasm | ^2.6.2 | SVG rendering | OK |
| @xivdyetools/core | ^1.3.7 | Color algorithms | Outdated |
| @xivdyetools/logger | ^1.0.0 | Logging | OK |
| @xivdyetools/types | ^1.0.0 | Type definitions | OK |
| discord-interactions | ^4.4.0 | Ed25519 verification | OK |
| hono | ^4.10.7 | HTTP framework | OK |

**Assessment:** Update core dependency.

---

### xivdyetools-oauth

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| @xivdyetools/logger | ^1.0.0 | Logging | OK |
| @xivdyetools/types | ^1.0.0 | Type definitions | OK |
| hono | ^4.6.0 | HTTP framework | Update available |

**Assessment:** Update hono to ^4.10.7.

---

### xivdyetools-presets-api

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| @xivdyetools/logger | ^1.0.0 | Logging | OK |
| @xivdyetools/types | ^1.0.0 | Type definitions | OK |
| hono | ^4.10.7 | HTTP framework | OK |

**Assessment:** Clean.

---

### xivdyetools-maintainer

| Package | Version | Purpose | Security |
|---------|---------|---------|----------|
| vue | ^3.5.13 | UI framework | OK |
| @xivdyetools/core | file:../core | Color algorithms | Local |

**DevDependencies (used at runtime):**
| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.21.2 | HTTP server |
| cors | ^2.8.5 | CORS middleware |

**Assessment:** Express/cors are dev deps but run in dev server - acceptable for dev tool.

---

## Security-Related Packages

### Present and Properly Used

| Package | Project | Purpose | Status |
|---------|---------|---------|--------|
| discord-interactions | discord-worker | Ed25519 signature verification | Correct usage |
| cors | maintainer | CORS middleware | Dev tool only |
| hono | workers | HTTP framework with security middleware | Correct usage |

### Notably Absent (Not Needed)

| Package | Reason Not Needed |
|---------|-------------------|
| helmet | Cloudflare Workers have built-in headers |
| express-rate-limit | Rate limiting via KV storage |
| jsonwebtoken | Custom JWT using Web Crypto API |
| bcrypt | No password storage in system |

---

## Lock File Analysis

All 9 projects have `package-lock.json`:
- Lock file version: 3 (npm v9+)
- Integrity hashes: Present
- Resolved URLs: npm registry

**Good Practices:**
- Exact versions locked
- No yarn.lock mixing
- Consistent package manager (npm)

---

## Recommended Version Alignment

### Proposed Standard Versions

```json
{
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.15",
    "@vitest/coverage-v8": "^4.0.15",
    "@types/node": "^22.10.0",
    "eslint": "^9.39.1",
    "@typescript-eslint/eslint-plugin": "^8.49.0",
    "@typescript-eslint/parser": "^8.49.0",
    "prettier": "^3.7.4"
  },
  "dependencies": {
    "@xivdyetools/core": "^1.4.0",
    "@xivdyetools/logger": "^1.0.0",
    "@xivdyetools/types": "^1.0.0",
    "hono": "^4.10.7"
  }
}
```

---

## Automation Recommendations

### 1. Dependabot Configuration

Create `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/xivdyetools-core"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/xivdyetools-web-app"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  # Repeat for each project...
```

### 2. npm audit in CI

Add to GitHub Actions:
```yaml
- name: Security Audit
  run: |
    npm audit --audit-level=high
```

### 3. Version Sync Script

Create a script to check version alignment:
```bash
#!/bin/bash
# check-versions.sh
echo "Checking TypeScript versions..."
grep '"typescript":' */package.json

echo "Checking Vitest versions..."
grep '"vitest":' */package.json
```

---

## Summary

### Actions Required

| Priority | Action | Projects Affected |
|----------|--------|-------------------|
| Immediate | Remove selenium | web-app |
| Immediate | Update @xivdyetools/core to ^1.4.0 | web-app, discord-worker |
| Short-term | Standardize TypeScript to ^5.9.3 | core, logger, types, test-utils, maintainer, oauth |
| Short-term | Standardize Vitest to ^4.0.15 | oauth, presets-api, logger, test-utils |
| Short-term | Update hono to ^4.10.7 | oauth |
| Long-term | Implement Dependabot | All projects |
| Long-term | Add npm audit to CI | All projects |

### Dependency Health Score

| Metric | Score | Notes |
|--------|-------|-------|
| Outdated packages | 7/10 | Minor version differences |
| Security vulnerabilities | 9/10 | Only selenium concern |
| Version consistency | 5/10 | Multiple major versions of vitest |
| Lock file hygiene | 10/10 | All projects have lock files |
| **Overall** | **7.5/10** | Good with room for improvement |

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
