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
import type { Dye } from '@xivdyetools/types';
import { PALETTE_SLOTS_CHANGED, type PaletteSlot } from '../palette-slots';
import { isCustomDye } from '@shared/custom-dye';

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
  // BUG-040: v4-layout.ts imports RouterService through this barrel (not
  // @services/router-service directly), so the mock has to live here too.
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
/** webapp-v4-15: observation point for the config-change forward. */
const mockToolSetConfig = vi.fn();

class MockTool {
  init() {}
  destroy() {}
  // The layout only forwards a config-change to a tool that exposes
  // `setConfig`, and no mock here did -- so that branch was never taken and
  // 'should handle config-change event' watched nothing happen.
  setConfig(config: Record<string, unknown>) {
    mockToolSetConfig(config);
  }
}
// Mixer accepts drawer picks (selectDye); Harmony's mock deliberately does not,
// so the drawer-pick telemetry test can tell "taken by a tool" from "dropped".
const mockToolSelectDye = vi.fn();
class MockToolWithSelect extends MockTool {
  selectDye(dye: unknown) {
    mockToolSelectDye(dye);
  }
}
/** Observation points for the slot-contract mock below. */
const slotToolCalls = {
  placeDyeAt: vi.fn(),
  removeDyeAt: vi.fn(),
  setPaletteTarget: vi.fn(),
  selectDye: vi.fn(),
  selectCustomColor: vi.fn(),
};
let mockSlots: PaletteSlot[] = [];
let mockSlotsDense = false;

/**
 * A multi-input tool on the palette slot contract. Like a real tool, it
 * announces a slot change from its container, so a routed pick also fires
 * palette-slots-changed while the layout is still routing it.
 */
class MockSlotTool extends MockTool {
  readonly paletteSlotMode = 'multi' as const;
  private readonly container: HTMLElement;
  constructor(container: HTMLElement) {
    super();
    this.container = container;
  }
  get paletteSlotsDense(): boolean {
    return mockSlotsDense;
  }
  getPaletteSlots(): PaletteSlot[] {
    return mockSlots;
  }
  placeDyeAt(index: number, dye: Dye) {
    slotToolCalls.placeDyeAt(index, dye);
    this.announceSlots();
  }
  removeDyeAt(index: number) {
    slotToolCalls.removeDyeAt(index);
    this.announceSlots();
  }
  setPaletteTarget(index: number | null) {
    slotToolCalls.setPaletteTarget(index);
  }
  selectDye(dye: Dye) {
    slotToolCalls.selectDye(dye);
    this.announceSlots();
  }
  selectCustomColor(hex: string) {
    slotToolCalls.selectCustomColor(hex);
  }
  private announceSlots() {
    this.container.dispatchEvent(
      new CustomEvent(PALETTE_SLOTS_CHANGED, { bubbles: true, composed: true })
    );
  }
}
vi.mock('@components/harmony-tool', () => ({ HarmonyTool: MockTool }));
vi.mock('@components/mixer-tool', () => ({ MixerTool: MockToolWithSelect }));
vi.mock('@components/comparison-tool', () => ({ ComparisonTool: MockSlotTool }));
// The Presets tool is a Lit element created by tag name; the module import is
// for side effects only, so an empty module lets the load complete.
vi.mock('../v4/preset-tool', () => ({}));

const mockClearPaletteTarget = vi.fn();

// Mock V4LayoutShell custom element
class MockV4LayoutShell extends HTMLElement {
  updateComplete = Promise.resolve(true);
  paletteSlots: PaletteSlot[] = [];
  paletteSlotMode: string | null = null;
  paletteSlotsDense = false;
  clearPaletteTarget = mockClearPaletteTarget;

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

