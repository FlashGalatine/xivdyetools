# Code Audit: xivdyetools-web-app

**Version:** 3.0.0
**Date:** 2025-12-14
**Total Findings:** 27 (0 CRITICAL, 4 HIGH, 18 MEDIUM, 5 LOW)

---

## Summary Table

| ID | Title | Severity | Category | File |
|----|-------|----------|----------|------|
| WEB-PERF-001 | Event Listener Accumulation in Modal Service | HIGH | Performance | modal-service.ts |
| WEB-PERF-002 | Modal Container Full Re-render | HIGH | Performance | modal-container.ts |
| WEB-BUG-001 | KeyboardService Double Initialization | HIGH | Bug | keyboard-service.ts |
| WEB-REF-001 | Missing Error Boundaries | HIGH | Reliability | All components |
| WEB-PERF-003 | BaseComponent Key Collision Risk | MEDIUM | Performance | base-component.ts |
| WEB-PERF-004 | Dye Grid DOM Mutation | MEDIUM | Performance | dye-grid.ts |
| WEB-PERF-005 | Translation Cache Not Used | MEDIUM | Performance | app-layout.ts |
| WEB-PERF-006 | Toast Container Full Re-render | MEDIUM | Performance | toast-container.ts |
| WEB-BUG-002 | Modal Listener Immediate Notification | MEDIUM | Bug | modal-service.ts |
| WEB-BUG-003 | Theme Service Double Init | MEDIUM | Bug | theme-service.ts |
| WEB-BUG-004 | Storage Quota Error Propagation | MEDIUM | Bug | storage-service.ts |
| WEB-BUG-005 | Modal Focus Trap Incomplete | MEDIUM | A11y | modal-container.ts |
| WEB-BUG-006 | Tooltip Memory Leak | MEDIUM | Memory | tooltip-service.ts |
| WEB-BUG-007 | Footer Selector Fragility | MEDIUM | Maintenance | app-layout.ts |
| WEB-BUG-008 | V3 Layout Global Variables | MEDIUM | Memory | v3-layout.ts |
| WEB-REF-002 | Inconsistent Event Handler Pattern | MEDIUM | Consistency | Multiple services |
| WEB-REF-003 | Duplicate Subscription Pattern | MEDIUM | Duplication | Multiple components |
| WEB-REF-004 | Manual DOM Querying | MEDIUM | Performance | Multiple components |
| WEB-REF-005 | Inconsistent Error Throwing | MEDIUM | Consistency | Multiple services |
| WEB-REF-006 | Missing A11y Announcer Usage | MEDIUM | A11y | Multiple components |
| WEB-REF-007 | Bundle Splitting Services | MEDIUM | Performance | vite.config.ts |
| WEB-REF-008 | Incomplete Cleanup Pattern | MEDIUM | Memory | base-component.ts |
| WEB-A11Y-001 | Missing ARIA Labels | LOW | A11y | dye-grid.ts |
| WEB-A11Y-002 | Focus Management DOM Reference | LOW | A11y | modal-container.ts |
| WEB-TYPE-001 | Loose Modal ID Typing | LOW | TypeScript | modal-service.ts |
| WEB-TYPE-002 | Response Wrapper Inflexibility | LOW | TypeScript | response.ts |
| WEB-PERF-007 | Router Event Handler Storage | LOW | Maintenance | router-service.ts |

---

## HIGH Findings

### WEB-PERF-001: Event Listener Accumulation in Modal Service

**Severity:** HIGH
**Category:** Performance

**Location:**
- **File:** `src/services/modal-service.ts`
- **Lines:** 144-159 (dismiss method)
- **Function:** `dismiss()`

**Description:**
The `dismiss()` method contains 5 console.log statements that execute every time a modal is dismissed. Additionally, listener notifications may occur repeatedly without verification of proper cleanup.

**Evidence:**
```typescript
static dismiss(id: string): void {
  console.log('[ModalService] dismiss called for id:', id);           // Line 144
  console.log('[ModalService] modal index:', index, ...);            // Line 146
  console.log('[ModalService] modal removed, remaining modals:', ...);// Line 150
  console.log('[ModalService] notifying listeners, count:', ...);    // Line 154
  console.warn('[ModalService] modal not found:', id);               // Line 158
}
```

