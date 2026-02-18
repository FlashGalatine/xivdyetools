# 🔒 Content Security Policy (CSP) Development Guide

**Purpose:** Understand and manage CSP settings for development vs production environments.

**Current Status:** Dual CSP system implemented (Phase 9)
**Updated:** November 15, 2025

---

## 🎯 Overview

This document explains how XIV Dye Tools uses **two different Content Security Policies**:

1. **PRODUCTION CSP** - Strict security policy for deployed version
2. **DEVELOPMENT CSP** - Relaxed policy for localhost testing

The dual setup allows developers to test locally while maintaining production security.

---

## 📋 CSP Comparison

### Production CSP (Current - Active)

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-inline';
           style-src 'self' 'unsafe-inline';
           font-src 'self';
           img-src 'self' data: blob:;
           connect-src 'self' https://universalis.app;
           base-uri 'self';
           form-action 'none';">
```

**Allows:**
- ✅ Scripts from same origin
- ✅ Inline scripts (from 'self')
- ✅ Stylesheets from same origin + inline
- ✅ Fonts from same origin
- ✅ Images from same origin, data URLs, blob URLs
- ✅ API connections to: universalis.app
- ✅ Navigation within same origin

**Blocks:**
- ❌ External scripts (except self)
- ❌ External stylesheets (except self)
- ❌ External fonts (except self)
- ❌ Form submissions to external domains
- ❌ Clickjacking (frame-ancestors implicitly 'none')
- ❌ Unsafe eval expressions

---

### Development CSP (Commented - For Testing)

```html
<!-- <meta http-equiv="Content-Security-Policy"
  content="default-src 'self' localhost:*;
           script-src 'self' 'unsafe-inline' localhost:*;
           style-src 'self' 'unsafe-inline';
           font-src 'self';
           img-src 'self' data: blob: localhost:*;
           connect-src 'self' https://universalis.app localhost:*;
           base-uri 'self';
           form-action 'none';"> -->
```

**Additional Allows (vs Production):**
- ✅ Scripts from localhost (any port)
- ✅ Images from localhost
- ✅ API connections to localhost
- ✅ All self + localhost resources

**Key Difference:** Permits `localhost:*` for development servers

---

## 🛠️ How to Switch CSP Modes

### For Development (Localhost Testing)

**Step 1:** Open any HTML file (e.g., `dyecomparison_stable.html`)

**Step 2:** Find the CSP meta tags (around line 6-9):

```html
<!-- DEVELOPMENT CSP: Uncomment for localhost testing (allows inline scripts) -->
<!-- <meta http-equiv="Content-Security-Policy" content="default-src 'self' localhost:*; ..."> -->

<!-- PRODUCTION CSP: Used for deployed version (strict, blocks inline scripts) -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; ...">
```

**Step 3:** Comment out PRODUCTION CSP (add `<!--` before `<meta`):

```html
<!-- DEVELOPMENT CSP: Uncomment for localhost testing (allows inline scripts) -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self' localhost:*; script-src 'self' 'unsafe-inline' localhost:*; ...">

<!-- PRODUCTION CSP: Used for deployed version (strict, blocks inline scripts) -->
<!-- <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; ..."> -->
```

**Step 4:** Save and reload browser (hard refresh: Ctrl+Shift+R)

**Step 5:** Check DevTools console - CSP errors should disappear ✅

### For Production (Deployment)

Make sure **PRODUCTION CSP is active** (uncommented) and **DEVELOPMENT CSP is commented**:

```html
<!-- DEVELOPMENT CSP: Uncomment for localhost testing (allows inline scripts) -->
<!-- <meta http-equiv="Content-Security-Policy" content="default-src 'self' localhost:*; ..."> -->

