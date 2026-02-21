# FINDING-013: OG Worker `themeColor` Not HTML-Escaped

## Severity
LOW

## Category
CWE-79: Cross-Site Scripting

## Location
- File: `apps/og-worker/src/og-data-generator.ts`
- Line(s): ~337-338

## Description
The `themeColor` field is inserted into an HTML meta tag without `escapeHtml()`, while all other meta tags in the same function ARE escaped. Although the color value originates from `formatHex()` which typically only adds `#`, the swatch OG route accepts user-provided color input in the URL, and the hex validation may not have been applied before `themeColor` is set.

## Evidence
```typescript
const themeColorTag = ogData.themeColor
  ? `<meta name="theme-color" content="${ogData.themeColor}">`  // ← NOT escaped
  : '';
```

## Impact
Low practical risk since the input path validates hex format upstream. However, a code path change or new route could bypass validation, making this a defense-in-depth gap.

## Recommendation
Apply `escapeHtml()`:

```typescript
const themeColorTag = ogData.themeColor
  ? `<meta name="theme-color" content="${escapeHtml(ogData.themeColor)}">`
  : '';
```

## References
- [CWE-79: Cross-Site Scripting](https://cwe.mitre.org/data/definitions/79.html)
