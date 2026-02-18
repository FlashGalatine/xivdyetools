/**
 * XIV Dye Tools - HarmonyType Unit Tests
 *
 * Tests the harmony type component for displaying color harmony matches.
 * Covers rendering, harmony display, deviance scoring, and interactions.
 *
 * @module components/__tests__/harmony-type.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarmonyType, HarmonyTypeInfo } from '../harmony-type';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getCategory: (category: string) => category,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  ColorService: {
    hexToRgb: vi.fn((hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      return { r, g, b };
    }),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
  },
  ThemeService: {
    getCurrentThemeObject: vi.fn().mockReturnValue({ isDark: false }),
  },
  CollectionService: {
    isFavorite: vi.fn().mockReturnValue(false),
    toggleFavorite: vi.fn(),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
  },
  APIService: {
    formatPrice: vi.fn((price: number) => `${price.toLocaleString()} Gil`),
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
  ICON_STAR: '<svg></svg>',
  ICON_STAR_FILLED: '<svg></svg>',
}));

vi.mock('@shared/harmony-icons', () => ({
  HARMONY_ICONS: {
    complementary: '<svg data-icon="complementary"></svg>',
    analogous: '<svg data-icon="analogous"></svg>',
    triadic: '<svg data-icon="triadic"></svg>',
    splitComplementary: '<svg data-icon="split"></svg>',
    tetradic: '<svg data-icon="tetradic"></svg>',
  },
}));

vi.mock('../color-wheel-display', () => ({
  ColorWheelDisplay: class MockColorWheelDisplay {
    init() {}
    destroy() {}
  },
}));

vi.mock('../dye-action-dropdown', () => ({
  createDyeActionDropdown: vi.fn().mockImplementation(() => {
    const div = document.createElement('div');
    div.className = 'dye-action-dropdown';
    return div;
  }),
}));

vi.mock('../info-tooltip', () => ({
  addInfoIconTo: vi.fn(),
  TOOLTIP_CONTENT: {},
}));

describe('HarmonyType', () => {
  let container: HTMLElement;
  let harmony: HarmonyType | null;

  const createHarmonyInfo = (overrides: Partial<HarmonyTypeInfo> = {}): HarmonyTypeInfo => ({
    id: 'complementary',
    name: 'Complementary',
    description: 'Colors opposite on the color wheel',
    icon: 'complementary', // Key into HARMONY_ICONS
    ...overrides,
  });

  const createMatchedDyes = (dyes = mockDyes.slice(0, 2)) => {
    return dyes.map((dye, index) => ({
      dye,
      deviance: 5 + index * 5, // 5, 10, 15, etc.
    }));
  };

  beforeEach(() => {
    container = createTestContainer();
    harmony = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (harmony) {
      try {
        harmony.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render harmony type container', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render harmony type name', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo({ name: 'Complementary' }),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      expect(container.textContent).toContain('Complementary');
    });

    it('should render as a card with shadow', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      const card = query(container, '.shadow-md');
      expect(card).not.toBeNull();
    });
  });

  // ============================================================================
  // Matched Dyes Tests
  // ============================================================================

  describe('Matched Dyes', () => {
    it('should render dye items for each matched dye', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes(mockDyes.slice(0, 3))
      );
      harmony.init();

      // Should show dye names
      expect(container.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
      expect(container.textContent).toContain(`Dye-${mockDyes[1].itemID}`);
      expect(container.textContent).toContain(`Dye-${mockDyes[2].itemID}`);
    });

    it('should display deviance values', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        [{ dye: mockDyes[0], deviance: 15.5 }]
      );
      harmony.init();

      expect(container.textContent).toContain('15.5');
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should show empty state when no matched dyes', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        []
      );
      harmony.init();

      expect(container.textContent).toContain('harmony.noMatchingDyes');
    });
  });

  // ============================================================================
  // Harmony Type Variations Tests
  // ============================================================================

  describe('Harmony Type Variations', () => {
    const harmonyTypes = [
      { id: 'complementary', name: 'Complementary' },
      { id: 'analogous', name: 'Analogous' },
      { id: 'triadic', name: 'Triadic' },
      { id: 'split-complementary', name: 'Split Complementary' },
    ];

    harmonyTypes.forEach(({ id, name }) => {
      it(`should render ${name} harmony type`, () => {
        harmony = new HarmonyType(
          container,
          createHarmonyInfo({ id, name }),
          '#FF0000',
          createMatchedDyes()
        );
        harmony.init();

        expect(container.textContent).toContain(name);
      });
    });
  });

  // ============================================================================
  // Price Display Tests
  // ============================================================================

  describe('Price Display', () => {
    it('should not show prices when showPrices is false', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes(),
        false
      );
      harmony.init();

      // With showPrices false, shouldn't show Gil prices
      expect(container.textContent).not.toContain('Gil');
    });
  });

  // ============================================================================
  // Update Tests
  // ============================================================================

  describe('Updates', () => {
    it('should have update methods', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      // Component should have update methods
      expect(typeof harmony.updateShowPrices).toBe('function');
      expect(typeof harmony.setPriceData).toBe('function');
      expect(typeof harmony.updateDyes).toBe('function');
      expect(typeof harmony.updateBaseColor).toBe('function');
    });

    it('should update showPrices', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes(),
        false
      );
      harmony.init();

      harmony.updateShowPrices(true);

      // Method should exist and be callable
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Different Base Colors Tests
  // ============================================================================

  describe('Different Base Colors', () => {
    it('should handle red base color', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should handle blue base color', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#0000FF',
        createMatchedDyes()
      );
      harmony.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should handle green base color', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#00FF00',
        createMatchedDyes()
      );
      harmony.init();

      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      harmony = new HarmonyType(
        container,
        createHarmonyInfo(),
        '#FF0000',
        createMatchedDyes()
      );
      harmony.init();

      harmony.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
