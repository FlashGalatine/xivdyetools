/**
 * XIV Dye Tools 5.0 — Preset Tool (8A Gallery).
 *
 * Community-first: tabs Community (default) / Official / Saved / Mine, a
 * category rail with live counts, one search field, a cycling sort, and
 * picture-led cards with votes and saves on the face. The offline state is
 * the common case by design — the strip names it, and the Official tab is
 * what is left standing. Saved is the local, offline-proof shelf
 * (SavedPresetsService snapshots with tombstones).
 *
 * Spec: docs/research/monorepo-2.0/8a-gallery-port-spec.md
 *
 * @module components/v4/preset-tool
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ICON_STATE_PRESETS_EMPTY, ICON_STATE_SEARCH } from '@shared/state-icons';
import { BaseLitComponent } from './base-lit-component';
import { ConfigController } from '@services/config-controller';
import { hybridPresetService, sortPresets } from '@services/hybrid-preset-service';
import {
  resolvePresetDye,
  LanguageService,
  authService,
  presetSubmissionService,
  ToastService,
  ModalService,
  RouterService,
} from '@services/index';
import { communityPresetService } from '@services/community-preset-service';
import { SavedPresetsService, type SavedPreset } from '@services/saved-presets-service';
import { CollectionService, type Collection } from '@services/collection-service';
import { logger } from '@shared/logger';
import { presetCategoryLabel } from '@shared/preset-i18n';
import { sanitizeExampleLink, sanitizePreviewImageUrl } from '@shared/example-link';
import type { UnifiedPreset, PresetPoolResult } from '@services/hybrid-preset-service';
import type { CommunityPreset } from '@services/community-preset-service';
import type { PresetsConfig, PresetCategoryFilter } from '@shared/tool-config-types';
import type { PresetCategory } from '@xivdyetools/types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';

// Import child components
import './preset-card';
import { voteErrorMessage, type VoteUpdateDetail } from './preset-detail';
import type { PresetCardData } from './preset-card';

type PresetTab = 'community' | 'official' | 'saved' | 'mine';

const CATEGORY_ORDER: readonly PresetCategoryFilter[] = [
  'all',
  'aesthetics',
  'jobs',
  'seasons',
  'events',
  'grand-companies',
  'appearance',
  'zones',
  'raids-trials',
];

const SORT_ORDER = ['popular', 'recent', 'name'] as const;

/**
 * How many presets one load asks for.
 *
 * BUG-020: this must match what presets-api will actually return, because
 * tombstone reconciliation treats "absent from the fetched pool" as "deleted
 * by its author". The server clamps `limit` to 50
 * (`apps/presets-api/src/handlers/presets.ts:240`), so asking for 100 quietly
 * produced a 50-row pool that reconciliation then read as 50 deletions.
 */
const PRESET_PAGE_LIMIT = 50;

/** A local CollectionService palette's gallery id (see `localPaletteToUnified`). */
function isLocalPaletteId(id: string): boolean {
  return id.startsWith('local-');
}

/** Name, description or a tag contains the (lower-cased) query. */
function matchesSearch(preset: UnifiedPreset, q: string): boolean {
  return (
    preset.name.toLowerCase().includes(q) ||
    preset.description.toLowerCase().includes(q) ||
    preset.tags.some((t) => t.toLowerCase().includes(q))
  );
}

/**
 * V4 Preset Tool — the 8A Gallery.
 */
@customElement('v4-preset-tool')
export class PresetTool extends BaseLitComponent {
  /** Merged pool (curated + community) from the hybrid service */
  @state()
  private presets: UnifiedPreset[] = [];

  @state()
  private selectedPreset: UnifiedPreset | null = null;

  @state()
  private isLoading: boolean = true;

  @state()
  private tab: PresetTab = 'community';

  @state()
  private savedList: SavedPreset[] = [];

  /**
   * The user's OWN palettes, held locally by CollectionService as
   * `kind: 'palette'` records — including everything migrated in from the 4.x
   * PaletteService store, which is where palettes built before 5.0 live.
   *
   * These have no presence in the community API (they were never submitted),
   * so without this they were invisible in 5.0: the Gallery only ever showed
   * the API pool, the curated pool and saved snapshots of those two. Reading
   * them here is view-only and additive — nothing rewrites the records, so a
   * user still running 4.x elsewhere keeps working.
   */
  @state()
  private localPalettes: Collection[] = [];

  /** Preset ids the user voted for (session-tracked; API confirms) */
  @state()
  private votedIds: Set<string> = new Set();

  /**
   * The community feed did not answer the last load: unreachable at init, or
   * that one request failed (BUG-029, 2026-10-04 deep-dive — a failed request
   * used to leave this false and show an empty feed instead of the strip).
   */
  @state()
  private offline: boolean = false;

  @state()
  private config: PresetsConfig = {
    sortBy: 'popular',
    category: 'all',
    feedShots: true,
    feedBlend: false,
    feedHideUnbuyable: false,
    savedFirst: true,
    keepDeleted: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };

  @state()
  private searchQuery: string = '';

  @state()
  private userSubmissions: CommunityPreset[] = [];

  @state()
  private isAuthenticated: boolean = false;

