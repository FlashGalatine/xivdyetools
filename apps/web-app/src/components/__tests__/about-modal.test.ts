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

/** Overrides for the key-echoing default, so a test can supply real copy. */
const mockTranslations: Record<string, string> = {};

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => mockTranslations[key] ?? key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/constants', () => ({
  APP_NAME: 'XIV Dye Tools',
  APP_VERSION: '4.0.0',
  BUILD_DATE: '2026.08.07',
}));

vi.mock('@services/dye-service-wrapper', () => ({
  dyeService: {
    getAllDyes: () => new Array(125).fill({}),
  },
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
  ICON_NETWORK: '<svg></svg>',
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
          eyebrow: 'XIV DYE TOOLS',
          subtitle: 'about.subtitle',
          confirmText: 'common.close',
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
  // Credits
  // ============================================================================

  describe('Credits', () => {
    afterEach(() => {
      for (const key of Object.keys(mockTranslations)) delete mockTranslations[key];
    });

    it('renders the credit anchor at the {link} placeholder, not always last', async () => {
      // ja/ko/zh put the attribution straight after a colon; the anchor has to
      // land where the sentence puts it, so the copy carries a placeholder.
      mockTranslations['footer.universalisCredit'] = 'before {link} after';
      const { AboutModal } = await import('../about-modal');
      new AboutModal().show();

      const content = mockShow.mock.calls[0][0].content as HTMLElement;
      const anchor = content.querySelector('a[href="https://universalis.app/"]');
      expect(anchor).not.toBeNull();
      const line = anchor?.parentElement;
      expect(line?.textContent).toBe('before universalis.app after');
      expect(line?.childNodes[0]?.textContent).toBe('before ');
      expect(line?.childNodes[1]).toBe(anchor);
      expect(line?.childNodes[2]?.textContent).toBe(' after');
    });

    it('keeps the separator space when the copy carries no placeholder', async () => {
      // Degraded path (a value that predates the placeholder, or a missing key
      // echoing itself back) must not run the host into the sentence.
      mockTranslations['footer.universalisCredit'] = 'Market Board data provided by';
      const { AboutModal } = await import('../about-modal');
      new AboutModal().show();

      const content = mockShow.mock.calls[0][0].content as HTMLElement;
      const anchor = content.querySelector('a[href="https://universalis.app/"]');
      expect(anchor?.parentElement?.textContent).toBe(
        'Market Board data provided by universalis.app'
      );
    });

    it('renders the anchor last when the placeholder ends the sentence', async () => {
      mockTranslations['about.spectralCredit'] = 'Realistic paint mixing by {link}';
      const { AboutModal } = await import('../about-modal');
      new AboutModal().show();

      const content = mockShow.mock.calls[0][0].content as HTMLElement;
      const anchor = content.querySelector('a[href="https://github.com/rvanwijnen/spectral.js"]');
      const line = anchor?.parentElement;
      expect(line?.textContent).toBe('Realistic paint mixing by spectral.js');
      expect(line?.lastChild).toBe(anchor);
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
