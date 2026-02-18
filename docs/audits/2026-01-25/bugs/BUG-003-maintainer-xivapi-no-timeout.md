# BUG-003: Missing Timeout on XIVAPI Requests in Maintainer

## Severity
**HIGH**

## Type
Resource Management / DoS

## Location
- **File:** xivdyetools-maintainer/src/services/xivapiService.ts
- **Line:** 34-36

## Description
XIVAPI fetch requests have no timeout configured. If XIVAPI is slow or unresponsive, the request hangs indefinitely, blocking the UI.

## Reproduction Scenario
1. User searches for item in maintainer
2. XIVAPI experiences degraded performance
3. Request hangs with no timeout
4. UI appears frozen
5. User cannot cancel or recover

## Evidence
```typescript
// Current (unsafe)
const response = await fetch(
  `${XIVAPI_BASE}/sheet/Item?rows=${itemId}&language=${lang}`
)
// No timeout specified!
```

## Suggested Fix
Use existing `fetchWithTimeout()` utility from the project:

```typescript
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const response = await fetchWithTimeout(
  `${XIVAPI_BASE}/sheet/Item?rows=${itemId}&language=${lang}`,
  {},
  10000 // 10 second timeout
);
```

## Why It's Hidden
- Works perfectly when XIVAPI is responsive
- Only manifests under network issues
- No automated tests for timeout scenarios

## Status
**RESOLVED** (2026-01-25)

**Resolution Notes:** Updated `xivapiService.ts` to use `fetchWithTimeout()` utility with 10 second timeout. Requests now fail gracefully instead of hanging indefinitely.
