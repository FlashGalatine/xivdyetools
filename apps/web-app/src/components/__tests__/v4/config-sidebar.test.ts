/**
 * XIV Dye Tools - ConfigSidebar Unit Tests
 *
 * Tests the V4 config sidebar Lit component for settings panels.
 * Covers rendering, config options, and persistence.
 *
 * @module components/__tests__/v4/config-sidebar.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  authService: {
    isAuthenticated: vi.fn().mockReturnValue(false),
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
  return {
    DEFAULT_DISPLAY_OPTIONS,
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
        showLabels: true,
        showHexValues: false,
        highContrastMode: false,
        displayOptions: DEFAULT_DISPLAY_OPTIONS,
      },
      comparison: { displayOptions: DEFAULT_DISPLAY_OPTIONS },
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
});
