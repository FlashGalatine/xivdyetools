/**
 * XIV Dye Tools - ToastService Unit Tests
 * Tests for toast notification system
 */

import { ToastService, type Toast, type ToastOptions, type ToastType } from '../toast-service';

describe('ToastService', () => {
  beforeEach(() => {
    // Clear all toasts before each test
    ToastService.dismissAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    ToastService.dismissAll();
    vi.useRealTimers();
  });

  // ============================================================================
  // Show Tests
  // ============================================================================

  describe('show', () => {
    it('should show a toast and return an ID', () => {
      const id = ToastService.show('Test message');

      expect(id).toBeDefined();
      expect(id).toContain('toast_');
    });

    it('should create toast with default values', () => {
      const id = ToastService.show('Test message');
      const toasts = ToastService.getToasts();
      const toast = toasts.find((t) => t.id === id);

      expect(toast?.type).toBe('info');
      expect(toast?.message).toBe('Test message');
      expect(toast?.duration).toBe(3000); // info default
      expect(toast?.dismissible).toBe(false);
    });

    it('should respect custom options', () => {
      const id = ToastService.show('Test', {
        type: 'success',
        duration: 5000,
        dismissible: true,
        details: 'More info',
      });

      const toasts = ToastService.getToasts();
      const toast = toasts.find((t) => t.id === id);

      expect(toast?.type).toBe('success');
      expect(toast?.duration).toBe(5000);
      expect(toast?.dismissible).toBe(true);
      expect(toast?.details).toBe('More info');
    });

    it('should add timestamp to toast', () => {
      const before = Date.now();
      const id = ToastService.show('Test');
      const after = Date.now();

      const toasts = ToastService.getToasts();
      const toast = toasts.find((t) => t.id === id);

      expect(toast?.timestamp).toBeGreaterThanOrEqual(before);
      expect(toast?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should enforce maximum visible toasts limit', () => {
      // Show 6 toasts (max is 5)
      ToastService.show('Toast 1');
      ToastService.show('Toast 2');
      ToastService.show('Toast 3');
      ToastService.show('Toast 4');
      ToastService.show('Toast 5');
      ToastService.show('Toast 6');

      const toasts = ToastService.getToasts();
      expect(toasts.length).toBe(5);

      // First toast should have been removed
      expect(toasts.some((t) => t.message === 'Toast 1')).toBe(false);
      expect(toasts.some((t) => t.message === 'Toast 6')).toBe(true);
    });

    it('should auto-dismiss after duration', () => {
      const id = ToastService.show('Auto dismiss', { duration: 1000 });

      expect(ToastService.getToasts().some((t) => t.id === id)).toBe(true);

      vi.advanceTimersByTime(1100);

      expect(ToastService.getToasts().some((t) => t.id === id)).toBe(false);
    });

    it('should not auto-dismiss when duration is 0', () => {
      const id = ToastService.show('Persistent', { duration: 0 });

      vi.advanceTimersByTime(10000);

      expect(ToastService.getToasts().some((t) => t.id === id)).toBe(true);
    });
  });

  // ============================================================================
  // Convenience Method Tests
  // ============================================================================

  describe('success', () => {
    it('should show success toast', () => {
      const id = ToastService.success('Operation successful');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.type).toBe('success');
      expect(toast?.message).toBe('Operation successful');
      expect(toast?.duration).toBe(3000);
    });

    it('should include details when provided', () => {
      const id = ToastService.success('Success', 'Additional details');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.details).toBe('Additional details');
    });
  });

  describe('error', () => {
    it('should show error toast', () => {
      const id = ToastService.error('Something went wrong');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.type).toBe('error');
      expect(toast?.message).toBe('Something went wrong');
      expect(toast?.duration).toBe(5000);
      expect(toast?.dismissible).toBe(true);
    });

    it('should include details when provided', () => {
      const id = ToastService.error('Error', 'Error details');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.details).toBe('Error details');
    });
  });

  describe('warning', () => {
    it('should show warning toast', () => {
      const id = ToastService.warning('Warning message');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.type).toBe('warning');
      expect(toast?.message).toBe('Warning message');
      expect(toast?.duration).toBe(4000);
    });

    it('should include details when provided', () => {
      const id = ToastService.warning('Warning', 'Warning details');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.details).toBe('Warning details');
    });
  });

  describe('info', () => {
    it('should show info toast', () => {
      const id = ToastService.info('Information');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.type).toBe('info');
      expect(toast?.message).toBe('Information');
      expect(toast?.duration).toBe(3000);
    });

    it('should include details when provided', () => {
      const id = ToastService.info('Info', 'Info details');
      const toast = ToastService.getToasts().find((t) => t.id === id);

      expect(toast?.details).toBe('Info details');
    });
  });

  // ============================================================================
  // Dismiss Tests
  // ============================================================================

  describe('dismiss', () => {
    it('should dismiss a toast by ID', () => {
      const id = ToastService.show('Test');
      expect(ToastService.getToasts().length).toBe(1);

      ToastService.dismiss(id);
      expect(ToastService.getToasts().length).toBe(0);
    });

    it('should clear auto-dismiss timer', () => {
      const id = ToastService.show('Test', { duration: 5000 });

      ToastService.dismiss(id);

      // Advance time past original duration
      vi.advanceTimersByTime(6000);

      // Should not throw or cause issues
      expect(ToastService.getToasts().length).toBe(0);
    });

    it('should do nothing for non-existent ID', () => {
      ToastService.show('Test');

      expect(() => {
        ToastService.dismiss('non-existent');
      }).not.toThrow();

      expect(ToastService.getToasts().length).toBe(1);
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all toasts', () => {
      ToastService.show('Toast 1');
      ToastService.show('Toast 2');
      ToastService.show('Toast 3');

      expect(ToastService.getToasts().length).toBe(3);

      ToastService.dismissAll();

      expect(ToastService.getToasts().length).toBe(0);
    });

    it('should clear all timers', () => {
      ToastService.show('Toast 1', { duration: 5000 });
      ToastService.show('Toast 2', { duration: 5000 });

      ToastService.dismissAll();

      vi.advanceTimersByTime(6000);

      // Should not throw or cause issues
      expect(ToastService.getToasts().length).toBe(0);
    });
  });

  // ============================================================================
  // Getter Tests
  // ============================================================================

  describe('getToasts', () => {
    it('should return a copy of toasts array', () => {
      ToastService.show('Test');

      const toasts1 = ToastService.getToasts();
      const toasts2 = ToastService.getToasts();

      expect(toasts1).not.toBe(toasts2);
      expect(toasts1).toEqual(toasts2);
    });

    it('should return empty array when no toasts', () => {
      const toasts = ToastService.getToasts();
      expect(toasts).toEqual([]);
    });
  });

  // ============================================================================
  // Subscription Tests
  // ============================================================================

  describe('subscribe', () => {
    it('should notify subscriber immediately with current state', () => {
      ToastService.show('Existing');

      const listener = vi.fn();
      const unsubscribe = ToastService.subscribe(listener);

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ message: 'Existing' })])
      );

      unsubscribe();
    });

    it('should notify subscriber when toast is shown', () => {
      const listener = vi.fn();
      const unsubscribe = ToastService.subscribe(listener);

      listener.mockClear();

      ToastService.show('New toast');

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ message: 'New toast' })])
      );

      unsubscribe();
    });

    it('should notify subscriber when toast is dismissed', () => {
      const id = ToastService.show('Test');

      const listener = vi.fn();
      const unsubscribe = ToastService.subscribe(listener);

      listener.mockClear();

      ToastService.dismiss(id);

      expect(listener).toHaveBeenCalledWith([]);

      unsubscribe();
    });

    it('should unsubscribe properly', () => {
      const listener = vi.fn();
      const unsubscribe = ToastService.subscribe(listener);

      listener.mockClear();
      unsubscribe();

      ToastService.show('Test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = ToastService.subscribe(listener1);
      const unsub2 = ToastService.subscribe(listener2);

      listener1.mockClear();
      listener2.mockClear();

      ToastService.show('Test');

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
      const result = ToastService.prefersReducedMotion();
      expect(typeof result).toBe('boolean');
    });
  });

  // ============================================================================
  // Default Duration Tests
  // ============================================================================

  describe('Default Durations', () => {
    it('should use 3000ms for success toasts', () => {
      const id = ToastService.success('Success');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.duration).toBe(3000);
    });

    it('should use 5000ms for error toasts', () => {
      const id = ToastService.error('Error');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.duration).toBe(5000);
    });

    it('should use 4000ms for warning toasts', () => {
      const id = ToastService.warning('Warning');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.duration).toBe(4000);
    });

    it('should use 3000ms for info toasts', () => {
      const id = ToastService.info('Info');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.duration).toBe(3000);
    });
  });

  // ============================================================================
  // Dismissible Default Tests
  // ============================================================================

  describe('Dismissible Defaults', () => {
    it('should make error toasts dismissible by default', () => {
      const id = ToastService.error('Error');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.dismissible).toBe(true);
    });

    it('should not make success toasts dismissible by default', () => {
      const id = ToastService.success('Success');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.dismissible).toBe(false);
    });

    it('should not make warning toasts dismissible by default', () => {
      const id = ToastService.warning('Warning');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.dismissible).toBe(false);
    });

    it('should not make info toasts dismissible by default', () => {
      const id = ToastService.info('Info');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.dismissible).toBe(false);
    });
  });

  // ============================================================================
  // ID Generation Tests
  // ============================================================================

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = ToastService.show('Toast 1');
      const id2 = ToastService.show('Toast 2');
      const id3 = ToastService.show('Toast 3');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should generate IDs with toast_ prefix', () => {
      const id = ToastService.show('Test');
      expect(id.startsWith('toast_')).toBe(true);
    });
  });

  // ============================================================================
  // Timer Management Tests
  // ============================================================================

  describe('Timer Management', () => {
    it('should clear timer when toast removed due to limit', () => {
      // Show 6 toasts - first one should be removed
      for (let i = 0; i < 6; i++) {
        ToastService.show(`Toast ${i}`, { duration: 5000 });
      }

      // Advance past duration
      vi.advanceTimersByTime(6000);

      // Should have dismissed remaining toasts, no errors
      expect(ToastService.getToasts().length).toBe(0);
    });

    it('should handle rapid show/dismiss cycles', () => {
      for (let i = 0; i < 10; i++) {
        const id = ToastService.show(`Toast ${i}`, { duration: 100 });
        if (i % 2 === 0) {
          ToastService.dismiss(id);
        }
      }

      vi.advanceTimersByTime(200);

      // All toasts should be gone
      expect(ToastService.getToasts().length).toBe(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const id = ToastService.show('');
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.message).toBe('');
    });

    it('should handle very long message', () => {
      const longMessage = 'A'.repeat(1000);
      const id = ToastService.show(longMessage);
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.message).toBe(longMessage);
    });

    it('should handle special characters in message', () => {
      const specialMessage = '<script>alert("xss")</script>';
      const id = ToastService.show(specialMessage);
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.message).toBe(specialMessage);
    });

    it('should handle unicode in message', () => {
      const unicodeMessage = '🎨 Color palette saved! 颜色调色板已保存';
      const id = ToastService.show(unicodeMessage);
      const toast = ToastService.getToasts().find((t) => t.id === id);
      expect(toast?.message).toBe(unicodeMessage);
    });
  });
});
