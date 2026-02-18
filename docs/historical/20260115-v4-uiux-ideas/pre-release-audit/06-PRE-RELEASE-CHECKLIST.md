# Pre-Release Checklist

**Version:** 4.0.0
**Date:** January 2026

---

## Quick Verification

Run this single command to verify release readiness:

```bash
npm run lint && npm run type-check && npm run test -- --run && npm run build && npm run build:check
```

Expected output: All commands pass with 0 errors.

---

## Automated Checks

### Build & Lint

| Check | Command | Expected |
|-------|---------|----------|
| ESLint | `npm run lint` | 0 errors, 0 warnings |
| TypeScript | `npm run type-check` | 0 errors |
| Build | `npm run build` | Success, no errors |
| Bundle Size | `npm run build:check` | All chunks within limits |

```bash
# Individual commands
npm run lint
npm run type-check
npm run build
npm run build:check
```

### Testing

| Check | Command | Expected |
|-------|---------|----------|
| Unit Tests | `npm run test -- --run` | All 79 files pass |
| Coverage | `npm run test:coverage` | ≥80% lines/functions/statements |
| E2E Tests | `npm run test:e2e` | All tests pass |

```bash
# Individual commands
npm run test -- --run
npm run test:coverage
npm run test:e2e
```

### Security

| Check | Command | Expected |
|-------|---------|----------|
| Dependency Audit | `npm audit` | 0 vulnerabilities |
| Secrets Scan | Manual review | No hardcoded secrets |

```bash
npm audit
```

---

## Automated Check Results

| Check | Status | Notes |
|-------|--------|-------|
| ESLint | [ ] | |
| TypeScript | [ ] | |
| Unit Tests | [ ] | |
| Coverage | [ ] | |
| E2E Tests | [ ] | |
| Build | [ ] | |
| Bundle Size | [ ] | |
| npm audit | [ ] | |

---

## Manual Verification

### Functionality Testing

#### All 9 Tools Load Correctly

| Tool | Route | Status | Notes |
|------|-------|--------|-------|
| Harmony Explorer | `/harmony` | [ ] | |
| Palette Extractor | `/extractor` | [ ] | |
| Accessibility Checker | `/accessibility` | [ ] | |
| Dye Comparison | `/comparison` | [ ] | |
| Gradient Builder | `/gradient` | [ ] | |
| Community Presets | `/presets` | [ ] | |
| Budget Suggestions | `/budget` | [ ] | |
| Swatch Matcher | `/swatch` | [ ] | |
| Dye Mixer | `/mixer` | [ ] | |

#### Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| Dye selection | [ ] | Select from 136 dyes |
| Color matching | [ ] | Find similar dyes |
| Theme switching | [ ] | All 12 themes |
| Language switching | [ ] | All 6 languages |
| Config persistence | [ ] | Reload maintains settings |
| Market board prices | [ ] | Universalis API working |

#### Authentication

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth login | [ ] | Discord OAuth flow |
| Token persistence | [ ] | Stays logged in |
| Logout | [ ] | Clears session |
| Protected features | [ ] | Require auth when needed |

---

### Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | Latest | [ ] | Primary target |
| Firefox | Latest | [ ] | |
| Safari | Latest | [ ] | macOS |
| Edge | Latest | [ ] | Chromium-based |
| Mobile Safari | Latest | [ ] | iOS |
| Mobile Chrome | Latest | [ ] | Android |

#### Minimum Requirements
- ES2020 support required
- No IE11 support (intentional)

---

### Accessibility Verification

| Check | Status | Notes |
|-------|--------|-------|
| Keyboard navigation | [ ] | Tab through all tools |
| Focus indicators | [ ] | Visible in all themes |
| Screen reader | [ ] | Tool changes announced |
| Color contrast | [ ] | WCAG AA in all themes |
| Skip links | [ ] | Skip to main content |

#### Keyboard Shortcuts

| Shortcut | Action | Status |
|----------|--------|--------|
| Tab | Navigate forward | [ ] |
| Shift+Tab | Navigate backward | [ ] |
| Enter | Activate | [ ] |
| Escape | Close modal/drawer | [ ] |
| Arrow keys | Navigate grid | [ ] |

---

### Responsive Design

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (< 640px) | [ ] | |
| Tablet (640-1024px) | [ ] | |
| Desktop (> 1024px) | [ ] | |

---

## Documentation Review

| Document | Status | Notes |
|----------|--------|-------|
| CHANGELOG.md | [ ] | v4.0.0 changes documented |
| README.md | [ ] | Current and accurate |
| CLAUDE.md | [ ] | Development guidance updated |

---

## Deployment Readiness

### Environment Configuration

| Item | Status | Notes |
|------|--------|-------|
| Production env vars | [ ] | All required vars set |
| OAuth credentials | [ ] | Production client ID |
| API endpoints | [ ] | Production URLs |

### Hosting Platform

| Item | Status | Notes |
|------|--------|-------|
| Deployment configured | [ ] | Cloudflare/Netlify/Vercel |
| Custom domain | [ ] | DNS configured |
| SSL certificate | [ ] | HTTPS working |
| CDN caching | [ ] | Headers configured |

### Security Headers

| Header | Status | Notes |
|--------|--------|-------|
| CSP | [ ] | Strict policy active |
| HSTS | [ ] | Enabled with preload |
| X-Frame-Options | [ ] | DENY |
| X-Content-Type-Options | [ ] | nosniff |

---

## Monitoring Setup

| Service | Status | Notes |
|---------|--------|-------|
| Sentry | [ ] | Error tracking configured |
| Analytics | [ ] | Optional, if desired |
| Uptime monitoring | [ ] | Optional |

---

## Sign-off

### Required Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Engineer | | | |
| Release Manager | | | |

### Release Details

| Field | Value |
|-------|-------|
| Version | 4.0.0 |
| Release Date | |
| Release Branch | |
| Commit Hash | |

---

## Post-Release Actions

### Immediate (Within 24 Hours)

| Action | Status | Notes |
|--------|--------|-------|
| Verify production deployment | [ ] | Site loads correctly |
| Check error monitoring | [ ] | No spike in errors |
| Validate social previews | [ ] | OpenGraph working |
| Test OAuth in production | [ ] | Login works |
| Smoke test all tools | [ ] | Basic functionality |

### Week 1

| Action | Status | Notes |
|--------|--------|-------|
| Review user feedback | [ ] | Discord, GitHub issues |
| Monitor performance metrics | [ ] | Lighthouse, Core Web Vitals |
| Address critical bugs | [ ] | If any discovered |
| Update documentation | [ ] | If needed |

---

## Emergency Rollback Procedure

If critical issues are discovered post-release:

### Cloudflare Pages
```bash
# Rollback to previous deployment
# Via Cloudflare Dashboard > Pages > [Project] > Deployments
# Click "Rollback" on previous successful deployment
```

### Netlify
```bash
# Via Netlify Dashboard > Deploys
# Click "Publish deploy" on previous version
```

### Manual Rollback
```bash
# If automated rollback fails
git checkout [previous-tag]
npm run build
# Deploy manually
```

### Communication
1. Post in Discord: "We're aware of [issue] and are working on a fix"
2. Update status page if available
3. Create GitHub issue for tracking

---

## Checklist Complete

- [ ] All automated checks pass
- [ ] Manual functionality verified
- [ ] Browser compatibility confirmed
- [ ] Accessibility verified
- [ ] Documentation updated
- [ ] Deployment ready
- [ ] Monitoring configured
- [ ] Sign-offs obtained

**Release Status:** [ ] APPROVED FOR RELEASE