**Impact:**
- Performance overhead on every modal dismiss
- Console pollution in production
- Potential double-notification of listeners

**Recommendation:**
```typescript
static dismiss(id: string): void {
  if (import.meta.env.DEV) {
    console.log('[ModalService] dismiss called for id:', id);
  }
  // ... rest of method
}
```

**Effort:** Low (15 minutes)

---

### WEB-PERF-002: Modal Container Full Re-render

**Severity:** HIGH
**Category:** Performance

**Location:**
- **File:** `src/components/modal-container.ts`
- **Lines:** 309-371 (render method)
- **Function:** `render()`

**Description:**
The render method fully re-renders all modals in the stack whenever ANY modal changes, clearing the entire container and recreating all DOM nodes.

**Evidence:**
```typescript
render(): void {
  clearContainer(this.container);  // Clears entire container
  if (this.modals.length === 0) {
    this.element = null;
    return;
  }
  this.element = this.createElement('div', { id: 'modal-container', ... });
  this.modals.forEach((modal, index) => {  // Recreates every modal
    const modalEl = this.createModalElement(modal, index);
    this.element!.appendChild(modalEl);
  });
}
```

**Impact:**
- With 3 stacked modals, opening a 4th recreates all 4
- DOM thrashing causes layout recalculation
- Animations reset on unchanged modals
- Poor perceived performance

**Recommendation:**
Implement incremental rendering:
```typescript
render(): void {
  if (this.modals.length === 0) {
    clearContainer(this.container);
    this.element = null;
    return;
  }

  if (!this.element) {
    this.element = this.createElement('div', { id: 'modal-container' });
    this.container.appendChild(this.element);
  }

  // Only add new modals, don't recreate existing
  const existingIds = new Set(
    Array.from(this.element.children).map(el => el.id)
  );

  this.modals.forEach((modal, index) => {
    if (!existingIds.has(`modal-${modal.id}`)) {
      const modalEl = this.createModalElement(modal, index);
      this.element!.appendChild(modalEl);
    }
  });

  // Remove modals that are no longer in list
  // ...
}
```

**Effort:** Medium (1-2 hours)

---

### WEB-BUG-001: KeyboardService Double Initialization Risk

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/services/keyboard-service.ts`
- **Lines:** 48-66 (initialize method)
- **Function:** `initialize()`

**Description:**
If `initialize()` is called while `destroy()` is running, could add a new event handler without removing the old one, causing duplicate handlers.

**Evidence:**
```typescript
static initialize(): void {
  if (this.isInitialized) {
    logger.warn('KeyboardService already initialized');
    return;  // Returns but doesn't prevent race
  }
  // ...
  this.boundHandler = this.handleKeyDown.bind(this);  // Line 61
  document.addEventListener('keydown', this.boundHandler);
  this.isInitialized = true;
}
```

**Impact:**
- Duplicate keydown handlers
- Keyboard shortcuts fire twice
- Memory leak from orphaned handlers

**Recommendation:**
```typescript
static initialize(): void {
  // Always remove old handler before adding new
  if (this.boundHandler) {
    document.removeEventListener('keydown', this.boundHandler);
  }

  this.boundHandler = this.handleKeyDown.bind(this);
  document.addEventListener('keydown', this.boundHandler);
  this.isInitialized = true;
}
```

**Effort:** Low (15 minutes)

---

### WEB-REF-001: Missing Error Boundaries

**Severity:** HIGH
**Category:** Reliability

**Location:**
- **Files:** All component files
- **Pattern:** No error catching in render methods

**Description:**
No error boundary components exist. If a tool component throws during render, the entire application crashes with no recovery path.

**Impact:**
- Single component error crashes entire app
- No user feedback on partial failures
- No error reporting to monitoring

**Recommendation:**
Create ErrorBoundary component:
```typescript
export class ErrorBoundary extends BaseComponent {
  private error: Error | null = null;

