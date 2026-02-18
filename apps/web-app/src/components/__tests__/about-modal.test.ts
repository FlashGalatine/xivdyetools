/**
 * XIV Dye Tools - AboutModal Unit Tests
 *
 * Tests the about modal component for displaying app information.
 * Covers rendering, content display, and modal lifecycle.
 *
 * @module components/__tests__/about-modal.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockShow = vi.fn().mockReturnValue('modal-id-123');
const mockDismiss = vi.fn();

vi.mock('@services/modal-service', () => ({
  ModalService: {
    show: mockShow,
    dismiss: mockDismiss,
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
}));

vi.mock('@shared/social-icons', () => ({
  ICON_GITHUB: '<svg></svg>',
  ICON_TWITTER: '<svg></svg>',
  ICON_TWITCH: '<svg></svg>',
  ICON_BLUESKY: '<svg></svg>',
  ICON_DISCORD: '<svg></svg>',
  ICON_PATREON: '<svg></svg>',
  ICON_KOFI: '<svg></svg>',
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CRYSTAL: '<svg></svg>',
}));

vi.mock('@shared/app-logo', () => ({
  LOGO_SPARKLES: '<svg></svg>',
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AboutModal', () => {
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
    it('should create AboutModal instance', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();
      expect(modal).toBeDefined();
    });

    it('should have show method', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();
      expect(typeof modal.show).toBe('function');
    });

    it('should have close method', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();
      expect(typeof modal.close).toBe('function');
    });
  });

  // ============================================================================
  // Modal Service Integration Tests
  // ============================================================================

  describe('Modal Service Integration', () => {
    it('should call ModalService.show when showing', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();

      modal.show();

      expect(mockShow).toHaveBeenCalledTimes(1);
    });

    it('should pass correct modal options', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();

      modal.show();

      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          size: 'md',
          closable: true,
          closeOnBackdrop: true,
          closeOnEscape: true,
        })
      );
    });

    it('should not show if already showing', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();

      modal.show();
      modal.show();

      expect(mockShow).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should dismiss modal when close is called', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();

      modal.show();
      modal.close();

      expect(mockDismiss).toHaveBeenCalledWith('modal-id-123');
    });

    it('should handle close when not showing', async () => {
      const { AboutModal } = await import('../about-modal');
      const modal = new AboutModal();

      // Should not throw
      expect(() => modal.close()).not.toThrow();
      expect(mockDismiss).not.toHaveBeenCalled();
    });
  });
});
