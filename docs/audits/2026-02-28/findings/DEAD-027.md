# DEAD-027: Unused Handler Parameters (discord-worker)

## Category
Dead Code Path

## Location

### Genuinely Unused Parameters (4)
- `apps/discord-worker/src/handlers/commands/dye.ts`: parameter `t` (Translator) — never referenced in handler body
- `apps/discord-worker/src/handlers/commands/preferences.ts`: parameter `key` — not used; only `value` is consumed
- `apps/discord-worker/src/handlers/commands/preset.ts`: parameter `userId` (2 occurrences across `createPreset` and `deletePreset`) — passed in signature but the handler derives user ID from the interaction instead

### Interface-Required Parameters (5)
- `apps/discord-worker/src/handlers/buttons/*.ts`: parameter `env` in multiple button handlers — required by `ButtonHandler` interface signature but not consumed
- `apps/discord-worker/src/handlers/buttons/*.ts`: parameter `ctx` in some handlers — required by interface
- `apps/discord-worker/src/handlers/commands/mixer-v4.ts`: parameter `ctx` — required by interface
- `apps/discord-worker/src/handlers/commands/preferences.ts`: parameter `ctx` — required by interface
- `apps/discord-worker/src/handlers/commands/swatch.ts`: parameter `ctx` — required by interface

## Evidence
- TypeScript compiler with `--noUnusedParameters` flagged 9 parameters total.
- 4 are genuinely unused (the handler body never accesses them).
- 5 are interface-required (already prefixed with `_` or should be).

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for the 4 genuine ones; N/A for the 5 interface-required |
| **Runtime Impact** | NONE |
| **Build Impact** | Cleaner code |
| **External Consumers** | None |

## Recommendation
- **Genuinely unused (4)**: Investigate why the parameter is accepted. For `dye.ts t`, this may indicate a missing localization call. For `preferences.ts key`, the handler may be partially implemented. For `preset.ts userId`, the derivation from interaction is correct and the parameter should be removed from the function signature.
- **Interface-required (5)**: Prefix with `_` to suppress warnings. These are required by their handler interface contract.