  renderWithErrorHandling(childRenderer: () => void): void {
    try {
      childRenderer();
    } catch (error) {
      this.error = error as Error;
      this.renderError();
    }
  }

  private renderError(): void {
    this.element = this.createElement('div', {
      class: 'error-boundary p-4 bg-red-100 rounded',
      innerHTML: `
        <h2 class="text-red-800 font-bold">Something went wrong</h2>
        <p class="text-red-600">${this.error?.message || 'Unknown error'}</p>
        <button class="mt-2 px-4 py-2 bg-red-600 text-white rounded">
          Reload Tool
        </button>
      `
    });
  }
}
```

**Effort:** Medium (2-3 hours)

---

## MEDIUM Findings

### WEB-PERF-003: BaseComponent Event Listener Key Collision

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/components/base-component.ts`
- **Lines:** 320-321 (addListener method)
- **Function:** `addListener()`

**Description:**
Event listener storage uses `Math.random()` to generate unique keys, creating a collision risk with high-frequency binding.

**Evidence:**
```typescript
const key = `${eventName}_${Math.random()}`;
this.listeners.set(key, { target, event: eventName, handler: boundHandler });
```

**Impact:**
- Theoretical collision at ~1000+ listeners
- Could overwrite existing listener, causing memory leak

**Recommendation:**
```typescript
private listenerCounter = 0;

addListener(...) {
  const key = `${eventName}_${++this.listenerCounter}`;
  // ...
}
```

**Effort:** Low (10 minutes)

---

### WEB-PERF-004: Dye Grid DOM Mutation

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/components/dye-grid.ts`
- **Lines:** 97-105
- **Function:** `render()`

**Description:**
When switching between grid and empty state, the component removes and re-adds CSS classes on every render instead of using separate DOM elements.

**Evidence:**
```typescript
if (this.dyes.length === 0 && this.emptyState) {
  wrapper.innerHTML = emptyHtml;
  wrapper.classList.remove('grid', 'grid-cols-1', ...);  // 7 removals
  wrapper.classList.add('flex', 'flex-col', ...);        // 3 additions
}
```

**Impact:**
- CSS class manipulation triggers style recalculation
- Minor but noticeable on frequent updates

**Recommendation:**
Use separate DOM elements for grid and empty states:
```typescript
private gridElement: HTMLElement | null = null;
private emptyElement: HTMLElement | null = null;

render(): void {
  if (this.dyes.length === 0) {
    this.gridElement?.remove();
    this.showEmpty();
  } else {
    this.emptyElement?.remove();
    this.showGrid();
  }
}
```

**Effort:** Medium (1 hour)

---

### WEB-BUG-002: Modal Listener Immediate Notification Race

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/services/modal-service.ts`
- **Lines:** 217-227 (subscribe method)
- **Function:** `subscribe()`

**Description:**
The subscribe method immediately calls the listener with current state. If the listener triggers a modal operation as a side effect, lifecycle can be violated.

**Evidence:**
```typescript
static subscribe(listener: (modals: Modal[]) => void): () => void {
  this.listeners.add(listener);
  listener([...this.modals]);  // Immediate call - can cause race
  return () => this.listeners.delete(listener);
}
```

**Impact:**
- Component sees empty array, then immediately sees new modal
- Can cause double-render or state inconsistency

**Recommendation:**
```typescript
static subscribe(
  listener: (modals: Modal[]) => void,
  options: { immediate?: boolean } = { immediate: false }
): () => void {
  this.listeners.add(listener);
  if (options.immediate) {
    listener([...this.modals]);
  }
  return () => this.listeners.delete(listener);
}
```

**Effort:** Low (15 minutes)

---

### WEB-BUG-003: Theme Service Double Initialization

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/services/theme-service.ts`
- **Lines:** 353-362
- **Pattern:** Auto-initialization on module load

**Description:**
Theme service auto-initializes with both `DOMContentLoaded` listener and immediate execution, potentially calling `initialize()` twice.

**Evidence:**
```typescript
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ThemeService.initialize();
    });
  } else {
    ThemeService.initialize();  // If readyState changes, both run
  }
}
```

**Impact:**
- Theme applied twice
- Unnecessary CSS variable recalculation

**Recommendation:**
```typescript
let initialized = false;

