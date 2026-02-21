# FINDING-011: OG Worker Missing NaN Validation on dyeId Route Parameters

## Severity
MEDIUM

## Category
CWE-20: Improper Input Validation

## Location
- File: `apps/og-worker/src/index.ts`
- Line(s): ~175-176, ~207-208, ~234-235, ~268-270
- Functions: Harmony, gradient, and mixer route handlers

## Description
The harmony, gradient, and mixer OG image routes use `parseInt()` on dyeId path parameters but never check for `NaN`. Downstream, `NaN` is passed to `getDyeById()` which returns `undefined`, and then SVG generators access `.hex` / `.name` on `undefined`, causing a 500 error.

## Evidence
```typescript
// Harmony route — no NaN check
app.get('/og/harmony/:dyeId/:harmonyType', async (c) => {
  const dyeId = parseInt(c.req.param('dyeId'), 10);
  // dyeId could be NaN — passed directly to generateHarmonyOG
```

Meanwhile, other parameters ARE validated:
```typescript
if (isNaN(ratio) || ratio < OG_MIN_MIXER_RATIO || ratio > OG_MAX_MIXER_RATIO) {
  return c.json({ error: `ratio must be ...` }, 400);
}
```

The comparison & accessibility routes correctly filter NaN:
```typescript
.filter((id) => !isNaN(id))
```

## Impact
Crafted URLs with non-numeric dyeId values cause unhandled exceptions and 500 errors. While not a security vulnerability per se, it generates error noise in monitoring and could be used for DoS.

## Recommendation
Add NaN guards at all four locations:

```typescript
const dyeId = parseInt(c.req.param('dyeId'), 10);
if (isNaN(dyeId)) {
  return c.json({ error: 'Invalid dye ID' }, 400);
}
```

## References
- [CWE-20: Improper Input Validation](https://cwe.mitre.org/data/definitions/20.html)
