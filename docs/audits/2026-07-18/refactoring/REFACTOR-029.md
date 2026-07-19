# [REFACTOR-029]: ConfigController valid-key list duplicated three times

## Priority
LOW

## Category
Duplication / single source of truth

## Location
- `apps/web-app/src/services/config-controller.ts:220-239` (`resetAllConfigs`)
- `apps/web-app/src/services/config-controller.ts:274-297` (`importConfigs`)
- `apps/web-app/src/services/config-controller.ts:302-318` (`isValidConfigKey`)
- Also enumerated a fourth time as an object literal in `getAllConfigs` `:244-259`

## Current State
The 12-entry key list (`'global', 'market', 'advanced', 'harmony', 'extractor', 'accessibility', 'comparison', 'gradient', 'mixer', 'presets', 'budget', 'swatch'`) is copied verbatim in three methods, and `getAllConfigs` spells out the same 12 keys again as object properties.

## Issues
- Adding a new tool requires four coordinated edits in one file (plus the `ToolConfigMap` type).
- Missing one edit silently exempts the new tool from reset/import/validation — no compile error, because `isValidConfigKey`'s local array is `string[]` and `importConfigs`/`resetAllConfigs` just iterate whatever is listed.
- Review burden: diffs touching one list look complete while the others drift.

## Proposed Refactoring
```ts
const CONFIG_KEYS = [
  'global', 'market', 'advanced', 'harmony', 'extractor', 'accessibility',
  'comparison', 'gradient', 'mixer', 'presets', 'budget', 'swatch',
] as const satisfies readonly ConfigKey[];
```
Derive all four uses from it:

```ts
resetAllConfigs(): void { for (const key of CONFIG_KEYS) this.resetConfig(key); }

importConfigs(configs: Partial<ToolConfigMap>): void {
  for (const key of CONFIG_KEYS) { if (configs[key]) this.setConfig(key, configs[key]!); }
}

isValidConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key);
}

getAllConfigs(): ToolConfigMap {
  return Object.fromEntries(CONFIG_KEYS.map((k) => [k, this.getConfig(k)])) as ToolConfigMap;
}
```
The `satisfies readonly ConfigKey[]` clause makes the compiler flag the constant when `ConfigKey` gains a member that the list lacks (pair with a `ConfigKey extends (typeof CONFIG_KEYS)[number]` assertion for full bidirectional checking).

## Benefits
- Single edit point when tools are added; compiler-enforced completeness.
- Removes ~40 duplicated lines.

## Effort Estimate
Trivial — under an hour including test run.

## Risk Assessment
None meaningful; behavior-preserving mechanical change. Existing config-controller tests cover reset/import/validation paths.

> Source: evidence/web-frontends-analysis.md (2026-07-18 deep-dive, web-frontends area)

## Status

**DONE 2026-07-19** — single `CONFIG_KEYS` constant (`as const satisfies readonly ConfigKey[]` plus a bidirectional completeness assertion) drives resetAllConfigs/importConfigs/isValidConfigKey/getAllConfigs.
