# [REFACTOR-019]: SVG primitive builders interpolate attribute values without validation or escaping

## Priority
LOW

## Category
Defense-in-depth / input hygiene at a public API boundary

## Location
`packages/svg/src/base.ts:111-262` — `rect()` (fill/stroke), `circle()` (fill/stroke), `line()` (stroke/dashArray), `text()` (fill/fontFamily — content *is* escaped at L228), `group()` (transform). All exported publicly via `packages/svg/src/index.ts:12-31`.

## Current State
`text()` runs its *content* through `escapeXml`, but every **attribute** value in every primitive is template-interpolated verbatim:

```ts
// packages/svg/src/base.ts:125-139 (rect)
const attrs = [
  `x="${x}"`, `y="${y}"`, `width="${width}"`, `height="${height}"`,
  `fill="${fill}"`,                          // raw string interpolation
];
if (options.stroke) attrs.push(`stroke="${options.stroke}"`);   // raw
...
return `<rect ${attrs.join(' ')}/>`;
```

Color values flow in from dye data, community preset palettes, and (via exported helpers) arbitrary third-party callers of the published npm package.

## Issues
1. A malformed or hostile string in a color-typed parameter — e.g. `'#fff"/><image href="…'` — closes the attribute and injects sibling elements, restructuring the SVG document. Because output is rasterized by resvg (no script execution), the blast radius is broken or spoofed *images*, not XSS — but the primitives are the package's trust boundary and currently rely entirely on caller hygiene.
2. Upstream validation (presets-api hex checks) is the only thing standing between community-submitted preset data and these interpolations; a validation regression upstream silently becomes an injection path here.
3. Inconsistency: content escaping exists (L228), signaling the authors considered injection — attributes were simply missed.

## Proposed Refactoring
Two complementary, cheap measures inside `base.ts`:

1. **Escape string attributes** — reuse the existing `escapeXml` (it already covers `"` and `'`):
   ```ts
   `fill="${escapeXml(fill)}"`
   if (options.stroke) attrs.push(`stroke="${escapeXml(options.stroke)}"`);
   // same for fontFamily, dashArray, transform
   ```
2. **Optionally validate color-typed params** for early, loud failure:
   ```ts
   const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|none|url\(#[\w-]+\)|[a-zA-Z]+)$/;
   function assertColor(v: string): string {
     if (!COLOR_RE.test(v)) throw new Error(`Invalid SVG color value: ${v}`);
     return v;
   }
   ```
Numeric parameters (x/y/width/r/opacity) are typed `number` and interpolate safely; no change needed there.

## Benefits
- SVG layer becomes safe regardless of caller hygiene or upstream validation regressions.
- Malformed data fails visibly (escaped garbage or thrown error) instead of silently restructuring documents.
- Negligible runtime cost (a few short regex/replace calls per element).

## Effort Estimate
Small — ~1 hour: wrap ~10 interpolation sites, add a handful of unit tests asserting escaped output for hostile inputs.

## Risk Assessment
Very low. `escapeXml` on legitimate values (`#AABBCC`, `rgba(0,0,0,0.3)`, `none`, font names) is an identity transform except for `'` in font names — and `Noto Sans SC` etc. contain none. Snapshot tests over existing generators would confirm byte-identical output for current inputs.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)
