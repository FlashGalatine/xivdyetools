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

vi.mock('virtual:changelog', () => ({
  changelogEntries: [
    {
      version: '4.0.0',
      date: '2024-01-15',
      highlights: ['New feature 1', 'New feature 2'],
    },
  ],
}));

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

      modal.show();

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });

    it('should not show if already showing', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      modal.show();
      modal.show();

      expect(mockShowChangelog).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should dismiss modal when close is called', async () => {
      const { ChangelogModal } = await import('../changelog-modal');
      const modal = new ChangelogModal();

      modal.show();
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
});
