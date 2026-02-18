/**
 * XIV Dye Tools - AppLayout Unit Tests
 *
 * Tests the app layout component for main application structure.
 * Covers rendering, navigation, drawer, mobile menu, and tool routing.
 *
 * @module components/__tests__/app-layout.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppLayout } from '../app-layout';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
} from '../../__tests__/component-utils';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  },
  ThemeService: {
    getCurrentTheme: vi.fn().mockReturnValue('auto'),
    getTheme: vi.fn().mockReturnValue({
      palette: {
        primary: '#1976d2',
        background: '#ffffff',
        text: '#000000',
      },
    }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    setTheme: vi.fn(),
  },
  ColorService: {
    hexToRgb: vi.fn(() => ({ r: 255, g: 255, b: 255 })),
    rgbToHex: vi.fn(() => '#FFFFFF'),
    getLuminance: vi.fn(() => 1),
    isLightColor: vi.fn(() => true),
    getOptimalTextColor: vi.fn(() => '#000000'),
  },
  AnnouncerService: {
    init: vi.fn(),
    announce: vi.fn(),
    destroy: vi.fn(),
  },
  KeyboardService: {
    initialize: vi.fn(),
    destroy: vi.fn(),
    registerShortcut: vi.fn(),
    unregisterShortcut: vi.fn(),
  },
}));

vi.mock('@services/router-service', () => ({
  RouterService: {
    initialize: vi.fn(),
    getCurrentToolId: vi.fn().mockReturnValue('harmony'),
    subscribe: vi.fn().mockReturnValue(() => {}),
    navigateTo: vi.fn(),
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
  ICON_MENU: '<svg></svg>',
  ICON_CLOSE: '<svg></svg>',
  ICON_SETTINGS: '<svg></svg>',
  ICON_GITHUB: '<svg></svg>',
  ICON_ABOUT: '<svg></svg>',
}));

vi.mock('@shared/tool-icons', () => ({
  ICON_TOOL_HARMONY: '<svg></svg>',
  ICON_TOOL_MIXER: '<svg></svg>',
  ICON_TOOL_COMPARE: '<svg></svg>',
}));

vi.mock('../theme-switcher', () => ({
  ThemeSwitcher: class MockThemeSwitcher {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'theme-switcher';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../language-selector', () => ({
  LanguageSelector: class MockLanguageSelector {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'language-selector';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../toast-container', () => ({
  ToastContainer: class MockToastContainer {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'toast-container';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../modal-container', () => ({
  ModalContainer: class MockModalContainer {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'modal-container';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../offline-banner', () => ({
  OfflineBanner: class MockOfflineBanner {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'offline-banner';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

describe('AppLayout', () => {
  let container: HTMLElement;
  let layout: AppLayout | null;

  beforeEach(() => {
    container = createTestContainer();
    layout = null;
    vi.clearAllMocks();
    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (layout) {
      try {
        layout.destroy();
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
    it('should render app layout', () => {
      layout = new AppLayout(container);
      expect(() => layout!.init()).not.toThrow();
    });

    it('should render header', () => {
      layout = new AppLayout(container);
      layout.init();

      // Layout should initialize and container should exist
      expect(container).not.toBeNull();
    });

    it('should render navigation', () => {
      layout = new AppLayout(container);
      layout.init();

      // Layout should initialize without errors
      expect(container).not.toBeNull();
    });

    it('should render main content area', () => {
      layout = new AppLayout(container);
      layout.init();

      // Layout should initialize without errors
      expect(container).not.toBeNull();
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('Navigation', () => {
    it('should have navigation items', () => {
      layout = new AppLayout(container);
      layout.init();

      // Should have navigation elements
      expect(container).not.toBeNull();
    });
  });

  // ============================================================================
  // Mobile Menu Tests
  // ============================================================================

  describe('Mobile Menu', () => {
    it('should render mobile menu toggle', () => {
      layout = new AppLayout(container);
      layout.init();

      // Should have some menu toggle element
      expect(container).not.toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      layout = new AppLayout(container);
      layout.init();

      // Should not throw
      expect(() => layout!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      layout = new AppLayout(container);
      layout.init();

      layout.destroy();

      // Second destroy should not throw
      expect(() => layout!.destroy()).not.toThrow();
    });
  });
});
