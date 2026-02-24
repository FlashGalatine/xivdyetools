/**
 * XIV Dye Tools - ToastContainer Unit Tests
 *
 * Tests the toast notification container component.
 * Covers rendering, service subscription, keyboard handling, and accessibility.
 *
 * @module components/__tests__/toast-container.test
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

import { ToastContainer } from '../toast-container';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getText,
  getAttr,
} from '../../__tests__/component-utils';
import { ToastService } from '@services/toast-service';

describe('ToastContainer', () => {
  let container: HTMLElement;
  let toastContainer: ToastContainer | null;

  beforeEach(() => {
    container = createTestContainer();
    toastContainer = null;
    // Clear any existing toasts
    ToastService.dismissAll();
  });

  afterEach(() => {
    if (toastContainer) {
      try {
        toastContainer.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    ToastService.dismissAll();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render container wrapper', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      expect(query(container, '#toast-container')).not.toBeNull();
    });

    it('should have aria-label for notifications', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      const wrapper = query(container, '#toast-container');
      expect(getAttr(wrapper, 'aria-label')).toBe('Notifications');
    });

    it('should render empty when no toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      const toastElements = queryAll(container, '[data-toast-id]');
      expect(toastElements.length).toBe(0);
    });
  });

  // ============================================================================
  // Toast Rendering Tests
  // ============================================================================

  describe('Toast Rendering', () => {
    it('should render toast when added to service', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Hello World');

      const toastElements = queryAll(container, '[data-toast-id]');
      expect(toastElements.length).toBe(1);
    });

    it('should display toast message', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Test notification');

      const messageEl = query(container, '[data-toast-id] p');
      expect(getText(messageEl)).toBe('Test notification');
    });

    it('should display toast details when provided', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Main message', {
        details: 'Additional details here',
      });

      const details = queryAll(container, '[data-toast-id] p');
      expect(details.length).toBe(2);
      expect(getText(details[1])).toBe('Additional details here');
    });

    it('should render multiple toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Toast 1');
      ToastService.show('Toast 2');
      ToastService.show('Toast 3');

      const toastElements = queryAll(container, '[data-toast-id]');
      expect(toastElements.length).toBe(3);
    });

    it('should render toast icon', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Test');

      const icon = query(container, '[data-toast-id] svg.toast-icon');
      expect(icon).not.toBeNull();
    });
  });

  // ============================================================================
  // Toast Types Tests
  // ============================================================================

  describe('Toast Types', () => {
    it('should render success toast with correct styling', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.success('Success!');

      const toast = query(container, '[data-toast-id]');
      expect(toast?.classList.contains('toast-success')).toBe(true);
    });

    it('should render error toast with correct styling', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!');

      const toast = query(container, '[data-toast-id]');
      expect(toast?.classList.contains('toast-error')).toBe(true);
    });

    it('should render warning toast with correct styling', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.warning('Warning!');

      const toast = query(container, '[data-toast-id]');
      expect(toast?.classList.contains('toast-warning')).toBe(true);
    });

    it('should render info toast with correct styling', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.info('Info!');

      const toast = query(container, '[data-toast-id]');
      expect(toast?.classList.contains('toast-info')).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should use role="alert" for error toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!');

      const toast = query(container, '[data-toast-id]');
      expect(getAttr(toast, 'role')).toBe('alert');
      expect(getAttr(toast, 'aria-live')).toBe('assertive');
    });

    it('should use role="alert" for warning toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.warning('Warning!');

      const toast = query(container, '[data-toast-id]');
      expect(getAttr(toast, 'role')).toBe('alert');
      expect(getAttr(toast, 'aria-live')).toBe('assertive');
    });

    it('should use role="status" for success toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.success('Success!');

      const toast = query(container, '[data-toast-id]');
      expect(getAttr(toast, 'role')).toBe('status');
      expect(getAttr(toast, 'aria-live')).toBe('polite');
    });

    it('should use role="status" for info toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.info('Info!');

      const toast = query(container, '[data-toast-id]');
      expect(getAttr(toast, 'role')).toBe('status');
      expect(getAttr(toast, 'aria-live')).toBe('polite');
    });
  });

  // ============================================================================
  // Dismiss Functionality Tests
  // ============================================================================

  describe('Dismiss Functionality', () => {
    it('should render dismiss button for dismissible toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!'); // Errors are dismissible by default

      const dismissBtn = query(
        container,
        '[data-toast-id] button[aria-label="Dismiss notification"]'
      );
      expect(dismissBtn).not.toBeNull();
    });

    it('should not render dismiss button for non-dismissible toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.info('Info'); // Info toasts are not dismissible by default

      const dismissBtn = query(
        container,
        '[data-toast-id] button[aria-label="Dismiss notification"]'
      );
      expect(dismissBtn).toBeNull();
    });

    it('should dismiss toast when dismiss button clicked', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!');

      const dismissBtn = query<HTMLButtonElement>(
        container,
        '[data-toast-id] button[aria-label="Dismiss notification"]'
      );
      click(dismissBtn);

      const toasts = queryAll(container, '[data-toast-id]');
      expect(toasts.length).toBe(0);
    });

    it('should dismiss dismissible toast on Escape key', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!'); // Dismissible

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const toasts = queryAll(container, '[data-toast-id]');
      expect(toasts.length).toBe(0);
    });

    it('should not dismiss non-dismissible toast on Escape key', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.info('Info'); // Not dismissible

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const toasts = queryAll(container, '[data-toast-id]');
      expect(toasts.length).toBe(1);
    });
  });

  // ============================================================================
  // Service Subscription Tests
  // ============================================================================

  describe('Service Subscription', () => {
    it('should update when toasts are added', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      expect(queryAll(container, '[data-toast-id]').length).toBe(0);

      ToastService.show('New toast');

      expect(queryAll(container, '[data-toast-id]').length).toBe(1);
    });

    it('should update when toasts are removed', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      const id = ToastService.show('Toast', { duration: 0 }); // Persistent

      expect(queryAll(container, '[data-toast-id]').length).toBe(1);

      ToastService.dismiss(id);

      expect(queryAll(container, '[data-toast-id]').length).toBe(0);
    });

    it('should unsubscribe on destroy', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      toastContainer.destroy();

      // Showing a toast after destroy should not cause errors
      expect(() => ToastService.show('Test')).not.toThrow();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.show('Test');

      toastContainer.destroy();

      expect(query(container, '#toast-container')).toBeNull();
    });
  });
});
