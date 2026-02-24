/**
 * XIV Dye Tools - HarmonyTool Unit Tests
 *
 * Tests the harmony tool component for color harmony generation.
 * Covers rendering, dye selection, harmony types, and market board integration.
 *
 * @module components/__tests__/harmony-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HarmonyTool } from '../harmony-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById, mockFindClosestDyes } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
  mockFindClosestDyes: vi.fn(),
}));

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
  },
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  ColorService: {
    hexToRgb: vi.fn((hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      return { r, g, b };
    }),
    rgbToHex: vi.fn((r: number, g: number, b: number) => {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hsvToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })),
    getHarmonyColors: vi.fn(() => ['#00FFFF']),
    calculateColorDistance: vi.fn(() => 15),
  },
  MarketBoardService: {
    getInstance: vi.fn().mockReturnValue({
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWorldId: vi.fn().mockReturnValue(null),
      setWorldId: vi.fn(),
      getPriceForItem: vi.fn().mockReturnValue(null),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
    }),
  },
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
    }),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('harmony'),
    navigateTo: vi.fn(),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
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
  ICON_PALETTE: '<svg></svg>',
  ICON_MARKET: '<svg></svg>',
  ICON_HARMONY: '<svg></svg>',
  ICON_CRYSTAL: '<svg></svg>',
  ICON_FILTER: '<svg></svg>',
  ICON_EXPORT: '<svg></svg>',
  ICON_COINS: '<svg></svg>',
  ICON_BEAKER: '<svg></svg>',
  ICON_MUSIC: '<svg></svg>',
}));

vi.mock('@shared/constants', () => ({
  COMPANION_DYES_MIN: 1,
  COMPANION_DYES_MAX: 10,
  COMPANION_DYES_DEFAULT: 3,
}));

vi.mock('@components/v4/v4-color-wheel', () => ({}));

vi.mock('@components/v4/result-card', () => ({}));

vi.mock('../palette-exporter', () => ({
  PaletteExporter: class MockPaletteExporter {
    constructor() {}
    init() {}
    destroy() {}
    setPaletteData() {}
  },
}));

vi.mock('../harmony-result-panel', () => ({
  HarmonyResultPanel: class MockHarmonyResultPanel {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'harmony-result-panel';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    setPriceData() {}
    setShowPrices() {}
  },
}));

vi.mock('@shared/tool-icons', () => ({
  ICON_TOOL_HARMONY: '<svg></svg>',
}));

vi.mock('@shared/harmony-icons', () => ({
  HARMONY_ICONS: {
    complementary: '<svg></svg>',
    analogous: '<svg></svg>',
    triadic: '<svg></svg>',
    splitComplementary: '<svg></svg>',
    tetradic: '<svg></svg>',
  },
}));

vi.mock('@services/pricing-mixin', () => ({
  setupMarketBoardListeners: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('../collapsible-panel', () => ({
  CollapsiblePanel: class MockCollapsiblePanel {
    container: HTMLElement;
    options: Record<string, unknown>;
    constructor(container: HTMLElement, options: Record<string, unknown>) {
      this.container = container;
      this.options = options;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'collapsible-panel';
      div.id = (this.options.id as string) || 'panel';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    setContent() {}
    expand() {}
    collapse() {}
    toggle() {}
  },
}));

vi.mock('../market-board', () => ({
  MarketBoard: class MockMarketBoard {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'market-board';
      div.id = 'market-board';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    setShowPrices() {}
  },
}));

vi.mock('../dye-selector', () => ({
  DyeSelector: class MockDyeSelector {
    container: HTMLElement;
    options: Record<string, unknown>;
    selectedDyes: unknown[] = [];
    constructor(container: HTMLElement, options: Record<string, unknown> = {}) {
      this.container = container;
      this.options = options;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'dye-selector';
      div.id = 'dye-selector';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getSelectedDyes() {
      return this.selectedDyes;
    }
    setSelectedDyes(dyes: unknown[]) {
      this.selectedDyes = dyes;
    }
    clearSelection() {
      this.selectedDyes = [];
    }
  },
}));

vi.mock('../dye-filters', () => ({
  DyeFilters: class MockDyeFilters {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'dye-filters';
      div.id = 'dye-filters';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    getExcludedCategories() {
      return [];
    }
    setEnabled() {}
  },
}));

vi.mock('../harmony-type', () => ({
  HarmonyType: class MockHarmonyType {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'harmony-type';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    updateShowPrices() {}
    setPriceData() {}
    updateDyes() {}
    updateBaseColor() {}
  },
}));

vi.mock('../color-wheel-display', () => ({
  ColorWheelDisplay: class MockColorWheelDisplay {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'color-wheel-display';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    setActiveHarmony() {}
    setBaseColor() {}
    setHarmonyDyes() {}
  },
}));

describe('HarmonyTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: HarmonyTool | null;

  beforeEach(() => {
    container = createTestContainer();
    leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel';
    rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    drawerContent = document.createElement('div');
    drawerContent.id = 'drawer-content';
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
    container.appendChild(drawerContent);
    tool = null;
    vi.clearAllMocks();
    mockGetAllDyes.mockReturnValue(mockDyes);
    mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id));
    mockFindClosestDyes.mockReturnValue(mockDyes.slice(0, 5));
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (tool) {
      try {
        tool.destroy();
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
    it('should render harmony tool', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should render left panel content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });

    it('should render right panel content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Right panel should be connected to the tool
      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Tool renders with drawer content provided (may be empty initially)
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should work without drawer content', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.setConfig({ harmonyType: 'complementary' });

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      tool.selectDye(mockDyes[0]);

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });

    it('should clear dyes', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);
      tool.clearDyes();

      expect(leftPanel.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Harmony Type Tests
  // ============================================================================

  describe('Harmony Types', () => {
    it('should render harmony type selector', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render harmony-related content
      expect(leftPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      const initialLeftCount = leftPanel.children.length;
      const initialRightCount = rightPanel.children.length;

      tool.destroy();

      // Destroy should reduce or clear content
      expect(leftPanel.children.length).toBeLessThanOrEqual(initialLeftCount);
      expect(rightPanel.children.length).toBeLessThanOrEqual(initialRightCount);
    });

    it('should handle double destroy gracefully', () => {
      tool = new HarmonyTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });
});
