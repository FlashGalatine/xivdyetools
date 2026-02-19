/**
 * XIV Dye Tools v4.0.0 - Market Board Component
 *
 * UI component for Market Board settings and controls.
 * Delegates price data management to MarketBoardService.
 *
 * Features:
 * - Server/data center selection dropdown
 * - Show prices toggle
 * - Price category filters
 * - Refresh button
 *
 * @module components/market-board
 */

import { BaseComponent } from './base-component';
import { LanguageService, WorldService } from '@services/index';
import {
  MarketBoardService,
  formatPrice as serviceFormatPrice,
  type PriceCategorySettings,
} from '@services/market-board-service';
import { ToastService } from '@services/toast-service';
import type { Dye, PriceData } from '@shared/types';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';

// Re-export PriceCategorySettings for backward compatibility
export type { PriceCategorySettings } from '@services/market-board-service';

/**
 * Market Board component - displays FFXIV market prices for dyes
 * Delegates to MarketBoardService for data management
 */
export class MarketBoard extends BaseComponent {
  private service: MarketBoardService;
  private isRefreshing: boolean = false;
  private languageUnsubscribe: (() => void) | null = null;
  // Handler references for MarketBoardService event cleanup
  private boundServerChangedHandler: ((event: Event) => void) | null = null;
  private boundSettingsChangedHandler: ((event: Event) => void) | null = null;

  // Local UI state (mirrors service state for rendering)
  private get selectedServer(): string {
    return this.service.getSelectedServer();
  }
  private get showPrices(): boolean {
    return this.service.getShowPrices();
  }
  private get priceCategories(): PriceCategorySettings {
    return this.service.getPriceCategories();
  }

  constructor(container: HTMLElement) {
    super(container);
    this.service = MarketBoardService.getInstance();
  }

  /**
   * Ensure WorldService is initialized and update dropdown
   * WorldService is typically already initialized by initializeServices(),
   * but this ensures the dropdown is populated after component mounts.
   */
  async loadServerData(): Promise<void> {
    try {
      // Ensure WorldService is initialized (usually already done at app startup)
      await WorldService.initialize();

      // Re-populate server dropdown after ensuring data is loaded
      const serverSelect = this.querySelector<HTMLSelectElement>('#mb-server-select');
      if (serverSelect) {
        this.populateServerDropdown(serverSelect);
      }
    } catch (error) {
      logger.error('Error ensuring WorldService initialization:', error);
    }
  }

