/**
 * XIV Dye Tools - AboutModal Unit Tests
 *
 * Tests the about modal component for displaying app information.
 * Covers rendering, content display, and modal lifecycle.
 *
 * @module components/__tests__/about-modal.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LocaleCode } from '@shared/i18n-types';

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

/** I18N-010: the app locale `createPoliciesRow()` reads for the policy links. */
let mockLocale = 'en';

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => mockTranslations[key] ?? key,
    getCurrentLocale: () => mockLocale,
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
  // Policy Links
  // ============================================================================

  // The app serves no route for Privacy or Terms, so this row is the only path
  // from inside the product to either document. A silent removal would leave
  // the policies unreachable without anything else going red, which is what
  // these assertions exist to prevent.
  describe('Policy links', () => {
    const BASE = 'https://github.com/FlashGalatine/xivdyetools/blob/main/apps/web-app';

    afterEach(() => {
      for (const key of Object.keys(mockTranslations)) delete mockTranslations[key];
      mockLocale = 'en';
    });

    const showContent = async (): Promise<HTMLElement> => {
      const { AboutModal } = await import('../about-modal');
      new AboutModal().show();
      return mockShow.mock.calls[0][0].content as HTMLElement;
    };

    it('links to both policy documents', async () => {
      const content = await showContent();

      expect(content.querySelector(`a[href="${BASE}/PRIVACY.md"]`)).not.toBeNull();
      expect(content.querySelector(`a[href="${BASE}/TERMS_OF_SERVICE.md"]`)).not.toBeNull();
    });

    it('opens each policy in a new tab without leaking the referrer', async () => {
      const content = await showContent();

      for (const file of ['PRIVACY.md', 'TERMS_OF_SERVICE.md']) {
        const anchor = content.querySelector<HTMLAnchorElement>(`a[href="${BASE}/${file}"]`);
        expect(anchor?.target).toBe('_blank');
        expect(anchor?.rel).toContain('noopener');
        expect(anchor?.rel).toContain('noreferrer');
      }
    });

    it('takes both labels from the locale, not hardcoded English', async () => {
      mockTranslations['about.privacyPolicy'] = 'Datenschutz';
      mockTranslations['about.termsOfService'] = 'Nutzungsbedingungen';
      const content = await showContent();

      expect(content.querySelector(`a[href="${BASE}/PRIVACY.md"]`)?.textContent).toBe(
        'Datenschutz'
      );
      expect(content.querySelector(`a[href="${BASE}/TERMS_OF_SERVICE.md"]`)?.textContent).toBe(
        'Nutzungsbedingungen'
      );
    });

    // ==========================================================================
    // I18N-010: link the VIEWER's locale variant, not always the English file.
    // ==========================================================================

    it('links the ja variant of both documents under a ja app locale', async () => {
      mockLocale = 'ja';
      const content = await showContent();

      expect(content.querySelector(`a[href="${BASE}/PRIVACY.ja.md"]`)).not.toBeNull();
      expect(content.querySelector(`a[href="${BASE}/TERMS_OF_SERVICE.ja.md"]`)).not.toBeNull();
      // Never both — a stale build would otherwise still pass "links to both
      // policy documents" above by finding the English hrefs instead.
      expect(content.querySelector(`a[href="${BASE}/PRIVACY.md"]`)).toBeNull();
      expect(content.querySelector(`a[href="${BASE}/TERMS_OF_SERVICE.md"]`)).toBeNull();
    });

    it('still links the English file for the en app locale', async () => {
      mockLocale = 'en';
      const content = await showContent();

      expect(content.querySelector(`a[href="${BASE}/PRIVACY.md"]`)).not.toBeNull();
      expect(content.querySelector(`a[href="${BASE}/TERMS_OF_SERVICE.md"]`)).not.toBeNull();
    });
  });

  // ============================================================================
  // policyDocFile (I18N-010)
  // ============================================================================

  describe('policyDocFile', () => {
    it.each(['ja', 'de', 'fr', 'ko', 'zh'] as const)(
      'returns the %s sibling for PRIVACY and TERMS_OF_SERVICE',
      async (locale) => {
        const { policyDocFile } = await import('../about-modal');

        expect(policyDocFile('PRIVACY', locale)).toBe(`PRIVACY.${locale}.md`);
        expect(policyDocFile('TERMS_OF_SERVICE', locale)).toBe(`TERMS_OF_SERVICE.${locale}.md`);
      }
    );

    it('returns the unsuffixed English file for en', async () => {
      const { policyDocFile } = await import('../about-modal');

      expect(policyDocFile('PRIVACY', 'en')).toBe('PRIVACY.md');
      expect(policyDocFile('TERMS_OF_SERVICE', 'en')).toBe('TERMS_OF_SERVICE.md');
    });

    it('falls back to the English file for a locale outside the supported list', async () => {
      const { policyDocFile } = await import('../about-modal');

      // Cast past the type: the parity script guarantees exactly five
      // translated locales exist, but the fallback must still be safe against
      // a value the type system did not catch.
      expect(policyDocFile('PRIVACY', 'xx' as unknown as LocaleCode)).toBe('PRIVACY.md');
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
