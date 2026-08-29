/**
 * XIV Dye Tools - V4Layout Unit Tests
 *
 * Tests the V4 layout entry point for the glassmorphism UI.
 * Covers initialization, tool loading, navigation, and event handling.
 *
 * @module components/__tests__/v4-layout.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeV4Layout, __resetTelemetryStateForTesting } from '../v4-layout';
import { showChangelogModal } from '../changelog-modal';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const {
  mockNavigateTo,
  mockGetCurrentToolId,
  mockSubscribe,
  mockInitialize,
  mockGetRouteForTool,
  mockRefreshDocumentTitle,
} = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
  mockGetCurrentToolId: vi.fn().mockReturnValue('harmony'),
  mockSubscribe: vi.fn().mockReturnValue(() => {}),
  mockInitialize: vi.fn(),
  mockGetRouteForTool: vi.fn((id: string) => ({
    id,
    path: `/${id}`,
    titleKey: `tools.${id}.title`,
  })),
  mockRefreshDocumentTitle: vi.fn(),
}));

const { mockTelemetry, mockGetCurrentRoute } = vi.hoisted(() => ({
  mockTelemetry: {
    startTool: vi.fn(),
    endTool: vi.fn(),
    track: vi.fn(),
    trackDyePick: vi.fn(),
  },
  mockGetCurrentRoute: vi
    .fn()
    .mockReturnValue({ toolId: 'harmony', params: new URLSearchParams() }),
}));

vi.mock('@services/telemetry-service', () => ({ TelemetryService: mockTelemetry }));

vi.mock('@services/router-service', () => ({
  RouterService: {
    initialize: mockInitialize,
    getCurrentToolId: mockGetCurrentToolId,
    subscribe: mockSubscribe,
    navigateTo: mockNavigateTo,
    getRouteForTool: mockGetRouteForTool,
    refreshDocumentTitle: mockRefreshDocumentTitle,
    getCurrentRoute: mockGetCurrentRoute,
  },
}));

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
    }),
  },
}));

const { mockLanguageSubscribe } = vi.hoisted(() => ({
  mockLanguageSubscribe: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string | number>) =>
      Object.entries(params).reduce<string>(
        (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
        key
      ),
    subscribe: mockLanguageSubscribe,
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

vi.mock('@shared/utils', () => ({
  clearContainer: vi.fn((container: HTMLElement) => {
    container.innerHTML = '';
  }),
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

vi.mock('../about-modal', () => ({
  showAboutModal: vi.fn(),
}));

// Mock the changelog modal so the real module's `virtual:changelog` import
// (a build-time Vite virtual module) does not need to resolve under Vitest.
vi.mock('../changelog-modal', () => ({
  showChangelogModal: vi.fn(),
}));

vi.mock('../v4/theme-modal', () => ({
  showThemeModal: vi.fn(),
}));

vi.mock('../v4/language-modal', () => ({
  showLanguageModal: vi.fn(),
}));

// Mock the real tool components so `loadToolContent` can complete a load
// without pulling in their full service graphs (e.g. HarmonyTool needs
// MarketBoardService, which the `@services/index` mock above doesn't
// provide) — the telemetry hooks below need a load that actually succeeds.
class MockTool {
  init() {}
  destroy() {}
}
vi.mock('@components/harmony-tool', () => ({ HarmonyTool: MockTool }));
vi.mock('@components/mixer-tool', () => ({ MixerTool: MockTool }));

// Mock V4LayoutShell custom element
class MockV4LayoutShell extends HTMLElement {
  updateComplete = Promise.resolve(true);

  connectedCallback() {
    // Simulate shadow DOM structure
    const shadowRoot = this.attachShadow({ mode: 'open' });
    const contentScroll = document.createElement('div');
    contentScroll.className = 'v4-layout-content-scroll';
    shadowRoot.appendChild(contentScroll);
  }
}

vi.mock('@components/v4/v4-layout-shell', () => ({}));

describe('V4Layout', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer();
    vi.clearAllMocks();

    // Register mock custom element if not already registered
    if (!customElements.get('v4-layout-shell')) {
      customElements.define('v4-layout-shell', MockV4LayoutShell);
    }

    // Clean up any existing DOM elements from previous tests
    document.getElementById('modal-root')?.remove();
    document.getElementById('toast-root')?.remove();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
    // Clean up created elements
    document.getElementById('modal-root')?.remove();
    document.getElementById('toast-root')?.remove();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize router service', async () => {
      await initializeV4Layout(container);

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should create v4-layout-shell element', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      expect(layoutShell).not.toBeNull();
    });

    it('should set initial tool attribute', async () => {
      mockGetCurrentToolId.mockReturnValue('mixer');

      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      expect(layoutShell?.getAttribute('active-tool')).toBe('mixer');
    });

    it('should subscribe to route changes', async () => {
      await initializeV4Layout(container);

      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Container Creation Tests
  // ============================================================================

  describe('Container Creation', () => {
    it('should create modal root if not exists', async () => {
      await initializeV4Layout(container);

      const modalRoot = document.getElementById('modal-root');
      expect(modalRoot).not.toBeNull();
    });

    it('should create toast root if not exists', async () => {
      await initializeV4Layout(container);

      const toastRoot = document.getElementById('toast-root');
      expect(toastRoot).not.toBeNull();
    });

    it('should use existing modal root if exists', async () => {
      const existingRoot = document.createElement('div');
      existingRoot.id = 'modal-root';
      document.body.appendChild(existingRoot);

      await initializeV4Layout(container);

      const modalRoots = document.querySelectorAll('#modal-root');
      expect(modalRoots.length).toBe(1);
    });

    it('should use existing toast root if exists', async () => {
      const existingRoot = document.createElement('div');
      existingRoot.id = 'toast-root';
      document.body.appendChild(existingRoot);

      await initializeV4Layout(container);

      const toastRoots = document.querySelectorAll('#toast-root');
      expect(toastRoots.length).toBe(1);
    });
  });

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('Event Handling', () => {
    it('should handle tool-change event', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      layoutShell?.dispatchEvent(new CustomEvent('tool-change', { detail: { toolId: 'mixer' } }));

      expect(mockNavigateTo).toHaveBeenCalledWith('mixer');
    });

    it('should handle config-change event', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');

      // Should not throw
      layoutShell?.dispatchEvent(
        new CustomEvent('config-change', {
          detail: { tool: 'harmony', key: 'showPrices', value: true },
        })
      );

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should open the changelog modal on changelog-click event', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      layoutShell?.dispatchEvent(new CustomEvent('changelog-click'));

      expect(showChangelogModal).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Tool Loading Tests
  // ============================================================================

  describe('Tool Loading', () => {
    it('should render container with layout shell', async () => {
      await initializeV4Layout(container);

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should refresh the document title when the locale changes', async () => {
      await initializeV4Layout(container);

      const localeListener = mockLanguageSubscribe.mock.calls.at(-1)?.[0] as () => void;
      expect(localeListener).toBeTypeOf('function');

      mockRefreshDocumentTitle.mockClear();
      localeListener();

      expect(mockRefreshDocumentTitle).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Telemetry Hooks
  // ============================================================================

  describe('telemetry hooks', () => {
    beforeEach(() => {
      Object.values(mockTelemetry).forEach((fn) => fn.mockClear());
      mockGetCurrentRoute.mockReturnValue({ toolId: 'harmony', params: new URLSearchParams() });
      // Earlier describe blocks in this file (e.g. "should set initial tool
      // attribute") leave mockGetCurrentToolId pointed at a non-default
      // return value — vi.clearAllMocks() clears call history, not
      // implementations. Pin it back to what these tests assume booted.
      mockGetCurrentToolId.mockReturnValue('harmony');
      // firstToolView is v4-layout module state, so it also survives past
      // any earlier successful tool load in this file's run.
      __resetTelemetryStateForTesting();
    });

    it('records the boot tool as an initial view and starts its dwell clock', async () => {
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.track).toHaveBeenCalled());
      expect(mockTelemetry.endTool).toHaveBeenCalled();
      expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'initial');
      expect(mockTelemetry.track).toHaveBeenCalledWith('tool_view', {
        tool: 'harmony',
        entry: 'initial',
      });
    });

    it('records a boot URL with params as a share entry', async () => {
      mockGetCurrentRoute.mockReturnValue({
        toolId: 'harmony',
        params: new URLSearchParams('dye=102'),
      });
      await initializeV4Layout(container);
      await vi.waitFor(() =>
        expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'share')
      );
    });

    it('records later navigations as nav', async () => {
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));
      // The route subscription callback captured by mockSubscribe
      const routeListener = mockSubscribe.mock.calls[0][0] as (s: { toolId: string }) => void;
      routeListener({ toolId: 'mixer' });
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('mixer', 'nav'));
      expect(mockTelemetry.track).toHaveBeenLastCalledWith('tool_view', {
        tool: 'mixer',
        entry: 'nav',
      });
    });

    it('tracks a palette-drawer pick but not a random pick', async () => {
      await initializeV4Layout(container);
      const layout = container.querySelector('v4-layout-shell')!;
      layout.dispatchEvent(
        new CustomEvent('dye-selected', {
          detail: { dye: { id: 1, stainID: 102, name: 'Jet Black', hex: '#000' } },
        })
      );
      expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(102, 'drawer');
      mockTelemetry.trackDyePick.mockClear();
      layout.dispatchEvent(
        new CustomEvent('dye-selected', {
          detail: { dye: { id: 1, stainID: 102, name: 'Jet Black', hex: '#000' }, random: true },
        })
      );
      expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();
    });
  });
});
