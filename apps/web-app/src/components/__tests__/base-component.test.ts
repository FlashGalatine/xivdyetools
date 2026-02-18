/**
 * XIV Dye Tools - BaseComponent Unit Tests
 *
 * Tests the abstract base class that all UI components extend.
 * Covers lifecycle methods, DOM utilities, event handling, and error boundary.
 *
 * @module components/__tests__/base-component.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tool-panel-builders to prevent circular dependency when running with other tests
vi.mock('@services/tool-panel-builders', () => ({
  buildFiltersPanel: vi.fn(),
  buildMarketPanel: vi.fn(),
  buildPanelSection: vi.fn(),
  buildCheckboxPanelSection: vi.fn(),
  buildSelectPanelSection: vi.fn(),
  buildRadioPanelSection: vi.fn(),
}));

import { BaseComponent } from '../base-component';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  waitForRender,
  spyOnCustomEvent,
} from '../../__tests__/component-utils';

// ============================================================================
// Test Implementation of Abstract BaseComponent
// ============================================================================

/**
 * Concrete implementation of BaseComponent for testing
 */
class TestComponent extends BaseComponent {
  public renderCallCount = 0;
  public bindEventsCallCount = 0;
  public onMountCalled = false;
  public onUnmountCalled = false;
  public onUpdateCalled = false;
  public shouldThrowOnRender = false;
  public shouldThrowOnBindEvents = false;

  renderContent(): void {
    this.renderCallCount++;

    if (this.shouldThrowOnRender) {
      throw new Error('Test render error');
    }

    const wrapper = this.createElement('div', {
      className: 'test-component',
      attributes: { 'data-testid': 'test-wrapper' },
    });

    const button = this.createElement('button', {
      className: 'test-button',
      textContent: 'Click me',
      attributes: { type: 'button' },
    });

    wrapper.appendChild(button);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    this.bindEventsCallCount++;

    if (this.shouldThrowOnBindEvents) {
      throw new Error('Test bind events error');
    }

    const button = this.querySelector<HTMLButtonElement>('.test-button');
    if (button) {
      this.on(button, 'click', this.handleClick);
    }
  }

  private handleClick(): void {
    this.emit('test-click', { source: 'button' });
  }

  onMount(): void {
    this.onMountCalled = true;
  }

  onUnmount(): void {
    this.onUnmountCalled = true;
  }

  onUpdate(): void {
    this.onUpdateCalled = true;
  }