<!-- PRODUCTION CSP: Used for deployed version (strict, blocks inline scripts) -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; ...">
```

---

## 🔍 Understanding CSP Directives

### `default-src`
- **Default policy** for all resource types not explicitly listed
- `'self'` = only same origin resources allowed
- `localhost:*` = also allow localhost on any port

### `script-src`
- Controls JavaScript execution
- `'self'` = scripts from same origin
- `'unsafe-inline'` = inline `<script>` tags and event handlers
- `localhost:*` = scripts from localhost development server

### `style-src`
- Controls stylesheet loading
- `'self'` = stylesheets from same origin
- `'unsafe-inline'` = inline `<style>` tags and style attributes

### `font-src`
- Controls font loading
- `'self'` = fonts from same origin

### `img-src`
- Controls image loading
- `'self'` = images from same origin
- `data:` = data URIs (inline base64 images)
- `blob:` = blob URLs (generated images)
- `localhost:*` = images from localhost

### `connect-src`
- Controls fetch/XMLHttpRequest/WebSocket destinations
- `'self'` = same origin API calls
- `https://universalis.app` = External API for market prices
- `localhost:*` = localhost API for development

### `base-uri`
- Controls `<base>` tag values
- `'self'` = only allow same-origin base

### `form-action`
- Controls form submission destinations
- `'none'` = disable form submissions (or use JavaScript event handling)

---

## 🐛 Troubleshooting CSP Issues

### Issue: Console shows "CSP blocked inline script"

**Symptoms:**
```
Content-Security-Policy: The page's settings blocked an inline script
(script-src-elem) from being executed because it violates the following
directive: "script-src 'self'"
```

**Cause:** PRODUCTION CSP is active on localhost

**Solution:**
1. Switch to DEVELOPMENT CSP (uncomment development, comment production)
2. Hard refresh browser (Ctrl+Shift+R)
3. Check console again - error should be gone ✅

### Issue: Components not loading (nav/footer missing)

**Symptoms:**
```
Content-Security-Policy: Ignoring the 'X-Frame-Options' header
```

**Cause:** fetch() calls blocked by CSP

**Solution:**
- Ensure `connect-src 'self' localhost:*` is in your CSP
- Verify HTTP server is running (not file:// protocol)

### Issue: External API (Universalis) prices not showing

**Symptoms:**
- Market prices don't appear
- Console shows CORS error

**Cause:** CSP blocks connect to universalis.app

**Solution:**
- Ensure `connect-src 'self' https://universalis.app` in CSP
- Check network tab for failed requests
- Note: This is optional - prices gracefully fail if API unavailable

### Issue: Images from data URLs not displaying

**Symptoms:**
- Canvas elements blank
- Chart images missing

**Cause:** CSP blocks data: URLs

**Solution:**
- Ensure `img-src 'self' data: blob:` in CSP
- Both DEVELOPMENT and PRODUCTION include these

---

## 📊 CSP Security Levels

### Level 1: Development (Current Development CSP)
```
Strictness: ⭐⭐ (Very Relaxed)
- Allows localhost resources
- Allows inline scripts
- Good for: Local testing, debugging
- NOT for: Production
```

**Use when:**
- Testing locally on http://localhost:8000
- Debugging functionality
- Developing new features

---

### Level 2: Production (Current Production CSP)
```
Strictness: ⭐⭐⭐⭐ (Strong)
- Only self-origin resources
- Allows inline scripts (necessary for current architecture)
- Blocks external resources except Universalis API
- Good for: Live deployment
- Protects against: Most XSS, external script injection
```

**Use when:**
- Deploying to production server
- Public URL access
- User data handling

---

### Level 3: Maximum Security (Future - Phase 12)
```
Strictness: ⭐⭐⭐⭐⭐ (Maximum)
- No inline scripts (all external)
- Hashes or nonces for dynamic content
- Strict subresource integrity
- Good for: High-security applications
- Requires: Build system (Vite) and refactoring
```

**Would require:**
- Moving all inline scripts to external files
- Using nonces for dynamic content
- Setting up HTTP headers (not meta tag)
- Build system for automatic nonce generation

---

## 🔐 Security Improvements Made in Phase 9

1. **CSP Headers Added**
   - ✅ Prevents XSS attacks
   - ✅ Blocks clickjacking
   - ✅ Controls external resource loading

2. **Inline Script Consolidation**
   - ✅ Centralized event handling (shared-components.js)
   - ✅ Data attributes instead of onclick handlers
   - ✅ Reduced inline script surface area

3. **Safe JSON Parsing**
   - ✅ `parseJSONSafe()` with error handling
   - ✅ Prevents crashes from invalid JSON

4. **HTML Escaping**
   - ✅ `escapeHTML()` utility for user input
   - ✅ Prevents HTML injection

5. **Self-Hosted Fonts**
   - ✅ Removed Google CDN dependency
   - ✅ Reduced external resource requirements
   - ✅ Improved privacy

---

## 📝 Testing CSP Configuration

### Before Deployment Checklist

- [ ] Switch to PRODUCTION CSP for final testing
- [ ] Load each tool in browser
- [ ] Check DevTools console for CSP errors
- [ ] Test all features (colors, charts, API calls)
- [ ] Verify localStorage still works
- [ ] Test with Universalis API
- [ ] Check mobile responsiveness
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)