function initTheme() {
  if (!initialized) {
    initialized = true;
    ThemeService.initialize();
  }
}
```

**Effort:** Low (10 minutes)

---

### WEB-BUG-004: Storage Quota Error Propagation

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/services/storage-service.ts`
- **Lines:** 79-92 (setItem method)
- **Function:** `setItem()`

**Description:**
Method signature returns `boolean` but throws `AppError` on quota exceeded. Callers expecting boolean return may not catch the thrown error.

**Evidence:**
```typescript
static setItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new AppError(...);  // Throws despite boolean return type!
    }
    return false;
  }
}
```

**Impact:**
- Uncaught exception crashes component
- Silent data loss if error not handled

**Recommendation:**
Either:
1. Return `false` instead of throwing, OR
2. Change return type to `boolean | never` and document throws

**Effort:** Low (15 minutes)

---

### WEB-BUG-005: Modal Focus Trap Incomplete

**Severity:** MEDIUM
**Category:** Accessibility

**Location:**
- **File:** `src/components/modal-container.ts`
- **Lines:** 340-349
- **Function:** Focus trap setup

**Description:**
Focus trap only applied to topmost modal. Background modals don't have `inert` attribute, allowing keyboard navigation to hidden content.

**Evidence:**
```typescript
if (topModalEl) {
  this.focusTrapElements = this.getFocusableElements(topModalEl as HTMLElement);
  // Missing: inert on background modals
}
```

**Impact:**
- Screen reader users can navigate into hidden modals
- Violates WCAG focus containment

**Recommendation:**
```typescript
this.modals.forEach((modal, index) => {
  const modalEl = document.getElementById(`modal-${modal.id}`);
  if (index < this.modals.length - 1) {
    modalEl?.setAttribute('inert', '');
  } else {
    modalEl?.removeAttribute('inert');
  }
});
```

**Effort:** Low (20 minutes)

---

### WEB-BUG-006: Tooltip Memory Leak on Detached DOM

**Severity:** MEDIUM
**Category:** Memory

**Location:**
- **File:** `src/services/tooltip-service.ts`
- **Line:** 307
- **Function:** `positionTooltip()`

**Description:**
When target element is removed from DOM, tooltip state remains in Map forever, leaking memory.

**Evidence:**
```typescript
private static positionTooltip(...): void {
  if (!target.isConnected || !state.element.isConnected) return;  // Early exit
  // But state is never cleaned up!
}
```

**Impact:**
- Memory grows over time with SPA navigation
- Orphaned tooltip states accumulate

**Recommendation:**
```typescript
if (!target.isConnected || !state.element.isConnected) {
  this.detach(target);  // Clean up state
  return;
}
```

**Effort:** Low (10 minutes)

---

### WEB-BUG-007: Footer Selector Fragility

**Severity:** MEDIUM
**Category:** Maintenance

**Location:**
- **File:** `src/components/app-layout.ts`
- **Lines:** 320-333
- **Function:** `updateLocalizedText()`

**Description:**
Footer element selectors are complex CSS selectors that break if Tailwind classes change.

**Evidence:**
```typescript
const footerCopyright = this.querySelector<HTMLElement>('footer .text-sm');
const footerCreator = this.querySelector<HTMLElement>('footer .text-xs:not(.border-t)');
const footerDisclaimer = this.querySelector<HTMLElement>('footer .border-t');
```

**Impact:**
- Tailwind class changes break localization
- Silent failures with no error

**Recommendation:**
```typescript
// Add unique IDs to footer elements in template
const footerCopyright = this.querySelector<HTMLElement>('#footer-copyright');
const footerCreator = this.querySelector<HTMLElement>('#footer-creator');
```

**Effort:** Low (15 minutes)

---

### WEB-BUG-008: V3 Layout Global Variables Not Cleaned

**Severity:** MEDIUM
**Category:** Memory

**Location:**
- **File:** `src/components/v3-layout.ts`
- **Lines:** 17-20
- **Pattern:** Module-level state

