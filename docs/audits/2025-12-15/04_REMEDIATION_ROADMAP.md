# Security Audit: Remediation Roadmap

**Project:** xivdyetools-* Monorepo
**Date:** December 15, 2025
**Purpose:** Prioritized action plan for addressing security findings

---

## Priority Matrix

| Priority | Timeframe | Criteria |
|----------|-----------|----------|
| P0 - Critical | Immediate (24-48 hours) | Active exploitation risk |
| P1 - High | This Week | Significant security gap |
| P2 - Medium | This Month | Reduces attack surface |
| P3 - Low | This Quarter | Best practice improvements |
| P4 - Enhancement | Backlog | Nice-to-have improvements |

---

## Quick Wins (< 30 minutes each)

These items can be resolved quickly with minimal risk:

### 1. Remove Selenium from Web App
**Priority:** P1 | **Effort:** 5 minutes | **Risk:** None

```bash
cd xivdyetools-web-app
npm uninstall selenium
npm install  # Regenerate lock file
```

**Verification:**
```bash
grep "selenium" package.json  # Should return nothing
```

---

### 2. Update Core Package References
**Priority:** P2 | **Effort:** 10 minutes | **Risk:** Low

```bash
# In xivdyetools-web-app
npm install @xivdyetools/core@^1.4.0

# In xivdyetools-discord-worker
npm install @xivdyetools/core@^1.4.0
```

**Verification:**
```bash
npm list @xivdyetools/core
```

---

### 3. Update Hono in OAuth Worker
**Priority:** P3 | **Effort:** 5 minutes | **Risk:** None

```bash
cd xivdyetools-oauth
npm install hono@^4.10.7
```

---

## Detailed Remediation Tasks

### Task 1: Add Authentication to Maintainer Service

**Priority:** P1 - High
**Effort:** 2-4 hours
**Finding:** SEC-001

#### Implementation Steps

1. **Add environment check to prevent production deployment:**

```typescript
// server/api.ts - Add at top
if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: Maintainer service must not run in production!');
  process.exit(1);
}
```

2. **Add basic API key authentication:**

```typescript
// server/api.ts
const API_KEY = process.env.MAINTAINER_API_KEY;

// Add middleware before routes
app.use('/api', (req, res, next) => {
  // Skip auth for GET requests (read-only)
  if (req.method === 'GET') {
    return next();
  }

  // Require API key for mutations
  const providedKey = req.headers['x-api-key'];
  if (!API_KEY) {
    console.warn('WARNING: MAINTAINER_API_KEY not set. Write operations disabled.');
    return res.status(503).json({
      error: 'Service not configured. Set MAINTAINER_API_KEY environment variable.'
    });
  }

  if (providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});
```

3. **Update client to include API key:**

```typescript
// client/api.ts
const API_KEY = import.meta.env.VITE_MAINTAINER_API_KEY;

async function saveColors(colors: Color[]) {
  const response = await fetch('/api/colors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY || '',
    },
    body: JSON.stringify(colors),
  });
  // ...
}
```

4. **Add documentation:**

```markdown
# .env.example
MAINTAINER_API_KEY=your-secure-random-key-here

# Generate a secure key:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Testing
- Verify POST /api/colors returns 401 without key
- Verify POST /api/colors succeeds with valid key
- Verify GET /api/colors works without key

---

### Task 2: Standardize Vitest Versions

**Priority:** P2 - Medium
**Effort:** 1-2 hours
**Finding:** SEC-003

#### Projects to Update

| Project | Current | Target |
|---------|---------|--------|
| xivdyetools-oauth | ^2.1.9 | ^4.0.15 |
| xivdyetools-presets-api | ^3.2.4 | ^4.0.15 |
| xivdyetools-logger | ^2.1.8 | ^4.0.15 |
| xivdyetools-test-utils | ^2.0.0 | ^4.0.15 |

#### Implementation Steps

```bash
# For each project
cd xivdyetools-oauth
npm install vitest@^4.0.15 @vitest/coverage-v8@^4.0.15 --save-dev
npm test  # Verify tests pass

cd ../xivdyetools-presets-api
npm install vitest@^4.0.15 @vitest/coverage-v8@^4.0.15 --save-dev
npm test

cd ../xivdyetools-logger
npm install vitest@^4.0.15 @vitest/coverage-v8@^4.0.15 --save-dev
npm test

cd ../xivdyetools-test-utils
npm install vitest@^4.0.15 @vitest/coverage-v8@^4.0.15 --save-dev
npm test
```

#### Breaking Changes to Watch
- Vitest v4 changed some configuration options
- Check `vitest.config.ts` for deprecated options
- Update any snapshot tests if format changed

---

### Task 3: Standardize TypeScript Versions

**Priority:** P2 - Medium
**Effort:** 1-2 hours
**Finding:** SEC-004

#### Projects to Update

| Project | Current | Target |
|---------|---------|--------|
| xivdyetools-core | ^5.3.2 | ^5.9.3 |
| xivdyetools-logger | ^5.3.2 | ^5.9.3 |
| xivdyetools-types | ^5.3.2 | ^5.9.3 |
| xivdyetools-test-utils | ^5.3.2 | ^5.9.3 |
| xivdyetools-oauth | ^5.7.2 | ^5.9.3 |
| xivdyetools-maintainer | ^5.7.2 | ^5.9.3 |

#### Implementation Steps

```bash
# For each project
npm install typescript@^5.9.3 --save-dev
npm run type-check  # Verify no new type errors
```

---

### Task 4: Implement Automated Security Auditing

**Priority:** P2 - Medium
**Effort:** 2-3 hours
**Finding:** Long-term improvement

#### Create GitHub Actions Workflow

**File:** `.github/workflows/security-audit.yml`

```yaml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  audit:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        project:
          - xivdyetools-core
          - xivdyetools-web-app
          - xivdyetools-discord-worker
          - xivdyetools-oauth
          - xivdyetools-presets-api
          - xivdyetools-logger
          - xivdyetools-types
          - xivdyetools-test-utils
          - xivdyetools-maintainer

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.project }}/package-lock.json

      - name: Install dependencies
        working-directory: ${{ matrix.project }}
        run: npm ci

      - name: Run npm audit
        working-directory: ${{ matrix.project }}
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Upload audit results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: audit-${{ matrix.project }}
          path: ${{ matrix.project }}/npm-audit.json
