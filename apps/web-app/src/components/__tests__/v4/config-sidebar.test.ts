/**
 * XIV Dye Tools - ConfigSidebar Unit Tests
 *
 * Tests the V4 config sidebar Lit component for settings panels.
 * Covers rendering, config options, and persistence.
 *
 * @module components/__tests__/v4/config-sidebar.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, nothing, type TemplateResult } from 'lit';
import { RACE_SUBRACES } from '@xivdyetools/types';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    getHarmonyType: (key: string) => `core:harmony:${key}`,
    getRace: (key: string) => `core:race:${key}`,
    getClan: (key: string) => `core:clan:${key}`,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(false),
    getUser: vi.fn().mockReturnValue(null),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
      setConfig: vi.fn(),
    }),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_SETTINGS: '<svg></svg>',
  ICON_CLOSE: '<svg></svg>',
}));

vi.mock('@shared/tool-config-types', () => {
  const DEFAULT_DISPLAY_OPTIONS = {
    showDyeName: true,
    showDeltaE: true,
    showPrice: false,
    showAcquisition: false,
  };
  const DEFAULT_DYE_FILTERS = {
    excludeMetallic: false,
    excludePastel: false,
    excludeDark: false,
    excludeCosmic: false,
    excludeIshgardian: false,
    excludeExpensive: false,
    excludeVendorDyes: false,
    excludeCraftDyes: false,
  };
  return {
    DEFAULT_DISPLAY_OPTIONS,
    DEFAULT_DYE_FILTERS,
    DEFAULT_CONFIGS: {
      global: { theme: '', displayOptions: DEFAULT_DISPLAY_OPTIONS },
      market: { selectedServer: 'Crystal', showPrices: false },
      advanced: { analyticsEnabled: false, performanceMode: false },
      harmony: {
        harmonyType: 'complementary',
        strictMatching: true,
        matchingMethod: 'oklab',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      extractor: {
        vibrancyBoost: true,
        maxColors: 4,
        dragThreshold: 5,
        matchingMethod: 'oklab',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      accessibility: {
        normalVision: true,
        deuteranopia: true,
        protanopia: true,
        tritanopia: true,
        achromatopsia: true,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      comparison: { matchThreshold: 5, displayOptions: DEFAULT_DISPLAY_OPTIONS },
      gradient: {
        stepCount: 4,
        interpolation: 'hsv',
        matchingMethod: 'oklab',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      mixer: {
        maxResults: 4,
        mixingMode: 'ryb',
        matchingMethod: 'oklab',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      presets: {
        showMyPresetsOnly: false,
        showFavorites: false,
        sortBy: 'popular',
        category: 'all',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      budget: {
        maxPrice: 100000,
        maxResults: 8,
        maxDeltaE: 50,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      swatch: {
        colorSheet: 'hairColors',
        race: 'SeekerOfTheSun',
        gender: 'Female',
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
    },
  };
});

vi.mock('@components/preset-submission-form', () => ({
  showPresetSubmissionForm: vi.fn(),
}));

describe('ConfigSidebar', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should be a custom element', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      expect(ConfigSidebar).toBeDefined();
    });

    it('should have correct class name', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      expect(ConfigSidebar.name).toBe('ConfigSidebar');
    });
  });

  // ============================================================================
  // Properties Tests
  // ============================================================================

  describe('Properties', () => {
    it('should have collapsed property', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      const sidebar = new ConfigSidebar();
      expect(sidebar.collapsed).toBe(false);
    });

    it('should have activeTool property', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      const sidebar = new ConfigSidebar();
      expect(sidebar.activeTool).toBe('harmony');
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(ConfigSidebar.prototype instanceof BaseLitComponent).toBe(true);
    });

    it('should have styles defined', async () => {
      const { ConfigSidebar } = await import('../../v4/config-sidebar');
      expect(ConfigSidebar.styles).toBeDefined();
    });
  });

  // ============================================================================
  // Avatar Fallback (BUG-003)
  // ============================================================================

  describe('avatarInitial', () => {
    it('returns the uppercased first character of a display name', async () => {
      const { avatarInitial } = await import('../../v4/config-sidebar');
      expect(avatarInitial('flash galatine')).toBe('F');
      expect(avatarInitial('  padded  ')).toBe('P');
    });

    it('takes a whole code point, not a UTF-16 unit', async () => {
      const { avatarInitial } = await import('../../v4/config-sidebar');
      // A surrogate pair: slicing by index would yield half of it and render
      // as a replacement character.
      expect(avatarInitial('𝓐melia')).toBe('𝓐');
      expect(avatarInitial('🍎 Apple')).toBe('🍎');
    });

    it('falls back to ? rather than emitting an empty chip', async () => {
      const { avatarInitial } = await import('../../v4/config-sidebar');
      expect(avatarInitial('')).toBe('?');
      expect(avatarInitial('   ')).toBe('?');
    });

    it('never depends on the user id', async () => {
      // The regression this guards. `AuthUser.id` is a `crypto.randomUUID()`
      // minted by the oauth worker, not a Discord snowflake, so the old
      // `parseInt(user.id) % 5` default-avatar guess produced
      // `embed/avatars/NaN.png` -- a 404 -- for every UUID beginning with a hex
      // letter. `BigInt` would have thrown outright on the same input.
      const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      expect(Number.isNaN(parseInt(uuid, 10))).toBe(true);
      expect(() => BigInt(uuid)).toThrow();

      const { avatarInitial } = await import('../../v4/config-sidebar');
      expect(avatarInitial('Amelia')).toBe('A');
    });
  });
});

describe('harmony type labels (TERM-003)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(nothing, container);
    container.remove();
  });

  it('labels every harmony option from core vocabulary, not web-app config.* keys', async () => {
    const { ConfigSidebar } = await import('../../v4/config-sidebar');
    // The harmony panel is rendered on its own: mounting the whole sidebar
    // would also render every other tool panel against empty mock config.
    const sidebar = new ConfigSidebar() as unknown as {
      renderHarmonyConfig(): TemplateResult;
    };
    render(sidebar.renderHarmonyConfig(), container);

    const select = container.querySelector('select.config-select') as HTMLSelectElement | null;
    expect(select).toBeTruthy();

    // Values stay the hyphenated ids the harmony generator understands; the
    // labels are core's camelCase vocabulary, so the sidebar and the result
    // cards / colour wheel say the same word for the same harmony.
    expect([...select!.options].map((o) => [o.value, o.textContent?.trim()])).toEqual([
      ['complementary', 'core:harmony:complementary'],
      ['analogous', 'core:harmony:analogous'],
      ['triadic', 'core:harmony:triadic'],
      ['split-complementary', 'core:harmony:splitComplementary'],
      ['tetradic', 'core:harmony:tetradic'],
      ['inverted-tetradic', 'core:harmony:invertedTetradic'],
      ['square', 'core:harmony:square'],
      ['monochromatic', 'core:harmony:monochromatic'],
      ['compound', 'core:harmony:compound'],
      ['shades', 'core:harmony:shades'],
    ]);
  });
});

describe('RACE_GROUPS (DEAD-024 adoption)', () => {
  it('has one group per race in the shared RACE_SUBRACES table, in the same order', async () => {
    const { RACE_GROUPS } = await import('../../v4/config-sidebar');
    expect(RACE_GROUPS.map((g) => g.subraces)).toEqual(
      Object.values(RACE_SUBRACES).map((subraces) => [...subraces])
    );
  });

  it('preserves the pre-adoption localization keys', async () => {
    const { RACE_GROUPS } = await import('../../v4/config-sidebar');
    expect(RACE_GROUPS.map((g) => g.raceKey)).toEqual([
      'hyur',
      'elezen',
      'lalafell',
      'miqote',
      'roegadyn',
      'auRa',
      'hrothgar',
      'viera',
    ]);
  });
});