  /**
   * Render the market board component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // Note: Title is provided by the parent CollapsiblePanel, so we don't render one here

    const content = this.createElement('div', {
      className: 'space-y-4',
    });

    // Server Selection Dropdown
    const serverSection = this.createElement('div', {});

    const serverLabel = this.createElement('label', {
      textContent: LanguageService.t('marketBoard.server'),
      className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
      attributes: {
        for: 'mb-server-select',
      },
    });
    serverSection.appendChild(serverLabel);

    const serverSelect = this.createElement('select', {
      className:
        'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:outline-none transition text-sm',
      attributes: {
        id: 'mb-server-select',
        style: 'transition: all 0.2s;',
      },
    }) as HTMLSelectElement;

    // Add focus styling with theme colors
    serverSelect.addEventListener('focus', () => {
      serverSelect.style.borderColor = 'var(--theme-primary)';
    });
    serverSelect.addEventListener('blur', () => {
      serverSelect.style.borderColor = '';
    });

    // Populate server dropdown
    this.populateServerDropdown(serverSelect);
    serverSection.appendChild(serverSelect);
    content.appendChild(serverSection);

    // Price Settings Panel
    const pricePanel = this.createElement('div', {
      className:
        'bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700',
    });

    // Show Prices Toggle
    const toggleRow = this.createElement('div', {
      className: 'flex justify-between items-center mb-3',
    });

    const toggleLabel = this.createElement('label', {
      textContent: LanguageService.t('marketBoard.showPrices'),
      className: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
    });
    toggleRow.appendChild(toggleLabel);

    const toggleWrapper = this.createElement('label', {
      className: 'relative inline-flex items-center cursor-pointer',
    });

    const toggleInput = this.createElement('input', {
      className: 'sr-only peer',
      attributes: {
        type: 'checkbox',
        id: 'show-mb-prices-toggle',
        ...(this.showPrices ? { checked: 'true' } : {}),
      },
    }) as HTMLInputElement;
    toggleWrapper.appendChild(toggleInput);

    const toggleBg = this.createElement('div', {
      className:
        "w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600",
      attributes: {
        style: 'box-shadow: 0 0 0 0 transparent; transition: box-shadow 0.2s;',
      },
    });

    // Apply theme-aware styling via inline styles for toggle background
    toggleInput.addEventListener('change', () => {
      if (toggleInput.checked) {
        toggleBg.style.backgroundColor = 'var(--theme-primary)';
      } else {
        toggleBg.style.backgroundColor = '';
      }
    });

    // Set initial state
    if (this.showPrices) {
      toggleBg.style.backgroundColor = 'var(--theme-primary)';
    }
    toggleWrapper.appendChild(toggleBg);

    toggleRow.appendChild(toggleWrapper);
    pricePanel.appendChild(toggleRow);

    // Price Category Checkboxes
    const priceSettings = this.createElement('div', {
      className: `space-y-2 ${this.showPrices ? '' : 'hidden'}`,
      attributes: {
        id: 'mb-price-settings',
      },
    });

    const categoryCheckboxes = this.createElement('div', {
      className: 'text-xs space-y-2',
    });

    // Add each price category checkbox
    const categories = [
      {
        id: 'baseDyes',
        label: LanguageService.t('marketBoard.baseDyes'),
        key: 'baseDyes' as keyof PriceCategorySettings,
      },
      {
        id: 'craftDyes',
        label: LanguageService.t('marketBoard.craftDyes'),
        key: 'craftDyes' as keyof PriceCategorySettings,
      },
      {
        id: 'alliedSocietyDyes',
        label: LanguageService.t('marketBoard.alliedSocietyDyes'),
        key: 'alliedSocietyDyes' as keyof PriceCategorySettings,
      },
      {
        id: 'cosmicDyes',
        label: LanguageService.t('marketBoard.cosmicDyes'),
        key: 'cosmicDyes' as keyof PriceCategorySettings,
      },
      {
        id: 'specialDyes',
        label: LanguageService.t('marketBoard.specialDyes'),
        key: 'specialDyes' as keyof PriceCategorySettings,
      },
    ];

    for (const category of categories) {
      const checkboxRow = this.createElement('div', {
        className: 'flex items-center',
      });

      const checkbox = this.createElement('input', {
        className:
          'h-3 w-3 border-gray-300 dark:border-gray-600 rounded mb-price-checkbox focus:ring-2',
        attributes: {
          type: 'checkbox',
          id: `mb-price-${category.id}`,
          'data-category': category.key,
          style: 'accent-color: var(--theme-primary);',
          ...(this.priceCategories[category.key] ? { checked: 'true' } : {}),
        },
      });
      checkboxRow.appendChild(checkbox);

      const checkboxLabel = this.createElement('label', {
        textContent: category.label,
        className: 'ml-2 text-gray-600 dark:text-gray-400',
        attributes: {
          for: `mb-price-${category.id}`,
        },
      });
      checkboxRow.appendChild(checkboxLabel);

      categoryCheckboxes.appendChild(checkboxRow);
    }

    priceSettings.appendChild(categoryCheckboxes);

    // Refresh Button
    const refreshBtn = this.createElement('button', {
      textContent: LanguageService.t('marketBoard.refresh'),
      className:
        'w-full px-3 py-2 text-xs disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-all duration-200 font-medium mt-3',
      attributes: {
        id: 'mb-refresh-btn',
        style: 'background-color: var(--theme-primary); color: var(--theme-text-header);',
      },
    });

    // Add hover effect with brightness filter (only when not disabled)
    refreshBtn.addEventListener('mouseenter', () => {
      if (!refreshBtn.disabled) {
        refreshBtn.style.filter = 'brightness(0.9)';
      }
    });
    refreshBtn.addEventListener('mouseleave', () => {
      refreshBtn.style.filter = '';
    });
    refreshBtn.addEventListener('mousedown', () => {
      if (!refreshBtn.disabled) {
        refreshBtn.style.filter = 'brightness(0.8)';
      }
    });
    refreshBtn.addEventListener('mouseup', () => {
      if (!refreshBtn.disabled) {
        refreshBtn.style.filter = 'brightness(0.9)';
      }
    });
    priceSettings.appendChild(refreshBtn);

    // Status Message
    const statusMsg = this.createElement('div', {
      className: 'mt-2 text-xs text-gray-500 dark:text-gray-400 text-center',
      attributes: {
        id: 'mb-price-status',
      },
    });
    priceSettings.appendChild(statusMsg);

    pricePanel.appendChild(priceSettings);
    content.appendChild(pricePanel);

    wrapper.appendChild(content);

    // Clear existing content and add new
    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Populate server dropdown with data centers and worlds
   */
  private populateServerDropdown(selectElement: HTMLSelectElement): void {
    // Get data centers from WorldService and sort alphabetically
    const dataCenters = WorldService.getAllDataCenters();
    const sortedDataCenters = [...dataCenters].sort((a, b) => a.name.localeCompare(b.name));

    // For each data center, add the DC as an option and its worlds as sub-options
    for (const dc of sortedDataCenters) {
      // Create optgroup for this data center
      const optgroup = document.createElement('optgroup');
      optgroup.label = `${dc.name} (${dc.region})`;

      // Add the data center itself as an option
      const dcOption = document.createElement('option');
      dcOption.value = dc.name;
      dcOption.textContent = `${dc.name} - ${LanguageService.t('marketBoard.allWorlds')}`;
      if (dc.name === this.selectedServer) {
        dcOption.selected = true;
      }
      optgroup.appendChild(dcOption);

      // Get worlds for this data center (already sorted by WorldService)
      const dcWorlds = WorldService.getWorldsInDataCenter(dc.name).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      // Add each world as an option
      for (const world of dcWorlds) {
        const worldOption = document.createElement('option');
        worldOption.value = world.name;
        worldOption.textContent = `  ${world.name}`;
        if (world.name === this.selectedServer) {
          worldOption.selected = true;
        }
        optgroup.appendChild(worldOption);
      }

      selectElement.appendChild(optgroup);
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Server selection change
    const serverSelect = this.querySelector<HTMLSelectElement>('#mb-server-select');
    if (serverSelect) {
      this.on(serverSelect, 'change', () => {
        // Update service (which updates ConfigController and persists)
        this.service.setServer(serverSelect.value);
        // Emit for backward compatibility with existing tool listeners
        console.info('📣 [MarketBoard] Emitting server-changed, server=', serverSelect.value);
        this.emit('server-changed', { server: serverSelect.value });
      });
    }

    // Show prices toggle
    const toggleInput = this.querySelector<HTMLInputElement>('#show-mb-prices-toggle');
    if (toggleInput) {
      this.on(toggleInput, 'change', () => {
        // Update service (which updates ConfigController and persists)
        this.service.setShowPrices(toggleInput.checked);

        // Show/hide price settings
        const priceSettings = this.querySelector('#mb-price-settings');
        if (priceSettings) {
          priceSettings.classList.toggle('hidden', !toggleInput.checked);
        }

        // Emit for backward compatibility with existing tool listeners
        console.info('📣 [MarketBoard] Emitting showPricesChanged, checked=', toggleInput.checked);
        this.emit('showPricesChanged', { showPrices: toggleInput.checked });
      });
    }

    // Price category checkboxes
    const checkboxes = this.querySelectorAll<HTMLInputElement>('.mb-price-checkbox');
    for (const checkbox of checkboxes) {
      this.on(checkbox, 'change', () => {
        const category = checkbox.getAttribute('data-category') as keyof PriceCategorySettings;
        if (category) {
          // Update service (which persists to localStorage)
          this.service.setCategories({ [category]: checkbox.checked });
          // Emit for backward compatibility with existing tool listeners
          this.emit('categories-changed', { categories: this.service.getPriceCategories() });
        }
      });
    }

    // Refresh button
    const refreshBtn = this.querySelector<HTMLButtonElement>('#mb-refresh-btn');
    if (refreshBtn) {
      this.on(refreshBtn, 'click', async () => {
        await this.refreshPrices();
      });
    }
  }

  /**
   * Refresh market prices (clears cache and fetches new data)
   */
  async refreshPrices(): Promise<void> {
    if (this.isRefreshing) return;

    // Check for offline status first
    if (!navigator.onLine) {
      ToastService.warning(LanguageService.t('marketBoard.offlineWarning'));
      return;
    }

    this.isRefreshing = true;
    const statusMsg = this.querySelector('#mb-price-status');
    const refreshBtn = this.querySelector<HTMLButtonElement>('#mb-refresh-btn');

    if (refreshBtn) {
      refreshBtn.disabled = true;
      // Show inline spinner with loading text
      const spinnerSvg = `<svg class="loading-spinner w-4 h-4" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
      refreshBtn.innerHTML = `
        <span class="inline-flex items-center justify-center gap-2">
          ${spinnerSvg}
          <span>${LanguageService.t('marketBoard.refreshing')}</span>
        </span>
      `.trim();
    }

    if (statusMsg) {
      statusMsg.textContent = LanguageService.t('marketBoard.clearingCache');
    }

    try {
      // Clear the price cache via service
      await this.service.refreshPrices();

      // Emit event so parent component can re-fetch prices
      this.emit('refresh-requested', {});

      if (statusMsg) {
        statusMsg.textContent = LanguageService.t('marketBoard.pricesRefreshed');
        setTimeout(() => {
          statusMsg.textContent = '';
        }, 3000);
      }
    } catch (error) {
      logger.error('Error refreshing prices:', error);
      ToastService.error(LanguageService.t('marketBoard.refreshError'));
      if (statusMsg) {
        statusMsg.textContent = LanguageService.t('marketBoard.refreshError');
      }
    } finally {
      this.isRefreshing = false;
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = LanguageService.t('marketBoard.refresh');
      }
    }
  }

  /**
   * Check if a dye should have its price fetched based on current filter settings
   * Delegates to MarketBoardService
   */
  shouldFetchPrice(dye: Dye): boolean {
    if (!dye || !dye.itemID) return false;
    return this.service.shouldFetchPrice(dye);
  }

  /**
   * Fetch price for a dye using current server settings
   * @deprecated Use fetchPricesForDyes for batch fetching (better performance)
   */
  async fetchPrice(dye: Dye): Promise<PriceData | null> {
    if (!this.showPrices || !this.shouldFetchPrice(dye)) {
      return null;
    }

    try {
      const prices = await this.service.fetchPricesForDyes([dye]);
      return prices.get(dye.itemID) ?? null;
    } catch (error) {
      logger.error(`Failed to fetch price for ${dye.name}:`, error);
      return null;
    }
  }

  /**
   * Fetch prices for multiple dyes using batch API
   * Delegates to MarketBoardService with request versioning for race condition protection
   *
   * @param dyes - Array of dyes to fetch prices for
   * @param onProgress - Optional callback to report progress (current, total)
   */
  async fetchPricesForDyes(
    dyes: Dye[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<number, PriceData>> {
    return this.service.fetchPricesForDyes(dyes, onProgress);
  }

  /**
   * Format price for display
   * Delegates to formatPrice from market-board-service
   */
  static formatPrice(price: number): string {
    return serviceFormatPrice(price);
  }

  /**
   * Initialize the component
   */
  onMount(): void {
    // Load server data (data centers and worlds) on mount
    void this.loadServerData();

    // Clean up existing subscription before creating a new one (prevents exponential leak)
    this.languageUnsubscribe?.();

    // Subscribe to language changes to update localized text (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update(); // Re-render to update localized text (NOT init() - avoids infinite loop)
    });

    // Subscribe to MarketBoardService events and relay them as DOM events
    // This allows tools to receive server-changed events when ConfigSidebar changes the server
    this.cleanupServiceSubscriptions();

    this.boundServerChangedHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ server: string; previousServer: string }>;
      const { server } = customEvent.detail;
      // Update dropdown UI to reflect the new server
      const serverSelect = this.querySelector<HTMLSelectElement>('#mb-server-select');
      if (serverSelect && serverSelect.value !== server) {
        serverSelect.value = server;
      }
      // Re-emit as DOM event for tool listeners
      console.info('📣 [MarketBoard] Relaying server-changed from service, server=', server);
      this.emit('server-changed', { server });
    };
    this.service.addEventListener('server-changed', this.boundServerChangedHandler);

    this.boundSettingsChangedHandler = (event: Event) => {
      const customEvent = event as CustomEvent<{ showPrices: boolean }>;
      const { showPrices } = customEvent.detail;
      // Update toggle UI to reflect the new setting
      const toggleInput = this.querySelector<HTMLInputElement>('#show-mb-prices-toggle');
      if (toggleInput && toggleInput.checked !== showPrices) {
        toggleInput.checked = showPrices;
        // Update toggle background color
        const toggleBg = toggleInput.nextElementSibling as HTMLElement;
        if (toggleBg) {
          toggleBg.style.backgroundColor = showPrices ? 'var(--theme-primary)' : '';
        }
      }
      // Show/hide price settings
      const priceSettings = this.querySelector('#mb-price-settings');
      if (priceSettings) {
        priceSettings.classList.toggle('hidden', !showPrices);
      }
      // Re-emit as DOM event for tool listeners
      console.info(
        '📣 [MarketBoard] Relaying showPricesChanged from service, showPrices=',
        showPrices
      );
      this.emit('showPricesChanged', { showPrices });
    };
    this.service.addEventListener('settings-changed', this.boundSettingsChangedHandler);
  }

  /**
   * Clean up MarketBoardService event subscriptions
   */
  private cleanupServiceSubscriptions(): void {
    if (this.boundServerChangedHandler) {
      this.service.removeEventListener('server-changed', this.boundServerChangedHandler);
      this.boundServerChangedHandler = null;
    }
    if (this.boundSettingsChangedHandler) {
      this.service.removeEventListener('settings-changed', this.boundSettingsChangedHandler);
      this.boundSettingsChangedHandler = null;
    }
  }

  /**
   * Clean up subscriptions on destroy
   */
  override destroy(): void {
    if (this.languageUnsubscribe) {
      this.languageUnsubscribe();
      this.languageUnsubscribe = null;
    }
    // Clean up MarketBoardService event subscriptions
    this.cleanupServiceSubscriptions();
    super.destroy();
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      selectedServer: this.service.getSelectedServer(),
      showPrices: this.service.getShowPrices(),
      priceCategories: this.service.getPriceCategories(),
    };
  }

  /**
   * Set component state
   * Updates the service which persists and notifies subscribers
   */
  protected setState(newState: Record<string, unknown>): void {
    if (typeof newState.selectedServer === 'string') {
      this.service.setServer(newState.selectedServer);
    }
    if (typeof newState.showPrices === 'boolean') {
      this.service.setShowPrices(newState.showPrices);
    }
    if (typeof newState.priceCategories === 'object' && newState.priceCategories !== null) {
      this.service.setCategories(newState.priceCategories as Partial<PriceCategorySettings>);
    }
  }

  /**
   * Get selected server
   */
  getSelectedServer(): string {
    return this.service.getSelectedServer();
  }

  /**
   * Set selected server (for external config synchronization)
   */
  setSelectedServer(server: string): void {
    if (this.service.getSelectedServer() !== server) {
      // Update service (persists and notifies)
      this.service.setServer(server);
      // Update the dropdown UI if it exists
      const serverSelect = this.querySelector<HTMLSelectElement>('#mb-server-select');
      if (serverSelect) {
        serverSelect.value = server;
      }
      // Emit for backward compatibility
      this.emit('server-changed', { server });
    }
  }

  /**
   * Set show prices (for external config synchronization)
   */
  setShowPrices(show: boolean): void {
    if (this.service.getShowPrices() !== show) {
      // Update service (persists and notifies)
      this.service.setShowPrices(show);
      // Update the toggle UI if it exists
      const toggleInput = this.querySelector<HTMLInputElement>('#show-mb-prices-toggle');
      if (toggleInput) {
        toggleInput.checked = show;
      }
      // Show/hide price settings
      const priceSettings = this.querySelector('#mb-price-settings');
      if (priceSettings) {
        priceSettings.classList.toggle('hidden', !show);
      }
      // Emit for backward compatibility
      this.emit('showPricesChanged', { showPrices: show });
    }
  }

  /**
   * Get show prices setting
   */
  getShowPrices(): boolean {
    return this.service.getShowPrices();
  }

  /**
   * Get price category settings
   */
  getPriceCategories(): PriceCategorySettings {
    return this.service.getPriceCategories();
  }

  /**
   * Resolve a Universalis worldId to world name
   * @param worldId - Universalis world ID
   * @returns World name or undefined if not found
   * @deprecated Use MarketBoardService.getWorldNameForPrice() or WorldService.getWorldName() directly
   */
  getWorldName(worldId: number | undefined): string | undefined {
    return WorldService.getWorldName(worldId);
  }
}
