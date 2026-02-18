# Recommendations & Action Items

**Version:** 4.0.0
**Date:** January 2026

---

## Priority Matrix

| Priority | Count | Release Impact |
|----------|-------|----------------|
| CRITICAL | 0 | N/A |
| HIGH | 0 | N/A |
| MEDIUM | 1 | Non-blocking |
| LOW | 2 | Non-blocking |

---

## Pre-Release Actions

### NONE REQUIRED

No actions are required before release. The codebase passes all quality, security, and performance checks.

**Verification Commands:**
```bash
npm run lint           # ESLint (0 errors expected)
npm run type-check     # TypeScript (0 errors expected)
npm run test -- --run  # All 79 test files (pass expected)
npm run build          # Production build (success expected)
npm run build:check    # Bundle size check (pass expected)
```

---

## Post-Release Recommendations

### MEDIUM Priority

#### 1. Optimize opengraph.png

**Current State:**
| Property | Value |
|----------|-------|
| File | `assets/icons/opengraph.png` |
| Size | 678 KB (693,530 bytes) |
| Format | PNG |
| Dimensions | 1200x630 (standard OG size) |

**Target State:**
| Property | Value |
|----------|-------|
| Size | ~50-80 KB |
| Format | WebP with PNG fallback |

**Impact:** Faster social media preview loading (Twitter, Discord, Facebook)

**User Impact:** None (only affects link unfurling, not app usage)

**Action Steps:**

1. Convert to WebP format:
```bash
# Using sharp (already in devDependencies)
npx sharp assets/icons/opengraph.png -o assets/icons/opengraph.webp --webp -q 85
```

2. Update `src/index.html` references:
```html
<!-- Line 24 -->
<meta property="og:image" content="https://xivdyetools.com/opengraph.webp">

<!-- Line 38 -->
<meta name="twitter:image" content="https://xivdyetools.com/opengraph.webp">
```

3. Add PNG fallback for older platforms:
```html
<meta property="og:image:type" content="image/webp">
<meta property="og:image:alt" content="XIV Dye Tools - Color matching for FFXIV glamours">
```

4. Test with social media debuggers:
   - [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - [Twitter Card Validator](https://cards-dev.twitter.com/validator)
   - Discord: Paste link in test server

**Estimated Time:** 30 minutes

---

### LOW Priority

#### 2. Complete PaletteExporter Integration

**Location:** `src/components/harmony-tool.ts:1871`

**Current Code:**
```typescript
// TODO: Integrate PaletteExporter component
// this.paletteExporter?.exportPalette(paletteData);
```

**Description:**
The PaletteExporter component exists but is not yet wired into the Harmony tool's export flow.

**Action Steps:**
1. Import PaletteExporter component
2. Add export button to Harmony tool UI
3. Wire up paletteData to exporter
4. Test export formats (PNG, JSON, CSS)

**User Impact:** Users currently cannot export harmony palettes directly; they must screenshot or manually note colors.

**Estimated Time:** 2-4 hours

---

#### 3. Consider httpOnly Cookie Sessions

**Current Implementation:**
| Aspect | Current | Proposed |
|--------|---------|----------|
| Storage | localStorage | httpOnly cookie |
| XSS Risk | Mitigated by CSP | Eliminated |
| Implementation | Client-side | Requires backend |

**Current Security:**
- JWT stored in localStorage
- Strict CSP prevents XSS exfiltration
- Token expiry validated on every auth check
- Server-side revocation on logout

**Proposed Enhancement:**
- Move JWT to httpOnly cookie
- Set Secure, SameSite=Strict flags
- Eliminates theoretical XSS token theft

**Trade-offs:**
| Pro | Con |
|-----|-----|
| Defense-in-depth | Requires backend changes |
| Industry best practice | OAuth worker modification needed |
| Eliminates localStorage attack vector | More complex deployment |

**Current Status:** NOT REQUIRED - existing implementation is secure with CSP.

**Recommendation:** Consider for future major version if OAuth worker is being modified for other reasons.

---

## Future Considerations (Backlog)

These items are documented for future planning but have no release impact:

### 1. CSP Nonce Support

**Current:** `style-src 'unsafe-inline'` for dynamic color swatches

**Enhancement:** Replace with nonces:
```html
<style nonce="abc123">
  .dye-swatch { background-color: #ff0000; }
</style>
```

**Blocker:** Requires hosting platform support for dynamic header generation. Not supported on static hosting (Netlify, Cloudflare Pages).

**Priority:** BACKLOG

---

### 2. Service Worker / PWA

**Current:** Standard web app

**Enhancement:** Add service worker for:
- Offline caching of dye database
- Background sync for presets
- Push notifications for community updates

**Considerations:**
- Cache invalidation strategy needed
- Dye database updates ~2x per year (FFXIV patches)
- Storage quota management

**Priority:** BACKLOG

---

### 3. LCP Optimization

**Current:** ~2.8s LCP (acceptable)

**Target:** < 2.5s

**Potential Optimizations:**
- Additional preload hints
- Critical CSS inlining
- Font subsetting
- Image lazy loading below fold

**Priority:** BACKLOG (current score acceptable)

---

## Metrics to Monitor Post-Release

### Performance Metrics

| Metric | Target | Tool | Frequency |
|--------|--------|------|-----------|
| Lighthouse Performance | > 85 | Chrome DevTools | Weekly |
| LCP | < 2.5s | PageSpeed Insights | Weekly |
| FID | < 100ms | PageSpeed Insights | Weekly |
| CLS | < 0.1 | PageSpeed Insights | Weekly |
| Bundle size | Within limits | CI | Every deploy |

### Error Metrics

| Metric | Target | Tool | Frequency |
|--------|--------|------|-----------|
| JS Error Rate | < 0.1% | Sentry | Daily |
| API Error Rate | < 1% | Sentry | Daily |
| Unhandled Rejections | 0 | Sentry | Daily |

### User Metrics

| Metric | Tool | Notes |
|--------|------|-------|
| Tool usage distribution | Analytics (if added) | Which tools are popular |
| Session duration | Analytics | Engagement indicator |
| Return visitors | Analytics | Retention indicator |

---

## Action Item Summary

| ID | Priority | Item | Owner | Status |
|----|----------|------|-------|--------|
| R-001 | MEDIUM | Optimize opengraph.png | | PENDING |
| R-002 | LOW | PaletteExporter integration | | PENDING |
| R-003 | LOW | httpOnly cookie sessions | | FUTURE |

---

## Release Approval

Based on this analysis:

- **No blocking items** prevent release
- **One optimization** can improve social sharing (post-release)
- **Two enhancements** can improve UX (future sprints)

**Recommendation:** PROCEED WITH RELEASE
