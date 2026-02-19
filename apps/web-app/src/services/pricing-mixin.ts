import type { MarketBoard } from '../components/market-board';
import type { PriceData } from '@shared/types';

export interface PricingState {
  showPrices: boolean;
  priceData: Map<number, PriceData>;
  marketBoard: MarketBoard | null;
  drawerMarketBoard?: MarketBoard | null;
  onPricesLoaded?: () => void;
}

/**
 * Options for setting up Market Board event listeners
 */
export interface MarketBoardListenerOptions {
  /**
   * Called when prices are toggled on/off via showPricesChanged event
   * If not provided, defaults to fetching prices when enabled
   */
  onPricesToggled?: () => void;

  /**
   * Called when the server is changed
   * If not provided, defaults to fetching prices if showPrices is true
   */
  onServerChanged?: () => void;

  /**
   * Called when price categories change
   * If not provided, defaults to fetching prices if showPrices is true
   */
  onCategoriesChanged?: () => void;

  /**
   * Called when user requests a refresh
   * If not provided, defaults to fetching prices if showPrices is true
   */
  onRefreshRequested?: () => void;
}

/**
 * Sets up standard Market Board event listeners on a container element.
 * This is a utility function that handles the common pattern of listening for
 * market board events and fetching prices when needed.
 *
 * @param container - The DOM element containing the MarketBoard component
 * @param shouldFetchPrices - Function that returns whether prices should be fetched (e.g., () => this.showPrices)
 * @param fetchPrices - Function to call to fetch/update prices
 * @param options - Optional callbacks for custom behavior on each event
 *
 * @example
 * // Basic usage - just fetch prices on all events
 * setupMarketBoardListeners(marketContent, () => this.showPrices, () => this.fetchPricesForMatches());
 *
 * @example
 * // With custom callbacks
 * setupMarketBoardListeners(marketContent, () => this.showPrices, () => this.fetchPricesForMatches(), {
 *   onServerChanged: () => {
 *     this.regenerateResults(); // Custom behavior
 *     if (this.showPrices) this.fetchPricesForMatches();
 *   }
 * });
 */
export function setupMarketBoardListeners(
  container: HTMLElement,
  shouldFetchPrices: () => boolean,
  fetchPrices: () => void | Promise<void>,
  options: MarketBoardListenerOptions = {}
): void {
  console.info(
    '📡 [setupMarketBoardListeners] Setting up listeners on container:',
    container.tagName,
    container.className
  );

  // Price toggle - showPricesChanged event
  container.addEventListener('showPricesChanged', (() => {
    console.info('📡 [setupMarketBoardListeners] showPricesChanged event received');
    if (options.onPricesToggled) {
      options.onPricesToggled();
    } else if (shouldFetchPrices()) {
      void fetchPrices();
    }
  }) as EventListener);

  // Server changed
  container.addEventListener('server-changed', (() => {
    console.info('📡 [setupMarketBoardListeners] server-changed event received');
    if (options.onServerChanged) {
      options.onServerChanged();
    } else if (shouldFetchPrices()) {
      void fetchPrices();
    }
  }) as EventListener);

  // Categories changed
  container.addEventListener('categories-changed', (() => {
    if (options.onCategoriesChanged) {
      options.onCategoriesChanged();
    } else if (shouldFetchPrices()) {
      void fetchPrices();
    }
  }) as EventListener);

  // Refresh requested
  container.addEventListener('refresh-requested', (() => {
    if (options.onRefreshRequested) {
      options.onRefreshRequested();
    } else if (shouldFetchPrices()) {
      void fetchPrices();
    }
  }) as EventListener);
}
