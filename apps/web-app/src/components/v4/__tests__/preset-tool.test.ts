/**
 * XIV Dye Tools - PresetTool Unit Tests
 *
 * Regression suite for two 2026-09-16 deep-dive findings (below), plus the
 * 2026-10-04 deep-dive's preset cluster further down: tombstone
 * reconciliation (BUG-029), card votes (BUG-030, BUG-110), delete failures
 * (BUG-032), tab and rail counts (BUG-109), local search/sort on the Saved and
 * Mine tabs (OPT-008) and savedFirst ordering — the gap BUG-026 named.
 *
 * 2026-09-16 deep-dive (docs/audits/2026-09-16-deep-dive):
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
 * @module components/v4/__tests__/preset-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UnifiedPreset, PresetPoolResult } from '@services/hybrid-preset-service';
import type { SavedPreset } from '@services/saved-presets-service';
import type { CommunityPreset } from '@services/community-preset-service';
import type { Collection } from '@services/collection-service';
import type { PresetsConfig } from '@shared/tool-config-types';

// ============================================================================
// Mocks
// ============================================================================

// The list <-> detail children are unrelated to these two findings and carry
// their own service graphs (MarketBoardService, ConfigController, …, see
// preset-detail.test.ts) — registering them for real here would mean mocking
// all of that just to satisfy an import. Both are Lit custom elements
// referenced only by tag name in preset-tool's template, so an empty module
// (no registration) is a harmless unknown element for these tests.
//
// preset-tool borrows preset-detail's vote-error wording (one code -> key map
// for both vote buttons), so the detail module mock carries that one export.
// It echoes the code, so a test can see WHICH failure the toast named.
vi.mock('../preset-detail', () => ({
  voteErrorMessage: (code: string | undefined, fallbackKey: string) =>
    `voteError:${code ?? fallbackKey}`,
}));
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

let mySubmissionsMock: CommunityPreset[] = [];
const presetSubmissionServiceMock = {
  getMySubmissions: vi.fn(async () => ({ presets: mySubmissionsMock })),
  deletePreset: vi.fn(),
};

const routerServiceMock = {
  getSubPath: vi.fn(() => null as string | null),
  navigateTo: vi.fn(),
  getCurrentToolId: vi.fn(() => 'presets'),
  subscribe: vi.fn(() => () => {}),
};

/** A dye with `consolidationType: null` is market-only (unbuyable). */
const resolvePresetDyeMock = vi.fn<
  (id: number) => { hex: string; consolidationType: string | null } | undefined
>(() => undefined);

vi.mock('@services/index', () => ({
  resolvePresetDye: resolvePresetDyeMock,
  LanguageService: languageServiceMock,
  authService: authServiceMock,
  presetSubmissionService: presetSubmissionServiceMock,
  ToastService: toastServiceMock,
  ModalService: modalServiceMock,
  RouterService: routerServiceMock,
}));

const hybridPresetServiceMock = {
  initialize: vi.fn(async () => {}),
  getPresets: vi.fn<(options?: unknown) => Promise<PresetPoolResult>>(async () => pool([])),
  isAPIAvailable: vi.fn(() => true),
  getPreset: vi.fn(async () => null as UnifiedPreset | null),
};
// The real module, but for the singleton: `sortPresets` is the one sort both
// the fetched pool and the Saved/Mine shelves use (OPT-008).
vi.mock('@services/hybrid-preset-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@services/hybrid-preset-service')>()),
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

let localPalettesMock: Collection[] = [];
const collectionServiceMock = {
  subscribeCollections: vi.fn((listener: (collections: Collection[]) => void) => {
    listener(localPalettesMock);
    return () => {};
  }),
};
vi.mock('@services/collection-service', () => ({ CollectionService: collectionServiceMock }));

