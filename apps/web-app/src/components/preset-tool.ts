/**
 * XIV Dye Tools v3.0.0 - Preset Tool Component
 *
 * Phase 7: Preset Browser migration to v3 two-panel layout.
 * Orchestrates preset browsing, filtering, voting, and submission.
 *
 * Left Panel: Search, category filters, sort options, auth section
 * Right Panel: Featured presets, preset grid, pagination
 *
 * @module components/tools/preset-tool
 */

import { BaseComponent } from '@components/base-component';
import { AuthButton } from '@components/auth-button';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { PresetDetailView } from '@components/preset-detail-view';
import { showPresetSubmissionForm } from '@components/preset-submission-form';
import { showPresetEditForm } from '@components/preset-edit-form';
import {
  authService,
  ConfigController,
  hybridPresetService,
  presetSubmissionService,
  LanguageService,
  RouterService,
  StorageService,
} from '@services/index';
import { ICON_TOOL_PRESETS } from '@shared/tool-icons';
import {
  ICON_STAR,
  ICON_SEARCH,
  ICON_GRID,
  ICON_SORT,
  ICON_USER,
  ICON_EDIT,
  ICON_TRASH,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { UnifiedPreset, PresetSortOption } from '@services/hybrid-preset-service';
import type { PresetCategory } from '@xivdyetools/core';
import type { AuthState } from '@services/auth-service';
import type { CommunityPreset } from '@services/community-preset-service';
import type { PresetsConfig } from '@shared/tool-config-types';

// ============================================================================
// Types and Constants
// ============================================================================

export interface PresetToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Storage keys for v3 preset tool
 */
const STORAGE_KEYS = {
  category: 'v3_preset_category',
  sortBy: 'v3_preset_sort',
  tab: 'v3_preset_tab',
  showFavorites: 'v3_preset_show_favorites',
} as const;

/**
 * Default values
 */
const DEFAULTS = {
  category: 'all' as const,
  sortBy: 'popular' as PresetSortOption,
  tab: 'browse' as const,
};

/**
 * Categories available for filtering
 */
const CATEGORIES: Array<{ id: string; labelKey: string; fallback: string }> = [
  { id: 'all', labelKey: 'preset.categories.all', fallback: 'All' },
  { id: 'jobs', labelKey: 'preset.categories.jobs', fallback: 'Jobs' },
  {
    id: 'grand-companies',
    labelKey: 'preset.categories.grandCompanies',
    fallback: 'Grand Companies',
  },
  { id: 'seasons', labelKey: 'preset.categories.seasons', fallback: 'Seasons' },
  { id: 'events', labelKey: 'preset.categories.events', fallback: 'Events' },
  { id: 'aesthetics', labelKey: 'preset.categories.aesthetics', fallback: 'Aesthetics' },
  { id: 'community', labelKey: 'preset.categories.community', fallback: 'Community' },
];

/**
 * Sort options
 */
const SORT_OPTIONS: Array<{ id: PresetSortOption; labelKey: string; fallback: string }> = [
  { id: 'popular', labelKey: 'preset.sort.popular', fallback: 'Most Popular' },
  { id: 'recent', labelKey: 'preset.sort.recent', fallback: 'Most Recent' },
  { id: 'name', labelKey: 'preset.sort.name', fallback: 'Alphabetical' },
];

// ============================================================================
// PresetTool Component
// ============================================================================

/**
 * Preset Tool - v3 Two-Panel Layout
 *
 * Browse, search, and discover dye presets from curated and community sources.
 */
export class PresetTool extends BaseComponent {
  private options: PresetToolOptions;

  // State
  private selectedCategory: string;
  private sortBy: PresetSortOption;
  private currentTab: 'browse' | 'my-submissions';
  private showFavoritesOnly: boolean = false;
  private searchQuery: string = '';
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    expiresAt: null,
    provider: null,
  };

  // Data
  private presets: UnifiedPreset[] = [];
  private featuredPresets: UnifiedPreset[] = [];
  private userSubmissions: CommunityPreset[] = [];
  private isLoading = false;
  private hasMorePresets = false;
  private currentPage = 1;
  private readonly pageSize = 12;

  // Child components
  private authButton: AuthButton | null = null;
  private mobileAuthButton: AuthButton | null = null;
  private collapsiblePanels: CollapsiblePanel[] = [];
  private mobileCollapsiblePanels: CollapsiblePanel[] = [];
  private detailView: PresetDetailView | null = null;

  // Detail view state
  private selectedPreset: UnifiedPreset | null = null;

  // DOM References
  private categoryContainer: HTMLElement | null = null;
  private sortContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private featuredContainer: HTMLElement | null = null;
  private presetsGridContainer: HTMLElement | null = null;
  private loadMoreContainer: HTMLElement | null = null;
  private tabContainer: HTMLElement | null = null;
  private authSectionContainer: HTMLElement | null = null;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private authUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, options: PresetToolOptions) {
    super(container);
    this.options = options;

    // Load persisted settings
    this.selectedCategory =
      StorageService.getItem<string>(STORAGE_KEYS.category) ?? DEFAULTS.category;
    this.sortBy = StorageService.getItem<PresetSortOption>(STORAGE_KEYS.sortBy) ?? DEFAULTS.sortBy;
    this.currentTab =
      StorageService.getItem<'browse' | 'my-submissions'>(STORAGE_KEYS.tab) ?? DEFAULTS.tab;
    this.showFavoritesOnly = StorageService.getItem<boolean>(STORAGE_KEYS.showFavorites) ?? false;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    this.renderLeftPanel();
    this.renderRightPanel();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  bindEvents(): void {
    // Event bindings handled in child components
  }

  async onMount(): Promise<void> {
    // Subscribe to language changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to auth changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.authUnsubscribe = authService.subscribe((state) => {
      this.authState = state;
      this.updateAuthSection();
      this.updateTabVisibility();
      this.updateDrawerContent();

      // If we just logged in, refresh my submissions
      if (state.isAuthenticated && this.currentTab === 'my-submissions') {
        void this.loadUserSubmissions();
      }
    });

    // Subscribe to config changes from V4 ConfigSidebar
    this.configUnsubscribe = ConfigController.getInstance().subscribe('presets', (config) => {
      this.setConfig(config);
    });

    // Get initial auth state
    this.authState = authService.getState();

    // Initialize hybrid preset service
    await hybridPresetService.initialize();

    // Load initial data
    await this.loadPresets();

    // Check for deep link to a specific preset
    await this.handleDeepLink();

    logger.info('[PresetTool] Mounted');
  }

  /**
   * Handle deep links to specific presets (e.g., /presets/community-xxx)
   */
  private async handleDeepLink(): Promise<void> {
    const presetId = RouterService.getSubPath();
    if (!presetId) return;

    logger.info('[PresetTool] Deep link detected, loading preset:', presetId);

    try {
      // First check if the preset is already in our loaded presets
      let preset = this.presets.find((p) => p.id === presetId);
      if (!preset) {
        preset = this.featuredPresets.find((p) => p.id === presetId);
      }

      // If not found locally, fetch from API via hybridPresetService
      if (!preset) {
        const fetchedPreset = await hybridPresetService.getPreset(presetId);
        if (fetchedPreset) {
          preset = fetchedPreset;
        }
      }

      if (preset) {
        this.showDetailView(preset);
      } else {
        logger.warn('[PresetTool] Preset not found for deep link:', presetId);
        // Show a toast notification
        const { ToastService } = await import('@services/index');
        ToastService.warning(LanguageService.t('preset.notFound'));
      }
    } catch (error) {
      logger.error('[PresetTool] Failed to load deep linked preset:', error);
    }
  }

  destroy(): void {
    this.languageUnsubscribe?.();
    this.authUnsubscribe?.();
    this.configUnsubscribe?.();
    this.authButton?.destroy();
    this.mobileAuthButton?.destroy();
    this.detailView?.destroy();

    // Clean up collapsible panels (desktop)
    this.collapsiblePanels.forEach((panel) => panel.destroy());
    this.collapsiblePanels = [];

    // Clean up mobile collapsible panels
    this.mobileCollapsiblePanels.forEach((panel) => panel.destroy());
    this.mobileCollapsiblePanels = [];

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    this.presets = [];
    this.featuredPresets = [];
    this.userSubmissions = [];
    this.selectedPreset = null;

    super.destroy();
    logger.info('[PresetTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<PresetsConfig>): void {
    let needsReload = false;

    // Handle showMyPresetsOnly (maps to currentTab)
    if (config.showMyPresetsOnly !== undefined) {
      const newTab = config.showMyPresetsOnly ? 'my-submissions' : 'browse';
      if (newTab !== this.currentTab) {
        this.currentTab = newTab;
        StorageService.setItem(STORAGE_KEYS.tab, newTab);
        needsReload = true;
        logger.info(
          `[PresetTool] setConfig: showMyPresetsOnly -> ${config.showMyPresetsOnly} (tab: ${newTab})`
        );

        // Update tab visibility UI
        this.updateTabVisibility();
      }
    }

    // Handle showFavorites
    if (config.showFavorites !== undefined && config.showFavorites !== this.showFavoritesOnly) {
      this.showFavoritesOnly = config.showFavorites;
      StorageService.setItem(STORAGE_KEYS.showFavorites, config.showFavorites);
      needsReload = true;
      logger.info(`[PresetTool] setConfig: showFavorites -> ${config.showFavorites}`);
    }

    // Handle sortBy
    if (config.sortBy !== undefined && config.sortBy !== this.sortBy) {
      this.sortBy = config.sortBy as PresetSortOption;
      StorageService.setItem(STORAGE_KEYS.sortBy, config.sortBy);
      needsReload = true;
      logger.info(`[PresetTool] setConfig: sortBy -> ${config.sortBy}`);

      // Update sort radio buttons in UI
      if (this.sortContainer) {
        const radio = this.sortContainer.querySelector<HTMLInputElement>(
          `input[name="sort"][value="${config.sortBy}"]`
        );
        if (radio) radio.checked = true;
      }
    }

    // Reload presets if config changed
    if (needsReload) {
      this.currentPage = 1;
      void this.loadPresets();
      this.updateDrawerContent();
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Clean up existing panels before re-rendering
    this.collapsiblePanels.forEach((panel) => panel.destroy());
    this.collapsiblePanels = [];

    // Section 1: Search (with tabs if authenticated)
    const searchPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('preset.search'),
      storageKey: 'preset_search',
      defaultOpen: true,
      icon: ICON_SEARCH,
    });
    searchPanel.init();
    this.collapsiblePanels.push(searchPanel);
    const searchContent = searchPanel.getContentContainer();
    if (searchContent) {
      this.renderSearchAndTabs(searchContent);
    }

    // Section 2: Categories
    const categoriesPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('preset.categoriesTitle'),
      storageKey: 'preset_categories',
      defaultOpen: true,
      icon: ICON_GRID,
    });
    categoriesPanel.init();
    this.collapsiblePanels.push(categoriesPanel);
    const categoriesContent = categoriesPanel.getContentContainer();
    if (categoriesContent) {
      this.renderCategories(categoriesContent);
    }

    // Section 3: Sort Options
    const sortPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('preset.sortBy'),
      storageKey: 'preset_sort',
      defaultOpen: true,
      icon: ICON_SORT,
    });
    sortPanel.init();
    this.collapsiblePanels.push(sortPanel);
    const sortContent = sortPanel.getContentContainer();
    if (sortContent) {
      this.renderSortOptions(sortContent);
    }

    // Section 4: Account
    const accountPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('preset.account'),
      storageKey: 'preset_account',
      defaultOpen: true,
      icon: ICON_USER,
    });
    accountPanel.init();
    this.collapsiblePanels.push(accountPanel);
    const accountContent = accountPanel.getContentContainer();
    if (accountContent) {
      this.authSectionContainer = this.createElement('div');
      accountContent.appendChild(this.authSectionContainer);
      this.renderAuthSection();
    }
  }

  /**
   * Create a section with label
   */
  private createSection(label: string): HTMLElement {
    const section = this.createElement('div', {
      className: 'p-4 border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    const sectionLabel = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: label,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    section.appendChild(sectionLabel);
    return section;
  }

  /**
   * Create a header for right panel sections
   */
  private createHeader(text: string): HTMLElement {
    return this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: text,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
  }

  /**
   * Render search input and tab toggle
   */
  private renderSearchAndTabs(container: HTMLElement): void {
    const wrapper = this.createElement('div', { className: 'space-y-3' });

    // Tab toggle (only shown when authenticated)
    this.tabContainer = this.createElement('div', { className: 'flex gap-2 mb-3' });
    this.updateTabVisibility();
    wrapper.appendChild(this.tabContainer);

    // Search input with icon
    const searchWrapper = this.createElement('div', {
      className: 'relative',
    });

    const searchIcon = this.createElement('span', {
      className: 'absolute left-3 top-1/2 -translate-y-1/2 opacity-50',
      attributes: { style: 'color: var(--theme-text);' },
    });
    searchIcon.innerHTML = ICON_SEARCH;
    searchWrapper.appendChild(searchIcon);

    this.searchInput = this.createElement('input', {
      className: 'w-full pl-10 pr-3 py-2 rounded-lg border text-sm',
      attributes: {
        type: 'text',
        placeholder: LanguageService.t('preset.searchPlaceholder'),
        style:
          'background: var(--theme-background); border-color: var(--theme-border); color: var(--theme-text);',
      },
    }) as HTMLInputElement;

    this.on(this.searchInput, 'input', () => {
      // Debounce search
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout);
      }
      this.searchDebounceTimeout = setTimeout(() => {
        this.searchQuery = this.searchInput?.value || '';
        this.currentPage = 1;
        void this.loadPresets();
        this.updateDrawerContent();
      }, 300);
    });

    searchWrapper.appendChild(this.searchInput);
    wrapper.appendChild(searchWrapper);

    container.appendChild(wrapper);
  }

  /**
   * Update tab visibility based on auth state
   */
  private updateTabVisibility(): void {
    if (!this.tabContainer) return;
    clearContainer(this.tabContainer);

    if (!this.authState.isAuthenticated) {
      this.tabContainer.classList.add('hidden');
      // Reset to browse tab if not authenticated
      if (this.currentTab === 'my-submissions') {
        this.currentTab = 'browse';
        StorageService.setItem(STORAGE_KEYS.tab, 'browse');
      }
      return;
    }

    this.tabContainer.classList.remove('hidden');

    const browseBtn = this.createElement('button', {
      className: 'flex-1 px-3 py-2 text-sm rounded-lg transition-colors',
      textContent: LanguageService.t('preset.browse'),
      attributes: {
        style:
          this.currentTab === 'browse'
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-background-secondary); color: var(--theme-text);',
      },
    });

    const mySubmissionsBtn = this.createElement('button', {
      className: 'flex-1 px-3 py-2 text-sm rounded-lg transition-colors',
      textContent: LanguageService.t('preset.mySubmissions'),
      attributes: {
        style:
          this.currentTab === 'my-submissions'
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-background-secondary); color: var(--theme-text);',
      },
    });

    this.on(browseBtn, 'click', () => {
      this.currentTab = 'browse';
      StorageService.setItem(STORAGE_KEYS.tab, 'browse');
      this.updateTabVisibility();
      this.currentPage = 1;
      void this.loadPresets();
      this.updateDrawerContent();
    });

    this.on(mySubmissionsBtn, 'click', () => {
      this.currentTab = 'my-submissions';
      StorageService.setItem(STORAGE_KEYS.tab, 'my-submissions');
      this.updateTabVisibility();
      void this.loadUserSubmissions();
      this.updateDrawerContent();
    });

    this.tabContainer.appendChild(browseBtn);
    this.tabContainer.appendChild(mySubmissionsBtn);
  }

  /**
   * Render category filters
   */
  private renderCategories(container: HTMLElement): void {
    this.categoryContainer = this.createElement('div', { className: 'space-y-1' });

    CATEGORIES.forEach((cat) => {
      const isSelected = this.selectedCategory === cat.id;
      const btn = this.createElement('button', {
        className: 'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
        textContent: LanguageService.t(cat.labelKey),
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
        },
      });

      this.on(btn, 'click', () => {
        this.selectedCategory = cat.id;
        StorageService.setItem(STORAGE_KEYS.category, cat.id);
        this.updateCategoryButtons();
        this.currentPage = 1;
        void this.loadPresets();
        this.updateDrawerContent();
      });

      this.categoryContainer!.appendChild(btn);
    });

    container.appendChild(this.categoryContainer);
  }

  /**
   * Update category button styles
   */
  private updateCategoryButtons(): void {
    if (!this.categoryContainer) return;
    const buttons = this.categoryContainer.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      const isSelected = this.selectedCategory === CATEGORIES[i].id;
      btn.setAttribute(
        'style',
        isSelected
          ? 'background: var(--theme-primary); color: var(--theme-text-header);'
          : 'background: transparent; color: var(--theme-text);'
      );
    });
  }

  /**
   * Render sort options
   */
  private renderSortOptions(container: HTMLElement): void {
    this.sortContainer = this.createElement('div', { className: 'space-y-2' });

    SORT_OPTIONS.forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });

      const radio = this.createElement('input', {
        className: 'w-4 h-4',
        attributes: {
          type: 'radio',
          name: 'preset-sort',
          value: opt.id,
          ...(isSelected && { checked: 'checked' }),
        },
      }) as HTMLInputElement;

      this.on(radio, 'change', () => {
        this.sortBy = opt.id;
        StorageService.setItem(STORAGE_KEYS.sortBy, opt.id);
        this.currentPage = 1;
        void this.loadPresets();
        this.updateDrawerContent();
      });

      const text = this.createElement('span', {
        className: 'text-sm',
        textContent: LanguageService.t(opt.labelKey),
        attributes: { style: 'color: var(--theme-text);' },
      });

      label.appendChild(radio);
      label.appendChild(text);
      this.sortContainer!.appendChild(label);
    });

    container.appendChild(this.sortContainer);
  }

  /**
   * Render auth section
   */
  private renderAuthSection(): void {
    if (!this.authSectionContainer) return;
    clearContainer(this.authSectionContainer);

    const wrapper = this.createElement('div', { className: 'space-y-3' });

    if (this.authState.isAuthenticated && this.authState.user) {
      // Logged in state
      const userCard = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      // Avatar
      const avatar = this.createElement('div', {
        className: 'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
        attributes: { style: 'background: var(--theme-primary);' },
      });

      if (this.authState.user.avatar_url) {
        const img = this.createElement('img', {
          className: 'w-full h-full rounded-full object-cover',
          attributes: {
            src: this.authState.user.avatar_url,
            alt: this.authState.user.global_name || this.authState.user.username,
          },
        });
        avatar.appendChild(img);
      } else {
        avatar.textContent = (this.authState.user.global_name || this.authState.user.username)
          .charAt(0)
          .toUpperCase();
      }

      userCard.appendChild(avatar);

      // User info
      const userInfo = this.createElement('div', { className: 'flex-1' });
      const userName = this.createElement('p', {
        className: 'text-sm font-medium',
        textContent: this.authState.user.global_name || this.authState.user.username,
        attributes: { style: 'color: var(--theme-text);' },
      });
      const submissionCount = this.createElement('p', {
        className: 'text-xs',
        textContent: `${this.userSubmissions.length} ${LanguageService.t('preset.submissions')}`,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      userInfo.appendChild(userName);
      userInfo.appendChild(submissionCount);
      userCard.appendChild(userInfo);

      wrapper.appendChild(userCard);

      // My Submissions button
      const mySubmissionsBtn = this.createElement('button', {
        className: 'w-full px-3 py-2 text-sm rounded-lg',
        textContent: LanguageService.t('preset.viewMySubmissions'),
        attributes: {
          style:
            'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);',
        },
      });
      this.on(mySubmissionsBtn, 'click', () => {
        this.currentTab = 'my-submissions';
        StorageService.setItem(STORAGE_KEYS.tab, 'my-submissions');
        this.updateTabVisibility();
        void this.loadUserSubmissions();
      });
      wrapper.appendChild(mySubmissionsBtn);

      // Submit Preset button
      const submitBtn = this.createElement('button', {
        className: 'w-full px-3 py-2 text-sm rounded-lg',
        textContent: `+ ${LanguageService.t('preset.submitPreset')}`,
        attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
      });
      this.on(submitBtn, 'click', () => {
        showPresetSubmissionForm((result) => {
          if (result.success) {
            void this.loadUserSubmissions();
            void this.loadPresets();
          }
        });
      });
      wrapper.appendChild(submitBtn);

      // Logout button
      const logoutBtn = this.createElement('button', {
        className: 'w-full px-3 py-2 text-sm rounded-lg text-red-500',
        textContent: LanguageService.t('auth.logout'),
        attributes: {
          style: 'background: transparent; border: 1px solid var(--theme-border);',
        },
      });
      this.on(logoutBtn, 'click', async () => {
        await authService.logout();
      });
      wrapper.appendChild(logoutBtn);
    } else {
      // Logged out state
      const message = this.createElement('p', {
        className: 'text-sm mb-3',
        textContent: LanguageService.t('preset.loginPrompt'),
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      wrapper.appendChild(message);

      // Auth button
      const authContainer = this.createElement('div');
      this.authButton = new AuthButton(authContainer, { returnTool: 'presets' });
      this.authButton.init();
      wrapper.appendChild(authContainer);
    }

    this.authSectionContainer.appendChild(wrapper);
  }

  /**
   * Update auth section without re-rendering entire left panel
   */
  private updateAuthSection(): void {
    // Destroy existing auth button if any
    this.authButton?.destroy();
    this.authButton = null;
    this.renderAuthSection();
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Empty state (shown when no presets or loading)
    this.emptyStateContainer = this.createElement('div');
    this.renderEmptyState();
    right.appendChild(this.emptyStateContainer);

    // Featured section (hidden on my-submissions tab)
    const featuredSection = this.createElement('div', { className: 'mb-6 hidden' });
    featuredSection.setAttribute('data-section', 'featured');
    featuredSection.appendChild(
      this.createHeader(LanguageService.t('preset.featured'))
    );
    this.featuredContainer = this.createElement('div', { className: 'grid gap-4 grid-cols-2' });
    featuredSection.appendChild(this.featuredContainer);
    right.appendChild(featuredSection);

    // Presets grid section
    const gridSection = this.createElement('div', { className: 'hidden' });
    gridSection.setAttribute('data-section', 'grid');
    gridSection.appendChild(
      this.createHeader(LanguageService.t('preset.allPresets'))
    );
    this.presetsGridContainer = this.createElement('div', {
      className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    });
    gridSection.appendChild(this.presetsGridContainer);
    right.appendChild(gridSection);

    // Load more section
    this.loadMoreContainer = this.createElement('div', { className: 'hidden mt-6 text-center' });
    right.appendChild(this.loadMoreContainer);
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    const empty = this.createElement('div', {
      className: 'flex flex-col items-center justify-center text-center',
      attributes: {
        style: 'min-height: 400px; padding: 3rem 2rem;',
      },
    });

    if (this.isLoading) {
      empty.innerHTML = `
        <div class="inline-block w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mb-4" style="border-color: var(--theme-primary); border-top-color: transparent;"></div>
        <p style="color: var(--theme-text); font-size: 1.125rem;">${LanguageService.t('preset.loading')}</p>
      `;
    } else {
      empty.innerHTML = `
        <span style="display: block; width: 150px; height: 150px; margin: 0 auto 1.5rem; opacity: 0.25; color: var(--theme-text);">${ICON_TOOL_PRESETS}</span>
        <p style="color: var(--theme-text); font-size: 1.125rem;">${LanguageService.t('preset.noPresets')}</p>
        <p class="text-sm mt-2" style="color: var(--theme-text-muted);">${LanguageService.t('preset.tryDifferentFilters')}</p>
      `;
    }

    this.emptyStateContainer.appendChild(empty);
  }

  /**
   * Show/hide empty state
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.classList.toggle('hidden', !show);
    }

    // Toggle all result sections
    const rightPanel = this.options.rightPanel;
    const sections = rightPanel.querySelectorAll('[data-section]');
    sections.forEach((section) => {
      section.classList.toggle('hidden', show);
    });
  }

  /**
   * Render featured presets
   */
  private renderFeaturedPresets(): void {
    if (!this.featuredContainer) return;
    clearContainer(this.featuredContainer);

    // Hide featured section on my-submissions tab
    const featuredSection = this.options.rightPanel.querySelector('[data-section="featured"]');
    if (featuredSection) {
      featuredSection.classList.toggle('hidden', this.currentTab === 'my-submissions');
    }

    if (this.currentTab === 'my-submissions') return;

    this.featuredPresets.slice(0, 4).forEach((preset) => {
      const card = this.createFeaturedCard(preset);
      this.featuredContainer!.appendChild(card);
    });
  }

  /**
   * Create a featured preset card
   */
  private createFeaturedCard(preset: UnifiedPreset): HTMLElement {
    const colors = this.getPresetColors(preset);
    const card = this.createElement('div', {
      className:
        'relative p-4 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-102',
      attributes: {
        style: `background: linear-gradient(135deg, ${colors[0]}40, ${colors[2] || colors[0]}40); border: 2px solid ${colors[0]};`,
      },
    });

    this.on(card, 'click', () => this.handlePresetClick(preset));

    // Featured badge
    const badge = this.createElement('div', {
      className: 'absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium',
      textContent: LanguageService.t('preset.featured'),
      attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
    });
    card.appendChild(badge);

    // Name
    const name = this.createElement('h4', {
      className: 'font-bold text-lg mb-2',
      textContent: preset.name,
      attributes: { style: 'color: var(--theme-text);' },
    });
    card.appendChild(name);

    // Author
    if (preset.author) {
      const author = this.createElement('p', {
        className: 'text-sm mb-3',
        textContent: `by ${preset.author}`,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      card.appendChild(author);
    }

    // Color swatches
    const swatches = this.createElement('div', { className: 'flex gap-1 mb-3' });
    colors.slice(0, 4).forEach((color) => {
      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded',
        attributes: { style: `background: ${color};` },
      });
      swatches.appendChild(swatch);
    });
    card.appendChild(swatches);

    // Vote count
    const votes = this.createElement('div', {
      className: 'flex items-center gap-1 text-sm',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    const starIcon = this.createElement('span', { className: 'w-4 h-4' });
    starIcon.innerHTML = ICON_STAR;
    votes.appendChild(starIcon);
    votes.appendChild(document.createTextNode(preset.voteCount.toLocaleString()));
    card.appendChild(votes);

    return card;
  }

  /**
   * Render preset grid
   */
  private renderPresetsGrid(): void {
    if (!this.presetsGridContainer) return;
    clearContainer(this.presetsGridContainer);

    // Update header
    const gridSection = this.options.rightPanel.querySelector('[data-section="grid"]');
    const header = gridSection?.querySelector('h3');
    if (header) {
      header.textContent =
        this.currentTab === 'my-submissions'
          ? LanguageService.t('preset.mySubmissions')
          : LanguageService.t('preset.allPresets');
    }

    const presetsToShow =
      this.currentTab === 'my-submissions'
        ? this.userSubmissions.map((p) => this.communityToUnified(p))
        : this.presets;

    presetsToShow.forEach((preset) => {
      const card = this.createPresetCard(preset);
      this.presetsGridContainer!.appendChild(card);
    });
  }

  /**
   * Create a preset card
   */
  private createPresetCard(preset: UnifiedPreset): HTMLElement {
    const colors = this.getPresetColors(preset);
    const card = this.createElement('div', {
      className: 'p-4 rounded-lg cursor-pointer transition-transform hover:scale-102',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    this.on(card, 'click', (e: MouseEvent) => {
      // Don't trigger preset click if clicking action buttons
      const target = e.target as HTMLElement;
      if (target.closest('[data-action]')) return;
      this.handlePresetClick(preset);
    });

    // Color bars
    const colorBars = this.createElement('div', { className: 'flex gap-1 mb-3' });
    colors.slice(0, 4).forEach((color, i) => {
      const bar = this.createElement('div', {
        className: 'flex-1 h-12',
        attributes: {
          style: `background: ${color}; ${i === 0 ? 'border-radius: 0.5rem 0 0 0.5rem;' : ''} ${i === colors.length - 1 || i === 3 ? 'border-radius: 0 0.5rem 0.5rem 0;' : ''}`,
        },
      });
      colorBars.appendChild(bar);
    });
    card.appendChild(colorBars);

    // Name
    const name = this.createElement('h4', {
      className: 'font-medium text-sm mb-1',
      textContent: preset.name,
      attributes: { style: 'color: var(--theme-text);' },
    });
    card.appendChild(name);

    // Author and votes
    const meta = this.createElement('div', {
      className: 'flex items-center justify-between text-xs',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    const author = this.createElement('span', {
      textContent: preset.author ? `by ${preset.author}` : '',
    });
    meta.appendChild(author);

    const votesWrapper = this.createElement('span', { className: 'flex items-center gap-1' });
    const starIcon = this.createElement('span', { className: 'w-3 h-3' });
    starIcon.innerHTML = ICON_STAR;
    votesWrapper.appendChild(starIcon);
    votesWrapper.appendChild(document.createTextNode(String(preset.voteCount)));
    meta.appendChild(votesWrapper);

    card.appendChild(meta);

    // Show Edit/Delete buttons only in My Submissions tab
    // This tab only shows the user's own presets (verified by backend)
    // The API enforces ownership verification on actual edit/delete operations
    const isOwnPreset = this.currentTab === 'my-submissions';

    if (isOwnPreset && preset.isFromAPI && preset.apiPresetId) {
      const actionsRow = this.createElement('div', {
        className: 'flex gap-2 mt-3 pt-3 border-t',
        attributes: { style: 'border-color: var(--theme-border);' },
      });

      // Edit button
      const editBtn = this.createElement('button', {
        className:
          'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
        attributes: {
          style: 'background: var(--theme-primary); color: var(--theme-text-header);',
          'data-action': 'edit',
        },
      });
      const editIcon = this.createElement('span', { className: 'w-3 h-3' });
      editIcon.innerHTML = ICON_EDIT;
      editBtn.appendChild(editIcon);
      editBtn.appendChild(document.createTextNode(LanguageService.t('preset.edit')));
      this.on(editBtn, 'click', (e: MouseEvent) => {
        e.stopPropagation();
        this.handleEditPreset(preset);
      });
      actionsRow.appendChild(editBtn);

      // Delete button
      const deleteBtn = this.createElement('button', {
        className:
          'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors text-red-500',
        attributes: {
          style: 'background: transparent; border: 1px solid var(--theme-border);',
          'data-action': 'delete',
        },
      });
      const deleteIcon = this.createElement('span', { className: 'w-3 h-3' });
      deleteIcon.innerHTML = ICON_TRASH;
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.appendChild(
        document.createTextNode(LanguageService.t('preset.delete'))
      );
      this.on(deleteBtn, 'click', (e: MouseEvent) => {
        e.stopPropagation();
        this.handleDeletePreset(preset);
      });
      actionsRow.appendChild(deleteBtn);

      card.appendChild(actionsRow);
    }

    return card;
  }

  /**
   * Render load more button
   */
  private renderLoadMore(): void {
    if (!this.loadMoreContainer) return;
    clearContainer(this.loadMoreContainer);

    if (!this.hasMorePresets || this.currentTab === 'my-submissions') {
      this.loadMoreContainer.classList.add('hidden');
      return;
    }

    this.loadMoreContainer.classList.remove('hidden');

    const loadMoreBtn = this.createElement('button', {
      className: 'px-6 py-2 text-sm rounded-lg transition-colors',
      textContent: LanguageService.t('preset.loadMore'),
      attributes: {
        style:
          'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);',
      },
    });

    this.on(loadMoreBtn, 'click', async () => {
      this.currentPage++;
      await this.loadPresets(true);
    });

    this.loadMoreContainer.appendChild(loadMoreBtn);
  }

  /**
   * Get preset colors as hex strings
   */
  private getPresetColors(preset: UnifiedPreset): string[] {
    const dyes = hybridPresetService.resolveDyes(preset.dyes);
    return dyes.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => d.hex);
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

  // ============================================================================
  // Data Loading
  // ============================================================================

  /**
   * Load presets based on current filters
   */
  private async loadPresets(append = false): Promise<void> {
    this.isLoading = true;
    if (!append) {
      this.presets = [];
    }
    this.renderEmptyState();
    this.showEmptyState(true);

    try {
      // Load featured presets (only on browse tab, first page)
      if (this.currentTab === 'browse' && !append) {
        this.featuredPresets = await hybridPresetService.getFeaturedPresets(4);
      }

      // Build filter options
      const options: Parameters<typeof hybridPresetService.getPresets>[0] = {
        sort: this.sortBy,
        limit: this.pageSize,
      };

      if (this.selectedCategory !== 'all') {
        options.category = this.selectedCategory as PresetCategory;
      }

      if (this.searchQuery) {
        options.search = this.searchQuery;
      }

      const newPresets = await hybridPresetService.getPresets(options);

      if (append) {
        this.presets = [...this.presets, ...newPresets];
      } else {
        this.presets = newPresets;
      }

      // Check if there might be more presets
      this.hasMorePresets = newPresets.length === this.pageSize;
    } catch (error) {
      logger.error('[PresetTool] Failed to load presets:', error);
      this.presets = [];
      this.featuredPresets = [];
    }

    this.isLoading = false;

    // Update UI
    if (this.presets.length === 0 && this.featuredPresets.length === 0) {
      this.renderEmptyState();
      this.showEmptyState(true);
    } else {
      this.showEmptyState(false);
      this.renderFeaturedPresets();
      this.renderPresetsGrid();
      this.renderLoadMore();
    }
  }

  /**
   * Load user's submissions
   */
  private async loadUserSubmissions(): Promise<void> {
    if (!this.authState.isAuthenticated) {
      this.userSubmissions = [];
      return;
    }

    this.isLoading = true;
    this.renderEmptyState();
    this.showEmptyState(true);

    try {
      const response = await presetSubmissionService.getMySubmissions();
      this.userSubmissions = response.presets;
    } catch (error) {
      logger.error('[PresetTool] Failed to load user submissions:', error);
      this.userSubmissions = [];
    }

    this.isLoading = false;

    // Update auth section to show submission count
    this.updateAuthSection();

    // Update UI
    if (this.userSubmissions.length === 0) {
      this.renderEmptyState();
      this.showEmptyState(true);
    } else {
      this.showEmptyState(false);
      this.renderFeaturedPresets();
      this.renderPresetsGrid();
      this.renderLoadMore();
    }
  }

  /**
   * Handle preset card click - show detail view
   */
  private handlePresetClick(preset: UnifiedPreset): void {
    logger.info('[PresetTool] Preset clicked:', preset.name);
    this.showDetailView(preset);
  }

  /**
   * Show detail view for a preset
   */
  private showDetailView(preset: UnifiedPreset): void {
    this.selectedPreset = preset;

    // Clean up existing detail view if any
    this.detailView?.destroy();
    this.detailView = null;

    // Hide the grid content and show detail view
    const right = this.options.rightPanel;
    clearContainer(right);

    // Create container for detail view
    const detailContainer = this.createElement('div', {
      className: 'preset-detail-container',
    });
    right.appendChild(detailContainer);

    // Create and render the detail view
    this.detailView = new PresetDetailView(detailContainer, preset, {
      onBack: () => this.hideDetailView(),
      onVoteUpdate: (updatedPreset) => this.handleVoteUpdate(updatedPreset),
    });
    this.detailView.init();

    logger.info('[PresetTool] Detail view shown for:', preset.name);
  }

  /**
   * Hide detail view and return to grid
   */
  private hideDetailView(): void {
    this.selectedPreset = null;

    // Clean up detail view
    this.detailView?.destroy();
    this.detailView = null;

    // Re-render the right panel with grid content
    this.renderRightPanel();

    // Re-populate with current data
    if (this.presets.length === 0 && this.featuredPresets.length === 0) {
      this.renderEmptyState();
      this.showEmptyState(true);
    } else {
      this.showEmptyState(false);
      this.renderFeaturedPresets();
      this.renderPresetsGrid();
      this.renderLoadMore();
    }

    logger.info('[PresetTool] Returned to grid view');
  }

  /**
   * Handle vote update from detail view
   */
  private handleVoteUpdate(updatedPreset: UnifiedPreset): void {
    // Update the preset in our local arrays
    const updateInArray = (arr: UnifiedPreset[]) => {
      const index = arr.findIndex((p) => p.id === updatedPreset.id);
      if (index !== -1) {
        arr[index] = updatedPreset;
      }
    };

    updateInArray(this.presets);
    updateInArray(this.featuredPresets);

    logger.info(
      '[PresetTool] Vote updated for:',
      updatedPreset.name,
      'new count:',
      updatedPreset.voteCount
    );
  }

  /**
   * Handle edit button click on user's preset
   */
  private handleEditPreset(preset: UnifiedPreset): void {
    if (!preset.apiPresetId) {
      logger.warn('[PresetTool] Cannot edit preset without API ID');
      return;
    }

    // Find the original CommunityPreset from userSubmissions
    const communityPreset = this.userSubmissions.find((p) => p.id === preset.apiPresetId);
    if (!communityPreset) {
      logger.warn('[PresetTool] Cannot find original community preset for editing');
      return;
    }

    showPresetEditForm(communityPreset, (result) => {
      if (result.success) {
        logger.info('[PresetTool] Preset updated successfully');
        // Refresh the lists
        void this.loadUserSubmissions();
        if (this.currentTab === 'browse') {
          void this.loadPresets();
        }
      }
    });
  }

  /**
   * Handle delete button click on user's preset
   */
  private async handleDeletePreset(preset: UnifiedPreset): Promise<void> {
    if (!preset.apiPresetId) {
      logger.warn('[PresetTool] Cannot delete preset without API ID');
      return;
    }

    // Show confirmation dialog
    const confirmMessage =
      LanguageService.t('preset.confirmDelete');

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await presetSubmissionService.deletePreset(preset.apiPresetId);
      logger.info('[PresetTool] Preset deleted successfully');

      // Refresh the lists
      void this.loadUserSubmissions();
      if (this.currentTab === 'browse') {
        void this.loadPresets();
      }
    } catch (error) {
      logger.error('[PresetTool] Failed to delete preset:', error);
      // Could show an error toast here
    }
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    this.updateDrawerContent();
  }

  private updateDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;

    // Clean up existing mobile panels
    this.mobileCollapsiblePanels.forEach((panel) => panel.destroy());
    this.mobileCollapsiblePanels = [];
    this.mobileAuthButton?.destroy();
    this.mobileAuthButton = null;

    // Preserve nav section if it exists
    const navSection = drawer.querySelector('[data-drawer-nav]');
    clearContainer(drawer);
    if (navSection) {
      drawer.appendChild(navSection);
    }

    // Section 1: Search (with tabs if authenticated)
    const searchPanel = new CollapsiblePanel(drawer, {
      title: LanguageService.t('preset.search'),
      storageKey: 'preset_drawer_search',
      defaultOpen: true,
      icon: ICON_SEARCH,
    });
    searchPanel.init();
    this.mobileCollapsiblePanels.push(searchPanel);
    const searchContent = searchPanel.getContentContainer();
    if (searchContent) {
      this.renderMobileSearchAndTabs(searchContent);
    }

    // Section 2: Categories
    const categoriesPanel = new CollapsiblePanel(drawer, {
      title: LanguageService.t('preset.categoriesTitle'),
      storageKey: 'preset_drawer_categories',
      defaultOpen: true,
      icon: ICON_GRID,
    });
    categoriesPanel.init();
    this.mobileCollapsiblePanels.push(categoriesPanel);
    const categoriesContent = categoriesPanel.getContentContainer();
    if (categoriesContent) {
      this.renderMobileCategories(categoriesContent);
    }

    // Section 3: Sort Options
    const sortPanel = new CollapsiblePanel(drawer, {
      title: LanguageService.t('preset.sortBy'),
      storageKey: 'preset_drawer_sort',
      defaultOpen: true,
      icon: ICON_SORT,
    });
    sortPanel.init();
    this.mobileCollapsiblePanels.push(sortPanel);
    const sortContent = sortPanel.getContentContainer();
    if (sortContent) {
      this.renderMobileSortOptions(sortContent);
    }

    // Section 4: Account
    const accountPanel = new CollapsiblePanel(drawer, {
      title: LanguageService.t('preset.account'),
      storageKey: 'preset_drawer_account',
      defaultOpen: true,
      icon: ICON_USER,
    });
    accountPanel.init();
    this.mobileCollapsiblePanels.push(accountPanel);
    const accountContent = accountPanel.getContentContainer();
    if (accountContent) {
      this.renderMobileAuthSection(accountContent);
    }
  }

  /**
   * Render search input and tab toggle for mobile drawer
   */
  private renderMobileSearchAndTabs(container: HTMLElement): void {
    const wrapper = this.createElement('div', { className: 'space-y-3' });

    // Tab toggle (only shown when authenticated)
    const tabContainer = this.createElement('div', { className: 'flex gap-2 mb-3' });

    if (this.authState.isAuthenticated) {
      const browseBtn = this.createElement('button', {
        className: 'flex-1 px-3 py-2 text-sm rounded-lg transition-colors',
        textContent: LanguageService.t('preset.browse'),
        attributes: {
          style:
            this.currentTab === 'browse'
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: var(--theme-background-secondary); color: var(--theme-text);',
        },
      });

      const mySubmissionsBtn = this.createElement('button', {
        className: 'flex-1 px-3 py-2 text-sm rounded-lg transition-colors',
        textContent: LanguageService.t('preset.mySubmissions'),
        attributes: {
          style:
            this.currentTab === 'my-submissions'
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: var(--theme-background-secondary); color: var(--theme-text);',
        },
      });

      this.on(browseBtn, 'click', () => {
        this.currentTab = 'browse';
        StorageService.setItem(STORAGE_KEYS.tab, 'browse');
        this.updateTabVisibility();
        this.currentPage = 1;
        void this.loadPresets();
        this.updateDrawerContent();
      });

      this.on(mySubmissionsBtn, 'click', () => {
        this.currentTab = 'my-submissions';
        StorageService.setItem(STORAGE_KEYS.tab, 'my-submissions');
        this.updateTabVisibility();
        void this.loadUserSubmissions();
        this.updateDrawerContent();
      });

      tabContainer.appendChild(browseBtn);
      tabContainer.appendChild(mySubmissionsBtn);
      wrapper.appendChild(tabContainer);
    }

    // Search input with icon
    const searchWrapper = this.createElement('div', { className: 'relative' });

    const searchIcon = this.createElement('span', {
      className: 'absolute left-3 top-1/2 -translate-y-1/2 opacity-50',
      attributes: { style: 'color: var(--theme-text);' },
    });
    searchIcon.innerHTML = ICON_SEARCH;
    searchWrapper.appendChild(searchIcon);

    const searchInput = this.createElement('input', {
      className: 'w-full pl-10 pr-3 py-2 rounded-lg border text-sm',
      attributes: {
        type: 'text',
        placeholder: LanguageService.t('preset.searchPlaceholder'),
        value: this.searchQuery,
        style:
          'background: var(--theme-background); border-color: var(--theme-border); color: var(--theme-text);',
      },
    }) as HTMLInputElement;

    this.on(searchInput, 'input', () => {
      // Debounce search
      if (this.searchDebounceTimeout) {
        clearTimeout(this.searchDebounceTimeout);
      }
      this.searchDebounceTimeout = setTimeout(() => {
        this.searchQuery = searchInput.value || '';
        this.currentPage = 1;
        void this.loadPresets();
        // Also update the desktop search input if present
        if (this.searchInput && this.searchInput !== searchInput) {
          this.searchInput.value = this.searchQuery;
        }
      }, 300);
    });

    searchWrapper.appendChild(searchInput);
    wrapper.appendChild(searchWrapper);

    container.appendChild(wrapper);
  }

  /**
   * Render category filters for mobile drawer
   */
  private renderMobileCategories(container: HTMLElement): void {
    const categoryWrapper = this.createElement('div', { className: 'space-y-1' });

    CATEGORIES.forEach((cat) => {
      const isSelected = this.selectedCategory === cat.id;
      const btn = this.createElement('button', {
        className: 'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
        textContent: LanguageService.t(cat.labelKey),
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
        },
      });

      this.on(btn, 'click', () => {
        this.selectedCategory = cat.id;
        StorageService.setItem(STORAGE_KEYS.category, cat.id);
        this.updateCategoryButtons();
        this.currentPage = 1;
        void this.loadPresets();
        this.updateDrawerContent();
      });

      categoryWrapper.appendChild(btn);
    });

    container.appendChild(categoryWrapper);
  }

  /**
   * Render sort options for mobile drawer
   */
  private renderMobileSortOptions(container: HTMLElement): void {
    const sortWrapper = this.createElement('div', { className: 'space-y-2' });

    SORT_OPTIONS.forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });

      const radio = this.createElement('input', {
        className: 'w-4 h-4',
        attributes: {
          type: 'radio',
          name: 'mobile-preset-sort',
          value: opt.id,
          ...(isSelected && { checked: 'checked' }),
        },
      }) as HTMLInputElement;

      this.on(radio, 'change', () => {
        this.sortBy = opt.id;
        StorageService.setItem(STORAGE_KEYS.sortBy, opt.id);
        this.currentPage = 1;
        void this.loadPresets();
        // Update desktop sort options if present
        if (this.sortContainer) {
          const desktopRadios =
            this.sortContainer.querySelectorAll<HTMLInputElement>('input[type="radio"]');
          desktopRadios.forEach((r) => {
            r.checked = r.value === opt.id;
          });
        }
        this.updateDrawerContent();
      });

      const text = this.createElement('span', {
        className: 'text-sm',
        textContent: LanguageService.t(opt.labelKey),
        attributes: { style: 'color: var(--theme-text);' },
      });

      label.appendChild(radio);
      label.appendChild(text);
      sortWrapper.appendChild(label);
    });

    container.appendChild(sortWrapper);
  }

  /**
   * Render auth section for mobile drawer
   */
  private renderMobileAuthSection(container: HTMLElement): void {
    const wrapper = this.createElement('div', { className: 'space-y-3' });

    if (this.authState.isAuthenticated && this.authState.user) {
      // Logged in state
      const userCard = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      // Avatar
      const avatar = this.createElement('div', {
        className: 'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
        attributes: { style: 'background: var(--theme-primary);' },
      });

      if (this.authState.user.avatar_url) {
        const img = this.createElement('img', {
          className: 'w-full h-full rounded-full object-cover',
          attributes: {
            src: this.authState.user.avatar_url,
            alt: this.authState.user.global_name || this.authState.user.username,
          },
        });
        avatar.appendChild(img);
      } else {
        avatar.textContent = (this.authState.user.global_name || this.authState.user.username)
          .charAt(0)
          .toUpperCase();
      }

      userCard.appendChild(avatar);

      // User info
      const userInfo = this.createElement('div', { className: 'flex-1' });
      const userName = this.createElement('p', {
        className: 'text-sm font-medium',
        textContent: this.authState.user.global_name || this.authState.user.username,
        attributes: { style: 'color: var(--theme-text);' },
      });
      const submissionCount = this.createElement('p', {
        className: 'text-xs',
        textContent: `${this.userSubmissions.length} ${LanguageService.t('preset.submissions')}`,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      userInfo.appendChild(userName);
      userInfo.appendChild(submissionCount);
      userCard.appendChild(userInfo);

      wrapper.appendChild(userCard);

      // Submit Preset button
      const submitBtn = this.createElement('button', {
        className: 'w-full px-3 py-2 text-sm rounded-lg',
        textContent: `+ ${LanguageService.t('preset.submitPreset')}`,
        attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
      });
      this.on(submitBtn, 'click', () => {
        showPresetSubmissionForm((result) => {
          if (result.success) {
            void this.loadUserSubmissions();
            void this.loadPresets();
          }
        });
      });
      wrapper.appendChild(submitBtn);

      // Logout button
      const logoutBtn = this.createElement('button', {
        className: 'w-full px-3 py-2 text-sm rounded-lg text-red-500',
        textContent: LanguageService.t('auth.logout'),
        attributes: {
          style: 'background: transparent; border: 1px solid var(--theme-border);',
        },
      });
      this.on(logoutBtn, 'click', async () => {
        await authService.logout();
      });
      wrapper.appendChild(logoutBtn);
    } else {
      // Logged out state
      const message = this.createElement('p', {
        className: 'text-sm mb-3',
        textContent: LanguageService.t('preset.loginPrompt'),
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      wrapper.appendChild(message);

      // Auth button
      const authContainer = this.createElement('div');
      this.mobileAuthButton = new AuthButton(authContainer, { returnTool: 'presets' });
      this.mobileAuthButton.init();
      wrapper.appendChild(authContainer);
    }

    container.appendChild(wrapper);
  }
}
