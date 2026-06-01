# DEAD-105: shared/types.ts state interfaces — MONITOR (constrained by DEAD-018)

## Category
Unused Type (contested)

## Location
- File(s): `src/shared/types.ts`
- Symbol(s): `AppState`, `ComparisonState`, `HarmonyState`, `MatcherState`

## Evidence
The symbol sweep flags these four v3-era state interfaces as having **no production references** (`NO-PROD-REF`). However, the
prior audit **DEAD-018 explicitly adjudicated them as KEEP**:
> "The web-app-specific types (`ThemeName`, `ThemePalette`, `Theme`, `AppState`, `HarmonyState`, `MatcherState`,
> `ComparisonState`, `DataCenter`, `World`) are NOT deprecated and ARE needed."

This is a **direct conflict** between a heuristic zero-reference result and a prior deliberate KEEP decision. Per audit policy,
a prior KEEP is **not** overridden on grep evidence alone.

## Why It Exists
Top-level application state interfaces from the v3 architecture. They may be retained intentionally as the documented state
shape, or they may have become genuinely orphaned after the v4 `config-controller.ts` took over state management — the evidence
is ambiguous.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | LOW — heuristic says unused; prior audit says needed |
| **Blast Radius** | UNKNOWN until manually confirmed |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible type-only / documentation use; DEAD-018 asserted intentional retention |

## Recommendation
**MONITOR / VERIFY** — do **NOT** remove in an automated wave

### Rationale
- Prevents re-litigating a settled decision. If these are truly dead, removal needs an explicit human call that supersedes
  DEAD-018, not a heuristic sweep.

### If Verifying
1. `grep` for `AppState|ComparisonState|HarmonyState|MatcherState` as type annotations (including `import type`).
2. Confirm `config-controller.ts` fully replaced the v3 `AppState` model.
3. If confirmed dead, record a decision note superseding DEAD-018 before removing.
