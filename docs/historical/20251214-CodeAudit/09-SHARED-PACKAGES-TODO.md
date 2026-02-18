# Shared Packages Implementation - TODO

**Created:** 2025-12-14
**Updated:** 2025-12-16
**Status:** Phase 3 Complete for xivdyetools-core, xivdyetools-discord-worker fully complete (tests passing, deployed)
**Related:** [06-CROSS-CUTTING.md](./06-CROSS-CUTTING.md), [07-REMEDIATION-ROADMAP.md](./07-REMEDIATION-ROADMAP.md)

---

## Overview

This document tracks the implementation progress for the shared packages initiative from the Cross-Cutting Concerns audit.

### Packages Published

| Package | Version | Location | npm | Status |
|---------|---------|----------|-----|--------|
| @xivdyetools/types | 1.0.0 | `xivdyetools-types/` | [npmjs.com](https://www.npmjs.com/package/@xivdyetools/types) | ✅ Published |
| @xivdyetools/logger | 1.0.0 | `xivdyetools-logger/` | [npmjs.com](https://www.npmjs.com/package/@xivdyetools/logger) | ✅ Published |
| @xivdyetools/core | 1.3.7 | `xivdyetools-core/` | [npmjs.com](https://www.npmjs.com/package/@xivdyetools/core) | ✅ Published |

> **Note:** The old `xivdyetools-core` (unscoped) package has been deprecated with a message pointing to `@xivdyetools/core`.

---

## Phase 1: Package Creation ✅ COMPLETE

### @xivdyetools/types

- [x] Initialize package (package.json, tsconfig)
- [x] Create color types module (RGB, HSV, branded types)
- [x] Create dye types module (Dye, LocalizedDye, DyeWithDistance, DyeDatabase)
- [x] Create preset types module (16+ types consolidated)
- [x] Create auth types module (Discord, XIVAuth, JWT)
- [x] Create error types module (AppError, ErrorCode enum)
- [x] Create API response types module
- [x] Create localization types module
- [x] Create utility types module (Result<T,E>, isOk/isErr)
- [x] Set up barrel exports and subpath exports
- [x] Build successfully

**Files Created:** 28 source files → 56 compiled files

### @xivdyetools/logger

- [x] Initialize package (package.json, tsconfig)
- [x] Define Logger interfaces (Logger, ExtendedLogger, LogContext)
- [x] Implement BaseLogger abstract class
- [x] Implement ConsoleAdapter (pretty format)
- [x] Implement JsonAdapter (structured JSON)
- [x] Implement NoopAdapter (silent/library use)
- [x] Create browser preset (dev-only logging, error tracking, perf monitoring)
- [x] Create worker preset (JSON structured, request correlation)
- [x] Create library preset (backward compatible NoOpLogger/ConsoleLogger)
- [x] Build successfully

**Files Created:** 12 source files → 24 compiled files

---

## Phase 2: Publishing to npm ✅ COMPLETE

### Prerequisites
- [x] Add LICENSE file to both packages
- [x] Add README.md with usage examples to both packages
- [x] Verify package.json metadata (author, repository, keywords)
- [x] Copy .env, .gitignore, .npmrc from xivdyetools-core
- [x] Test package locally with `npm pack`
- [x] Create npm organization `xivdyetools`
- [x] Generate organization-scoped npm token

### @xivdyetools/types
- [x] Run `npm pack` and verify contents (115 files, 24.9 kB packed)
- [x] Publish to npm: `npm publish --access public`
- [x] Verify on npmjs.com

### @xivdyetools/logger
- [x] Run `npm pack` and verify contents (51 files, 22.6 kB packed)
- [x] Publish to npm: `npm publish --access public`
- [x] Verify on npmjs.com

### @xivdyetools/core (migrated from xivdyetools-core)
- [x] Update package name from `xivdyetools-core` to `@xivdyetools/core`
- [x] Update .npmrc with organization token
- [x] Publish to npm: `npm publish --access public` (version 1.3.7)
- [x] Deprecate old `xivdyetools-core` package (all 20 versions)

---

## Phase 3: Migration (per project)

### Migration Order
1. **xivdyetools-core** - Foundation (other projects depend on it) - ✅ Renamed to @xivdyetools/core
2. **xivdyetools-presets-api** - Standalone worker
3. **xivdyetools-oauth** - Standalone worker
4. **xivdyetools-discord-worker** - Depends on core
5. **xivdyetools-web-app** - Depends on core

> **Important:** All projects using `xivdyetools-core` should update to `@xivdyetools/core`

### Per-Project Migration Checklist

#### xivdyetools-core ✅ COMPLETE
- [x] Rename package to `@xivdyetools/core`
- [x] Publish to npm under new name
- [x] Deprecate old `xivdyetools-core` package
- [x] Add `@xivdyetools/types` as dependency
- [x] Add `@xivdyetools/logger` as dependency
- [x] Update `src/types/index.ts` to re-export from @xivdyetools/types
- [x] Update `src/types/logger.ts` to re-export from @xivdyetools/logger/library
- [x] Update `tsconfig.json` to use `moduleResolution: "bundler"` for subpath exports

#### xivdyetools-presets-api ✅ COMPLETE
- [x] Add `@xivdyetools/types` as dependency
- [x] Add `@xivdyetools/logger` as dependency
- [x] Replace `src/types.ts` imports with @xivdyetools/types (re-exports for backward compatibility)
- [x] Add request logger middleware using @xivdyetools/logger/worker
- [x] Run tests (fixed 172 pre-existing type errors + auth middleware fix for dev/test mode)
- [x] Deploy (https://xivdyetools-presets-api.ashejunius.workers.dev)

#### xivdyetools-oauth ✅ COMPLETE
- [x] Add `@xivdyetools/types` as dependency
- [x] Add `@xivdyetools/logger` as dependency
- [x] Replace `src/types.ts` imports with @xivdyetools/types (re-exports for backward compatibility)
- [x] Add request logger middleware using @xivdyetools/logger/worker
- [x] Run tests (fixed: updated tests to use valid PKCE values per RFC 7636)
- [x] Deploy

#### xivdyetools-discord-worker ✅ COMPLETE
- [x] Update dependency from `xivdyetools-core` to `@xivdyetools/core`
- [x] Add `@xivdyetools/types` as dependency
- [x] Add `@xivdyetools/logger` as dependency
- [x] Replace `src/types/preset.ts` imports with @xivdyetools/types (re-exports for backward compatibility)
- [x] Add request logger middleware using @xivdyetools/logger/worker
- [x] Replace console.log/error with structured logger in `src/index.ts` (main entry point)
- [x] Replace console.log/error in command handlers (logger passed through call stack)
- [x] Replace console.log/error in services (logger passed through call stack)
- [x] Run tests (fixed test mock references and logger expectations)
- [x] Deploy (2025-12-14)

#### xivdyetools-web-app ✅ MIGRATED
- [x] Update dependency from `xivdyetools-core` to `@xivdyetools/core`
- [x] Add `@xivdyetools/types` as dependency
- [x] Add `@xivdyetools/logger` as dependency
- [x] Replace `src/shared/types.ts` imports with @xivdyetools/types (re-exports for backward compatibility)
- [x] Replace `src/shared/logger.ts` with @xivdyetools/logger/browser (re-exports for backward compatibility)
- [x] Run tests (fixed test expectations for @xivdyetools/types and @xivdyetools/logger behavior changes)
- [ ] Deploy

---

## Phase 4: Cleanup

### Deprecation Period
- [x] Add JSDoc `@deprecated` tags to old type exports
- [x] Document migration guide in CHANGELOG
- [ ] Keep deprecated exports for 2 minor versions
- [ ] Remove deprecated exports in next major version

### Old Files to Eventually Remove

| Project | File | Replacement | Status |
|---------|------|-------------|--------|
| core | `src/types/index.ts` (type definitions) | `@xivdyetools/types` | ✅ Now re-exports from shared package |
| core | `src/types/logger.ts` | `@xivdyetools/logger/library` | ✅ Now re-exports from shared package |
| web-app | `src/shared/types.ts` | `@xivdyetools/types` | ✅ Now re-exports from shared package |
| web-app | `src/shared/logger.ts` | `@xivdyetools/logger/browser` | ✅ Now re-exports from shared package |
| discord-worker | `src/types/preset.ts` | `@xivdyetools/types/preset` | ✅ Now re-exports from shared package |
| presets-api | `src/types.ts` | `@xivdyetools/types` | ✅ Now re-exports from shared package |
| oauth | `src/types.ts` | `@xivdyetools/types` | ✅ Now re-exports from shared package |

> **Note:** Web-app files now use a re-export pattern for backward compatibility. They can be kept indefinitely or consumers can be updated to import directly from `@xivdyetools/types` and `@xivdyetools/logger/browser`.

---

## Phase 5: Testing Infrastructure

### @xivdyetools/test-utils (Future)
- [ ] Create shared test utilities package
- [ ] Mock factories: `mockDyeService()`, `mockKVNamespace()`, `mockD1Database()`
- [ ] Test data factories: `createTestPreset()`, `createTestDye()`
- [ ] Cross-service integration test helpers

---

## Quick Reference

### Import Examples After Migration

```typescript
// Core (renamed from xivdyetools-core)
import { DyeService, ColorService, LocalizationService } from '@xivdyetools/core';

// Types
import { Dye, RGB, HexColor, createHexColor } from '@xivdyetools/types';
import { CommunityPreset, PresetFilters } from '@xivdyetools/types/preset';
import { AuthResponse, JWTPayload } from '@xivdyetools/types/auth';
import { AppError, ErrorCode } from '@xivdyetools/types/error';

// Logger - Browser
import { createBrowserLogger, perf } from '@xivdyetools/logger/browser';

// Logger - Worker
import { createWorkerLogger, getRequestId } from '@xivdyetools/logger/worker';

// Logger - Library
import { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';
import type { Logger } from '@xivdyetools/logger';
```

### Build Commands

```bash
# Build types package
cd xivdyetools-types && npm run build

# Build logger package
cd xivdyetools-logger && npm run build

# Pack for local testing
npm pack
```

---

## Notes

- Worker-specific `Env` interfaces remain in each worker (not shared)
- Types package has no runtime dependencies (pure TypeScript)
- Logger package has no runtime dependencies (pure TypeScript)
- Both packages target ES2020 and ESM format

---

## Recent Commits

### 2025-12-15: Logger Middleware Session

**xivdyetools-presets-api** (main branch):
- Added `src/middleware/logger.ts` - Request logger middleware using @xivdyetools/logger/worker
- Updated `src/index.ts` to integrate structured logging middleware and replace hono/logger

**xivdyetools-oauth** (master branch):
- Added `src/middleware/logger.ts` - Request logger middleware using @xivdyetools/logger/worker
- Updated `src/index.ts` to integrate structured logging middleware and replace hono/logger

**xivdyetools-discord-worker** (master branch):
- Added `src/middleware/logger.ts` - Request logger middleware using @xivdyetools/logger/worker
- Updated `src/index.ts` to integrate structured logging middleware

### 2025-12-14: Integration Session

**xivdyetools-web-app** (main branch, 6 commits ahead of origin):
- `8510fd1` - feat(deps): integrate @xivdyetools/types and @xivdyetools/logger
- `d46a71d` - chore(deps): migrate from xivdyetools-core to @xivdyetools/core

**xivdyetools-discord-worker** (master branch, 9 commits ahead of origin):
- `288fefc` - feat(deps): integrate @xivdyetools/types
- `9a9869b` - chore(deps): migrate from xivdyetools-core to @xivdyetools/core

### Known Issues (Pre-existing)
Some projects have pre-existing type errors in test files:
- ~~**presets-api**: 'body' is of type 'unknown', incomplete mock objects~~ **FIXED** (2025-12-14)
- ~~**oauth**: Test failures due to invalid PKCE values~~ **FIXED** (2025-12-14) - Updated tests to use RFC 7636 compliant values
- **discord-worker**: 'body' is of type 'unknown', incomplete Dye mock objects, Env type mismatches
- **web-app**: Branded type issues (ModalId), incomplete mock objects, ErrorCode enum mismatch
