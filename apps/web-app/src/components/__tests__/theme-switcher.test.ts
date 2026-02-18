/**
 * XIV Dye Tools - ThemeSwitcher Unit Tests
 *
 * Tests the theme switcher dropdown component.
 * Covers rendering, theme selection, dropdown toggle, and accessibility.
 *
 * @module components/__tests__/theme-switcher.test
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

import { ThemeSwitcher } from '../theme-switcher';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getAttr,
  hasClass,
} from '../../__tests__/component-utils';
import { ThemeService } from '@services/theme-service';

describe('ThemeSwitcher', () => {
  let container: HTMLElement;
  let switcher: ThemeSwitcher | null;

  beforeEach(() => {
    container = createTestContainer();
    switcher = null;
    // Set default theme
    ThemeService.setTheme('standard-light');
  });

  afterEach(() => {
    if (switcher) {
      try {
        switcher.destroy();
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
    it('should render toggle button', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query(container, '#theme-switcher-btn');
      expect(button).not.toBeNull();
    });

    it('should render dropdown container', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const dropdown = query(container, '#theme-dropdown');
      expect(dropdown).not.toBeNull();
    });

    it('should render theme options', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const themeButtons = queryAll(container, '[data-theme]');
      expect(themeButtons.length).toBeGreaterThan(0);
    });

    it('should render theme icon in button', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query(container, '#theme-switcher-btn');
      expect(button?.querySelector('svg')).not.toBeNull();
    });
  });

  // ============================================================================
  // Dropdown Behavior Tests
  // ============================================================================

  describe('Dropdown Behavior', () => {
    it('should hide dropdown by default', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const dropdown = query(container, '#theme-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should show dropdown on button click', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button);

      const dropdown = query(container, '#theme-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(false);
    });

    it('should toggle dropdown on multiple clicks', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      const dropdown = query(container, '#theme-dropdown');

      // Open
      click(button);
      expect(hasClass(dropdown, 'hidden')).toBe(false);

      // Close
      click(button);
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should close dropdown on Escape key', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button); // Open dropdown

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const dropdown = query(container, '#theme-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should close dropdown on outside click', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button); // Open dropdown

      // Click outside
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const dropdown = query(container, '#theme-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });
  });

  // ============================================================================
  // Theme Selection Tests
  // ============================================================================

  describe('Theme Selection', () => {
    it('should mark current theme as selected', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      // Change theme after init - subscription will trigger re-render
      ThemeService.setTheme('standard-dark');

      const darkThemeBtn = query(container, '[data-theme="standard-dark"]');
      expect(getAttr(darkThemeBtn, 'aria-selected')).toBe('true');
    });

    it('should change theme on selection', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button); // Open dropdown

      const darkThemeBtn = query<HTMLButtonElement>(container, '[data-theme="standard-dark"]');
      click(darkThemeBtn);

      expect(ThemeService.getCurrentTheme()).toBe('standard-dark');
    });

    it('should close dropdown after theme selection', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button); // Open dropdown

      const darkThemeBtn = query<HTMLButtonElement>(container, '[data-theme="standard-dark"]');
      click(darkThemeBtn);

      const dropdown = query(container, '#theme-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should emit theme-changed event on selection', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const eventSpy = vi.fn();
      container.addEventListener('theme-changed', eventSpy);

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      click(button); // Open dropdown

      const darkThemeBtn = query<HTMLButtonElement>(container, '[data-theme="standard-dark"]');
      click(darkThemeBtn);

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on toggle button', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query(container, '#theme-switcher-btn');
      expect(button?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have aria-haspopup on toggle button', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query(container, '#theme-switcher-btn');
      expect(getAttr(button, 'aria-haspopup')).toBe('true');
    });

    it('should update aria-expanded on toggle', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const button = query<HTMLButtonElement>(container, '#theme-switcher-btn');
      expect(getAttr(button, 'aria-expanded')).toBe('false');

      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('true');

      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });

    it('should have role="listbox" on dropdown', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const dropdown = query(container, '#theme-dropdown');
      expect(getAttr(dropdown, 'role')).toBe('listbox');
    });

    it('should have role="option" on theme buttons', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const themeButtons = queryAll(container, '[data-theme]');
      themeButtons.forEach((btn) => {
        expect(getAttr(btn, 'role')).toBe('option');
      });
    });

    it('should have aria-selected on theme options', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const themeButtons = queryAll(container, '[data-theme]');
      themeButtons.forEach((btn) => {
        expect(btn.hasAttribute('aria-selected')).toBe(true);
      });
    });
  });

  // ============================================================================
  // Theme Display Tests
  // ============================================================================

  describe('Theme Display', () => {
    it('should render color swatch for each theme', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const themeButtons = queryAll(container, '[data-theme]');
      themeButtons.forEach((btn) => {
        const swatch = btn.querySelector('.rounded');
        expect(swatch).not.toBeNull();
      });
    });

    it('should apply font-semibold to current theme', () => {
      ThemeService.setTheme('standard-light');
      switcher = new ThemeSwitcher(container);
      switcher.init();

      const lightThemeBtn = query(container, '[data-theme="standard-light"]');
      expect(hasClass(lightThemeBtn, 'font-semibold')).toBe(true);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      switcher.destroy();

      expect(query(container, '#theme-switcher-btn')).toBeNull();
    });

    it('should update when theme changes externally', () => {
      switcher = new ThemeSwitcher(container);
      switcher.init();

      // Simulate external theme change
      ThemeService.setTheme('standard-dark');

      const darkThemeBtn = query(container, '[data-theme="standard-dark"]');
      expect(hasClass(darkThemeBtn, 'font-semibold')).toBe(true);
    });
  });
});
