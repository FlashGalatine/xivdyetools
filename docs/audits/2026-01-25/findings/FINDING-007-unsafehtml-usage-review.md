# FINDING-007: unsafeHTML and innerHTML Usage Review

## Severity
**LOW** (Informational)

## Category
- OWASP A03:2021 - Injection (Cross-Site Scripting)
- CWE-79: Improper Neutralization of Input During Web Page Generation

## Location
- **Project:** xivdyetools-web-app
- **Files:** Multiple components in `src/components/v4/`

## Description
The web application uses `unsafeHTML` directive from Lit and direct `innerHTML` assignments in multiple locations. A security review was conducted to determine if any user-controlled content is rendered unsafely.

## Evidence

### unsafeHTML Usage (35 instances)
All instances render **static SVG icon constants**:

```typescript
// Example from config-sidebar.ts
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

// Usage - renders trusted internal constants only
<span class="advanced-btn-icon">${unsafeHTML(ICON_REFRESH)}</span>
<span class="advanced-btn-icon">${unsafeHTML(ICON_PALETTE)}</span>
```

**Files affected:**
- config-sidebar.ts (8 usages)
- dye-palette-drawer.ts (3 usages)
- preset-card.ts (2 usages)
- preset-tool.ts (4 usages)
- preset-detail.ts (5 usages)
- result-card.ts (1 usage)
- tool-banner.ts (1 usage)
- v4-app-header.ts (4 usages)

### innerHTML Usage (~50 instances in src/components/)
Most usages fall into safe categories:
1. Clearing containers: `container.innerHTML = ''`
2. Setting static icons: `element.innerHTML = ICON_SAVE`
3. Template literals with trusted content

## Risk Assessment

### Low Risk
All `unsafeHTML` usages render **trusted, static SVG icon constants** imported from internal modules (`ui-icons.ts`). These are:
- Not user-controlled
- Not derived from external data
- Defined at build time

### Potential Concern
One area to monitor: `auth-button.ts:222` renders user character info:
```typescript
characterInfo.innerHTML = `<span>${user.primary_character.name}</span>...`
```

This data comes from XIVAuth API responses. While the API should return sanitized data, this creates a dependency on upstream sanitization.

## Recommendation

### No Immediate Action Required
The current implementation is acceptably safe because:
1. All unsafeHTML renders trusted static content
2. User data comes from authenticated API responses
3. The attack surface is minimal

### Best Practice Recommendations
1. **Document the pattern**: Add code comments noting that unsafeHTML is intentionally used only for trusted SVG icons
2. **Consider sanitization**: For future user-generated content, use a sanitization library like DOMPurify
3. **Periodic review**: Include innerHTML/unsafeHTML patterns in code review checklist

## Status
- [x] Reviewed and documented
- [x] No critical issues found
- [ ] Consider adding defensive sanitization for user data