  private configController: ConfigController | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private savedUnsubscribe: (() => void) | null = null;
  private collectionsUnsubscribe: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;
  private _searchDebounce: number = 0;
  /** BUG-005 review: guards `restoreSelectedPresetFromHistory`'s API-fallback await against a stale result — see `handleWindowPopState`. */
  private _restoreSeq: number = 0;
  /** BUG-029 (2026-10-04 deep-dive): guards `loadPresets` against a superseded answer — see there. */
  private _loadSeq: number = 0;
  /**
   * The search and sort the API pool was last fetched with. OPT-008
   * (2026-10-04 deep-dive): Saved and Mine search and sort locally, so a change
   * made there leaves the pool behind until an API tab is chosen again —
   * `handleTabSelect` refetches then.
   */
  private poolQuery: string = '';
  private poolSort: PresetsConfig['sortBy'] | null = null;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow-y: auto;
      }

      .preset-tool {
        padding: 24px;
        min-height: 100%;
        max-width: 1120px;
        margin: 0 auto;
      }

      /* Tabs */
      .tab-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
        background: transparent;
        color: var(--theme-text-muted, #888888);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .tab-btn--on {
        background: color-mix(in srgb, var(--theme-primary, #ea4133) 14%, transparent);
        border-color: color-mix(in srgb, var(--theme-primary, #ea4133) 45%, transparent);
        color: var(--theme-primary, #ea4133);
      }

      .tab-count {
        font-family: var(--font-mono);
        font-size: 10.5px;
        opacity: 0.8;
      }

      /* Search + sort row */
      .filter-row {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .search-input {
        flex: 1 1 260px;
        max-width: 420px;
        padding: 10px 14px;
        background: var(--theme-card-background, rgba(0, 0, 0, 0.3));
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        color: var(--theme-text, #e0e0e0);
        font-size: 13px;
      }

      .search-input::placeholder {
        color: var(--theme-text-muted, #888888);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--theme-primary, #ea4133);
      }

      .sort-btn {
        padding: 9px 14px;
        border-radius: 8px;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
        background: transparent;
        color: var(--theme-text, #e0e0e0);
        font-size: 12.5px;
        cursor: pointer;
        white-space: nowrap;
      }

      .results-count {
        font-size: 12.5px;
        color: var(--theme-text-muted, #888888);
        white-space: nowrap;
      }

      /* Category rail */
      .cat-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .cat-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--theme-text-muted, #888888);
        font-size: 12px;
        cursor: pointer;
      }

      .cat-btn--on {
        background: color-mix(in srgb, var(--theme-primary, #ea4133) 14%, transparent);
        border-color: color-mix(in srgb, var(--theme-primary, #ea4133) 45%, transparent);
        color: var(--theme-primary, #ea4133);
      }

      .cat-count {
        font-family: var(--font-mono);
        font-size: 10px;
        opacity: 0.75;
      }

      /* Offline strip */
      .offline-strip {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 16px;
        border-radius: 10px;
        border: 1px solid rgba(244, 191, 79, 0.35);
        background: rgba(244, 191, 79, 0.08);
        margin-bottom: 18px;
      }

      .offline-head {
        font-size: 13.5px;
        font-weight: 650;
        color: var(--theme-text, #e0e0e0);
      }

      .offline-sub {
        font-size: 12px;
        color: var(--theme-text-muted, #888888);
        line-height: 1.5;
      }

      /* Grid */
      .preset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 18px;
      }

      /* Loading / empty */
      .loading-container,
      .empty-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 260px;
        gap: 14px;
        text-align: center;
      }

      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-top-color: var(--theme-primary, #ea4133);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .empty-message,
      .loading-text {
        color: var(--theme-text-muted, #888888);
        font-size: 13.5px;
        max-width: 420px;
      }

      /* 1a: the shelves with room — full-strength ink in the measured quiet
         grey; the one filled chip is the accent slot */
      .empty-glyph {
        color: var(--theme-text-muted, #9c9ca2);
      }

      .empty-glyph svg {
        width: 62px;
        height: 62px;
        display: block;
      }

      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
      }

      @media (max-width: 768px) {
        .preset-tool {
          padding: 16px;
        }
        .preset-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // BUG-005: list <-> detail is an in-component state change, not a route
    // change the shell remounts for — the router notifies a same-tool popstate
    // with `sameTool: true` and v4-layout skips its remount on that flag, so
    // this listener is the only thing that responds to Back/Forward while
    // this element stays mounted.
    window.addEventListener('popstate', this.handleWindowPopState);

    this.configController = ConfigController.getInstance();
    this.config = this.configController.getConfig('presets');
    this.configUnsubscribe = this.configController.subscribe('presets', (newConfig) => {
      // BUG-068: only `sortBy` reaches the API -- loadPresets() sends search +
      // sort, and `category` is deliberately sliced at RENDER time so the
      // rail's counts stay computed over the unfiltered pool. Refetching for
      // the other seven keys (category, feedShots, feedBlend,
      // feedHideUnbuyable, savedFirst, keepDeleted, displayOptions)
      // spinner-flashed the grid and re-downloaded up to 100 presets for a
      // change that never leaves the client. `config` is @state(), so the
      // assignment alone re-renders. OPT-008 (2026-10-04 deep-dive): nor does
      // a sort change on Saved or Mine, which sort locally; `handleTabSelect`
      // catches the pool up when an API tab is chosen.
      const needsRefetch = newConfig.sortBy !== this.config.sortBy;
      this.config = newConfig;
      if (needsRefetch && this.isApiTab()) {
        void this.loadPresets();
      }
    });

    this.isAuthenticated = authService.isAuthenticated();
    this.authUnsubscribe = authService.subscribe((state) => {
      const wasAuthenticated = this.isAuthenticated;
      this.isAuthenticated = state.isAuthenticated;
      if (!wasAuthenticated && this.isAuthenticated) {
        void this.loadUserSubmissions();
      } else if (!this.isAuthenticated) {
        this.userSubmissions = [];
        if (this.tab === 'mine') this.tab = 'community';
      }
    });

    this.savedList = SavedPresetsService.getAll();
    this.languageUnsubscribe = LanguageService.subscribe(() => this.requestUpdate());

    this.savedUnsubscribe = SavedPresetsService.subscribe((saved) => {
      this.savedList = saved;
    });

    // Local palettes (incl. the 4.x records CollectionService migrates on
    // init) join the Saved shelf — see `localPalettes`.
    // subscribeCollections() calls CollectionService.initialize(), which is
    // what runs the 4.x → 5.0 palette migration, and fires immediately with
    // the current records — so this both triggers and receives the migration.
    this.collectionsUnsubscribe = CollectionService.subscribeCollections((collections) => {
      this.localPalettes = collections.filter((c) => c.kind === 'palette');
    });

    await hybridPresetService.initialize();
    await this.loadPresets();

    if (this.isAuthenticated) {
      await this.loadUserSubmissions();
    }

    await this.handleDeepLink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('popstate', this.handleWindowPopState);
    this.configUnsubscribe?.();
    this.configUnsubscribe = null;
    this.authUnsubscribe?.();
    this.authUnsubscribe = null;
    this.savedUnsubscribe?.();
    this.savedUnsubscribe = null;
    this.collectionsUnsubscribe?.();
    this.collectionsUnsubscribe = null;
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    // BUG-027: an in-flight search debounce must not fire loadPresets() into
    // a detached element.
    clearTimeout(this._searchDebounce);
  }

  /**
   * BUG-005 review round 1: `history.state` on the entry a Back/Forward just
   * made current is NOT reliably `{ toolId: 'presets', preset?: id }`.
   * `handlePresetSelect` pushes that shape, but the ORIGINAL `/presets` entry
   * (a cold load or refresh) is never `replaceState`'d by
   * `router-service.ts`'s `handleInitialRoute` for a valid path, so its state
   * is `null`; `handleBack`/the edit- and delete-success paths push `{}`; the
   * OAuth return round-trip (`auth-service.ts`) may leave other shapes too.
   * Trusting `event.state.toolId` to decide "is this ours" therefore missed
   * exactly the plain Back-to-list case the fix was for.
   *
   * Source of truth is the URL instead, via the same two `RouterService`
   * reads `handleDeepLink` uses: `getCurrentToolId()` to decide whether this
   * popstate is even about the presets tool (by the time this listener runs,
   * `RouterService`'s own — earlier-registered — popstate handler has already
   * resolved it, whether from `state.toolId` or its own URL fallback), and
   * `getSubPath()` for the id when `state.preset` isn't present. `state`
   * still wins when it IS present (the pushState/popstate round trip is
   * cheaper than reparsing the URL and unambiguous when available).
   */
  private handleWindowPopState = (event: PopStateEvent): void => {
    if (RouterService.getCurrentToolId() !== 'presets') return;

    const state = event.state as { preset?: string } | null;
    const presetId = state?.preset || RouterService.getSubPath();
    const seq = ++this._restoreSeq;

    if (presetId) {
      void this.restoreSelectedPresetFromHistory(presetId, seq);
    } else {
      this.selectedPreset = null;
    }
  };

  /**
   * Resolve a preset id from history state back to a `UnifiedPreset`, using
   * the same sources `handleDeepLink` does (local palette store → loaded
   * pool → saved snapshots → the API as a last resort).
   *
   * `seq` is `handleWindowPopState`'s value of `_restoreSeq` at the moment
   * THIS call was made. Only the API-fallback branch awaits anything, so it
   * is the only branch a newer popstate can race: if `_restoreSeq` has moved
   * on by the time the await resolves, a later navigation has already run
   * (Back-Forward-Back over a preset outside the loaded pool, for example)
   * and this result is stale — drop it rather than clobber whatever that
   * newer navigation set.
   *
   * Not-found behavior matches `handleDeepLink`: warn and leave the current
   * view alone, rather than closing an open detail under a `/presets/:id`
   * URL just because this particular lookup came up empty.
   */
  private async restoreSelectedPresetFromHistory(presetId: string, seq: number): Promise<void> {
    if (presetId.startsWith('local-')) {
      const local = this.localPalettes.find((c) => `local-${c.id}` === presetId);
      if (local) {
        this.selectedPreset = this.localPaletteToUnified(local);
      } else {
        logger.warn('[v4-preset-tool] Local palette not found for history restore:', presetId);
      }
      return;
    }

    const fromPool = this.presets.find((p) => p.id === presetId);
    if (fromPool) {
      this.selectedPreset = fromPool;
      return;
    }

    const savedMatch = this.savedList.find((s) => s.id === presetId);
    if (savedMatch) {
      this.selectedPreset = this.savedToUnified(savedMatch);
      return;
    }

    try {
      const preset = await hybridPresetService.getPreset(presetId);
      if (seq !== this._restoreSeq) return; // superseded by a newer popstate
      if (preset) {
        this.selectedPreset = preset;
      } else {
        logger.warn('[v4-preset-tool] Preset not found for history restore:', presetId);
      }
    } catch (error) {
      if (seq !== this._restoreSeq) return; // superseded by a newer popstate
      logger.error('[v4-preset-tool] Failed to restore preset from history:', error);
    }
  }

  private async handleDeepLink(): Promise<void> {
    const presetId = RouterService.getSubPath();
    if (!presetId) return;

    logger.info('[v4-preset-tool] Deep link detected:', presetId);

    // Local palettes never reach the API — resolve them from the local store
    // instead, or a reload on /presets/local-… would 'not find' a record that
    // is sitting in this browser.
    if (presetId.startsWith('local-')) {
      const local = this.localPalettes.find((c) => `local-${c.id}` === presetId);
      if (local) {
        this.selectedPreset = this.localPaletteToUnified(local);
        this.tab = 'saved';
      } else {
        logger.warn('[v4-preset-tool] Local palette not found for deep link:', presetId);
      }
      return;
    }

    const seq = ++this._restoreSeq;
    try {
      const preset = await hybridPresetService.getPreset(presetId);
      if (seq !== this._restoreSeq) return; // superseded by a newer popstate
      if (preset) {
        this.selectedPreset = preset;
      } else {
        logger.warn('[v4-preset-tool] Preset not found for deep link:', presetId);
      }
    } catch (error) {
      if (seq !== this._restoreSeq) return; // superseded by a newer popstate
      logger.error('[v4-preset-tool] Failed to load deep-linked preset:', error);
    }
  }

  /**
   * Load the merged pool. Tab slicing happens at render time from ONE list —
   * sourcing tabs separately is the double-render/search-escape defect the
   * design doc calls out.
   */
  private async loadPresets(): Promise<void> {
    // BUG-029 (2026-10-04 deep-dive): with no supersede guard, a slow answer
    // for an older search could land last — on screen under the new search,
    // and into reconciliation, which then read the CURRENT (cleared) query
    // rather than the one fetched. Capture both, drop a superseded answer.
    const seq = ++this._loadSeq;
    const query = this.searchQuery;
    const sort = this.config.sortBy;
    this.poolQuery = query;
    this.poolSort = sort;
    this.isLoading = true;
    try {
      // The category is NOT passed down: the rail's counts are computed over
      // the unfiltered pool, so pre-filtering here made every other chip read
      // 0 and "All" equal the current category. Category slicing happens at
      // render time, like the tab slicing above it.
      const result = await hybridPresetService.getPresets({
        search: query || undefined,
        sort,
        limit: PRESET_PAGE_LIMIT,
      });
      if (seq !== this._loadSeq) return; // superseded by a newer load
      this.presets = result.presets;
      this.offline = !result.apiOk;
      this.reconcileTombstones(result, query);
    } catch (error) {
      if (seq !== this._loadSeq) return; // superseded by a newer load
      logger.error('[v4-preset-tool] Failed to load presets:', error);
      this.offline = true;
    } finally {
      if (seq === this._loadSeq) this.isLoading = false;
    }
  }

  /**
   * Detect saved community presets whose live copy is gone, and un-mark any
   * that came back. This is the writer behind the "Removed by its author"
   * chip and the Keep-deleted toggle — without it both were dead paths.
   *
   * A false tombstone is worse than a late one, so marking one needs proof of
   * absence — all three of:
   * - the community request answered (`apiOk`): an unreachable API, or one
   *   failed request, is not a deletion (BUG-029, 2026-10-04 deep-dive — a
   *   failed request was swallowed and read as "every preset is gone");
   * - it was unfiltered: a search would tombstone everything it didn't match;
   * - BUG-020: it returned less than a full page. presets-api caps `limit` at
   *   50 regardless of what we ask for, so a full page means "there may be
   *   more", and every saved community preset beyond it would look deleted.
   *
   * Each guard reads what was FETCHED — `fetchedQuery`, and the API ids from
   * before the merged list's sort-and-cut — never the current state.
   *
   * Un-marking needs only an answer: a preset the API returned exists,
   * whatever the query or page size. That is also what heals a false
   * tombstone once the collection outgrows one page.
   *
   * Local palettes (`local-…`) never reach the API, so they are never marked,
   * and a mark an earlier version left on one is cleared.
   */
  private reconcileTombstones(fetch: PresetPoolResult, fetchedQuery: string): void {
    const live = new Set(fetch.apiIds);
    const canTombstone = fetch.apiOk && !fetchedQuery && live.size < PRESET_PAGE_LIMIT;
    if (fetch.apiOk && !fetchedQuery && !canTombstone) {
      logger.info(
        '[v4-preset-tool] Not tombstoning: the page is full, so the pool may be incomplete'
      );
    }

    for (const saved of this.savedList) {
      // Curated palettes ship with the app — they can't be author-deleted
      if (saved.isCurated) continue;
      let gone: boolean;
      if (isLocalPaletteId(saved.id) || live.has(saved.id)) {
        gone = false;
      } else if (canTombstone) {
        gone = true;
      } else {
        continue; // absent from a pool that cannot prove a deletion
      }
      if (gone !== Boolean(saved.deletedByAuthor)) {
        SavedPresetsService.markDeleted(saved.id, gone);
        logger.info(
          `[v4-preset-tool] Saved preset ${saved.id} ${gone ? 'tombstoned' : 'restored'}`
        );
      }
    }
  }

  private async loadUserSubmissions(): Promise<void> {
    if (!this.isAuthenticated) {
      this.userSubmissions = [];
      return;
    }
    try {
      const response = await presetSubmissionService.getMySubmissions();
      this.userSubmissions = response.presets;
    } catch (error) {
      logger.warn('[v4-preset-tool] Failed to load user submissions:', error);
    }
  }

  private communityToUnified(preset: CommunityPreset): UnifiedPreset {
    return {
      id: `community-${preset.id}`,
      name: preset.name,
      description: preset.description,
      category: preset.category_id,
      secondaryCategories: preset.secondary_categories ?? [],
      dyes: preset.dyes,
      tags: preset.tags,
      author: preset.author_name || undefined,
      voteCount: preset.vote_count,
      isCurated: preset.is_curated,
      isFromAPI: true,
      apiPresetId: preset.id,
      createdAt: preset.created_at,
      // WEB-14: read-path re-check of the server allowlist (see example-link.ts)
      exampleLink: sanitizeExampleLink(preset.example_link),
      previewImageUrl: sanitizePreviewImageUrl(preset.preview_image_url),
    };
  }

  private savedToUnified(saved: SavedPreset): UnifiedPreset {
    // Prefer the live copy (fresher votes); fall back to the snapshot.
    const live = this.presets.find((p) => p.id === saved.id);
    if (live) return live;
    return {
      id: saved.id,
      name: saved.name,
      description: saved.description,
      category: saved.category,
      secondaryCategories: saved.secondaryCategories ?? [],
      dyes: saved.dyes,
      tags: saved.tags,
      author: saved.author,
      voteCount: 0,
      isCurated: saved.isCurated,
      isFromAPI: false,
      createdAt: saved.savedAt,
      // WEB-14: the snapshot lives in localStorage — same read-path guard
      exampleLink: sanitizeExampleLink(saved.exampleLink),
      previewImageUrl: null,
    };
  }

  /**
   * A local CollectionService palette as a gallery entry.
   *
   * `local-` prefixes the id so it can never collide with a community
   * (`community-…`) or curated id — the Saved shelf, voting and deep links all
   * key off that id. `isFromAPI: false` is what keeps the vote control off the
   * card: there is nothing on the server to vote on.
   */
  private localPaletteToUnified(collection: Collection): UnifiedPreset {
    return {
      id: `local-${collection.id}`,
      name: collection.name,
      description: collection.description ?? '',
      // Local palettes carry no category; 'aesthetics' is the general bucket.
      category: 'aesthetics',
      // Local palettes carry no categories beyond the general bucket.
      secondaryCategories: [],
      dyes: [...collection.dyes],
      tags: [],
      voteCount: 0,
      isCurated: false,
      isFromAPI: false,
      createdAt: collection.createdAt,
      exampleLink: null,
      previewImageUrl: null,
    };
  }

  /**
   * Search and sort a pool held in this browser (Saved, Mine). OPT-008
   * (2026-10-04 deep-dive): these tabs used to refetch the API pool on every
   * search and sort — a spinner and a request for a list they never show —
   * while their own lists ignored the sort, and Mine ignored the search too.
   */
  private searchAndSortLocally(pool: UnifiedPreset[]): UnifiedPreset[] {
    const q = this.searchQuery.toLowerCase();
    const found = q ? pool.filter((p) => matchesSearch(p, q)) : pool;
    return sortPresets(found, this.config.sortBy);
  }

  private presetToCardData(preset: UnifiedPreset): PresetCardData {
    const colors: string[] = [];
    for (const dyeId of preset.dyes.slice(0, 6)) {
      const dye = resolvePresetDye(dyeId);
      if (dye) colors.push(dye.hex);
    }
    return {
      preset,
      colors,
      exampleLink: preset.exampleLink ?? undefined,
      previewImageUrl: preset.previewImageUrl ?? null,
    };
  }

  /** A palette is buyable when none of its dyes are market-only (coffer). */
  private isBuyable(preset: UnifiedPreset): boolean {
    return preset.dyes.every((id) => {
      const dye = resolvePresetDye(id);
      return !dye || dye.consolidationType !== null;
    });
  }

  /** Saved shelf pins to the top of every tab when savedFirst is on. */
  private applySavedFirst(pool: UnifiedPreset[]): UnifiedPreset[] {
    if (!this.config.savedFirst) return pool;
    const savedIds = new Set(this.savedList.map((s) => s.id));
    const saved = pool.filter((p) => savedIds.has(p.id));
    return saved.length ? [...saved, ...pool.filter((p) => !savedIds.has(p.id))] : pool;
  }

  /**
   * Does this preset belong to `category`?
   *
   * Either slot counts. Rail counts therefore sum to MORE than the total —
   * inherent to multi-category, and the intended reading ("presets tagged
   * Zones"). Deduping them would make the number contradict the result list.
   */
  private matchesCategory(preset: UnifiedPreset, category: PresetCategoryFilter): boolean {
    if (category === 'all') return true;
    if (preset.category === category) return true;
    return preset.secondaryCategories.includes(category as PresetCategory);
  }

  /**
   * One tab's pool, sliced from the one loaded list (or, for Saved and Mine,
   * from what this browser holds), before the category cut — the rail's
   * counts need the pool uncut, so the category cut happens at render time
   * rather than in the service query.
   */
  private tabPool(tab: PresetTab): UnifiedPreset[] {
    switch (tab) {
      case 'official':
        return this.applySavedFirst(this.presets.filter((p) => p.isCurated));
      case 'saved': {
        // The user's own palettes sit alongside their saved ones — this is the
        // only tab that survives the presets worker being unreachable, which
        // is exactly where a purely local record belongs. A palette saved as
        // well (BUG-029: Save used to be offered on one) is listed once.
        const locals = this.localPalettes.map((c) => this.localPaletteToUnified(c));
        const localIds = new Set(locals.map((p) => p.id));
        const snapshots = this.savedList
          .filter((s) => !localIds.has(s.id))
          .filter((s) => this.config.keepDeleted || !s.deletedByAuthor)
          .map((s) => this.savedToUnified(s));
        return this.searchAndSortLocally([...snapshots, ...locals]);
      }
      case 'mine':
        return this.searchAndSortLocally(
          this.userSubmissions.map((p) => this.communityToUnified(p))
        );
      case 'community':
      default: {
        let pool = this.config.feedBlend ? this.presets : this.presets.filter((p) => !p.isCurated);
        if (this.config.feedHideUnbuyable) {
          pool = pool.filter((p) => this.isBuyable(p));
        }
        return this.applySavedFirst(pool);
      }
    }
  }

  /**
   * Every tab's pool, built once per render. BUG-109 (2026-10-04 deep-dive):
   * the tab badges and rail counts used to rebuild their own bases, which
   * skipped Blend, Hide unbuyable, Keep deleted, the Saved search and (in the
   * Saved badge) the local palettes, so a count could name more cards than
   * the list showed. Now every number is read off the same pools.
   */
  private tabPools(): Record<PresetTab, UnifiedPreset[]> {
    return {
      community: this.tabPool('community'),
      official: this.tabPool('official'),
      saved: this.tabPool('saved'),
      mine: this.tabPool('mine'),
    };
  }

  private categoryCount(tabPool: UnifiedPreset[], category: PresetCategoryFilter): number {
    if (category === 'all') return tabPool.length;
    return tabPool.filter((p) => this.matchesCategory(p, category)).length;
  }

  /** Community and Official show the fetched API pool; Saved and Mine do not. */
  private isApiTab(tab: PresetTab = this.tab): boolean {
    return tab === 'community' || tab === 'official';
  }

  // ============================================
  // Event handlers
  // ============================================

  private handleTabSelect(tab: PresetTab): void {
    this.tab = tab;
    this.selectedPreset = null;
    // OPT-008: the API pool follows the search and sort only on the tabs that
    // show it. A search debounce still pending is dropped here: on Saved or
    // Mine it would fetch for nothing, and on an API tab this load covers it.
    clearTimeout(this._searchDebounce);
    if (
      this.isApiTab(tab) &&
      (this.searchQuery !== this.poolQuery || this.config.sortBy !== this.poolSort)
    ) {
      void this.loadPresets();
    }
    if (tab === 'mine' && !this.isAuthenticated) {
      void import('../signin-modal').then(({ showSignInModal }) => showSignInModal());
    }
  }

  private handleCategorySelect(category: PresetCategoryFilter): void {
    this.configController?.setConfig('presets', { category });
  }

  private handleSortNext(): void {
    const next =
      SORT_ORDER[(SORT_ORDER.indexOf(this.config.sortBy) + 1) % SORT_ORDER.length] ?? 'popular';
    this.configController?.setConfig('presets', { sortBy: next });
  }

  private handlePresetSelect(e: CustomEvent<{ preset: UnifiedPreset }>): void {
    this.selectedPreset = e.detail.preset;
    const newUrl = `/presets/${this.selectedPreset.id}`;
    // BUG-005: carry `toolId` so a Back/Forward that lands on this entry (or
    // the list entry below it) resolves as the SAME tool in router-service's
    // handlePopState — that skips the shell-level notify, so the transition
    // stays inside this component (see handleWindowPopState) instead of
    // remounting <v4-preset-tool> and losing tab/search/scroll.
    window.history.pushState({ toolId: 'presets', preset: this.selectedPreset.id }, '', newUrl);
  }

  private handleCardSave(e: CustomEvent<{ preset: UnifiedPreset }>): void {
    SavedPresetsService.toggle(e.detail.preset);
  }

  private async handleCardVote(e: CustomEvent<{ preset: UnifiedPreset }>): Promise<void> {
    const preset = e.detail.preset;
    if (!preset.apiPresetId) return;

    if (!this.isAuthenticated) {
      const { showSignInModal } = await import('../signin-modal');
      showSignInModal();
      return;
    }

    const voted = this.votedIds.has(preset.id);
    try {
      if (voted) {
        const result = await communityPresetService.removeVote(preset.apiPresetId);
        if (result.success) {
          this.votedIds = new Set([...this.votedIds].filter((id) => id !== preset.id));
          this.applyVoteCount(preset.id, result.new_vote_count);
          ToastService.success(LanguageService.t('preset.voteRemoved'));
        } else {
          // BUG-030 (2026-10-04 deep-dive): this failure used to be silent.
          ToastService.error(voteErrorMessage(result.errorCode, 'errors.removeVoteFailed'));
        }
      } else {
        const result = await communityPresetService.voteForPreset(preset.apiPresetId);
        if (result.success) {
          this.votedIds = new Set([...this.votedIds, preset.id]);
          this.applyVoteCount(preset.id, result.new_vote_count);
          ToastService.success(LanguageService.t('preset.voteAdded'));
        } else if (result.already_voted) {
          // Cast in an earlier session: show it as cast.
          this.votedIds = new Set([...this.votedIds, preset.id]);
          ToastService.info(LanguageService.t('preset.alreadyVoted'));
        } else {
          // BUG-030 (2026-10-04 deep-dive): every failure used to land in the
          // branch above, so a 500 or a dropped connection marked the card
          // voted and said "already voted" with no vote recorded.
          ToastService.error(voteErrorMessage(result.errorCode, 'errors.voteFailed'));
        }
      }
    } catch (error) {
      logger.error('[v4-preset-tool] Vote failed:', error);
      ToastService.error(LanguageService.t('errors.voteFailed'));
    }
  }

  private applyVoteCount(presetId: string, voteCount: number): void {
    this.presets = this.presets.map((p) => (p.id === presetId ? { ...p, voteCount } : p));
  }

  private handleBack(): void {
    this.selectedPreset = null;
    // BUG-005 review: carry toolId for consistency with handlePresetSelect —
    // resolution no longer strictly depends on it (handleWindowPopState reads
    // the URL now), but router-service.ts's own same-tool check still prefers
    // state.toolId over its URL-parse fallback when it's present.
    window.history.pushState({ toolId: 'presets' }, '', '/presets');
  }

  private handleVoteUpdate(e: CustomEvent<VoteUpdateDetail>): void {
    const { preset: updatedPreset, voted } = e.detail;
    this.presets = this.presets.map((p) => (p.id === updatedPreset.id ? updatedPreset : p));
    // BUG-110 (2026-10-04 deep-dive): without this the card kept its own
    // voted state — a vote removed in the detail still read "Voted" on the
    // card, and clicking it removed a vote that no longer existed.
    const votedIds = new Set(this.votedIds);
    if (voted) {
      votedIds.add(updatedPreset.id);
    } else {
      votedIds.delete(updatedPreset.id);
    }
    this.votedIds = votedIds;
    if (this.selectedPreset?.id === updatedPreset.id) {
      this.selectedPreset = updatedPreset;
    }
  }

  private async handleEditPreset(e: CustomEvent<{ preset: UnifiedPreset }>): Promise<void> {
    const preset = e.detail.preset;
    if (!preset.apiPresetId) {
      logger.warn('[v4-preset-tool] Cannot edit preset without API ID');
      return;
    }
    const communityPreset = this.userSubmissions.find((p) => p.id === preset.apiPresetId);
    if (!communityPreset) {
      logger.warn('[v4-preset-tool] Cannot find original community preset for editing');
      return;
    }
    const { showPresetEditForm } = await import('../preset-edit-form');
    showPresetEditForm(communityPreset, (result) => {
      if (result.success) {
        void this.loadPresets();
        this.selectedPreset = null;
        window.history.pushState({ toolId: 'presets' }, '', '/presets');
      }
    });
  }

  private async handleDeletePreset(e: CustomEvent<{ preset: UnifiedPreset }>): Promise<void> {
    const preset = e.detail?.preset;
    if (!preset) {
      ToastService.error(LanguageService.t('errors.presetDataMissing'));
      return;
    }
    if (!preset.apiPresetId) {
      ToastService.error(LanguageService.t('errors.presetNoApiId'));
      return;
    }

    const confirmEl = document.createElement('p');
    confirmEl.textContent = LanguageService.t('preset.confirmDelete');

    // Destructive convention: outlined narrow Delete, solid wide Cancel.
    ModalService.showConfirm({
      title: LanguageService.t('preset.deleteTitle'),
      content: confirmEl,
      destructive: true,
      confirmText: LanguageService.t('common.delete'),
      cancelText: LanguageService.t('common.cancel'),
      onConfirm: async () => {
        ToastService.info(LanguageService.t('preset.deleting'));
        // BUG-032 (2026-10-04 deep-dive): deletePreset answers a failure
        // ({ success: false }) rather than throwing it, so this used to toast
        // "deleted" and leave for a list that still held the preset.
        const result = await presetSubmissionService.deletePreset(preset.apiPresetId!);
        if (!result.success) {
          logger.error('[v4-preset-tool] Failed to delete preset:', result.error);
          ToastService.error(LanguageService.t('errors.deletePresetFailed'));
          return;
        }
        ToastService.success(LanguageService.t('preset.deleteSuccess'));
        void this.loadPresets();
        void this.loadUserSubmissions();
        this.selectedPreset = null;
        window.history.pushState({ toolId: 'presets' }, '', '/presets');
      },
      onClose: () => {},
    });
  }

  private handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    clearTimeout(this._searchDebounce);
    // OPT-008: Saved and Mine filter locally; `handleTabSelect` catches the
    // API pool up when an API tab is chosen.
    if (!this.isApiTab()) return;
    this._searchDebounce = window.setTimeout(() => {
      void this.loadPresets();
    }, 300);
  }

  // ============================================
  // Render
  // ============================================

  private categoryLabel(category: PresetCategoryFilter): string {
    return presetCategoryLabel(category);
  }

  private renderTabs(pools: Record<PresetTab, UnifiedPreset[]>): TemplateResult {
    const tabs: Array<{ id: PresetTab; label: string; count: string }> = [
      {
        id: 'community',
        label: LanguageService.t('preset.tabCommunity'),
        count: this.offline ? '—' : String(pools.community.length),
      },
      {
        id: 'official',
        label: LanguageService.t('preset.tabOfficial'),
        count: String(pools.official.length),
      },
      {
        id: 'saved',
        label: LanguageService.t('preset.tabSaved'),
        count: String(pools.saved.length),
      },
      {
        id: 'mine',
        label: LanguageService.t('preset.tabMine'),
        count: this.isAuthenticated ? String(pools.mine.length) : '—',
      },
    ];
    return html`
      <div class="tab-row">
        ${tabs.map(
          (t) => html`
            <button
              class="tab-btn ${this.tab === t.id ? 'tab-btn--on' : ''}"
              @click=${() => this.handleTabSelect(t.id)}
            >
              ${t.label} <span class="tab-count">${t.count}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  private renderFilters(pool: UnifiedPreset[], tabPool: UnifiedPreset[]): TemplateResult {
    const sortKeys: Record<string, string> = {
      popular: 'preset.sort.popular',
      recent: 'preset.sort.recent',
      name: 'preset.sort.name',
    };
    return html`
      <div class="filter-row">
        <input
          type="text"
          class="search-input"
          placeholder="${LanguageService.t('preset.searchAll')}"
          .value=${this.searchQuery}
          @input=${this.handleSearchInput}
        />
        <button class="sort-btn" @click=${this.handleSortNext}>
          ${LanguageService.t(sortKeys[this.config.sortBy] ?? 'preset.sort.popular')}
        </button>
        ${
          this.tab === 'mine' && this.isAuthenticated
            ? html`<button
                class="sort-btn"
                @click=${() => {
                  void import('../my-submissions-modal').then(({ showMySubmissionsModal }) =>
                    showMySubmissionsModal(() => {
                      void this.loadPresets();
                      void this.loadUserSubmissions();
                    })
                  );
                }}
              >
                ${LanguageService.t('preset.mySubmissions')}
              </button>`
            : nothing
        }
        <span class="results-count"
          >${LanguageService.tInterpolate(
            pool.length === 1 ? 'preset.resultsCountOne' : 'preset.resultsCount',
            { n: pool.length }
          )}</span
        >
      </div>
      <div class="cat-row">
        ${CATEGORY_ORDER.map(
          (cat) => html`
            <button
              class="cat-btn ${this.config.category === cat ? 'cat-btn--on' : ''}"
              @click=${() => this.handleCategorySelect(cat)}
            >
              ${this.categoryLabel(cat)}
              <span class="cat-count">${this.categoryCount(tabPool, cat)}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  private renderOfflineStrip(): TemplateResult {
    const curatedCount = this.presets.filter((p) => p.isCurated).length;
    return html`
      <div class="offline-strip">
        <span class="offline-head">${LanguageService.t('preset.offline')}</span>
        <span class="offline-sub"
          >${LanguageService.tInterpolate('preset.offlineSub', { n: curatedCount })}</span
        >
      </div>
    `;
  }

  private renderEmpty(): TemplateResult {
    if (this.tab === 'mine' && !this.isAuthenticated) {
      return html`
        <div class="empty-container">
          <p class="empty-message">${LanguageService.t('preset.signInToViewSubmissions')}</p>
        </div>
      `;
    }
    if (this.tab === 'mine') {
      return html`
        <div class="empty-container">
          <p class="empty-message">${LanguageService.t('preset.noSubmissionsYet')}</p>
        </div>
      `;
    }
    return html`
      <div class="empty-container">
        <span class="empty-glyph" aria-hidden="true"
          >${unsafeHTML(this.searchQuery ? ICON_STATE_SEARCH : ICON_STATE_PRESETS_EMPTY)}</span
        >
        <p class="empty-message">
          ${
            this.searchQuery
              ? LanguageService.t('preset.noPresets')
              : LanguageService.t('preset.tryDifferentFilters')
          }
        </p>
      </div>
    `;
  }

  private renderGrid(pool: UnifiedPreset[]): TemplateResult {
    // OPT-008: Saved and Mine are held in this browser; an API load in flight
    // (a sort, an edit's reload) has nothing to show them.
    if (this.isLoading && this.isApiTab()) {
      return html`
        <div class="loading-container">
          <div class="spinner"></div>
          <span class="loading-text">${LanguageService.t('preset.loading')}</span>
        </div>
      `;
    }
    if (pool.length === 0) {
      return this.renderEmpty();
    }
    return html`
      <div class="preset-grid">
        ${pool.map((preset) => {
          const cardData = this.presetToCardData(preset);
          const savedEntry = this.savedList.find((s) => s.id === preset.id);
          return html`
            <v4-preset-card
              .data=${cardData}
              .saved=${!!savedEntry}
              .voted=${this.votedIds.has(preset.id)}
              .showShot=${this.config.feedShots}
              .tombstone=${
                // A local palette can't be removed by an author (BUG-029)
                this.tab === 'saved' &&
                !!savedEntry?.deletedByAuthor &&
                !isLocalPaletteId(preset.id)
              }
              @preset-select=${this.handlePresetSelect}
              @preset-vote=${this.handleCardVote}
              @preset-save=${this.handleCardSave}
            ></v4-preset-card>
          `;
        })}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    if (this.selectedPreset) {
      const isOwnPreset =
        this.isAuthenticated &&
        this.selectedPreset.apiPresetId !== undefined &&
        this.userSubmissions.some((p) => p.id === this.selectedPreset?.apiPresetId);

      return html`
        <v4-preset-detail
          .preset=${this.selectedPreset}
          .isOwnPreset=${isOwnPreset}
          @back=${this.handleBack}
          @vote-update=${this.handleVoteUpdate}
          @edit-preset=${this.handleEditPreset}
          @delete-preset=${this.handleDeletePreset}
        ></v4-preset-detail>
      `;
    }

    const pools = this.tabPools();
    const tabPool = pools[this.tab];
    const category = this.config.category;
    const pool =
      category === 'all' ? tabPool : tabPool.filter((p) => this.matchesCategory(p, category));

    return html`
      <div class="preset-tool">
        ${this.renderTabs(pools)} ${this.renderFilters(pool, tabPool)}
        ${this.tab === 'community' && this.offline ? this.renderOfflineStrip() : nothing}
        ${this.renderGrid(pool)}
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-preset-tool': PresetTool;
  }
}
