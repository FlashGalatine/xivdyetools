# WEB-REF-001: Error Boundaries Implementation Plan

**Date:** 2025-12-14
**Status:** Draft - Pending Implementation
**Estimated Effort:** 5 hours
**Approach:** Option B - Override render() in BaseComponent

---

## 1. Overview

### Problem Statement

The xivdyetools-web-app has no error boundary mechanism. If any component throws an error during rendering, the entire application crashes with no recovery path, leaving users with a broken UI.

### Solution

Implement automatic error boundaries at the BaseComponent level, so all components inheriting from BaseComponent receive error protection without code changes.

### Goals

1. **Graceful Degradation**: Failed components show fallback UI instead of crashing the app
2. **User Recovery**: Provide retry/reset options for users
3. **Error Visibility**: Log errors for debugging and monitoring
4. **Non-Breaking**: Existing components work without modification

---

## 2. Technical Design

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BaseComponent                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  render() - PUBLIC (calls safeRender internally)    │    │
│  │  safeRender() - PROTECTED (wraps in try/catch)      │    │
│  │  renderContent() - ABSTRACT (implemented by child)  │    │
│  │  renderError() - PROTECTED (fallback UI)            │    │
│  │  handleRetry() - PRIVATE (re-attempt render)        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool Components                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ DyeMatcher   │  │ DyePreviewer │  │ Harmony...   │       │
│  │              │  │              │  │              │       │
│  │ renderContent│  │ renderContent│  │ renderContent│       │
│  │ (override)   │  │ (override)   │  │ (override)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Method Renaming Strategy

| Current Method | New Method | Purpose |
|----------------|------------|---------|
| `render()` | `renderContent()` | Child components implement this |
| (new) | `render()` | Public entry point with error handling |
| (new) | `safeRender()` | Internal wrapper with try/catch |
| (new) | `renderError()` | Fallback UI when error occurs |

### 2.3 Error State Management

```typescript
interface ComponentErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: {
    componentName: string;
    timestamp: number;
    attemptCount: number;
  } | null;
}
```

### 2.4 Fallback UI Design

```
┌────────────────────────────────────────┐
│  ⚠️ Something went wrong               │
│                                        │
│  This tool encountered an error.       │
│  Your other tools are unaffected.      │
│                                        │
│  [🔄 Retry]  [↩️ Reset Tool]           │
│                                        │
│  ▼ Technical Details (collapsed)       │
│  ┌──────────────────────────────────┐  │
│  │ Error: Cannot read property...   │  │
│  │ Component: DyeMatcher            │  │
│  │ Time: 2025-12-14 10:30:45        │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Step 1: Update BaseComponent Interface (30 min)

**File:** `src/components/base-component.ts`

1. Add error state properties:
   ```typescript
   protected errorState: ComponentErrorState = {
     hasError: false,
     error: null,
     errorInfo: null,
   };
   ```

2. Rename existing `render()` to `renderContent()`:
   - This becomes an abstract/virtual method
   - All child components override this instead

3. Create new `render()` method:
   ```typescript
   render(): void {
     if (this.errorState.hasError) {
       this.renderError();
       return;
     }
     this.safeRender();
   }
   ```

4. Create `safeRender()` wrapper:
   ```typescript
   protected safeRender(): void {
     try {
       this.renderContent();
       // Clear error state on successful render
       if (this.errorState.hasError) {
         this.clearError();
       }
     } catch (error) {
       this.handleRenderError(error);
     }
   }
   ```

### Step 2: Create Error Handling Methods (30 min)

**File:** `src/components/base-component.ts`

```typescript
protected handleRenderError(error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));

  this.errorState = {
    hasError: true,
    error: err,
    errorInfo: {
      componentName: this.constructor.name,
      timestamp: Date.now(),
      attemptCount: (this.errorState.errorInfo?.attemptCount ?? 0) + 1,
    },
  };

  // Log error for debugging
  this.logError(err);

  // Render fallback UI
  this.renderError();
}

