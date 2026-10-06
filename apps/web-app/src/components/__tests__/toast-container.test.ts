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
import { ModalService } from '@services/modal-service';
import { ModalContainer } from '../modal-container';

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

      const dismissBtn = query(container, '[data-toast-id] button[aria-label="Dismiss"]');
      expect(dismissBtn).not.toBeNull();
    });

    it('should not render dismiss button for non-dismissible toasts', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.info('Info'); // Info toasts are not dismissible by default

      const dismissBtn = query(container, '[data-toast-id] button[aria-label="Dismiss"]');
      expect(dismissBtn).toBeNull();
    });

    it('should dismiss toast when dismiss button clicked', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();

      ToastService.error('Error!');

      const dismissBtn = query<HTMLButtonElement>(
        container,
        '[data-toast-id] button[aria-label="Dismiss"]'
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
  // One Escape, one layer (BUG-105)
  // ============================================================================

  /**
   * BUG-105: the toast and every overlay each listened for Escape on the
   * document and neither stood aside, so one press closed a toast AND the
   * modal, sheet or popover the user was working in. The overlay holding focus
   * owns Escape; a toast is a passive notice (it times out, and it has its own
   * dismiss button), so it yields — even though it is drawn above the modal
   * layer. Escape reaches the toast only when nothing else wanted it.
   */
  describe('One Escape closes one layer', () => {
    const escape = (target: EventTarget = document): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };

    it('closes only the modal when a modal and a toast are both open', () => {
      const modalRoot = createTestContainer('modal-root-under-test');
      const modals = new ModalContainer(modalRoot);
      modals.init();
      try {
        toastContainer = new ToastContainer(container);
        toastContainer.init();
        ModalService.show({ type: 'custom', title: 'Dialog' });
        // A toast that arrives while the modal is open re-renders the toast
        // container last, so its listener is not simply the later one
        ToastService.error('Error!');

        escape();

        expect(ModalService.getModals()).toHaveLength(0);
        expect(queryAll(container, '[data-toast-id]')).toHaveLength(1);

        // The next Escape, with nothing else open, is the toast's
        escape();
        expect(queryAll(container, '[data-toast-id]')).toHaveLength(0);
      } finally {
        ModalService.dismissAll();
        modals.destroy();
        cleanupTestContainer(modalRoot);
      }
    });

    // The Glamour Reader's export sheet (and any overlay like it) closes on
    // Escape WITHOUT marking the key handled, and releases its registration as
    // it closes. Judged after the fact, the toast would see "nothing open,
    // nothing handled" and close as well; it has to judge by what was open
    // when the key went down.
    it('yields to an overlay that closes on Escape without marking it handled', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      ToastService.error('Error!');
      const release = ModalService.registerExternal();
      const closeSheet = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') release();
      };
      document.addEventListener('keydown', closeSheet);
      try {
        escape();

        expect(ModalService.hasOpenModals()).toBe(false);
        expect(queryAll(container, '[data-toast-id]')).toHaveLength(1);
      } finally {
        document.removeEventListener('keydown', closeSheet);
        release();
      }
    });

    it('yields to a nearer handler that already consumed the Escape', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      ToastService.error('Error!');
      const field = document.createElement('input');
      field.addEventListener('keydown', (event) => event.preventDefault());
      document.body.appendChild(field);
      try {
        escape(field);

        expect(queryAll(container, '[data-toast-id]')).toHaveLength(1);
      } finally {
        field.remove();
      }
    });

    it('still closes the toast when nothing else is open', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      ToastService.error('Error!');

      escape();

      expect(queryAll(container, '[data-toast-id]')).toHaveLength(0);
    });
  });

  // ============================================================================
  // Keyed rendering (BUG-105)
  // ============================================================================

  /**
   * BUG-105: every change cleared the container and rebuilt every toast, so a
   * toast already on screen slid in again (fresh `toast-animate-in`) and, as a
   * brand-new role=alert node, was announced again by screen readers whenever
   * another toast came or went. A toast's node now lives as long as it does.
   */
  describe('Keyed rendering', () => {
    const toastNode = (id: string): HTMLElement | null =>
      query<HTMLElement>(container, `[data-toast-id="${id}"]`);

    it('keeps a showing toast’s node when another toast arrives', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      const first = ToastService.error('First');
      const firstNode = toastNode(first);

      const second = ToastService.error('Second');

      expect(toastNode(first)).toBe(firstNode);
      expect(
        queryAll<HTMLElement>(container, '[data-toast-id]').map((el) => el.dataset.toastId)
      ).toEqual([first, second]);
    });

    it('removes only the toast that went, leaving the others untouched and in order', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      const a = ToastService.error('A');
      const b = ToastService.error('B');
      const c = ToastService.error('C');
      const nodeA = toastNode(a);
      const nodeC = toastNode(c);

      ToastService.dismiss(b);

      expect(toastNode(b)).toBeNull();
      expect(toastNode(a)).toBe(nodeA);
      expect(toastNode(c)).toBe(nodeC);
      expect(
        queryAll<HTMLElement>(container, '[data-toast-id]').map((el) => el.dataset.toastId)
      ).toEqual([a, c]);
    });

    it('keeps the wrapper and its label across changes', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      const wrapper = query(container, '#toast-container');

      ToastService.show('One');
      ToastService.show('Two');

      expect(query(container, '#toast-container')).toBe(wrapper);
      expect(queryAll(container, '#toast-container')).toHaveLength(1);
      expect(getAttr(wrapper, 'aria-label')).toBe('Notifications');
    });

    it('rebuilds cleanly if its content was replaced underneath it', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      ToastService.error('Before');
      container.replaceChildren();

      const after = ToastService.error('After');

      expect(queryAll(container, '#toast-container')).toHaveLength(1);
      expect(queryAll(container, '[data-toast-id]')).toHaveLength(2);
      expect(toastNode(after)).not.toBeNull();
    });

    // The error boundary makes its own panel the component's element. A
    // retry must draw the toasts into a fresh wrapper, not into that panel.
    it('recovers from a render error through Try again', () => {
      toastContainer = new ToastContainer(container);
      toastContainer.init();
      vi.spyOn(
        ToastContainer.prototype as unknown as { createToastElement: () => HTMLElement },
        'createToastElement'
      ).mockImplementationOnce(() => {
        throw new Error('render failed');
      });
      const id = ToastService.error('Survives');
      expect(query(container, '.component-error-boundary')).not.toBeNull();

      click(query(container, '[data-action="retry"]'));

      expect(query(container, '.component-error-boundary')).toBeNull();
      expect(queryAll(container, '#toast-container')).toHaveLength(1);
      expect(query(container, '#toast-container')?.contains(toastNode(id))).toBe(true);
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
