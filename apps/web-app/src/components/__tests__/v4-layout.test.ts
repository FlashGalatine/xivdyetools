/**
 * XIV Dye Tools - V4Layout Unit Tests
 *
 * Tests the V4 layout entry point for the glassmorphism UI.
 * Covers initialization, tool loading, navigation, and event handling.
 *
 * @module components/__tests__/v4-layout.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeV4Layout } from '../v4-layout';
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

const { mockTelemetry, mockIsShareUrl, mockGetSubPath } = vi.hoisted(() => ({
  mockTelemetry: {
    startTool: vi.fn(),
    endTool: vi.fn(),
    track: vi.fn(),
    trackDyePick: vi.fn(),
  },
  mockIsShareUrl: vi.fn().mockReturnValue(false),
  mockGetSubPath: vi.fn().mockReturnValue(null),
}));

vi.mock('@services/telemetry-service', () => ({ TelemetryService: mockTelemetry }));
vi.mock('@services/share-service', () => ({ ShareService: { isShareUrl: mockIsShareUrl } }));

vi.mock('@services/router-service', () => ({
  RouterService: {
    initialize: mockInitialize,
    getCurrentToolId: mockGetCurrentToolId,
    subscribe: mockSubscribe,
    navigateTo: mockNavigateTo,
    getRouteForTool: mockGetRouteForTool,
    refreshDocumentTitle: mockRefreshDocumentTitle,
    getSubPath: mockGetSubPath,
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
// Mixer accepts drawer picks (selectDye); Harmony's mock deliberately does not,
// so the drawer-pick telemetry test can tell "taken by a tool" from "dropped".
class MockToolWithSelect extends MockTool {
  selectDye() {}
}
vi.mock('@components/harmony-tool', () => ({ HarmonyTool: MockTool }));
vi.mock('@components/mixer-tool', () => ({ MixerTool: MockToolWithSelect }));
// The Presets tool is a Lit element created by tag name; the module import is
// for side effects only, so an empty module lets the load complete.
vi.mock('../v4/preset-tool', () => ({}));

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
      mockIsShareUrl.mockReturnValue(false);
      mockGetSubPath.mockReturnValue(null);
      // Earlier describe blocks in this file (e.g. "should set initial tool
      // attribute") leave mockGetCurrentToolId pointed at a non-default
      // return value — vi.clearAllMocks() clears call history, not
      // implementations. Pin it back to what these tests assume booted.
      mockGetCurrentToolId.mockReturnValue('harmony');
    });

    /** The route-change listener v4-layout registered with RouterService.subscribe */
    function routeListener(): (state: { toolId: string }) => void {
      return mockSubscribe.mock.calls[0][0] as (state: { toolId: string }) => void;
    }

    /** loadToolContent is fire-and-forget from the route listener; let its awaits settle. */
    async function settle(): Promise<void> {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    function dropPick(random?: boolean): void {
      const layout = container.querySelector('v4-layout-shell')!;
      layout.dispatchEvent(
        new CustomEvent('dye-selected', {
          detail: {
            dye: { id: 1, stainID: 102, name: 'Jet Black', hex: '#000' },
            ...(random ? { random: true } : {}),
          },
        })
      );
    }

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

    it('records a boot from a share link (ShareService v= marker) as a share entry', async () => {
      mockIsShareUrl.mockReturnValue(true);
      await initializeV4Layout(container);
      await vi.waitFor(() =>
        expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'share')
      );
    });

    it('does not treat a preserved param or in-app hand-off in the address bar as a share', async () => {
      // `?dye=` survives navigations (RouterService PRESERVED_PARAMS) and is what
      // Budget → Harmony hand-offs set; without the v= marker it is not a share.
      window.history.replaceState({}, '', '/harmony?dye=102');
      try {
        await initializeV4Layout(container);
        await vi.waitFor(() =>
          expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'initial')
        );
      } finally {
        window.history.replaceState({}, '', '/');
      }
    });

    it('records a preset deep link (/presets/<id>) as a share entry', async () => {
      mockGetCurrentToolId.mockReturnValue('presets');
      mockGetSubPath.mockReturnValue('community-abc');
      await initializeV4Layout(container);
      await vi.waitFor(() =>
        expect(mockTelemetry.startTool).toHaveBeenCalledWith('presets', 'share')
      );
    });

    it('records later navigations as nav', async () => {
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));
      routeListener()({ toolId: 'mixer' });
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('mixer', 'nav'));
      expect(mockTelemetry.track).toHaveBeenLastCalledWith('tool_view', {
        tool: 'mixer',
        entry: 'nav',
      });
    });

    it('does not emit a leave/view pair when re-navigating to the tool already showing', async () => {
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));
      mockTelemetry.endTool.mockClear();

      // The Welcome modal's "Get started" navigates to the default tool — the
      // one already on screen. That remounts it, but it is not a new view.
      routeListener()({ toolId: 'harmony' });
      await settle();

      expect(mockTelemetry.endTool).not.toHaveBeenCalled();
      expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1);
      expect(mockTelemetry.track).toHaveBeenCalledTimes(1);

      // A real switch afterwards is still a view (entry nav, never initial)
      routeListener()({ toolId: 'mixer' });
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('mixer', 'nav'));
      expect(mockTelemetry.endTool).toHaveBeenCalledTimes(1);
    });

    it('tracks a palette-drawer pick only when a tool takes it, and never a random pick', async () => {
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));

      // Harmony's mock has no selectDye/addDye: nothing consumed the pick
      dropPick();
      expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();

      routeListener()({ toolId: 'mixer' });
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('mixer', 'nav'));

      dropPick();
      expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(102, 'drawer');

      mockTelemetry.trackDyePick.mockClear();
      dropPick(true);
      expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();
    });
  });
});
