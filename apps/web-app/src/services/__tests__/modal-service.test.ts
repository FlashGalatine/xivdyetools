/**
 * XIV Dye Tools - ModalService Unit Tests
 * Tests for modal dialog system
 */

import { ModalService, type ModalConfig, type Modal } from '../modal-service';

describe('ModalService', () => {
  beforeEach(() => {
    // Clear all modals before each test
    ModalService.dismissAll();
  });

  afterEach(() => {
    ModalService.dismissAll();
  });

  // ============================================================================
  // Show Modal Tests
  // ============================================================================

  describe('show', () => {
    it('should show a modal and return an ID', () => {
      const config: ModalConfig = {
        type: 'custom',
        title: 'Test Modal',
      };

      const id = ModalService.show(config);

      expect(id).toBeDefined();
      expect(id).toContain('modal_');
      expect(ModalService.hasOpenModals()).toBe(true);
    });

    it('should create modal with default values', () => {
      const config: ModalConfig = {
        type: 'custom',
        title: 'Test Modal',
      };

      const id = ModalService.show(config);
      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.size).toBe('md');
      expect(modal?.closable).toBe(true);
      expect(modal?.closeOnBackdrop).toBe(true);
      expect(modal?.closeOnEscape).toBe(true);
    });

    it('should respect custom configuration', () => {
      const config: ModalConfig = {
        type: 'custom',
        title: 'Test Modal',
        size: 'lg',
        closable: false,
        closeOnBackdrop: false,
        closeOnEscape: false,
      };

      const id = ModalService.show(config);
      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.size).toBe('lg');
      expect(modal?.closable).toBe(false);
      expect(modal?.closeOnBackdrop).toBe(false);
      expect(modal?.closeOnEscape).toBe(false);
    });

    it('should add timestamp to modal', () => {
      const before = Date.now();
      const id = ModalService.show({ type: 'custom', title: 'Test' });
      const after = Date.now();

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.timestamp).toBeGreaterThanOrEqual(before);
      expect(modal?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should enforce maximum modal limit', () => {
      const onClose = vi.fn();

      // Show 4 modals (max is 3)
      ModalService.show({ type: 'custom', title: 'Modal 1', onClose });
      ModalService.show({ type: 'custom', title: 'Modal 2' });
      ModalService.show({ type: 'custom', title: 'Modal 3' });
      ModalService.show({ type: 'custom', title: 'Modal 4' });

      const modals = ModalService.getModals();
      expect(modals.length).toBe(3);

      // First modal should have been removed and onClose called
      expect(onClose).toHaveBeenCalled();
      expect(modals.some((m) => m.title === 'Modal 1')).toBe(false);
    });
  });

  // ============================================================================
  // Convenience Method Tests
  // ============================================================================

  describe('showWelcome', () => {
    it('should show a welcome modal', () => {
      const id = ModalService.showWelcome({ title: 'Welcome!' });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.type).toBe('welcome');
      expect(modal?.title).toBe('Welcome!');
    });
  });

  describe('showChangelog', () => {
    it('should show a changelog modal', () => {
      const id = ModalService.showChangelog({ title: "What's New" });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.type).toBe('changelog');
      expect(modal?.title).toBe("What's New");
    });
  });

  describe('showConfirm', () => {
    it('should show a confirm modal with defaults', () => {
      const id = ModalService.showConfirm({ title: 'Confirm Action' });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.type).toBe('confirm');
      expect(modal?.closable).toBe(false);
      expect(modal?.closeOnBackdrop).toBe(false);
    });

    it('should allow overriding confirm defaults', () => {
      const id = ModalService.showConfirm({
        title: 'Confirm Action',
        closable: true,
        closeOnBackdrop: true,
      });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.closable).toBe(true);
      expect(modal?.closeOnBackdrop).toBe(true);
    });
  });

  // ============================================================================
  // Dismiss Tests
  // ============================================================================

  describe('dismiss', () => {
    it('should dismiss a modal by ID', () => {
      const id = ModalService.show({ type: 'custom', title: 'Test' });
      expect(ModalService.hasOpenModals()).toBe(true);

      ModalService.dismiss(id);
      expect(ModalService.hasOpenModals()).toBe(false);
    });

    it('should call onClose callback when dismissed', () => {
      const onClose = vi.fn();
      const id = ModalService.show({ type: 'custom', title: 'Test', onClose });

      ModalService.dismiss(id);

      expect(onClose).toHaveBeenCalled();
    });

    it('should do nothing for non-existent modal ID', () => {
      ModalService.show({ type: 'custom', title: 'Test' });

      expect(() => {
        ModalService.dismiss('non-existent-id');
      }).not.toThrow();

      expect(ModalService.getModals().length).toBe(1);
    });
  });

  describe('dismissTop', () => {
    it('should dismiss the topmost modal', () => {
      ModalService.show({ type: 'custom', title: 'Modal 1' });
      ModalService.show({ type: 'custom', title: 'Modal 2' });

      expect(ModalService.getModals().length).toBe(2);

      ModalService.dismissTop();

      const modals = ModalService.getModals();
      expect(modals.length).toBe(1);
      expect(modals[0].title).toBe('Modal 1');
    });

    it('should do nothing when no modals are open', () => {
      expect(() => {
        ModalService.dismissTop();
      }).not.toThrow();
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all modals', () => {
      ModalService.show({ type: 'custom', title: 'Modal 1' });
      ModalService.show({ type: 'custom', title: 'Modal 2' });
      ModalService.show({ type: 'custom', title: 'Modal 3' });

      expect(ModalService.getModals().length).toBe(3);

      ModalService.dismissAll();

      expect(ModalService.getModals().length).toBe(0);
      expect(ModalService.hasOpenModals()).toBe(false);
    });

    it('should call onClose for each modal', () => {
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();

      ModalService.show({ type: 'custom', title: 'Modal 1', onClose: onClose1 });
      ModalService.show({ type: 'custom', title: 'Modal 2', onClose: onClose2 });

      ModalService.dismissAll();

      expect(onClose1).toHaveBeenCalled();
      expect(onClose2).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Getter Tests
  // ============================================================================

  describe('getModals', () => {
    it('should return a copy of modals array', () => {
      ModalService.show({ type: 'custom', title: 'Test' });

      const modals1 = ModalService.getModals();
      const modals2 = ModalService.getModals();

      expect(modals1).not.toBe(modals2);
      expect(modals1).toEqual(modals2);
    });

    it('should return empty array when no modals', () => {
      const modals = ModalService.getModals();
      expect(modals).toEqual([]);
    });
  });

  describe('getTopModal', () => {
    it('should return the topmost modal', () => {
      ModalService.show({ type: 'custom', title: 'Modal 1' });
      ModalService.show({ type: 'custom', title: 'Modal 2' });

      const top = ModalService.getTopModal();

      expect(top?.title).toBe('Modal 2');
    });

    it('should return null when no modals', () => {
      const top = ModalService.getTopModal();
      expect(top).toBeNull();
    });
  });

  describe('hasOpenModals', () => {
    it('should return true when modals are open', () => {
      ModalService.show({ type: 'custom', title: 'Test' });
      expect(ModalService.hasOpenModals()).toBe(true);
    });

    it('should return false when no modals are open', () => {
      expect(ModalService.hasOpenModals()).toBe(false);
    });
  });

  // ============================================================================
  // Subscription Tests
  // ============================================================================

  describe('subscribe', () => {
    it('should notify subscriber immediately with current state', () => {
      ModalService.show({ type: 'custom', title: 'Test' });

      const listener = vi.fn();
      const unsubscribe = ModalService.subscribe(listener);

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Test' })])
      );

      unsubscribe();
    });

    it('should notify subscriber when modal is shown', () => {
      const listener = vi.fn();
      const unsubscribe = ModalService.subscribe(listener);

      listener.mockClear(); // Clear initial call

      ModalService.show({ type: 'custom', title: 'New Modal' });

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'New Modal' })])
      );

      unsubscribe();
    });

    it('should notify subscriber when modal is dismissed', () => {
      const id = ModalService.show({ type: 'custom', title: 'Test' });

      const listener = vi.fn();
      const unsubscribe = ModalService.subscribe(listener);

      listener.mockClear(); // Clear initial call

      ModalService.dismiss(id);

      expect(listener).toHaveBeenCalledWith([]);

      unsubscribe();
    });

    it('should unsubscribe properly', () => {
      const listener = vi.fn();
      const unsubscribe = ModalService.subscribe(listener);

      listener.mockClear();
      unsubscribe();

      ModalService.show({ type: 'custom', title: 'Test' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = ModalService.subscribe(listener1);
      const unsub2 = ModalService.subscribe(listener2);

      listener1.mockClear();
      listener2.mockClear();

      ModalService.show({ type: 'custom', title: 'Test' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      unsub1();
      unsub2();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('prefersReducedMotion', () => {
    it('should return boolean value', () => {
      const result = ModalService.prefersReducedMotion();
      expect(typeof result).toBe('boolean');
    });
  });

  // ============================================================================
  // Content Tests
  // ============================================================================

  describe('Modal Content', () => {
    it('should support string content', () => {
      const id = ModalService.show({
        type: 'custom',
        title: 'Test',
        content: 'This is the content',
      });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.content).toBe('This is the content');
    });

    it('should support HTMLElement content', () => {
      const element = document.createElement('div');
      element.textContent = 'Element content';

      const id = ModalService.show({
        type: 'custom',
        title: 'Test',
        content: element,
      });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.content).toBe(element);
    });

    it('should support confirm and cancel text', () => {
      const id = ModalService.show({
        type: 'confirm',
        title: 'Confirm',
        confirmText: 'Yes, delete',
        cancelText: 'No, keep',
      });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.confirmText).toBe('Yes, delete');
      expect(modal?.cancelText).toBe('No, keep');
    });

    it('should support onConfirm callback', () => {
      const onConfirm = vi.fn();

      const id = ModalService.show({
        type: 'confirm',
        title: 'Confirm',
        onConfirm,
      });

      const modals = ModalService.getModals();
      const modal = modals.find((m) => m.id === id);

      expect(modal?.onConfirm).toBe(onConfirm);
    });
  });

  // ============================================================================
  // Size Tests
  // ============================================================================

  describe('Modal Sizes', () => {
    it('should support small size', () => {
      const id = ModalService.show({ type: 'custom', title: 'Small', size: 'sm' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.size).toBe('sm');
    });

    it('should support medium size (default)', () => {
      const id = ModalService.show({ type: 'custom', title: 'Medium' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.size).toBe('md');
    });

    it('should support large size', () => {
      const id = ModalService.show({ type: 'custom', title: 'Large', size: 'lg' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.size).toBe('lg');
    });
  });

  // ============================================================================
  // Modal Types Tests
  // ============================================================================

  describe('Modal Types', () => {
    it('should support welcome type', () => {
      const id = ModalService.show({ type: 'welcome', title: 'Welcome' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.type).toBe('welcome');
    });

    it('should support changelog type', () => {
      const id = ModalService.show({ type: 'changelog', title: 'Changelog' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.type).toBe('changelog');
    });

    it('should support confirm type', () => {
      const id = ModalService.show({ type: 'confirm', title: 'Confirm' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.type).toBe('confirm');
    });

    it('should support custom type', () => {
      const id = ModalService.show({ type: 'custom', title: 'Custom' });
      const modal = ModalService.getModals().find((m) => m.id === id);
      expect(modal?.type).toBe('custom');
    });
  });

  // ============================================================================
  // ID Generation Tests
  // ============================================================================

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = ModalService.show({ type: 'custom', title: 'Modal 1' });
      const id2 = ModalService.show({ type: 'custom', title: 'Modal 2' });
      const id3 = ModalService.show({ type: 'custom', title: 'Modal 3' });

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with modal_ prefix', () => {
      const id = ModalService.show({ type: 'custom', title: 'Test' });
      expect(id.startsWith('modal_')).toBe(true);
    });
  });
});
