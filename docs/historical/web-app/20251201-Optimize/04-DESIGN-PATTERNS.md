# Design Pattern Issues

## Overview

The codebase follows good patterns overall but has grown organically, leading to some inconsistencies and missed abstraction opportunities.

---

## 1. Single Responsibility Violations

### 1.1 Tool Components Mix Multiple Concerns

**Files:** All 5 main tool components

Each tool component handles:
- **View rendering** (HTML structure, styles)
- **State management** (private fields, updates)
- **Business logic** (color matching, harmony generation)
- **Event handling** (user interactions)
- **Side effects** (API calls, storage)

**Example from harmony-generator-tool.ts:**
```typescript
export class HarmonyGeneratorTool extends BaseComponent {
  // State management (lines 87-102)
  private baseColor: string = '#ff0000';
  private harmonyDisplays: Map<string, HarmonyType> = new Map();
  private marketBoard: MarketBoard | null = null;
  private showPrices: boolean = false;
  private priceData: Map<number, PriceData> = new Map();

  // Rendering (~250 lines)
  render(): void { ... }

  // Event binding (~100 lines)
  bindEvents(): void { ... }

  // Business logic (~200 lines)
  private generateHarmonies(): void { ... }
  private applyDyeFilters(): void { ... }

  // Side effects (~100 lines)
  private async fetchPrices(): void { ... }
}
```

**Recommended Pattern: State/View Separation**

```typescript
// harmony-generator-state.ts
export class HarmonyGeneratorState {
  baseColor: string = '#ff0000';
  harmonyDisplays: Map<string, HarmonyType> = new Map();
  showPrices: boolean = false;

  setBaseColor(color: string): void { ... }
  getHarmonies(): Map<string, Dye[]> { ... }
}

// harmony-generator-view.ts
export class HarmonyGeneratorView extends BaseComponent {
  constructor(container: HTMLElement, private state: HarmonyGeneratorState) { ... }

  render(): void { /* Only rendering */ }
  bindEvents(): void { /* Only event binding */ }
}

// harmony-generator-tool.ts
export class HarmonyGeneratorTool {
  private state = new HarmonyGeneratorState();
  private view: HarmonyGeneratorView;

  constructor(container: HTMLElement) {
    this.view = new HarmonyGeneratorView(container, this.state);
  }
  // Orchestration only
}
```

### 1.2 DyeSelector Handles Too Many Concerns

**File:** `dye-selector.ts`

DyeSelector manages:
- Search input and filtering
- Sort options
- Category filtering
- Keyboard navigation
- Selection state
- Display rendering

**Recommendation:** Split into micro-components:
- `DyeSearchBox` - Search input only
- `DyeGrid` - Display grid only
- `DyeSelector` - Orchestrates the above

---

## 2. Missing Abstractions

### 2.1 No Unified Dye Selection Context

**Problem:** Each tool manages dye selection independently:

```typescript
// harmony-generator-tool.ts (lines 87-89)
private selectedDyes: Dye[] = [];
private dyeSelector: DyeSelector | null = null;

// color-matcher-tool.ts (line 47)
private matchedDyes: Dye[] = [];

// dye-comparison-tool.ts (line 24)
private selectedDyes: Dye[] = [];

// dye-mixer-tool.ts (line 27)
private selectedDyes: Dye[] = [];
```

**Impact:**
- No way to share selections between tools
- Each tool duplicates selection logic
- Cannot implement "compare from harmony" feature easily

**Recommended: DyeSelectionContext**

```typescript
// services/dye-selection-context.ts
type SelectionChangedCallback = (toolId: string, dyes: Dye[]) => void;

export class DyeSelectionContext {
  private selections: Map<string, Dye[]> = new Map();
  private listeners: Set<SelectionChangedCallback> = new Set();

  select(toolId: string, dyes: Dye[]): void {
    this.selections.set(toolId, dyes);
    this.notifyListeners(toolId, dyes);
  }

  get(toolId: string): Dye[] {
    return this.selections.get(toolId) ?? [];
  }

  copyToTool(fromToolId: string, toToolId: string): void {
    const dyes = this.get(fromToolId);
    this.select(toToolId, [...dyes]);
  }

  subscribe(callback: SelectionChangedCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(toolId: string, dyes: Dye[]): void {
    this.listeners.forEach(cb => cb(toolId, dyes));
  }
}

// Usage in tools:
export class HarmonyGeneratorTool extends BaseComponent {
  constructor(
    container: HTMLElement,
    private selectionContext: DyeSelectionContext
  ) {
    super(container);
  }

  private handleDyeSelected(dye: Dye): void {
    const current = this.selectionContext.get('harmony');
    this.selectionContext.select('harmony', [...current, dye]);
  }
}
```

### 2.2 No Pricing Mixin/Base