### CSP Validator Tools

- **Google CSP Evaluator:** https://csp-evaluator.withgoogle.com/
  - Paste your CSP and get security assessment

- **MDN CSP Reference:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
  - Complete directive documentation

---

## 🚀 Recommended Workflow

### Daily Development

```bash
1. Open tool HTML file
2. Switch CSP to DEVELOPMENT (uncomment localhost version)
3. Save file
4. Run local HTTP server: python -m http.server 8000
5. Visit http://localhost:8000
6. Test and develop freely
```

### Before Committing

```bash
1. Verify PRODUCTION CSP is correct
2. Test on production CSP (comment dev, uncomment prod)
3. Run full test suite
4. Check console for any CSP warnings
5. Commit changes
```

### Before Deploying

```bash
1. Ensure PRODUCTION CSP is active in all 11 files
2. Run security audit
3. Test on staging environment
4. Verify external API (Universalis) works
5. Deploy with confidence ✅
```

---

## 🔄 Migration Path to Phase 12

**When Vite is implemented:**

1. **Remove meta tag CSP** (use HTTP header instead)
2. **Extract all inline scripts** to external files
3. **Generate nonces** for dynamic content
4. **Implement strict CSP** with no 'unsafe-inline'
5. **Add Subresource Integrity** for external resources

This will provide maximum security without development compromises.

---

## 📚 Additional Resources

### CSP Documentation
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP: Content Security Policy](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [CSP Level 3 Spec](https://w3c.github.io/webappsec-csp/)

### Security Best Practices
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework/)

### Related Phase 9 Changes
- See `BUG_AUDIT_REPORT.md` for security audit details
- See `TODO.md` Phase 12 for architecture refactor

---

## ❓ FAQ

**Q: Can I use the same CSP for both development and production?**
A: Not recommended. Development needs `localhost:*` and production doesn't. Using production CSP in development blocks localhost resources and creates frustrating errors.

**Q: Why keep inline scripts instead of moving to external files?**
A: The application uses monolithic HTML files (by design). Phase 12 will refactor to separate files and implement proper CSP with Vite.

**Q: Is 'unsafe-inline' really unsafe?**
A: Not with proper CSP. It means "allow inline scripts from this HTML file" but still blocks external injected scripts. Full safety comes from removing inline scripts entirely.

**Q: What's the difference between CSP in meta tag vs HTTP header?**
A: Meta tag CSP can't include directives like `frame-ancestors`. HTTP headers are more complete but require server configuration. Meta tags are good for static hosting.

**Q: Can I test CSP on production without deploying?**
A: Yes! Switch to PRODUCTION CSP locally and test. This helps catch issues before deployment.

---

**Last Updated:** November 15, 2025
**Version:** 1.0.0
**Maintained By:** Development Team

---

## 🤝 Contributing

When modifying CSP:
1. Update BOTH development and production CSP
2. Test in both configurations
3. Document any new directives
4. Update this file
5. Include CSP changes in commit message

---

**Remember:** Security is a journey, not a destination. We continuously improve our security posture with each phase.