  // Expose protected methods for testing
  public testCreateElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: Parameters<typeof this.createElement>[1]
  ): HTMLElementTagNameMap[K] {
    return this.createElement(tagName, options);
  }

  public testEmit<T>(eventName: string, detail?: T): boolean {
    return this.emit(eventName, detail);
  }

  public testSafeTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    return this.safeTimeout(callback, delay);
  }

  public testClearSafeTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    this.clearSafeTimeout(timeoutId);
  }

  public testSafeAsync<T>(operation: () => Promise<T>): Promise<T | null> {
    return this.safeAsync(operation);
  }

  public getListenerCount(): number {
    return this.listeners.size;
  }

  public triggerRenderError(): void {
    this.handleRenderError(new Error('Manually triggered error'));
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseComponent', () => {
  let container: HTMLElement;
  let component: TestComponent | null;

  beforeEach(() => {
    container = createTestContainer();
    component = null;
  });

  afterEach(() => {
    if (component) {
      try {
        component.destroy();
      } catch {
        // Ignore errors during cleanup
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should call renderContent and bindEvents on init()', () => {
      component = new TestComponent(container);
      component.init();

      expect(component.renderCallCount).toBe(1);
      expect(component.bindEventsCallCount).toBe(1);
    });

    it('should call onMount hook after initialization', () => {
      component = new TestComponent(container);

      expect(component.onMountCalled).toBe(false);

      component.init();

      expect(component.onMountCalled).toBe(true);
    });

    it('should return this from init() for chaining', () => {
      component = new TestComponent(container);
      const result = component.init();

      expect(result).toBe(component);
    });

    it('should prevent double initialization', () => {
      component = new TestComponent(container);
      component.init();
      component.init(); // Second call should be a no-op

      expect(component.renderCallCount).toBe(1);
    });

    it('should unbind events before re-render in update()', () => {
      component = new TestComponent(container);
      component.init();

      const initialListenerCount = component.getListenerCount();
      expect(initialListenerCount).toBeGreaterThan(0);

      component.update();

      // After update, listener count should be same (unbound then rebound)
      expect(component.getListenerCount()).toBe(initialListenerCount);
      expect(component.renderCallCount).toBe(2);
      expect(component.bindEventsCallCount).toBe(2);
    });

    it('should call onUpdate hook after update()', () => {
      component = new TestComponent(container);
      component.init();

      expect(component.onUpdateCalled).toBe(false);

      component.update();

      expect(component.onUpdateCalled).toBe(true);
    });

    it('should not update if not initialized', () => {
      component = new TestComponent(container);
      component.update(); // Should be a no-op

      expect(component.renderCallCount).toBe(0);
    });

    it('should clean up timers and events on destroy()', () => {
      component = new TestComponent(container);
      component.init();

      // Create a timeout that would fire later
      component.testSafeTimeout(() => {}, 10000);

      expect(component.getListenerCount()).toBeGreaterThan(0);

      component.destroy();

      expect(component.getListenerCount()).toBe(0);
    });

    it('should call onUnmount hook on destroy()', () => {
      component = new TestComponent(container);
      component.init();

      expect(component.onUnmountCalled).toBe(false);

      component.destroy();

      expect(component.onUnmountCalled).toBe(true);
    });

    it('should prevent operations on destroyed component', () => {
      component = new TestComponent(container);
      component.init();
      component.destroy();

      // Second destroy should be a no-op
      component.destroy();

      expect(component.onUnmountCalled).toBe(true);
    });

    it('should remove element from DOM on destroy()', () => {
      component = new TestComponent(container);
      component.init();

      expect(container.querySelector('.test-component')).not.toBeNull();

      component.destroy();

      expect(container.querySelector('.test-component')).toBeNull();
    });
  });

  // ============================================================================
  // DOM Creation Tests
  // ============================================================================

  describe('DOM Creation', () => {
    beforeEach(() => {
      component = new TestComponent(container);
      component.init();
    });

    it('should create elements with className', () => {
      const el = component!.testCreateElement('div', { className: 'my-class' });

      expect(el.className).toBe('my-class');
    });

    it('should create elements with id', () => {
      const el = component!.testCreateElement('div', { id: 'my-id' });

      expect(el.id).toBe('my-id');
    });

    it('should create elements with textContent', () => {
      const el = component!.testCreateElement('span', { textContent: 'Hello World' });

      expect(el.textContent).toBe('Hello World');
    });

    it('should create elements with innerHTML for static SVG icons', () => {
      const svgIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      const el = component!.testCreateElement('div', { innerHTML: svgIcon });

      // Browser normalizes self-closing tags, so check structure instead of exact match
      const svg = el.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.querySelector('circle')).not.toBeNull();
    });

    it('should create elements with custom attributes', () => {
      const el = component!.testCreateElement('button', {
        attributes: {
          type: 'submit',
          disabled: '',
          'aria-label': 'Submit form',
        },
      });

      expect(el.getAttribute('type')).toBe('submit');
      expect(el.hasAttribute('disabled')).toBe(true);
      expect(el.getAttribute('aria-label')).toBe('Submit form');
    });

    it('should create elements with data attributes', () => {
      const el = component!.testCreateElement('div', {
        dataAttributes: {
          testId: 'my-test',
          value: '123',
        },
      });

      expect(el.dataset.testId).toBe('my-test');
      expect(el.dataset.value).toBe('123');
    });

    it('should create different element types', () => {
      const div = component!.testCreateElement('div');
      const span = component!.testCreateElement('span');
      const button = component!.testCreateElement('button');
      const input = component!.testCreateElement('input');

      expect(div.tagName).toBe('DIV');
      expect(span.tagName).toBe('SPAN');
      expect(button.tagName).toBe('BUTTON');
      expect(input.tagName).toBe('INPUT');
    });
  });

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('Event Handling', () => {
    it('should bind events with correct context', () => {
      component = new TestComponent(container);
      component.init();

      const eventSpy = spyOnCustomEvent(container, 'test-click');
      const button = container.querySelector('.test-button');

      click(button);

      expect(eventSpy).toHaveBeenCalledWith({ source: 'button' });
    });

    it('should emit custom events', () => {
      component = new TestComponent(container);
      component.init();

      const eventSpy = spyOnCustomEvent(container, 'custom-event');

      component.testEmit('custom-event', { data: 'test' });

      expect(eventSpy).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should emit events without detail', () => {
      component = new TestComponent(container);
      component.init();

      const eventSpy = spyOnCustomEvent(container, 'simple-event');

      component.testEmit('simple-event');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should track listener count', () => {
      component = new TestComponent(container);

      expect(component.getListenerCount()).toBe(0);

      component.init();

      expect(component.getListenerCount()).toBeGreaterThan(0);
    });

    it('should unbind all events on destroy', () => {
      component = new TestComponent(container);
      component.init();

      component.destroy();

      expect(component.getListenerCount()).toBe(0);
    });
  });

  // ============================================================================
  // Timer Management Tests
  // ============================================================================

  describe('Timer Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should execute safeTimeout callback after delay', () => {
      component = new TestComponent(container);
      component.init();

      const callback = vi.fn();
      component.testSafeTimeout(callback, 1000);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not execute callback on destroyed component', () => {
      component = new TestComponent(container);
      component.init();

      const callback = vi.fn();
      component.testSafeTimeout(callback, 1000);

      component.destroy();
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear specific timeout', () => {
      component = new TestComponent(container);
      component.init();

      const callback = vi.fn();
      const timeoutId = component.testSafeTimeout(callback, 1000);

      component.testClearSafeTimeout(timeoutId);
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear all timeouts on destroy', () => {
      component = new TestComponent(container);
      component.init();

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      component.testSafeTimeout(callback1, 1000);
      component.testSafeTimeout(callback2, 2000);

      component.destroy();
      vi.advanceTimersByTime(3000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Boundary Tests
  // ============================================================================

  describe('Error Boundary', () => {
    it('should catch render errors and show fallback UI', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      expect(component.hasErrorState()).toBe(true);
      expect(container.querySelector('.component-error-boundary')).not.toBeNull();
    });

    it('should display error message in fallback UI', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      const errorDetails = container.querySelector('.component-error-details');
      expect(errorDetails?.textContent).toContain('Test render error');
    });

    it('should show retry button in error state', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      const retryBtn = container.querySelector('[data-action="retry"]');
      expect(retryBtn).not.toBeNull();
    });

    it('should show reset button in error state', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      const resetBtn = container.querySelector('[data-action="reset"]');
      expect(resetBtn).not.toBeNull();
    });

    it('should retry render on retry button click', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      // Now fix the error and retry
      component.shouldThrowOnRender = false;
      const retryBtn = container.querySelector<HTMLButtonElement>('[data-action="retry"]');
      click(retryBtn);

      expect(component.hasErrorState()).toBe(false);
      expect(container.querySelector('.test-component')).not.toBeNull();
    });

    it('should track retry count', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      // Retry multiple times (still failing)
      for (let i = 0; i < 2; i++) {
        const retryBtn = container.querySelector<HTMLButtonElement>('[data-action="retry"]');
        click(retryBtn);
      }

      // Check for retry info display
      const retryInfo = container.querySelector('.component-error-retry-info');
      expect(retryInfo).not.toBeNull();
    });

    it('should hide retry button after max retries', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      // Retry max times (3)
      for (let i = 0; i < 3; i++) {
        const retryBtn = container.querySelector<HTMLButtonElement>('[data-action="retry"]');
        if (retryBtn) click(retryBtn);
      }

      const retryBtn = container.querySelector('[data-action="retry"]');
      expect(retryBtn).toBeNull();
    });

    it('should reset component on reset button click', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      // Fix error and reset
      component.shouldThrowOnRender = false;
      const resetBtn = container.querySelector<HTMLButtonElement>('[data-action="reset"]');
      click(resetBtn);

      expect(component.hasErrorState()).toBe(false);
      expect(container.querySelector('.test-component')).not.toBeNull();
    });

    it('should clear error state on successful render after retry', () => {
      component = new TestComponent(container);
      component.shouldThrowOnRender = true;

      component.init();

      expect(component.hasErrorState()).toBe(true);

      // Fix and retry
      component.shouldThrowOnRender = false;
      const retryBtn = container.querySelector<HTMLButtonElement>('[data-action="retry"]');
      click(retryBtn);

      expect(component.hasErrorState()).toBe(false);
      expect(component.getError()).toBeNull();
    });

    it('should wrap async operations with safeAsync()', async () => {
      component = new TestComponent(container);
      component.init();

      const result = await component.testSafeAsync(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should catch errors in safeAsync() and show error UI', async () => {
      component = new TestComponent(container);
      component.init();

      const result = await component.testSafeAsync(async () => {
        throw new Error('Async error');
      });

      expect(result).toBeNull();
      expect(component.hasErrorState()).toBe(true);
    });
  });

  // ============================================================================
  // Visibility Tests
  // ============================================================================

  describe('Visibility', () => {
    beforeEach(() => {
      component = new TestComponent(container);
      component.init();
    });

    it('should hide component', () => {
      component!.hide();

      expect(component!.isVisible()).toBe(false);
    });

    it('should show hidden component', () => {
      component!.hide();
      component!.show();

      expect(component!.isVisible()).toBe(true);
    });

    it('should report visibility correctly', () => {
      expect(component!.isVisible()).toBe(true);

      component!.hide();

      expect(component!.isVisible()).toBe(false);
    });
  });

  // ============================================================================
  // Debug Info Tests
  // ============================================================================

  describe('Debug Info', () => {
    it('should return debug info object', () => {
      component = new TestComponent(container);
      component.init();

      const debugInfo = component.getDebugInfo();

      expect(debugInfo).toHaveProperty('name', 'TestComponent');
      expect(debugInfo).toHaveProperty('initialized', true);
      expect(debugInfo).toHaveProperty('destroyed', false);
      expect(debugInfo).toHaveProperty('listeners');
    });

    it('should log debug info without errors', () => {
      component = new TestComponent(container);
      component.init();

      expect(() => component!.debug()).not.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle missing element gracefully for visibility methods', () => {
      component = new TestComponent(container);
      // Don't init - element will be null

      expect(() => component!.show()).not.toThrow();
      expect(() => component!.hide()).not.toThrow();
      expect(component!.isVisible()).toBe(false);
    });

    it('should handle empty container', () => {
      const emptyContainer = document.createElement('div');
      component = new TestComponent(emptyContainer);

      expect(() => component!.init()).not.toThrow();
    });
  });
});
