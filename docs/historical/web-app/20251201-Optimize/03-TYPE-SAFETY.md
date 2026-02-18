# Type Safety Issues

## Overview

The codebase generally has good TypeScript coverage, but there are a few areas where type safety is weakened through coercion or missing declarations.

---

## 1. Type Coercion Issues

### 1.1 Style Assignment Coercion

**File:** `base-component.ts` (line 388)

**Problem:** Double coercion weakens type safety:

```typescript
// Current implementation:
(this.element.style as unknown as Record<string, string>)[key] = value as string;
```

**Why it exists:** Allows dynamic style property assignment by string key.

**Better solution:**

```typescript
// Option 1: Use Object.assign (type-safe)
setStyle(styles: Partial<CSSStyleDeclaration>): void {
  if (!this.element) return;
  Object.assign(this.element.style, styles);
}

// Usage:
this.setStyle({ backgroundColor: 'red', display: 'flex' });

// Option 2: Use setProperty for CSS custom properties
setStyleProperty(property: string, value: string): void {
  if (!this.element) return;
  this.element.style.setProperty(property, value);
}
```

### 1.2 EyeDropper API Type Assertion

**File:** `color-picker-display.ts` (line 253)

**Problem:** Uses `as any` for browser API:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EyeDropperClass = (window as any).EyeDropper as new () => {
  open: () => Promise<{ sRGBHex?: string }>;
};
```

**Better solution:** Create proper type declaration:

```typescript
// shared/browser-api-types.ts
interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperAPI {
  open(): Promise<EyeDropperResult>;
}

declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperAPI;
  }
}

// Then in component:
if (window.EyeDropper) {
  const eyeDropper = new window.EyeDropper();
  const result = await eyeDropper.open();
  if (result.sRGBHex) {
    this.setColor(result.sRGBHex);
  }
}
```

---

## 2. Missing Type Annotations

### 2.1 Implicit Returns in Factory Functions

**File:** `empty-state.ts` (line 223)

**Problem:** Return type relies on inference:

```typescript
export function createEmptyState(container: HTMLElement, preset: EmptyStateOptions): EmptyState {
  const emptyState = new EmptyState(container, preset);
  return emptyState.init();  // init() returns `this`, but not explicit
}
```

**Recommendation:** Make intent explicit:

```typescript
// In BaseComponent:
init(): this {  // Already typed correctly
  // ...
  return this;
}

// Factory function is fine, but could be more explicit:
export function createEmptyState(
  container: HTMLElement,
  preset: EmptyStateOptions
): EmptyState {
  const emptyState = new EmptyState(container, preset);
  emptyState.init();
  return emptyState;  // More explicit return
}
```

### 2.2 ReturnType Without Explicit Instantiation

**File:** `market-board.ts` (line 35)

**Problem:** Uses ReturnType inferring from getInstance:

```typescript
private apiService: ReturnType<typeof APIService.getInstance>;
```

**Better:** Use explicit type from core:

```typescript
import type { APIService as CoreAPIService } from 'xivdyetools-core';

private apiService: CoreAPIService;
```

### 2.3 Event Detail Types

**Pattern:** Custom events dispatched without typed details:

```typescript
// Current pattern:
this.element?.dispatchEvent(new CustomEvent('color-selected', {
  detail: { color: hex }  // Untyped
}));
```

**Better:** Create typed event interfaces:

```typescript
// shared/event-types.ts
interface ColorSelectedEvent extends CustomEvent {
  detail: { color: string };
}

interface DyeSelectedEvent extends CustomEvent {
  detail: { dye: Dye };
}

// Type-safe dispatch
this.element?.dispatchEvent(
  new CustomEvent<{ color: string }>('color-selected', {
    detail: { color: hex }
  })
);
```

---

## 3. Missing Generic Constraints

### 3.1 Event Handler Type

**File:** `base-component.ts` (line 28)

**Current:**
```typescript
export type EventHandler<T extends Event = Event> = (this: BaseComponent, event: T) => void;
```

**This is well-typed.** No action needed.

### 3.2 Service Wrapper Types

**Pattern:** Service wrappers could be more strictly typed:

```typescript
// Current in dye-service-wrapper.ts:
export class DyeServiceWrapper {
  private static instance: DyeServiceWrapper | null = null;
  private dyeService: DyeService;  // Good
}

// Could add readonly to prevent reassignment:
private readonly dyeService: DyeService;
```

---

## 4. Recommended Type Declarations File

Create a centralized browser API types file:

```typescript
// src/shared/browser-api-types.ts

/**
 * EyeDropper API (Chrome 95+)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/EyeDropper_API
 */
interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropper {
  open(): Promise<EyeDropperResult>;
}

interface EyeDropperConstructor {
  new (): EyeDropper;
}

/**
 * Screen Wake Lock API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */
interface WakeLockSentinel {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinel, ev: Event) => void) | null;
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

/**
 * Extend Window interface
 */
declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }

  interface Navigator {
    wakeLock?: WakeLock;
  }
}

export {};
```

---

## 5. Type Safety Checklist

### Currently Good
- [x] Component props and state typing
- [x] Service method signatures
- [x] Dye and color type definitions
- [x] API response types
- [x] Event handler typing in BaseComponent

### Needs Improvement
- [ ] Browser API declarations (EyeDropper)
- [ ] Custom event detail types
- [ ] Style property assignment
- [ ] Service wrapper explicit types

### Nice to Have
- [ ] Strict null checks on all optional properties
- [ ] Readonly modifiers on immutable fields
- [ ] Branded types for hex colors (e.g., `type HexColor = string & { __brand: 'hex' }`)

---

## 6. Action Items

| Priority | Task | File | Effort |
|----------|------|------|--------|
| P1 | Create browser-api-types.ts | New file | 30min |
| P1 | Fix EyeDropper type assertion | color-picker-display.ts | 15min |
| P2 | Fix style assignment coercion | base-component.ts | 30min |
| P2 | Add custom event types | shared/event-types.ts | 1h |
| P3 | Add readonly modifiers | Various services | 30min |
