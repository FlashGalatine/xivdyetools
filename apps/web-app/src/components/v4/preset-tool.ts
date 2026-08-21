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
import { hybridPresetService } from '@services/hybrid-preset-service';
import {
  resolvePresetDye,
  LanguageService,
  authService,
  presetSubmissionService,
  ToastService,
  ModalService,
} from '@services/index';
import { communityPresetService } from '@services/community-preset-service';
import { SavedPresetsService, type SavedPreset } from '@services/saved-presets-service';
import { CollectionService, type Collection } from '@services/collection-service';
import { RouterService } from '@services/router-service';
import { logger } from '@shared/logger';
import { presetCategoryLabel } from '@shared/preset-i18n';
import type { UnifiedPreset } from '@services/hybrid-preset-service';
import type { CommunityPreset } from '@services/community-preset-service';
import type { PresetsConfig, PresetCategoryFilter } from '@shared/tool-config-types';
import type { PresetCategory } from '@xivdyetools/types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';

// Import child components
import './preset-card';
import './preset-detail';
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

  /** The presets worker is not answering */
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
        font-family: 'Fragment Mono', monospace;
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
        font-family: 'Fragment Mono', monospace;
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

    this.configController = ConfigController.getInstance();
    this.config = this.configController.getConfig('presets');
    this.configUnsubscribe = this.configController.subscribe('presets', (newConfig) => {
      this.config = newConfig;
      void this.loadPresets();
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

    try {
      const preset = await hybridPresetService.getPreset(presetId);
      if (preset) {
        this.selectedPreset = preset;
      } else {
        logger.warn('[v4-preset-tool] Preset not found for deep link:', presetId);
      }
    } catch (error) {
      logger.error('[v4-preset-tool] Failed to load deep-linked preset:', error);
    }
  }

  /**
   * Load the merged pool. Tab slicing happens at render time from ONE list —
   * sourcing tabs separately is the double-render/search-escape defect the
   * design doc calls out.
   */
  private async loadPresets(): Promise<void> {
    this.isLoading = true;
    try {
      // The category is NOT passed down: the rail's counts are computed over
      // the unfiltered pool, so pre-filtering here made every other chip read
      // 0 and "All" equal the current category. Category slicing happens at
      // render time, like the tab slicing above it.
      this.presets = await hybridPresetService.getPresets({
        search: this.searchQuery || undefined,
        sort: this.config.sortBy,
        limit: 100,
      });
      this.offline = !hybridPresetService.isAPIAvailable();
      this.reconcileTombstones();
    } catch (error) {
      logger.error('[v4-preset-tool] Failed to load presets:', error);
      this.offline = true;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Detect saved community presets whose live copy is gone, and un-mark any
   * that came back. This is the writer behind the "Removed by its author"
   * chip and the Keep-deleted toggle — without it both were dead paths.
   *
   * Two guards, because a false tombstone is worse than a late one:
   * - never run while offline (an unreachable API is not a deletion),
   * - never run against a filtered pool (a search query would tombstone
   *   everything that didn't match).
   */
  private reconcileTombstones(): void {
    if (this.offline || this.searchQuery) return;

    const live = new Set(this.presets.filter((p) => p.isFromAPI).map((p) => p.id));
    for (const saved of this.savedList) {
      // Curated palettes ship with the app — they can't be author-deleted
      if (saved.isCurated) continue;
      const gone = !live.has(saved.id);
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
      exampleLink: preset.example_link ?? null,
      previewImageUrl: preset.preview_image_url ?? null,
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
      exampleLink: saved.exampleLink ?? null,
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

  /** Local palettes, newest first, filtered by the active search query. */
  private localPalettePool(): UnifiedPreset[] {
    const q = this.searchQuery.toLowerCase();
    const pool = this.localPalettes.map((c) => this.localPaletteToUnified(c));
    if (!q) return pool;
    return pool.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
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
   * The active tab's pool, sliced from the one loaded list and then by the
   * selected category (the rail's counts need the pool unfiltered, so the
   * category cut happens here rather than in the service query).
   */
  private currentPool(): UnifiedPreset[] {
    const pool = this.currentTabPool();
    if (this.config.category === 'all') return pool;
    return pool.filter((p) => this.matchesCategory(p, this.config.category));
  }

  private currentTabPool(): UnifiedPreset[] {
    switch (this.tab) {
      case 'official':
        return this.applySavedFirst(this.presets.filter((p) => p.isCurated));
      case 'saved': {
        const q = this.searchQuery.toLowerCase();
        let pool = this.savedList
          .filter((s) => this.config.keepDeleted || !s.deletedByAuthor)
          .map((s) => this.savedToUnified(s));
        if (q) {
          pool = pool.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.tags.some((t) => t.toLowerCase().includes(q))
          );
        }
        // The user's own palettes sit alongside their saved ones — this is the
        // only tab that survives the presets worker being unreachable, which
        // is exactly where a purely local record belongs.
        return [...pool, ...this.localPalettePool()];
      }
      case 'mine':
        return this.userSubmissions.map((p) => this.communityToUnified(p));
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

  private categoryCount(category: PresetCategoryFilter): number {
    const base =
      this.tab === 'official'
        ? this.presets.filter((p) => p.isCurated)
        : this.tab === 'saved'
          ? [...this.savedList.map((s) => this.savedToUnified(s)), ...this.localPalettePool()]
          : this.tab === 'mine'
            ? this.userSubmissions.map((p) => this.communityToUnified(p))
            : this.presets.filter((p) => !p.isCurated);
    if (category === 'all') return base.length;
    return base.filter((p) => this.matchesCategory(p, category)).length;
  }

  // ============================================
  // Event handlers
  // ============================================

  private handleTabSelect(tab: PresetTab): void {
    this.tab = tab;
    this.selectedPreset = null;
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
    window.history.pushState({ preset: this.selectedPreset.id }, '', newUrl);
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
        }
      } else {
        const result = await communityPresetService.voteForPreset(preset.apiPresetId);
        if (result.success) {
          this.votedIds = new Set([...this.votedIds, preset.id]);
          this.applyVoteCount(preset.id, result.new_vote_count);
          ToastService.success(LanguageService.t('preset.voteAdded'));
        } else {
          // Most common failure: already voted in an earlier session.
          this.votedIds = new Set([...this.votedIds, preset.id]);
          ToastService.info(LanguageService.t('preset.alreadyVoted'));
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
    window.history.pushState({}, '', '/presets');
  }

  private handleVoteUpdate(e: CustomEvent<{ preset: UnifiedPreset }>): void {
    const updatedPreset = e.detail.preset;
    this.presets = this.presets.map((p) => (p.id === updatedPreset.id ? updatedPreset : p));
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
        window.history.pushState({}, '', '/presets');
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
        try {
          ToastService.info(LanguageService.t('preset.deleting'));
          await presetSubmissionService.deletePreset(preset.apiPresetId!);
          ToastService.success(LanguageService.t('preset.deleteSuccess'));
          void this.loadPresets();
          void this.loadUserSubmissions();
          this.selectedPreset = null;
          window.history.pushState({}, '', '/presets');
        } catch (error) {
          logger.error('[v4-preset-tool] Failed to delete preset:', error);
          ToastService.error(LanguageService.t('errors.deletePresetFailed'));
        }
      },
      onClose: () => {},
    });
  }

  private handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    clearTimeout(this._searchDebounce);
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

  private renderTabs(): TemplateResult {
    const curatedCount = this.presets.filter((p) => p.isCurated).length;
    const communityCount = this.presets.filter((p) => !p.isCurated).length;
    const tabs: Array<{ id: PresetTab; label: string; count: string }> = [
      {
        id: 'community',
        label: LanguageService.t('preset.tabCommunity'),
        count: this.offline ? '—' : String(communityCount),
      },
      {
        id: 'official',
        label: LanguageService.t('preset.tabOfficial'),
        count: String(curatedCount),
      },
      {
        id: 'saved',
        label: LanguageService.t('preset.tabSaved'),
        count: String(this.savedList.length),
      },
      {
        id: 'mine',
        label: LanguageService.t('preset.tabMine'),
        count: this.isAuthenticated ? String(this.userSubmissions.length) : '—',
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

  private renderFilters(pool: UnifiedPreset[]): TemplateResult {
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
              <span class="cat-count">${this.categoryCount(cat)}</span>
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
    if (this.isLoading) {
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
              .tombstone=${this.tab === 'saved' && !!savedEntry?.deletedByAuthor}
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

    const pool = this.currentPool();

    return html`
      <div class="preset-tool">
        ${this.renderTabs()} ${this.renderFilters(pool)}
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
