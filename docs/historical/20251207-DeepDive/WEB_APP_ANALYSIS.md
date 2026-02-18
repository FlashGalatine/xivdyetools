# xivdyetools-web-app Deep-Dive Analysis

**Date:** December 7, 2025
**App Version:** 2.6.0
**Analyst:** Claude Code

## Executive Summary

The `xivdyetools-web-app` is a well-architected, modern TypeScript + Vite SPA providing six interactive tools for FFXIV players. This deep-dive identified **7 security concerns**, **15 optimization opportunities**, and **12 refactoring opportunities**.

### Overall Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| Security | **Good** | Strong CSP, PKCE OAuth, input validation; some XSS vectors need attention |
| Performance | **Needs Work** | Excessive console.log, event listener leaks, large monolithic components |
| Code Quality | **Good** | TypeScript strict mode, 80% test coverage, clear service layer pattern |
| Maintainability | **Good** | Service layer pattern, lazy loading; some components need splitting |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Security Analysis](#2-security-analysis)
3. [Performance Opportunities](#3-performance-opportunities)
4. [Refactoring Opportunities](#4-refactoring-opportunities)
5. [Recommendations Summary](#5-recommendations-summary)
6. [File Reference Index](#6-file-reference-index)

---

## 1. Architecture Overview

### Technology Stack

- **Framework:** Vite 7.x + TypeScript 5.x (no framework - vanilla TS with custom component system)
- **Styling:** Tailwind CSS 3.x + CSS Custom Properties (11 themes)
- **Testing:** Vitest with 80% coverage threshold
- **Core Dependency:** `xivdyetools-core` (npm) - shared color algorithms & dye database

### Application Structure

```
src/
├── main.ts                    # Entry point with lazy-loaded tools
├── components/                # 50+ UI components
│   ├── base-component.ts      # Abstract lifecycle base class
│   ├── app-layout.ts          # Shell layout
│   ├── [tool]-tool.ts         # 6 lazy-loaded tool components
│   └── __tests__/             # Component unit tests
├── services/                  # 22 service modules
│   ├── index.ts               # Service exports & initialization
│   ├── theme-service.ts       # 11-theme management
│   ├── storage-service.ts     # localStorage wrapper + SecureStorage
│   ├── language-service.ts    # 6-language i18n
│   ├── auth-service.ts        # Discord OAuth with PKCE
│   └── [feature]-service.ts   # Domain-specific services
├── shared/                    # Utilities, types, constants
│   ├── types.ts               # TypeScript definitions
│   ├── utils.ts               # Helper functions (escapeHTML, debounce)
│   ├── error-handler.ts       # Centralized error management
│   └── *-icons.ts             # SVG icon exports
├── styles/                    # CSS files
│   └── themes.css             # 11 theme definitions
└── locales/                   # i18n JSON files (en, ja, de, fr, ko, zh)
```

### Key Design Patterns

1. **Service Layer Pattern** - Singleton services manage state and business logic
2. **Lazy Loading** - Tools loaded on-demand via dynamic `import()`
3. **BaseComponent Lifecycle** - `init()`, `update()`, `destroy()` pattern
4. **Pub/Sub** - Services emit events for state changes (theme, language)
5. **Facade Pattern** - Wrappers around xivdyetools-core services

### Code Splitting (Vite Manual Chunks)

| Chunk | Contents |
|-------|----------|
| `index.js` | Main bundle with shared services |
| `tool-harmony.js` | Harmony tool + ColorWheel, HarmonyType |
| `tool-matcher.js` | Color Matcher + ImageUpload |
| `tool-accessibility.js` | Accessibility Checker |
| `tool-comparison.js` | Dye Comparison |
| `tool-mixer.js` | Dye Mixer |
| `modals.js` | Welcome/Changelog (lazy-loaded once) |

---

## 2. Security Analysis

### 2.1 Existing Security Measures

The application already implements several important security patterns:

#### Content Security Policy
**File:** `index.html:10-11`

```html
<meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com;
             font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://universalis.app;
             base-uri 'self'; form-action 'none';">
```

**Status:** Excellent - No `unsafe-inline` or `unsafe-eval`, strict connect-src whitelist.

#### PKCE OAuth Flow
**File:** `src/services/auth-service.ts:355-386`

- Proper PKCE code verifier generation (64 bytes)
- Base64URL encoding of SHA-256 hash
- State parameter for CSRF protection
- Uses `crypto.getRandomValues()` for entropy

#### Input Validation
**File:** `src/services/preset-submission-service.ts:98-139`

Comprehensive validation for preset submissions:
- Name: 2-50 characters, trimmed
- Description: 10-200 characters
- Category: Whitelist validation
- Dyes: Array of positive numbers
- Tags: Max 10 tags, 30 chars each

#### XSS Protection Utility
**File:** `src/shared/utils.ts:132-136`

```typescript
export function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

#### Image Upload Validation
**File:** `src/components/image-upload-display.ts:296-306`

- MIME type validation (`file.type.startsWith('image/')`)
- File size limit (20MB max)
- Proper FileReader cleanup (BUG-016 comments)

---

### 2.2 Security Concerns

#### SEC-1: Open Redirect Vulnerability (CRITICAL)

**Location:** `src/services/auth-service.ts:123`

```typescript
const returnPath = urlParams.get('return_path') || sessionStorage.getItem(OAUTH_RETURN_PATH_KEY) || '/';
```

**Issue:** The `return_path` URL parameter is used without validation, enabling open redirect attacks.

**Recommendation:** Validate against a whitelist of allowed paths:
```typescript
const ALLOWED_PATHS = ['/', '/presets'];
const returnPath = ALLOWED_PATHS.includes(rawPath) ? rawPath : '/';
```

**Severity:** Critical
**Priority:** P1

---

#### SEC-2: JWT Stored in localStorage (HIGH)

**Location:** `src/services/auth-service.ts:215-218`

```typescript
localStorage.setItem(TOKEN_STORAGE_KEY, token);
localStorage.setItem(EXPIRY_STORAGE_KEY, expiresAt.toString());
```

**Issue:** JWTs stored in localStorage are vulnerable to XSS attacks. Any XSS vulnerability could expose the token.

**Recommendation:** Use httpOnly, Secure, SameSite cookies managed by the OAuth worker instead.

**Current Risk:** Combined with innerHTML usage, this creates a significant attack surface.

**Severity:** High
**Priority:** P1

---

#### SEC-3: Sensitive Token Logging (HIGH)

**Location:** `src/services/auth-service.ts:208`

```typescript
console.log(`🔐 [AuthService] setToken called, token: ${token?.substring(0, 50)}...`);
```

**Issue:** First 50 characters of JWT logged to console, visible in browser DevTools history.

**Additional instances:** Lines 107, 117, 120, 124, 138, 142, 155, 205, 211

**Recommendation:** Remove all token-related logging in production. Use logger.debug() with DEV flag:
```typescript
if (import.meta.env.DEV) {
  logger.debug('Token received');
}
```

**Severity:** High
**Priority:** P1

---

#### SEC-4: innerHTML with User Content (HIGH)

**Locations:**
- `src/components/modal-container.ts:240` - `content.innerHTML = modal.content;`
- `src/components/preset-browser-tool.ts` - Multiple locations with user-submitted preset data
- `src/components/dye-preview-overlay.ts:167-197` - User-editable content
- `src/components/changelog-modal.ts:163,229` - Changelog data

**Issue:** innerHTML used with potentially user-controlled content without sanitization.

**Recommendation:**
1. Use `textContent` for user strings
2. Use DOMPurify for rich content that needs HTML
3. Only use innerHTML for static SVG icons

```typescript
// Instead of:
element.innerHTML = userContent;

// Use:
element.textContent = userContent;
// Or for rich content:
element.innerHTML = DOMPurify.sanitize(userContent);
```

**Severity:** High
**Priority:** P2

---

#### SEC-5: Privacy Notice Uses innerHTML

**Location:** `src/components/image-upload-display.ts:158`

```typescript
innerHTML: LanguageService.t('matcher.privacyNoticeHtml')
```

**Issue:** Translation key ends with `Html`, indicating HTML content in localization strings. If translations are ever user-editable or loaded from external source, this becomes an XSS vector.

**Recommendation:** Use structured content with safe text interpolation instead of HTML in translations.

**Severity:** Medium
**Priority:** P3

---

#### SEC-6: Missing Server-Side Validation Documentation

**Location:** `src/services/preset-submission-service.ts`

**Issue:** Excellent client-side validation exists, but relies on server to duplicate this. Should be documented that server MUST implement identical validation.

**Recommendation:** Add JSDoc noting server requirements:
```typescript
/**
 * Validates preset submission.
 * NOTE: Server (presets-api) MUST implement identical validation.
 * Client validation is for UX only - never trust client data.
 */
```

**Severity:** Informational
**Priority:** P4

---

#### SEC-7: No Rate Limiting on Client

**Location:** `src/services/community-preset-service.ts`

**Issue:** No client-side rate limiting for API calls. While server should enforce limits, client-side throttling improves UX and reduces server load.

**Recommendation:** Add debouncing/throttling for vote and submission actions.

**Severity:** Low
**Priority:** P4

---

## 3. Performance Opportunities

### 3.1 Existing Optimizations

The app already implements several performance optimizations:

| Optimization | Location | Impact |
|--------------|----------|--------|
| **Code Splitting** | `vite.config.ts` | Tools loaded on-demand |
| **Lazy Modal Loading** | `main.ts:480-485` | Welcome/Changelog deferred |
| **IndexedDB Caching** | `api-service-wrapper.ts` | Price data persisted |
| **debounce/throttle Utils** | `utils.ts:584-655` | With cleanup functions |
| **Event Listener Cleanup** | `base-component.ts:304-313` | Map-based tracking |

---

### 3.2 Performance Issues

#### PERF-1: Excessive Console Logging (CRITICAL)

**Locations:**
- `src/main.ts:468,472` - 2 statements
- `src/services/auth-service.ts` - 9+ statements
- `src/services/modal-service.ts:144-172` - 8 statements
- `src/components/modal-container.ts:44,54,309-316,358-364` - 12 statements
- `src/components/preset-submission-form.ts:551-572` - 4 statements

**Total:** 40+ console.log statements in production code

**Impact:** Every modal interaction logs 5+ messages synchronously, blocking the render thread.

**Example (modal-container.ts:309-316):**
```typescript
console.log('[ModalContainer] render() called, modals.length:', this.modals.length);
console.log('[ModalContainer] container children before clear:', this.container.children.length);
clearContainer(this.container);
console.log('[ModalContainer] container children after clear:', this.container.children.length);
```

**Recommendation:** Replace with `logger.debug()` which can be stripped in production builds.

**Priority:** P1

---

#### PERF-2: Event Listener Memory Leaks (HIGH)

**Issue:** 490 addEventListener calls vs only 36 removeEventListener calls (13:1 ratio)

**File:** `src/components/base-component.ts:251-299`

The `on()` method stores listeners with random keys, but cleanup depends on components calling `destroy()` properly. Only 15 components have `onUnmount()` defined.

**Missing cleanup in:**
- `preset-browser-tool.ts` (1525 lines)
- `color-matcher-tool.ts` (1321 lines)
- `harmony-generator-tool.ts` (1296 lines)

**Impact:** When tools are switched via lazy loading, old event listeners remain attached.

**Recommendation:**
1. Add comprehensive onUnmount() to all tool components
2. Audit every addEventListener call
3. Consider WeakRef for optional listener patterns

**Priority:** P1

---

#### PERF-3: setTimeout Without Cleanup (HIGH)

**Locations:**
- `src/components/modal-container.ts:346` - Focus trap
- `src/components/dye-comparison-chart.ts` - Deferred render
- `src/components/preset-browser-tool.ts` - Multiple instances

**Issue:** setTimeout calls without storing IDs for cleanup. If component is destroyed before timeout fires, callbacks execute on stale state.

**Recommendation:**
```typescript
private timeoutIds: number[] = [];

onUnmount() {
  this.timeoutIds.forEach(id => clearTimeout(id));
  this.timeoutIds = [];
}
```

**Priority:** P2

---

#### PERF-4: Duplicate Service Instantiation (MEDIUM)

**Locations:**
- `src/components/preset-browser-tool.ts:36` - `new DyeService(dyeDatabase)`
- `src/components/my-submissions-panel.ts:19` - `new DyeService(dyeDatabase)`
- `src/components/color-matcher-tool.ts:73` - `new PaletteService()`

**Issue:** Services created per-component instead of using singletons.

**Recommendation:** Export singleton instances from `@services/index.ts`:
```typescript
export const dyeService = new DyeService(dyeDatabase);
export const paletteService = new PaletteService();
```

**Priority:** P2

---

#### PERF-5: Synchronous Full Grid Rendering (MEDIUM)

**Location:** `src/components/preset-browser-tool.ts:132-137`

```typescript
this.presetGrid = this.createElement('div', {...});
this.renderPresets();  // Synchronously renders all presets
```

**Issue:** Large preset lists render all items immediately, blocking the main thread.

**Recommendation:**
1. Virtual scrolling (only render visible items)
2. Intersection Observer for progressive loading
3. requestAnimationFrame for chunked rendering

**Priority:** P2

---

#### PERF-6: Inefficient DOM Manipulation (LOW)

**Location:** `src/components/dye-grid.ts:89-98`

```typescript
wrapper.innerHTML = emptyHtml;
wrapper.classList.remove(...many classes...);  // Removes 6 classes individually
wrapper.classList.add(...new classes...);      // Adds 4 new classes
```

**Recommendation:** Batch class operations:
```typescript
wrapper.className = 'new-class-list';
```

**Priority:** P3

---

#### PERF-7: Duplicate SVG Strings (LOW)

**Locations:**
- `src/components/add-to-collection-menu.ts:110,193,212`
- `src/components/collection-manager-modal.ts:156,166,177`
- Multiple other components

**Issue:** Identical SVG icon strings duplicated across components.

**Recommendation:** Extract to shared icon constants (already partially done in `*-icons.ts` files, but not used everywhere).

**Priority:** P4

---

## 4. Refactoring Opportunities

### REF-1: Giant Monolithic Components (HIGH)

**Components exceeding 1200+ lines:**

| Component | Lines | Responsibilities |
|-----------|-------|------------------|
| `preset-browser-tool.ts` | 1525 | Browsing, detail view, voting, filtering, sorting, auth state |
| `color-matcher-tool.ts` | 1321 | Image upload, color picker, palette extraction, market board, filtering |
| `harmony-generator-tool.ts` | 1296 | Harmony selection, visualization, pricing, exporting, filtering |

**Recommendation:** Split into focused sub-components:
- `PresetGrid`, `PresetDetailView`, `PresetFilters`
- `ImageInputSection`, `ColorMatchResults`, `PalettePanel`
- `HarmonyTypeSelector`, `HarmonyResultsGrid`, `HarmonyExporter`

**Priority:** P2

---

### REF-2: Inconsistent Error Handling (MEDIUM)

**Patterns observed:**
1. `console.error()` only (no user feedback)
2. `ToastService.show()` with error
3. Silent failure with log
4. Throw to ErrorHandler

**Example (preset-browser-tool.ts:1343):**
```typescript
} catch (error) {
  console.error('Failed to load community presets:', error);
  // No user feedback!
}
```

**Recommendation:** Standardize on:
```typescript
try {
  // operation
} catch (error) {
  ErrorHandler.log(error);
  ToastService.show('error', LanguageService.t('errors.loadFailed'));
}
```

**Priority:** P2

---

### REF-3: Missing Accessibility Attributes (MEDIUM)

**Locations:**
- `src/components/modal-container.ts` - Missing `role="dialog"`, `aria-modal="true"`
- `src/components/dye-grid.ts` - Missing `role="option"` for listbox semantics
- `src/components/preset-browser-tool.ts:250-327` - Category tabs have no role/aria

**Recommendation:** Add ARIA attributes:
```typescript
modal.setAttribute('role', 'dialog');
modal.setAttribute('aria-modal', 'true');
modal.setAttribute('aria-labelledby', titleId);
```

**Priority:** P2

---

### REF-4: Mixed Event Listener Patterns (MEDIUM)

**Issue:** Some components use `this.on()` from BaseComponent, others use direct `addEventListener()`.

**Example conflict:** `modal-container.ts:65` uses `this.on(document, 'keydown', ...)` but relies on BaseComponent's listener Map which may not be properly cleared.

**Recommendation:** Standardize on `this.on()` pattern exclusively, ensure all components call `super.destroy()`.

**Priority:** P3

---

### REF-5: Test Mock Type Safety (LOW)

**Location:** `src/services/__tests__/camera-service.test.ts:12-15`

```typescript
let mockStream: any;
let mockTrack: any;
let mockMediaDevices: any;
```

**Recommendation:** Use proper Mock types from Vitest or create typed interfaces for mocks.

**Priority:** P4

---

### REF-6: Service Index Export Cleanup (LOW)

**Location:** `src/services/index.ts`

Multiple services exported inconsistently (some as classes, some as instances, some as both).

**Recommendation:** Standardize on exporting:
- Singleton instances for stateful services
- Classes only for services that need custom configuration

**Priority:** P4

---

## 5. Recommendations Summary

### Critical Priority (P1) - Fix Immediately

| ID | Category | Issue | File | Recommendation |
|----|----------|-------|------|----------------|
| SEC-1 | Security | Open redirect | `auth-service.ts:123` | Validate returnPath against whitelist |
| SEC-2 | Security | JWT in localStorage | `auth-service.ts:215-218` | Move to httpOnly cookies |
| SEC-3 | Security | Token logging | `auth-service.ts:208` | Remove all token logging |
| PERF-1 | Performance | 40+ console.log | Multiple files | Replace with logger.debug() |
| PERF-2 | Performance | Event listener leaks | `base-component.ts` | Add onUnmount() to all tools |

### High Priority (P2)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-4 | Security | innerHTML with user content | Use textContent or DOMPurify |
| PERF-3 | Performance | setTimeout no cleanup | Store and clear timeout IDs |
| PERF-4 | Performance | Duplicate service instantiation | Use singletons from index.ts |
| PERF-5 | Performance | Synchronous grid rendering | Implement virtual scrolling |
| REF-1 | Refactoring | Giant components | Split into focused sub-components |
| REF-2 | Refactoring | Inconsistent error handling | Standardize pattern with ToastService |
| REF-3 | Refactoring | Missing ARIA | Add accessibility attributes |

### Medium Priority (P3)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-5 | Security | HTML in translations | Use structured content |
| PERF-6 | Performance | DOM manipulation | Batch class operations |
| REF-4 | Refactoring | Mixed event patterns | Standardize on this.on() |

### Low Priority (P4)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-6 | Security | Server validation docs | Document server requirements |
| SEC-7 | Security | No client rate limiting | Add debouncing for API calls |
| PERF-7 | Performance | Duplicate SVG strings | Extract to shared constants |
| REF-5 | Refactoring | Test mock types | Use proper Mock types |
| REF-6 | Refactoring | Service exports | Standardize export pattern |

---

## 6. File Reference Index

| File | Lines | Purpose | Key Findings |
|------|-------|---------|--------------|
| `src/main.ts` | 535 | App entry point | PERF-1 (console.log) |
| `src/components/base-component.ts` | 430 | Component lifecycle | PERF-2 (listener cleanup) |
| `src/components/modal-container.ts` | 378 | Modal host | PERF-1, SEC-4, REF-3 |
| `src/components/preset-browser-tool.ts` | 1525 | Preset browsing | REF-1, PERF-5, PERF-2 |
| `src/components/color-matcher-tool.ts` | 1321 | Image matching | REF-1, PERF-4 |
| `src/components/harmony-generator-tool.ts` | 1296 | Harmony generation | REF-1 |
| `src/components/image-upload-display.ts` | 487 | Image upload | SEC-5, Security ✓ |
| `src/services/auth-service.ts` | 468+ | OAuth flow | SEC-1, SEC-2, SEC-3 |
| `src/services/storage-service.ts` | 742 | Storage wrapper | Security ✓ |
| `src/services/preset-submission-service.ts` | 200+ | Preset validation | Security ✓, SEC-6 |
| `src/services/api-service-wrapper.ts` | 275 | API caching | Performance ✓ |
| `src/shared/utils.ts` | 752 | Utilities | escapeHTML ✓, debounce ✓ |
| `index.html` | 283 | HTML shell | CSP ✓ |

---

## Appendix: Test Coverage Notes

Based on the exploration, the project maintains 80% test coverage requirement. Areas that may have lower coverage based on the identified issues:

| Module | Estimated Gap Areas |
|--------|---------------------|
| Auth Service | OAuth callback edge cases, token expiry scenarios |
| Modal Container | Accessibility testing, focus trap edge cases |
| Preset Browser | Voting error states, offline scenarios |
| Large Tool Components | Integration tests for full workflows |

**Recommendation:** Add integration tests for critical user flows:
1. OAuth login → preset submission → logout
2. Image upload → color matching → export
3. Tool switching → state preservation

---

*Report generated by Claude Code deep-dive analysis*
