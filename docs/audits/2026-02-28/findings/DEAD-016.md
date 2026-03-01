# DEAD-016: Dead Barrel Re-exports in services/index.ts

## Category
Unused Export

## Location
- File(s): `src/services/index.ts` (270 lines)
- Symbol(s): Multiple dead re-exports

## Evidence
The services barrel is heavily used (~65+ importers), but certain re-exports are never consumed by external code:

### Dead Value Exports
| Export | Source | Reason |
|--------|--------|--------|
| `SHARE_URL_VERSION` | `share-service.ts` | Only used internally within share-service |
| `BASE_URL` | `share-service.ts` | Only used internally within share-service |
| `consumeReturnTool` | `router-service.ts` | Never imported via barrel |

### Dead Type Exports
| Export | Source | Reason |
|--------|--------|--------|
| `ConfigChangeEvent` | `config-controller.ts` | Zero external consumers |
| `StoreName` | `indexeddb-service.ts` | Only used internally |
| `PricingState` | `pricing-mixin.ts` | Zero consumers anywhere |
| `BlendingConfig` | `mixer-blending-engine.ts` | Verify — may be used by tests |

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM-HIGH — most confirmed zero consumers; a few need verification |
| **Blast Radius** | NONE — removing unused re-exports doesn't affect consumers |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None identified |

## Recommendation
**REMOVE WITH CAUTION**

### Rationale
- Slims the barrel file
- Makes the actual API surface clearer
- Re-exports that are dead weight slow IDE autocomplete

### If Removing
1. Remove each dead re-export from `src/services/index.ts`
2. Verify `BlendingConfig` and `consumeReturnTool` aren't used via barrel by tests
3. Run build + tests to verify
