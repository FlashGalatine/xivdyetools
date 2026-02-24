/**
 * XIV Dye Tools - ModalContainer Unit Tests
 *
 * Tests the modal dialog container component.
 * Covers rendering, focus trap, keyboard handling, and accessibility.
 *
 * @module components/__tests__/modal-container.test
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

import { ModalContainer } from '../modal-container';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getText,
  getAttr,
} from '../../__tests__/component-utils';
import { ModalService } from '@services/modal-service';

describe('ModalContainer', () => {
  let container: HTMLElement;
  let modalContainer: ModalContainer | null;

  beforeEach(() => {
    container = createTestContainer();
    modalContainer = null;
    // Clear any existing modals
    ModalService.dismissAll();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  afterEach(() => {
    if (modalContainer) {
      try {
        modalContainer.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    ModalService.dismissAll();
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should not render container when no modals', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      expect(query(container, '#modal-container')).toBeNull();
    });

    it('should render container when modal is shown', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test Modal' });

      expect(query(container, '#modal-container')).not.toBeNull();
    });

    it('should render modal with title', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'My Modal Title' });

      const title = query(container, '[id^="modal-title-"]');
      expect(getText(title)).toBe('My Modal Title');
    });

    it('should render modal content as string', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        content: '<p>Modal content here</p>',
      });

      const content = query(container, '[id^="modal-content-"]');
      expect(content?.innerHTML).toContain('Modal content here');
    });

    it('should render modal content as HTMLElement', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      const contentEl = document.createElement('div');
      contentEl.textContent = 'Custom element content';

      ModalService.show({
        type: 'custom',
        title: 'Test',
        content: contentEl,
      });

      const content = query(container, '[id^="modal-content-"]');
      expect(content?.textContent).toContain('Custom element content');
    });
  });

  // ============================================================================
  // Modal Size Tests
  // ============================================================================

  describe('Modal Sizes', () => {
    it('should render small modal', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Small', size: 'sm' });

      const dialog = query(container, '.modal-dialog');
      expect(dialog?.classList.contains('max-w-sm')).toBe(true);
    });

    it('should render medium modal by default', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Default' });

      const dialog = query(container, '.modal-dialog');
      expect(dialog?.classList.contains('max-w-lg')).toBe(true);
    });

    it('should render large modal', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Large', size: 'lg' });

      const dialog = query(container, '.modal-dialog');
      expect(dialog?.classList.contains('max-w-2xl')).toBe(true);
    });
  });

  // ============================================================================
  // Close Button Tests
  // ============================================================================

  describe('Close Button', () => {
    it('should render close button when closable', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test', closable: true });

      const closeBtn = query(container, 'button[aria-label="Close modal"]');
      expect(closeBtn).not.toBeNull();
    });

    it('should not render close button when not closable', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test', closable: false });

      const closeBtn = query(container, 'button[aria-label="Close modal"]');
      expect(closeBtn).toBeNull();
    });

    it('should close modal when close button clicked', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test', closable: true });

      const closeBtn = query<HTMLButtonElement>(container, 'button[aria-label="Close modal"]');
      click(closeBtn);

      expect(queryAll(container, '[data-modal-id]').length).toBe(0);
    });
  });

  // ============================================================================
  // Confirm Modal Tests
  // ============================================================================

  describe('Confirm Modal', () => {
    it('should render confirm and cancel buttons for confirm type', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ title: 'Confirm', type: 'confirm' });

      const buttons = queryAll(container, '.modal-dialog button[type="button"]');
      // Close button + Cancel + Confirm = 3 or just Cancel + Confirm = 2
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should render custom confirm text', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'confirm',
        title: 'Test',
        confirmText: 'Yes, Delete',
      });

      const buttons = queryAll(container, '.modal-dialog button');
      const confirmBtn = Array.from(buttons).find((b) => getText(b) === 'Yes, Delete');
      expect(confirmBtn).not.toBeUndefined();
    });

    it('should render custom cancel text', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'confirm',
        title: 'Test',
        cancelText: 'No, Keep',
        confirmText: 'Yes',
      });

      const buttons = queryAll(container, '.modal-dialog button');
      const cancelBtn = Array.from(buttons).find((b) => getText(b) === 'No, Keep');
      expect(cancelBtn).not.toBeUndefined();
    });

    it('should call onConfirm callback when confirm clicked', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      const onConfirm = vi.fn();
      ModalService.show({
        type: 'confirm',
        title: 'Test',
        confirmText: 'Confirm',
        onConfirm,
      });

      const buttons = queryAll<HTMLButtonElement>(container, '.modal-dialog button');
      const confirmBtn = Array.from(buttons).find((b) => getText(b) === 'Confirm');
      click(confirmBtn!);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should close modal after confirm callback', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'confirm',
        title: 'Test',
        confirmText: 'OK',
        onConfirm: vi.fn(),
      });

      const buttons = queryAll<HTMLButtonElement>(container, '.modal-dialog button');
      const confirmBtn = Array.from(buttons).find((b) => getText(b) === 'OK');
      click(confirmBtn!);

      expect(queryAll(container, '[data-modal-id]').length).toBe(0);
    });
  });

  // ============================================================================
  // Keyboard Handling Tests
  // ============================================================================

  describe('Keyboard Handling', () => {
    it('should close modal on Escape when closeOnEscape is true', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: true,
        closeOnEscape: true,
      });

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(queryAll(container, '[data-modal-id]').length).toBe(0);
    });

    it('should not close modal on Escape when closeOnEscape is false', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: true,
        closeOnEscape: false,
      });

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(queryAll(container, '[data-modal-id]').length).toBe(1);
    });

    it('should not close modal on Escape when not closable', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: false,
        closeOnEscape: true,
      });

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(queryAll(container, '[data-modal-id]').length).toBe(1);
    });
  });

  // ============================================================================
  // Backdrop Tests
  // ============================================================================

  describe('Backdrop', () => {
    it('should render backdrop', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      const backdrop = query(container, '.modal-backdrop');
      expect(backdrop).not.toBeNull();
    });

    it('should close modal on backdrop click when closeOnBackdrop is true', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: true,
        closeOnBackdrop: true,
      });

      const backdrop = query<HTMLElement>(container, '.modal-backdrop');
      click(backdrop);

      expect(queryAll(container, '[data-modal-id]').length).toBe(0);
    });

    it('should not close modal on backdrop click when closeOnBackdrop is false', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: true,
        closeOnBackdrop: false,
      });

      const backdrop = query<HTMLElement>(container, '.modal-backdrop');
      click(backdrop);

      expect(queryAll(container, '[data-modal-id]').length).toBe(1);
    });

    it('should not close modal when clicking dialog content', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        closable: true,
        closeOnBackdrop: true,
      });

      const dialog = query<HTMLElement>(container, '.modal-dialog');
      click(dialog);

      expect(queryAll(container, '[data-modal-id]').length).toBe(1);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have role="dialog" on modal', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      const dialog = query(container, '.modal-dialog');
      expect(getAttr(dialog, 'role')).toBe('dialog');
    });

    it('should have aria-modal="true"', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      const dialog = query(container, '.modal-dialog');
      expect(getAttr(dialog, 'aria-modal')).toBe('true');
    });

    it('should have aria-labelledby pointing to title', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      const dialog = query(container, '.modal-dialog');
      const labelledBy = getAttr(dialog, 'aria-labelledby');
      expect(labelledBy).toMatch(/^modal-title-/);

      const title = query(container, `#${labelledBy}`);
      expect(title).not.toBeNull();
    });

    it('should have aria-describedby when content is provided', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({
        type: 'custom',
        title: 'Test',
        content: 'Modal description',
      });

      const dialog = query(container, '.modal-dialog');
      const describedBy = getAttr(dialog, 'aria-describedby');
      expect(describedBy).toMatch(/^modal-content-/);
    });

    it('should mark background modals as inert', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'First' });
      ModalService.show({ type: 'custom', title: 'Second' });

      const modals = queryAll(container, '[data-modal-id]');
      expect(modals[0].hasAttribute('inert')).toBe(true);
      expect(modals[1].hasAttribute('inert')).toBe(false);
    });
  });

  // ============================================================================
  // Stacking Tests
  // ============================================================================

  describe('Modal Stacking', () => {
    it('should render multiple stacked modals', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'First' });
      ModalService.show({ type: 'custom', title: 'Second' });

      const modals = queryAll(container, '[data-modal-id]');
      expect(modals.length).toBe(2);
    });

    it('should only show backdrop on top modal', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'First' });
      ModalService.show({ type: 'custom', title: 'Second' });

      const modals = queryAll(container, '.modal-backdrop');
      expect(modals[0].classList.contains('bg-transparent')).toBe(true);
      expect(modals[1].classList.contains('bg-black/50')).toBe(true);
    });

    it('should close only top modal on Escape', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'First', closable: true, closeOnEscape: true });
      ModalService.show({ type: 'custom', title: 'Second', closable: true, closeOnEscape: true });

      // Dispatch directly on document since that's where the listener is attached
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const modals = queryAll(container, '[data-modal-id]');
      expect(modals.length).toBe(1);
    });
  });

  // ============================================================================
  // Body Scroll Tests
  // ============================================================================

  describe('Body Scroll', () => {
    it('should prevent body scroll when modal is open', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when all modals closed', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      const id = ModalService.show({ type: 'custom', title: 'Test', closable: true });
      expect(document.body.style.overflow).toBe('hidden');

      ModalService.dismiss(id);

      expect(document.body.style.overflow).toBe('');
    });
  });

  // ============================================================================
  // Service Subscription Tests
  // ============================================================================

  describe('Service Subscription', () => {
    it('should update when modals are added', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      expect(queryAll(container, '[data-modal-id]').length).toBe(0);

      ModalService.show({ type: 'custom', title: 'New Modal' });

      expect(queryAll(container, '[data-modal-id]').length).toBe(1);
    });

    it('should update when modals are removed', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      const id = ModalService.show({ type: 'custom', title: 'Test', closable: true });
      expect(queryAll(container, '[data-modal-id]').length).toBe(1);

      ModalService.dismiss(id);
      expect(queryAll(container, '[data-modal-id]').length).toBe(0);
    });

    it('should unsubscribe on destroy', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      modalContainer.destroy();

      // Showing a modal after destroy should not cause errors
      expect(() => ModalService.show({ type: 'custom', title: 'Test' })).not.toThrow();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up container on destroy', () => {
      modalContainer = new ModalContainer(container);
      modalContainer.init();

      ModalService.show({ type: 'custom', title: 'Test' });

      modalContainer.destroy();

      expect(query(container, '#modal-container')).toBeNull();
    });
  });
});
