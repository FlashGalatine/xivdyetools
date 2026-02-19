# [FINDING-003]: OG-Worker Image Parameter Bounds Unchecked

## Severity
MEDIUM

## Category
CWE-770: Allocation of Resources Without Limits or Throttling

## Location
- File: `apps/og-worker/src/index.ts` (URL parameter parsing)

## Description
The OG-Worker parses image generation parameters (steps, ratio, dye count) from URL path segments using `parseInt()` with NaN checks, but does not enforce upper bounds on numeric values. An attacker could request an image with extremely large parameters (e.g., `steps=1000000`), potentially causing excessive memory allocation or CPU consumption during SVG generation.

## Evidence
```typescript
// URL parameters parsed from path segments without upper bounds
const steps = parseInt(pathSegment, 10);
if (isNaN(steps)) { /* error */ }
// No check: if (steps > MAX_STEPS) { /* reject */ }
```

## Impact
- Resource exhaustion on the Cloudflare Worker (CPU time limit is 30s for paid plan)
- Could be used for denial-of-service by generating expensive SVG/PNG images
- Cloudflare Workers have built-in CPU time limits that would terminate the request, but this wastes compute resources

## Recommendation
1. Add upper bounds for all numeric parameters:
   - `steps`: max 20 (or whatever the application maximum is)
   - `ratio`: max 100
   - `dyeIds count`: max 10
2. Return 400 Bad Request if bounds are exceeded
3. Consider adding rate limiting to the OG-Worker endpoint

## References
- [CWE-770](https://cwe.mitre.org/data/definitions/770.html)
- [Cloudflare Workers CPU Limits](https://developers.cloudflare.com/workers/platform/limits/)