protected logError(error: Error): void {
  console.error(
    `[ErrorBoundary] ${this.constructor.name} render failed:`,
    error.message,
    error.stack
  );

  // TODO: Send to monitoring service (Sentry, etc.)
  // ErrorReportingService.report(error, this.errorState.errorInfo);
}

protected clearError(): void {
  this.errorState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };
}
```

### Step 3: Create Fallback UI Component (45 min)

**File:** `src/components/base-component.ts` (or separate file)

```typescript
protected renderError(): void {
  const { error, errorInfo } = this.errorState;

  // Clear existing content
  if (this.element) {
    this.element.innerHTML = '';
  } else {
    this.element = this.createElement('div', {
      class: this.getErrorBoundaryClasses(),
    });
    this.container.appendChild(this.element);
  }

  // Create error UI
  const errorUI = this.createErrorUI(error, errorInfo);
  this.element.appendChild(errorUI);

  // Bind retry/reset handlers
  this.bindErrorActions();
}

private createErrorUI(
  error: Error | null,
  errorInfo: ComponentErrorState['errorInfo']
): HTMLElement {
  const wrapper = this.createElement('div', {
    class: 'error-boundary-content',
  });

  wrapper.innerHTML = `
    <div class="error-boundary-icon">⚠️</div>
    <h3 class="error-boundary-title">Something went wrong</h3>
    <p class="error-boundary-message">
      This tool encountered an error. Your other tools are unaffected.
    </p>
    <div class="error-boundary-actions">
      <button class="error-boundary-retry" type="button">
        🔄 Retry
      </button>
      <button class="error-boundary-reset" type="button">
        ↩️ Reset Tool
      </button>
    </div>
    <details class="error-boundary-details">
      <summary>Technical Details</summary>
      <pre class="error-boundary-stack">${this.formatErrorDetails(error, errorInfo)}</pre>
    </details>
  `;

  return wrapper;
}

private formatErrorDetails(
  error: Error | null,
  errorInfo: ComponentErrorState['errorInfo']
): string {
  const lines = [
    `Component: ${errorInfo?.componentName ?? 'Unknown'}`,
    `Time: ${errorInfo ? new Date(errorInfo.timestamp).toISOString() : 'Unknown'}`,
    `Attempts: ${errorInfo?.attemptCount ?? 0}`,
    ``,
    `Error: ${error?.message ?? 'Unknown error'}`,
  ];

  if (import.meta.env.DEV && error?.stack) {
    lines.push('', 'Stack:', error.stack);
  }

  return lines.join('\n');
}
```

### Step 4: Add Error Action Handlers (15 min)

**File:** `src/components/base-component.ts`

```typescript
private bindErrorActions(): void {
  const retryBtn = this.element?.querySelector('.error-boundary-retry');
  const resetBtn = this.element?.querySelector('.error-boundary-reset');

  retryBtn?.addEventListener('click', () => this.handleRetry());
  resetBtn?.addEventListener('click', () => this.handleReset());
}

protected handleRetry(): void {
  // Attempt to re-render without clearing state
  this.clearError();
  this.render();
}

protected handleReset(): void {
  // Clear all state and re-initialize
  this.clearError();
  this.resetComponentState();
  this.render();
}

// Virtual method - override in child components for custom reset
protected resetComponentState(): void {
  // Default: no-op
  // Child components can override to reset their specific state
}
```

### Step 5: Add CSS Styles (15 min)

**File:** `src/styles/error-boundary.css` (new file)

```css
.error-boundary-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  min-height: 200px;
  background: var(--color-error-bg, #fef2f2);
  border: 1px solid var(--color-error-border, #fecaca);
  border-radius: 0.5rem;
}

.error-boundary-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.error-boundary-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-error-title, #991b1b);
  margin-bottom: 0.5rem;
}

