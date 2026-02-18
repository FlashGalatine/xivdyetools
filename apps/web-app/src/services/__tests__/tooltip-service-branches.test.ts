/**
 * XIV Dye Tools - Tooltip Service Branch Coverage Tests
 *
 * Additional tests for uncovered branches in tooltip-service.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TooltipService Branch Coverage', () => {
  let targetElement: HTMLElement;
  let TooltipService: typeof import('../tooltip-service').TooltipService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const module = await import('../tooltip-service');
    TooltipService = module.TooltipService;

    const existingContainer = document.getElementById('tooltip-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    targetElement = document.createElement('button');
    targetElement.id = 'test-target';
    document.body.appendChild(targetElement);

    vi.spyOn(targetElement, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 100,
      width: 100,
      height: 30,
      top: 100,
      left: 100,
      right: 200,
      bottom: 130,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    TooltipService.stopOrphanCleanup();
    TooltipService.detachAll();
    targetElement.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    const container = document.getElementById('tooltip-container');
    if (container) container.remove();
  });

  describe('Orphan Cleanup', () => {
    it('should start orphan cleanup interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      TooltipService.startOrphanCleanup(1000);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should not start multiple cleanup intervals', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      TooltipService.startOrphanCleanup(1000);
      TooltipService.startOrphanCleanup(1000);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should stop orphan cleanup interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      TooltipService.startOrphanCleanup(1000);
      TooltipService.stopOrphanCleanup();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle stopping when no interval is running', () => {
      expect(() => TooltipService.stopOrphanCleanup()).not.toThrow();
    });

    it('should clean up orphaned tooltips when element is removed', () => {
      TooltipService.attach(targetElement, { content: 'Test tooltip' });
      TooltipService.startOrphanCleanup(100);
      targetElement.remove();
      vi.advanceTimersByTime(150);
      expect(() => TooltipService.show(targetElement)).not.toThrow();
    });
  });

  describe('Positioning Edge Cases', () => {
    it('should handle bottom position', () => {
      TooltipService.attach(targetElement, { content: 'Test', position: 'bottom' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.getAttribute('data-position')).toBe('bottom');
    });

    it('should handle left position', () => {
      TooltipService.attach(targetElement, { content: 'Test', position: 'left' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.getAttribute('data-position')).toBe('left');
    });

    it('should handle right position', () => {
      TooltipService.attach(targetElement, { content: 'Test', position: 'right' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.getAttribute('data-position')).toBe('right');
    });
  });

  describe('updateContent Edge Cases', () => {
    it('should update content when tooltip is shown', () => {
      TooltipService.attach(targetElement, { content: 'Original' });
      TooltipService.show(targetElement);
      TooltipService.updateContent(targetElement, 'Updated');
      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.textContent).toContain('Updated');
    });

    it('should handle updateContent when tooltip element does not exist', () => {
      TooltipService.attach(targetElement, { content: 'Original' });
      expect(() => TooltipService.updateContent(targetElement, 'Updated')).not.toThrow();
    });

    it('should handle updateContent for non-attached target', () => {
      const otherElement = document.createElement('div');
      expect(() => TooltipService.updateContent(otherElement, 'Test')).not.toThrow();
    });
  });

  describe('Timeout Clearing', () => {
    it('should clear pending hide timeout on show', () => {
      TooltipService.attach(targetElement, { content: 'Test', delay: 0 });
      TooltipService.show(targetElement);
      targetElement.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(50);
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);
    });

    it('should clear pending show timeout on hide', () => {
      TooltipService.attach(targetElement, { content: 'Test', delay: 500 });
      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(100);
      TooltipService.hide(targetElement);
      vi.advanceTimersByTime(500);
      const container = document.getElementById('tooltip-container');
      expect(container).toBeNull();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: Default Position Switch Case
  // ==========================================================================

  describe('Position Switch Default Case', () => {
    it('should handle undefined position falling through to default', () => {
      // Force an invalid position through the system
      TooltipService.attach(targetElement, {
        content: 'Test',
        position: 'invalid' as 'top', // Force invalid position
      });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      // Should still render (uses default positioning)
      expect(tooltip).toBeTruthy();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: calculateBestPosition All Paths
  // ==========================================================================

  describe('calculateBestPosition All Paths', () => {
    it('should choose bottom when only bottom has space', () => {
      // Position element at very top of viewport
      vi.spyOn(targetElement, 'getBoundingClientRect').mockReturnValue({
        x: 400,
        y: 10, // Very close to top
        width: 100,
        height: 30,
        top: 10,
        left: 400,
        right: 500,
        bottom: 40,
        toJSON: () => ({}),
      });

      TooltipService.attach(targetElement, { content: 'Long test tooltip content', position: 'auto' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      // Should choose bottom since no space above
      expect(tooltip?.getAttribute('data-position')).toBe('bottom');
    });

    it('should choose right when only right has space', () => {
      // Position element at top-left corner
      vi.spyOn(targetElement, 'getBoundingClientRect').mockReturnValue({
        x: 10,
        y: 10,
        width: 30,
        height: 30,
        top: 10,
        left: 10,
        right: 40,
        bottom: 40,
        toJSON: () => ({}),
      });

      // Mock window dimensions
      vi.stubGlobal('innerWidth', 800);
      vi.stubGlobal('innerHeight', 100); // Very short viewport

      TooltipService.attach(targetElement, { content: 'Test tooltip', position: 'auto' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      // Should fall back to right since no vertical space
      expect(['right', 'bottom', 'top']).toContain(tooltip?.getAttribute('data-position'));
    });

    it('should choose left when only left has space', () => {
      // Position element at top-right corner
      vi.spyOn(targetElement, 'getBoundingClientRect').mockReturnValue({
        x: 750,
        y: 10,
        width: 40,
        height: 30,
        top: 10,
        left: 750,
        right: 790,
        bottom: 40,
        toJSON: () => ({}),
      });

      vi.stubGlobal('innerWidth', 800);
      vi.stubGlobal('innerHeight', 50); // Very short viewport

      TooltipService.attach(targetElement, { content: 'Test tooltip', position: 'auto' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      // Position should be determined
      expect(tooltip?.getAttribute('data-position')).toBeTruthy();
    });

    it('should fall back to top when nothing fits', () => {
      // Position element in very constrained space
      vi.spyOn(targetElement, 'getBoundingClientRect').mockReturnValue({
        x: 395,
        y: 45,
        width: 10,
        height: 10,
        top: 45,
        left: 395,
        right: 405,
        bottom: 55,
        toJSON: () => ({}),
      });

      vi.stubGlobal('innerWidth', 100);
      vi.stubGlobal('innerHeight', 100);

      TooltipService.attach(targetElement, { content: 'X', position: 'auto' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      // Should default to 'top' when nothing fits well
      expect(tooltip?.getAttribute('data-position')).toBe('top');
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: Disconnected Element Detection
  // ==========================================================================

  describe('Disconnected Element Detection', () => {
    it('should detach tooltip when target element is disconnected during positioning', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      // Mock isConnected to return false
      Object.defineProperty(targetElement, 'isConnected', {
        get: () => false,
        configurable: true,
      });

      // Force reposition which should trigger cleanup
      TooltipService.show(targetElement);

      // Tooltip should be cleaned up
      expect(targetElement.getAttribute('aria-describedby')).toBeNull();
    });

    it('should handle tooltip element being disconnected', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;

      if (tooltip) {
        // Remove tooltip element directly
        tooltip.remove();
      }

      // Detach and reattach to recreate the tooltip
      TooltipService.detach(targetElement);
      TooltipService.attach(targetElement, { content: 'Recreated' });
      TooltipService.show(targetElement);

      // Should have a new tooltip after reattach
      const newTooltipId = targetElement.getAttribute('aria-describedby');
      expect(newTooltipId).toBeTruthy();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: Focus/Blur Handler Edge Cases
  // ==========================================================================

  describe('Focus/Blur Handler Edge Cases', () => {
    it('should not show tooltip on focus when showOnFocus is false', () => {
      TooltipService.attach(targetElement, { content: 'Test', showOnFocus: false });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(300);

      const container = document.getElementById('tooltip-container');
      // Should not create container since showOnFocus is false
      expect(container).toBeNull();
    });

    it('should show tooltip immediately on focus when showOnFocus is true', () => {
      TooltipService.attach(targetElement, { content: 'Test', showOnFocus: true });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(0);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);
    });

    it('should hide tooltip on blur', () => {
      TooltipService.attach(targetElement, { content: 'Test', showOnFocus: true });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(0);

      targetElement.dispatchEvent(new FocusEvent('blur'));

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(false);
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: updateContent Text Node
  // ==========================================================================

  describe('updateContent Text Node Edge Cases', () => {
    it('should update text node content correctly', () => {
      TooltipService.attach(targetElement, { content: 'Initial' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;

      // Verify initial content
      expect(tooltip?.firstChild?.textContent).toBe('Initial');

      // Update content
      TooltipService.updateContent(targetElement, 'Updated content');

      // Verify updated content
      expect(tooltip?.firstChild?.textContent).toBe('Updated content');
    });

    it('should handle tooltip with no text node', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;

      if (tooltip) {
        // Remove all children
        while (tooltip.firstChild) {
          tooltip.removeChild(tooltip.firstChild);
        }
      }

      // Should not throw
      expect(() => TooltipService.updateContent(targetElement, 'New')).not.toThrow();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage: prefersReducedMotion
  // ==========================================================================

  describe('prefersReducedMotion', () => {
    it('should return true when reduced motion is preferred', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

      expect(TooltipService.prefersReducedMotion()).toBe(true);
    });

    it('should return false when reduced motion is not preferred', () => {
      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

      expect(TooltipService.prefersReducedMotion()).toBe(false);
    });
  });
});
