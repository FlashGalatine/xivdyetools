# DEAD-005: MobileBottomNav Component

## Category
Orphaned File

## Location
- File(s): `src/components/mobile-bottom-nav.ts` (200 lines)
- Symbol(s): `MobileBottomNav` class, `MobileToolDef` type

## Evidence
The `MobileBottomNav` class is only defined and re-exported from the barrel `components/index.ts`. It is never imported or instantiated. References in `MockupShell.ts` are an inline reimplementation using raw DOM (property names like `this.mobileBottomNav`), not imports of this component class.

## Why It Exists
A v3-era mobile navigation component superseded by the v4 layout shell which handles mobile navigation differently.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import references for the class |
| **Blast Radius** | NONE — isolated file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 200 lines removed

### If Removing
1. Delete `src/components/mobile-bottom-nav.ts`
2. Remove re-export from `src/components/index.ts`
3. Run build + tests to verify
