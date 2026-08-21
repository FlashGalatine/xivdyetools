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
  // The core-vocabulary lookups the sweep's components reach for.
  getHarmonyType: (key: string) => `${locale}:HARMONY:${key}`,
  getVisionType: (key: string) => `${locale}:VISION:${key}`,
  getRace: (key: string) => `${locale}:RACE:${key}`,
  getClan: (key: string) => `${locale}:CLAN:${key}`,
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

// Spread the real barrel: the sweep mounts components that reach services the
// four targeted tests never touch (authService, APIService, ...), and stubbing
// them one by one turns every new dependency into a mystery mock error.
vi.mock('@services/index', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

// The sweep at the bottom imports every v4 module, which between them reach far
// more of `@xivdyetools/core` than the four targeted tests do. Spreading the
// real module keeps that surface intact while the overrides below still pin the
// handful of values these assertions depend on.
vi.mock('@xivdyetools/core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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
    getByStainId() {
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

vi.mock('@shared/ui-icons', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

// ============================================================================
// Sweep: every custom element registered by src/components/v4/
// ============================================================================

/**
 * The four tests above pin the components the audit named. This block is the
 * guardrail that stops the NEXT one from slipping through.
 *
 * It imports every module in `src/components/v4/`, collects the custom elements
 * they register, and fails if any tag is not accounted for by one of the three
 * lists below. A new v4 component therefore cannot be added without someone
 * deciding, in writing, whether it follows the locale.
 *
 * "Followed the switch" is checked two ways, because either alone can lie: the
 * component's own `requestUpdate` was called (so a subscription exists), and no
 * `en:` text is left in its shadow root (so the re-render reached the DOM).
 *
 * Nothing is skipped silently — `it.skip` and bare `continue` are deliberately
 * absent. A component that cannot be exercised has to appear in `EXCLUDED`
 * with the reason, and one that is known-broken in `NOT_YET_LOCALE_AWARE`.
 */

/**
 * Elements the sweep cannot mount, with the reason each.
 *
 * Empty on purpose: as of 2026-08-21 every v4 element mounts bare in jsdom.
 * `v4-config-sidebar` was expected to need a `ConfigController`, but it
 * tolerates a bare mount, so it is exercised like the rest.
 */
const EXCLUDED: Record<string, string> = {};

/**
 * Elements that render localized text but do NOT subscribe — open defects, not
 * intended behaviour. The assertion below is inverted so the ledger stays
 * honest: fix one and this suite goes red, which is the prompt to move its tag
 * up into `LOCALE_AWARE`.
 *
 * All three are the HC-SYS-007 defect class that the tests at the top of this
 * file were written for; they were outside the remediation task that added the
 * sweep, and are recorded here rather than quietly excused.
 */
const NOT_YET_LOCALE_AWARE: Record<string, string> = {
  'v4-color-wheel':
    'renders 8 localized strings (harmony.* labels, the base-colour prompt) but never calls LanguageService.subscribe()',
  'v4-range-slider':
    'aria-label falls back to LanguageService.t("aria.slider") with no subscription',
  'v4-toggle-switch':
    'aria-label falls back to LanguageService.t("aria.toggle") with no subscription',
};

/** Elements that must follow a language switch. */
const LOCALE_AWARE = [
  'dye-palette-drawer',
  'v4-app-header',
  'v4-config-sidebar',
  'v4-display-options',
  'v4-dye-filters',
  'v4-layout-shell',
  'v4-preset-card',
  'v4-preset-detail',
  'v4-preset-tool',
  'v4-result-card',
  'v4-share-button',
];

/**
 * Every tag registered in this test file's realm.
 *
 * The wrapper is installed at module scope, not inside the sweep: the tests
 * above already import `result-card` and `display-options-v4`, and a wrapper
 * installed later would miss those two registrations entirely — the sweep would
 * then "know about" 11 of the 14 elements and still pass.
 */
const registeredTags: string[] = [];
const nativeDefine = customElements.define.bind(customElements);
customElements.define = ((
  tag: string,
  constructor: CustomElementConstructor,
  options?: ElementDefinitionOptions
) => {
  registeredTags.push(tag);
  return nativeDefine(tag, constructor, options);
}) as typeof customElements.define;

const v4Modules = import.meta.glob('../../v4/*.ts');
let allImported: Promise<void> | null = null;
const importAllV4Modules = (): Promise<void> => {
  allImported ??= (async () => {
    for (const load of Object.values(v4Modules)) await load();
  })();
  return allImported;
};

/** Mount a tag, let it settle, and report whether a locale flip moved it. */
const mountAndSwitch = async (
  tag: string,
  container: HTMLElement
): Promise<{ rerendered: boolean; text: string }> => {
  const element = document.createElement(tag) as HTMLElement & {
    updateComplete: Promise<boolean>;
    requestUpdate: () => void;
  };
  container.appendChild(element);
  await settle(element);

  const rerender = vi.spyOn(element, 'requestUpdate');
  switchLocale('ja');
  await settle(element);

  return {
    rerendered: rerender.mock.calls.length > 0,
    text: element.shadowRoot?.textContent ?? '',
  };
};

describe('every v4 custom element is accounted for', () => {
  let container: HTMLElement;

  beforeEach(() => {
    locale = 'en';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    locale = 'en';
  });

  it('covers every element the v4 directory registers', async () => {
    await importAllV4Modules();
    const expected = [
      ...LOCALE_AWARE,
      ...Object.keys(NOT_YET_LOCALE_AWARE),
      ...Object.keys(EXCLUDED),
    ];
    expect([...new Set(registeredTags)].sort()).toEqual([...expected].sort());
  });

  it.each(LOCALE_AWARE)('<%s> re-renders when the locale changes', async (tag) => {
    await importAllV4Modules();
    const { rerendered, text } = await mountAndSwitch(tag, container);

    expect(rerendered, `${tag} never re-rendered — is LanguageService.subscribe() wired up?`).toBe(
      true
    );
    expect(text, `${tag} still shows en: text after the switch`).not.toMatch(/\ben:/);
  });

  it.each(Object.entries(NOT_YET_LOCALE_AWARE))(
    '<%s> does NOT yet follow a language switch (open defect: %s)',
    async (tag) => {
      await importAllV4Modules();
      const { rerendered } = await mountAndSwitch(tag, container);

      expect(
        rerendered,
        `${tag} now re-renders on a language switch — move it into LOCALE_AWARE and delete its NOT_YET_LOCALE_AWARE entry`
      ).toBe(false);
    }
  );
});