```

---

### Task 5: Document Secret Rotation Procedures

**Priority:** P3 - Low
**Effort:** 1-2 hours
**Finding:** SEC-009

#### Create Documentation

**File:** `xivdyetools-docs/operations/SECRET_ROTATION.md`

```markdown
# Secret Rotation Procedures

## Schedule

| Secret | Rotation Frequency | Last Rotated |
|--------|-------------------|--------------|
| JWT_SECRET | Quarterly | TBD |
| BOT_API_SECRET | Quarterly | TBD |
| DISCORD_TOKEN | On compromise | TBD |
| DISCORD_CLIENT_SECRET | On compromise | TBD |

## Procedures

### JWT_SECRET Rotation

**Impact:** All active sessions will be invalidated.

1. Generate new secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Update in production:
   ```bash
   cd xivdyetools-oauth
   wrangler secret put JWT_SECRET
   # Paste new secret

   cd ../xivdyetools-presets-api
   wrangler secret put JWT_SECRET
   # Paste same secret
   ```

3. Verify workers restart:
   ```bash
   wrangler tail xivdyetools-oauth
   ```

4. Test authentication flow.

### BOT_API_SECRET Rotation

**Impact:** Discord bot will fail to call presets API until updated.

1. Generate new secret.

2. Update Discord Worker:
   ```bash
   cd xivdyetools-discord-worker
   wrangler secret put BOT_API_SECRET
   ```

3. Update Presets API:
   ```bash
   cd ../xivdyetools-presets-api
   wrangler secret put BOT_API_SECRET
   ```

4. Test bot preset commands.

### DISCORD_TOKEN Rotation

**Impact:** Bot goes offline until restarted.

1. Go to Discord Developer Portal
2. Bot → Reset Token
3. Update:
   ```bash
   cd xivdyetools-discord-worker
   wrangler secret put DISCORD_TOKEN
   ```
4. Verify bot online in Discord.
```

---

### Task 6: Move CSP to HTTP Headers

**Priority:** P3 - Low
**Effort:** 1 hour
**Finding:** SEC-008

#### Implementation

**File:** `xivdyetools-web-app/public/_headers`

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.workers.dev https://universalis.app;

/*.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

---

## Dependency Update Schedule

### Week 1 (Immediate)
- [ ] Remove selenium from web-app
- [ ] Update @xivdyetools/core references

### Week 2
- [ ] Standardize Vitest to v4
- [ ] Run full test suites

### Week 3
- [ ] Standardize TypeScript to v5.9.3
- [ ] Fix any new type errors

### Week 4
- [ ] Update hono in oauth worker
- [ ] Standardize @types/node
- [ ] Create security audit GitHub Action

### Month 2
- [ ] Document secret rotation
- [ ] Move CSP to headers
- [ ] Add maintainer authentication

---

## Tracking Checklist

### Critical/High Priority
- [ ] SEC-001: Maintainer authentication
- [ ] SEC-002: Remove selenium

### Medium Priority
- [ ] SEC-003: Vitest standardization
- [ ] SEC-004: TypeScript standardization
- [ ] SEC-005: Core package update
- [ ] SEC-006: @types/node standardization
- [ ] Automated security auditing

### Low Priority
- [ ] SEC-007: SRI for external resources
- [ ] SEC-008: CSP in HTTP headers
- [ ] SEC-009: Secret rotation documentation

---

## Verification Steps

After completing remediation:

1. **Run security audit:**
   ```bash
   for dir in xivdyetools-*; do
     echo "=== $dir ==="
     cd "$dir" && npm audit && cd ..
   done
   ```

2. **Run all tests:**
   ```bash
   for dir in xivdyetools-*; do
     echo "=== $dir ==="
     cd "$dir" && npm test && cd ..
   done
   ```

3. **Verify type checking:**
   ```bash
   for dir in xivdyetools-*; do
     echo "=== $dir ==="
     cd "$dir" && npm run type-check && cd ..
   done
   ```

4. **Deploy to staging and test:**
   - OAuth flow
   - Discord bot commands
   - Presets API CRUD
   - Web app functionality

---

## Risk Assessment After Remediation

### Expected State After Completion

| Category | Before | After |
|----------|--------|-------|
| Critical findings | 0 | 0 |
| High findings | 2 | 0 |
| Medium findings | 4 | 0 |
| Low findings | 3 | 0-1 |
| Overall posture | Good | Excellent |

### Residual Risks

| Risk | Mitigation | Acceptance |
|------|------------|------------|
| Zero-day in dependencies | Automated auditing, quick patching | Accepted |
| Discord API changes | Monitor changelog | Accepted |
| Cloudflare service issues | No alternative | Accepted |

---

## Next Audit Schedule

| Audit Type | Frequency | Next Date |
|------------|-----------|-----------|
| Dependency audit | Monthly | January 15, 2026 |
| Full security audit | Quarterly | March 15, 2026 |
| Penetration testing | Annual | December 2026 |

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
**Last Updated:** December 15, 2025