**Description:**
Module-level variables for `activeTool`, `shellInstance`, and `languageUnsubscribe` are never cleared, preventing garbage collection.

**Evidence:**
```typescript
// Lines 17-20: Global module state
let activeTool: BaseComponent | null = null;
let shellInstance: TwoPanelShell | null = null;
let languageUnsubscribe: (() => void) | null = null;
```

**Impact:**
- Old component references held after SPA navigation
- Memory leak on app remount

**Recommendation:**
```typescript
export function cleanupV3Layout(): void {
  activeTool?.destroy();
  shellInstance?.destroy();
  languageUnsubscribe?.();
  activeTool = null;
  shellInstance = null;
  languageUnsubscribe = null;
}
```

**Effort:** Low (15 minutes)

---

### WEB-REF-002: Inconsistent Event Handler Patterns

**Severity:** MEDIUM
**Category:** Consistency

**Location:**
- **Files:** Multiple services
- **Pattern:** Mixed binding approaches

**Description:**
Services use different patterns for event handlers: `bind(this)`, arrow functions, closures.

**Examples:**
- KeyboardService: `this.handleKeyDown.bind(this)`
- RouterService: `private static handlePopState = () => {}`
- TooltipService: `state.mouseEnterHandler = () => {...}`

**Impact:**
- Harder to maintain
- Different `this` context behaviors
- Inconsistent cleanup patterns

**Recommendation:**
Standardize on arrow functions for static services, bound functions for instances.

**Effort:** Medium (2 hours)

---

### WEB-REF-003: Duplicate Subscription Pattern

**Severity:** MEDIUM
**Category:** Code Duplication

**Location:**
- **Files:**
  - `app-layout.ts:299-306`
  - `v3-layout.ts:48-53`
  - `dye-selector.ts:49-50, 72-74`

**Description:**
Each component re-implements subscribe/unsubscribe boilerplate for theme and language changes.

**Impact:**
- Duplicated code across 10+ components
- Easy to forget cleanup

**Recommendation:**
Create utility mixin:
```typescript
protected subscribeToService<T>(
  service: { subscribe(cb: (data: T) => void): () => void },
  onData: (data: T) => void
): void {
  const unsubscribe = service.subscribe(onData);
  this.cleanupFunctions.push(unsubscribe);
}
```

**Effort:** Medium (2 hours)

---

### WEB-REF-004: Manual DOM Querying

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **Files:**
  - `app-layout.ts:313-333`
  - `two-panel-shell.ts` (multiple locations)

**Description:**
Repeated `querySelector` calls on every update instead of storing element references.

**Evidence:**
```typescript
private updateLocalizedText(): void {
  const title = this.querySelector<HTMLElement>('header h1');  // Query every time
  // ...
}
```

**Impact:**
- DOM traversal on every update
- Slower than direct reference access

**Recommendation:**
```typescript
private headerTitle: HTMLElement | null = null;

onMount(): void {
  this.headerTitle = this.querySelector<HTMLElement>('header h1');
}

private updateLocalizedText(): void {
  if (this.headerTitle) {
    this.headerTitle.textContent = LanguageService.t('app.title');
  }
}
```

**Effort:** Medium (1-2 hours)

---

### WEB-REF-005: Inconsistent Error Throwing

**Severity:** MEDIUM
**Category:** Consistency

**Location:**
- **Files:**
  - `theme-service.ts:192` - throws `AppError`
  - `language-service.ts:127` - throws generic `error`
  - `storage-service.ts:82-86` - throws `AppError`

**Description:**
Some services throw `AppError`, others throw generic errors. No consistent error handling policy.

**Impact:**
- Inconsistent catch block requirements
- Hard to implement unified error handling

**Recommendation:**
Standardize on `AppError` for all service errors.

**Effort:** Medium (1 hour)

---

### WEB-REF-006: Missing A11y Announcer Usage

**Severity:** MEDIUM
**Category:** Accessibility

**Location:**
- **File:** `app-layout.ts:292`
- **Pattern:** Announcer initialized but unused

**Description:**
`AnnouncerService` is initialized but never used for state change announcements.

