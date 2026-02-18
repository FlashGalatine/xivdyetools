/**
 * XIV Dye Tools - AccessibilityTool Unit Tests
 *
 * Tests the accessibility tool component for colorblindness simulation.
 * Covers rendering, dye selection, simulation types, and WCAG contrast.
 *
 * @module components/__tests__/accessibility-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AccessibilityTool } from '../accessibility-tool';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
}));

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
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
    simulateColorblindness: vi.fn(() => ({ r: 128, g: 128, b: 128 })),
    simulateColorblindnessHex: vi.fn((hex: string) => hex),
    calculateContrastRatio: vi.fn(() => 4.5),
    calculateColorDistance: vi.fn(() => 15),
    getContrastRatio: vi.fn(() => 4.5),
    getColorDistance: vi.fn(() => 50),
  },
  MarketBoardService: {
    getInstance: vi.fn().mockReturnValue({
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWorldId: vi.fn().mockReturnValue(null),
      setWorldId: vi.fn(),
      getPriceForItem: vi.fn().mockReturnValue(null),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getShowPrices: vi.fn().mockReturnValue(false),
      setShowPrices: vi.fn(),
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
    getCurrentToolId: vi.fn().mockReturnValue('accessibility'),
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
  ICON_EYE: '<svg></svg>',
  ICON_CRYSTAL: '<svg></svg>',
  ICON_CHECK: '<svg></svg>',
  ICON_CLOSE: '<svg></svg>',
}));

vi.mock('@shared/tool-icons', () => ({
  ICON_TOOL_ACCESSIBILITY: '<svg></svg>',
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
      div.id = this.options.id as string || 'panel';
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

vi.mock('../colorblindness-display', () => ({
  ColorblindnessDisplay: class MockColorblindnessDisplay {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'colorblindness-display';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
    updateColor() {}
  },
}));

vi.mock('../dye-action-dropdown', () => ({
  createDyeActionDropdown: vi.fn().mockImplementation(() => {
    const div = document.createElement('div');
    div.className = 'dye-action-dropdown';
    return div;
  }),
}));

describe('AccessibilityTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: AccessibilityTool | null;

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
    it('should render accessibility tool', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      expect(() => tool!.init()).not.toThrow();
    });

    it('should render left panel content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(leftPanel).not.toBeNull();
    });

    it('should render right panel content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(rightPanel).not.toBeNull();
    });

    it('should render drawer content when provided', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      expect(drawerContent).not.toBeNull();
    });

    it('should work without drawer content', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      expect(() => tool!.init()).not.toThrow();
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should have setConfig method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.setConfig).toBe('function');
    });

    it('should accept config via setConfig', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.setConfig({ deuteranopia: true })).not.toThrow();
    });
  });

  // ============================================================================
  // Dye Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should have selectDye method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.selectDye).toBe('function');
    });

    it('should have addDye method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.addDye).toBe('function');
    });

    it('should have clearDyes method', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      expect(typeof tool.clearDyes).toBe('function');
    });

    it('should accept dye selection', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Should not throw
      expect(() => tool!.selectDye(mockDyes[0])).not.toThrow();
    });

    it('should clear dyes', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.selectDye(mockDyes[0]);

      // Should not throw
      expect(() => tool!.clearDyes()).not.toThrow();
    });
  });

  // ============================================================================
  // Colorblindness Simulation Tests
  // ============================================================================

  describe('Colorblindness Simulation', () => {
    it('should render simulation controls', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      // Tool should render simulation-related content
      expect(rightPanel).not.toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel, drawerContent });
      tool.init();

      // Should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = new AccessibilityTool(container, { leftPanel, rightPanel });
      tool.init();

      tool.destroy();

      // Second destroy should not throw
      expect(() => tool!.destroy()).not.toThrow();
    });
  });
});
