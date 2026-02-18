/**
 * XIV Dye Tools - LanguageSelector Unit Tests
 *
 * Tests the language selector dropdown component.
 * Covers rendering, language selection, dropdown toggle, and accessibility.
 *
 * @module components/__tests__/language-selector.test
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

import { LanguageSelector } from '../language-selector';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getAttr,
  hasClass,
  waitForRender,
} from '../../__tests__/component-utils';
import { LanguageService } from '@services/language-service';
import { LOCALE_DISPLAY_INFO } from '@shared/constants';

describe('LanguageSelector', () => {
  let container: HTMLElement;
  let selector: LanguageSelector | null;

  beforeEach(async () => {
    container = createTestContainer();
    selector = null;
    // Ensure English is the default locale
    await LanguageService.setLocale('en');
  });

  afterEach(() => {
    if (selector) {
      try {
        selector.destroy();
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
      selector = new LanguageSelector(container);
      selector.init();

      const button = query(container, '#language-selector-btn');
      expect(button).not.toBeNull();
    });

    it('should render dropdown container', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const dropdown = query(container, '#language-dropdown');
      expect(dropdown).not.toBeNull();
    });

    it('should render all language options', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const localeButtons = queryAll(container, '[data-locale]');
      expect(localeButtons.length).toBe(LOCALE_DISPLAY_INFO.length);
    });

    it('should render globe icon in button', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query(container, '#language-selector-btn');
      expect(button?.querySelector('svg')).not.toBeNull();
    });

    it('should render flag emojis for each language', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const localeButtons = queryAll(container, '[data-locale]');
      localeButtons.forEach((btn, index) => {
        const flag = btn.querySelector('span');
        expect(flag?.textContent).toBe(LOCALE_DISPLAY_INFO[index].flag);
      });
    });
  });

  // ============================================================================
  // Dropdown Behavior Tests
  // ============================================================================

  describe('Dropdown Behavior', () => {
    it('should hide dropdown by default', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should show dropdown on button click', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button);

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(false);
    });

    it('should toggle dropdown on multiple clicks', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      const dropdown = query(container, '#language-dropdown');

      // Open
      click(button);
      expect(hasClass(dropdown, 'hidden')).toBe(false);

      // Close
      click(button);
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should close dropdown on Escape key', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should close dropdown on outside click', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      // Click outside
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });
  });

  // ============================================================================
  // Language Selection Tests
  // ============================================================================

  describe('Language Selection', () => {
    it('should mark current language as selected', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const englishBtn = query(container, '[data-locale="en"]');
      expect(hasClass(englishBtn, 'font-semibold')).toBe(true);
    });

    it('should change language on selection', async () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      const germanBtn = query<HTMLButtonElement>(container, '[data-locale="de"]');
      click(germanBtn);

      // The click handler is async - need to wait for setLocale to complete
      // Use longer timeout since LanguageService.setLocale may need time
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(LanguageService.getCurrentLocale()).toBe('de');
    });

    it('should close dropdown after language selection', async () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      const germanBtn = query<HTMLButtonElement>(container, '[data-locale="de"]');
      click(germanBtn);

      // Wait for async language change to complete
      await waitForRender();

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });

    it('should emit language-changed event on selection', async () => {
      selector = new LanguageSelector(container);
      selector.init();

      const eventSpy = vi.fn();
      container.addEventListener('language-changed', eventSpy);

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      const germanBtn = query<HTMLButtonElement>(container, '[data-locale="de"]');
      click(germanBtn);

      // Wait for async language change to complete
      await waitForRender();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should close dropdown when selecting same language', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      click(button); // Open dropdown

      const englishBtn = query<HTMLButtonElement>(container, '[data-locale="en"]');
      click(englishBtn); // Select same language

      const dropdown = query(container, '#language-dropdown');
      expect(hasClass(dropdown, 'hidden')).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on toggle button', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query(container, '#language-selector-btn');
      expect(button?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have aria-haspopup on toggle button', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query(container, '#language-selector-btn');
      expect(getAttr(button, 'aria-haspopup')).toBe('true');
    });

    it('should update aria-expanded on toggle', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const button = query<HTMLButtonElement>(container, '#language-selector-btn');
      expect(getAttr(button, 'aria-expanded')).toBe('false');

      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('true');

      click(button);
      expect(getAttr(button, 'aria-expanded')).toBe('false');
    });
  });

  // ============================================================================
  // Language Display Tests
  // ============================================================================

  describe('Language Display', () => {
    it('should display native language names', () => {
      selector = new LanguageSelector(container);
      selector.init();

      // Check for German native name
      const germanBtn = query(container, '[data-locale="de"]');
      expect(germanBtn?.textContent).toContain('Deutsch');
    });

    it('should display English names for non-English languages', () => {
      selector = new LanguageSelector(container);
      selector.init();

      // Check for German English name
      const germanBtn = query(container, '[data-locale="de"]');
      expect(germanBtn?.textContent).toContain('German');
    });

    it('should not display English name for English option', () => {
      selector = new LanguageSelector(container);
      selector.init();

      const englishBtn = query(container, '[data-locale="en"]');
      // English should only show "English" once, not twice
      expect(englishBtn?.querySelectorAll('.text-xs').length).toBe(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      selector = new LanguageSelector(container);
      selector.init();

      selector.destroy();

      expect(query(container, '#language-selector-btn')).toBeNull();
    });

    it('should update when language changes externally', async () => {
      selector = new LanguageSelector(container);
      selector.init();

      // Simulate external language change
      await LanguageService.setLocale('de');
      await waitForRender();

      const germanBtn = query(container, '[data-locale="de"]');
      expect(hasClass(germanBtn, 'font-semibold')).toBe(true);
    });
  });
});