**Impact:**
- Screen reader users not informed of updates
- Language changes not announced

**Recommendation:**
```typescript
private updateLocalizedText(): void {
  // ... update DOM ...
  AnnouncerService.announce(
    `Language changed to ${LanguageService.getCurrentLocale()}`
  );
}
```

**Effort:** Low (30 minutes)

---

### WEB-REF-007: Bundle Splitting Services Issue

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `vite.config.ts:39-52`
- **Comment:** "Services stay in main bundle"

**Description:**
All services bundled together even though tools are lazy-loaded. Matcher-only visitors download all services.

**Impact:**
- Larger initial bundle than necessary
- Wasted bandwidth for single-tool users

**Recommendation:**
Analyze service usage per tool, create tool-specific service chunks.

**Effort:** High (4+ hours)

---

### WEB-REF-008: Incomplete Cleanup in BaseComponent

**Severity:** MEDIUM
**Category:** Memory

**Location:**
- **File:** `src/components/base-component.ts`
- **Lines:** 122-136 (destroy method)
- **Function:** `destroy()`

**Description:**
`destroy()` doesn't check if component already destroyed before running cleanup.

**Impact:**
- Double-destroy could cause errors
- Listeners removed twice

**Recommendation:**
```typescript
destroy(): void {
  if (this.isDestroyed) return;
  this.isDestroyed = true;
  this.onUnmount();
  // ...
}
```

**Effort:** Low (10 minutes)

---

## LOW Findings

### WEB-A11Y-001: Missing ARIA Labels

**Severity:** LOW
**Category:** Accessibility

**Location:**
- **File:** `src/components/dye-grid.ts`
- **Lines:** 112-119

**Description:**
Interactive buttons created without aria-label attributes.

**Effort:** Low (20 minutes)

---

### WEB-A11Y-002: Focus Management DOM Reference

**Severity:** LOW
**Category:** Accessibility

**Location:**
- **File:** `src/components/modal-container.ts`
- **Lines:** 48-61

**Description:**
`previousActiveElement` stores DOM reference that could be removed from DOM.

**Recommendation:**
Store element ID instead of reference.

**Effort:** Low (15 minutes)

---

### WEB-TYPE-001: Loose Modal ID Typing

**Severity:** LOW
**Category:** TypeScript

**Location:**
- **File:** `src/services/modal-service.ts`
- **Line:** 71

**Description:**
`generateId()` returns plain string instead of branded type.

**Recommendation:**
```typescript
type ModalId = string & { readonly __brand: 'ModalId' };
```

**Effort:** Low (15 minutes)

---

### WEB-TYPE-002: Response Wrapper Inflexibility

**Severity:** LOW
**Category:** TypeScript

**Location:**
- **File:** `src/utils/response.ts`

**Description:**
`ephemeralResponse()` only accepts string, not embeds like other response functions.

**Effort:** Low (15 minutes)

---

### WEB-PERF-007: Router Handler Storage Pattern

**Severity:** LOW
**Category:** Maintenance

**Location:**
- **File:** `src/services/router-service.ts`
- **Lines:** 105, 296

**Description:**
Uses arrow function for handler which is good, but pattern differs from KeyboardService.

**Effort:** N/A (informational)

---

## Recommendations Summary

### Immediate (Day 1)
1. Remove debug console.log statements (WEB-PERF-001)
2. Implement error boundaries (WEB-REF-001)

### This Sprint
3. Fix modal container incremental rendering (WEB-PERF-002)
4. Fix KeyboardService initialization (WEB-BUG-001)
5. Fix V3 layout cleanup (WEB-BUG-008)
6. Add focus trap inert attribute (WEB-BUG-005)

### Next Sprint
7. Standardize event handler patterns (WEB-REF-002)
8. Extract subscription utility (WEB-REF-003)
9. Store DOM references (WEB-REF-004)
10. Fix tooltip memory leak (WEB-BUG-006)

### Backlog
11. Bundle splitting analysis (WEB-REF-007)
12. ARIA label audit (WEB-A11Y-001)
13. Type safety improvements (WEB-TYPE-*)