Already covered in [01-COMPONENT-ARCHITECTURE.md](./01-COMPONENT-ARCHITECTURE.md#21-marketboard-initialization-critical).

### 2.3 No TypedEventEmitter

**Problem:** Custom events lack type safety:

```typescript
// Current pattern - no type checking on event names or details
element.dispatchEvent(new CustomEvent('color-selected', { detail: { color: hex } }));
element.addEventListener('color-selected', (e) => {
  const color = (e as CustomEvent).detail.color;  // Cast required
});
```

**Recommended: TypedEventEmitter**

```typescript
// services/typed-event-emitter.ts
type EventMap = Record<string, unknown>;

export class TypedEventEmitter<T extends EventMap> {
  private listeners = new Map<keyof T, Set<(detail: unknown) => void>>();

  on<K extends keyof T>(event: K, handler: (detail: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (detail: unknown) => void);
  }

  off<K extends keyof T>(event: K, handler: (detail: T[K]) => void): void {
    this.listeners.get(event)?.delete(handler as (detail: unknown) => void);
  }

  emit<K extends keyof T>(event: K, detail: T[K]): void {
    this.listeners.get(event)?.forEach(handler => handler(detail));
  }
}

// Usage:
type ColorPickerEvents = {
  'color-selected': { color: string };
  'color-cleared': void;
};

class ColorPickerDisplay extends BaseComponent {
  private events = new TypedEventEmitter<ColorPickerEvents>();

  selectColor(hex: string): void {
    this.events.emit('color-selected', { color: hex });  // Type-safe!
  }
}
```

---

## 3. Inconsistencies

### 3.1 Lifecycle Hook Implementation Varies

**Problem:** Components inconsistently implement lifecycle hooks:

```typescript
// Some components implement onMount:
export class AppLayout extends BaseComponent {
  onMount(): void {
    this.initializeThemeSubscription();
    // ...
  }
}

// Others skip it and use init() directly:
export class SomeComponent extends BaseComponent {
  init(): this {
    // Do setup here instead of onMount
    super.init();
    this.doCustomSetup();  // Should be in onMount
    return this;
  }
}

// Some have onUnmount, others don't:
export class WithCleanup extends BaseComponent {
  onUnmount(): void {
    this.cleanup();  // Good
  }
}

export class WithoutCleanup extends BaseComponent {
  // Missing onUnmount - potential memory leaks
}
```

**Recommendation:** Document expected pattern and audit components:

```typescript
// Recommended component structure:
export class MyComponent extends BaseComponent {
  // Always implement onMount for setup after render
  onMount(): void {
    this.setupSubscriptions();
    this.cacheElements();
  }

  // Always implement onUnmount for cleanup
  onUnmount(): void {
    this.cleanup();
  }
}
```

### 3.2 Event Emission Not Standardized

**Problem:** Components emit events in different ways:

```typescript
// Some use dispatchEvent on element:
this.element?.dispatchEvent(new CustomEvent('color-selected', { detail }));

// Some use callback props:
this.props.onColorSelected?.(color);

// Some use internal event system:
this.emit('color-selected', color);
```

**Recommendation:** Standardize on one pattern (callback props or TypedEventEmitter).

### 3.3 Error Handling Not Uniform

**Problem:** Some components use ErrorHandler, others swallow errors:

```typescript
// Good - using ErrorHandler:
try {
  await this.doSomething();
} catch (error) {
  ErrorHandler.log(error);
}

// Bad - swallowing errors silently:
try {
  await this.doSomething();
} catch {
  // Silent failure
}

// Bad - console.log only:
try {
  await this.doSomething();
} catch (error) {
  console.error('Error:', error);
}
```

**Recommendation:** Always use ErrorHandler:

```typescript
import { ErrorHandler } from '@shared/error-handler';

try {
  await this.riskyOperation();
} catch (error) {
  ErrorHandler.log(error, { context: 'MyComponent.riskyOperation' });
  // Optionally show user-facing error
  ToastService.error(LanguageService.t('errors.generic'));
}
```

---

## 4. Unused/Dead Code

### 4.1 Unused State Methods in BaseComponent

**File:** `base-component.ts` (lines 341-350)

```typescript
protected getState(): Record<string, unknown> {
  return {};
}

protected setState(_newState: Record<string, unknown>): void {
  // Subclasses should override this to implement state management
}
```

**Status:** These methods are defined but never actually used by subclasses.

**Recommendation:** Either:
1. Remove them if not needed
2. Formalize as interface if state management is planned

---

## 5. Recommended Design Improvements

### Priority Order

1. **Create DyeSelectionContext** (P1) - Enables cross-tool features
2. **Create PricingMixin** (P1) - Reduces duplication
3. **Standardize lifecycle hooks** (P2) - Prevents leaks
4. **Add TypedEventEmitter** (P2) - Improves type safety
5. **Standardize error handling** (P3) - Consistency

### Pattern Guidelines

| Pattern | Use Case | Example |
|---------|----------|---------|
| Mixin | Shared behavior across components | PricingMixin |
| Context | Shared state across tools | DyeSelectionContext |
| Factory | Complex component creation | createEmptyState() |
| Observer | Reactive updates | TypedEventEmitter |
| Facade | Simplified API | ColorService from core |
