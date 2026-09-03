/**
 * XIV Dye Tools - ChangelogModal Unit Tests
 *
 * Tests the changelog modal component for displaying version history.
 * Covers rendering, changelog parsing, and version display.
 *
 * @module components/__tests__/changelog-modal.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockShowChangelog = vi.fn().mockReturnValue('modal-id-456');
const mockDismiss = vi.fn();

vi.mock('@services/modal-service', () => ({
  ModalService: {
    showChangelog: mockShowChangelog,
    dismiss: mockDismiss,
  },
}));

vi.mock('@services/storage-service', () => ({
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/constants', () => ({
  APP_NAME: 'XIV Dye Tools',
  APP_VERSION: '4.0.0',
  STORAGE_KEYS: {
    LAST_VERSION_VIEWED: 'lastVersionViewed',
  },
}));

// webapp-modals-21: the fixture always contained an entry for the mocked
// APP_VERSION ('4.0.0'), so `findIndex(...) === -1` was never true and BUG-043's
// fallback -- expand the NEWEST release when the running version is missing
// from the parsed changelog -- had no test. Hoisted and mutable so one test can
// take that entry away.
const { changelogEntriesFixture } = vi.hoisted(() => ({
  changelogEntriesFixture: [] as Array<Record<string, unknown>>,
}));

vi.mock('virtual:changelog', () => ({
  changelogEntries: changelogEntriesFixture,
}));

const DEFAULT_ENTRIES = [
  {
    version: '4.0.0',
    date: 'January 17, 2026',
    highlights: ['New feature 1', 'New feature 2'],
    sections: [
      { header: 'New feature 1', title: '', bullets: ['Does a thing', 'Does another thing'] },
      { header: 'New feature 2', title: '', bullets: ['Even more things'] },
    ],
  },
  {
    version: '3.3.0',
    date: 'January 8, 2026',
    highlights: ['Older feature'],
    sections: [{ header: 'Older feature', title: '', bullets: ['Legacy behavior'] }],
  },
] as Array<Record<string, unknown>>;

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ChangelogModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The module under test holds a reference to this exact array, so restore
    // it in place rather than reassigning.
    changelogEntriesFixture.length = 0;
    changelogEntriesFixture.push(...DEFAULT_ENTRIES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should create ChangelogModal instance', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();
      expect(modal).toBeDefined();
    });

    it('should have show method', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();
      expect(typeof modal.show).toBe('function');
    });

    it('should have close method', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();
      expect(typeof modal.close).toBe('function');
    });
  });

  // ============================================================================
  // Modal Service Integration Tests
  // ============================================================================

  describe('Static Methods', () => {
    it('should have shouldShow static method', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      expect(typeof ChangelogModal.shouldShow).toBe('function');
    });

    it('should have markAsViewed static method', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      expect(typeof ChangelogModal.markAsViewed).toBe('function');
    });

    it('should have reset static method', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      expect(typeof ChangelogModal.reset).toBe('function');
    });
  });

  // ============================================================================
  // Modal Service Integration Tests
  // ============================================================================

  describe('Modal Service Integration', () => {
    it('should call ModalService.showChangelog when showing', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      await modal.show();

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });

    // BUG-043: the popup opens at the running version, and when that version is
    // absent from the parsed changelog (entry forgotten, header typo) it must
    // expand the NEWEST release rather than opening on nothing.
    it('expands the newest release when the running version is missing', async () => {
      // Drop the 4.0.0 entry, leaving only 3.3.0.
      const [, older] = changelogEntriesFixture;
      changelogEntriesFixture.length = 0;
      changelogEntriesFixture.push(older);

      const { ChangelogModal } = await import('../changelog-modal');
      await new ChangelogModal().show({ mode: 'popup' });

      const { content } = mockShowChangelog.mock.calls[0][0] as { content: HTMLElement };
      // The EXPANDED release is rendered first, ahead of the collapsed
      // "past releases" list, so the leading version is the one that opened.
      expect(content.textContent?.startsWith('v3.3.0')).toBe(true);
      expect(content.textContent).toContain('Legacy behavior');
    });

    it('expands the running version when it IS present', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      await new ChangelogModal().show({ mode: 'popup' });

      const { content } = mockShowChangelog.mock.calls[0][0] as { content: HTMLElement };
      expect(content.textContent?.startsWith('v4.0.0')).toBe(true);
      expect(content.textContent).toContain('Does a thing');
    });

    it('should not show if already showing', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      await modal.show();
      await modal.show();

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });

    it('should open once when show() is called twice before the data resolves', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      await Promise.all([modal.show(), modal.show()]);

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });

    it('should not open when close() runs while the data is still loading', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      const opening = modal.show();
      modal.close();
      await opening;

      expect(mockShowChangelog).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should dismiss modal when close is called', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      await modal.show();
      modal.close();

      expect(mockDismiss).toHaveBeenCalledWith('modal-id-456');
    });

    it('should handle close when not showing', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      // Should not throw
      expect(() => modal.close()).not.toThrow();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Full History (header "What's New" button)
  // ============================================================================

  describe('Full history (showChangelogModal)', () => {
    // Restored 2026-09-02. Both tests were deleted on 2026-09-01 because their
    // cleanup called `closeChangelogModal`, which the same commit removed — but
    // the function UNDER test, `showChangelogModal`, is live: `v4-layout.ts`
    // calls it from the header's "What's New" button. The singleton is module
    // state, so resetting the module registry and re-importing gives each test a
    // fresh one without needing the removed closer.
    const freshModule = async (): Promise<typeof import('../changelog-modal')> => {
      vi.resetModules();
      const mod = await import('../changelog-modal');
      vi.clearAllMocks();
      return mod;
    };

    it('should render every changelog entry with a version heading', async () => {
      const { showChangelogModal } = await freshModule();

      await showChangelogModal();

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
      const config = mockShowChangelog.mock.calls[0][0] as { content: HTMLElement };
      // Full mode renders a "v<version> — <date>" heading for each parsed entry.
      expect(config.content.textContent).toContain('v4.0.0');
      expect(config.content.textContent).toContain('v3.3.0');
    });

    it('should reuse a single instance (singleton)', async () => {
      const { showChangelogModal } = await freshModule();

      await showChangelogModal();
      await showChangelogModal();

      // The second call is a no-op while the modal is already open.
      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });
  });
});
