/**
 * XIV Dye Tools - CollapsiblePanel Unit Tests
 *
 * Tests the collapsible panel component used for config sections.
 * Covers toggle behavior, persistence, and accessibility.
 *
 * @module components/__tests__/collapsible-panel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CollapsiblePanel } from '../collapsible-panel';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  getText,
  getAttr,
  hasClass,
} from '../../__tests__/component-utils';

// Use vi.hoisted() to create mock functions that are available when vi.mock runs
const { mockGetItem, mockSetItem } = vi.hoisted(() => ({
  mockGetItem: vi.fn(),
  mockSetItem: vi.fn(),
}));

// Mock StorageService
vi.mock('@services/index', () => ({
  StorageService: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('CollapsiblePanel', () => {
  let container: HTMLElement;
  let panel: CollapsiblePanel | null;

  beforeEach(() => {
    container = createTestContainer();
    panel = null;
    // Reset storage mock
    mockGetItem.mockReturnValue(null);
    mockSetItem.mockClear();
    mockGetItem.mockClear();
  });

  afterEach(() => {
    if (panel) {
      try {
        panel.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render panel wrapper', () => {
      panel = new CollapsiblePanel(container, { title: 'Test Panel' });
      panel.init();

      expect(query(container, '.collapsible-panel')).not.toBeNull();
    });

    it('should render title', () => {
      panel = new CollapsiblePanel(container, { title: 'Filters' });
      panel.init();

      const titleSpan = query(container, 'button span span');
      expect(getText(titleSpan)).toBe('Filters');
    });

    it('should render header as button', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');
      expect(button).not.toBeNull();
      expect(getAttr(button, 'type')).toBe('button');
    });

    it('should render chevron icon', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const chevron = query(container, 'button svg');
      expect(chevron).not.toBeNull();
    });

    it('should render optional icon', () => {
      const iconSvg = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>';
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        icon: iconSvg,
      });
      panel.init();

      // Should have both chevron and custom icon
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBe(2);
    });

    it('should render content area', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const contentArea = query(container, '.collapsible-content');
      expect(contentArea).not.toBeNull();
    });
  });

  // ============================================================================
  // Default State Tests
  // ============================================================================

  describe('Default State', () => {
    it('should be open by default', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('true');
    });

    it('should be closed when defaultOpen is false', () => {
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        defaultOpen: false,
      });
      panel.init();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });

    it('should show content when open', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const content = query<HTMLElement>(container, '.collapsible-content');
      expect(content?.style.maxHeight).toBe('1000px');
      expect(content?.style.opacity).toBe('1');
    });

    it('should hide content when closed', () => {
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        defaultOpen: false,
      });
      panel.init();

      const content = query<HTMLElement>(container, '.collapsible-content');
      expect(content?.style.maxHeight).toBe('0px');
      expect(content?.style.opacity).toBe('0');
    });
  });

  // ============================================================================
  // Toggle Tests
  // ============================================================================

  describe('Toggle Behavior', () => {
    it('should toggle on header click', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');

      // Initially open
      expect(getAttr(button, 'aria-expanded')).toBe('true');

      // Click to close
      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('false');

      // Click to open
      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('true');
    });

    it('should update content visibility on toggle', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');
      const content = query<HTMLElement>(container, '.collapsible-content');

      // Close
      click(button);
      expect(content?.style.maxHeight).toBe('0px');

      // Open
      click(button);
      expect(content?.style.maxHeight).toBe('1000px');
    });

    it('should rotate chevron on toggle', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');
      const chevronWrapper = query<HTMLElement>(container, 'button > span:last-child');

      // Initially open - 0deg
      expect(chevronWrapper?.style.transform).toBe('rotate(0deg)');

      // Close - -90deg
      click(button);
      expect(chevronWrapper?.style.transform).toBe('rotate(-90deg)');

      // Open again - 0deg
      click(button);
      expect(chevronWrapper?.style.transform).toBe('rotate(0deg)');
    });
  });

  // ============================================================================
  // Programmatic Control Tests
  // ============================================================================

  describe('Programmatic Control', () => {
    it('should open with open()', () => {
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        defaultOpen: false,
      });
      panel.init();

      panel.open();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('true');
    });

    it('should close with close()', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      panel.close();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });

    it('should not re-open if already open', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      // Clear any storage calls from init
      mockSetItem.mockClear();

      panel.open(); // Should be no-op

      // Storage should not be called since state didn't change
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('should not re-close if already closed', () => {
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        defaultOpen: false,
      });
      panel.init();

      mockSetItem.mockClear();

      panel.close(); // Should be no-op

      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Content Management Tests
  // ============================================================================

  describe('Content Management', () => {
    it('should return content container via getContentContainer()', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const contentContainer = panel.getContentContainer();

      expect(contentContainer).not.toBeNull();
      expect(hasClass(contentContainer!, 'px-4')).toBe(true);
    });

    it('should set string content via setContent()', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      panel.setContent('<p>Custom content</p>');

      const contentContainer = panel.getContentContainer();
      expect(contentContainer?.innerHTML).toBe('<p>Custom content</p>');
    });

    it('should set element content via setContent()', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const element = document.createElement('div');
      element.textContent = 'Test element';
      panel.setContent(element);

      const contentContainer = panel.getContentContainer();
      expect(contentContainer?.firstElementChild).toBe(element);
    });

    it('should clear previous content when setting new content', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      panel.setContent('First content');
      panel.setContent('Second content');

      const contentContainer = panel.getContentContainer();
      expect(contentContainer?.innerHTML).toBe('Second content');
    });
  });

  // ============================================================================
  // Storage Persistence Tests
  // ============================================================================

  describe('Storage Persistence', () => {
    it('should save state to storage when storageKey provided', () => {
      panel = new CollapsiblePanel(container, {
        title: 'Test',
        storageKey: 'test-panel',
      });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');
      click(button); // Toggle to closed

      expect(mockSetItem).toHaveBeenCalledWith(
        'v3_panel_test-panel',
        false
      );
    });

    it('should load state from storage on init', () => {
      mockGetItem.mockReturnValue(false);

      panel = new CollapsiblePanel(container, {
        title: 'Test',
        storageKey: 'test-panel',
        defaultOpen: true, // Would be open, but storage says false
      });
      panel.init();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });

    it('should use defaultOpen when no stored value', () => {
      mockGetItem.mockReturnValue(null);

      panel = new CollapsiblePanel(container, {
        title: 'Test',
        storageKey: 'test-panel',
        defaultOpen: false,
      });
      panel.init();

      const button = query(container, 'button');
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });

    it('should not call storage when no storageKey provided', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      expect(mockGetItem).not.toHaveBeenCalled();

      const button = query<HTMLButtonElement>(container, 'button');
      click(button);

      expect(mockSetItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-expanded on header button', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query(container, 'button');
      expect(button?.hasAttribute('aria-expanded')).toBe(true);
    });

    it('should update aria-expanded on toggle', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      const button = query<HTMLButtonElement>(container, 'button');

      expect(getAttr(button, 'aria-expanded')).toBe('true');

      click(button);

      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      panel = new CollapsiblePanel(container, { title: 'Test' });
      panel.init();

      panel.destroy();

      expect(query(container, '.collapsible-panel')).toBeNull();
    });
  });
});