function defaultConfig(): PresetsConfig {
  return {
    sortBy: 'popular',
    category: 'all',
    feedShots: true,
    feedBlend: false,
    feedHideUnbuyable: false,
    savedFirst: true,
    keepDeleted: true,
    displayOptions: {} as PresetsConfig['displayOptions'],
  };
}
let configControllerConfig: PresetsConfig = defaultConfig();
let presetsConfigListener: ((config: PresetsConfig) => void) | null = null;
const configControllerMock = {
  getConfig: vi.fn(() => configControllerConfig),
  subscribe: vi.fn((_tool: string, listener: (config: PresetsConfig) => void) => {
    presetsConfigListener = listener;
    return () => {};
  }),
  // Like the real controller: store, then broadcast to subscribers.
  setConfig: vi.fn((_tool: string, partial: Partial<PresetsConfig>) => {
    configControllerConfig = { ...configControllerConfig, ...partial };
    presetsConfigListener?.(configControllerConfig);
  }),
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

function makeSaved(overrides: Partial<SavedPreset> = {}): SavedPreset {
  return {
    id: 'community-1',
    name: 'Test Preset',
    description: 'A test preset',
    category: 'aesthetics',
    secondaryCategories: [],
    dyes: [1],
    tags: [],
    isCurated: false,
    savedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function makeCommunity(overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  return {
    id: 'api-1',
    name: 'Mine',
    description: 'My own preset',
    category_id: 'aesthetics',
    secondary_categories: [],
    dyes: [1, 2, 3],
    tags: [],
    author_discord_id: 'me',
    author_name: 'Me',
    vote_count: 0,
    status: 'approved',
    is_curated: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  } as CommunityPreset;
}

function makeLocalPalette(id: string, name = `Local ${id}`): Collection {
  return {
    id,
    name,
    kind: 'palette',
    dyes: [1, 2],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  } as Collection;
}

/**
 * What `hybridPresetService.getPresets` answers. Every test goes through
 * here so the answer's shape lives in one place: BUG-029 changed it from the
 * bare list to `{ presets, apiOk, apiIds }`. `apiIds` defaults to the API rows
 * in `presets`; pass it to model rows the merged sort+slice cut from the list.
 */
function pool(
  presets: UnifiedPreset[],
  opts: { apiOk?: boolean; apiIds?: string[] } = {}
): PresetPoolResult {
  const apiOk = opts.apiOk ?? true;
  return {
    presets,
    apiOk,
    apiIds: opts.apiIds ?? (apiOk ? presets.filter((p) => p.isFromAPI).map((p) => p.id) : []),
  };
}

type PresetToolEl = HTMLElement & {
  updateComplete: Promise<unknown>;
  shadowRoot: ShadowRoot;
  selectedPreset: UnifiedPreset | null;
  presets: UnifiedPreset[];
  tab: string;
  searchQuery: string;
  handlePresetSelect: (e: CustomEvent<{ preset: UnifiedPreset }>) => void;
  handleSearchInput: (e: Event) => void;
};

type CardEl = HTMLElement & {
  data: { preset: UnifiedPreset };
  voted: boolean;
  saved: boolean;
  tombstone: boolean;
};

const TAB_INDEX = { community: 0, official: 1, saved: 2, mine: 3 } as const;

function cards(el: PresetToolEl): CardEl[] {
  return [...el.shadowRoot.querySelectorAll('v4-preset-card')] as CardEl[];
}

function cardIds(el: PresetToolEl): string[] {
  return cards(el).map((c) => c.data.preset.id);
}

function cardFor(el: PresetToolEl, id: string): CardEl {
  const card = cards(el).find((c) => c.data.preset.id === id);
  if (!card) throw new Error(`no card for ${id}; have ${cardIds(el).join(', ')}`);
  return card;
}

function tabCount(el: PresetToolEl, tab: keyof typeof TAB_INDEX): string {
  const button = el.shadowRoot.querySelectorAll('.tab-btn')[TAB_INDEX[tab]];
  return button.querySelector('.tab-count')!.textContent!.trim();
}

/** The rail's "All" chip count — the tab's whole pool before the category cut. */
function railAllCount(el: PresetToolEl): string {
  return el.shadowRoot.querySelector('.cat-btn .cat-count')!.textContent!.trim();
}

async function clickTab(el: PresetToolEl, tab: keyof typeof TAB_INDEX): Promise<void> {
  el.shadowRoot.querySelectorAll<HTMLButtonElement>('.tab-btn')[TAB_INDEX[tab]].click();
  await el.updateComplete;
}

function typeSearch(el: PresetToolEl, value: string): void {
  el.handleSearchInput({ target: { value } } as unknown as Event);
}

// ============================================================================
// Tests
// ============================================================================

describe('PresetTool', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    savedListMock = [];
    localPalettesMock = [];
    mySubmissionsMock = [];
    configControllerConfig = defaultConfig();
    presetsConfigListener = null;
    vi.clearAllMocks();
    // clearAllMocks keeps implementations (Vitest 5): reset every one a test
    // may change, so none leaks into the next.
    hybridPresetServiceMock.initialize.mockResolvedValue(undefined);
    hybridPresetServiceMock.getPresets.mockReset();
    hybridPresetServiceMock.getPresets.mockResolvedValue(pool([]));
    hybridPresetServiceMock.isAPIAvailable.mockReturnValue(true);
    hybridPresetServiceMock.getPreset.mockResolvedValue(null);
    routerServiceMock.getSubPath.mockReturnValue(null);
    routerServiceMock.getCurrentToolId.mockReturnValue('presets');
    authServiceMock.isAuthenticated.mockReturnValue(false);
    communityPresetServiceMock.voteForPreset.mockReset();
    communityPresetServiceMock.removeVote.mockReset();
    presetSubmissionServiceMock.deletePreset.mockReset();
    savedPresetsServiceMock.markDeleted.mockReset();
    resolvePresetDyeMock.mockReset();
    resolvePresetDyeMock.mockReturnValue(undefined);
  });

  afterEach(() => {
    container.innerHTML = '';
    container.remove();
    vi.restoreAllMocks();
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
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));

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
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));

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
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));

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
        hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));

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
        hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));

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

  // ====================================================================
  // 2026-10-04 deep-dive (docs/audits/2026-10-04-deep-dive)
  // ====================================================================

  /** Mount, signed in or not, and let the async connectedCallback settle. */
  async function mountLoaded(signedIn = false): Promise<PresetToolEl> {
    authServiceMock.isAuthenticated.mockReturnValue(signedIn);
    const el = await mountTool();
    await flush(el);
    return el;
  }

  // --------------------------------------------------------------------
  // BUG-029
  // --------------------------------------------------------------------

  describe('BUG-029: tombstone reconciliation never marks a live preset', () => {
    const curated = makePreset({
      id: 'curated-1',
      name: 'Official',
      isCurated: true,
      isFromAPI: false,
      apiPresetId: undefined,
    });

    it('does not tombstone saved presets when the community request failed', async () => {
      savedListMock = [makeSaved({ id: 'community-9' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(
        pool([curated], { apiOk: false, apiIds: [] })
      );

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).not.toHaveBeenCalledWith('community-9', true);
    });

    it('shows the offline strip, not an empty feed, when the community request failed', async () => {
      hybridPresetServiceMock.getPresets.mockResolvedValue(
        pool([curated], { apiOk: false, apiIds: [] })
      );

      const el = await mountLoaded();

      expect(el.shadowRoot.querySelector('.offline-strip')).not.toBeNull();
      expect(tabCount(el, 'community')).toBe('—');
    });

    it('never tombstones a saved local palette, which the API never lists', async () => {
      localPalettesMock = [makeLocalPalette('abc')];
      savedListMock = [makeSaved({ id: 'local-abc' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([makePreset()]));

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).not.toHaveBeenCalledWith('local-abc', true);
    });

    it('repairs a local palette an earlier version tombstoned', async () => {
      localPalettesMock = [makeLocalPalette('abc')];
      savedListMock = [makeSaved({ id: 'local-abc', deletedByAuthor: true })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([makePreset()]));

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).toHaveBeenCalledWith('local-abc', false);
    });

    it('shows no "Removed by its author" chip on a local palette', async () => {
      localPalettesMock = [makeLocalPalette('abc')];
      savedListMock = [makeSaved({ id: 'local-abc', deletedByAuthor: true })];

      const el = await mountLoaded();
      await clickTab(el, 'saved');

      expect(cardFor(el, 'local-abc').tombstone).toBe(false);
    });

    it('lists a saved local palette once on the Saved tab', async () => {
      localPalettesMock = [makeLocalPalette('abc')];
      savedListMock = [makeSaved({ id: 'local-abc', name: 'Local abc' })];

      const el = await mountLoaded();
      await clickTab(el, 'saved');

      expect(cardIds(el)).toEqual(['local-abc']);
    });

    it('does not read API rows cut from the displayed list as deleted', async () => {
      // The merged curated + community list is sorted and cut to the page
      // size; community-9 came back from the API but did not make the cut.
      savedListMock = [makeSaved({ id: 'community-9' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(
        pool([curated], { apiIds: ['community-9'] })
      );

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).not.toHaveBeenCalledWith('community-9', true);
    });

    it('drops a filtered response that lands after the search was cleared', async () => {
      vi.useFakeTimers();
      try {
        const kept = makePreset({ id: 'community-9', name: 'Kept' });
        savedListMock = [makeSaved({ id: 'community-9', name: 'Kept' })];
        hybridPresetServiceMock.getPresets.mockResolvedValue(pool([kept]));
        const el = await mountTool();
        await vi.advanceTimersByTimeAsync(0);
        await el.updateComplete;
        savedPresetsServiceMock.markDeleted.mockClear();

        // A slow search for 'x' …
        let resolveX!: (value: ReturnType<typeof pool>) => void;
        hybridPresetServiceMock.getPresets.mockImplementationOnce(
          () => new Promise((resolve) => (resolveX = resolve))
        );
        typeSearch(el, 'x');
        await vi.advanceTimersByTimeAsync(300);

        // … the box is cleared and the full list comes back first …
        hybridPresetServiceMock.getPresets.mockResolvedValueOnce(pool([kept]));
        typeSearch(el, '');
        await vi.advanceTimersByTimeAsync(300);
        await el.updateComplete;

        // … then the 'x' answer lands, without the saved preset in it.
        resolveX(pool([makePreset({ id: 'community-x', name: 'X only' })]));
        await vi.advanceTimersByTimeAsync(0);
        await el.updateComplete;

        expect(savedPresetsServiceMock.markDeleted).not.toHaveBeenCalledWith('community-9', true);
        expect(el.presets.map((p) => p.id)).toEqual(['community-9']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('restores a tombstoned preset found on a full page', async () => {
      // A full page may not be the whole collection, so it never tombstones —
      // but a preset that IS on it plainly exists.
      const page = Array.from({ length: 50 }, (_, i) => makePreset({ id: `community-${i}` }));
      savedListMock = [makeSaved({ id: 'community-7', deletedByAuthor: true })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool(page));

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).toHaveBeenCalledWith('community-7', false);
    });

    it('restores a tombstoned preset a search finds, and tombstones nothing a search misses', async () => {
      vi.useFakeTimers();
      try {
        savedListMock = [
          makeSaved({ id: 'community-7', name: 'Blue', deletedByAuthor: true }),
          makeSaved({ id: 'community-8', name: 'Red' }),
        ];
        hybridPresetServiceMock.getPresets.mockResolvedValue(pool([]));
        const el = await mountTool();
        await vi.advanceTimersByTimeAsync(0);
        savedPresetsServiceMock.markDeleted.mockClear();

        hybridPresetServiceMock.getPresets.mockResolvedValueOnce(
          pool([makePreset({ id: 'community-7', name: 'Blue' })])
        );
        typeSearch(el, 'blue');
        await vi.advanceTimersByTimeAsync(300);

        expect(savedPresetsServiceMock.markDeleted).toHaveBeenCalledWith('community-7', false);
        expect(savedPresetsServiceMock.markDeleted).not.toHaveBeenCalledWith('community-8', true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('still tombstones a saved preset missing from a complete, unfiltered page', async () => {
      savedListMock = [makeSaved({ id: 'community-9' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([makePreset()]));

      await mountLoaded();

      expect(savedPresetsServiceMock.markDeleted).toHaveBeenCalledWith('community-9', true);
    });
  });

  // --------------------------------------------------------------------
  // BUG-030 + BUG-110
  // --------------------------------------------------------------------

  describe('BUG-030: card votes report what actually happened', () => {
    const preset = makePreset({ id: 'community-1', apiPresetId: 'api-1', voteCount: 4 });

    async function mountWithCard(): Promise<PresetToolEl> {
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));
      return mountLoaded(true);
    }

    async function clickVote(el: PresetToolEl): Promise<void> {
      cardFor(el, preset.id).dispatchEvent(new CustomEvent('preset-vote', { detail: { preset } }));
      await flush(el);
    }

    it.each(['voteFailed', 'network'] as const)(
      'a failed vote (%s) is an error, not "already voted"',
      async (errorCode) => {
        communityPresetServiceMock.voteForPreset.mockResolvedValueOnce({
          success: false,
          new_vote_count: 0,
          errorCode,
        });
        const el = await mountWithCard();

        await clickVote(el);

        expect(toastServiceMock.error).toHaveBeenCalledWith(`voteError:${errorCode}`);
        expect(toastServiceMock.info).not.toHaveBeenCalledWith('preset.alreadyVoted');
        expect(cardFor(el, preset.id).voted).toBe(false);
      }
    );

    it('a vote the server already had marks the card voted', async () => {
      communityPresetServiceMock.voteForPreset.mockResolvedValueOnce({
        success: false,
        new_vote_count: 4,
        already_voted: true,
        errorCode: 'alreadyVoted',
      });
      const el = await mountWithCard();

      await clickVote(el);

      expect(toastServiceMock.info).toHaveBeenCalledWith('preset.alreadyVoted');
      expect(toastServiceMock.error).not.toHaveBeenCalled();
      expect(cardFor(el, preset.id).voted).toBe(true);
    });

    it('a successful vote marks the card voted with the new count', async () => {
      communityPresetServiceMock.voteForPreset.mockResolvedValueOnce({
        success: true,
        new_vote_count: 5,
      });
      const el = await mountWithCard();

      await clickVote(el);

      expect(toastServiceMock.success).toHaveBeenCalledWith('preset.voteAdded');
      expect(cardFor(el, preset.id).voted).toBe(true);
      expect(cardFor(el, preset.id).data.preset.voteCount).toBe(5);
    });

    it('a failed un-vote says so and keeps the vote', async () => {
      communityPresetServiceMock.voteForPreset.mockResolvedValueOnce({
        success: true,
        new_vote_count: 5,
      });
      communityPresetServiceMock.removeVote.mockResolvedValueOnce({
        success: false,
        new_vote_count: 0,
        errorCode: 'removeVoteFailed',
      });
      const el = await mountWithCard();
      await clickVote(el);

      await clickVote(el);

      expect(toastServiceMock.error).toHaveBeenCalledWith('voteError:removeVoteFailed');
      expect(cardFor(el, preset.id).voted).toBe(true);
      expect(cardFor(el, preset.id).data.preset.voteCount).toBe(5);
    });
  });

  describe('BUG-110: the card follows a vote changed in the detail view', () => {
    const preset = makePreset({ id: 'community-1', apiPresetId: 'api-1', voteCount: 4 });

    async function openDetailAndEmit(
      el: PresetToolEl,
      detail: { preset: UnifiedPreset; voted: boolean }
    ): Promise<void> {
      vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));
      await el.updateComplete;
      const detailEl = el.shadowRoot.querySelector('v4-preset-detail')!;
      detailEl.dispatchEvent(new CustomEvent('vote-update', { detail }));
      detailEl.dispatchEvent(new CustomEvent('back'));
      await el.updateComplete;
    }

    it('an un-vote in the detail clears the card’s voted state', async () => {
      communityPresetServiceMock.voteForPreset.mockResolvedValueOnce({
        success: true,
        new_vote_count: 5,
      });
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));
      const el = await mountLoaded(true);
      cardFor(el, preset.id).dispatchEvent(new CustomEvent('preset-vote', { detail: { preset } }));
      await flush(el);
      expect(cardFor(el, preset.id).voted).toBe(true);

      await openDetailAndEmit(el, { preset: { ...preset, voteCount: 4 }, voted: false });

      expect(cardFor(el, preset.id).voted).toBe(false);
      expect(cardFor(el, preset.id).data.preset.voteCount).toBe(4);
    });

    it('a vote in the detail marks the card voted', async () => {
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));
      const el = await mountLoaded(true);

      await openDetailAndEmit(el, { preset: { ...preset, voteCount: 5 }, voted: true });

      expect(cardFor(el, preset.id).voted).toBe(true);
      expect(cardFor(el, preset.id).data.preset.voteCount).toBe(5);
    });
  });

  // --------------------------------------------------------------------
  // BUG-032
  // --------------------------------------------------------------------

  describe('BUG-032: a failed delete is reported as a failure', () => {
    const preset = makePreset({ id: 'community-1', apiPresetId: 'api-1' });

    async function confirmDelete(): Promise<PresetToolEl> {
      mySubmissionsMock = [makeCommunity({ id: 'api-1' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool([preset]));
      const el = await mountLoaded(true);
      const pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      el.handlePresetSelect(new CustomEvent('preset-select', { detail: { preset } }));
      await el.updateComplete;
      pushSpy.mockClear();
      hybridPresetServiceMock.getPresets.mockClear();

      el.shadowRoot
        .querySelector('v4-preset-detail')!
        .dispatchEvent(new CustomEvent('delete-preset', { detail: { preset } }));
      await flush(el);
      const confirm = modalServiceMock.showConfirm.mock.calls[0][0] as {
        onConfirm: () => Promise<void>;
      };
      await confirm.onConfirm();
      await flush(el);
      return el;
    }

    it('says the delete failed and keeps the detail open', async () => {
      presetSubmissionServiceMock.deletePreset.mockResolvedValueOnce({
        success: false,
        error: 'Forbidden',
      });

      const el = await confirmDelete();

      expect(toastServiceMock.error).toHaveBeenCalledWith('errors.deletePresetFailed');
      expect(toastServiceMock.success).not.toHaveBeenCalledWith('preset.deleteSuccess');
      expect(el.selectedPreset).toEqual(preset);
      expect(window.history.pushState).not.toHaveBeenCalled();
      expect(hybridPresetServiceMock.getPresets).not.toHaveBeenCalled();
    });

    it('on success says so, reloads and returns to the list', async () => {
      presetSubmissionServiceMock.deletePreset.mockResolvedValueOnce({ success: true });

      const el = await confirmDelete();

      expect(toastServiceMock.success).toHaveBeenCalledWith('preset.deleteSuccess');
      expect(toastServiceMock.error).not.toHaveBeenCalled();
      expect(el.selectedPreset).toBeNull();
      expect(hybridPresetServiceMock.getPresets).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------
  // BUG-109
  // --------------------------------------------------------------------

  describe('BUG-109: tab and rail counts agree with the cards shown', () => {
    it('Hide unbuyable drops market-only presets from the rail and the tab badge', async () => {
      configControllerConfig = { ...defaultConfig(), feedHideUnbuyable: true };
      resolvePresetDyeMock.mockImplementation((id) =>
        id === 99 ? { hex: '#000000', consolidationType: null } : undefined
      );
      hybridPresetServiceMock.getPresets.mockResolvedValue(
        pool([makePreset({ id: 'community-1' }), makePreset({ id: 'community-2', dyes: [99] })])
      );

      const el = await mountLoaded();

      expect(cardIds(el)).toEqual(['community-1']);
      expect(railAllCount(el)).toBe('1');
      expect(tabCount(el, 'community')).toBe('1');
    });

    it('Blend counts the official palettes it blends into the feed', async () => {
      configControllerConfig = { ...defaultConfig(), feedBlend: true };
      hybridPresetServiceMock.getPresets.mockResolvedValue(
        pool([
          makePreset({ id: 'community-1' }),
          makePreset({ id: 'curated-1', isCurated: true, isFromAPI: false }),
        ])
      );

      const el = await mountLoaded();

      expect(cards(el)).toHaveLength(2);
      expect(railAllCount(el)).toBe('2');
      expect(tabCount(el, 'community')).toBe('2');
    });

    it('Keep deleted off drops tombstoned copies from the Saved counts', async () => {
      configControllerConfig = { ...defaultConfig(), keepDeleted: false };
      savedListMock = [
        makeSaved({ id: 'community-8', name: 'Alive' }),
        makeSaved({ id: 'community-9', name: 'Gone', deletedByAuthor: true }),
      ];

      const el = await mountLoaded();
      await clickTab(el, 'saved');

      expect(cardIds(el)).toEqual(['community-8']);
      expect(railAllCount(el)).toBe('1');
      expect(tabCount(el, 'saved')).toBe('1');
    });

    it('the Saved counts follow the search', async () => {
      savedListMock = [
        makeSaved({ id: 'community-8', name: 'Alpha' }),
        makeSaved({ id: 'community-9', name: 'Beta' }),
      ];
      const el = await mountLoaded();
      await clickTab(el, 'saved');

      typeSearch(el, 'alp');
      await el.updateComplete;

      expect(cardIds(el)).toEqual(['community-8']);
      expect(railAllCount(el)).toBe('1');
    });

    it('the Saved badge counts local palettes', async () => {
      localPalettesMock = [makeLocalPalette('abc')];

      const el = await mountLoaded();

      expect(tabCount(el, 'saved')).toBe('1');
    });

    it('the Saved counts list a saved local palette once', async () => {
      localPalettesMock = [makeLocalPalette('abc')];
      savedListMock = [makeSaved({ id: 'local-abc', name: 'Local abc' })];

      const el = await mountLoaded();
      await clickTab(el, 'saved');

      expect(railAllCount(el)).toBe('1');
      expect(tabCount(el, 'saved')).toBe('1');
    });
  });

  // --------------------------------------------------------------------
  // savedFirst (BUG-026's gap: ordering had no test)
  // --------------------------------------------------------------------

  describe('savedFirst ordering', () => {
    const feed = ['community-a', 'community-b', 'community-c'].map((id) => makePreset({ id }));

    it('pins saved presets to the top of the community feed', async () => {
      savedListMock = [makeSaved({ id: 'community-c' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool(feed));

      const el = await mountLoaded();

      expect(cardIds(el)).toEqual(['community-c', 'community-a', 'community-b']);
    });

    it('keeps the feed order when Saved first is off', async () => {
      configControllerConfig = { ...defaultConfig(), savedFirst: false };
      savedListMock = [makeSaved({ id: 'community-c' })];
      hybridPresetServiceMock.getPresets.mockResolvedValue(pool(feed));

      const el = await mountLoaded();

      expect(cardIds(el)).toEqual(['community-a', 'community-b', 'community-c']);
    });
  });

  // --------------------------------------------------------------------
  // OPT-008
  // --------------------------------------------------------------------

  describe('OPT-008: Saved and Mine search and sort locally', () => {
    /** Click the sort button until it reads `target`. */
    async function sortBy(el: PresetToolEl, target: 'popular' | 'recent' | 'name'): Promise<void> {
      for (let i = 0; i < 3 && configControllerConfig.sortBy !== target; i++) {
        el.shadowRoot.querySelector<HTMLButtonElement>('.sort-btn')!.click();
        await el.updateComplete;
      }
    }

    it('a search on the Saved tab filters without a refetch', async () => {
      vi.useFakeTimers();
      try {
        savedListMock = [
          makeSaved({ id: 'community-8', name: 'Alpha' }),
          makeSaved({ id: 'community-9', name: 'Beta' }),
        ];
        const el = await mountTool();
        await vi.advanceTimersByTimeAsync(0);
        await clickTab(el, 'saved');
        const calls = hybridPresetServiceMock.getPresets.mock.calls.length;

        typeSearch(el, 'alp');
        await vi.advanceTimersByTimeAsync(1000);
        await el.updateComplete;

        expect(hybridPresetServiceMock.getPresets.mock.calls.length).toBe(calls);
        expect(cardIds(el)).toEqual(['community-8']);
      } finally {
        vi.useRealTimers();
      }
    });

    it('a sort on the Saved tab reorders the shelf without a refetch', async () => {
      savedListMock = [
        makeSaved({ id: 'community-9', name: 'Beta' }),
        makeSaved({ id: 'community-8', name: 'Alpha' }),
      ];
      localPalettesMock = [makeLocalPalette('abc', 'Aardvark')];
      const el = await mountLoaded();
      await clickTab(el, 'saved');
      const calls = hybridPresetServiceMock.getPresets.mock.calls.length;

      await sortBy(el, 'name');
      await flush(el);

      expect(hybridPresetServiceMock.getPresets.mock.calls.length).toBe(calls);
      expect(cardIds(el)).toEqual(['local-abc', 'community-8', 'community-9']);
    });

    it('the Mine tab follows the search and the sort', async () => {
      mySubmissionsMock = [
        makeCommunity({ id: 'm-2', name: 'Zest Alpine' }),
        makeCommunity({ id: 'm-1', name: 'Alpine Dawn' }),
        makeCommunity({ id: 'm-3', name: 'Coral' }),
      ];
      const el = await mountLoaded(true);
      await clickTab(el, 'mine');

      typeSearch(el, 'alpine');
      await sortBy(el, 'name');
      await flush(el);

      expect(cardIds(el)).toEqual(['community-m-1', 'community-m-2']);
    });

    it('returning to Community after a Saved-tab search fetches that search', async () => {
      vi.useFakeTimers();
      try {
        const el = await mountTool();
        await vi.advanceTimersByTimeAsync(0);
        await clickTab(el, 'saved');
        typeSearch(el, 'alp');
        await vi.advanceTimersByTimeAsync(1000);

        await clickTab(el, 'community');
        await vi.advanceTimersByTimeAsync(0);

        const calls = hybridPresetServiceMock.getPresets.mock.calls;
        expect(calls[calls.length - 1][0]).toMatchObject({ search: 'alp' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('returning to Community after a Saved-tab sort fetches that sort', async () => {
      const el = await mountLoaded();
      await clickTab(el, 'saved');
      await sortBy(el, 'name');

      await clickTab(el, 'community');
      await flush(el);

      const calls = hybridPresetServiceMock.getPresets.mock.calls;
      expect(calls[calls.length - 1][0]).toMatchObject({ sort: 'name' });
    });

    it('a load still in flight does not spin the Saved shelf', async () => {
      savedListMock = [makeSaved({ id: 'community-8', name: 'Alpha' })];
      const el = await mountLoaded();
      hybridPresetServiceMock.getPresets.mockImplementationOnce(() => new Promise(() => {}));
      await sortBy(el, 'recent'); // a Community-tab sort: refetches, never answers

      await clickTab(el, 'saved');

      expect(el.shadowRoot.querySelector('.spinner')).toBeNull();
      expect(cardIds(el)).toEqual(['community-8']);
    });

    it('a search typed on Community, then left for Saved, is not fetched there', async () => {
      vi.useFakeTimers();
      try {
        const el = await mountTool();
        await vi.advanceTimersByTimeAsync(0);
        const calls = hybridPresetServiceMock.getPresets.mock.calls.length;

        typeSearch(el, 'alp');
        await clickTab(el, 'saved');
        await vi.advanceTimersByTimeAsync(1000);

        expect(hybridPresetServiceMock.getPresets.mock.calls.length).toBe(calls);
      } finally {
        vi.useRealTimers();
      }
    });

    it('switching tabs with nothing changed does not refetch', async () => {
      const el = await mountLoaded();
      const calls = hybridPresetServiceMock.getPresets.mock.calls.length;

      await clickTab(el, 'saved');
      await clickTab(el, 'official');
      await clickTab(el, 'community');
      await flush(el);

      expect(hybridPresetServiceMock.getPresets.mock.calls.length).toBe(calls);
    });
  });
});
