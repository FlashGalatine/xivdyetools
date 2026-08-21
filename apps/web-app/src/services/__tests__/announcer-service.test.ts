/**
 * XIV Dye Tools - AnnouncerService Unit Tests
 * Tests for screen reader announcement functionality
 */

import { AnnouncerService } from '../announcer-service';

/**
 * The announcer debounce timer fires late under CPU contention (parallel
 * turbo runs), so poll for the flushed text instead of one fixed sleep.
 */
async function waitForRegionText(regionId: string, expected: string): Promise<string> {
  const deadline = Date.now() + 3000;
  let text = '';
  while (Date.now() < deadline) {
    text = document.getElementById(regionId)?.textContent ?? '';
    if (text === expected) return text;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return text;
}

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

      expect(await waitForRegionText('sr-announcements-polite', 'Test message')).toBe(
        'Test message'
      );
    });

    it('should announce assertive message', async () => {
      AnnouncerService.announce('Urgent message', 'assertive');

      expect(await waitForRegionText('sr-announcements-assertive', 'Urgent message')).toBe(
        'Urgent message'
      );
    });

    it('should default to polite priority', async () => {
      AnnouncerService.announce('Default priority message');

      expect(await waitForRegionText('sr-announcements-polite', 'Default priority message')).toBe(
        'Default priority message'
      );
    });

    it('should trim message whitespace', async () => {
      AnnouncerService.announce('  Trimmed message  ');

      expect(await waitForRegionText('sr-announcements-polite', 'Trimmed message')).toBe(
        'Trimmed message'
      );
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

      const text = await waitForRegionText('sr-announcements-polite', 'Message 1. Message 2');
      expect(text).toBe('Message 1. Message 2');
    });

    it('should use latest assertive message when multiple are queued', async () => {
      AnnouncerService.announce('Urgent 1', 'assertive');
      AnnouncerService.announce('Urgent 2', 'assertive');

      const text = await waitForRegionText('sr-announcements-assertive', 'Urgent 2');
      expect(text).toBe('Urgent 2');
    });

    it('should handle mixed priority announcements', async () => {
      AnnouncerService.announce('Polite message', 'polite');
      AnnouncerService.announce('Assertive message', 'assertive');

      expect(await waitForRegionText('sr-announcements-polite', 'Polite message')).toBe(
        'Polite message'
      );
      expect(await waitForRegionText('sr-announcements-assertive', 'Assertive message')).toBe(
        'Assertive message'
      );
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
