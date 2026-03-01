# DEAD-001: AppLayout Component (v3 Layout Shell)

## Category
Orphaned File

## Location
- File(s): `src/components/app-layout.ts` (537 lines), `src/components/__tests__/app-layout.test.ts` (293 lines)
- Symbol(s): `AppLayout` class

## Evidence
`main.ts` (line 75-78) explicitly states:
> "Removed v3 AppLayout wrapper to eliminate double-header issue"

The app now uses `initializeV4Layout()` from `@components/v4-layout` as the sole layout initialization path. `AppLayout` is only referenced by:
- Its own test file (`app-layout.test.ts`)
- A comment in `announcer-service.ts` (line 66)
- A barrel re-export in `components/index.ts` (which is itself nearly dead)

No production code imports or instantiates `AppLayout`.

```typescript
// main.ts line 75-78
// Removed v3 AppLayout wrapper to eliminate double-header issue
const { initializeV4Layout } = await import('@components/v4-layout');
```

## Why It Exists
This was the original v3 layout shell. The v4 redesign replaced it with `V4LayoutShell` + `v4-layout.ts` orchestrator.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — explicitly replaced, comment in main.ts confirms removal |
| **Blast Radius** | LOW — only barrel re-export and test reference |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — no dynamic imports, no external consumers |

## Recommendation
**REMOVE**

### Rationale
- 830 lines removed (537 source + 293 test)
- Eliminates confusion about which layout is active
- The v4 layout is the sole production path

### If Removing
1. Delete `src/components/app-layout.ts`
2. Delete `src/components/__tests__/app-layout.test.ts`
3. Remove re-export from `src/components/index.ts`
4. Remove comment reference in `src/services/announcer-service.ts` line 66
5. Run tests to verify
