/**
 * XIV Dye Tools v4.0 - Preset Tool Component
 *
 * Main orchestrator for the Community Presets feature.
 * Displays a grid of preset cards and handles detail view navigation.
 *
 * Features:
 * - Subscribes to ConfigController for reactive config changes
 * - Loads presets via HybridPresetService
 * - Renders v4-preset-card grid
 * - Shows v4-preset-detail on selection
 * - Handles deep linking for shareable URLs
 *
 * @module components/v4/preset-tool
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { ConfigController } from '@services/config-controller';
import { hybridPresetService } from '@services/hybrid-preset-service';
import { dyeService, LanguageService, authService, presetSubmissionService, ToastService, ModalService } from '@services/index';
import { RouterService } from '@services/router-service';
import { logger } from '@shared/logger';
import type { UnifiedPreset } from '@services/hybrid-preset-service';
import type { CommunityPreset } from '@services/community-preset-service';
import type { PresetsConfig, PresetCategoryFilter, PresetSortOption } from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import type { PresetCategory } from '@xivdyetools/core';
import { ICON_LOCKED, ICON_DOCUMENT, ICON_WARNING } from '@shared/ui-icons';
import { ICON_EMPTY_INBOX } from '@shared/empty-state-icons';

// Import child components
import './preset-card';
import './preset-detail';
import type { PresetCardData } from './preset-card';

/**
 * V4 Preset Tool - Community Presets browser
 *
 * @example
 * ```html
 * <v4-preset-tool></v4-preset-tool>
 * ```
 */
@customElement('v4-preset-tool')
export class PresetTool extends BaseLitComponent {
  /**
   * All loaded presets
   */
  @state()
  private presets: UnifiedPreset[] = [];

  /**
   * Currently selected preset for detail view
   */
  @state()
  private selectedPreset: UnifiedPreset | null = null;

  /**
   * Loading state
   */
  @state()
  private isLoading: boolean = true;

  /**
   * Error message if loading fails (empty string = no error)
   */
  @state()
  private _presetError: string = '';

  /**
   * Current config from ConfigController
   */
  @state()
  private config: PresetsConfig = {
    showMyPresetsOnly: false,
    showFavorites: false,
    sortBy: 'popular',
    category: 'all',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };

  /**
   * Search query for filtering presets
   */
  @state()
  private searchQuery: string = '';

  /**
   * User's own submissions (when showMyPresetsOnly is enabled)
   */
  @state()
  private userSubmissions: CommunityPreset[] = [];

  /**
   * Whether user is authenticated
   */
  @state()
  private isAuthenticated: boolean = false;

