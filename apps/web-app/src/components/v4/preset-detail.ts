/**
 * XIV Dye Tools v4.0 - Preset Detail Component
 *
 * Displays detailed information about a preset including:
 * - Header with badges, title, description, author
 * - Dye grid using v4-result-card components
 * - Tags section
 * - Action buttons (Share, Vote)
 * - Login CTA for unauthenticated users
 *
 * @module components/v4/preset-detail
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import {
  dyeService,
  authService,
  communityPresetService,
  ToastService,
  LanguageService,
} from '@services/index';
import { MarketBoardService } from '@services/market-board-service';
import type { PriceData } from '@shared/types';
import { ConfigController } from '@services/config-controller';
import type { DisplayOptionsConfig, MarketConfig } from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import { getCategoryIcon, ICON_ARROW_BACK } from '@shared/category-icons';
import { ICON_CRYSTAL, ICON_LINK } from '@shared/ui-icons';
import type { UnifiedPreset } from '@services/hybrid-preset-service';
import type { Dye } from '@shared/types';

// Import v4-result-card to ensure registration
import './result-card';

/**
 * V4 Preset Detail - Full preset view with dye cards
 *
 * @fires back - Emits when the back button is clicked
 * @fires vote-update - Emits when vote count changes
 *   - `detail.preset`: The updated preset
 * @fires edit-preset - Emits when the edit button is clicked
 *   - `detail.preset`: The preset to edit
 * @fires delete-preset - Emits when the delete button is clicked
 *   - `detail.preset`: The preset to delete
 *
 * @example
 * ```html
 * <v4-preset-detail
 *   .preset=${selectedPreset}
 *   .isOwnPreset=${true}
 *   @back=${() => this.closeDetail()}
 *   @vote-update=${(e) => this.handleVoteUpdate(e.detail.preset)}
 *   @edit-preset=${(e) => this.handleEdit(e.detail.preset)}
 *   @delete-preset=${(e) => this.handleDelete(e.detail.preset)}
 * ></v4-preset-detail>
 * ```
 */
@customElement('v4-preset-detail')
export class PresetDetail extends BaseLitComponent {
  /**
   * The preset to display
   */
  @property({ attribute: false })
  preset?: UnifiedPreset;

  /**
   * Whether this is the user's own preset (enables edit/delete)
   */
  @property({ type: Boolean, attribute: 'is-own-preset' })
  isOwnPreset: boolean = false;

  /**
   * Whether the current user has voted for this preset
   */
  @state()
  private hasVoted: boolean = false;

  /**
   * Whether a vote operation is in progress
   */
  @state()
  private isVoting: boolean = false;

  /**
   * Current vote count (may differ from preset.voteCount during optimistic updates)
   */
  @state()
  private currentVoteCount: number = 0;

  /**
   * Display options from config
   */
  @state()
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  /**
   * Market config from config
   */
  @state()
  private marketConfig: MarketConfig = { selectedServer: 'Crystal', showPrices: false };

  /**
   * Cached price data for preset dyes (itemID -> PriceData)
   */
  @state()
  private priceData: Map<number, PriceData> = new Map();

  /**
   * Whether prices are currently being fetched
   */
  @state()
  private isFetchingPrices: boolean = false;

  /**
   * Config controller instance
   */
  private configController: ConfigController | null = null;

  /**
   * MarketBoardService instance for price fetching
   */
  private marketBoardService: MarketBoardService | null = null;

  /**
   * Unsubscribe functions for config subscriptions
   */
  private configUnsubscribers: (() => void)[] = [];

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .preset-detail {
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        padding: 24px;
      }

