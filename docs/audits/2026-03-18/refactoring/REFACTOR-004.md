# REFACTOR-004: Build Script Inconsistency for Core Package

## Priority
MEDIUM

## Category
Build System / Maintainability

## Location
- File(s): packages/core/package.json (build scripts)
- Scope: core package

## Current State
Most packages have a simple build script:
```json
"build": "tsc -p tsconfig.build.json"
```

The `core` package has a multi-step build pipeline:
```json
"build": "npm run build:version && npm run build:locales && tsc -p tsconfig.build.json && npm run copy:locales"
```

Steps:
1. `build:version` — generates version constant from package.json
2. `build:locales` — runs `build-locales.ts` to compile locale JSON from `dyenames.csv`
3. `tsc` — TypeScript compilation
4. `copy:locales` — copies locale JSON to dist/

The root `CLAUDE.md` warns: *"skip `build:locales` if manual locale fixes were made, use `--ignore-scripts`"*

## Issues
- The conditional `build:locales` skip creates a footgun — easy to accidentally overwrite manual fixes
- The 4-step pipeline isn't documented in the core package's own `CLAUDE.md`
- No other package needs this level of build complexity, so developers may not expect it
- If `build:locales` fails, the entire build fails even if locale data hasn't changed

## Proposed Refactoring
1. Document the build pipeline steps and their purpose in `packages/core/CLAUDE.md`
2. Make `build:locales` idempotent — check if `dyenames.csv` has changed before regenerating
3. Consider splitting locale generation into a separate Turbo task with proper caching:
   ```json
   // turbo.json
   "build:locales": {
     "inputs": ["src/data/dyenames.csv", "scripts/build-locales.ts"],
     "outputs": ["src/locales/*.json"]
   }
   ```

## Benefits
- Locale builds are cached by Turbo when input files haven't changed
- Developers understand the build pipeline without reading the root `CLAUDE.md`
- Manual locale fixes are safer

## Effort Estimate
LOW

## Risk Assessment
Low — build improvements don't affect runtime behavior
