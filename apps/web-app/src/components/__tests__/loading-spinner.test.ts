/**
 * XIV Dye Tools - LoadingSpinner Unit Tests
 *
 * Tests the loading spinner component including sizes, messages,
 * and accessibility features.
 *
 * @module components/__tests__/loading-spinner.test
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

import {
  LoadingSpinner,
  createInlineSpinner,
  createBlockSpinner,
  getSpinnerHTML,
} from '../loading-spinner';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
  getAttr,
  getText,
  hasClass,
} from '../../__tests__/component-utils';

describe('LoadingSpinner', () => {
  let container: HTMLElement;
  let spinner: LoadingSpinner | null;

  beforeEach(() => {
    container = createTestContainer();
    spinner = null;
  });

  afterEach(() => {
    if (spinner) {
      try {
        spinner.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering', () => {
    it('should render spinner element', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const svg = query(container, 'svg.loading-spinner');
      expect(svg).not.toBeNull();
    });

    it('should render with default medium size', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const sizeWrapper = query(container, '.spinner-md');
      expect(sizeWrapper).not.toBeNull();
    });

    it('should render small spinner', () => {
      spinner = new LoadingSpinner(container, { size: 'sm' });
      spinner.init();

      const sizeWrapper = query(container, '.spinner-sm');
      expect(sizeWrapper).not.toBeNull();
    });

    it('should render large spinner', () => {
      spinner = new LoadingSpinner(container, { size: 'lg' });
      spinner.init();

      const sizeWrapper = query(container, '.spinner-lg');
      expect(sizeWrapper).not.toBeNull();
    });

    it('should render with custom message', () => {
      spinner = new LoadingSpinner(container, { message: 'Loading dyes...' });
      spinner.init();

      const messageEl = query(container, 'span:not(.sr-only)');
      expect(getText(messageEl)).toBe('Loading dyes...');
    });

    it('should render screen reader text when no message provided', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const srOnly = query(container, '.sr-only');
      expect(srOnly).not.toBeNull();
      expect(getText(srOnly)).toBe('Loading...');
    });

    it('should not render sr-only when message is provided', () => {
      spinner = new LoadingSpinner(container, { message: 'Please wait' });
      spinner.init();

      const srOnly = query(container, '.sr-only');
      expect(srOnly).toBeNull();
    });
  });

  // ============================================================================
  // Inline Mode Tests
  // ============================================================================

  describe('Inline Mode', () => {
    it('should render inline spinner with inline-flex', () => {
      spinner = new LoadingSpinner(container, { inline: true });
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(hasClass(wrapper, 'inline-flex')).toBe(true);
    });

    it('should render block spinner with flex-col by default', () => {
      spinner = new LoadingSpinner(container, { inline: false });
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(hasClass(wrapper, 'flex-col')).toBe(true);
    });

    it('should default to block mode', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(hasClass(wrapper, 'flex-col')).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(wrapper).not.toBeNull();
    });

    it('should have aria-live="polite"', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(getAttr(wrapper, 'aria-live')).toBe('polite');
    });

    it('should have aria-busy="true"', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      const wrapper = query(container, '[role="status"]');
      expect(getAttr(wrapper, 'aria-busy')).toBe('true');
    });
  });

  // ============================================================================
  // Update Methods Tests
  // ============================================================================

  describe('Update Methods', () => {
    it('should update message with setMessage()', () => {
      spinner = new LoadingSpinner(container, { message: 'Initial' });
      spinner.init();

      spinner.setMessage('Updated message');

      const messageEl = query(container, 'span:not(.sr-only)');
      expect(getText(messageEl)).toBe('Updated message');
    });

    it('should update size with setSize()', () => {
      spinner = new LoadingSpinner(container, { size: 'sm' });
      spinner.init();

      expect(query(container, '.spinner-sm')).not.toBeNull();

      spinner.setSize('lg');

      expect(query(container, '.spinner-lg')).not.toBeNull();
      expect(query(container, '.spinner-sm')).toBeNull();
    });

    it('should clear message and show sr-only text', () => {
      spinner = new LoadingSpinner(container, { message: 'Loading' });
      spinner.init();

      spinner.setMessage('');

      const srOnly = query(container, '.sr-only');
      expect(srOnly).not.toBeNull();
    });
  });

  // ============================================================================
  // Factory Functions Tests
  // ============================================================================

  describe('Factory Functions', () => {
    describe('createInlineSpinner', () => {
      it('should create inline spinner with small size', () => {
        spinner = createInlineSpinner(container);

        expect(query(container, '.spinner-sm')).not.toBeNull();
        expect(hasClass(query(container, '[role="status"]'), 'inline-flex')).toBe(true);
      });

      it('should accept optional message', () => {
        spinner = createInlineSpinner(container, 'Loading...');

        const messageEl = query(container, 'span:not(.sr-only)');
        expect(getText(messageEl)).toBe('Loading...');
      });
    });

    describe('createBlockSpinner', () => {
      it('should create block spinner with medium size', () => {
        spinner = createBlockSpinner(container);

        expect(query(container, '.spinner-md')).not.toBeNull();
        expect(hasClass(query(container, '[role="status"]'), 'flex-col')).toBe(true);
      });

      it('should accept optional message', () => {
        spinner = createBlockSpinner(container, 'Please wait...');

        const messageEl = query(container, 'span:not(.sr-only)');
        expect(getText(messageEl)).toBe('Please wait...');
      });
    });

    describe('getSpinnerHTML', () => {
      it('should return valid HTML string', () => {
        const html = getSpinnerHTML();

        expect(html).toContain('role="status"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('svg');
      });

      it('should include size class', () => {
        const smHtml = getSpinnerHTML('sm');
        const mdHtml = getSpinnerHTML('md');
        const lgHtml = getSpinnerHTML('lg');

        expect(smHtml).toContain('spinner-sm');
        expect(mdHtml).toContain('spinner-md');
        expect(lgHtml).toContain('spinner-lg');
      });

      it('should include message when provided', () => {
        const html = getSpinnerHTML('md', 'Loading data...');

        expect(html).toContain('Loading data...');
      });

      it('should include sr-only text when no message', () => {
        const html = getSpinnerHTML('md');

        expect(html).toContain('sr-only');
        expect(html).toContain('Loading...');
      });
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      spinner = new LoadingSpinner(container);
      spinner.init();

      expect(query(container, '[role="status"]')).not.toBeNull();

      spinner.destroy();

      expect(query(container, '[role="status"]')).toBeNull();
    });

    it('should re-render on update', () => {
      spinner = new LoadingSpinner(container, { message: 'First' });
      spinner.init();

      expect(getText(query(container, 'span:not(.sr-only)'))).toBe('First');

      // Directly update options and call update
      spinner.setMessage('Second');

      expect(getText(query(container, 'span:not(.sr-only)'))).toBe('Second');
    });
  });
});
