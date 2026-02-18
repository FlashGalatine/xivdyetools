/**
 * XIV Dye Tools - AnnouncerService Unit Tests
 * Tests for screen reader announcement functionality
 */

import { AnnouncerService } from '../announcer-service';

describe('AnnouncerService', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a container element for initialization
    container = document.createElement('div');
    document.body.appendChild(container);

    // Destroy any existing service state
    AnnouncerService.destroy();
  });

  afterEach(() => {
    AnnouncerService.destroy();
    container.remove();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize with container', () => {
      AnnouncerService.init(container);

      const politeRegion = document.getElementById('sr-announcements-polite');
      const assertiveRegion = document.getElementById('sr-announcements-assertive');

      expect(politeRegion).toBeTruthy();
      expect(assertiveRegion).toBeTruthy();
    });

    it('should create polite region with correct attributes', () => {
      AnnouncerService.init(container);

      const politeRegion = document.getElementById('sr-announcements-polite');

      expect(politeRegion?.getAttribute('aria-live')).toBe('polite');
      expect(politeRegion?.getAttribute('aria-atomic')).toBe('true');
      expect(politeRegion?.getAttribute('aria-relevant')).toBe('additions text');
      expect(politeRegion?.classList.contains('sr-only')).toBe(true);
    });

    it('should create assertive region with correct attributes', () => {
      AnnouncerService.init(container);

      const assertiveRegion = document.getElementById('sr-announcements-assertive');

      expect(assertiveRegion?.getAttribute('role')).toBe('alert');
      expect(assertiveRegion?.getAttribute('aria-live')).toBe('assertive');
      expect(assertiveRegion?.getAttribute('aria-atomic')).toBe('true');
      expect(assertiveRegion?.classList.contains('sr-only')).toBe(true);
    });

    it('should not re-initialize if already initialized', () => {
      AnnouncerService.init(container);
      const firstPoliteRegion = document.getElementById('sr-announcements-polite');

      AnnouncerService.init(container);
      const secondPoliteRegion = document.getElementById('sr-announcements-polite');

      expect(firstPoliteRegion).toBe(secondPoliteRegion);
    });
  });

  // ============================================================================
  // Announcement Tests
  // ============================================================================

  describe('announce', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce polite message', async () => {
      AnnouncerService.announce('Test message', 'polite');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Test message');
    });

    it('should announce assertive message', async () => {
      AnnouncerService.announce('Urgent message', 'assertive');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('sr-announcements-assertive');
      expect(assertiveRegion?.textContent).toBe('Urgent message');
    });

    it('should default to polite priority', async () => {
      AnnouncerService.announce('Default priority message');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Default priority message');
    });

    it('should trim message whitespace', async () => {
      AnnouncerService.announce('  Trimmed message  ');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Trimmed message');
    });

    it('should not announce empty messages', async () => {
      AnnouncerService.announce('');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('');
    });

    it('should not announce whitespace-only messages', async () => {
      AnnouncerService.announce('   ');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('');
    });

    it('should combine multiple polite announcements', async () => {
      AnnouncerService.announce('Message 1', 'polite');
      AnnouncerService.announce('Message 2', 'polite');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Message 1. Message 2');
    });

    it('should use latest assertive message when multiple are queued', async () => {
      AnnouncerService.announce('Urgent 1', 'assertive');
      AnnouncerService.announce('Urgent 2', 'assertive');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('sr-announcements-assertive');
      expect(assertiveRegion?.textContent).toBe('Urgent 2');
    });

    it('should handle mixed priority announcements', async () => {
      AnnouncerService.announce('Polite message', 'polite');
      AnnouncerService.announce('Assertive message', 'assertive');

      // Wait for debounce (150ms) + extra time for requestAnimationFrame callbacks
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Additional wait for RAF to execute (jsdom implements RAF as setTimeout)
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const politeRegion = document.getElementById('sr-announcements-polite');
      const assertiveRegion = document.getElementById('sr-announcements-assertive');

      expect(politeRegion?.textContent).toBe('Polite message');
      expect(assertiveRegion?.textContent).toBe('Assertive message');
    });
  });

  // ============================================================================
  // Convenience Method Tests
  // ============================================================================

  describe('announceResults', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce result count', async () => {
      AnnouncerService.announceResults(5, 'matching dyes');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Found 5 matching dyes');
    });

    it('should announce no results found', async () => {
      AnnouncerService.announceResults(0, 'matching dyes');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('No matching dyes found');
    });
  });

  describe('announceSelection', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce selection with assertive priority', async () => {
      AnnouncerService.announceSelection('Snow White');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('sr-announcements-assertive');
      expect(assertiveRegion?.textContent).toBe('Snow White selected');
    });
  });

  describe('announceDeselection', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce deselection', async () => {
      AnnouncerService.announceDeselection('Snow White');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Snow White deselected');
    });
  });

  describe('announceError', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce error with assertive priority', async () => {
      AnnouncerService.announceError('Failed to load prices');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('sr-announcements-assertive');
      expect(assertiveRegion?.textContent).toBe('Error: Failed to load prices');
    });
  });

  describe('announceSuccess', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce success message', async () => {
      AnnouncerService.announceSuccess('Palette saved successfully');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Palette saved successfully');
    });
  });

  describe('announceLoading', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce loading state', async () => {
      AnnouncerService.announceLoading('market prices');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Loading market prices...');
    });
  });

  describe('announceLoaded', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce loaded state', async () => {
      AnnouncerService.announceLoaded('Market prices');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Market prices loaded');
    });
  });

  describe('announceFilterChange', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce filter change with string value', async () => {
      AnnouncerService.announceFilterChange('Category', 'Red');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Category filter Red');
    });

    it('should announce filter enabled state', async () => {
      AnnouncerService.announceFilterChange('Premium only', true);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Premium only filter enabled');
    });

    it('should announce filter disabled state', async () => {
      AnnouncerService.announceFilterChange('Premium only', false);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Premium only filter disabled');
    });

    it('should include result count if provided', async () => {
      AnnouncerService.announceFilterChange('Category', 'Red', 15);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Category filter Red. 15 items visible');
    });
  });

  describe('announceNavigation', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce navigation with assertive priority', async () => {
      AnnouncerService.announceNavigation('Harmony Generator');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const assertiveRegion = document.getElementById('sr-announcements-assertive');
      expect(assertiveRegion?.textContent).toBe('Navigated to Harmony Generator');
    });
  });

  describe('announceCopy', () => {
    beforeEach(() => {
      AnnouncerService.init(container);
    });

    it('should announce copy action', async () => {
      AnnouncerService.announceCopy('Hex color');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const politeRegion = document.getElementById('sr-announcements-polite');
      expect(politeRegion?.textContent).toBe('Hex color copied to clipboard');
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should remove live regions from DOM', () => {
      AnnouncerService.init(container);

      expect(document.getElementById('sr-announcements-polite')).toBeTruthy();
      expect(document.getElementById('sr-announcements-assertive')).toBeTruthy();

      AnnouncerService.destroy();

      expect(document.getElementById('sr-announcements-polite')).toBeNull();
      expect(document.getElementById('sr-announcements-assertive')).toBeNull();
    });

    it('should allow re-initialization after destroy', () => {
      AnnouncerService.init(container);
      AnnouncerService.destroy();
      AnnouncerService.init(container);

      expect(document.getElementById('sr-announcements-polite')).toBeTruthy();
      expect(document.getElementById('sr-announcements-assertive')).toBeTruthy();
    });
  });

  // ============================================================================
  // Not Initialized Tests
  // ============================================================================

  describe('Not Initialized', () => {
    it('should handle announcement when not initialized', async () => {
      // Don't initialize - just call announce
      AnnouncerService.announce('Test message');

      // Should not throw, but message will be lost (logged as warning)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // No regions should exist
      expect(document.getElementById('sr-announcements-polite')).toBeNull();
    });
  });
});
