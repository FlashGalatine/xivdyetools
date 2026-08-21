/**
 * XIV Dye Tools - v4 locale-switch regression tests (HC-SYS-007)
 *
 * Five v4 Lit components rendered localized text but never subscribed to
 * `LanguageService`, so their strings froze at whatever language was active
 * when they first rendered. `display-options-v4` is the sharpest case: its
 * parent DOES re-render on a language switch, but passes identical boolean
 * props, so Lit skips the child entirely — only the component's own
 * subscription can move it.
 *
 * The mock `t()` prefixes every key with the current locale, so "the component
 * re-rendered under the new language" is provable from the rendered text.
 * Removing either `LanguageService.subscribe(...)` call makes these fail: no
 * listener is registered, so `switchLocale()` reaches nothing.
 *
 * @module components/__tests__/v4/locale-switch.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/** Mutable locale + the real subscribe/notify contract, in miniature. */
let locale = 'en';
const listeners = new Set<() => void>();

const languageServiceMock = {
  t: (key: string) => `${locale}:${key}`,
  tInterpolate: (key: string, params: Record<string, string | number>) =>
    `${locale}:${key}:${Object.values(params).join(',')}`,
  getCurrentLocale: () => locale,
  getDyeName: () => undefined,
  getAcquisition: (acquisition: string) => `${locale}:ACQ:${acquisition}`,
  getCategory: (category: string) => `${locale}:CAT:${category}`,
  getCurrency: (currency: string) => `${locale}:CUR:${currency}`,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** Flip the language exactly as `LanguageService.setLocale()` does. */
const switchLocale = (next: string): void => {
  locale = next;
  listeners.forEach((listener) => listener());
};

/**
 * Drain every queued Lit update.
 *
 * A single `await el.updateComplete` is NOT enough: `BaseLitComponent`
 * sets the `isReady` @state inside `firstUpdated()`, so a second update is
 * already queued when the first one resolves (with `false`). Awaiting only
 * once leaves that render pending, and it would then pick up the new locale
 * on its own — making every assertion here pass even with the subscription
 * deleted. Loop until Lit reports a settled component (`true`).
 */
type Updatable = { updateComplete: Promise<boolean> };
const settle = async (el: Updatable): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    if (await el.updateComplete) return;
  }
  throw new Error('component never settled');
};

vi.mock('@services/index', () => ({
  LanguageService: languageServiceMock,
  StorageService: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  RouterService: { navigateTo: vi.fn() },
  ThemeService: { isDarkMode: vi.fn(() => false) },
}));

vi.mock('@services/language-service', () => ({
  LanguageService: languageServiceMock,
}));

vi.mock('@xivdyetools/core', () => ({
  ColorService: {
    hexToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })),
    rgbToHex: vi.fn(() => '#FF0000'),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToLab: vi.fn(() => ({ L: 50, a: 0, b: 0 })),
    hexToCmyk: vi.fn(() => ({ c: 0, m: 100, y: 100, k: 0 })),
    getDistanceForMethod: vi.fn(() => 0),
    isLightColor: vi.fn(() => false),
  },
  classifyBandTier: vi.fn(() => 'A'),
  getConsolidatedDyeName: vi.fn(() => 'General-purpose Dye'),
  getMarketItemID: vi.fn((dye: { itemID: number }) => dye.itemID),
  BAND_METHOD_DP: 2,
  DyeService: class MockDyeService {
    getAllDyes() {
      return [];
    }
    getDyeById() {
      return null;
    }
    getCategories() {
      return [];
    }
  },
  dyeDatabase: [],
}));

vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CONTEXT_MENU: '<svg></svg>',
}));

describe('v4 components follow a language switch', () => {
  let container: HTMLElement;

  beforeEach(() => {
    locale = 'en';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Unmounting runs disconnectedCallback, which must drop the listener.
    container.remove();
    locale = 'en';
  });

  it('re-renders <v4-result-card> labels (incl. the slot-picker keys)', async () => {
    await import('../../v4/result-card');
    const { makeCustomDye } = await import('@shared/custom-dye');

    const card = document.createElement('v4-result-card') as HTMLElement & {
      data?: unknown;
      showSlotPicker?: boolean;
      updateComplete: Promise<boolean>;
    };
    card.data = {
      dye: makeCustomDye('#aabbcc'),
      originalColor: '#aabbcc',
      matchedColor: '#aabbcc',
    };
    card.showSlotPicker = true;
    container.appendChild(card);
    await settle(card);

    // Default primary label is derived at render time, not frozen at construction.
    expect(card.shadowRoot?.textContent).toContain('en:common.selectDye');
    // The keyed slot-picker items (HC-V4-002).
    expect(card.shadowRoot?.textContent).toContain('en:resultCard.replaceSlotN:1');
    expect(card.shadowRoot?.textContent).toContain('en:resultCard.replaceSlotN:2');

    switchLocale('ja');
    await settle(card);

    const text = card.shadowRoot?.textContent ?? '';
    expect(text).toContain('ja:common.selectDye');
    expect(text).toContain('ja:resultCard.replaceSlotN:1');
    expect(text).not.toContain('en:common.selectDye');
    expect(text).not.toContain('en:resultCard.replaceSlotN');
  });

  it('keeps an explicit primary-action-label override across a language switch', async () => {
    await import('../../v4/result-card');
    const { makeCustomDye } = await import('@shared/custom-dye');

    const card = document.createElement('v4-result-card') as HTMLElement & {
      data?: unknown;
      primaryActionLabel?: string;
      updateComplete: Promise<boolean>;
    };
    card.data = {
      dye: makeCustomDye('#aabbcc'),
      originalColor: '#aabbcc',
      matchedColor: '#aabbcc',
    };
    card.primaryActionLabel = 'Caller Label';
    container.appendChild(card);
    await settle(card);

    expect(card.shadowRoot?.textContent).toContain('Caller Label');
    expect(card.shadowRoot?.textContent).not.toContain('common.selectDye');

    switchLocale('ja');
    await settle(card);

    // The override still wins — the default never overwrites what a tool set.
    expect(card.shadowRoot?.textContent).toContain('Caller Label');
    expect(card.shadowRoot?.textContent).not.toContain('common.selectDye');
  });

  it('re-renders <v4-display-options> even though its props never change', async () => {
    await import('../../v4/display-options-v4');

    const panel = document.createElement('v4-display-options') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    container.appendChild(panel);
    await settle(panel);

    expect(panel.shadowRoot?.textContent).toContain('en:config.colorFormats');

    // No prop changes at all — only the LanguageService notification.
    switchLocale('de');
    await settle(panel);

    expect(panel.shadowRoot?.textContent).toContain('de:config.colorFormats');
    expect(panel.shadowRoot?.textContent).not.toContain('en:config.colorFormats');
  });

  it('unsubscribes on disconnect', async () => {
    await import('../../v4/display-options-v4');

    const panel = document.createElement('v4-display-options');
    container.appendChild(panel);
    await settle(panel as HTMLElement & { updateComplete: Promise<boolean> });
    expect(listeners.size).toBeGreaterThan(0);

    panel.remove();
    expect(listeners.size).toBe(0);
  });
});