    // webapp-v4-15: this asserted `container.children.length > 0`, which is
    // true whether the listener ran, threw, or was never registered at all --
    // the comment even said "Should not throw". The handler's whole job is to
    // forward the change to the active tool's setConfig with the tool name
    // folded in, so assert that.
    it('forwards a config-change to the active tool', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      mockToolSetConfig.mockClear();

      layoutShell?.dispatchEvent(
        new CustomEvent('config-change', {
          detail: { tool: 'harmony', key: 'showPrices', value: true },
        })
      );

      // The tool name is folded in as `_tool` so a tool can tell its own
      // config from the shared market config.
      expect(mockToolSetConfig).toHaveBeenCalledWith({ _tool: 'harmony', showPrices: true });
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

    it('BUG-005: a same-tool popstate (state.sameTool) skips the remount entirely', async () => {
      // Distinguishes this from the test above: that one simulates a real
      // navigateTo() to the already-showing tool (Welcome's "Get started"),
      // which has no sameTool flag and DOES remount. A popstate that
      // RouterService resolved to the already-mounted tool sets
      // `state.sameTool = true`, and the layout must skip loadToolContent
      // altogether — not just dedupe its telemetry — so the active tool
      // instance (and its in-memory state) survives untouched.
      await initializeV4Layout(container);
      await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));

      const initSpy = vi.spyOn(MockTool.prototype, 'init');
      initSpy.mockClear();
      mockTelemetry.startTool.mockClear();
      mockTelemetry.endTool.mockClear();

      const popstateState = { toolId: 'harmony' as const, sameTool: true };
      routeListener()(popstateState);
      await settle();

      expect(initSpy).not.toHaveBeenCalled();
      expect(mockTelemetry.startTool).not.toHaveBeenCalled();
      expect(mockTelemetry.endTool).not.toHaveBeenCalled();
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

  // ============================================================================
  // Palette slot routing
  // ============================================================================

  describe('palette slot routing', () => {
    const JET = { id: 1, stainID: 102, name: 'Jet Black', hex: '#000000' } as unknown as Dye;
    const SNOW = { id: 2, stainID: 101, name: 'Snow White', hex: '#FFFFFF' } as unknown as Dye;

    function slot(label: string, dye: Dye | null): PaletteSlot {
      return { label, targetLabel: `Choosing dye ${label}`, dye };
    }

    function shell(): MockV4LayoutShell {
      return container.querySelector('v4-layout-shell') as unknown as MockV4LayoutShell;
    }

    /** Boot straight into a tool and wait until it is mounted. */
    async function bootInto(toolId: string): Promise<void> {
      mockGetCurrentToolId.mockReturnValue(toolId);
      await initializeV4Layout(container);
    }

    function pick(dye: Dye, target: number | null, random?: boolean): void {
      shell().dispatchEvent(
        new CustomEvent('dye-selected', {
          detail: { dye, target, ...(random ? { random: true } : {}) },
        })
      );
    }

    beforeEach(() => {
      Object.values(slotToolCalls).forEach((fn) => fn.mockReset());
      mockSlots = [slot('1', JET), slot('2', null)];
      mockSlotsDense = false;
    });

    afterEach(() => {
      mockGetCurrentToolId.mockReturnValue('harmony');
    });

    it('pushes the mounted tool’s slots and mode to the shell', async () => {
      mockSlotsDense = true;
      await bootInto('comparison');

      expect(shell().paletteSlotMode).toBe('multi');
      expect(shell().paletteSlots).toEqual(mockSlots);
      expect(shell().paletteSlotsDense).toBe(true);
    });

    it('routes an untargeted pick of an unheld dye to selectDye', async () => {
      await bootInto('comparison');

      pick(SNOW, null);

      expect(slotToolCalls.selectDye).toHaveBeenCalledWith(SNOW);
      expect(slotToolCalls.placeDyeAt).not.toHaveBeenCalled();
      expect(slotToolCalls.removeDyeAt).not.toHaveBeenCalled();
      expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(101, 'drawer');
    });

    it('routes an untargeted pick of a held dye to removeDyeAt and does not record a dye pick', async () => {
      await bootInto('comparison');

      pick(JET, null);

      expect(slotToolCalls.removeDyeAt).toHaveBeenCalledWith(0);
      expect(slotToolCalls.selectDye).not.toHaveBeenCalled();
      expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();
    });

    it('routes a targeted pick to placeDyeAt with the target index', async () => {
      await bootInto('comparison');
      const placed = [slot('1', JET), slot('2', SNOW)];
      slotToolCalls.placeDyeAt.mockImplementation(() => {
        mockSlots = placed;
      });

      pick(SNOW, 1);

      expect(slotToolCalls.placeDyeAt).toHaveBeenCalledWith(1, SNOW);
      expect(slotToolCalls.selectDye).not.toHaveBeenCalled();
      expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(101, 'drawer');
      // The shell clears the target it routed; the layout must not clear it early
      expect(mockClearPaletteTarget).not.toHaveBeenCalled();
      expect(shell().paletteSlots).toEqual(placed);
    });

    it('treats a target outside the tool’s slots as no target', async () => {
      await bootInto('comparison');

      pick(SNOW, 5);

      expect(slotToolCalls.placeDyeAt).not.toHaveBeenCalled();
      expect(slotToolCalls.selectDye).toHaveBeenCalledWith(SNOW);
    });

    it('does nothing for a targeted pick of the target slot’s own dye', async () => {
      await bootInto('comparison');

      pick(JET, 0);

      expect(slotToolCalls.placeDyeAt).not.toHaveBeenCalled();
      expect(slotToolCalls.removeDyeAt).not.toHaveBeenCalled();
      expect(slotToolCalls.selectDye).not.toHaveBeenCalled();
      expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();
    });

    it('never removes on a random pick', async () => {
      await bootInto('comparison');

      pick(JET, null, true);

      expect(slotToolCalls.removeDyeAt).not.toHaveBeenCalled();
      expect(slotToolCalls.selectDye).not.toHaveBeenCalled();
      expect(slotToolCalls.placeDyeAt).not.toHaveBeenCalled();
    });

    it('routes a targeted custom color to placeDyeAt with a custom dye', async () => {
      await bootInto('comparison');

      shell().dispatchEvent(
        new CustomEvent('custom-color-selected', { detail: { hex: '#123456', target: 1 } })
      );

      expect(slotToolCalls.placeDyeAt).toHaveBeenCalledTimes(1);
      const [index, dye] = slotToolCalls.placeDyeAt.mock.calls[0] as [number, Dye];
      expect(index).toBe(1);
      expect(isCustomDye(dye)).toBe(true);
      expect(dye.hex.toUpperCase()).toBe('#123456');
      expect(slotToolCalls.selectCustomColor).not.toHaveBeenCalled();

      // Untargeted, the tool's own custom-color path still takes it
      shell().dispatchEvent(
        new CustomEvent('custom-color-selected', { detail: { hex: '#654321', target: null } })
      );
      expect(slotToolCalls.selectCustomColor).toHaveBeenCalledWith('#654321');
      expect(slotToolCalls.placeDyeAt).toHaveBeenCalledTimes(1);
    });

    it('forwards palette-target-change to setPaletteTarget', async () => {
      await bootInto('comparison');

      shell().dispatchEvent(new CustomEvent('palette-target-change', { detail: { index: 1 } }));
      shell().dispatchEvent(new CustomEvent('palette-target-change', { detail: { index: null } }));

      expect(slotToolCalls.setPaletteTarget.mock.calls).toEqual([[1], [null]]);
    });

    it('re-syncs slots on palette-slots-changed and clears a target the pick did not cause', async () => {
      await bootInto('comparison');
      const toolContainer = shell().shadowRoot!.querySelector('.v4-tool-container')!;

      // The tool's own Remove button (or a share-link load) changed its slots
      mockSlots = [slot('1', null), slot('2', null)];
      toolContainer.dispatchEvent(
        new CustomEvent(PALETTE_SLOTS_CHANGED, { bubbles: true, composed: true })
      );

      expect(mockClearPaletteTarget).toHaveBeenCalledTimes(1);
      expect(shell().paletteSlots).toEqual(mockSlots);
    });

    it('re-syncs slots on a language change so the palette labels follow the locale', async () => {
      await bootInto('comparison');
      const localeListener = mockLanguageSubscribe.mock.calls.at(-1)?.[0] as () => void;

      // getPaletteSlots() reads the new locale's strings; nothing else announced a change
      const translated = [slot('Eins', JET), slot('Zwei', null)];
      mockSlots = translated;
      localeListener();

      expect(shell().paletteSlots).toBe(translated);
      expect(mockClearPaletteTarget).not.toHaveBeenCalled();
    });

    it('leaves a tool without the contract on the old selectDye path', async () => {
      await bootInto('mixer');

      expect(shell().paletteSlotMode).toBeNull();
      expect(shell().paletteSlots).toEqual([]);
      expect(shell().paletteSlotsDense).toBe(false);

      pick(JET, 0);

      expect(mockToolSelectDye).toHaveBeenCalledWith(JET);
      expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(102, 'drawer');
    });
  });
});
