# XIV Dye Tools Web App - Bug Findings Report

**Date:** December 24, 2025
**Version Audited:** 3.1.0

---

## Table of Contents

1. [Memory Leaks and Cleanup Issues](#1-memory-leaks-and-cleanup-issues)
2. [Race Conditions and Async Issues](#2-race-conditions-and-async-issues)
3. [State Management Issues](#3-state-management-issues)
4. [Logical Errors and Edge Cases](#4-logical-errors-and-edge-cases)
5. [Error Handling Gaps](#5-error-handling-gaps)
6. [Summary and Recommendations](#6-summary-and-recommendations)

---

## 1. Memory Leaks and Cleanup Issues

### BUG-001: Camera Service Device Listener Never Cleaned Up

**Severity:** Medium
**File:** `src/services/camera-service.ts`
**Lines:** 314-321

**Problem:**
The `startDeviceChangeListener()` method adds an event listener to `navigator.mediaDevices` but there's no corresponding cleanup method:

```typescript
startDeviceChangeListener(): void {
  if (!this.isSupported) return;
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await this.enumerateCameras();
    // ... handler logic
  });
  // No removeEventListener in destroy() or stopDeviceChangeListener()
}
```

**Impact:** Multiple calls accumulate listeners. The `destroy()` method doesn't clean these up.

**Fix:** Store listener reference and remove in `destroy()`:

```typescript
private deviceChangeHandler: (() => void) | null = null;

startDeviceChangeListener(): void {
  if (!this.isSupported || this.deviceChangeHandler) return;
  this.deviceChangeHandler = async () => { /* ... */ };
  navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
}

stopDeviceChangeListener(): void {
  if (this.deviceChangeHandler) {
    navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
    this.deviceChangeHandler = null;
  }
}
```

---

### BUG-002: Tooltip Service Orphaned State

**Severity:** Low
**File:** `src/services/tooltip-service.ts`
**Lines:** 306-310

**Problem:**
While there's code to detect detached DOM elements during positioning, if a tooltip's target element is removed from DOM without calling `detach()`, the tooltip state persists in memory indefinitely.

**Impact:** Long-running pages with dynamically removed elements can accumulate orphaned tooltip states.

**Fix:** Add periodic cleanup or WeakRef-based tracking for target elements.

---

### BUG-003: Camera Preview Modal setTimeout Race

**Severity:** Medium
**File:** `src/components/camera-preview-modal.ts`
**Line:** 293

**Problem:**
Camera preview starts with a `setTimeout` after modal displays:

```typescript
setTimeout(() => {
  void startCamera();  // May execute after isModalOpen = false
}, 100);
```

If modal is closed before timeout completes, `startCamera()` executes on a closed modal.

**Impact:** Potential unhandled promise rejections and stream resource leaks.

**Fix:** Track timeout ID and clear on modal close:

```typescript
private startCameraTimeout: number | null = null;

onShow(): void {
  this.startCameraTimeout = window.setTimeout(() => {
    if (this.isOpen) void startCamera();
  }, 100);
}

onClose(): void {
  if (this.startCameraTimeout) {
    clearTimeout(this.startCameraTimeout);
    this.startCameraTimeout = null;
  }
}
```

---

## 2. Race Conditions and Async Issues

### BUG-004: APIService Concurrent Initialization Race

**Severity:** Medium
**File:** `src/services/api-service-wrapper.ts`
**Lines:** 62-77

**Problem:**
The `initialize()` method stores a promise, but error handling creates a race condition:

```typescript
this.initPromise = (async () => {
  try {
    // ... initialization
  } catch (error) {
    this.initPromise = null;  // Clears promise on error
    throw error;
  }
})();
return this.initPromise;
```

Multiple simultaneous `initialize()` calls could create multiple initialization attempts before the first one fails.

**Fix:** Don't clear promise on error, let callers handle rejection:

```typescript
async initialize(): Promise<void> {
  if (this.initPromise) return this.initPromise;

  this.initPromise = this.doInitialize();
  return this.initPromise;
}

private async doInitialize(): Promise<void> {
  // ... actual initialization, don't clear initPromise on error
}
```

---

### BUG-005: KeyboardService Double Initialization

**Severity:** Low
**File:** `src/services/keyboard-service.ts`
**Lines:** 56-64

**Problem:**
The initialize check and handler assignment aren't atomic:

```typescript
if (this.boundHandler) {
  document.removeEventListener('keydown', this.boundHandler);
}
this.boundHandler = this.handleKeyDown.bind(this);
document.addEventListener('keydown', this.boundHandler);
this.isInitialized = true;
```

If `initialize()` is called twice rapidly, both calls reach `addEventListener` before `isInitialized` is set.

**Fix:** Check and set flag atomically:

```typescript
initialize(): void {
  if (this.isInitialized) return;
  this.isInitialized = true;  // Set immediately

  this.boundHandler = this.handleKeyDown.bind(this);
  document.addEventListener('keydown', this.boundHandler);
}
```

---

### BUG-006: Camera Promise Not Awaited

**Severity:** Low
**File:** `src/components/camera-preview-modal.ts`
**Line:** 273

**Problem:**
Camera selector change fires async function without awaiting:

```typescript
void startCamera(selector.value);  // Fire and forget
```

If previous stream is being stopped while new one starts, race conditions can occur.

**Impact:** Potential for multiple concurrent camera streams.

**Fix:** Serialize camera operations with a queue or lock:

```typescript
private cameraOperationPromise: Promise<void> = Promise.resolve();

onDeviceChange(deviceId: string): void {
  this.cameraOperationPromise = this.cameraOperationPromise
    .then(() => this.startCamera(deviceId))
    .catch(error => console.error('Camera error:', error));
}
```

---

### BUG-007: SecureStorage Size Index Race

**Severity:** Low
**File:** `src/services/storage-service.ts`
**Lines:** 485-490

**Problem:**
Multiple concurrent `setItem()` calls could race on size index updates:

```typescript
private static updateSizeIndex(key: string, size: number, timestamp: number): void {
  const index = this.loadSizeIndex();  // Reads cache
  index[key] = { size, timestamp };
  this.sizeIndexCache = index;  // May be stale if concurrent call happened
  this.saveSizeIndex();
}
```

**Impact:** Size index could become inconsistent under heavy concurrent writes.

**Fix:** Use a mutex or queue for size index operations.

---

## 3. State Management Issues

### BUG-008: DyeSelector Subscription Leak on Init Failure

**Severity:** Medium
**File:** `src/components/dye-selector.ts`
**Lines:** 73-78

**Problem:**
Component subscribes in constructor but only stores unsubscribe function:

```typescript
if (this.options.showFavorites) {
  this.unsubscribeFavorites = CollectionService.subscribeFavorites((favoriteIds) => {
    this.updateFavoriteDyes(favoriteIds);
  });
}
```

If `init()` throws before `destroy()` is called, subscription persists.

**Fix:** Wrap subscription in try-catch or defer to `init()`:

```typescript
init(): void {
  super.init();
  if (this.options.showFavorites) {
    this.unsubscribeFavorites = CollectionService.subscribeFavorites(/*...*/);
  }
}
```

---

### BUG-009: BaseComponent Async Error Boundary Gap

**Severity:** Medium
**File:** `src/components/base-component.ts`
**Lines:** 244-254

**Problem:**
`safeRender()` only catches synchronous errors:

```typescript
protected safeRender(): void {
  try {
    this.renderContent();  // Only catches sync errors
  } catch (error) {
    this.handleRenderError(error);
  }
}
```

If `renderContent()` starts async operations that fail later, errors aren't caught.

**Impact:** Async render errors could go unhandled.

**Fix:** Add async variant or document that async errors must be handled separately:

```typescript
protected async safeRenderAsync(): Promise<void> {
  try {
    await this.renderContent();
  } catch (error) {
    this.handleRenderError(error);
  }
}
```

---

## 4. Logical Errors and Edge Cases

### BUG-010: Camera Service Incomplete Init Check

**Severity:** Low
**File:** `src/services/camera-service.ts`
**Lines:** 66-71

**Problem:**
`initialize()` returns early if `hasEnumerated` is true, even if enumeration previously failed:

```typescript
async initialize(): Promise<void> {
  if (this.hasEnumerated || !this.isSupported) return;
  try {
    await this.enumerateCameras();
    this.hasEnumerated = true;  // Set even if no cameras found
  } catch (error) {
    // hasEnumerated stays false, but won't retry
  }
}
```

**Impact:** Failed enumeration won't be retried.

**Fix:** Only set `hasEnumerated` on success, add retry mechanism:

```typescript
async initialize(forceRetry = false): Promise<void> {
  if ((this.hasEnumerated && !forceRetry) || !this.isSupported) return;
  try {
    await this.enumerateCameras();
    this.hasEnumerated = true;
  } catch (error) {
    this.hasEnumerated = false;
    throw error;
  }
}
```

---

### BUG-011: ImageUploadDisplay Zero-Size Canvas Edge Case

**Severity:** Low
**File:** `src/components/image-upload-display.ts`
**Lines:** 405-423

**Problem:**
Pixel sampling clamps to `canvas.width - 1`:

```typescript
const clampedX = Math.min(Math.max(0, Math.floor(x)), canvas.width - 1);
```

If `canvas.width` is 0, this becomes `-1`, which is invalid.

**Impact:** Potential error on edge case with 0-sized canvas.

**Fix:** Add guard for zero dimensions:

```typescript
if (canvas.width === 0 || canvas.height === 0) return null;
const clampedX = Math.min(Math.max(0, Math.floor(x)), canvas.width - 1);
```

---

### BUG-012: CollectionService Import Without Limit Check

**Severity:** Medium
**File:** `src/services/collection-service.ts`

**Problem:**
Service enforces limits on `addFavorite()` and `addCollection()`, but if data is loaded from storage or imported, it could exceed limits.

**Impact:** Imported collections could bypass the 1000-item limit.

**Fix:** Validate limits on import/load:

```typescript
import(data: CollectionExport): boolean {
  if (data.items.length > MAX_COLLECTION_SIZE) {
    logger.warn('Import exceeds size limit, truncating');
    data.items = data.items.slice(0, MAX_COLLECTION_SIZE);
  }
  // ... proceed with import
}
```

---

## 5. Error Handling Gaps

### BUG-013: IndexedDB Missing Error Context

**Severity:** Low
**File:** `src/services/indexeddb-service.ts`
**Lines:** 151-170

**Problem:**
When `get()` fails, it returns null without distinguishing between "key doesn't exist" and "database error".

**Impact:** Makes debugging harder - callers can't differentiate missing data from errors.

**Fix:** Return a discriminated union or throw on actual errors:

```typescript
async get<T>(key: string): Promise<{ found: true; value: T } | { found: false; error?: Error }> {
  try {
    const value = await this.db.get(key);
    return value !== undefined
      ? { found: true, value }
      : { found: false };
  } catch (error) {
    return { found: false, error };
  }
}
```

---

### BUG-014: ModalService onClose May Throw

**Severity:** Low
**File:** `src/services/modal-service.ts`
**Lines:** 153-157

**Problem:**
Modal dismissal calls `onClose()` callback without error handling:

```typescript
if (modal.onClose) {
  modal.onClose();  // Could throw, breaking dismissal
}
```

**Impact:** If callback throws, modal dismissal could fail silently.

**Fix:** Wrap callback in try-catch:

```typescript
if (modal.onClose) {
  try {
    modal.onClose();
  } catch (error) {
    logger.error('Modal onClose callback failed', error);
  }
}
```

---

### BUG-015: CommunityPresetService Health Check Timeout

**Severity:** Medium
**File:** `src/services/community-preset-service.ts`
**Lines:** 177-195

**Problem:**
The `initialize()` method relies on `fetchWithTimeout()` for health check, but if AbortController isn't properly supported, the timeout might not work.

**Impact:** Health check could hang indefinitely on older browsers.

**Fix:** Add fallback timeout mechanism:

```typescript
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Health check timeout')), 5000)
);

await Promise.race([healthCheck(), timeoutPromise]);
```

---

## 6. Summary and Recommendations

### Bug Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| Medium | 5 | BUG-001, BUG-003, BUG-004, BUG-008, BUG-012, BUG-015 |
| Low | 9 | BUG-002, BUG-005, BUG-006, BUG-007, BUG-009, BUG-010, BUG-011, BUG-013, BUG-014 |

### Bug Summary by Category

| Category | Count | IDs |
|----------|-------|-----|
| Memory Leaks | 3 | BUG-001, BUG-002, BUG-003 |
| Race Conditions | 4 | BUG-004, BUG-005, BUG-006, BUG-007 |
| State Management | 2 | BUG-008, BUG-009 |
| Logical Errors | 3 | BUG-010, BUG-011, BUG-012 |
| Error Handling | 3 | BUG-013, BUG-014, BUG-015 |

### Priority Fix Order

1. **High Priority (Fix Soon)**
   - [X] BUG-001: Camera device listener leak
   - [X] BUG-003: Camera modal setTimeout race
   - [X] BUG-008: DyeSelector subscription leak
   - [X] BUG-012: Collection import limit bypass

2. **Medium Priority (Next Release)**
   - [X] BUG-004: APIService concurrent init
   - [X] BUG-009: Async error boundary gap
   - [X] BUG-015: Health check timeout

3. **Low Priority (Future)**
   - [X] BUG-002: Tooltip orphan state
   - [X] BUG-005: KeyboardService double init
   - [X] BUG-006: Camera promise not awaited
   - [X] BUG-007: SecureStorage race
   - [X] BUG-010: Camera init retry
   - [X] BUG-011: Zero-size canvas
   - [X] BUG-013: IndexedDB error context
   - [X] BUG-014: Modal onClose throw

### Testing Recommendations

1. **Add unit tests** for edge cases identified (zero-size canvas, concurrent initialization)
2. **Add integration tests** for subscription cleanup lifecycle
3. **Add stress tests** for concurrent operations (storage, camera)
4. **Manual testing** for camera device hot-plug scenarios

---

*Generated by Claude Code audit on December 24, 2025*