  private configController: ConfigController | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;

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
      }

      /* Header */
      .tool-header {
        margin-bottom: 24px;
      }

      .tool-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text, #e0e0e0);
        margin: 0 0 8px 0;
      }

      .tool-description {
        color: var(--theme-text-muted, #888888);
        font-size: 14px;
        margin: 0;
      }

      /* Search bar */
      .search-bar {
        margin-bottom: 24px;
      }

      .search-input {
        width: 100%;
        max-width: 400px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        color: var(--theme-text, #e0e0e0);
        font-size: 14px;
        transition: border-color var(--v4-transition-fast, 150ms);
      }

      .search-input::placeholder {
        color: var(--theme-text-muted, #888888);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--theme-primary, #d4af37);
      }

      /* Results info */
      .results-info {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
        font-size: 14px;
        color: var(--theme-text-muted, #888888);
      }

      .results-count {
        font-weight: 600;
      }

      .category-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        font-size: 12px;
      }

      /* Preset grid */
      .preset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
      }

      /* Loading state */
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: 16px;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-top-color: var(--theme-primary, #d4af37);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .loading-text {
        color: var(--theme-text-muted, #888888);
        font-size: 14px;
      }

      /* Error state */
      .error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: 16px;
        text-align: center;
      }

      .error-icon {
        font-size: 48px;
      }

      .error-message {
        color: var(--theme-error, #ef4444);
        font-size: 14px;
        max-width: 400px;
      }

      .retry-btn {
        padding: 10px 20px;
        background: var(--theme-primary, #d4af37);
        color: var(--theme-background, #1a1a1a);
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity var(--v4-transition-fast, 150ms);
      }

      .retry-btn:hover {
        opacity: 0.9;
      }

      /* Empty state */
      .empty-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: 16px;
        text-align: center;
      }

      .empty-icon {
        font-size: 48px;
        opacity: 0.5;
      }

      .empty-message {
        color: var(--theme-text-muted, #888888);
        font-size: 14px;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
        .search-input {
          transition: none;
        }
      }

      /* Responsive */
      @media (max-width: 768px) {
        .preset-tool {
          padding: 16px;
        }

        .tool-title {
          font-size: 20px;
        }

        .preset-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Subscribe to config changes
    this.configController = ConfigController.getInstance();
    this.config = this.configController.getConfig('presets');
    this.configUnsubscribe = this.configController.subscribe('presets', (newConfig) => {
      this.config = newConfig;
      void this.loadPresets();
    });

    // Subscribe to auth changes
    this.isAuthenticated = authService.isAuthenticated();
    this.authUnsubscribe = authService.subscribe((state) => {
      const wasAuthenticated = this.isAuthenticated;
      this.isAuthenticated = state.isAuthenticated;

      // Reload presets when auth state changes (e.g., to load user submissions)
      if (this.config.showMyPresetsOnly) {
        void this.loadPresets();
      }

      // Load user submissions when logging in (for ownership check)
      if (!wasAuthenticated && this.isAuthenticated) {
        void this.loadUserSubmissions();
      } else if (!this.isAuthenticated) {
        // Clear user submissions on logout
        this.userSubmissions = [];
      }
    });

    // Initialize service and load presets
    await hybridPresetService.initialize();
    await this.loadPresets();

    // Load user submissions if authenticated (for ownership check)
    if (this.isAuthenticated) {
      await this.loadUserSubmissions();
    }

    // Handle deep links (e.g., /presets/community-xxx)
    await this.handleDeepLink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.configUnsubscribe) {
      this.configUnsubscribe();
      this.configUnsubscribe = null;
    }
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
  }

  /**
   * Handle deep link navigation
   * If URL has a preset ID (e.g., /presets/community-xxx), load that preset
   */
  private async handleDeepLink(): Promise<void> {
    const presetId = RouterService.getSubPath();
    if (!presetId) return;

    logger.info('[v4-preset-tool] Deep link detected:', presetId);

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
   * Load presets based on current config
   */
  private async loadPresets(): Promise<void> {
    this.isLoading = true;
    this._presetError = '';

    try {
      // If showMyPresetsOnly is enabled, load user's submissions
      if (this.config.showMyPresetsOnly) {
        if (!this.isAuthenticated) {
          // User must be logged in to see their presets
          this.presets = [];
          this.userSubmissions = [];
          this._presetError = '';
          logger.info('[v4-preset-tool] showMyPresetsOnly enabled but not authenticated');
          return;
        }

        // Load user's submissions
        const response = await presetSubmissionService.getMySubmissions();
        this.userSubmissions = response.presets;
        // Convert to UnifiedPreset format
        this.presets = this.userSubmissions.map((p) => this.communityToUnified(p));
        logger.info('[v4-preset-tool] Loaded', this.presets.length, 'user submissions');
        return;
      }

      // Map config category to API category
      const category: PresetCategory | undefined =
        this.config.category === 'all' ? undefined : (this.config.category as PresetCategory);

      // Map config sort to API sort
      const sort: 'popular' | 'recent' | 'name' = this.config.sortBy as PresetSortOption;

      const presets = await hybridPresetService.getPresets({
        category,
        search: this.searchQuery || undefined,
        sort,
        limit: 50,
      });

      this.presets = presets;
      logger.info('[v4-preset-tool] Loaded', presets.length, 'presets');
    } catch (error) {
      logger.error('[v4-preset-tool] Failed to load presets:', error);
      this._presetError = 'Failed to load presets. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load user submissions for ownership checking
   * This is called separately from loadPresets to keep track of user's presets
   * regardless of the current filter/view mode
   */
  private async loadUserSubmissions(): Promise<void> {
    if (!this.isAuthenticated) {
      this.userSubmissions = [];
      return;
    }

    try {
      const response = await presetSubmissionService.getMySubmissions();
      this.userSubmissions = response.presets;
      logger.info('[v4-preset-tool] Loaded', this.userSubmissions.length, 'user submissions for ownership check');
    } catch (error) {
      logger.warn('[v4-preset-tool] Failed to load user submissions:', error);
      // Don't clear existing - could be transient error
    }
  }

  /**
   * Convert CommunityPreset to UnifiedPreset
   */
  private communityToUnified(preset: CommunityPreset): UnifiedPreset {
    return {
      id: `community-${preset.id}`,
      name: preset.name,
      description: preset.description,
      category: preset.category_id,
      dyes: preset.dyes,
      tags: preset.tags,
      author: preset.author_name || undefined,
      voteCount: preset.vote_count,
      isCurated: preset.is_curated,
      isFromAPI: true,
      apiPresetId: preset.id,
      createdAt: preset.created_at,
    };
  }

  /**
   * Convert a preset to card data with resolved colors
   */
  private presetToCardData(preset: UnifiedPreset): PresetCardData {
    const colors: string[] = [];
    for (const dyeId of preset.dyes.slice(0, 6)) {
      const dye = dyeService.getDyeById(dyeId);
      if (dye) {
        colors.push(dye.hex);
      }
    }
    return { preset, colors };
  }

  /**
   * Handle preset card selection
   */
  private handlePresetSelect(e: CustomEvent<{ preset: UnifiedPreset }>): void {
    this.selectedPreset = e.detail.preset;
    // Update URL for deep linking using history API directly
    const newUrl = `/presets/${this.selectedPreset.id}`;
    window.history.pushState({ preset: this.selectedPreset.id }, '', newUrl);
  }

  /**
   * Handle back from detail view
   */
  private handleBack(): void {
    this.selectedPreset = null;
    // Reset URL to just /presets
    window.history.pushState({}, '', '/presets');
  }

  /**
   * Handle vote update from detail view
   */
  private handleVoteUpdate(e: CustomEvent<{ preset: UnifiedPreset }>): void {
    const updatedPreset = e.detail.preset;
    // Update the preset in the list
    this.presets = this.presets.map((p) =>
      p.id === updatedPreset.id ? updatedPreset : p
    );
    // Update selected preset if it's the one being viewed
    if (this.selectedPreset?.id === updatedPreset.id) {
      this.selectedPreset = updatedPreset;
    }
  }

  /**
   * Handle edit preset from detail view
   */
  private async handleEditPreset(e: CustomEvent<{ preset: UnifiedPreset }>): Promise<void> {
    const preset = e.detail.preset;
    if (!preset.apiPresetId) {
      logger.warn('[v4-preset-tool] Cannot edit preset without API ID');
      return;
    }

    // Find the original CommunityPreset from userSubmissions
    const communityPreset = this.userSubmissions.find((p) => p.id === preset.apiPresetId);
    if (!communityPreset) {
      logger.warn('[v4-preset-tool] Cannot find original community preset for editing');
      return;
    }

    // Import and show the edit form dynamically
    const { showPresetEditForm } = await import('../preset-edit-form');
    showPresetEditForm(communityPreset, (result) => {
      if (result.success) {
        logger.info('[v4-preset-tool] Preset updated successfully');
        // Refresh the lists
        void this.loadPresets();
        // Go back to the list view
        this.selectedPreset = null;
        window.history.pushState({}, '', '/presets');
      }
    });
  }

  /**
   * Handle delete preset from detail view
   */
  private async handleDeletePreset(e: CustomEvent<{ preset: UnifiedPreset }>): Promise<void> {
    logger.info('[v4-preset-tool] handleDeletePreset called');

    const preset = e.detail?.preset;
    if (!preset) {
      logger.warn('[v4-preset-tool] Delete event received but no preset in detail');
      ToastService.error(LanguageService.t('errors.presetDataMissing'));
      return;
    }

    if (!preset.apiPresetId) {
      logger.warn('[v4-preset-tool] Cannot delete preset without API ID');
      ToastService.error(LanguageService.t('errors.presetNoApiId'));
      return;
    }

    // Show confirmation modal
    const confirmMessage = LanguageService.t('preset.confirmDelete');

    // Use ModalService for a custom confirmation dialog
    ModalService.showConfirm({
      title: LanguageService.t('preset.deleteTitle'),
      content: confirmMessage,
      confirmText: LanguageService.t('common.delete'),
      cancelText: LanguageService.t('common.cancel'),
      onConfirm: async () => {
        try {
          ToastService.info(LanguageService.t('preset.deleting'));
          await presetSubmissionService.deletePreset(preset.apiPresetId!);
          logger.info('[v4-preset-tool] Preset deleted successfully');
          ToastService.success(LanguageService.t('preset.deleteSuccess'));

          // Refresh the lists
          void this.loadPresets();
          void this.loadUserSubmissions();
          // Go back to the list view
          this.selectedPreset = null;
          window.history.pushState({}, '', '/presets');
        } catch (error) {
          logger.error('[v4-preset-tool] Failed to delete preset:', error);
          ToastService.error(LanguageService.t('errors.deletePresetFailed'));
        }
      },
      onClose: () => {
        logger.info('[v4-preset-tool] User cancelled delete');
      },
    });
  }

  /**
   * Handle search input
   */
  private handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    // Debounce search
    clearTimeout(this._searchDebounce);
    this._searchDebounce = window.setTimeout(() => {
      void this.loadPresets();
    }, 300);
  }

  private _searchDebounce: number = 0;

  /**
   * Handle retry button click
   */
  private handleRetry(): void {
    void this.loadPresets();
  }

  /**
   * Get display name for current category
   */
  private getCategoryDisplayName(): string {
    const categoryNames: Record<PresetCategoryFilter, string> = {
      all: 'All Categories',
      jobs: 'Jobs',
      'grand-companies': 'Grand Companies',
      seasons: 'Seasons',
      events: 'Events',
      aesthetics: 'Aesthetics',
      community: 'Community',
    };
    return categoryNames[this.config.category] || 'All';
  }

  /**
   * Render loading state
   */
  private renderLoading(): TemplateResult {
    return html`
      <div class="loading-container">
        <div class="spinner"></div>
        <span class="loading-text">Loading presets...</span>
      </div>
    `;
  }

  /**
   * Render error state
   */
  private renderError(): TemplateResult {
    return html`
      <div class="error-container">
        <span class="error-icon">${unsafeHTML(ICON_WARNING)}</span>
        <p class="error-message">${this._presetError}</p>
        <button class="retry-btn" @click=${this.handleRetry}>Try Again</button>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  private renderEmpty(): TemplateResult {
    // If showMyPresetsOnly is enabled but not authenticated
    if (this.config.showMyPresetsOnly && !this.isAuthenticated) {
      return html`
        <div class="empty-container">
          <span class="empty-icon">${unsafeHTML(ICON_LOCKED)}</span>
          <p class="empty-message">
            Please log in to view your submitted presets.
          </p>
        </div>
      `;
    }

    // If showMyPresetsOnly is enabled and authenticated but no submissions
    if (this.config.showMyPresetsOnly && this.isAuthenticated) {
      return html`
        <div class="empty-container">
          <span class="empty-icon">${unsafeHTML(ICON_DOCUMENT)}</span>
          <p class="empty-message">
            You haven't submitted any presets yet.
          </p>
        </div>
      `;
    }

    return html`
      <div class="empty-container">
        <span class="empty-icon">${unsafeHTML(ICON_EMPTY_INBOX)}</span>
        <p class="empty-message">
          ${this.searchQuery
        ? `No presets found matching "${this.searchQuery}"`
        : 'No presets found in this category'}
        </p>
      </div>
    `;
  }

  /**
   * Render preset grid
   */
  private renderGrid(): TemplateResult {
    if (this.isLoading) {
      return this.renderLoading();
    }

    if (this._presetError) {
      return this.renderError();
    }

    if (this.presets.length === 0) {
      return this.renderEmpty();
    }

    return html`
      <div class="results-info">
        <span class="results-count">${this.presets.length} preset${this.presets.length !== 1 ? 's' : ''}</span>
        ${this.config.category !== 'all'
        ? html`<span class="category-badge">${this.getCategoryDisplayName()}</span>`
        : nothing}
      </div>

      <div class="preset-grid">
        ${this.presets.map((preset) => {
          const cardData = this.presetToCardData(preset);
          return html`
            <v4-preset-card
              .data=${cardData}
              @preset-select=${this.handlePresetSelect}
            ></v4-preset-card>
          `;
        })}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    // If a preset is selected, show detail view
    if (this.selectedPreset) {
      // Determine if this is the user's own preset by checking if it exists in userSubmissions
      // This is more accurate than just checking the toggle, as the user could be viewing
      // a preset from the general list that happens to be theirs
      const isOwnPreset = this.isAuthenticated &&
        this.selectedPreset.apiPresetId !== undefined &&
        this.userSubmissions.some(p => p.id === this.selectedPreset?.apiPresetId);

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

    // Show grid view
    return html`
      <div class="preset-tool">
        <header class="tool-header">
          <h1 class="tool-title">${LanguageService.t('tools.presets.communityTitle')}</h1>
          <p class="tool-description">
            ${LanguageService.t('tools.presets.communityDescription')}
          </p>
        </header>

        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            placeholder="${LanguageService.t('tools.presets.searchPlaceholder')}"
            .value=${this.searchQuery}
            @input=${this.handleSearchInput}
          />
        </div>

        ${this.renderGrid()}
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
