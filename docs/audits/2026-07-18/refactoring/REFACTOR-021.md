# [REFACTOR-021]: Browser logger's `devOnly` option is accepted and documented but dead

## Priority
LOW

## Category
API honesty / dead option

## Location
`packages/logger/src/presets/browser.ts:15-17` (documented option), `:84-86` (destructured to unused `_devOnly`), `:95-101` (config built without consulting it)

## Current State
`BrowserLoggerOptions.devOnly` is publicly documented — *"Only log in development mode (default: true)"* — but the implementation destructures it to a lint-silenced throwaway and never reads it:

```ts
// packages/logger/src/presets/browser.ts:84-90
const {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  devOnly: _devOnly = true, // Reserved for future use
  isDev = defaultIsDev,
  errorTracker,
  prefix = 'xivdyetools',
} = options;
```
The effective behavior is fixed by `isDev()` alone: `level: isDevMode ? 'debug' : 'warn'` (L96).

## Issues
1. **Silent contract violation:** a consumer passing `devOnly: false` — reasonably expecting full logging in production builds — still gets `level: 'warn'`; debug/info calls are silently dropped with no error, warning, or documentation of the discrepancy.
2. TypeScript accepts the option, so nothing flags the no-op at compile time; the JSDoc actively misleads.
3. The `eslint-disable` + "Reserved for future use" comment shows this was known and deferred — it has now shipped in a published npm package (`@xivdyetools/logger`), making the dead option part of the public API surface.

## Proposed Refactoring
Pick one (preference: wire it — smallest honest change):

**Option A — implement the documented semantics:**
```ts
const { devOnly = true, isDev = defaultIsDev, errorTracker, prefix = 'xivdyetools' } = options;
const isDevMode = isDev();
const config: Partial<LoggerConfig> = {
  // devOnly=false → verbose logging even in production
  level: isDevMode || !devOnly ? 'debug' : 'warn',
  ...
};
```

**Option B — remove it:** delete the option from `BrowserLoggerOptions` and its JSDoc; major-version note in the changelog (type-level break for anyone passing it, behavioral break for no one since it never did anything).

## Benefits
- Public options do what their documentation says; removes a lint suppression and a "reserved" landmine.
- Option A gives consumers a supported escape hatch for production debugging (currently impossible without a custom `isDev` shim — the undocumented workaround `isDev: () => true` also disables `sanitizeErrors`, which `devOnly: false` would not).

## Effort Estimate
Trivial — under 30 minutes including a unit test for `devOnly: false` in production mode.

## Risk Assessment
Very low. Option A changes behavior only for callers already passing `devOnly: false` — who demonstrably wanted the new behavior and are currently not getting it. Default path (`devOnly` omitted or `true`) is byte-identical.

> Source: evidence/shared-packages-analysis.md (2026-07-18 deep-dive, shared-packages area)
