/**
 * XIV Dye Tools - DyeCardRenderer Unit Tests
 *
 * Tests the dye card renderer utility class.
 * Covers rendering, options, event handling, and accessibility.
 *
 * @module components/__tests__/dye-card-renderer.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DyeCardRenderer } from '../dye-card-renderer';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  getAttr,
  hasClass,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getCategory: (category: string) => category,
  },
  ColorService: {
    getColorDistance: vi.fn().mockReturnValue(25.5),
  },
  APIService: {
    formatPrice: vi.fn((price: number) => `${price.toLocaleString()} Gil`),
  },
}));

vi.mock('@shared/constants', () => ({
  CARD_CLASSES_COMPACT: 'p-3 rounded-lg bg-white shadow',
}));

describe('DyeCardRenderer', () => {
  let container: HTMLElement;
  let renderer: DyeCardRenderer | null;

  beforeEach(() => {
    container = createTestContainer();
    renderer = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (renderer) {
      renderer.destroy();
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render a card element', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      expect(card).toBeTruthy();
      expect(card.tagName).toBe('DIV');
    });

    it('should render as button when onClick is provided', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        onClick: vi.fn(),
      });

      expect(card.tagName).toBe('BUTTON');
    });

    it('should include dye-id data attribute', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      expect(getAttr(card, 'data-dye-id')).toBe(String(mockDyes[0].id));
    });

    it('should render dye swatch with correct background color', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      const swatch = query(card, '.dye-swatch');
      expect(swatch?.getAttribute('style')).toContain(mockDyes[0].hex);
    });

    it('should render dye name', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      expect(card.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
    });

    it('should render category badge', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      expect(card.textContent).toContain(mockDyes[0].category);
    });
  });

  // ============================================================================
  // Sampled Color Tests
  // ============================================================================

  describe('Sampled Color', () => {
    it('should render sampled color swatch when provided', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        sampledColor: '#00FF00',
      });

      const swatches = card.querySelectorAll('[role="img"]');
      expect(swatches.length).toBe(2);
    });

    it('should show color distance when sampled color provided', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        sampledColor: '#00FF00',
      });

      expect(card.textContent).toContain('matcher.distance');
    });

    it('should use pre-calculated distance from DyeWithDistance', () => {
      renderer = new DyeCardRenderer(container);
      const dyeWithDistance = { ...mockDyes[0], distance: 15.5 };
      const card = renderer.render({
        dye: dyeWithDistance,
        sampledColor: '#00FF00',
      });

      expect(card.textContent).toContain('15.5');
    });
  });

  // ============================================================================
  // Price Display Tests
  // ============================================================================

  describe('Price Display', () => {
    it('should show price when showPrice is true and price provided', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        showPrice: true,
        price: {
          itemID: mockDyes[0].itemID,
          currentAverage: 5000,
          currentMinPrice: 4500,
          currentMaxPrice: 5500,
          lastUpdate: Date.now(),
        },
      });

      expect(card.textContent).toContain('5,000');
    });

    it('should show N/A when showPrice is true but no price', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        showPrice: true,
      });

      expect(card.textContent).toContain('N/A');
    });

    it('should not show price section when showPrice is false', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        showPrice: false,
        price: {
          itemID: mockDyes[0].itemID,
          currentAverage: 5000,
          currentMinPrice: 4500,
          currentMaxPrice: 5500,
          lastUpdate: Date.now(),
        },
      });

      expect(card.textContent).not.toContain('5,000');
    });

    it('should show market label with price', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        showPrice: true,
        price: {
          itemID: mockDyes[0].itemID,
          currentAverage: 5000,
          currentMinPrice: 4500,
          currentMaxPrice: 5500,
          lastUpdate: Date.now(),
        },
      });

      expect(card.textContent).toContain('matcher.market');
    });
  });

  // ============================================================================
  // Extra Info Tests
  // ============================================================================

  describe('Extra Info', () => {
    it('should render extra info as string', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        extraInfo: 'Additional information',
      });

      expect(card.textContent).toContain('Additional information');
    });

    it('should render extra info as HTMLElement', () => {
      renderer = new DyeCardRenderer(container);
      const extraEl = document.createElement('span');
      extraEl.textContent = 'Custom element';
      extraEl.classList.add('custom-extra');

      const card = renderer.render({
        dye: mockDyes[0],
        extraInfo: extraEl,
      });

      expect(query(card, '.custom-extra')).not.toBeNull();
    });
  });

  // ============================================================================
  // Actions Tests
  // ============================================================================

  describe('Actions', () => {
    it('should render action buttons when provided', () => {
      renderer = new DyeCardRenderer(container);
      const actionBtn = document.createElement('button');
      actionBtn.classList.add('test-action');
      actionBtn.textContent = 'Action';

      const card = renderer.render({
        dye: mockDyes[0],
        actions: [actionBtn],
      });

      expect(query(card, '.test-action')).not.toBeNull();
    });

    it('should render multiple action buttons', () => {
      renderer = new DyeCardRenderer(container);
      const action1 = document.createElement('button');
      action1.classList.add('action-1');
      const action2 = document.createElement('button');
      action2.classList.add('action-2');

      const card = renderer.render({
        dye: mockDyes[0],
        actions: [action1, action2],
      });

      expect(query(card, '.action-1')).not.toBeNull();
      expect(query(card, '.action-2')).not.toBeNull();
    });
  });

  // ============================================================================
  // Event Handler Tests
  // ============================================================================

  describe('Event Handlers', () => {
    it('should call onClick handler when clicked', () => {
      renderer = new DyeCardRenderer(container);
      const onClick = vi.fn();

      const card = renderer.render({
        dye: mockDyes[0],
        onClick,
      });

      click(card as HTMLButtonElement);

      expect(onClick).toHaveBeenCalledWith(mockDyes[0]);
    });

    it('should call onHover with true on mouseenter', () => {
      renderer = new DyeCardRenderer(container);
      const onHover = vi.fn();

      const card = renderer.render({
        dye: mockDyes[0],
        onHover,
      });

      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      expect(onHover).toHaveBeenCalledWith(mockDyes[0], true);
    });

    it('should call onHover with false on mouseleave', () => {
      renderer = new DyeCardRenderer(container);
      const onHover = vi.fn();

      const card = renderer.render({
        dye: mockDyes[0],
        onHover,
      });

      card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      expect(onHover).toHaveBeenCalledWith(mockDyes[0], false);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on button cards', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        onClick: vi.fn(),
      });

      expect(card.hasAttribute('aria-label')).toBe(true);
    });

    it('should have type="button" on button cards', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        onClick: vi.fn(),
      });

      expect(getAttr(card, 'type')).toBe('button');
    });

    it('should have aria-hidden on swatch container', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      const swatchContainer = card.querySelector('[aria-hidden="true"]');
      expect(swatchContainer).not.toBeNull();
    });

    it('should have role="img" on color swatches', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      const swatch = query(card, '[role="img"]');
      expect(swatch).not.toBeNull();
    });

    it('should have aria-label on dye swatch', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      const swatch = query(card, '.dye-swatch');
      expect(swatch?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have title attribute on dye swatch', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      const swatch = query(card, '.dye-swatch');
      expect(swatch?.hasAttribute('title')).toBe(true);
    });
  });

  // ============================================================================
  // Styling Tests
  // ============================================================================

  describe('Styling', () => {
    it('should apply CARD_CLASSES_COMPACT', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({ dye: mockDyes[0] });

      expect(hasClass(card, 'p-3')).toBe(true);
      expect(hasClass(card, 'rounded-lg')).toBe(true);
    });

    it('should include cursor-pointer for clickable cards', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        onClick: vi.fn(),
      });

      expect(hasClass(card, 'cursor-pointer')).toBe(true);
    });

    it('should include focus styling for clickable cards', () => {
      renderer = new DyeCardRenderer(container);
      const card = renderer.render({
        dye: mockDyes[0],
        onClick: vi.fn(),
      });

      expect(hasClass(card, 'focus:outline-none')).toBe(true);
      expect(hasClass(card, 'focus:ring-2')).toBe(true);
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('Cleanup', () => {
    it('should not throw on destroy', () => {
      renderer = new DyeCardRenderer(container);
      renderer.render({ dye: mockDyes[0] });

      expect(() => renderer!.destroy()).not.toThrow();
    });
  });
});
