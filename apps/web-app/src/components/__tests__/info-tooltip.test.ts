/**
 * XIV Dye Tools - InfoTooltip Unit Tests
 *
 * Tests the info tooltip factory functions.
 * Covers icon creation, tooltip attachment, and label helpers.
 *
 * @module components/__tests__/info-tooltip.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createInfoIcon,
  createLabelWithInfo,
  addInfoIconTo,
  TOOLTIP_CONTENT,
} from '../info-tooltip';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
  getText,
  getAttr,
  hasClass,
} from '../../__tests__/component-utils';
import { TooltipService } from '@services/tooltip-service';

// Mock TooltipService
vi.mock('@services/tooltip-service', () => ({
  TooltipService: {
    attach: vi.fn(),
    detach: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  },
}));

describe('InfoTooltip', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // createInfoIcon Tests
  // ============================================================================

  describe('createInfoIcon', () => {
    it('should create a button element', () => {
      const icon = createInfoIcon({ content: 'Test tooltip' });

      expect(icon.tagName).toBe('BUTTON');
      expect((icon as HTMLButtonElement).type).toBe('button');
    });

    it('should display info icon character', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(icon.textContent).toBe('ⓘ');
    });

    it('should have cursor-help class', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(hasClass(icon, 'cursor-help')).toBe(true);
    });

    it('should be keyboard focusable', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(getAttr(icon, 'tabindex')).toBe('0');
    });

    it('should have default aria-label', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(getAttr(icon, 'aria-label')).toBe('More information');
    });

    it('should accept custom aria-label', () => {
      const icon = createInfoIcon({
        content: 'Test',
        ariaLabel: 'Custom label',
      });

      expect(getAttr(icon, 'aria-label')).toBe('Custom label');
    });

    it('should attach tooltip to element', () => {
      const icon = createInfoIcon({
        content: 'Tooltip content here',
      });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        icon,
        expect.objectContaining({
          content: 'Tooltip content here',
        })
      );
    });

    it('should use default position "auto"', () => {
      createInfoIcon({ content: 'Test' });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          position: 'auto',
        })
      );
    });

    it('should accept custom position', () => {
      createInfoIcon({
        content: 'Test',
        position: 'top',
      });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          position: 'top',
        })
      );
    });

    it('should enable showOnFocus', () => {
      createInfoIcon({ content: 'Test' });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          showOnFocus: true,
        })
      );
    });
  });

  // ============================================================================
  // createLabelWithInfo Tests
  // ============================================================================

  describe('createLabelWithInfo', () => {
    it('should create a container span', () => {
      const element = createLabelWithInfo('Label', 'Tooltip');

      expect(element.tagName).toBe('SPAN');
    });

    it('should contain the label text', () => {
      const element = createLabelWithInfo('My Label', 'Tooltip');

      const labelSpan = query(element, 'span');
      expect(getText(labelSpan)).toBe('My Label');
    });

    it('should contain an info icon', () => {
      const element = createLabelWithInfo('Label', 'Tooltip');

      const button = query(element, 'button');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('ⓘ');
    });

    it('should attach tooltip with provided content', () => {
      createLabelWithInfo('Label', 'Custom tooltip content');

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          content: 'Custom tooltip content',
        })
      );
    });

    it('should pass through options to createInfoIcon', () => {
      createLabelWithInfo('Label', 'Tooltip', {
        position: 'bottom',
        ariaLabel: 'Help',
      });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          position: 'bottom',
        })
      );
    });

    it('should have inline-flex layout', () => {
      const element = createLabelWithInfo('Label', 'Tooltip');

      expect(hasClass(element, 'inline-flex')).toBe(true);
    });
  });

  // ============================================================================
  // addInfoIconTo Tests
  // ============================================================================

  describe('addInfoIconTo', () => {
    it('should append icon to existing element', () => {
      const parent = document.createElement('div');
      parent.textContent = 'Existing content';

      addInfoIconTo(parent, 'Tooltip');

      const icon = query(parent, 'button');
      expect(icon).not.toBeNull();
    });

    it('should return the created icon', () => {
      const parent = document.createElement('div');

      const icon = addInfoIconTo(parent, 'Tooltip');

      expect(icon.tagName).toBe('BUTTON');
      expect(icon.textContent).toBe('ⓘ');
    });

    it('should attach tooltip with provided content', () => {
      const parent = document.createElement('div');

      addInfoIconTo(parent, 'Info tooltip');

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          content: 'Info tooltip',
        })
      );
    });

    it('should pass through options', () => {
      const parent = document.createElement('div');

      addInfoIconTo(parent, 'Tooltip', {
        position: 'left',
        ariaLabel: 'More info',
      });

      expect(TooltipService.attach).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          position: 'left',
        })
      );
    });
  });

  // ============================================================================
  // TOOLTIP_CONTENT Tests
  // ============================================================================

  describe('TOOLTIP_CONTENT', () => {
    it('should have harmony type descriptions', () => {
      expect(TOOLTIP_CONTENT.harmonyComplementary).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyAnalogous).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyTriadic).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonySplitComplementary).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyTetradic).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonySquare).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyMonochromatic).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyCompound).toBeDefined();
      expect(TOOLTIP_CONTENT.harmonyShades).toBeDefined();
    });

    it('should have deviance description', () => {
      expect(TOOLTIP_CONTENT.deviance).toContain('harmony');
    });

    it('should have sampleSize description', () => {
      expect(TOOLTIP_CONTENT.sampleSize).toContain('pixels');
    });

    it('should have accessibility tooltips', () => {
      expect(TOOLTIP_CONTENT.dualDyeMode).toBeDefined();
      expect(TOOLTIP_CONTENT.wcagContrast).toBeDefined();
      expect(TOOLTIP_CONTENT.visionSimulation).toBeDefined();
    });

    it('should have colorDistance description', () => {
      expect(TOOLTIP_CONTENT.colorDistance).toContain('distance');
    });
  });

  // ============================================================================
  // Styling Tests
  // ============================================================================

  describe('Styling', () => {
    it('should have info-tooltip-icon class', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(hasClass(icon, 'info-tooltip-icon')).toBe(true);
    });

    it('should have transition class for hover effects', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(hasClass(icon, 'transition-colors')).toBe(true);
    });

    it('should have focus ring classes', () => {
      const icon = createInfoIcon({ content: 'Test' });

      expect(icon.className).toContain('focus:ring');
    });
  });
});
