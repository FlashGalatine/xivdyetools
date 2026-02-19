# [FINDING-004]: SVG Text Injection Risk in OG Generation

## Severity
MEDIUM

## Category
CWE-79: Improper Neutralization of Input During Web Page Generation (XSS variant for SVG)

## Location
- File: `apps/discord-worker/src/services/svg/` (SVG generation services)
- File: `apps/og-worker/src/` (OG image generation)

## Description
SVG images are generated dynamically with dye names, category labels, and potentially user-provided text interpolated into SVG `<text>` elements. If any of these strings contain XML special characters (`<`, `>`, `&`, `"`, `'`) and are not properly escaped before insertion into the SVG markup, they could cause:

1. SVG parsing errors (malformed XML)
2. SVG injection if user-controlled content (e.g., preset names via community presets) flows into SVG text

The SVG is then rendered to PNG via `resvg-wasm`, so the actual XSS risk is limited (PNG output can't execute scripts). However, if raw SVG is ever served directly (e.g., as `image/svg+xml`), this becomes a real XSS vector.

## Evidence
```typescript
// SVG text elements may interpolate dye names or user content:
// <text x="..." y="...">${dyeName}</text>
// If dyeName = "Foo<script>alert(1)</script>", XML would break
```

Note: The discord-worker sanitizes display text via `sanitizeDisplayText()` and `sanitizePresetName()`, but it's unclear if these functions also handle XML entity escaping for SVG context specifically.

## Impact
- Low immediate risk: SVG is converted to PNG before serving, preventing script execution
- Medium future risk: If SVG is ever served directly (caching, debugging), XSS becomes possible
- SVG parsing errors could cause image generation failures

## Recommendation
1. Add an XML entity escaping utility: `escapeXml(str)` replacing `&`, `<`, `>`, `"`, `'`
2. Apply `escapeXml()` to all text interpolated into SVG `<text>` elements
3. Ensure `Content-Type` headers never serve raw SVG to untrusted clients
4. Add unit tests with XML special characters in dye names

## References
- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP SVG Security](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## Verification Note — FALSE POSITIVE (2026-02-19)

**Status: Already Implemented. No code changes required.**

Manual code inspection confirmed that `escapeXml()` is already implemented and correctly applied in both workers:

- `apps/discord-worker/src/services/svg/base.ts` (lines 8–18): `escapeXml()` defined with all 5 XML entity replacements (`&`, `<`, `>`, `"`, `'`)
- `apps/og-worker/src/services/svg/base.ts`: Identical `escapeXml()` implementation
- The shared `text()` function in both files calls `${escapeXml(content)}` on every text element (no unescaped interpolation paths)

The original finding was based on incomplete initial analysis. The codebase had already proactively addressed this issue.