.error-boundary-message {
  color: var(--color-error-text, #b91c1c);
  margin-bottom: 1rem;
}

.error-boundary-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.error-boundary-retry,
.error-boundary-reset {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.error-boundary-retry {
  background: var(--color-primary, #3b82f6);
  color: white;
  border: none;
}

.error-boundary-retry:hover {
  background: var(--color-primary-hover, #2563eb);
}

.error-boundary-reset {
  background: transparent;
  color: var(--color-error-text, #b91c1c);
  border: 1px solid currentColor;
}

.error-boundary-reset:hover {
  background: var(--color-error-bg, #fef2f2);
}

.error-boundary-details {
  width: 100%;
  max-width: 400px;
  text-align: left;
}

.error-boundary-details summary {
  cursor: pointer;
  color: var(--color-muted, #6b7280);
  font-size: 0.875rem;
}

.error-boundary-stack {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--color-code-bg, #1f2937);
  color: var(--color-code-text, #f3f4f6);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Dark mode support */
[data-theme="dark"] .error-boundary-content {
  background: var(--color-error-bg-dark, #450a0a);
  border-color: var(--color-error-border-dark, #7f1d1d);
}
```

### Step 6: Migrate Child Components (1 hour)

For each component that extends BaseComponent:

1. **Search and replace**: `render()` → `renderContent()`
2. **Verify**: Ensure no component calls `super.render()` (should be removed)
3. **Optional**: Add `resetComponentState()` override if component has local state

**Components to update:**
- [ ] `dye-matcher.ts`
- [ ] `dye-previewer.ts`
- [ ] `harmony-generator.ts`
- [ ] `palette-extractor.ts`
- [ ] `preset-browser.ts`
- [ ] `dye-grid.ts`
- [ ] `dye-selector.ts`
- [ ] `modal-container.ts`
- [ ] `toast-container.ts`
- [ ] `two-panel-shell.ts`
- [ ] `app-layout.ts`
- [ ] Any other BaseComponent subclasses

**Migration script (optional):**
```bash
# Find all files with render() method in components
grep -r "render():" src/components/ --include="*.ts"

# Preview replacements (manual review recommended)
sed -n 's/render():/renderContent():/p' src/components/*.ts
```

### Step 7: Add Optional Error Reporting Service (30 min)

**File:** `src/services/error-reporting-service.ts` (new file)

```typescript
export class ErrorReportingService {
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Global error handler for uncaught errors
    window.addEventListener('error', (event) => {
      this.report(event.error, {
        type: 'uncaught',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
      });
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.report(event.reason, { type: 'promise-rejection' });
    });
  }

  static report(
    error: Error | unknown,
    context?: Record<string, unknown>
  ): void {
    const err = error instanceof Error ? error : new Error(String(error));

    // Console logging (always)
    console.error('[ErrorReporting]', err, context);

    // TODO: Send to external service
    // if (import.meta.env.PROD) {
    //   fetch('/api/errors', {
    //     method: 'POST',
    //     body: JSON.stringify({ error: err.message, stack: err.stack, context }),
    //   });
    // }
  }
}
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

**File:** `src/components/__tests__/error-boundary.test.ts`

```typescript
describe('BaseComponent Error Boundary', () => {
  it('catches render errors and shows fallback UI', () => {
    class BrokenComponent extends BaseComponent {
      renderContent(): void {
        throw new Error('Test error');
      }
    }

    const component = new BrokenComponent(container);
    component.render();

    expect(container.querySelector('.error-boundary-content')).toBeTruthy();
    expect(container.textContent).toContain('Something went wrong');
  });

  it('allows retry after error', () => {
    let shouldFail = true;

    class RetryableComponent extends BaseComponent {
      renderContent(): void {
        if (shouldFail) throw new Error('First attempt fails');
        this.element!.textContent = 'Success!';
      }
    }

    const component = new RetryableComponent(container);
    component.render();

    // First render fails
    expect(container.querySelector('.error-boundary-content')).toBeTruthy();

    // Fix the issue
    shouldFail = false;

    // Click retry
    container.querySelector<HTMLButtonElement>('.error-boundary-retry')?.click();

    // Should now show success
    expect(container.textContent).toContain('Success!');
  });

  it('logs errors to console', () => {
    const consoleSpy = vi.spyOn(console, 'error');

    class BrokenComponent extends BaseComponent {
      renderContent(): void {
        throw new Error('Logged error');
      }
    }

    new BrokenComponent(container).render();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ErrorBoundary]'),
      expect.any(String),
      expect.any(String)
    );
  });

  it('tracks attempt count', () => {
    class AlwaysBrokenComponent extends BaseComponent {
      renderContent(): void {
        throw new Error('Always fails');
      }
    }

    const component = new AlwaysBrokenComponent(container);

    // First attempt
    component.render();
    expect(container.textContent).toContain('Attempts: 1');

    // Retry
    container.querySelector<HTMLButtonElement>('.error-boundary-retry')?.click();
    expect(container.textContent).toContain('Attempts: 2');
  });
});
```

### 4.2 Integration Tests

- [ ] Verify each tool component renders normally without errors
- [ ] Verify modal system works with error boundaries
- [ ] Verify toast notifications work with error boundaries
- [ ] Test error boundary in nested component scenarios

### 4.3 Manual Testing Checklist

- [ ] Force error in DyeMatcher → verify fallback UI appears
- [ ] Click "Retry" → verify re-render attempt
- [ ] Click "Reset Tool" → verify state clears
- [ ] Verify error details show in development mode
- [ ] Verify other tools remain functional when one errors
- [ ] Test on mobile viewport
- [ ] Test with screen reader (a11y)

---

## 5. Rollout Plan

### Phase 1: Development (Day 1)
1. Implement BaseComponent changes
2. Add CSS styles
3. Write unit tests
4. Test in development environment

### Phase 2: Component Migration (Day 1-2)
1. Migrate components in batches:
   - Batch 1: Tool components (DyeMatcher, HarmonyGenerator, etc.)
   - Batch 2: UI components (Modal, Toast, Grid)
   - Batch 3: Layout components (AppLayout, Shell)
2. Run full test suite after each batch

### Phase 3: Testing (Day 2)
1. Run automated tests
2. Manual QA testing
3. Accessibility testing
4. Performance testing (verify no regression)

### Phase 4: Deployment (Day 3)
1. Deploy to staging
2. Smoke test all tools
3. Monitor for errors
4. Deploy to production
5. Monitor error reporting dashboard

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing render methods | HIGH | Thorough grep/search before migration |
| Performance overhead from try/catch | LOW | try/catch is cheap when no error thrown |
| CSS conflicts with existing styles | MEDIUM | Use specific class prefix |
| Infinite retry loops | MEDIUM | Add max attempt limit (3) |
| Memory leaks from error state | LOW | Clear state on successful render |

---

## 7. Success Criteria

- [ ] All components extend error boundary automatically
- [ ] No existing functionality broken
- [ ] Fallback UI displays correctly on all viewports
- [ ] Retry and Reset buttons work correctly
- [ ] Errors logged to console (and external service if configured)
- [ ] Unit test coverage for error boundary logic
- [ ] No performance regression (< 5ms overhead)

---

## 8. Future Enhancements

1. **Error Reporting Integration**: Connect to Sentry, LogRocket, or similar
2. **Error Analytics**: Track error frequency by component
3. **Custom Fallback UI**: Allow components to define custom error UIs
4. **Recovery Hints**: Suggest specific actions based on error type
5. **Offline Support**: Different fallback for network errors

---

## Appendix: Quick Reference

### Files to Create
- `src/styles/error-boundary.css`
- `src/services/error-reporting-service.ts` (optional)
- `src/components/__tests__/error-boundary.test.ts`

### Files to Modify
- `src/components/base-component.ts` (main changes)
- `src/components/*.ts` (all subclasses - rename render → renderContent)
- `src/styles/index.css` (import error-boundary.css)

### Git Commits (Suggested)
1. `feat(web): add error boundary infrastructure to BaseComponent`
2. `refactor(web): migrate tool components to renderContent pattern`
3. `refactor(web): migrate UI components to renderContent pattern`
4. `style(web): add error boundary CSS styles`
5. `test(web): add error boundary unit tests`
