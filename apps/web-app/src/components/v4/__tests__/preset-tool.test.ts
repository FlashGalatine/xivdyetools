/**
 * XIV Dye Tools - PresetTool Unit Tests
 *
 * Focused regression suite for two deep-dive audit findings
 * (docs/audits/2026-09-16-deep-dive):
 *
 * - BUG-005: Back from a preset detail pushed `{ preset: id }` with no
 *   `toolId`, so router-service.ts's popstate handler fell back to
 *   `parseCurrentPath()`, which (before that fix) always notified — and
 *   v4-layout.ts remounted a fresh `<v4-preset-tool>`, losing tab, search
 *   query and the loaded pool. The fix makes list <-> detail an
 *   in-component state change: `handlePresetSelect` now pushes
 *   `{ toolId: 'presets', preset: id }`, and this element listens for
 *   `popstate` itself to restore/clear `selectedPreset`.
 * - BUG-027: `disconnectedCallback` cleared five service unsubscribes but not
 *   the search debounce timer, so a fetch could fire into a detached
 *   element.
 *
 * This file does not attempt full coverage of preset-tool.ts (tracked
 * separately) — only these two behaviors.
 *
 * @module components/v4/__tests__/preset-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UnifiedPreset } from '@services/hybrid-preset-service';
import type { SavedPreset } from '@services/saved-presets-service';

// ============================================================================
// Mocks
// ============================================================================

// The list <-> detail children are unrelated to these two findings and carry
// their own service graphs (MarketBoardService, ConfigController, …, see
// preset-detail.test.ts) — registering them for real here would mean mocking
// all of that just to satisfy an import. Both are Lit custom elements
// referenced only by tag name in preset-tool's template, so an empty module
// (no registration) is a harmless unknown element for these tests.
vi.mock('../preset-detail', () => ({}));
vi.mock('../preset-card', () => ({}));

const languageServiceMock = {
  t: vi.fn((key: string) => key),
  tInterpolate: vi.fn((key: string, params: Record<string, string | number>) =>
    Object.entries(params).reduce<string>(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      key
    )
  ),
  getCurrentLocale: vi.fn(() => 'en'),
  subscribe: vi.fn(() => () => {}),
};

// `@shared/preset-i18n` and `@shared/example-link` import LanguageService
// directly from this path rather than through the `@services/index` barrel.
vi.mock('@services/language-service', () => ({ LanguageService: languageServiceMock }));

const authServiceMock = {
  isAuthenticated: vi.fn(() => false),
  subscribe: vi.fn(() => () => {}),
};

const modalServiceMock = {
  showConfirm: vi.fn(),
  hasOpenModals: vi.fn(() => false),
};

const toastServiceMock = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

const presetSubmissionServiceMock = {
  getMySubmissions: vi.fn(async () => ({ presets: [] })),
  deletePreset: vi.fn(),
};

const routerServiceMock = {
  getSubPath: vi.fn(() => null as string | null),
  navigateTo: vi.fn(),
  getCurrentToolId: vi.fn(() => 'presets'),
  subscribe: vi.fn(() => () => {}),
};

vi.mock('@services/index', () => ({
  resolvePresetDye: vi.fn(() => undefined),
  LanguageService: languageServiceMock,
  authService: authServiceMock,
  presetSubmissionService: presetSubmissionServiceMock,
  ToastService: toastServiceMock,
  ModalService: modalServiceMock,
  RouterService: routerServiceMock,
}));

const hybridPresetServiceMock = {
  initialize: vi.fn(async () => {}),
  getPresets: vi.fn(async () => [] as UnifiedPreset[]),
  isAPIAvailable: vi.fn(() => true),
  getPreset: vi.fn(async () => null as UnifiedPreset | null),
};
vi.mock('@services/hybrid-preset-service', () => ({
  hybridPresetService: hybridPresetServiceMock,
}));

const communityPresetServiceMock = {
  removeVote: vi.fn(),
  voteForPreset: vi.fn(),
};
vi.mock('@services/community-preset-service', () => ({
  communityPresetService: communityPresetServiceMock,
}));

let savedListMock: SavedPreset[] = [];
const savedPresetsServiceMock = {
  getAll: vi.fn(() => savedListMock),
  subscribe: vi.fn(() => () => {}),
  toggle: vi.fn(),
  markDeleted: vi.fn(),
};
vi.mock('@services/saved-presets-service', () => ({
  SavedPresetsService: savedPresetsServiceMock,
}));

const collectionServiceMock = {
  subscribeCollections: vi.fn((listener: (collections: unknown[]) => void) => {
    listener([]);
    return () => {};
  }),
};
vi.mock('@services/collection-service', () => ({ CollectionService: collectionServiceMock }));

let configControllerConfig = {
  sortBy: 'popular' as const,
  category: 'all' as const,
  feedShots: true,
  feedBlend: false,
  feedHideUnbuyable: false,
  savedFirst: true,
  keepDeleted: true,
  displayOptions: {},
};
const configControllerMock = {
  getConfig: vi.fn(() => configControllerConfig),
  subscribe: vi.fn(() => () => {}),
};
vi.mock('@services/config-controller', () => ({
  ConfigController: { getInstance: () => configControllerMock },
}));

vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ============================================================================
// Fixtures
// ============================================================================

function makePreset(overrides: Partial<UnifiedPreset> = {}): UnifiedPreset {
  return {
    id: 'community-1',
    name: 'Test Preset',
    description: 'A test preset',
    category: 'aesthetics',
    secondaryCategories: [],
    dyes: [1],
    tags: [],
    voteCount: 0,
    isCurated: false,
    isFromAPI: true,
    apiPresetId: 'api-1',
    ...overrides,
  };
}

type PresetToolEl = HTMLElement & {
  updateComplete: Promise<unknown>;
  selectedPreset: UnifiedPreset | null;
  tab: string;
  searchQuery: string;
  handlePresetSelect: (e: CustomEvent<{ preset: UnifiedPreset }>) => void;
  handleSearchInput: (e: Event) => void;
};

// ============================================================================
// Tests
// ============================================================================

describe('PresetTool', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    savedListMock = [];
    configControllerConfig = {
      sortBy: 'popular',
      category: 'all',
      feedShots: true,
      feedBlend: false,
      feedHideUnbuyable: false,
      savedFirst: true,
      keepDeleted: true,
      displayOptions: {},
    };
    vi.clearAllMocks();
    hybridPresetServiceMock.initialize.mockResolvedValue(undefined);
    hybridPresetServiceMock.getPresets.mockResolvedValue([]);
    hybridPresetServiceMock.isAPIAvailable.mockReturnValue(true);
    hybridPresetServiceMock.getPreset.mockResolvedValue(null);
    routerServiceMock.getSubPath.mockReturnValue(null);
    routerServiceMock.getCurrentToolId.mockReturnValue('presets');
  });

  afterEach(() => {
    container.innerHTML = '';
    container.remove();
  });

  /** Mount a `<v4-preset-tool>` and wait for Lit's initial render. */
  async function mountTool(): Promise<PresetToolEl> {
    await import('../preset-tool');
    const el = document.createElement('v4-preset-tool') as unknown as PresetToolEl;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  /** Flush pending microtasks (the async connectedCallback chain) plus a render pass. */
  async function flush(el: PresetToolEl): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }

  // --------------------------------------------------------------------
  // BUG-005
  // --------------------------------------------------------------------

  describe('BUG-005: list <-> detail survives Back/Forward without a remount', () => {
    it('pushes { toolId, preset } (not a bare { preset }) when a preset is selected', async () => {
      const preset = makePreset();
      const el = await mountTool();
      await flush(el);

      const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

      el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));

      expect(pushSpy).toHaveBeenCalledWith(
        { toolId: 'presets', preset: preset.id },
        '',
        `/presets/${preset.id}`
      );
      pushSpy.mockRestore();
    });

    it('Back (popstate to the list state) clears selectedPreset on the SAME instance and keeps tab/searchQuery', async () => {
      const preset = makePreset();
      hybridPresetServiceMock.getPresets.mockResolvedValue([preset]);

      const el = await mountTool();
      await flush(el);

      vi.spyOn(window.history, 'pushState').mockImplementation(() => {});

      // Change tab and type a search query, the way a real session would
      // before opening a preset.
      el.tab = 'official';
      el.searchQuery = 'sample query';
      await el.updateComplete;

      el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));
      await el.updateComplete;

      expect(el.selectedPreset).toEqual(preset);

      // The browser pops back to the list's own history entry — no `preset`
      // field, same `toolId`.
      window.dispatchEvent(new PopStateEvent('popstate', { state: { toolId: 'presets' } }));
      await el.updateComplete;

      expect(el.selectedPreset).toBeNull();
      expect(el.tab).toBe('official');
      expect(el.searchQuery).toBe('sample query');
      // No remount happened: this is still the exact element instance in the DOM.
      expect(container.querySelector('v4-preset-tool')).toBe(el);
    });

    it('Forward (popstate carrying a preset id) restores selectedPreset from the loaded pool', async () => {
      const preset = makePreset({ id: 'community-2', name: 'Forward Target' });
      hybridPresetServiceMock.getPresets.mockResolvedValue([preset]);

      const el = await mountTool();
      await flush(el);

      expect(el.selectedPreset).toBeNull();

      window.dispatchEvent(
        new PopStateEvent('popstate', { state: { toolId: 'presets', preset: preset.id } })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;

      expect(el.selectedPreset).toEqual(preset);
    });

    it('ignores a popstate that has already moved RouterService to a different tool', async () => {
      const preset = makePreset();
      hybridPresetServiceMock.getPresets.mockResolvedValue([preset]);

      const el = await mountTool();
      await flush(el);

      el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));
      await el.updateComplete;
      expect(el.selectedPreset).toEqual(preset);

      // router-service.ts's own (earlier-registered) popstate listener has
      // already resolved this event to a different tool by the time this
      // element's listener runs — that's what "not our popstate" means now
      // that we read RouterService.getCurrentToolId() instead of
      // event.state.toolId (see review round 1: the state shape is not a
      // reliable signal).
      routerServiceMock.getCurrentToolId.mockReturnValue('harmony');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { toolId: 'harmony' } }));
      await el.updateComplete;

      expect(el.selectedPreset).toEqual(preset);
    });

    // ----------------------------------------------------------------
    // Review round 1 — CRITICAL: history.state is not reliably
    // { toolId: 'presets', preset? }. A cold load/refresh of `/presets`
    // leaves `state: null` (handleInitialRoute never replaceState()s a
    // valid path); handleBack, the edit/delete success paths, and other
    // in-app pushes leave `state: {}`. Resolution must come from the URL
    // (RouterService.getCurrentToolId()/getSubPath()), not the state shape.
    // ----------------------------------------------------------------

    it.each([
      ['null', null],
      ['{}', {}],
    ] as const)(
      'review round 1: a %s-state popstate closes the detail when the URL is the bare list',
      async (_label, state) => {
        const preset = makePreset();
        hybridPresetServiceMock.getPresets.mockResolvedValue([preset]);

        const el = await mountTool();
        await flush(el);

        el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));
        await el.updateComplete;
        expect(el.selectedPreset).toEqual(preset);

        // RouterService has already resolved this popstate to 'presets' from
        // the URL (its own listener runs first); the URL carries no sub-path.
        routerServiceMock.getCurrentToolId.mockReturnValue('presets');
        routerServiceMock.getSubPath.mockReturnValue(null);
        window.dispatchEvent(new PopStateEvent('popstate', { state }));
        await el.updateComplete;

        expect(el.selectedPreset).toBeNull();
      }
    );

    it.each([
      ['null', null],
      ['{}', {}],
    ] as const)(
      'review round 1: a %s-state popstate opens the detail when the URL carries the preset id',
      async (_label, state) => {
        const preset = makePreset({ id: 'community-from-url', name: 'From URL' });
        hybridPresetServiceMock.getPresets.mockResolvedValue([preset]);

        const el = await mountTool();
        await flush(el);
        expect(el.selectedPreset).toBeNull();

        routerServiceMock.getCurrentToolId.mockReturnValue('presets');
        routerServiceMock.getSubPath.mockReturnValue(preset.id);
        window.dispatchEvent(new PopStateEvent('popstate', { state }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        await el.updateComplete;

        expect(el.selectedPreset).toEqual(preset);
      }
    );

    it('review round 1: drops a stale API-fallback restore superseded by a newer popstate', async () => {
      let resolveStale!: (value: UnifiedPreset | null) => void;
      hybridPresetServiceMock.getPreset.mockImplementationOnce(
        () =>
          new Promise<UnifiedPreset | null>((resolve) => {
            resolveStale = resolve;
          })
      );

      const el = await mountTool();
      await flush(el);

      // First popstate resolves to an id outside the loaded pool/saved list,
      // forcing the async hybridPresetService.getPreset fallback — held open.
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: { toolId: 'presets', preset: 'community-stale' } })
      );
      await Promise.resolve();

      // A newer popstate (Back again to the list) lands before that lookup
      // resolves.
      window.dispatchEvent(new PopStateEvent('popstate', { state: { toolId: 'presets' } }));
      await el.updateComplete;
      expect(el.selectedPreset).toBeNull();

      // The stale lookup finally resolves — it must not clobber the newer,
      // already-settled state.
      resolveStale(makePreset({ id: 'community-stale', name: 'Stale' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;

      expect(el.selectedPreset).toBeNull();
    });

    it('final review: drops a stale handleDeepLink() restore superseded by a newer popstate', async () => {
      let resolveDeepLink!: (value: UnifiedPreset | null) => void;
      hybridPresetServiceMock.getPreset.mockImplementationOnce(
        () =>
          new Promise<UnifiedPreset | null>((resolve) => {
            resolveDeepLink = resolve;
          })
      );

      // A cold load at /presets/:id — handleDeepLink()'s API-fallback lookup
      // (the same race class restoreSelectedPresetFromHistory guards against)
      // is held open across the mount's connectedCallback chain.
      routerServiceMock.getSubPath.mockReturnValue('community-deep-link');

      const el = await mountTool();
      await flush(el);

      // Before that lookup resolves, a popstate (e.g. handleBack's `{}`
      // shape) takes the URL back to the bare list.
      routerServiceMock.getSubPath.mockReturnValue(null);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      await el.updateComplete;
      expect(el.selectedPreset).toBeNull();

      // The deep-link lookup finally resolves — it must not clobber the
      // newer, already-settled state.
      resolveDeepLink(makePreset({ id: 'community-deep-link', name: 'Deep Link' }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;

      expect(el.selectedPreset).toBeNull();
    });
  });

  // --------------------------------------------------------------------
  // BUG-027
  // --------------------------------------------------------------------

  describe('BUG-027: disconnectedCallback clears the pending search debounce', () => {
    it('does not fire a load into a detached element', async () => {
      vi.useFakeTimers();
      try {
        const el = await mountTool();
        // Flush the async connectedCallback chain under fake timers.
        await vi.advanceTimersByTimeAsync(0);
        await el.updateComplete;

        const callsBeforeSearch = hybridPresetServiceMock.getPresets.mock.calls.length;

        el.handleSearchInput({ target: { value: 'blue' } } as unknown as Event);

        // Disconnect before the 300ms debounce fires.
        container.removeChild(el);

        await vi.advanceTimersByTimeAsync(1000);

        expect(hybridPresetServiceMock.getPresets.mock.calls.length).toBe(callsBeforeSearch);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
