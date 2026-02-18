# Test Coverage Analysis

## Overview

The codebase has 35 test files with 1,772 total tests. However, 93 tests are currently failing, and 16 components have no test coverage at all.

---

## 1. Current Test Status

### Summary (as of December 1, 2024)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Files | 35 | - | - |
| Total Tests | 1,772 | - | - |
| Passing | 1,679 | 1,772 | 95% |
| Failing | 93 | 0 | Needs Fix |
| Components without Tests | 16 | 0 | Gap |

### Test File Distribution

```
src/
├── components/__tests__/    17 test files
├── services/__tests__/       8 test files
└── shared/__tests__/        10 test files
```

---

## 2. Components Without Tests

### Critical Priority (User-facing, high impact)

| Component | Reason for Priority | Recommended Tests |
|-----------|---------------------|-------------------|
| `modal-container.ts` | Used by 5+ modals | Open/close, focus trap, escape key |
| `dye-action-dropdown.ts` | Critical UI component | Menu items, click handlers |
| `palette-exporter.ts` | User data handling | Export formats, data integrity |
| `camera-preview-modal.ts` | Camera feature | Stream handling, capture flow |

### High Priority (Core functionality)

| Component | Reason for Priority | Recommended Tests |
|-----------|---------------------|-------------------|
| `empty-state.ts` | Reusable across tools | Render variants, action callbacks |
| `loading-spinner.ts` | Reusable component | Show/hide, animation states |
| `offline-banner.ts` | UX component | Online/offline detection |
| `toast-container.ts` | User notifications | Multiple toasts, auto-dismiss |

### Medium Priority (Feature components)

| Component | Reason for Priority | Recommended Tests |
|-----------|---------------------|-------------------|
| `welcome-modal.ts` | First-time user experience | Display logic, dismiss |
| `changelog-modal.ts` | Version updates | Content rendering |
| `shortcuts-panel.ts` | Keyboard shortcuts | Shortcut list rendering |
| `tutorial-spotlight.ts` | Onboarding | Step navigation |
| `saved-palettes-modal.ts` | User data | Load/save/delete |

### Lower Priority (Supporting components)

| Component | Reason for Priority | Recommended Tests |
|-----------|---------------------|-------------------|
| `info-tooltip.ts` | Utility component | Positioning, content |
| `dye-preview-overlay.ts` | Display helper | Show/hide, positioning |

---

## 3. Components with Weak Coverage

### harmony-generator-tool.test.ts

**Current coverage gaps:**
- Filter interactions across multiple harmony types
- `applyDyeFilters()` with different filter combinations
- `updateAllDisplays()` interactions

**Recommended additional tests:**
```typescript
describe('Filter Interactions', () => {
  it('should apply category filter to all harmony types', () => { ... });
  it('should apply price filter when prices are loaded', () => { ... });
  it('should combine multiple filters', () => { ... });
});

describe('Multiple Harmony Updates', () => {
  it('should update all displays when base color changes', () => { ... });
  it('should preserve filter state across updates', () => { ... });
});
```

### accessibility-checker-tool.test.ts

**Current coverage gaps:**
- Pairwise comparison logic
- Distinguishability calculation accuracy
- Colorblind simulation edge cases

**Recommended additional tests:**
```typescript
describe('Pairwise Comparison', () => {
  it('should calculate distinguishability for contrasting colors > 50', () => { ... });
  it('should calculate distinguishability for similar colors < 30', () => { ... });
  it('should handle identical colors', () => { ... });
});

describe('Colorblind Simulations', () => {
  it('should correctly simulate deuteranopia', () => { ... });
  it('should correctly simulate protanopia', () => { ... });
  it('should correctly simulate tritanopia', () => { ... });
});
```

### color-matcher-tool.test.ts

**Current coverage gaps:**
- Recent colors history management
- Zoom controls interaction
- Image upload error handling

**Recommended additional tests:**
```typescript
describe('Recent Colors', () => {
  it('should add color to history', () => { ... });
  it('should limit history to maxRecentColors', () => { ... });
  it('should persist to localStorage', () => { ... });
  it('should restore from localStorage on mount', () => { ... });
});

describe('Zoom Controls', () => {
  it('should zoom in with + key', () => { ... });
  it('should zoom out with - key', () => { ... });
  it('should fit to width', () => { ... });
  it('should fit to container', () => { ... });
});
```

---

## 4. Failing Tests Investigation

### Current Failure Count: 93 tests

**Note:** The coverage.txt file shows 93 failing tests but doesn't provide details on which specific tests are failing. Investigation needed.

### Common Causes of Test Failures

1. **Component changes without test updates**
   - Icon changes (emoji → SVG)
   - Theme count changes (9 → 11)
   - Layout changes (grid → flex)

2. **Mock setup issues**
   - Missing service mocks
   - Stale mock data

3. **Async timing issues**
   - Tests not waiting for async operations
   - Race conditions in event handlers

### Recommended Investigation Steps

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific failing test file
npm test -- src/components/__tests__/failing-test.test.ts

# Run with coverage to identify untested code paths
npm run test:coverage
```

---

## 5. Test Quality Guidelines

### What to Test

| Component Type | What to Test |
|----------------|--------------|
| Tool Components | User interactions, state changes, API calls |
| Display Components | Rendering variants, prop handling |
| Services | Methods, edge cases, error handling |
| Utilities | All branches, edge cases |

### Test Structure Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentUnderTest } from '../component-under-test';

describe('ComponentUnderTest', () => {
  let container: HTMLDivElement;
  let component: ComponentUnderTest;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    component?.destroy();
    container.remove();
  });

  describe('Initialization', () => {
    it('should render without errors', () => {
      component = new ComponentUnderTest(container);
      component.init();
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  describe('User Interactions', () => {
    it('should handle click events', () => {
      // Setup
      component = new ComponentUnderTest(container);
      component.init();

      // Action
      const button = container.querySelector('button');
      button?.click();

      // Assert
      expect(component.state).toBe('expected');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => { ... });
    it('should handle null values', () => { ... });
  });
});
```

---

## 6. Test Coverage Priorities

### Phase 1: Fix Failing Tests (P0)
1. Run `npm test` to identify failing tests
2. Categorize failures by cause
3. Fix test assertions that are outdated
4. Update mocks for changed components

### Phase 2: Critical Components (P1)
1. `modal-container.ts` - Core infrastructure
2. `dye-action-dropdown.ts` - User interactions
3. `palette-exporter.ts` - Data integrity

### Phase 3: High Priority Components (P2)
1. `empty-state.ts`
2. `loading-spinner.ts`
3. `offline-banner.ts`
4. `toast-container.ts`

### Phase 4: Complete Coverage (P3)
1. Remaining untested components
2. Strengthen weak coverage areas
3. Add integration tests

---

## 7. Estimated Effort

| Task | Components | Estimated Time |
|------|------------|----------------|
| Fix 93 failing tests | Various | 4-6 hours |
| Add modal-container tests | 1 | 2 hours |
| Add dye-action-dropdown tests | 1 | 2 hours |
| Add palette-exporter tests | 1 | 2 hours |
| Add camera-preview-modal tests | 1 | 3 hours |
| Add empty-state tests | 1 | 1 hour |
| Add loading-spinner tests | 1 | 30 min |
| Add remaining components | 9 | 8-12 hours |
| **Total** | 16 | **22-30 hours** |

---

## 8. Commands Reference

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- src/components/__tests__/my-component.test.ts

# Run tests matching pattern
npm test -- --grep "ColorMatcher"

# Watch mode
npm test -- --watch

# Update snapshots (if using)
npm test -- --update
```
