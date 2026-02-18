/**
 * Tooltip Service Tests
 *
 * Tests for tooltip management with positioning and events
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TooltipService', () => {
  let targetElement: HTMLElement;
  let TooltipService: typeof import('../tooltip-service').TooltipService;

  beforeEach(async () => {
    vi.useFakeTimers();

    // Reset the module to get a fresh TooltipService with no container
    vi.resetModules();
    const module = await import('../tooltip-service');
    TooltipService = module.TooltipService;

    // Remove any tooltip containers from previous tests
    const existingContainer = document.getElementById('tooltip-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Create target element
    targetElement = document.createElement('button');
    targetElement.id = 'test-target';
    targetElement.textContent = 'Hover me';
    document.body.appendChild(targetElement);

    // Mock getBoundingClientRect for positioning tests
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
    TooltipService.detachAll();
    targetElement.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up container
    const container = document.getElementById('tooltip-container');
    if (container) {
      container.remove();
    }
  });

  // ============================================================================
  // attach/detach Tests
  // ============================================================================

  describe('attach', () => {
    it('should attach tooltip to element', () => {
      TooltipService.attach(targetElement, { content: 'Test tooltip' });

      // Verify by checking aria-describedby is set
      expect(targetElement.getAttribute('aria-describedby')).toBeTruthy();
      // Can detach without error
      expect(() => TooltipService.detach(targetElement)).not.toThrow();
    });

    it('should set aria-describedby on attach', () => {
      TooltipService.attach(targetElement, { content: 'Test tooltip' });

      const ariaDescribedby = targetElement.getAttribute('aria-describedby');
      expect(ariaDescribedby).toMatch(/^tooltip_/);
    });

    it('should replace existing tooltip on same element', () => {
      TooltipService.attach(targetElement, { content: 'First tooltip' });
      TooltipService.attach(targetElement, { content: 'Second tooltip' });

      // Should not throw, only one tooltip attached
      expect(() => TooltipService.detach(targetElement)).not.toThrow();
    });

    it('should use default config values', () => {
      // Just verify no errors with minimal config
      TooltipService.attach(targetElement, { content: 'Test' });
      expect(() => TooltipService.detach(targetElement)).not.toThrow();
    });

    it('should accept custom config values', () => {
      const config = {
        content: 'Custom tooltip',
        position: 'top' as const,
        delay: 500,
        maxWidth: 400,
        showOnFocus: false,
      };

      TooltipService.attach(targetElement, config);
      expect(() => TooltipService.detach(targetElement)).not.toThrow();
    });
  });

  describe('detach', () => {
    it('should detach tooltip from element', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.detach(targetElement);

      // Should have removed aria-describedby
      expect(targetElement.getAttribute('aria-describedby')).toBeNull();
    });

    it('should handle detaching non-attached element gracefully', () => {
      expect(() => TooltipService.detach(targetElement)).not.toThrow();
    });
  });

  describe('detachAll', () => {
    it('should detach all tooltips', () => {
      const target2 = document.createElement('button');
      document.body.appendChild(target2);

      TooltipService.attach(targetElement, { content: 'First' });
      TooltipService.attach(target2, { content: 'Second' });

      TooltipService.detachAll();

      // Both should have aria removed
      expect(targetElement.getAttribute('aria-describedby')).toBeNull();
      expect(target2.getAttribute('aria-describedby')).toBeNull();

      target2.remove();
    });
  });

  // ============================================================================
  // show/hide Tests
  // ============================================================================

  describe('show', () => {
    it('should show tooltip for attached element', () => {
      TooltipService.attach(targetElement, { content: 'Test tooltip' });
      TooltipService.show(targetElement);

      // Container should be created
      const container = document.getElementById('tooltip-container');
      expect(container).toBeTruthy();

      // Tooltip should exist in container
      const tooltipId = targetElement.getAttribute('aria-describedby');
      if (tooltipId) {
        const tooltip = document.getElementById(tooltipId);
        expect(tooltip).toBeTruthy();
        expect(tooltip?.textContent).toContain('Test tooltip');
      }
    });

    it('should not throw for non-attached element', () => {
      expect(() => TooltipService.show(targetElement)).not.toThrow();
    });
  });

  describe('hide', () => {
    it('should hide shown tooltip', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      if (tooltipId) {
        const tooltip = document.getElementById(tooltipId);
        expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);

        TooltipService.hide(targetElement);
        expect(tooltip?.classList.contains('tooltip-visible')).toBe(false);
      }
    });

    it('should handle hiding non-shown tooltip gracefully', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      expect(() => TooltipService.hide(targetElement)).not.toThrow();
    });

    it('should handle hiding non-attached element gracefully', () => {
      expect(() => TooltipService.hide(targetElement)).not.toThrow();
    });
  });

  // ============================================================================
  // Mouse Event Tests
  // ============================================================================

  describe('Mouse Events', () => {
    it('should show tooltip on mouseenter after delay', () => {
      TooltipService.attach(targetElement, { content: 'Hover tooltip', delay: 100 });

      const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
      targetElement.dispatchEvent(mouseEnterEvent);

      // Before delay, no tooltip visible
      const container = document.getElementById('tooltip-container');
      expect(container).toBeNull();

      // After delay, tooltip should appear
      vi.advanceTimersByTime(100);

      const containerAfter = document.getElementById('tooltip-container');
      expect(containerAfter).toBeTruthy();
    });

    it('should hide tooltip on mouseleave', () => {
      TooltipService.attach(targetElement, { content: 'Test', delay: 0 });

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(10);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);

      targetElement.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(200);

      expect(tooltip?.classList.contains('tooltip-visible')).toBe(false);
    });

    it('should cancel show on mouseleave before delay', () => {
      TooltipService.attach(targetElement, { content: 'Test', delay: 500 });

      targetElement.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(100); // Not enough time

      targetElement.dispatchEvent(new MouseEvent('mouseleave'));
      vi.advanceTimersByTime(500);

      // Tooltip should not have appeared
      const container = document.getElementById('tooltip-container');
      expect(container).toBeNull();
    });
  });

  // ============================================================================
  // Focus Event Tests
  // ============================================================================

  describe('Focus Events', () => {
    it('should show tooltip on focus when showOnFocus is true', () => {
      TooltipService.attach(targetElement, {
        content: 'Focus tooltip',
        showOnFocus: true,
        delay: 0,
      });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(10);

      const container = document.getElementById('tooltip-container');
      expect(container).toBeTruthy();
    });

    it('should NOT show tooltip on focus when showOnFocus is false', () => {
      TooltipService.attach(targetElement, {
        content: 'Test',
        showOnFocus: false,
        delay: 0,
      });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(100);

      // Container won't be created if no tooltip is shown
      const container = document.getElementById('tooltip-container');
      expect(container).toBeNull();
    });

    it('should hide tooltip on blur', () => {
      TooltipService.attach(targetElement, { content: 'Test', showOnFocus: true, delay: 0 });

      targetElement.dispatchEvent(new FocusEvent('focus'));
      vi.advanceTimersByTime(10);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.classList.contains('tooltip-visible')).toBe(true);

      targetElement.dispatchEvent(new FocusEvent('blur'));
      vi.advanceTimersByTime(100);

      expect(tooltip?.classList.contains('tooltip-visible')).toBe(false);
    });
  });

  // ============================================================================
  // Position Tests
  // ============================================================================

  describe('Position', () => {
    it('should accept top position', () => {
      TooltipService.attach(targetElement, { content: 'Top', position: 'top' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      TooltipService.hide(targetElement);
    });

    it('should accept bottom position', () => {
      TooltipService.attach(targetElement, { content: 'Bottom', position: 'bottom' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      TooltipService.hide(targetElement);
    });

    it('should accept left position', () => {
      TooltipService.attach(targetElement, { content: 'Left', position: 'left' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      TooltipService.hide(targetElement);
    });

    it('should accept right position', () => {
      TooltipService.attach(targetElement, { content: 'Right', position: 'right' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      TooltipService.hide(targetElement);
    });

    it('should use auto position by default', () => {
      TooltipService.attach(targetElement, { content: 'Auto' });
      TooltipService.show(targetElement);
      const tooltipId = targetElement.getAttribute('aria-describedby');
      expect(tooltipId).toBeTruthy();
      TooltipService.hide(targetElement);
    });
  });

  // ============================================================================
  // Content and Styling Tests
  // ============================================================================

  describe('Content and Styling', () => {
    it('should apply custom maxWidth', () => {
      TooltipService.attach(targetElement, { content: 'Wide', maxWidth: 400 });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.style.maxWidth).toBe('400px');
    });

    it('should use default maxWidth (250px)', () => {
      TooltipService.attach(targetElement, { content: 'Default' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.style.maxWidth).toBe('250px');
    });

    it('should set role="tooltip" on tooltip element', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.getAttribute('role')).toBe('tooltip');
    });

    it('should include tooltip content', () => {
      TooltipService.attach(targetElement, { content: 'My tooltip text' });
      TooltipService.show(targetElement);

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.textContent).toContain('My tooltip text');
    });
  });

  // ============================================================================
  // prefersReducedMotion Tests
  // ============================================================================

  describe('prefersReducedMotion', () => {
    it('should return boolean value', () => {
      const result = TooltipService.prefersReducedMotion();
      expect(typeof result).toBe('boolean');
    });
  });

  // ============================================================================
  // Container Tests
  // ============================================================================

  describe('Container', () => {
    it('should set aria-hidden on container', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const container = document.getElementById('tooltip-container');
      expect(container?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should have tooltip-container class', () => {
      TooltipService.attach(targetElement, { content: 'Test' });
      TooltipService.show(targetElement);

      const container = document.getElementById('tooltip-container');
      expect(container?.classList.contains('tooltip-container')).toBe(true);
    });
  });

  // ============================================================================
  // updateContent Tests
  // ============================================================================

  describe('updateContent', () => {
    it('should update tooltip content', () => {
      TooltipService.attach(targetElement, { content: 'Original' });
      TooltipService.show(targetElement);

      TooltipService.updateContent(targetElement, 'Updated');

      const tooltipId = targetElement.getAttribute('aria-describedby');
      const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
      expect(tooltip?.textContent).toContain('Updated');
    });

    it('should not throw for non-attached element', () => {
      expect(() => TooltipService.updateContent(targetElement, 'Test')).not.toThrow();
    });
  });
});