      /* Back button */
      .back-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--theme-primary, #d4af37);
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 14px;
        padding: 0;
        margin-bottom: 16px;
        transition: opacity var(--v4-transition-fast, 150ms);
      }

      .back-button:hover {
        opacity: 0.8;
      }

      .back-button:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      .back-button svg {
        width: 16px;
        height: 16px;
      }

      /* Badges row */
      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
      }

      .badge svg {
        width: 14px;
        height: 14px;
      }

      .badge-category {
        background: rgba(255, 255, 255, 0.1);
        color: var(--theme-text, #e0e0e0);
      }

      .badge-community {
        background: rgba(139, 92, 246, 0.2);
        color: #a78bfa;
      }

      .badge-curated {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
      }

      .badge-votes {
        background: rgba(234, 179, 8, 0.2);
        color: #fbbf24;
      }

      /* Title & description */
      .preset-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text, #e0e0e0);
        margin: 0 0 8px 0;
        line-height: 1.2;
      }

      .preset-description {
        color: var(--theme-text-muted, #888888);
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 8px 0;
      }

      .preset-author {
        font-size: 14px;
        color: var(--theme-text-muted, #888888);
        margin-bottom: 24px;
      }

      /* Dyes section */
      .dyes-section {
        margin-bottom: 24px;
      }

      .section-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--theme-text-muted, #888888);
        margin-bottom: 16px;
      }

      .dyes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      }

      /* Tags section */
      .tags-section {
        margin-bottom: 24px;
      }

      .tags-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .tag {
        padding: 4px 12px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--theme-text-muted, #888888);
        font-size: 12px;
      }

      /* Actions */
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
      }

      .action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all var(--v4-transition-fast, 150ms);
      }

      .action-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      .share-btn {
        background: rgba(255, 255, 255, 0.1);
        color: var(--theme-text, #e0e0e0);
      }

      .share-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .vote-btn {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
      }

      .vote-btn:hover:not(:disabled) {
        background: rgba(99, 102, 241, 0.3);
      }

      .vote-btn.voted {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
      }

      .vote-btn.voted:hover:not(:disabled) {
        background: rgba(34, 197, 94, 0.3);
      }

      .vote-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .vote-btn svg {
        width: 18px;
        height: 18px;
      }

      /* Login CTA */
      .login-cta {
        margin-top: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        text-align: center;
        color: var(--theme-text-muted, #888888);
        font-size: 14px;
      }

      /* Edit/Delete buttons */
      .edit-btn {
        background: rgba(59, 130, 246, 0.2);
        color: #60a5fa;
      }

      .edit-btn:hover {
        background: rgba(59, 130, 246, 0.3);
      }

      .delete-btn {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
      }

      .delete-btn:hover {
        background: rgba(239, 68, 68, 0.3);
      }

      /* Loading state */
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        gap: 16px;
      }

      .spinner {
        width: 32px;
        height: 32px;
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

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .back-button,
        .action-btn {
          transition: none;
        }
        .spinner {
          animation: none;
        }
      }
    `,
  ];

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this.marketBoardService = MarketBoardService.getInstance();
    this.loadConfigAndSubscribe();
    await this.checkVoteStatus();
    // Fetch prices for preset dyes if prices are enabled
    await this.fetchPricesIfNeeded();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Cleanup config subscriptions
    this.configUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.configUnsubscribers = [];
  }

  /**
   * Load config from ConfigController and subscribe to changes
   */
  private loadConfigAndSubscribe(): void {
    this.configController = ConfigController.getInstance();

    // Load initial config values
    const globalConfig = this.configController.getConfig('global');
    this.displayOptions = globalConfig.displayOptions || { ...DEFAULT_DISPLAY_OPTIONS };
    this.marketConfig = this.configController.getConfig('market');

    // Subscribe to global display options changes
    const unsubGlobal = this.configController.subscribe('global', (config) => {
      this.displayOptions = config.displayOptions || { ...DEFAULT_DISPLAY_OPTIONS };
    });
    this.configUnsubscribers.push(unsubGlobal);

    // Subscribe to market config changes
    const unsubMarket = this.configController.subscribe('market', (config) => {
      const serverChanged = config.selectedServer !== this.marketConfig.selectedServer;
      const pricesToggled = config.showPrices !== this.marketConfig.showPrices;
      this.marketConfig = config;
      // Re-fetch prices if server changed or prices were enabled
      if (serverChanged || (pricesToggled && config.showPrices)) {
        void this.fetchPricesIfNeeded();
      }
    });
    this.configUnsubscribers.push(unsubMarket);

    // Subscribe to MarketBoardService price updates
    if (this.marketBoardService) {
      const handlePricesUpdated = (event: Event) => {
        const customEvent = event as CustomEvent<{ prices: Map<number, PriceData> }>;
        // Update our local price cache with the new prices
        for (const [itemId, priceInfo] of customEvent.detail.prices) {
          this.priceData.set(itemId, priceInfo);
        }
        // Trigger re-render with updated prices
        this.priceData = new Map(this.priceData);
      };
      this.marketBoardService.addEventListener('prices-updated', handlePricesUpdated);
      this.configUnsubscribers.push(() => {
        this.marketBoardService?.removeEventListener('prices-updated', handlePricesUpdated);
      });
    }
  }

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has('preset')) {
      this.currentVoteCount = this.preset?.voteCount ?? 0;
      void this.checkVoteStatus();
      // Clear old price data and fetch for new preset
      this.priceData.clear();
      void this.fetchPricesIfNeeded();
    }
  }

  /**
   * Check if the current user has voted for this preset
   */
  private async checkVoteStatus(): Promise<void> {
    if (!this.preset?.apiPresetId || !authService.isAuthenticated()) {
      this.hasVoted = false;
      return;
    }

    try {
      const result = await communityPresetService.hasVoted(this.preset.apiPresetId);
      this.hasVoted = result.has_voted;
      // Update vote count from server if available
      if (result.vote_count !== undefined) {
        this.currentVoteCount = result.vote_count;
      }
    } catch (error) {
      console.error('[v4-preset-detail] Failed to check vote status:', error);
      this.hasVoted = false;
    }
  }

  /**
   * Fetch market board prices for preset dyes if prices are enabled
   */
  private async fetchPricesIfNeeded(): Promise<void> {
    // Check if we should fetch prices
    if (!this.marketConfig.showPrices || !this.preset || !this.marketBoardService) {
      return;
    }

    // Resolve dye IDs to Dye objects
    const dyes = this.preset.dyes
      .map((dyeId) => this.resolveDye(dyeId))
      .filter((dye): dye is Dye => dye !== null);

    if (dyes.length === 0) {
      return;
    }

    this.isFetchingPrices = true;

    try {
      // Fetch prices via MarketBoardService (handles race conditions internally)
      const prices = await this.marketBoardService.fetchPricesForDyes(dyes);

      // Update local price cache
      for (const [itemId, priceInfo] of prices) {
        this.priceData.set(itemId, priceInfo);
      }
      // Trigger re-render with new price data
      this.priceData = new Map(this.priceData);
    } catch (error) {
      console.error('[v4-preset-detail] Failed to fetch prices:', error);
    } finally {
      this.isFetchingPrices = false;
    }
  }

  /**
   * Handle back button click
   */
  private handleBack(): void {
    this.emit('back');
  }

  /**
   * Handle share button click
   */
  private handleShare(): void {
    if (!this.preset) return;
    const url = `${window.location.origin}/presets/${this.preset.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => ToastService.success(LanguageService.t('preset.linkCopied')))
      .catch(() => ToastService.error(LanguageService.t('errors.copyLinkFailed')));
  }

  /**
   * Handle edit button click
   */
  private handleEdit(): void {
    if (!this.preset) return;
    this.emit<{ preset: UnifiedPreset }>('edit-preset', { preset: this.preset });
  }

  /**
   * Handle delete button click
   */
  private handleDelete(): void {
    if (!this.preset) return;
    this.emit<{ preset: UnifiedPreset }>('delete-preset', { preset: this.preset });
  }

  /**
   * Handle vote button click
   */
  private async handleVote(): Promise<void> {
    if (!this.preset?.apiPresetId) return;

    if (!authService.isAuthenticated()) {
      ToastService.warning(LanguageService.t('preset.loginToVote'));
      return;
    }

    this.isVoting = true;

    try {
      if (this.hasVoted) {
        // Remove vote
        const result = await communityPresetService.removeVote(this.preset.apiPresetId);
        if (result.success) {
          this.hasVoted = false;
          this.currentVoteCount = result.new_vote_count;
          // Emit update with new vote count
          const updatedPreset = { ...this.preset, voteCount: result.new_vote_count };
          this.emit<{ preset: UnifiedPreset }>('vote-update', { preset: updatedPreset });
          ToastService.info(LanguageService.t('preset.voteRemoved'));
        } else {
          ToastService.error(result.error || LanguageService.t('errors.removeVoteFailed'));
        }
      } else {
        // Add vote
        const result = await communityPresetService.voteForPreset(this.preset.apiPresetId);
        if (result.success) {
          this.hasVoted = true;
          this.currentVoteCount = result.new_vote_count;
          // Emit update with new vote count
          const updatedPreset = { ...this.preset, voteCount: result.new_vote_count };
          this.emit<{ preset: UnifiedPreset }>('vote-update', { preset: updatedPreset });
          ToastService.success(LanguageService.t('preset.voteAdded'));
        } else if (result.already_voted) {
          this.hasVoted = true;
          ToastService.info(LanguageService.t('preset.alreadyVoted'));
        } else {
          ToastService.error(result.error || LanguageService.t('errors.voteFailed'));
        }
      }
    } catch (error) {
      console.error('[v4-preset-detail] Vote error:', error);
      ToastService.error(LanguageService.t('errors.voteProcessFailed'));
    } finally {
      this.isVoting = false;
    }
  }

  /**
   * Resolve a dye ID to a Dye object
   */
  private resolveDye(dyeId: number): Dye | null {
    return dyeService.getDyeById(dyeId);
  }

  protected override render(): TemplateResult {
    if (!this.preset) {
      return html`
        <div class="preset-detail">
          <div class="loading">
            <div class="spinner"></div>
            <span>Loading preset...</span>
          </div>
        </div>
      `;
    }

    const isVoteable = this.preset.isFromAPI && !this.preset.isCurated;
    const isAuthenticated = authService.isAuthenticated();

    return html`
      <div class="preset-detail">
        <!-- Back button -->
        <button class="back-button" @click=${this.handleBack}>
          ${unsafeHTML(ICON_ARROW_BACK)}
          <span>Back to list</span>
        </button>

        <!-- Badges -->
        <div class="badges">
          <span class="badge badge-category">
            ${unsafeHTML(getCategoryIcon(this.preset.category))}
            ${this.preset.category}
          </span>
          ${this.preset.isCurated
        ? html`<span class="badge badge-curated">Official</span>`
        : html`<span class="badge badge-community">Community</span>`}
          ${this.currentVoteCount > 0
        ? html`<span class="badge badge-votes">★ ${this.currentVoteCount} votes</span>`
        : nothing}
        </div>

        <!-- Title & description -->
        <h2 class="preset-title">${this.preset.name}</h2>
        <p class="preset-description">${this.preset.description}</p>
        ${this.preset.author
        ? html`<p class="preset-author">Created by ${this.preset.author}</p>`
        : nothing}

        <!-- Dyes grid using v4-result-card -->
        <div class="dyes-section">
          <h3 class="section-title">Colors in Palette</h3>
          <div class="dyes-grid">
            ${this.preset.dyes.map((dyeId) => {
          const dye = this.resolveDye(dyeId);
          if (!dye) return nothing;
          // Get price data for this dye
          const priceInfo = this.priceData.get(dye.itemID);
          // Resolve world name from price data, or fall back to selected server
          const marketServer = this.marketBoardService?.getWorldNameForPrice(priceInfo)
            ?? this.marketConfig.selectedServer;
          return html`
                <v4-result-card
                  .data=${{
              dye,
              originalColor: dye.hex,
              matchedColor: dye.hex,
              marketServer: marketServer,
              price: this.marketConfig.showPrices && priceInfo ? priceInfo.currentAverage : undefined,
              vendorCost: dye.cost,
            }}
                  ?show-actions=${false}
                  ?show-hex=${this.displayOptions.showHex}
                  ?show-rgb=${this.displayOptions.showRgb}
                  ?show-hsv=${this.displayOptions.showHsv}
                  ?show-lab=${this.displayOptions.showLab}
                  ?show-delta-e=${this.displayOptions.showDeltaE}
                  ?show-price=${this.displayOptions.showPrice && this.marketConfig.showPrices}
                  ?show-acquisition=${this.displayOptions.showAcquisition}
                ></v4-result-card>
              `;
        })}
          </div>
        </div>

        <!-- Tags -->
        ${this.preset.tags && this.preset.tags.length > 0
        ? html`
              <div class="tags-section">
                <h4 class="section-title">Tags</h4>
                <div class="tags-list">
                  ${this.preset.tags.map((tag) => html`<span class="tag">${tag}</span>`)}
                </div>
              </div>
            `
        : nothing}

        <!-- Actions -->
        <div class="actions">
          <button class="action-btn share-btn" @click=${this.handleShare}><span class="icon">${unsafeHTML(ICON_LINK)}</span> Copy Link</button>
          ${isVoteable
        ? html`
                <button
                  class="action-btn vote-btn ${this.hasVoted ? 'voted' : ''}"
                  ?disabled=${this.isVoting}
                  @click=${this.handleVote}
                >
                  ${this.hasVoted
            ? html`✓ Voted (${this.currentVoteCount})`
            : html`${unsafeHTML(ICON_CRYSTAL)} Vote (${this.currentVoteCount})`}
                </button>
              `
        : nothing}
          ${this.isOwnPreset && this.preset.isFromAPI && this.preset.apiPresetId
        ? html`
                <button class="action-btn edit-btn" @click=${this.handleEdit}>✏️ Edit</button>
                <button class="action-btn delete-btn" @click=${this.handleDelete}>🗑️ Delete</button>
              `
        : nothing}
        </div>

        <!-- Login CTA for non-authenticated users viewing voteable presets -->
        ${isVoteable && !isAuthenticated
        ? html`
              <div class="login-cta">
                Login with Discord or XIVAuth to vote for this preset
              </div>
            `
        : nothing}
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-preset-detail': PresetDetail;
  }
}
